(function () {
  'use strict';

  var MOD_VERSION = 'bulk-departments-v1';
  var TAG_FUNCION_DEPT = 2; // Tag "Función del departamento"

  if (!window.KymatioAdminTools) { console.error('KAT no cargado'); return; }
  var KAT = window.KymatioAdminTools;

  // ── Helpers ──────────────────────────────────────────────────────────────────

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
    if (!res.ok) throw new Error((d && d.message) || 'HTTP ' + res.status);
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

  // ── Render ────────────────────────────────────────────────────────────────────

  function render(container, kat) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kat.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +
      '<div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#92400e;line-height:1.6">' +
        'Carga un Excel con columnas <code>Department</code>, <code>Parent Department</code> y <code>Position</code>.<br>' +
        'Crea o modifica departamentos según existan o no en la empresa activa.' +
      '</div>' +
      '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Selecciona el Excel:</label>' +
        '<input type="file" id="kat-dept-file" accept=".xlsx,.xls" style="font-size:13px;width:100%;box-sizing:border-box;">' +
      '</div>' +
      '<div id="kat-dept-preview" style="display:none;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:12px;color:#475569;"></div>' +
      '<button id="kat-dept-run" style="display:none;width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Procesar departamentos</button>' +
      '<div id="kat-dept-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +
      '<div id="kat-dept-progress" style="display:none;margin-bottom:12px;">' +
        '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px;">' +
          '<div id="kat-dept-bar" style="height:100%;background:#1e293b;width:0%;transition:width .3s;"></div>' +
        '</div>' +
        '<div id="kat-dept-progress-text" style="font-size:12px;color:#64748b;text-align:center;"></div>' +
      '</div>';

    function setStatus(msg, type) {
      var el = document.getElementById('kat-dept-status');
      if (!el) return;
      var s = {err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;', ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;', info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'};
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;' + (s[type]||s.info);
      el.innerHTML = msg;
    }

    function setProgress(pct, text) {
      var bar = document.getElementById('kat-dept-bar');
      var txt = document.getElementById('kat-dept-progress-text');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = text;
    }

    var parsedRows = [];

    document.getElementById('kat-dept-file').onchange = async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      document.getElementById('kat-dept-preview').style.display = 'none';
      document.getElementById('kat-dept-run').style.display = 'none';
      parsedRows = [];

      try {
        await loadXlsx();
        var buf = await file.arrayBuffer();
        var wb = window.XLSX.read(buf, {type:'array'});

        // Buscar la hoja de datos (la que tiene columna Department)
        var dataSheet = null;
        wb.SheetNames.forEach(function(name) {
          if (dataSheet) return;
          var ws = wb.Sheets[name];
          var data = window.XLSX.utils.sheet_to_json(ws, {defval:'', header:1});
          if (data.length && data[0] && String(data[0][0]).toLowerCase().indexOf('department') >= 0) {
            dataSheet = window.XLSX.utils.sheet_to_json(ws, {defval:''});
          }
        });

        if (!dataSheet) throw new Error('No se encontró hoja con columna "Department".');
        if (!dataSheet.length) throw new Error('La hoja está vacía.');

        // Detectar columnas
        var keys = Object.keys(dataSheet[0]);
        var colDept   = keys.find(function(k){ return k.toLowerCase().trim() === 'department'; });
        var colParent = keys.find(function(k){ return k.toLowerCase().replace(/\s+/g,'') === 'parentdepartment'; });
        var colPos    = keys.find(function(k){ return k.toLowerCase().trim() === 'position'; });

        if (!colDept) throw new Error('No se encontró columna "Department".');

        parsedRows = dataSheet.map(function(row) {
          return {
            name:   String(row[colDept]   || '').trim(),
            parent: String(row[colParent] || '').trim(),
            pos:    String(row[colPos]    || '').trim()
          };
        }).filter(function(r){ return r.name; });

        if (!parsedRows.length) throw new Error('No hay filas con datos.');

        var prev = document.getElementById('kat-dept-preview');
        prev.style.display = 'block';
        prev.innerHTML = '<strong>' + parsedRows.length + ' departamentos</strong> para procesar.<br>' +
          'Primeras filas: ' + parsedRows.slice(0,4).map(function(r){
            return '<code>' + kat.escHtml(r.name) + (r.parent ? ' (parent: '+kat.escHtml(r.parent)+')' : '') + '</code>';
          }).join(' · ');

        document.getElementById('kat-dept-run').style.display = 'block';

      } catch(e) {
        setStatus('&#10007; ' + kat.escHtml(e.message), 'err');
      }
    };

    document.getElementById('kat-dept-run').onclick = async function() {
      if (!parsedRows.length) return;

      var cid = kat.state.companyId;
      if (!cid) { setStatus('&#10007; No hay empresa activa. Pulsa ↻ Actualizar empresa.', 'err'); return; }

      if (!confirm('Se van a procesar ' + parsedRows.length + ' departamentos en la empresa "' + kat.state.companyName + '".\n\n¿Continuar?')) return;

      var btn = document.getElementById('kat-dept-run');
      btn.disabled = true; btn.textContent = '⏳ Procesando...';
      document.getElementById('kat-dept-progress').style.display = 'block';
      setStatus('Cargando departamentos existentes...', 'info');

      var ok = [], errors = [];

      try {
        // 1. Cargar todos los departamentos existentes → mapa nombre→id
        var deptData = await apiCall('GET', 'admin/stakeholders/companies/' + cid + '/departments');
        var depts = Array.isArray(deptData) ? deptData : (deptData.records || []);
        var deptMap = {}; // nombre.toUpperCase() → stakeholderId
        depts.forEach(function(d){ deptMap[d.name.toUpperCase()] = d.stakeholderId; });

        setStatus('Procesando filas...', 'info');
        document.getElementById('kat-dept-progress').style.display = 'block';

        for (var i = 0; i < parsedRows.length; i++) {
          var row = parsedRows[i];
          var pct = Math.round((i / parsedRows.length) * 100);
          setProgress(pct, (i+1) + ' / ' + parsedRows.length + ' — ' + row.name);

          try {
            var existingId = deptMap[row.name.toUpperCase()];
            var isCreate = !existingId;

            // Resolver parent
            var parentId = null;
            if (row.parent) {
              parentId = deptMap[row.parent.toUpperCase()];
              if (!parentId) throw new Error('Parent "' + row.parent + '" no existe en la empresa.');
            }

            if (isCreate) {
              // ── CREAR ─────────────────────────────────────────────────────
              var body = {
                name: row.name,
                stakeholderCompanyId: String(cid)
              };
              if (parentId) body.stakeholderDepartmentParentId = parentId;
              if (row.pos) body.tags = {};
              if (row.pos) body.tags[TAG_FUNCION_DEPT] = [row.pos];

              var created = await apiCall('POST', 'admin/stakeholders/departments', body);
              var newId = created.stakeholderId || (created.records && created.records.stakeholderId);
              if (newId) deptMap[row.name.toUpperCase()] = newId; // actualizar mapa para parents posteriores
              ok.push({Departamento: row.name, Acción: 'CREADO', Parent: row.parent, Position: row.pos, _status: 'OK', _message: ''});

            } else {
              // ── MODIFICAR ─────────────────────────────────────────────────
              // Cargar estado actual para saber tag existente
              var current = await apiCall('GET', 'admin/stakeholders/departments/' + existingId + '?stakeholderDepartmentParentId=true&tags=true');
              var currentPos = current.tags && current.tags[TAG_FUNCION_DEPT] && current.tags[TAG_FUNCION_DEPT][0];

              var body2 = {
                name: row.name,
                stakeholderCompanyId: String(cid)
              };

              // Parent: si viene vacío → sin parent (null); si viene valor → usar parentId
              if (parentId) {
                body2.stakeholderDepartmentParentId = parentId;
              } else {
                body2.stakeholderDepartmentParentId = null;
              }

              // Position: solo modificar si viene relleno en el Excel
              body2.tags = {};
              if (row.pos) {
                body2.tags[TAG_FUNCION_DEPT] = [row.pos];
              } else if (currentPos) {
                body2.tags[TAG_FUNCION_DEPT] = [currentPos]; // respetar el existente
              }

              await apiCall('PUT', 'admin/stakeholders/departments/' + existingId, body2);
              ok.push({Departamento: row.name, Acción: 'MODIFICADO', Parent: row.parent, Position: row.pos || '(sin cambio)', _status: 'OK', _message: ''});
            }

          } catch(e) {
            errors.push({Departamento: row.name, Acción: isCreate ? 'CREAR' : 'MODIFICAR', Parent: row.parent, Position: row.pos, _status: 'ERROR', _message: e.message});
          }
        }

        setProgress(100, 'Completado');
        document.getElementById('kat-dept-progress').style.display = 'none';

        var type = errors.length === 0 ? 'ok' : (ok.length === 0 ? 'err' : 'info');
        setStatus('Completado. &#10003; OK: <strong>' + ok.length + '</strong> · &#10007; Errores: <strong>' + errors.length + '</strong>', type);

        // Excel de resultados
        await loadXlsx();
        var allRows = ok.concat(errors);
        var ws = window.XLSX.utils.json_to_sheet(allRows);
        ws['!cols'] = [{wch:30},{wch:12},{wch:25},{wch:20},{wch:10},{wch:50}];
        var wb2 = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb2, ws, 'Resultados');
        window.XLSX.writeFile(wb2, 'kymatio_departments_' + new Date().toISOString().slice(0,10) + '.xlsx');

        kat.showToast('Completado: ' + ok.length + ' OK, ' + errors.length + ' errores', errors.length ? 'err' : 'ok');

      } catch(e) {
        setProgress(0, '');
        document.getElementById('kat-dept-progress').style.display = 'none';
        setStatus('&#10007; Error: ' + kat.escHtml(e.message), 'err');
        kat.showToast('Error: ' + e.message, 'err');
      }

      btn.disabled = false;
      btn.textContent = '▶ Procesar departamentos';
    };
  }

  KAT.registerModule({
    key:     'bulk_departments',
    label:   'Gestión de departamentos',
    group:   'bulk',
    icon:    '&#127970;',
    order:   55,
    version: MOD_VERSION,
    render:  render
  });

})();
