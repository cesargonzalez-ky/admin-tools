(function () {
  'use strict';

  var MOD_VERSION = 'bulk-departments-rename-v2';

  if (!window.KymatioAdminTools) { console.error('KAT no cargado'); return; }
  var KAT = window.KymatioAdminTools;

  function apiHeaders() {
    var token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  }

  async function apiCall(method, path, body) {
    var res = await fetch('https://api.kymatio.com/v2/' + path, {
      method: method,
      headers: apiHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });
    var d = await res.json();
    if (!res.ok) {
      var msg = (d && d.message) || (d && d.records && d.records.devMessage) || ('HTTP ' + res.status);
      // Detectar nombre duplicado
      if (res.status === 400 && (msg.toLowerCase().indexOf('duplicate') >= 0 || msg.toLowerCase().indexOf('exist') >= 0 || msg.toLowerCase().indexOf('ya existe') >= 0)) {
        throw new Error('El nombre nuevo ya existe en otro departamento');
      }
      if (res.status === 400) {
        throw new Error('Nombre inválido o ya existe un departamento con ese nombre (HTTP 400)');
      }
      throw new Error(msg);
    }
    return d.records || d;
  }

  async function loadXlsx() {
    if (window.XLSX) return;
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function addLog(container, msg, type) {
    var line = document.createElement('div');
    line.style.cssText = 'padding:2px 0;' + (type === 'ok' ? 'color:#4ade80;' : type === 'err' ? 'color:#f87171;' : 'color:#94a3b8;');
    line.textContent = (type === 'ok' ? '✓ ' : type === 'err' ? '✗ ' : '· ') + msg;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }

  function renderGui(container, kat) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kat.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +

      '<div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#92400e;line-height:1.7">' +
        'Carga un Excel con dos columnas:<br>' +
        '&nbsp;&nbsp;<strong>Columna A</strong> — Nombre antiguo del departamento<br>' +
        '&nbsp;&nbsp;<strong>Columna B</strong> — Nombre nuevo del departamento<br>' +
        '<span style="font-size:11px;color:#a16207;">No se comprueban las cabeceras. Si la primera fila tiene texto en ambas columnas, se procesará también.</span>' +
      '</div>' +

      '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Selecciona el Excel:</label>' +
        '<input type="file" id="kat-ren-file" accept=".xlsx,.xls" style="font-size:13px;width:100%;box-sizing:border-box;">' +
      '</div>' +

      '<div id="kat-ren-preview" style="display:none;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:12px;color:#475569;"></div>' +

      '<button id="kat-ren-run" style="display:none;width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Renombrar departamentos</button>' +

      '<div id="kat-ren-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +

      '<div id="kat-ren-progress" style="display:none;margin-bottom:8px;">' +
        '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px;">' +
          '<div id="kat-ren-bar" style="height:100%;background:#1e293b;width:0%;transition:width .3s;"></div>' +
        '</div>' +
        '<div id="kat-ren-progress-text" style="font-size:12px;color:#64748b;text-align:center;margin-bottom:8px;"></div>' +
      '</div>' +

      '<div id="kat-ren-console" style="display:none;background:#0f172a;border-radius:8px;padding:12px;font-size:12px;font-family:Menlo,Consolas,monospace;height:200px;overflow-y:auto;margin-bottom:12px;"></div>';

    function setStatus(msg, type) {
      var el = document.getElementById('kat-ren-status');
      if (!el) return;
      var s = {err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;', ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;', info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'};
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;' + (s[type]||s.info);
      el.innerHTML = msg;
    }

    function setProgress(pct, text) {
      var bar = document.getElementById('kat-ren-bar');
      var txt = document.getElementById('kat-ren-progress-text');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = text;
    }

    var parsedRows = [];

    document.getElementById('kat-ren-file').onchange = async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      document.getElementById('kat-ren-preview').style.display = 'none';
      document.getElementById('kat-ren-run').style.display = 'none';
      document.getElementById('kat-ren-console').style.display = 'none';
      parsedRows = [];

      try {
        await loadXlsx();
        var buf = await file.arrayBuffer();
        var wb = window.XLSX.read(buf, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        // Leer como array de arrays — sin interpretar cabeceras
        var data = window.XLSX.utils.sheet_to_json(ws, {defval:'', header:1});

        data.forEach(function(row) {
          // Col A → nombre antiguo, Col B → nombre nuevo
          var oldName = String(row[0] || '').trim().toUpperCase();
          var newName = String(row[1] || '').trim().toUpperCase();
          if (oldName && newName) {
            parsedRows.push({oldName: oldName, newName: newName});
          }
        });

        if (!parsedRows.length) throw new Error('No se encontraron filas con datos en ambas columnas.');

        var prev = document.getElementById('kat-ren-preview');
        prev.style.display = 'block';
        prev.innerHTML = '<strong>' + parsedRows.length + ' filas</strong> detectadas (nombres en mayúsculas).<br>' +
          parsedRows.slice(0,4).map(function(r){
            return '<code>' + kat.escHtml(r.oldName) + ' → ' + kat.escHtml(r.newName) + '</code>';
          }).join('<br>') +
          (parsedRows.length > 4 ? '<br><span style="color:#94a3b8;">...y ' + (parsedRows.length-4) + ' más</span>' : '');

        document.getElementById('kat-ren-run').style.display = 'block';

      } catch(e) {
        setStatus('&#10007; ' + kat.escHtml(e.message), 'err');
      }
    };

    document.getElementById('kat-ren-run').onclick = async function() {
      if (!parsedRows.length) return;

      var cid = kat.state.companyId;
      if (!cid) { setStatus('&#10007; No hay empresa activa. Pulsa ↻ Actualizar empresa.', 'err'); return; }

      if (!confirm('Se van a renombrar ' + parsedRows.length + ' departamentos en "' + kat.state.companyName + '".\n\n¿Continuar?')) return;

      var btn = document.getElementById('kat-ren-run');
      btn.disabled = true; btn.textContent = '⏳ Procesando...';

      var consoleEl = document.getElementById('kat-ren-console');
      consoleEl.style.display = 'block';
      consoleEl.innerHTML = '';
      document.getElementById('kat-ren-progress').style.display = 'block';

      var ok = [], errors = [];

      try {
        // 1. Cargar listado completo
        setStatus('Cargando departamentos...', 'info');
        addLog(consoleEl, 'Cargando listado de departamentos de ' + kat.state.companyName + '...', 'info');

        var deptData = await apiCall('GET', 'admin/stakeholders/companies/' + cid + '/departments');
        var depts = Array.isArray(deptData) ? deptData : (deptData.records || []);
        var deptMap = {};
        depts.forEach(function(d){ deptMap[d.name.toUpperCase()] = d.stakeholderId; });

        addLog(consoleEl, depts.length + ' departamentos cargados.', 'info');
        setStatus('Procesando...', 'info');

        // 2. Procesar cada fila
        for (var i = 0; i < parsedRows.length; i++) {
          var row = parsedRows[i];
          var pct = Math.round(((i + 1) / parsedRows.length) * 100);
          setProgress(pct, (i+1) + ' / ' + parsedRows.length);

          var deptId = deptMap[row.oldName];

          if (!deptId) {
            var errMsg = 'No encontrado en la empresa';
            errors.push({'Nombre antiguo': row.oldName, 'Nombre nuevo': row.newName, _status: 'ERROR', _message: errMsg});
            addLog(consoleEl, row.oldName + ' → ' + row.newName + ' · ' + errMsg, 'err');
          } else {
            try {
              await apiCall('PUT', 'admin/stakeholders/departments/' + deptId, {
                name: row.newName,
                stakeholderCompanyId: String(cid)
              });
              ok.push({'Nombre antiguo': row.oldName, 'Nombre nuevo': row.newName, _status: 'OK', _message: ''});
              addLog(consoleEl, row.oldName + ' → ' + row.newName, 'ok');
              // Actualizar mapa
              delete deptMap[row.oldName];
              deptMap[row.newName] = deptId;
            } catch(e) {
              errors.push({'Nombre antiguo': row.oldName, 'Nombre nuevo': row.newName, _status: 'ERROR', _message: e.message});
              addLog(consoleEl, row.oldName + ' → ' + row.newName + ' · ' + e.message, 'err');
            }
          }

          await new Promise(function(r){ setTimeout(r, 400); });
        }

        setProgress(100, 'Completado');
        document.getElementById('kat-ren-progress').style.display = 'none';

        var summary = 'Completado. &#10003; OK: <strong>' + ok.length + '</strong> · &#10007; Errores: <strong>' + errors.length + '</strong>';
        var type = errors.length === 0 ? 'ok' : (ok.length === 0 ? 'err' : 'info');
        setStatus(summary, type);
        addLog(consoleEl, '─── ' + ok.length + ' OK · ' + errors.length + ' errores ───', 'info');

        // Excel resultados
        await loadXlsx();
        var ws2 = window.XLSX.utils.json_to_sheet(ok.concat(errors));
        ws2['!cols'] = [{wch:35},{wch:35},{wch:10},{wch:50}];
        var wb2 = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb2, ws2, 'Resultados');
        window.XLSX.writeFile(wb2, 'kymatio_rename_departments_' + new Date().toISOString().slice(0,10) + '.xlsx');

        kat.showToast('Completado: ' + ok.length + ' OK, ' + errors.length + ' errores', errors.length ? 'err' : 'ok');

      } catch(e) {
        document.getElementById('kat-ren-progress').style.display = 'none';
        setStatus('&#10007; Error: ' + kat.escHtml(e.message), 'err');
        addLog(consoleEl, 'Error fatal: ' + e.message, 'err');
        kat.showToast('Error: ' + e.message, 'err');
      }

      btn.disabled = false;
      btn.textContent = '▶ Renombrar departamentos';
    };
  }

  KAT.registerModule({
    key:          'bulk_departments',
    label:        'Renombrar departamentos',
    group:        'bulk',
    icon:         '&#9998;',
    order:        55,
    version:      MOD_VERSION,
    renderGui:    renderGui,
    forceGuiOnly: true
  });

})();
