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
    var companyName = tools.state.companyName || '';

    var userMap = {}; // email.toLowerCase() -> { stakeholderId, name, surname, login }
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
        return { id: companyId, name: companyName };
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
      var el = $('kym-em-log');
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
      var btn = $('kym-em-btn-run');
      if (!btn) return;

      var ok = dataLoaded && bulkRows.length > 0;
      btn.style.opacity = ok ? '1' : '.45';
      btn.style.cursor = ok ? 'pointer' : 'default';
    }

    async function loadData() {
      var status = $('kym-em-load-status');
      if (status) status.innerHTML = '&#8987; Cargando usuarios...';

      dataLoaded = false;
      userMap = {};
      updateRunBtn();

      if (!companyId) {
        setInlineStatus('kym-em-load-status', '<span style="color:#d97706">&#9888; Selecciona una empresa en la cabecera y pulsa “Actualizar empresa y datos”</span>');
        return;
      }

      if (!token) {
        setInlineStatus('kym-em-load-status', '<span style="color:#e53e3e">&#10007; No se ha encontrado token. Asegúrate de estar logado en Kymatio.</span>');
        return;
      }

      try {
        var res = await fetch(
          'https://api-dev.kymatio.xyz/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId) + '/people?login=true&email=true',
          { headers: apiHeaders() }
        );
        var data = await res.json();

        if (!res.ok) {
          throw new Error((data && (data.message || (data.records && data.records.devMessage))) || 'Error HTTP ' + res.status);
        }

        (data.records || []).forEach(function (u) {
          if (u.email) userMap[String(u.email).toLowerCase()] = u;
        });

        dataLoaded = true;
        setInlineStatus('kym-em-load-status', '<span style="color:#38a169">&#10003; ' + Object.keys(userMap).length + ' usuarios cargados</span>');
        updateRunBtn();
      } catch (e) {
        setInlineStatus('kym-em-load-status', '<span style="color:#e53e3e">&#10007; Error al cargar: ' + escHtml(e.message) + '</span>');
      }
    }

    function parseRows(data, emailCol, newEmailCol, loginCol, fileName) {
      bulkRows = data
        .map(function (r) {
          return {
            old_email: String(r[emailCol] || '').trim(),
            new_email: String(r[newEmailCol] || '').trim(),
            new_login: loginCol ? String(r[loginCol] || '').trim() : ''
          };
        })
        .filter(function (r) {
          return r.old_email && (r.new_email || r.new_login);
        });

      var info = bulkRows.length + ' filas: ' + fileName;
      var withLogin = bulkRows.filter(function (r) { return r.new_login; }).length;
      if (withLogin) info += ' (' + withLogin + ' con nuevo login)';

      var infoEl = $('kym-em-file-info');
      if (infoEl) infoEl.textContent = info;
      updateRunBtn();
    }

    async function updateOne(oldEmail, newEmail, newLogin) {
      var user = userMap[String(oldEmail).toLowerCase()];
      if (!user) return { ok: false, msg: 'Usuario no encontrado: "' + oldEmail + '"' };

      if (!newEmail && !newLogin) return { ok: false, msg: 'Se requiere al menos un nuevo email o nuevo login' };

      var payload = {};
      if (newEmail) payload.email = newEmail;
      if (newLogin && newLogin.trim()) payload.login = newLogin.trim();

      var res = await fetch('https://api-dev.kymatio.xyz/v2/admin/stakeholders/people/' + encodeURIComponent(user.stakeholderId), {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify(payload)
      });

      var rdata = null;
      try {
        rdata = await res.json();
      } catch (e) {}

      if (res.ok || res.status === 200 || res.status === 201) {
        var changed = newEmail ? 'email -> ' + newEmail : 'email sin cambios';
        if (newLogin) changed += ' | login -> ' + newLogin;
        return { ok: true, msg: changed };
      }

      var msg =
        (rdata && rdata.records && rdata.records.devMessage) ||
        (rdata && rdata.message) ||
        'Error ' + res.status;

      if (res.status === 412) msg = 'Error 412 - El nuevo email o login ya existe en la plataforma';
      return { ok: false, msg: String(msg) };
    }

    var html = '';
    html += '<div id="kym-em-load-status" style="font-size:12px;color:#64748b;margin-bottom:12px;padding:8px 12px;background:#f8fafc;border-radius:6px;min-height:34px;display:flex;align-items:center">Cargando usuarios...</div>';


    html += '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#92400e;font-size:12px;line-height:1.5">';
    html += 'Sube un Excel, CSV o TXT con columnas <strong>old_email</strong>, <strong>new_email</strong> y opcionalmente <strong>new_login</strong>. También se aceptan variantes como <strong>email_antiguo</strong>, <strong>email_nuevo</strong> o <strong>login_nuevo</strong>.';
    html += '</div>';

    html += '<div style="border:2px dashed #fde68a;border-radius:8px;padding:20px;text-align:center;position:relative;margin-bottom:8px">';
    html += '<input id="kym-em-file" type="file" accept=".xlsx,.xls,.csv,.txt" style="position:absolute;inset:0;opacity:0;cursor:pointer" />';
    html += '<div style="font-size:26px;margin-bottom:6px">&#128202;</div>';
    html += '<div style="color:#64748b;font-size:12px"><b style="color:#b45309">Arrastra el archivo</b> o haz clic<br>';
    html += '<span style="font-size:11px">Columnas: <b>old_email</b> (obligatorio) &nbsp; <b>new_email</b> (obligatorio) &nbsp; <b>new_login</b> (opcional)</span></div>';
    html += '</div>';
    html += '<div id="kym-em-file-info" style="font-size:12px;color:#64748b;margin-bottom:12px;min-height:16px"></div>';

    html += '<div id="kym-em-progress" style="display:none;margin-bottom:12px">';
    html += '<div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;margin-bottom:6px">';
    html += '<div id="kym-em-bar" style="background:#b45309;height:100%;width:0%;transition:width .3s;border-radius:99px"></div></div>';
    html += '<div style="display:flex;gap:12px;font-size:12px;color:#64748b;flex-wrap:wrap">';
    html += '<span>Total: <b id="kym-em-done">0</b>/<b id="kym-em-total">0</b></span>';
    html += '<span style="color:#38a169;font-weight:600">&#10003; <span id="kym-em-ok">0</span></span>';
    html += '<span style="color:#e53e3e;font-weight:600">&#10007; <span id="kym-em-err">0</span></span>';
    html += '</div></div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:10px">';
    html += '<button id="kym-em-btn-run" style="flex:1;background:#b45309;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:default;font-size:13px;opacity:.45">&#9993; Iniciar modificación</button>';
    html += '<button id="kym-em-btn-pause" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#9646;&#9646; Pausar</button>';
    html += '<button id="kym-em-btn-export" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#8595; Exportar</button>';
    html += '</div>';

    html += '<div id="kym-em-log" style="display:none;background:#0f172a;border-radius:8px;padding:10px 12px;max-height:200px;overflow-y:auto;font-family:Menlo,Consolas,monospace;font-size:11px;color:#94a3b8"></div>';

    html += '<div id="kym-em-refresh-end" style="display:none;margin-top:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;text-align:center">';
    html += '<div style="font-size:12px;color:#166534;margin-bottom:8px">&#10003; Proceso completado. Para ver los cambios realizados, refresca la pantalla.</div>';
    html += '<button id="kym-em-refresh-action" style="background:#b45309;color:white;border:none;padding:8px 18px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#8635; Refrescar pantalla</button>';
    html += '</div>';

    container.innerHTML = html;

    $('kym-em-refresh-action').onclick = function () {
      window.location.reload();
    };

    $('kym-em-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;

      var ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'txt' || ext === 'csv') {
        var textReader = new FileReader();
        textReader.onload = function (ev) {
          var lines = ev.target.result
            .split(/\r?\n/)
            .map(function (line) { return line.trim(); })
            .filter(Boolean);

          var hasHeader = lines[0] && (lines[0].toLowerCase().indexOf('email') >= 0 || lines[0].toLowerCase().indexOf('old') >= 0);
          var rows = lines
            .slice(hasHeader ? 1 : 0)
            .map(function (line) {
              var p = line.split(/[,;\t]/);
              return {
                old_email: (p[0] || '').trim(),
                new_email: (p[1] || '').trim(),
                new_login: (p[2] || '').trim()
              };
            })
            .filter(function (r) {
              return r.old_email && (r.new_email || r.new_login);
            });

          bulkRows = rows;
          var info = bulkRows.length + ' filas: ' + file.name;
          var withLogin = bulkRows.filter(function (r) { return r.new_login; }).length;
          if (withLogin) info += ' (' + withLogin + ' con nuevo login)';
          $('kym-em-file-info').textContent = info;
          updateRunBtn();
        };
        textReader.readAsText(file);
        return;
      }

      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var wb = window.XLSX.read(ev.target.result, { type: 'binary' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var data = window.XLSX.utils.sheet_to_json(ws, { defval: '' });

          if (!data.length) {
            $('kym-em-file-info').textContent = 'El archivo está vacío';
            return;
          }

          var emailCol = null;
          var newEmailCol = null;
          var loginCol = null;

          Object.keys(data[0]).forEach(function (k) {
            var kl = String(k).toLowerCase();
            if (!emailCol && (kl === 'old_email' || kl === 'email_antiguo' || kl === 'email anterior' || kl === 'old email')) emailCol = k;
            if (!newEmailCol && (kl === 'new_email' || kl === 'email_nuevo' || kl === 'email nuevo' || kl === 'new email')) newEmailCol = k;
            if (!loginCol && (kl === 'new_login' || kl === 'login_nuevo' || kl === 'login nuevo' || kl === 'new login')) loginCol = k;
          });

          var keys = Object.keys(data[0]);
          if (!emailCol && keys[0]) emailCol = keys[0];
          if (!newEmailCol && keys[1]) newEmailCol = keys[1];
          if (!loginCol && keys[2]) loginCol = keys[2];

          if (!emailCol || !newEmailCol) {
            $('kym-em-file-info').textContent = 'Error: se necesitan al menos 2 columnas (old_email, new_email)';
            return;
          }

          parseRows(data, emailCol, newEmailCol, loginCol, file.name);
        } catch (err) {
          $('kym-em-file-info').textContent = 'Error leyendo archivo: ' + err.message;
        }
      };
      reader.readAsBinaryString(file);
    });

    $('kym-em-btn-pause').onclick = function () {
      isPaused = !isPaused;
      this.innerHTML = isPaused ? '&#9654; Reanudar' : '&#9646;&#9646; Pausar';
    };

    $('kym-em-btn-export').onclick = function () {
      if (!results.length) return;
      var ws = window.XLSX.utils.json_to_sheet(results);
      var wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
      window.XLSX.writeFile(wb, 'modificacion_email_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    };

    $('kym-em-btn-run').onclick = async function () {
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

      addLog('Iniciando modificación de ' + bulkRows.length + ' usuarios...', 'info');
      results = [];
      isPaused = false;

      var okC = 0;
      var errC = 0;
      var batchSize = 5;

      this.style.opacity = '.45';
      $('kym-em-btn-pause').style.display = 'inline-block';
      $('kym-em-btn-export').style.display = 'none';
      $('kym-em-refresh-end').style.display = 'none';
      $('kym-em-progress').style.display = 'block';
      $('kym-em-total').textContent = bulkRows.length;
      ['kym-em-done', 'kym-em-ok', 'kym-em-err'].forEach(function (id) {
        $(id).textContent = '0';
      });
      $('kym-em-bar').style.width = '0%';

      for (var b = 0; b < bulkRows.length; b += batchSize) {
        while (isPaused) await sleep(500);

        var batch = bulkRows.slice(b, b + batchSize);
        var batchResults = await Promise.all(
          batch.map(function (row, j) {
            return updateOne(row.old_email, row.new_email, row.new_login).then(function (r) {
              var label = '[' + (b + j + 1) + '/' + bulkRows.length + '] ';
              addLog(label + (r.ok ? 'OK' : 'ERR') + ' ' + row.old_email + ' - ' + r.msg, r.ok ? 'ok' : 'err');
              return Object.assign({}, row, {
                _status: r.ok ? 'OK' : 'ERROR',
                _message: r.msg
              });
            });
          })
        );

        batchResults.forEach(function (r) {
          results.push(r);
          if (r._status === 'OK') okC++;
          else errC++;
        });

        $('kym-em-ok').textContent = okC;
        $('kym-em-err').textContent = errC;
        $('kym-em-done').textContent = Math.min(b + batchSize, bulkRows.length);
        $('kym-em-bar').style.width = Math.round((Math.min(b + batchSize, bulkRows.length) / bulkRows.length) * 100) + '%';

        if (b + batchSize < bulkRows.length) await sleep(200);
      }

      addLog('Completado: ' + okC + ' modificados, ' + errC + ' errores.', 'info');
      $('kym-em-btn-pause').style.display = 'none';
      $('kym-em-btn-run').style.opacity = '1';
      $('kym-em-btn-export').style.display = 'inline-block';
      $('kym-em-refresh-end').style.display = 'block';
    };

    if (companyId) loadData();
    else setInlineStatus('kym-em-load-status', '<span style="color:#d97706">&#9888; Selecciona una empresa en la cabecera y pulsa “Actualizar empresa y datos”</span>');
  }

  KAT.registerModule({
    key: 'bulk_email_login',
    label: 'Modificar email / login',
    icon: '&#9993;',
    order: 110,
    group: 'bulk',
    forceGuiOnly: true,
    renderGui: renderGui
  });
})();
