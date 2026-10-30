(function () {
  'use strict';

  var MOD_VERSION = 'companies-export-v2';

  if (!window.KymatioAdminTools) { console.error('KAT no cargado'); return; }
  var KAT = window.KymatioAdminTools;

  var ROOT_COMPANY_ID = 1; // empresa raíz (HAP): de ahí cuelgan todas

  // ── API: una única llamada ───────────────────────────────────────────────────

  async function fetchCompanies() {
    var token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    var url = 'https://api.kymatio.com/v2/admin/stakeholders/companies/' + ROOT_COMPANY_ID +
              '/companies?tags=true&services=true&environment=true';
    var res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } });
    var d = await res.json();
    if (!res.ok) throw new Error((d && d.message) || 'HTTP ' + res.status);
    return d.records || [];
  }

  async function loadXlsx() {
    if (window.XLSX) return;
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── Transformación: empresas → filas (una columna por servicio) ──────────────

  // Cabeceras de las columnas de servicio: mismos nombres que el módulo Servicios del KAT.
  // Las etiquetas largas se abrevian para que la columna no ocupe media pantalla.
  var SERVICE_LABELS = {
    1: 'Concienciación', 2: 'Bienestar', 3: 'GRI', 4: 'Phishing', 5: 'ABS',
    6: 'Federación (SAML)', 7: 'Neurophishing', 8: 'Burnout', 9: 'SCIM', 10: 'Smishing',
    11: 'Neurosmishing', 12: 'Impacto', 13: 'Ingeniería Social', 14: 'Arquetipo',
    15: 'Ranking', 16: 'Personalización de sesiones', 17: 'Logros', 18: 'Gamificación',
    19: 'HRM', 20: 'MFA', 21: 'Vishing', 22: 'Neurovishing', 23: 'Formación',
    24: 'API_V3', 25: 'SCORM'
  };

  function niceServiceName(name) {
    // GAMING_RANKING → Gaming Ranking
    return String(name).toLowerCase().split('_').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function tagValue(c, tagId) {
    var v = c.tags && c.tags[tagId];
    return Array.isArray(v) ? v.join('; ') : '';
  }

  function buildTable(companies) {
    // Catálogo de servicios sacado de los propios datos (id → nombre)
    var idToName = {};
    // Columnas fijas: todos los servicios conocidos, aunque hoy ninguna empresa los tenga
    Object.keys(SERVICE_LABELS).forEach(function (id) { idToName[id] = SERVICE_LABELS[id]; });
    companies.forEach(function (c) {
      var s = c.services || {};
      (s.list || []).forEach(function (id, i) {
        if (SERVICE_LABELS[id]) return;
        if (s.names && s.names[i]) idToName[id] = s.names[i];
        else if (!idToName[id]) idToName[id] = 'SERVICIO_' + id;
      });
    });
    var serviceIds = Object.keys(idToName).map(Number).sort(function (a, b) { return a - b; });

    var rows = companies.map(function (c) {
      var env   = c.environment || {};
      var lang  = env.languages || {};
      var notif = env.notifications || {};
      var per   = notif.period || {};
      var active = (c.services && c.services.list) || [];

      var row = {
        'ID':                     c.stakeholderId,
        'Empresa':                c.name || '',
        'Relación':               c.relationShip || '',
        'Subdominio':             c.subdomain || '',
        'Usuarios':               c.peopleCount || 0,
        'Departamentos':          c.departmentsCount || 0,
        'Sector':                 tagValue(c, 9),
        'Tipo de entidad':        tagValue(c, 10),
        'Federada':               c.federatedCompany ? 'Sí' : 'No',
        'Zona horaria':           env.timezone || '',
        'Idioma por defecto':     lang.default || '',
        'Idiomas':                (lang.list || []).join(', '),
        'Envío de emails':        notif.sendemail === 'YES' ? 'Sí' : (notif.sendemail === 'NO' ? 'No' : (notif.sendemail || '')),
        'Periodo notif. usuario': per.user != null ? per.user : '',
        'Periodo notif. manager': per.manager != null ? per.manager : ''
      };
      serviceIds.forEach(function (id) {
        row[SERVICE_LABELS[id] || niceServiceName(idToName[id])] = active.indexOf(id) >= 0 ? '✓' : '';
      });
      return row;
    });

    rows.sort(function (a, b) { return String(a['Empresa']).localeCompare(String(b['Empresa']), 'es', { sensitivity: 'base' }); });
    return { rows: rows, serviceIds: serviceIds, idToName: idToName };
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function renderGui(container, kat) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kat.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#0369a1;line-height:1.7">' +
        'Descarga un Excel con <strong>todas las empresas</strong> de la plataforma usando <strong>una sola llamada</strong> a la API.<br>' +
        '<span style="font-size:12px;">Incluye: ID, empresa, relación, subdominio, usuarios, departamentos, sector, tipo de entidad, federada, zona horaria, idiomas, notificaciones y una columna por servicio (✓ si está activo).</span>' +
      '</div>' +
      '<button id="kat-ce-run" style="width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Descargar listado de empresas</button>' +
      '<div id="kat-ce-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +
      '<div id="kat-ce-summary" style="display:none;background:#f0fff4;border:1px solid #9ae6b4;border-radius:8px;padding:12px;font-size:13px;color:#276749;line-height:1.7;"></div>';

    function setStatus(msg, type) {
      var el = document.getElementById('kat-ce-status');
      if (!el) return;
      var s = {
        err:  'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;',
        ok:   'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;',
        info: 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'
      };
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;' + (s[type] || s.info);
      el.innerHTML = msg;
    }

    document.getElementById('kat-ce-run').onclick = async function () {
      var btn = document.getElementById('kat-ce-run');
      btn.disabled = true; btn.textContent = '⏳ Descargando...';
      document.getElementById('kat-ce-summary').style.display = 'none';
      setStatus('Pidiendo el listado de empresas...', 'info');

      try {
        var companies = await fetchCompanies();
        if (!companies.length) throw new Error('La API no devolvió empresas.');

        var table = buildTable(companies);
        var rows = table.rows;

        setStatus('Generando Excel con ' + rows.length + ' empresas...', 'info');
        await loadXlsx();

        var ws = window.XLSX.utils.json_to_sheet(rows);
        var cols = Object.keys(rows[0]);
        ws['!cols'] = cols.map(function (col) {
          var max = col.length;
          rows.forEach(function (r) { var v = String(r[col] == null ? '' : r[col]); if (v.length > max) max = v.length; });
          return { wch: Math.min(max + 2, 45) };
        });
        ws['!autofilter'] = { ref: ws['!ref'] };

        var wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
        var today = new Date().toISOString().slice(0, 10);
        window.XLSX.writeFile(wb, 'kymatio_empresas_' + today + '.xlsx');

        var customers = rows.filter(function (r) { return r['Relación'] === 'CUSTOMER'; }).length;
        var resellers = rows.filter(function (r) { return r['Relación'] === 'RESELLER'; }).length;
        var users = rows.reduce(function (s, r) { return s + (r['Usuarios'] || 0); }, 0);

        setStatus('&#10003; Excel descargado: ' + rows.length + ' empresas.', 'ok');
        var sum = document.getElementById('kat-ce-summary');
        sum.style.display = 'block';
        sum.innerHTML =
          '<strong>&#10003; Descarga completada</strong><br>' +
          'Empresas: <strong>' + rows.length + '</strong> (' + customers + ' CUSTOMER · ' + resellers + ' RESELLER)<br>' +
          'Usuarios totales: <strong>' + users.toLocaleString('es-ES') + '</strong><br>' +
          'Servicios como columnas: <strong>' + table.serviceIds.length + '</strong>';
        kat.showToast('Excel descargado — ' + rows.length + ' empresas', 'ok');

      } catch (e) {
        setStatus('&#10007; Error: ' + kat.escHtml(e.message), 'err');
        kat.showToast('Error: ' + e.message, 'err');
      }

      btn.disabled = false;
      btn.textContent = '▶ Descargar listado de empresas';
    };
  }

  KAT.registerModule({
    key:          'companies_export',
    label:        'Descargar listado de empresas',
    group:        'bulk',
    icon:         '&#127970;',
    order:        70,
    version:      MOD_VERSION,
    renderGui:    renderGui,
    forceGuiOnly: true
  });

})();
