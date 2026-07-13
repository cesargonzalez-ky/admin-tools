(function () {
  'use strict';

  var MOD_VERSION = 'assets-v4';

  if (!window.KymatioContentManagement) {
    console.error('KCM: core no cargado');
    return;
  }

  var KCM = window.KymatioContentManagement;

  // ── Utilidades ───────────────────────────────────────────────────────────────

  function getTitleEs(asset) {
    // Con locale=es-es la API devuelve el link ya en español en asset.link
    // Fallback al dictionary por si acaso
    if (asset.link) return asset.link;
    try {
      var esEs = asset.asset && asset.asset.dictionary && asset.asset.dictionary['es-es'];
      if (esEs && esEs.default && esEs.default.link) return esEs.default.link;
    } catch(e) {}
    return '';
  }

  async function fetchCompanyMap() {
    var r = await KCM.apiGet('admin/stakeholders/companies/1/companies', {fiscalCode: false, tags: false, services: false});
    var map = {};
    (r.records || []).forEach(function(c) {
      map[String(c.stakeholderId)] = c.name || '';
    });
    // Incluir empresa raíz (id=1, HAP)
    map['1'] = 'HAP';
    return map;
  }

  async function fetchAllAssets(onProgress) {
    var all = [];
    var seen = {};
    var pageSize = 100;
    var PARAMS_BASE = { limit: pageSize, sortBy: 'assetId', order: 'asc', locale: 'es-es' };

    async function fetchPages(extraParams, label) {
      var page = 1;
      var totalPages = null;
      while (true) {
        var params = Object.assign({}, PARAMS_BASE, extraParams, { page: page });
        var r = await KCM.apiGet('admin/mgm/assets', params);
        var records = r.records || [];
        // Leer totalPages de la respuesta real (la API puede ignorar el limit pedido)
        var meta = r._meta && r._meta.pagination;
        if (meta && meta.totalPages && totalPages === null) totalPages = meta.totalPages;
        var realLimit = (meta && meta.limit) || pageSize;
        records.forEach(function(a) {
          if (!seen[a.assetId]) {
            seen[a.assetId] = true;
            all.push(a);
          }
        });
        if (onProgress) onProgress(all.length, label);
        // Parar cuando llegamos a la última página según la API
        if (!records.length) break;
        if (totalPages !== null && page >= totalPages) break;
        if (totalPages === null && records.length < realLimit) break;
        page++;
      }
    }

    await fetchPages({ isActive: true }, 'activos');
    await fetchPages({ isActive: false }, 'inactivos');

    return all;
  }

  function buildRows(assets, companyMap) {
    return assets.map(function(a) {
      var langs = '';
      try {
        if (a.asset && a.asset.dictionary) langs = Object.keys(a.asset.dictionary).sort().join(', ');
      } catch(e) {}
      var companyId = a.stakeholderCompanyId || '';
      var companyName = (companyMap && companyId && companyMap[String(companyId)]) || '';
      return {
        'assetId':             a.assetId,
        'psychoCode':          a.psychoCode || '',
        'Título (es-es)':      getTitleEs(a),
        'Organización':        companyName,
        'organizationId':      companyId,
        'family':              a.family || '',
        'type':                a.type || '',
        'assetsCount':         a.assetsCount != null ? a.assetsCount : '',
        'Idiomas disponibles': langs,
        'status':              a.status || ''
      };
    });
  }

  function exportExcel(assets, companyMap) {
    var rows = buildRows(assets, companyMap);
    var ws = window.XLSX.utils.json_to_sheet(rows);
    var cols = Object.keys(rows[0] || {});
    ws['!cols'] = cols.map(function(col) {
      var max = col.length;
      rows.forEach(function(r){ var v = String(r[col] || ''); if (v.length > max) max = v.length; });
      return { wch: Math.min(max + 2, 80) };
    });

    var wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Assets');

    var resumen = [
      ['Campo', 'Valor'],
      ['Fecha exportación', new Date().toISOString().slice(0,19).replace('T',' ')],
      ['Total assets', assets.length],
      ['READY', assets.filter(function(a){ return a.status === 'READY'; }).length],
      ['PENDING', assets.filter(function(a){ return a.status === 'PENDING'; }).length],
      ['Otros', assets.filter(function(a){ return a.status !== 'READY' && a.status !== 'PENDING'; }).length]
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(resumen), 'Resumen');

    window.XLSX.writeFile(wb, 'kymatio_assets_' + new Date().toISOString().slice(0,10) + '.xlsx');
  }

  // ── Render del módulo ─────────────────────────────────────────────────────────

  function render(container, kcm) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kcm.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#0369a1;line-height:1.6">' +
        'Exporta <strong>todos los assets</strong> de la plataforma (activos e inactivos).<br>' +
        'El título se obtiene en <strong>español (es-es)</strong> cuando está disponible.' +
      '</div>' +

      '<div id="kcm-assets-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +

      '<div id="kcm-assets-progress" style="display:none;margin-bottom:12px;">' +
        '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px;">' +
          '<div id="kcm-assets-bar" style="height:100%;background:#1e293b;width:0%;transition:width .3s;"></div>' +
        '</div>' +
        '<div id="kcm-assets-progress-text" style="font-size:12px;color:#64748b;text-align:center;"></div>' +
      '</div>' +

      '<button id="kcm-assets-run" style="width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Descargar Excel de assets</button>' +

      '<div id="kcm-assets-summary" style="display:none;background:#f0fff4;border:1px solid #9ae6b4;border-radius:8px;padding:12px;font-size:13px;color:#276749;"></div>';

    function setStatus(msg, type) {
      var el = document.getElementById('kcm-assets-status');
      if (!el) return;
      var styles = {
        err:  'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;',
        ok:   'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;',
        info: 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'
      };
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;' + (styles[type] || styles.info);
      el.innerHTML = msg;
    }

    document.getElementById('kcm-assets-run').onclick = async function() {
      var runBtn = document.getElementById('kcm-assets-run');
      runBtn.disabled = true;
      runBtn.textContent = '⏳ Cargando...';
      document.getElementById('kcm-assets-progress').style.display = 'block';
      document.getElementById('kcm-assets-summary').style.display = 'none';
      setStatus('Cargando assets...', 'info');

      try {
        setStatus('Cargando mapa de organizaciones...', 'info');
        var companyMap = await fetchCompanyMap();
        setStatus('Cargando assets...', 'info');
        var assets = await fetchAllAssets(function(count, tipo) {
          var bar = document.getElementById('kcm-assets-bar');
          var txt = document.getElementById('kcm-assets-progress-text');
          if (bar) bar.style.width = Math.min(count / 3, 90) + '%';
          if (txt) txt.textContent = count + ' assets cargados (' + tipo + ')...';
        });

        if (!assets.length) throw new Error('No se encontraron assets.');

        var bar = document.getElementById('kcm-assets-bar');
        var txt = document.getElementById('kcm-assets-progress-text');
        if (bar) bar.style.width = '100%';
        if (txt) txt.textContent = 'Total: ' + assets.length + ' assets. Generando Excel...';
        setStatus('Generando Excel...', 'info');

        await kcm.loadXlsx();
        exportExcel(assets, companyMap);

        document.getElementById('kcm-assets-progress').style.display = 'none';
        setStatus('&#10003; Excel descargado. ' + assets.length + ' assets exportados.', 'ok');

        var ready    = assets.filter(function(a){ return a.status === 'READY'; }).length;
        var pending  = assets.filter(function(a){ return a.status === 'PENDING'; }).length;
        var otros    = assets.length - ready - pending;
        var sumEl = document.getElementById('kcm-assets-summary');
        sumEl.style.display = 'block';
        sumEl.innerHTML =
          '<strong>&#10003; Exportación completada</strong><br>' +
          'Total: <strong>' + assets.length + '</strong> assets &nbsp;|&nbsp; ' +
          'READY: <strong>' + ready + '</strong> &nbsp;|&nbsp; ' +
          'PENDING: <strong>' + pending + '</strong>' +
          (otros ? ' &nbsp;|&nbsp; Otros: <strong>' + otros + '</strong>' : '');

        kcm.showToast('Excel descargado — ' + assets.length + ' assets', 'ok');

      } catch(e) {
        document.getElementById('kcm-assets-progress').style.display = 'none';
        setStatus('&#10007; Error: ' + kcm.escHtml(e.message), 'err');
        kcm.showToast('Error: ' + e.message, 'err');
      }

      runBtn.disabled = false;
      runBtn.textContent = '▶ Descargar Excel de assets';
    };
  }

  // ── Registrar módulo ──────────────────────────────────────────────────────────

  KCM.registerModule({
    key:   'assets_listado',
    label: 'Listado de assets',
    group: 'assets',
    icon:  '&#128230;',
    order: 10,
    version: MOD_VERSION,
    render: render
  });

})();
