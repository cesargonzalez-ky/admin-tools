(function () {
  'use strict';

  var MOD_VERSION = 'actions-v2';

  if (!window.KymatioContentManagement) {
    console.error('KCM: core no cargado');
    return;
  }

  var KCM = window.KymatioContentManagement;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getText(field, locale) {
    try {
      var loc = locale || 'es-es';
      var d = field.dictionary[loc];
      return d.default || '';
    } catch(e) { return ''; }
  }

  async function fetchAssetMap() {
    var map = {};
    var page = 1;
    var totalPages = null;
    while (true) {
      var r = await KCM.apiGet('admin/mgm/assets', {
        page: page, limit: 100, isActive: true,
        sortBy: 'assetId', order: 'asc', locale: 'es-es'
      });
      var records = r.records || [];
      var meta = r._meta && r._meta.pagination;
      if (meta && meta.totalPages && totalPages === null) totalPages = meta.totalPages;
      records.forEach(function(a) {
        map[String(a.assetId)] = a.link || ('Asset ' + a.assetId);
      });
      if (!records.length) break;
      if (totalPages !== null && page >= totalPages) break;
      if (totalPages === null && records.length < 100) break;
      page++;
    }
    // Inactivos también
    page = 1; totalPages = null;
    while (true) {
      var r2 = await KCM.apiGet('admin/mgm/assets', {
        page: page, limit: 100, isActive: false,
        sortBy: 'assetId', order: 'asc', locale: 'es-es'
      });
      var records2 = r2.records || [];
      var meta2 = r2._meta && r2._meta.pagination;
      if (meta2 && meta2.totalPages && totalPages === null) totalPages = meta2.totalPages;
      records2.forEach(function(a) {
        if (!map[String(a.assetId)]) map[String(a.assetId)] = a.link || ('Asset ' + a.assetId);
      });
      if (!records2.length) break;
      if (totalPages !== null && page >= totalPages) break;
      if (totalPages === null && records2.length < 100) break;
      page++;
    }
    return map;
  }

  async function fetchAllActions(onProgress) {
    var all = [];
    var seen = {};
    var page = 1;
    var totalPages = null;

    async function fetchPages(isActive) {
      page = 1; totalPages = null;
      while (true) {
        var r = await KCM.apiGet('admin/mgm/actions', {
          page: page, limit: 100, isActive: isActive,
          sortBy: 'actionId', order: 'asc', locale: 'es-es'
        });
        var records = r.records || [];
        var meta = r._meta && r._meta.pagination;
        if (meta && meta.totalPages && totalPages === null) totalPages = meta.totalPages;
        records.forEach(function(a) {
          if (!seen[a.actionId]) {
            seen[a.actionId] = true;
            all.push(a);
          }
        });
        if (onProgress) onProgress(all.length, isActive ? 'activas' : 'inactivas');
        if (!records.length) break;
        if (totalPages !== null && page >= totalPages) break;
        if (totalPages === null && records.length < 100) break;
        page++;
      }
    }

    await fetchPages(true);
    await fetchPages(false);
    return all;
  }

  function buildRows(actions, assetMap) {
    return actions.map(function(a) {
      var ac = a.action || {};
      var resources = ac.resources || [];
      var assetsNombres = resources.map(function(id) {
        return (assetMap && assetMap[String(id)]) ? assetMap[String(id)] + ' (' + id + ')' : 'ID:' + id;
      }).join('; ');
      return {
        'actionId':                  a.actionId,
        'psychoCode':                a.psychoCode || '',
        'stakeholderCompanyId':      a.stakeholderCompanyId || '',
        'entity':                    ac.entity || '',
        'type':                      ac.type && ac.type.value || '',
        'session':                   ac.session || '',
        'dimension':                 ac.dimension && ac.dimension.value || '',
        'Organización':              getText(ac.organization && ac.organization.text, 'es-es'),
        'organizationId':            ac.organization && ac.organization.value || '',
        'originalLanguage':          ac.originalLanguage || '',
        'minValue':                  ac.minValue != null ? ac.minValue : '',
        'maxValue':                  ac.maxValue != null ? ac.maxValue : '',
        'userTitle (es-es)':         getText(ac.userTitle, 'es-es'),
        'userDescription (es-es)':   getText(ac.userDescription, 'es-es'),
        'operatorTitle (es-es)':     getText(ac.operatorTitle, 'es-es'),
        'operatorDescription (es-es)': getText(ac.operatorDescription, 'es-es'),
        'assets (resources)':        assetsNombres,
        'status':                    ac.isActive ? 'Activa' : 'Inactiva'
      };
    });
  }

  function exportExcel(actions, assetMap) {
    var rows = buildRows(actions, assetMap);
    var ws = window.XLSX.utils.json_to_sheet(rows);
    var cols = Object.keys(rows[0] || {});
    ws['!cols'] = cols.map(function(col) {
      var max = col.length;
      rows.forEach(function(r){ var v = String(r[col]||''); if(v.length>max) max=v.length; });
      return { wch: Math.min(max + 2, 120) };
    });
    var wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Acciones');
    var resumen = [
      ['Campo', 'Valor'],
      ['Fecha exportación', new Date().toISOString().slice(0,19).replace('T',' ')],
      ['Total acciones', actions.length],
      ['Activas', actions.filter(function(a){ return a.action && a.action.isActive; }).length],
      ['Inactivas', actions.filter(function(a){ return a.action && !a.action.isActive; }).length]
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(resumen), 'Resumen');
    window.XLSX.writeFile(wb, 'kymatio_actions_' + new Date().toISOString().slice(0,10) + '.xlsx');
  }

  // ── Módulo Listado ────────────────────────────────────────────────────────────

  function renderListado(container, kcm) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kcm.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#0369a1;line-height:1.6">' +
        'Exporta <strong>todas las acciones</strong> de la plataforma (activas e inactivas).<br>' +
        'Los textos se obtienen en <strong>español (es-es)</strong>, valor <em>default</em>.' +
      '</div>' +
      '<div id="kcm-actions-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +
      '<div id="kcm-actions-progress" style="display:none;margin-bottom:12px;">' +
        '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px;">' +
          '<div id="kcm-actions-bar" style="height:100%;background:#1e293b;width:0%;transition:width .3s;"></div>' +
        '</div>' +
        '<div id="kcm-actions-progress-text" style="font-size:12px;color:#64748b;text-align:center;"></div>' +
      '</div>' +
      '<button id="kcm-actions-run" style="width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Descargar Excel de acciones</button>' +
      '<div id="kcm-actions-summary" style="display:none;background:#f0fff4;border:1px solid #9ae6b4;border-radius:8px;padding:12px;font-size:13px;color:#276749;"></div>';

    function setStatus(msg, type) {
      var el = document.getElementById('kcm-actions-status');
      if (!el) return;
      var s = {err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;', ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;', info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'};
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;' + (s[type]||s.info);
      el.innerHTML = msg;
    }

    document.getElementById('kcm-actions-run').onclick = async function() {
      var btn = document.getElementById('kcm-actions-run');
      btn.disabled = true; btn.textContent = '⏳ Cargando...';
      document.getElementById('kcm-actions-progress').style.display = 'block';
      document.getElementById('kcm-actions-summary').style.display = 'none';
      setStatus('Cargando mapa de assets...', 'info');

      try {
        var assetMap = await fetchAssetMap();
        setStatus('Cargando acciones...', 'info');
        var actions = await fetchAllActions(function(count, tipo) {
          var bar = document.getElementById('kcm-actions-bar');
          var txt = document.getElementById('kcm-actions-progress-text');
          if (bar) bar.style.width = Math.min(count / 2, 90) + '%';
          if (txt) txt.textContent = count + ' acciones cargadas (' + tipo + ')...';
        });

        if (!actions.length) throw new Error('No se encontraron acciones.');

        document.getElementById('kcm-actions-bar').style.width = '100%';
        document.getElementById('kcm-actions-progress-text').textContent = 'Total: ' + actions.length + '. Generando Excel...';
        setStatus('Generando Excel...', 'info');

        await kcm.loadXlsx();
        exportExcel(actions, assetMap);

        document.getElementById('kcm-actions-progress').style.display = 'none';
        setStatus('&#10003; Excel descargado. ' + actions.length + ' acciones exportadas.', 'ok');

        var activas   = actions.filter(function(a){ return a.action && a.action.isActive; }).length;
        var inactivas = actions.length - activas;
        var sumEl = document.getElementById('kcm-actions-summary');
        sumEl.style.display = 'block';
        sumEl.innerHTML = '<strong>&#10003; Exportación completada</strong><br>Total: <strong>' + actions.length + '</strong> &nbsp;|&nbsp; Activas: <strong>' + activas + '</strong> &nbsp;|&nbsp; Inactivas: <strong>' + inactivas + '</strong>';
        kcm.showToast('Excel descargado — ' + actions.length + ' acciones', 'ok');

      } catch(e) {
        document.getElementById('kcm-actions-progress').style.display = 'none';
        setStatus('&#10007; Error: ' + kcm.escHtml(e.message), 'err');
        kcm.showToast('Error: ' + e.message, 'err');
      }

      btn.disabled = false; btn.textContent = '▶ Descargar Excel de acciones';
    };
  }

  // ── Módulo Modificar psychoCode ───────────────────────────────────────────────

  function renderModificar(container, kcm) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kcm.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +
      '<div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#92400e;line-height:1.6">' +
        'Carga un Excel con <strong>actionId</strong> y <strong>psychoCode</strong> para actualizar el código identificativo de cada acción.<br>' +
        '<strong>Columnas requeridas:</strong> <code>actionId</code> · <code>psychoCode</code>' +
      '</div>' +
      '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Selecciona el Excel:</label>' +
        '<input type="file" id="kcm-mod-file" accept=".xlsx,.xls" style="font-size:13px;width:100%;box-sizing:border-box;">' +
      '</div>' +
      '<div id="kcm-mod-preview" style="display:none;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:12px;color:#475569;"></div>' +
      '<button id="kcm-mod-run" style="display:none;width:100%;background:#0f766e;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Ejecutar modificaciones</button>' +
      '<div id="kcm-mod-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +
      '<div id="kcm-mod-progress" style="display:none;margin-bottom:12px;">' +
        '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px;">' +
          '<div id="kcm-mod-bar" style="height:100%;background:#0f766e;width:0%;transition:width .3s;"></div>' +
        '</div>' +
        '<div id="kcm-mod-progress-text" style="font-size:12px;color:#64748b;text-align:center;"></div>' +
      '</div>' +
      '<div id="kcm-mod-results" style="display:none;"></div>';

    function setStatus(msg, type) {
      var el = document.getElementById('kcm-mod-status');
      if (!el) return;
      var s = {err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;', ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;', info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'};
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;' + (s[type]||s.info);
      el.innerHTML = msg;
    }

    var parsedRows = [];

    document.getElementById('kcm-mod-file').onchange = async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      document.getElementById('kcm-mod-preview').style.display = 'none';
      document.getElementById('kcm-mod-run').style.display = 'none';
      document.getElementById('kcm-mod-results').style.display = 'none';
      parsedRows = [];

      try {
        await kcm.loadXlsx();
        var buf = await file.arrayBuffer();
        var wb = window.XLSX.read(buf, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var data = window.XLSX.utils.sheet_to_json(ws, {defval:''});

        if (!data.length) throw new Error('El archivo está vacío.');

        // Detectar columnas (case-insensitive)
        var sample = data[0];
        var keys = Object.keys(sample);
        var colId = keys.find(function(k){ return k.toLowerCase().trim() === 'actionid'; });
        var colCode = keys.find(function(k){ return k.toLowerCase().trim() === 'psychocode'; });

        if (!colId || !colCode) throw new Error('No se encontraron columnas "actionId" y "psychoCode". Columnas detectadas: ' + keys.join(', '));

        parsedRows = data.map(function(row, i) {
          return {
            actionId: String(row[colId] || '').trim(),
            psychoCode: String(row[colCode] || '').trim(),
            _row: i + 2
          };
        }).filter(function(r){ return r.actionId && r.psychoCode; });

        if (!parsedRows.length) throw new Error('No hay filas válidas con actionId y psychoCode.');

        var prev = document.getElementById('kcm-mod-preview');
        prev.style.display = 'block';
        prev.innerHTML = '<strong>' + parsedRows.length + ' filas</strong> listas para procesar.<br>' +
          'Primeras 3: ' + parsedRows.slice(0,3).map(function(r){
            return '<code>' + kcm.escHtml(r.actionId) + ' → ' + kcm.escHtml(r.psychoCode) + '</code>';
          }).join(' · ');

        document.getElementById('kcm-mod-run').style.display = 'block';

      } catch(e) {
        setStatus('&#10007; ' + kcm.escHtml(e.message), 'err');
      }
    };

    document.getElementById('kcm-mod-run').onclick = async function() {
      if (!parsedRows.length) return;
      if (!confirm('Se van a modificar ' + parsedRows.length + ' acciones.\n\n¿Continuar?')) return;

      var btn = document.getElementById('kcm-mod-run');
      btn.disabled = true; btn.textContent = '⏳ Procesando...';
      document.getElementById('kcm-mod-progress').style.display = 'block';
      document.getElementById('kcm-mod-results').style.display = 'none';
      setStatus('Procesando...', 'info');

      var ok = [], errors = [];

      for (var i = 0; i < parsedRows.length; i++) {
        var row = parsedRows[i];
        var pct = Math.round((i / parsedRows.length) * 100);
        var bar = document.getElementById('kcm-mod-bar');
        var txt = document.getElementById('kcm-mod-progress-text');
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = (i + 1) + ' / ' + parsedRows.length + ' — actionId ' + row.actionId;

        try {
          var token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
          var res = await fetch('https://api.kymatio.com/v2/admin/mgm/actions/' + encodeURIComponent(row.actionId), {
            method: 'PUT',
            headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
            body: JSON.stringify({psychoCode: row.psychoCode})
          });
          var d = await res.json();
          if (!res.ok) throw new Error((d && d.message) || 'HTTP ' + res.status);
          ok.push({actionId: row.actionId, psychoCode: row.psychoCode, _status: 'OK', _message: ''});
        } catch(e) {
          errors.push({actionId: row.actionId, psychoCode: row.psychoCode, _status: 'ERROR', _message: e.message});
        }
      }

      if (bar) bar.style.width = '100%';
      document.getElementById('kcm-mod-progress').style.display = 'none';

      var type = errors.length === 0 ? 'ok' : (ok.length === 0 ? 'err' : 'info');
      setStatus('&#10003; Completado. OK: <strong>' + ok.length + '</strong> · Errores: <strong>' + errors.length + '</strong>', type);

      // Excel de resultados
      if (ok.length + errors.length > 0) {
        await kcm.loadXlsx();
        var allRows = ok.concat(errors);
        var ws2 = window.XLSX.utils.json_to_sheet(allRows);
        ws2['!cols'] = [{wch:15},{wch:40},{wch:10},{wch:50}];
        var wb2 = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb2, ws2, 'Resultados');
        window.XLSX.writeFile(wb2, 'kymatio_actions_modificar_' + new Date().toISOString().slice(0,10) + '.xlsx');
      }

      kcm.showToast('Completado: ' + ok.length + ' OK, ' + errors.length + ' errores', errors.length ? 'err' : 'ok');
      btn.disabled = false; btn.textContent = '▶ Ejecutar modificaciones';
    };
  }

  // ── Registrar módulos ─────────────────────────────────────────────────────────

  KCM.registerModule({
    key:     'actions_listado',
    label:   'Listado de acciones',
    group:   'acciones',
    icon:    '&#9889;',
    order:   10,
    version: MOD_VERSION,
    render:  renderListado
  });

  KCM.registerModule({
    key:     'actions_modificar_psychocode',
    label:   'Modificar psychoCode',
    group:   'acciones',
    icon:    '&#9998;',
    order:   20,
    version: MOD_VERSION,
    render:  renderModificar
  });

})();
