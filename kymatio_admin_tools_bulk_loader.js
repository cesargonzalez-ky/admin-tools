(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  var COL = {
    name: 'Name',
    surname: 'Surname',
    email: 'User email',
    login: 'Login',
    phone: 'User Phone',
    department: 'Department',
    timezone: 'Time Zone',
    locale: 'Locale',
    isManager: 'isManager',
    profileAdmin: 'Perfil - Administrador',
    profileOperator: 'Perfil - Operador',
    profileUser: 'Perfil - Usuario',
    position: 'Position',
    authentication: 'Authentication'
  };

  var REQUIRED_COLS = ['Name', 'Surname', 'User email', 'Department'];

  var AUTH_MAP = {
    NO_AUTH: 'noauth',
    NOAUTH: 'noauth',
    NOLOGIN: 'noauth',
    PASSWORD: 'password',
    CONTRASENA: 'password',
    SSO: 'federation',
    SAML: 'federation',
    FEDERATION: 'federation',
    FEDERACION: 'federation',
    '2FA': 'totp_password',
    TOTP: 'totp_password',
    TOTP_PASSWORD: 'totp_password'
  };

  function loadXlsx() {
    return new Promise(function (resolve, reject) {
      if (window.XLSX) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = XLSX_URL;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('No se pudo cargar la librería XLSX.')); };
      document.head.appendChild(s);
    });
  }

  function renderGui(container, tools) {
    var $ = tools.$;
    var escHtml = tools.escHtml;
    var setStatus = tools.setStatus;

    var rows = [];
    var results = [];
    var deptMap = {};
    var emailMap = null;
    var isPaused = false;
    var defaults = {
      locale: 'es-es',
      timezone: 'Europe/Madrid',
      notifications: 'NO'
    };

    function apiHeaders() {
      return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + tools.state.token
      };
    }

    function sleep(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function addLog(msg, type) {
      var el = $('kym-bulk-log');
      if (!el) return;
      el.style.display = 'block';
      var colors = {
        ok: '#34d399',
        err: '#f87171',
        info: '#60a5fa',
        warn: '#fbbf24',
        upd: '#93c5fd'
      };
      var line = document.createElement('div');
      line.style.color = colors[type] || '#94a3b8';
      line.textContent = '[' + new Date().toLocaleTimeString('es-ES') + '] ' + msg;
      el.appendChild(line);
      el.scrollTop = el.scrollHeight;
    }

    function getDefTZ() {
      return defaults.timezone || 'Europe/Madrid';
    }

    function getDefLocale() {
      return defaults.locale || 'es-es';
    }

    function getDefNotif() {
      return defaults.notifications || 'NO';
    }

    function updateRunBtn() {
      var btn = $('kym-bulk-btn-run');
      if (!btn) return;
      var dateEl = $('kym-bulk-welcome-date');
      var ok = !!(tools.state.token && tools.state.companyId && rows.length && dateEl && dateEl.value);
      btn.disabled = !ok;
      btn.style.opacity = ok ? '1' : '.45';
      btn.style.cursor = ok ? 'pointer' : 'not-allowed';
    }

    function resetCounters() {
      $('kym-bulk-total').textContent = '0';
      $('kym-bulk-done').textContent = '0';
      $('kym-bulk-ok').textContent = '0';
      $('kym-bulk-upd').textContent = '0';
      $('kym-bulk-err').textContent = '0';
      $('kym-bulk-bar').style.width = '0%';
    }

    function findSheet(wb) {
      var preferred = wb.SheetNames.filter(function (n) {
        return String(n || '').trim() === '2.-Empleados (internal)';
      })[0];
      return preferred || wb.SheetNames[0];
    }

    function findMissingColumns(items) {
      if (!items.length) return REQUIRED_COLS.slice();
      return REQUIRED_COLS.filter(function (c) { return !(c in items[0]); });
    }

    function readFile(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
        reader.onload = function (ev) {
          try {
            var wb = XLSX.read(ev.target.result, { type: 'binary' });
            var sheetName = findSheet(wb);
            var ws = wb.Sheets[sheetName];
            var parsed = XLSX.utils.sheet_to_json(ws, { defval: '' });
            resolve({ rows: parsed, sheetName: sheetName });
          } catch (e) {
            reject(e);
          }
        };
        reader.readAsBinaryString(file);
      });
    }

    async function loadCompanyDefaults() {
      var status = $('kym-bulk-load-status');
      setStatus(status, '&#8987; Cargando configuración de empresa...', 'info');

      try {
        var data = await tools.loadCompanyData(true);
        var env = data.environment || {};
        defaults.locale = (env.languages && env.languages.default) || defaults.locale;
        defaults.timezone = env.timezone || defaults.timezone;
        defaults.notifications = (env.notifications && env.notifications.sendemail) || defaults.notifications;

        $('kym-bulk-defaults').textContent =
          'TZ: ' + getDefTZ() + ' | Locale: ' + getDefLocale() + ' | Notif: ' + getDefNotif();

        setStatus(status, '&#10003; Configuración cargada', 'ok');
      } catch (e) {
        setStatus(status, '&#10007; Error cargando empresa: ' + escHtml(e.message), 'err');
      }

      updateRunBtn();
    }

    async function resolveDepts() {
      addLog('Cargando departamentos...', 'info');
      deptMap = {};
      var res = await fetch(
        'https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(tools.state.companyId) + '/departments',
        { headers: apiHeaders() }
      );

      var data = await res.json();
      if (!res.ok) {
        var msg = data && (data.message || (data.records && data.records.devMessage)) || res.status;
        addLog('Error cargando departamentos: ' + msg, 'err');
        return false;
      }

      (data.records || []).forEach(function (d) {
        if (d.name) deptMap[d.name.trim().toLowerCase()] = d.stakeholderId;
      });

      addLog(Object.keys(deptMap).length + ' departamentos cargados.', 'ok');
      return Object.keys(deptMap).length > 0;
    }

    async function buildEmailMap() {
      var map = {};
      addLog('Cargando usuarios existentes...', 'info');
      try {
        var res = await fetch(
          'https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(tools.state.companyId) + '/people?login=true&email=true',
          { headers: apiHeaders() }
        );
        var data = await res.json();
        if (!res.ok) {
          var msg = data && (data.message || (data.records && data.records.devMessage)) || res.status;
          addLog('No se pudo cargar usuarios existentes: ' + msg, 'warn');
          return map;
        }
        (data.records || []).forEach(function (u) {
          if (u.email) map[String(u.email).toLowerCase()] = u.stakeholderId;
        });
      } catch (e) {
        addLog('Error cargando usuarios existentes: ' + e.message, 'warn');
      }
      return map;
    }

    async function ensureEmailMap() {
      if (!emailMap) {
        emailMap = await buildEmailMap();
        addLog('Mapa usuarios: ' + Object.keys(emailMap).length + ' indexados.', 'info');
      }
    }

    function findUserByEmail(email) {
      return emailMap ? (emailMap[String(email || '').toLowerCase()] || null) : null;
    }

    function normalizeYes(value) {
      return String(value || '').trim().toUpperCase() === 'YES';
    }

    function buildPayload(row, deptId, dateLaunch) {
      var cid = String(tools.state.companyId);
      var cidN = parseInt(cid, 10);
      var profiles = {};

      if (normalizeYes(row[COL.profileAdmin])) profiles.ADMIN = [cidN];
      if (normalizeYes(row[COL.profileOperator])) profiles.CONTROLLER = [cidN];
      if (normalizeYes(row[COL.profileUser])) profiles.USER = [cidN];

      var authRaw = String(row[COL.authentication] || 'NO_AUTH')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_');
      var auth = AUTH_MAP[authRaw] || 'noauth';

      var tz = String(row[COL.timezone] || '').trim() || getDefTZ();
      var locale = String(row[COL.locale] || '').trim() || getDefLocale();
      var email = String(row[COL.email] || '').trim();
      var login = String(row[COL.login] || '').trim() || email;
      var position = String(row[COL.position] || '').trim();
      var tags = {};

      if (position) tags['1'] = [position];

      return {
        name: String(row[COL.name] || '').trim(),
        surname: String(row[COL.surname] || '').trim(),
        isBoss: normalizeYes(row[COL.isManager]),
        email: email,
        login: login,
        stakeholderDepartmentId: deptId,
        stakeholderCompanyId: cid,
        dateLaunchSurvey: dateLaunch,
        surveyId: 29,
        authentication: auth,
        environment: {
          notifications: { sendemail: getDefNotif() },
          languages: { default: locale },
          timezone: tz
        },
        profiles: profiles,
        phoneNumber: String(row[COL.phone] || '').trim(),
        tags: tags
      };
    }

    function validateRow(row, idx) {
      var email = String(row[COL.email] || '').trim();
      var deptName = String(row[COL.department] || '').trim();
      var deptId = deptMap[deptName.toLowerCase()];
      var label = '[' + (idx + 1) + '/' + rows.length + '] ';

      if (!email) return { ok: false, message: 'Sin email', label: label + 'X Fila sin email' };
      if (!String(row[COL.name] || '').trim()) return { ok: false, message: 'Sin nombre', label: label + 'X ' + email + ' - Sin nombre' };
      if (!String(row[COL.surname] || '').trim()) return { ok: false, message: 'Sin apellidos', label: label + 'X ' + email + ' - Sin apellidos' };
      if (!deptId) return { ok: false, message: 'Dept no encontrado: ' + deptName, label: label + 'X ' + email + ' - Dept no encontrado: "' + deptName + '"' };

      var anyProfile = ['profileAdmin', 'profileOperator', 'profileUser'].some(function (k) {
        return normalizeYes(row[COL[k]]);
      });
      if (!anyProfile) return { ok: false, message: 'Ningún perfil activo', label: label + 'X ' + email + ' - Ningún perfil activo' };

      return { ok: true, email: email, deptId: deptId, label: label };
    }

    async function processRow(row, idx, dateLaunch) {
      var validation = validateRow(row, idx);
      if (!validation.ok) {
        addLog(validation.label, 'err');
        return { _status: 'ERROR', _message: validation.message };
      }

      var payload = buildPayload(row, validation.deptId, dateLaunch);

      try {
        var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/people', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(payload)
        });
        var rdata = await res.json();

        if (res.ok || res.status === 201) {
          var newId = (rdata.records && rdata.records.stakeholderId) || rdata.stakeholderId || '?';
          addLog(validation.label + 'OK Creado: ' + validation.email + ' (ID: ' + newId + ')', 'ok');
          return { _status: 'CREADO', _id: newId, _message: '' };
        }

        var isDuplicate = res.status === 412 || (rdata.records && rdata.records.applicationCode === 'ND1029');
        var existingId = isDuplicate ? findUserByEmail(validation.email) : null;

        if (existingId) {
          var putRes = await fetch('https://api.kymatio.com/v2/admin/stakeholders/people/' + encodeURIComponent(existingId), {
            method: 'PUT',
            headers: apiHeaders(),
            body: JSON.stringify(payload)
          });
          var putData = await putRes.json();

          if (putRes.ok || putRes.status === 201) {
            addLog(validation.label + 'UPD Actualizado: ' + validation.email + ' (ID: ' + existingId + ')', 'upd');
            return { _status: 'ACTUALIZADO', _id: existingId, _message: '' };
          }

          var putMsg = (putData.records && putData.records.devMessage) || putData.message || putData.error || putRes.status;
          addLog(validation.label + 'X Error actualizar: ' + validation.email + ' - ' + putMsg, 'err');
          return { _status: 'ERROR', _message: 'PUT ' + putMsg };
        }

        var postMsg = (rdata.records && rdata.records.devMessage) || rdata.message || rdata.error || res.status;
        addLog(validation.label + 'X ' + validation.email + ' - ' + postMsg, 'err');
        return { _status: 'ERROR', _message: 'POST ' + postMsg };
      } catch (e) {
        addLog(validation.label + 'X ' + validation.email + ' - ' + e.message, 'err');
        return { _status: 'ERROR', _message: e.message };
      }
    }

    function dateLaunchFromInput(value) {
      var d = new Date(value + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      function pad(n) { return String(n).padStart(2, '0'); }
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' 21:00:00';
    }

    function renderBase() {
      var html = '';
      html += '<div id="kym-bulk-load-status" style="display:none"></div>';

      html += '<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#166534;font-size:12px;line-height:1.5">';
      html += '<strong>Kymatio Bulk Loader.</strong> Crea o actualiza usuarios desde Excel, CSV o TXT. Usa la empresa seleccionada en la cabecera general.';
      html += '<div id="kym-bulk-defaults" style="margin-top:4px;color:#64748b;font-size:11px">Cargando valores por defecto...</div>';
      html += '</div>';

      html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#1e40af;font-size:12px;line-height:1.5">';
      html += 'Hoja preferida: <strong>2.-Empleados (internal)</strong>. Columnas obligatorias: <strong>Name</strong>, <strong>Surname</strong>, <strong>User email</strong> y <strong>Department</strong>. Al menos un perfil debe estar a <strong>YES</strong>.';
      html += '</div>';

      html += '<label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">FECHA DE ENVÍO DEL WELCOME <span style="color:#e53e3e">*</span></label>';
      html += '<input id="kym-bulk-welcome-date" type="date" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;margin-bottom:12px;box-sizing:border-box" />';

      html += '<div style="border:2px dashed #bbf7d0;border-radius:8px;padding:20px;text-align:center;position:relative;margin-bottom:8px;background:#f8fafc">';
      html += '<input id="kym-bulk-file" type="file" accept=".xlsx,.xls,.csv,.txt" style="position:absolute;inset:0;opacity:0;cursor:pointer" />';
      html += '<div style="font-size:26px;margin-bottom:6px">&#128202;</div>';
      html += '<div style="color:#64748b;font-size:12px"><b style="color:#00b89c">Arrastra el archivo</b> o haz clic</div>';
      html += '</div>';
      html += '<div id="kym-bulk-preview-info" style="font-size:12px;color:#64748b;margin-bottom:12px;min-height:16px"></div>';

      html += '<div id="kym-bulk-progress" style="display:none;margin-bottom:12px">';
      html += '<div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;margin-bottom:6px">';
      html += '<div id="kym-bulk-bar" style="background:#00b89c;height:100%;width:0%;transition:width .3s;border-radius:99px"></div></div>';
      html += '<div style="display:flex;gap:10px;font-size:12px;color:#64748b;flex-wrap:wrap">';
      html += '<span>Total: <b id="kym-bulk-done">0</b>/<b id="kym-bulk-total">0</b></span>';
      html += '<span style="color:#38a169;font-weight:600">&#10003; <span id="kym-bulk-ok">0</span></span>';
      html += '<span style="color:#3b82f6;font-weight:600">&#8635; <span id="kym-bulk-upd">0</span></span>';
      html += '<span style="color:#e53e3e;font-weight:600">&#10007; <span id="kym-bulk-err">0</span></span>';
      html += '</div></div>';

      html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
      html += '<button id="kym-bulk-btn-run" disabled style="background:#00b89c;color:white;border:none;padding:9px 20px;border-radius:6px;font-weight:600;cursor:not-allowed;font-size:13px;opacity:.45">&#9654; Iniciar carga</button>';
      html += '<button id="kym-bulk-btn-pause" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#9646;&#9646; Pausar</button>';
      html += '<button id="kym-bulk-btn-export" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#8595; Exportar</button>';
      html += '</div>';

      html += '<div id="kym-bulk-log" style="display:block;background:#0f172a;border-radius:8px;padding:12px;max-height:240px;overflow-y:auto;font-family:Menlo,Consolas,monospace;font-size:11px;color:#94a3b8"></div>';
      html += '<div id="kym-bulk-refresh-end" style="display:none;margin-top:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;text-align:center">';
      html += '<div style="font-size:12px;color:#166534;margin-bottom:10px">&#10003; Carga completada. Para ver los cambios, cierra este panel y refresca la pantalla.</div>';
      html += '<button id="kym-bulk-refresh-action" style="background:#00b89c;color:white;border:none;padding:9px 20px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#8635; Cerrar y refrescar</button>';
      html += '</div>';

      container.innerHTML = html;
      resetCounters();
    }

    function bindEvents() {
      $('kym-bulk-welcome-date').addEventListener('input', updateRunBtn);

      $('kym-bulk-file').addEventListener('change', async function (e) {
        var file = e.target.files[0];
        if (!file) return;

        try {
          var parsed = await readFile(file);
          rows = parsed.rows;
          results = [];
          var missing = findMissingColumns(rows);
          var info = rows.length + ' filas leídas de ' + escHtml(file.name) + ' | Hoja: ' + escHtml(parsed.sheetName);
          if (missing.length) info += ' | &#9888; Columnas no encontradas: ' + escHtml(missing.join(', '));

          $('kym-bulk-preview-info').innerHTML = info;
          $('kym-bulk-total').textContent = rows.length;
          updateRunBtn();
          addLog(rows.length + ' filas leídas' + (missing.length ? ' | Faltan columnas: ' + missing.join(', ') : '') + '.', missing.length ? 'warn' : 'info');
        } catch (err) {
          rows = [];
          updateRunBtn();
          $('kym-bulk-preview-info').innerHTML = '<span style="color:#e53e3e">Error leyendo archivo: ' + escHtml(err.message) + '</span>';
          addLog('Error leyendo archivo: ' + err.message, 'err');
        }
      });

      $('kym-bulk-btn-run').onclick = async function () {
        if (!tools.state.token || !tools.state.companyId || !rows.length) return;

        var dateVal = $('kym-bulk-welcome-date').value;
        if (!dateVal) {
          addLog('Selecciona fecha de envío del welcome.', 'err');
          return;
        }

        if (!confirm('Se van a crear/actualizar ' + rows.length + ' usuarios en ' + tools.state.companyName + '.\n\nFecha welcome: ' + dateVal + '\n\n¿Quieres continuar?')) {
          return;
        }

        var missing = findMissingColumns(rows);
        if (missing.length) {
          addLog('No se puede iniciar. Faltan columnas: ' + missing.join(', '), 'err');
          return;
        }

        var dateLaunch = dateLaunchFromInput(dateVal);
        results = [];
        isPaused = false;
        emailMap = null;
        deptMap = {};

        $('kym-bulk-btn-run').disabled = true;
        $('kym-bulk-btn-run').style.opacity = '.45';
        $('kym-bulk-btn-pause').style.display = 'inline-block';
        $('kym-bulk-progress').style.display = 'block';
        $('kym-bulk-btn-export').style.display = 'none';
        $('kym-bulk-refresh-end').style.display = 'none';
        $('kym-bulk-total').textContent = rows.length;
        $('kym-bulk-done').textContent = '0';
        $('kym-bulk-ok').textContent = '0';
        $('kym-bulk-upd').textContent = '0';
        $('kym-bulk-err').textContent = '0';
        $('kym-bulk-bar').style.width = '0%';

        addLog('Empresa: ' + tools.state.companyName + ' (ID: ' + tools.state.companyId + ')', 'info');
        addLog('Fecha welcome: ' + dateVal + ' | dateLaunchSurvey: ' + dateLaunch, 'info');
        addLog('TZ default: ' + getDefTZ() + ' | Locale default: ' + getDefLocale(), 'info');

        if (!await resolveDepts()) {
          $('kym-bulk-btn-run').disabled = false;
          $('kym-bulk-btn-run').style.opacity = '1';
          $('kym-bulk-btn-pause').style.display = 'none';
          return;
        }

        await ensureEmailMap();

        var okC = 0;
        var updC = 0;
        var errC = 0;
        var BATCH = 5;

        for (var b = 0; b < rows.length; b += BATCH) {
          while (isPaused) await sleep(500);

          var batch = rows.slice(b, b + BATCH);
          var batchResults = await Promise.all(batch.map(function (row, j) {
            return processRow(row, b + j, dateLaunch);
          }));

          batchResults.forEach(function (r, j) {
            results.push(Object.assign({}, batch[j], r));
            if (r._status === 'CREADO') okC++;
            else if (r._status === 'ACTUALIZADO') updC++;
            else errC++;
          });

          $('kym-bulk-ok').textContent = okC;
          $('kym-bulk-upd').textContent = updC;
          $('kym-bulk-err').textContent = errC;
          $('kym-bulk-done').textContent = Math.min(b + BATCH, rows.length);
          $('kym-bulk-bar').style.width = Math.round((Math.min(b + BATCH, rows.length) / rows.length) * 100) + '%';
        }

        addLog('Completado: ' + okC + ' creados, ' + updC + ' actualizados, ' + errC + ' errores.', 'info');
        $('kym-bulk-refresh-end').style.display = 'block';
        $('kym-bulk-btn-pause').style.display = 'none';
        $('kym-bulk-btn-run').disabled = false;
        $('kym-bulk-btn-run').style.opacity = '1';
        $('kym-bulk-btn-export').style.display = 'inline-block';
      };

      $('kym-bulk-btn-pause').onclick = function () {
        isPaused = !isPaused;
        this.innerHTML = isPaused ? '&#9654; Reanudar' : '&#9646;&#9646; Pausar';
      };

      $('kym-bulk-btn-export').onclick = function () {
        if (!results.length) return;
        var ws = XLSX.utils.json_to_sheet(results);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
        XLSX.writeFile(wb, 'kymatio_carga_' + new Date().toISOString().slice(0, 10) + '.xlsx');
      };

      $('kym-bulk-refresh-action').onclick = function () {
        var panel = document.getElementById('kym-admin-panel');
        if (panel) panel.remove();
        location.reload();
      };
    }

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando Kymatio Bulk Loader...</div>';

    loadXlsx()
      .then(function () {
        renderBase();
        bindEvents();
        return loadCompanyDefaults();
      })
      .then(function () {
        addLog('Panel listo. Empresa: ' + (tools.state.companyName || '?') + ' | TZ: ' + getDefTZ() + ' | Locale: ' + getDefLocale(), 'ok');
      })
      .catch(function (e) {
        container.innerHTML = '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">Error: ' + escHtml(e.message) + '</div>';
      });
  }

  KAT.registerModule({
    key: 'bulk_loader',
    label: 'Kymatio Bulk Loader',
    icon: '&#9889;',
    order: 130,
    group: 'bulk',
    forceGuiOnly: true,
    renderGui: renderGui
  });
})();
