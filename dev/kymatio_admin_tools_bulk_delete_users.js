(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  function loadXlsx(cb) {
    if (window.XLSX) {
      cb();
      return;
    }

    var existing = document.querySelector('script[data-kym-xlsx="1"]');
    if (existing) {
      existing.addEventListener('load', cb);
      return;
    }

    var s = document.createElement('script');
    s.dataset.kymXlsx = '1';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = cb;
    s.onerror = function () {
      alert('No se pudo cargar la librería XLSX. Revisa la consola o la conexión.');
    };
    document.head.appendChild(s);
  }

  function renderGui(container, tools) {
    var $ = tools.$;
    var escHtml = tools.escHtml;

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando herramienta...</div>';

    loadXlsx(function () {
      buildPanel(container, tools, $, escHtml);
    });
  }

  function buildPanel(container, tools, $, escHtml) {
    var token = tools.state.token || localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    var companyId = tools.state.companyId || '';

    var userMap = {}; // email.toLowerCase() -> user object
    var dataLoaded = false;
    var isPaused = false;
    var results = [];
    var bulkRows = [];
    var summary = { total: 0, unique: 0, duplicates: 0, found: 0, missing: 0 };

    function getCurrentCompanyFromVue() {
      try {
        var store = document.querySelector('#app').__vue_app__.config.globalProperties.$store.state;
        var company = store.Admin.companySelected || store.Controller.companySelected;
        return {
          id: String(company.stakeholderId || ''),
          name: company.name || ''
        };
      } catch (e) {
        return {
          id: companyId,
          name: tools.state.companyName || ''
        };
      }
    }

    function apiHeaders() {
      return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      };
    }

    function sleep(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms);
      });
    }

    function normalizeEmail(value) {
      return String(value || '').trim().toLowerCase();
    }

    function looksLikeEmail(value) {
      var e = normalizeEmail(value);
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    }

    function addLog(msg, type) {
      var el = $('kym-del-log');
      if (!el) return;

      el.style.display = 'block';
      var colors = { ok: '#34d399', err: '#f87171', info: '#60a5fa', warn: '#fbbf24' };
      var line = document.createElement('div');
      line.style.color = colors[type] || '#94a3b8';
      line.textContent = '[' + new Date().toLocaleTimeString('es-ES') + '] ' + msg;
      el.appendChild(line);
      el.scrollTop = el.scrollHeight;
    }

    function setInlineStatus(id, html) {
      var el = $(id);
      if (el) el.innerHTML = html;
    }

    function updateRunBtn() {
      var btn = $('kym-del-btn-run');
      if (!btn) return;

      var ok = dataLoaded && bulkRows.length > 0 && summary.found > 0;
      btn.style.opacity = ok ? '1' : '.45';
      btn.style.cursor = ok ? 'pointer' : 'default';
    }

    async function loadData() {
      var current = getCurrentCompanyFromVue();
      companyId = current.id || companyId;
      tools.state.companyId = companyId;
      tools.state.companyName = current.name || tools.state.companyName;
      token = localStorage.getItem('token') || localStorage.getItem('access_token') || token;
      if (typeof tools.updateCompanyBanner === 'function') tools.updateCompanyBanner();

      var status = $('kym-del-load-status');
      if (status) status.innerHTML = '&#8987; Cargando usuarios activos...';

      dataLoaded = false;
      userMap = {};
      updateRunBtn();

      if (!companyId) {
        setInlineStatus('kym-del-load-status', '<span style="color:#d97706">&#9888; Selecciona una empresa y pulsa Actualizar empresa y datos.</span>');
        return;
      }

      if (!token) {
        setInlineStatus('kym-del-load-status', '<span style="color:#e53e3e">&#10007; No se ha encontrado token. Asegúrate de estar logado en Kymatio.</span>');
        return;
      }

      try {
        var res = await fetch(
          'https://api-dev.kymatio.xyz/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId) + '/people?stakeholderDepartmentParentName=true&stakeholderDepartmentId=true&avatar=true&email=true&authentication=true&locale=true&timezone=true&phoneNumber=true&environment=true&login=true&tags=true',
          { headers: apiHeaders() }
        );
        var data = await res.json();
        if (!res.ok) {
          throw new Error((data && (data.message || (data.records && data.records.devMessage))) || 'Error cargando usuarios: HTTP ' + res.status);
        }

        (data.records || []).forEach(function (u) {
          if (u.email) userMap[normalizeEmail(u.email)] = u;
        });

        dataLoaded = true;
        setInlineStatus(
          'kym-del-load-status',
          '<span style="color:#16a34a">&#10003; ' + Object.keys(userMap).length + ' usuarios activos cargados</span>'
        );
        recomputeSummary();
        updateRunBtn();
      } catch (e) {
        setInlineStatus('kym-del-load-status', '<span style="color:#e53e3e">&#10007; Error al cargar: ' + escHtml(e.message) + '</span>');
      }
    }

    function getEmailColumn(row) {
      var keys = Object.keys(row || {});
      var preferred = ['email', 'e-mail', 'correo', 'user email', 'user_email', 'old_email'];

      for (var i = 0; i < preferred.length; i++) {
        for (var j = 0; j < keys.length; j++) {
          if (String(keys[j]).trim().toLowerCase() === preferred[i]) return keys[j];
        }
      }

      for (var k = 0; k < keys.length; k++) {
        var kl = String(keys[k]).trim().toLowerCase();
        if (kl.indexOf('email') >= 0 || kl.indexOf('correo') >= 0 || kl.indexOf('mail') >= 0) return keys[k];
      }

      return keys[0] || null;
    }

    function setBulkRowsFromEmails(emails, fileName) {
      var seen = {};
      var duplicates = 0;
      var invalid = 0;
      var rows = [];

      emails.forEach(function (raw) {
        var email = normalizeEmail(raw);
        if (!email) return;
        if (!looksLikeEmail(email)) {
          invalid += 1;
          rows.push({ email: email, _invalid: true });
          return;
        }
        if (seen[email]) {
          duplicates += 1;
          return;
        }
        seen[email] = true;
        rows.push({ email: email });
      });

      bulkRows = rows;
      summary.total = emails.filter(function (e) { return normalizeEmail(e); }).length;
      summary.unique = rows.length;
      summary.duplicates = duplicates;
      summary.invalid = invalid;

      recomputeSummary();
      setInlineStatus('kym-del-file-info', escHtml(bulkRows.length + ' emails únicos: ' + fileName));
      renderSummary();
      updateRunBtn();
    }

    function recomputeSummary() {
      var found = 0;
      var missing = 0;
      bulkRows.forEach(function (r) {
        if (r._invalid) return;
        if (userMap[normalizeEmail(r.email)]) found += 1;
        else missing += 1;
      });
      summary.found = found;
      summary.missing = missing;
      renderSummary();
    }

    function renderSummary() {
      var el = $('kym-del-summary');
      if (!el) return;
      if (!bulkRows.length) {
        el.style.display = 'none';
        return;
      }

      el.style.display = 'block';
      el.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;text-align:center">' +
        '<div><div style="font-size:18px;font-weight:700;color:#1a202c">' + summary.total + '</div><div style="font-size:10px;color:#64748b">ENTRADAS</div></div>' +
        '<div><div style="font-size:18px;font-weight:700;color:#1a202c">' + summary.unique + '</div><div style="font-size:10px;color:#64748b">ÚNICOS</div></div>' +
        '<div><div style="font-size:18px;font-weight:700;color:#16a34a">' + summary.found + '</div><div style="font-size:10px;color:#64748b">A BORRAR</div></div>' +
        '<div><div style="font-size:18px;font-weight:700;color:#e53e3e">' + summary.missing + '</div><div style="font-size:10px;color:#64748b">NO ENCONTRADOS</div></div>' +
        '<div><div style="font-size:18px;font-weight:700;color:#d97706">' + (summary.duplicates || 0) + '</div><div style="font-size:10px;color:#64748b">DUPLICADOS</div></div>' +
        '</div>';
    }

    function parseTextFile(text, fileName) {
      var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) {
        bulkRows = [];
        setInlineStatus('kym-del-file-info', 'El archivo está vacío.');
        renderSummary();
        updateRunBtn();
        return;
      }

      var first = lines[0].toLowerCase();
      var hasHeader = first.indexOf('email') >= 0 || first.indexOf('correo') >= 0 || first.indexOf('mail') >= 0;
      var emailIndex = 0;

      if (hasHeader) {
        var headerParts = lines[0].split(/[,;\t]/).map(function (p) { return p.trim().toLowerCase(); });
        headerParts.forEach(function (h, idx) {
          if (h === 'email' || h === 'user email' || h === 'user_email' || h.indexOf('email') >= 0 || h.indexOf('correo') >= 0) emailIndex = idx;
        });
      }

      var emails = lines.slice(hasHeader ? 1 : 0).map(function (line) {
        var p = line.split(/[,;\t]/);
        return p[emailIndex] || p[0] || '';
      });

      setBulkRowsFromEmails(emails, fileName);
    }

    function parseExcelFile(binary, fileName) {
      var wb = XLSX.read(binary, { type: 'binary' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var data = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!data.length) {
        bulkRows = [];
        setInlineStatus('kym-del-file-info', 'La hoja está vacía.');
        renderSummary();
        updateRunBtn();
        return;
      }

      var emailCol = getEmailColumn(data[0]);
      if (!emailCol) {
        setInlineStatus('kym-del-file-info', '<span style="color:#e53e3e">Error: no se encontró columna email.</span>');
        return;
      }

      var emails = data.map(function (r) {
        return r[emailCol];
      });

      setBulkRowsFromEmails(emails, fileName);
    }

    async function deleteOne(row) {
      var email = normalizeEmail(row.email);

      if (row._invalid) {
        return { ok: false, skipped: true, msg: 'Email no válido' };
      }

      var user = userMap[email];
      if (!user) {
        return { ok: false, skipped: true, msg: 'Usuario no encontrado en la empresa' };
      }

      var stakeholderId = user.stakeholderId;
      if (!stakeholderId) {
        return { ok: false, skipped: true, msg: 'Usuario sin stakeholderId' };
      }

      var res = await fetch('https://api-dev.kymatio.xyz/v2/admin/stakeholders/people/' + encodeURIComponent(stakeholderId), {
        method: 'DELETE',
        headers: apiHeaders()
      });

      var rdata = null;
      try {
        rdata = await res.json();
      } catch (e) {}

      if (res.ok || res.status === 204) {
        delete userMap[email];
        return { ok: true, stakeholderId: stakeholderId, msg: 'Usuario borrado' };
      }

      var msg =
        (rdata && rdata.records && rdata.records.devMessage) ||
        (rdata && rdata.message) ||
        ('Error ' + res.status);
      return { ok: false, stakeholderId: stakeholderId, msg: String(msg) };
    }

    var html = '';
    html += '<div id="kym-del-load-status" style="font-size:13px;color:#64748b;margin-bottom:12px;padding:12px 16px;background:#f8fafc;border-radius:8px;min-height:40px;display:flex;align-items:center">Cargando usuarios activos...</div>';

    html += '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:14px;color:#9a3412;font-size:13px;line-height:1.5">';
    html += '<strong>Atención:</strong> esta acción borra usuarios activos de la empresa seleccionada. Sube un Excel, CSV o TXT con una columna <strong>email</strong>, o un TXT con un email por línea.';
    html += '</div>';

    html += '<div style="border:2px dashed #fed7aa;border-radius:8px;padding:22px;text-align:center;position:relative;margin-bottom:10px">';
    html += '<input id="kym-del-file" type="file" accept=".xlsx,.xls,.csv,.txt" style="position:absolute;inset:0;opacity:0;cursor:pointer" />';
    html += '<div style="font-size:28px;margin-bottom:6px">&#128465;</div>';
    html += '<div style="color:#64748b;font-size:13px"><b style="color:#c2410c">Arrastra el archivo</b> o haz clic<br>';
    html += '<span style="font-size:12px">Columna: <b>email</b> o una línea por email en TXT</span></div>';
    html += '</div>';
    html += '<div id="kym-del-file-info" style="font-size:12px;color:#64748b;margin-bottom:12px;min-height:16px"></div>';

    html += '<div id="kym-del-summary" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:12px"></div>';

    html += '<div id="kym-del-progress" style="display:none;margin-bottom:12px">';
    html += '<div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;margin-bottom:6px">';
    html += '<div id="kym-del-bar" style="background:#c2410c;height:100%;width:0%;transition:width .3s;border-radius:99px"></div></div>';
    html += '<div style="display:flex;gap:12px;font-size:12px;color:#64748b;flex-wrap:wrap">';
    html += '<span>Total: <b id="kym-del-done">0</b>/<b id="kym-del-total">0</b></span>';
    html += '<span style="color:#38a169;font-weight:600">&#10003; <span id="kym-del-ok">0</span></span>';
    html += '<span style="color:#d97706;font-weight:600">&#8635; <span id="kym-del-skip">0</span></span>';
    html += '<span style="color:#e53e3e;font-weight:600">&#10007; <span id="kym-del-err">0</span></span>';
    html += '</div></div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:10px">';
    html += '<button id="kym-del-btn-run" style="flex:1;background:#c2410c;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:default;font-size:13px;opacity:.45">&#128465; Iniciar borrado</button>';
    html += '<button id="kym-del-btn-pause" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#9646;&#9646; Pausar</button>';
    html += '<button id="kym-del-btn-export" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#8595; Exportar</button>';
    html += '</div>';

    html += '<div id="kym-del-log" style="display:none;background:#0f172a;border-radius:8px;padding:10px 12px;max-height:220px;overflow-y:auto;font-family:Menlo,Consolas,monospace;font-size:11px;color:#94a3b8"></div>';

    html += '<div id="kym-del-btn-refresh-end" style="display:none;margin-top:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;text-align:center">';
    html += '<div style="font-size:12px;color:#166534;margin-bottom:8px">&#10003; Proceso completado. Para ver los cambios pulsa aquí.</div>';
    html += '<button id="kym-del-refresh-action" style="background:#c2410c;color:white;border:none;padding:8px 18px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#8635; Cerrar y refrescar</button>';
    html += '</div>';

    container.innerHTML = html;

    $('kym-del-refresh-action').onclick = function () {
      window.location.reload();
    };

    $('kym-del-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;

      var ext = file.name.split('.').pop().toLowerCase();
      var reader = new FileReader();

      if (ext === 'txt' || ext === 'csv') {
        reader.onload = function (ev) {
          parseTextFile(ev.target.result, file.name);
        };
        reader.readAsText(file);
      } else {
        reader.onload = function (ev) {
          try {
            parseExcelFile(ev.target.result, file.name);
          } catch (err) {
            setInlineStatus('kym-del-file-info', '<span style="color:#e53e3e">Error leyendo Excel: ' + escHtml(err.message) + '</span>');
          }
        };
        reader.readAsBinaryString(file);
      }
    });

    $('kym-del-btn-pause').onclick = function () {
      isPaused = !isPaused;
      this.innerHTML = isPaused ? '&#9654; Reanudar' : '&#9646;&#9646; Pausar';
    };

    $('kym-del-btn-export').onclick = function () {
      if (!results.length) return;
      var ws = XLSX.utils.json_to_sheet(results);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
      XLSX.writeFile(wb, 'borrado_masivo_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    };

    $('kym-del-btn-run').onclick = async function () {
      if (!bulkRows.length) {
        addLog('Sube un archivo primero.', 'err');
        return;
      }

      if (!dataLoaded) {
        addLog('Datos no cargados, cargando ahora...', 'warn');
        await loadData();
        if (!dataLoaded) {
          addLog('No se pudieron cargar los usuarios. Verifica empresa y token.', 'err');
          return;
        }
      }

      recomputeSummary();
      if (!summary.found) {
        addLog('No hay usuarios encontrados para borrar.', 'err');
        return;
      }

      var typed = window.prompt(
        'Se van a borrar ' + summary.found + ' usuarios activos de la empresa ' + (tools.state.companyName || '') + '.\n\n' +
        'No encontrados: ' + summary.missing + '. Duplicados ignorados: ' + (summary.duplicates || 0) + '.\n\n' +
        'Escribe BORRAR para continuar.'
      );

      if (typed !== 'BORRAR') {
        addLog('Operación cancelada.', 'warn');
        return;
      }

      addLog('Iniciando borrado de ' + summary.found + ' usuarios...', 'info');
      results = [];
      isPaused = false;
      var okC = 0;
      var skipC = 0;
      var errC = 0;
      var BATCH = 6;

      this.style.opacity = '.45';
      $('kym-del-btn-pause').style.display = 'inline-block';
      $('kym-del-btn-export').style.display = 'none';
      $('kym-del-btn-refresh-end').style.display = 'none';
      $('kym-del-progress').style.display = 'block';
      $('kym-del-total').textContent = bulkRows.length;
      ['kym-del-done', 'kym-del-ok', 'kym-del-skip', 'kym-del-err'].forEach(function (id) {
        $(id).textContent = '0';
      });
      $('kym-del-bar').style.width = '0%';

      for (var b = 0; b < bulkRows.length; b += BATCH) {
        while (isPaused) await sleep(500);

        var batch = bulkRows.slice(b, b + BATCH);
        var bRes = await Promise.all(batch.map(function (row, j) {
          return deleteOne(row).then(function (r) {
            var email = normalizeEmail(row.email);
            var lbl = '[' + (b + j + 1) + '/' + bulkRows.length + '] ';
            var type = r.ok ? 'ok' : (r.skipped ? 'warn' : 'err');
            addLog(lbl + (r.ok ? 'OK' : (r.skipped ? 'SKIP' : 'ERR')) + ' ' + email + ' — ' + r.msg, type);
            return Object.assign({}, row, {
              stakeholderId: r.stakeholderId || '',
              _status: r.ok ? 'BORRADO' : (r.skipped ? 'OMITIDO' : 'ERROR'),
              _message: r.msg
            });
          });
        }));

        bRes.forEach(function (r) {
          results.push(r);
          if (r._status === 'BORRADO') okC += 1;
          else if (r._status === 'OMITIDO') skipC += 1;
          else errC += 1;
        });

        $('kym-del-ok').textContent = okC;
        $('kym-del-skip').textContent = skipC;
        $('kym-del-err').textContent = errC;
        $('kym-del-done').textContent = Math.min(b + BATCH, bulkRows.length);
        $('kym-del-bar').style.width = Math.round((Math.min(b + BATCH, bulkRows.length) / bulkRows.length) * 100) + '%';

        if (b + BATCH < bulkRows.length) await sleep(200);
      }

      addLog('Completado: ' + okC + ' borrados, ' + skipC + ' omitidos, ' + errC + ' errores.', 'info');
      $('kym-del-btn-pause').style.display = 'none';
      $('kym-del-btn-run').style.opacity = '1';
      $('kym-del-btn-export').style.display = 'inline-block';
      $('kym-del-btn-refresh-end').style.display = 'block';
      recomputeSummary();
      updateRunBtn();
    };

    loadData();
  }

  KAT.registerModule({
    key: 'bulk_delete_users',
    label: 'Borrado masivo',
    icon: '&#128465;',
    order: 140,
    group: 'bulk',
    forceGuiOnly: true,
    renderGui: renderGui
  });
})();
