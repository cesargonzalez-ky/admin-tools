(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  var VERSION = 'admin-profile-audit-01-all-companies';
  var ROOT_COMPANY_ID = 1;
  var COMPANY_CONCURRENCY = 5;
  var USERS_QUERY = 'login=true&environment=true&email=true';

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
      alert('No se pudo cargar la libreria XLSX. Revisa la consola o la conexion.');
    };
    document.head.appendChild(s);
  }

  function renderGui(container, tools) {
    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando herramienta...</div>';

    loadXlsx(function () {
      buildPanel(container, tools);
    });
  }

  function buildPanel(container, tools) {
    var escHtml = tools.escHtml;
    var token = getToken(tools);
    var companies = [];
    var resultRows = [];
    var errorRows = [];
    var summary = null;
    var running = false;
    var cancelRequested = false;
    var companiesLoaded = false;

    function getToken(toolsRef) {
      return (toolsRef.state && toolsRef.state.token) || localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    }

    function getApiBase() {
      var host = String(window.location.hostname || '').toLowerCase();
      if (host.indexOf('dev') >= 0 || host.indexOf('api-dev') >= 0 || host.indexOf('kymatio.xyz') >= 0) {
        return 'https://api-dev.kymatio.xyz/v2';
      }
      return 'https://api.kymatio.com/v2';
    }

    var apiBase = getApiBase();

    function apiHeaders() {
      token = getToken(tools);
      return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      };
    }

    async function apiGet(path) {
      var url = apiBase + path;
      var res = await fetch(url, {
        method: 'GET',
        headers: apiHeaders(),
        credentials: 'include'
      });

      var text = await res.text();
      var json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        json = { raw: text };
      }

      if (!res.ok) {
        var msg = 'HTTP ' + res.status;
        if (json && json.message) msg += ' - ' + json.message;
        throw new Error(msg);
      }

      return json;
    }

    function setStatus(html, type) {
      var el = document.getElementById('kym-apa-status');
      if (!el) return;
      var bg = type === 'err' ? '#fff5f5' : type === 'ok' ? '#f0fff4' : '#f8fafc';
      var border = type === 'err' ? '#fed7d7' : type === 'ok' ? '#9ae6b4' : '#e2e8f0';
      var color = type === 'err' ? '#c53030' : type === 'ok' ? '#276749' : '#475569';
      el.style.cssText = 'font-size:12px;color:' + color + ';margin-bottom:12px;padding:10px 12px;background:' + bg + ';border:1px solid ' + border + ';border-radius:8px;min-height:38px;line-height:1.45';
      el.innerHTML = html;
    }

    function setProgress(done, total, label) {
      var wrap = document.getElementById('kym-apa-progress-wrap');
      var bar = document.getElementById('kym-apa-progress-bar');
      var txt = document.getElementById('kym-apa-progress-text');
      if (!wrap || !bar || !txt) return;

      var pct = total ? Math.round((done / total) * 100) : 0;
      wrap.style.display = total ? 'block' : 'none';
      bar.style.width = pct + '%';
      txt.textContent = (label || 'Procesando') + ': ' + done + ' / ' + total + ' (' + pct + '%)';
    }

    function getRecords(json) {
      if (!json) return [];
      if (Array.isArray(json.records)) return json.records;
      if (Array.isArray(json)) return json;
      if (json.data && Array.isArray(json.data.records)) return json.data.records;
      if (json.data && Array.isArray(json.data)) return json.data;
      return [];
    }

    function normalizeCompany(c) {
      var id = String(c && (c.stakeholderId || c.companyId || c.id || '') || '');
      return {
        id: id,
        name: String(c && (c.name || c.companyName || c.stakeholderName || '') || ''),
        relationShip: String(c && (c.relationShip || c.relationship || '') || ''),
        tags: c && c.tags ? c.tags : {},
        raw: c
      };
    }

    function tagList(tags) {
      var out = [];
      if (!tags || typeof tags !== 'object') return out;
      Object.keys(tags).forEach(function (key) {
        var value = tags[key];
        if (Array.isArray(value)) {
          value.forEach(function (v) {
            var s = String(v == null ? '' : v).trim();
            if (s && out.indexOf(s) < 0) out.push(s);
          });
        } else {
          var s = String(value == null ? '' : value).trim();
          if (s && out.indexOf(s) < 0) out.push(s);
        }
      });
      return out;
    }

    function getCompanyType(company) {
      var values = tagList(company.tags);
      return values.join(', ');
    }

    function containsCompanyId(list, companyId) {
      if (!Array.isArray(list)) return false;
      var target = String(companyId);
      return list.some(function (x) {
        return String(x) === target;
      });
    }

    function getValidProfiles(user, companyId) {
      var profiles = user && user.profiles ? user.profiles : {};
      var valid = [];
      if (containsCompanyId(profiles.ADMIN, companyId)) valid.push('ADMIN');
      if (containsCompanyId(profiles.CONTROLLER, companyId)) valid.push('CONTROLLER');
      return valid;
    }

    function getLanguage(user) {
      return String(
        user && user.environment && user.environment.languages && user.environment.languages.default ||
        user && user.locale ||
        user && user.language ||
        ''
      );
    }

    function buildResultRow(user, company, profiles) {
      return {
        Nombre: String(user.name || ''),
        Apellidos: String(user.surname || user.lastName || ''),
        Email: String(user.email || user.login || ''),
        Perfiles: profiles.join(', '),
        Idioma: getLanguage(user),
        'Nombre de empresa': company.name,
        'Tipo de Empresa': getCompanyType(company)
      };
    }

    function setButtonsState() {
      var btnLoad = document.getElementById('kym-apa-load-companies');
      var btnRun = document.getElementById('kym-apa-run');
      var btnCancel = document.getElementById('kym-apa-cancel');
      var btnDownload = document.getElementById('kym-apa-download');

      if (btnLoad) btnLoad.disabled = running;
      if (btnRun) btnRun.disabled = running || !companiesLoaded;
      if (btnCancel) btnCancel.disabled = !running;
      if (btnDownload) btnDownload.disabled = running || !resultRows.length;

      if (btnRun) btnRun.style.opacity = btnRun.disabled ? '.45' : '1';
      if (btnDownload) btnDownload.style.opacity = btnDownload.disabled ? '.45' : '1';
      if (btnCancel) btnCancel.style.opacity = btnCancel.disabled ? '.45' : '1';
    }

    function renderCompaniesInfo() {
      var el = document.getElementById('kym-apa-companies-info');
      if (!el) return;
      if (!companiesLoaded) {
        el.innerHTML = 'Todavia no se ha cargado el listado de empresas.';
        return;
      }
      el.innerHTML = '<b>' + companies.length + '</b> empresas cargadas. Se excluye la empresa raiz HAP/1.';
    }

    function renderSummary() {
      var el = document.getElementById('kym-apa-summary');
      if (!el) return;

      if (!summary) {
        el.innerHTML = '';
        return;
      }

      function card(label, value) {
        return '<div style="background:white;border:1px solid #e2e8f0;border-radius:9px;padding:10px 12px">' +
          '<div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.4px">' + escHtml(label) + '</div>' +
          '<div style="font-size:20px;color:#0f172a;font-weight:800;margin-top:2px">' + escHtml(value) + '</div>' +
          '</div>';
      }

      el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">' +
        card('Empresas analizadas', summary.companiesAnalyzed) +
        card('Usuarios analizados', summary.usersAnalyzed) +
        card('Con ADMIN', summary.adminUsers) +
        card('Con CONTROLLER', summary.controllerUsers) +
        card('Con ambos', summary.bothUsers) +
        card('Errores', summary.errors) +
        '</div>' +
        '<div style="font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px">' +
        'Filas para Excel: <b>' + resultRows.length + '</b>' +
        '</div>';
    }

    async function loadCompanies() {
      if (running) return;
      running = true;
      cancelRequested = false;
      companiesLoaded = false;
      companies = [];
      resultRows = [];
      errorRows = [];
      summary = null;
      setButtonsState();
      renderSummary();
      renderCompaniesInfo();
      setProgress(0, 0, '');
      setStatus('Cargando listado de empresas...', 'info');

      try {
        var json = await apiGet('/admin/stakeholders/companies/' + ROOT_COMPANY_ID + '/companies');
        companies = getRecords(json)
          .map(normalizeCompany)
          .filter(function (c) {
            return c.id && String(c.id) !== String(ROOT_COMPANY_ID);
          });

        companies.sort(function (a, b) {
          return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
        });

        companiesLoaded = true;
        setStatus('Listado de empresas cargado correctamente: <b>' + companies.length + '</b> empresas.', 'ok');
      } catch (e) {
        setStatus('Error cargando empresas: ' + escHtml(e.message), 'err');
      } finally {
        running = false;
        setButtonsState();
        renderCompaniesInfo();
      }
    }

    async function loadUsersForCompany(company) {
      var path = '/admin/stakeholders/companies/' + encodeURIComponent(company.id) + '/people?' + USERS_QUERY;
      var json = await apiGet(path);
      return getRecords(json);
    }

    async function processCompany(company, counters) {
      try {
        var users = await loadUsersForCompany(company);
        counters.usersAnalyzed += users.length;

        users.forEach(function (user) {
          var profiles = getValidProfiles(user, company.id);
          if (!profiles.length) return;

          if (profiles.indexOf('ADMIN') >= 0) counters.adminUsers += 1;
          if (profiles.indexOf('CONTROLLER') >= 0) counters.controllerUsers += 1;
          if (profiles.indexOf('ADMIN') >= 0 && profiles.indexOf('CONTROLLER') >= 0) counters.bothUsers += 1;

          resultRows.push(buildResultRow(user, company, profiles));
        });
      } catch (e) {
        counters.errors += 1;
        errorRows.push({
          Empresa: company.name,
          companyId: company.id,
          Error: e.message
        });
      }
    }

    async function runAudit() {
      if (running) return;
      if (!companiesLoaded) {
        setStatus('Primero carga el listado de empresas.', 'err');
        return;
      }

      running = true;
      cancelRequested = false;
      resultRows = [];
      errorRows = [];
      summary = null;
      setButtonsState();
      renderSummary();
      setStatus('Analizando empresas...', 'info');

      var counters = {
        companiesAnalyzed: 0,
        usersAnalyzed: 0,
        adminUsers: 0,
        controllerUsers: 0,
        bothUsers: 0,
        errors: 0
      };

      var index = 0;
      var total = companies.length;
      setProgress(0, total, 'Empresas analizadas');

      async function worker() {
        while (index < total && !cancelRequested) {
          var currentIndex = index++;
          var company = companies[currentIndex];
          await processCompany(company, counters);
          counters.companiesAnalyzed += 1;
          setProgress(counters.companiesAnalyzed, total, 'Empresas analizadas');
        }
      }

      var workers = [];
      var workerCount = Math.min(COMPANY_CONCURRENCY, total || 1);
      for (var i = 0; i < workerCount; i++) workers.push(worker());

      try {
        await Promise.all(workers);
      } finally {
        running = false;
        summary = counters;
        resultRows.sort(function (a, b) {
          var c = String(a['Nombre de empresa'] || '').localeCompare(String(b['Nombre de empresa'] || ''), 'es', { sensitivity: 'base' });
          if (c !== 0) return c;
          return String(a.Email || '').localeCompare(String(b.Email || ''), 'es', { sensitivity: 'base' });
        });

        renderSummary();
        setButtonsState();

        if (cancelRequested) {
          setStatus('Analisis detenido. Puedes descargar el resultado parcial si hay filas.', 'err');
        } else {
          setStatus('Analisis finalizado. Usuarios encontrados: <b>' + resultRows.length + '</b>.', 'ok');
        }
      }
    }

    function autoFitWorksheet(ws, rows) {
      if (!ws || !rows || !rows.length) return;
      var headers = Object.keys(rows[0]);
      ws['!cols'] = headers.map(function (h) {
        var max = String(h).length;
        rows.forEach(function (r) {
          max = Math.max(max, String(r[h] == null ? '' : r[h]).length);
        });
        return { wch: Math.min(Math.max(max + 2, 12), 60) };
      });
    }

    function downloadExcel() {
      if (!resultRows.length) return;

      var wb = XLSX.utils.book_new();
      var wsMain = XLSX.utils.json_to_sheet(resultRows);
      autoFitWorksheet(wsMain, resultRows);
      XLSX.utils.book_append_sheet(wb, wsMain, 'Perfiles Admin Controller');

      var summaryRows = summary ? [
        { Metrica: 'Empresas analizadas', Valor: summary.companiesAnalyzed },
        { Metrica: 'Usuarios analizados', Valor: summary.usersAnalyzed },
        { Metrica: 'Usuarios con ADMIN', Valor: summary.adminUsers },
        { Metrica: 'Usuarios con CONTROLLER', Valor: summary.controllerUsers },
        { Metrica: 'Usuarios con ambos perfiles', Valor: summary.bothUsers },
        { Metrica: 'Errores', Valor: summary.errors },
        { Metrica: 'Version', Valor: VERSION },
        { Metrica: 'API base', Valor: apiBase }
      ] : [];
      var wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      autoFitWorksheet(wsSummary, summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

      if (errorRows.length) {
        var wsErrors = XLSX.utils.json_to_sheet(errorRows);
        autoFitWorksheet(wsErrors, errorRows);
        XLSX.utils.book_append_sheet(wb, wsErrors, 'Errores');
      }

      XLSX.writeFile(wb, 'auditoria_perfiles_admin_controller_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    }

    function buildHtml() {
      var h = '';

      h += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;margin-bottom:14px">';
      h += '<div style="display:flex;align-items:center;gap:10px">';
      h += '<div style="font-size:22px">&#128272;</div>';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Auditoria global</div>';
      h += '<div style="font-size:16px;font-weight:800;color:#1e40af">Perfiles ADMIN / CONTROLLER</div>';
      h += '<div style="font-size:10px;color:#64748b">Version: ' + escHtml(VERSION) + ' · API: ' + escHtml(apiBase) + '</div>';
      h += '</div>';
      h += '</div>';
      h += '</div>';

      h += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:12px;color:#475569;font-size:12px;line-height:1.5">';
      h += 'Revisa todas las empresas devueltas por ADMIN y genera un Excel con usuarios cuyo perfil ADMIN o CONTROLLER aplique a la empresa analizada. No incluye la empresa raiz HAP/1.';
      h += '</div>';

      h += '<div id="kym-apa-status"></div>';

      h += '<div id="kym-apa-companies-info" style="font-size:12px;color:#475569;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:12px"></div>';

      h += '<div id="kym-apa-progress-wrap" style="display:none;margin-bottom:12px">';
      h += '<div id="kym-apa-progress-text" style="font-size:11px;color:#64748b;margin-bottom:5px"></div>';
      h += '<div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden"><div id="kym-apa-progress-bar" style="height:8px;width:0%;background:#2563eb;border-radius:999px"></div></div>';
      h += '</div>';

      h += '<div id="kym-apa-summary" style="margin-bottom:12px"></div>';

      h += '<button id="kym-apa-load-companies" style="width:100%;background:#2563eb;color:white;border:none;padding:10px;border-radius:7px;font-weight:800;cursor:pointer;font-size:13px;margin-bottom:8px">&#8635; Actualizar listado de empresas</button>';
      h += '<button id="kym-apa-run" disabled style="width:100%;background:#0f766e;color:white;border:none;padding:10px;border-radius:7px;font-weight:800;cursor:pointer;font-size:13px;margin-bottom:8px;opacity:.45">&#9658; Analizar todas las empresas</button>';
      h += '<button id="kym-apa-cancel" disabled style="width:100%;background:white;color:#b91c1c;border:1px solid #fecaca;padding:9px;border-radius:7px;font-weight:700;cursor:pointer;font-size:12px;margin-bottom:8px;opacity:.45">Detener analisis</button>';
      h += '<button id="kym-apa-download" disabled style="width:100%;background:#111827;color:white;border:none;padding:10px;border-radius:7px;font-weight:800;cursor:pointer;font-size:13px;opacity:.45">&#8595; Descargar Excel</button>';

      return h;
    }

    container.innerHTML = buildHtml();

    document.getElementById('kym-apa-load-companies').addEventListener('click', loadCompanies);
    document.getElementById('kym-apa-run').addEventListener('click', runAudit);
    document.getElementById('kym-apa-cancel').addEventListener('click', function () {
      cancelRequested = true;
      setStatus('Deteniendo analisis al terminar las empresas en curso...', 'err');
    });
    document.getElementById('kym-apa-download').addEventListener('click', downloadExcel);

    setStatus('Pulsa "Actualizar listado de empresas" para empezar.', 'info');
    renderCompaniesInfo();
    setButtonsState();
  }

  KAT.registerModule({
    key: 'admin_profile_audit',
    label: 'Auditoria perfiles Admin/Controller',
    icon: '&#128272;',
    group: 'bulk',
    order: 66,
    renderGui: renderGui
  });
})();
