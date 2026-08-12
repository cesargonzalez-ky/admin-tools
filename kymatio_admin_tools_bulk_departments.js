(function () {
  'use strict';

  var MOD_VERSION = 'bulk-departments-rename-v1';

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

  function renderGui(container, kat) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kat.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +
      '<div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#92400e;line-height:1.6">' +
        'Carga un Excel con dos columnas: <strong>Nombre antiguo</strong> y <strong>Nombre nuevo</strong>.<br>' +
        'El sistema buscará cada departamento por nombre y lo renombrará.' +
      '</div>' +
      '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Selecciona el Excel:</label>' +
        '<input type="file" id="kat-ren-file" accept=".xlsx,.xls" style="font-size:13px;width:100%;box-sizing:border-box;">' +
      '</div>' +
      '<div id="kat-ren-preview" style="display:none;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:12px;color:#475569;"></div>' +
      '<button id="kat-ren-run" style="display:none;width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Renombrar departamentos</button>' +
      '<div id="kat-ren-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +
      '<div id="kat-ren-progress" style="display:none;margin-bottom:12px;">' +
        '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px;">' +
          '<div id="kat-ren-bar" style="height:100%;background:#1e293b;width:0%;transition:width .3s;"></div>' +
        '</div>' +
        '<div id="kat-ren-progress-text" style="font-size:12px;color:#64748b;text-align:center;"></div>' +
      '</div>';

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
      parsedRows = [];

      try {
        await loadXlsx();
        var buf = await file.arrayBuffer();
        var wb = window.XLSX.read(buf, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var data = window.XLSX.utils.sheet_to_json(ws, {defval:'', header:1});

        // Ignorar fila de cabecera si es texto, tomar todas las filas con dos valores
        var rows = [];
        data.forEach(function(row, i) {
          var old = String(row[0] || '').trim();
          var neu = String(row[1] || '').trim();
          if (!old || !neu) return;
          // Ignorar si la primera celda parece cabecera
          if (i === 0 && /nombre|name|department|old|nuevo|new/i.test(old)) return;
          rows.push({oldName: old, newName: neu});
        });

        if (!rows.length) throw new Error('No se encontraron filas con datos.');

        parsedRows = rows;

        var prev = document.getElementById('kat-ren-preview');
        prev.style.display = 'block';
        prev.innerHTML = '<strong>' + rows.length + ' renombrados</strong> para procesar.<br>' +
          'Primeras filas: ' + rows.slice(0,4).map(function(r){
            return '<code>' + kat.escHtml(r.oldName) + ' → ' + kat.escHtml(r.newName) + '</code>';
          }).join(' · ');

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
      document.getElementById('kat-ren-progress').style.display = 'block';
      setStatus('Cargando departamentos existentes...', 'info');

      var ok = [], errors = [];

      try {
        // 1. Descargar listado completo → mapa nombre.toUpperCase() → id
        var deptData = await apiCall('GET', 'admin/stakeholders/companies/' + cid + '/departments');
        var depts = Array.isArray(deptData) ? deptData : (deptData.records || []);
        var deptMap = {};
        depts.forEach(function(d){ deptMap[d.name.toUpperCase()] = d.stakeholderId; });

        setStatus('Renombrando...', 'info');

        // 2. Por cada fila: buscar por nombre antiguo → PUT con nombre nuevo
        for (var i = 0; i < parsedRows.length; i++) {
          var row = parsedRows[i];
          var pct = Math.round((i / parsedRows.length) * 100);
          setProgress(pct, (i+1) + ' / ' + parsedRows.length + ' — ' + row.oldName);

          var deptId = deptMap[row.oldName.toUpperCase()];

          if (!deptId) {
            errors.push({
              'Nombre antiguo': row.oldName,
              'Nombre nuevo':   row.newName,
              _status:          'ERROR',
              _message:         'Departamento no encontrado en la empresa'
            });
          } else {
            try {
              await apiCall('PUT', 'admin/stakeholders/departments/' + deptId, {
                name: row.newName,
                stakeholderCompanyId: String(cid)
              });
              ok.push({
                'Nombre antiguo': row.oldName,
                'Nombre nuevo':   row.newName,
                _status:          'OK',
                _message:         ''
              });
              // Actualizar mapa por si el nuevo nombre se usa en filas posteriores
              delete deptMap[row.oldName.toUpperCase()];
              deptMap[row.newName.toUpperCase()] = deptId;
            } catch(e) {
              errors.push({
                'Nombre antiguo': row.oldName,
                'Nombre nuevo':   row.newName,
                _status:          'ERROR',
                _message:         e.message
              });
            }
          }

          await new Promise(function(r){ setTimeout(r, 400); });
        }

        setProgress(100, 'Completado');
        document.getElementById('kat-ren-progress').style.display = 'none';

        var type = errors.length === 0 ? 'ok' : (ok.length === 0 ? 'err' : 'info');
        setStatus('Completado. &#10003; OK: <strong>' + ok.length + '</strong> · &#10007; Errores: <strong>' + errors.length + '</strong>', type);

        // Excel de resultados
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
        kat.showToast('Error: ' + e.message, 'err');
      }

      btn.disabled = false;
      btn.textContent = '▶ Renombrar departamentos';
    };
  }

  KAT.registerModule({
    key:         'bulk_departments',
    label:       'Renombrar departamentos',
    group:       'bulk',
    icon:        '&#9998;',
    order:       55,
    version:     MOD_VERSION,
    renderGui:   renderGui,
    forceGuiOnly: true
  });

})();
