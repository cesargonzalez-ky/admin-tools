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

    var userMap = {};  // email.toLowerCase() -> user object
    var deptMap = {};  // departmentName.toLowerCase() -> stakeholderId
    var dataLoaded = false;
    var isPaused = false;
    var results = [];
    var bulkRows = [];

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

    function addLog(msg, type) {
      var el = $('kym-mv-log');
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
      var btn = $('kym-mv-btn-run');
      if (!btn) return;

      var ok = dataLoaded && bulkRows.length > 0;
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

      var status = $('kym-mv-load-status');
      if (status) status.innerHTML = '&#8987; Cargando usuarios y departamentos...';

      dataLoaded = false;
      userMap = {};
      deptMap = {};
      updateRunBtn();

      if (!companyId) {
        setInlineStatus('kym-mv-load-status', '<span style="color:#d97706">&#9888; Selecciona una empresa y pulsa Actualizar empresa y datos.</span>');
        return;
      }

      if (!token) {
        setInlineStatus('kym-mv-load-status', '<span style="color:#e53e3e">&#10007; No se ha encontrado token. Asegúrate de estar logado en Kymatio.</span>');
        return;
      }

      try {
        var r1 = await fetch(
          'https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId) + '/people?login=true&email=true',
          { headers: apiHeaders() }
        );
        var d1 = await r1.json();
        if (!r1.ok) {
          throw new Error((d1 && (d1.message || (d1.records && d1.records.devMessage))) || 'Error cargando usuarios: HTTP ' + r1.status);
        }

        (d1.records || []).forEach(function (u) {
          if (u.email) userMap[String(u.email).toLowerCase()] = u;
        });

        var r2 = await fetch(
          'https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId) + '/departments',
          { headers: apiHeaders() }
        );
        var d2 = await r2.json();
        if (!r2.ok) {
          throw new Error((d2 && (d2.message || (d2.records && d2.records.devMessage))) || 'Error cargando departamentos: HTTP ' + r2.status);
        }

        (d2.records || []).forEach(function (d) {
          if (d.name) deptMap[String(d.name).trim().toLowerCase()] = d.stakeholderId;
        });

        dataLoaded = true;
        setInlineStatus(
          'kym-mv-load-status',
          '<span style="color:#16a34a">&#10003; ' + Object.keys(userMap).length + ' usuarios &nbsp;|&nbsp; ' + Object.keys(deptMap).length + ' departamentos cargados</span>'
        );
        updateRunBtn();
      } catch (e) {
        setInlineStatus('kym-mv-load-status', '<span style="color:#e53e3e">&#10007; Error al cargar: ' + escHtml(e.message) + '</span>');
      }
    }

    function parseTextFile(text, fileName) {
      var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) {
        bulkRows = [];
        setInlineStatus('kym-mv-file-info', 'El archivo está vacío.');
        updateRunBtn();
        return;
      }

      var hasHeader = lines[0] && lines[0].toLowerCase().indexOf('email') >= 0;
      bulkRows = lines.slice(hasHeader ? 1 : 0).map(function (line) {
        var p = line.split(/[,;\t]/);
        return {
          email: String(p[0] || '').trim(),
          department: String(p[1] || '').trim()
        };
      }).filter(function (r) {
        return r.email;
      });

      setInlineStatus('kym-mv-file-info', escHtml(bulkRows.length + ' filas: ' + fileName));
      updateRunBtn();
    }

    function parseExcelFile(binary, fileName) {
      var wb = XLSX.read(binary, { type: 'binary' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      var emailCol = null;
      var deptCol = null;

      if (data.length) {
        Object.keys(data[0]).forEach(function (k) {
          var kl = String(k).toLowerCase();
          if (!emailCol && (kl === 'email' || kl.indexOf('email') >= 0 || kl.indexOf('correo') >= 0)) emailCol = k;
          if (!deptCol && (kl === 'department' || kl.indexOf('depart') >= 0)) deptCol = k;
        });
      }

      if (!emailCol) {
        setInlineStatus('kym-mv-file-info', '<span style="color:#e53e3e">Error: no se encontró columna email.</span>');
        return;
      }

      if (!deptCol) {
        setInlineStatus('kym-mv-file-info', '<span style="color:#e53e3e">Error: no se encontró columna Department.</span>');
        return;
      }

      bulkRows = data.map(function (r) {
        return {
          email: String(r[emailCol] || '').trim(),
          department: String(r[deptCol] || '').trim()
        };
      }).filter(function (r) {
        return r.email;
      });

      setInlineStatus('kym-mv-file-info', escHtml(bulkRows.length + ' filas: ' + fileName));
      updateRunBtn();
    }

    async function moveOne(email, deptName) {
      var user = userMap[String(email || '').toLowerCase()];
      if (!user) return { ok: false, msg: 'Usuario no encontrado en la empresa' };

      var normalizedDept = String(deptName || '').trim().toLowerCase();
      if (!normalizedDept) return { ok: false, msg: 'Departamento vacío' };

      var deptId = deptMap[normalizedDept];
      if (!deptId) return { ok: false, msg: 'Departamento no encontrado: "' + deptName + '"' };

      var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/people/' + encodeURIComponent(user.stakeholderId), {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({
          stakeholderCompanyId: companyId,
          stakeholderDepartmentId: deptId,
          stakeholdersId: [user.stakeholderId]
        })
      });

      var rdata = null;
      try {
        rdata = await res.json();
      } catch (e) {}

      if (res.ok || res.status === 200 || res.status === 201) {
        return { ok: true, msg: 'Movido a "' + deptName + '"' };
      }

      var msg =
        (rdata && rdata.records && rdata.records.devMessage) ||
        (rdata && rdata.message) ||
        ('Error ' + res.status);
      return { ok: false, msg: String(msg) };
    }

    var html = '';
    html += '<div id="kym-mv-load-status" style="font-size:13px;color:#64748b;margin-bottom:12px;padding:12px 16px;background:#f8fafc;border-radius:8px;min-height:40px;display:flex;align-items:center">Cargando usuarios y departamentos...</div>';

    html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:14px;color:#1e40af;font-size:13px;line-height:1.5">';
    html += 'Sube un Excel, CSV o TXT con columnas <strong>email</strong> y <strong>Department</strong>. También se aceptan variantes de cabecera que contengan <strong>email</strong> o <strong>depart</strong>.';
    html += '</div>';

    html += '<div style="border:2px dashed #bfdbfe;border-radius:8px;padding:22px;text-align:center;position:relative;margin-bottom:10px">';
    html += '<input id="kym-mv-file" type="file" accept=".xlsx,.xls,.csv,.txt" style="position:absolute;inset:0;opacity:0;cursor:pointer" />';
    html += '<div style="font-size:28px;margin-bottom:6px">&#128202;</div>';
    html += '<div style="color:#64748b;font-size:13px"><b style="color:#0369a1">Arrastra el archivo</b> o haz clic<br>';
    html += '<span style="font-size:12px">Columnas: <b>email</b> obligatorio &nbsp; <b>Department</b> obligatorio</span></div>';
    html += '</div>';
    html += '<div id="kym-mv-file-info" style="font-size:12px;color:#64748b;margin-bottom:12px;min-height:16px"></div>';

    html += '<div id="kym-mv-progress" style="display:none;margin-bottom:12px">';
    html += '<div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;margin-bottom:6px">';
    html += '<div id="kym-mv-bar" style="background:#0369a1;height:100%;width:0%;transition:width .3s;border-radius:99px"></div></div>';
    html += '<div style="display:flex;gap:12px;font-size:12px;color:#64748b;flex-wrap:wrap">';
    html += '<span>Total: <b id="kym-mv-done">0</b>/<b id="kym-mv-total">0</b></span>';
    html += '<span style="color:#38a169;font-weight:600">&#10003; <span id="kym-mv-ok">0</span></span>';
    html += '<span style="color:#e53e3e;font-weight:600">&#10007; <span id="kym-mv-err">0</span></span>';
    html += '</div></div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:10px">';
    html += '<button id="kym-mv-btn-run" style="flex:1;background:#0369a1;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:default;font-size:13px;opacity:.45">&#128259; Iniciar movimiento</button>';
    html += '<button id="kym-mv-btn-pause" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#9646;&#9646; Pausar</button>';
    html += '<button id="kym-mv-btn-export" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#8595; Exportar</button>';
    html += '</div>';

    html += '<div id="kym-mv-log" style="display:none;background:#0f172a;border-radius:8px;padding:10px 12px;max-height:220px;overflow-y:auto;font-family:Menlo,Consolas,monospace;font-size:11px;color:#94a3b8"></div>';

    html += '<div id="kym-mv-btn-refresh-end" style="display:none;margin-top:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;text-align:center">';
    html += '<div style="font-size:12px;color:#166534;margin-bottom:8px">&#10003; Proceso completado. Para ver los cambios pulsa aquí.</div>';
    html += '<button id="kym-mv-refresh-action" style="background:#0369a1;color:white;border:none;padding:8px 18px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#8635; Cerrar y refrescar</button>';
    html += '</div>';

    container.innerHTML = html;

    $('kym-mv-refresh-action').onclick = function () {
      window.location.reload();
    };

    $('kym-mv-file').addEventListener('change', function (e) {
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
            setInlineStatus('kym-mv-file-info', '<span style="color:#e53e3e">Error leyendo Excel: ' + escHtml(err.message) + '</span>');
          }
        };
        reader.readAsBinaryString(file);
      }
    });

    $('kym-mv-btn-pause').onclick = function () {
      isPaused = !isPaused;
      this.innerHTML = isPaused ? '&#9654; Reanudar' : '&#9646;&#9646; Pausar';
    };

    $('kym-mv-btn-export').onclick = function () {
      if (!results.length) return;
      var ws = XLSX.utils.json_to_sheet(results);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
      XLSX.writeFile(wb, 'movimiento_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    };

    $('kym-mv-btn-run').onclick = async function () {
      if (!bulkRows.length) {
        addLog('Sube un archivo primero.', 'err');
        return;
      }

      if (!dataLoaded) {
        addLog('Datos no cargados, cargando ahora...', 'warn');
        await loadData();
        if (!dataLoaded) {
          addLog('No se pudieron cargar los datos. Verifica empresa y token.', 'err');
          return;
        }
      }

      addLog('Iniciando movimiento de ' + bulkRows.length + ' usuarios...', 'info');
      results = [];
      isPaused = false;
      var okC = 0;
      var errC = 0;
      var BATCH = 5;

      this.style.opacity = '.45';
      $('kym-mv-btn-pause').style.display = 'inline-block';
      $('kym-mv-btn-export').style.display = 'none';
      $('kym-mv-btn-refresh-end').style.display = 'none';
      $('kym-mv-progress').style.display = 'block';
      $('kym-mv-total').textContent = bulkRows.length;
      ['kym-mv-done', 'kym-mv-ok', 'kym-mv-err'].forEach(function (id) {
        $(id).textContent = '0';
      });
      $('kym-mv-bar').style.width = '0%';

      for (var b = 0; b < bulkRows.length; b += BATCH) {
        while (isPaused) await sleep(500);

        var batch = bulkRows.slice(b, b + BATCH);
        var bRes = await Promise.all(batch.map(function (row, j) {
          return moveOne(row.email, row.department).then(function (r) {
            var lbl = '[' + (b + j + 1) + '/' + bulkRows.length + '] ';
            addLog(lbl + (r.ok ? 'OK' : 'ERR') + ' ' + row.email + ' — ' + r.msg, r.ok ? 'ok' : 'err');
            return Object.assign({}, row, {
              _status: r.ok ? 'OK' : 'ERROR',
              _message: r.msg
            });
          });
        }));

        bRes.forEach(function (r) {
          results.push(r);
          if (r._status === 'OK') okC += 1;
          else errC += 1;
        });

        $('kym-mv-ok').textContent = okC;
        $('kym-mv-err').textContent = errC;
        $('kym-mv-done').textContent = Math.min(b + BATCH, bulkRows.length);
        $('kym-mv-bar').style.width = Math.round((Math.min(b + BATCH, bulkRows.length) / bulkRows.length) * 100) + '%';

        if (b + BATCH < bulkRows.length) await sleep(200);
      }

      addLog('Completado: ' + okC + ' movidos, ' + errC + ' errores.', 'info');
      $('kym-mv-btn-pause').style.display = 'none';
      $('kym-mv-btn-run').style.opacity = '1';
      $('kym-mv-btn-export').style.display = 'inline-block';
      $('kym-mv-btn-refresh-end').style.display = 'block';
    };

    loadData();
  }

  KAT.registerModule({
    key: 'bulk_move_users',
    label: 'Movimiento masivo',
    icon: '&#128259;',
    order: 120,
    group: 'bulk',
    forceGuiOnly: true,
    renderGui: renderGui
  });
})();
