(function () {
  'use strict';

  var VERSION = '2026-06-23-bulk-report-01';

  var MODULE_FILES = [
    'kymatio_admin_tools_services.js',
    'kymatio_admin_tools_languages.js',
    'kymatio_admin_tools_phishing_domains.js',
    'kymatio_admin_tools_phishing_attachments.js',
    'kymatio_admin_tools_phishing_landings.js',
    'kymatio_admin_tools_bulk_email_login.js',
    'kymatio_admin_tools_bulk_move_users.js',
    'kymatio_admin_tools_bulk_resurrection.js',
    'kymatio_admin_tools_bulk_loader.js',
    'kymatio_admin_tools_bulk_delete_users.js',
    'kymatio_admin_tools_bulk_user_dept_report.js',
    'kymatio_admin_tools_user_search.js',
    'kymatio_admin_tools_vishing_templates.js'
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeJsonClone(obj) {
    return JSON.parse(JSON.stringify(obj == null ? null : obj));
  }

  function setStatus(el, msg, type) {
    if (!el) return;

    var styles = {
      err: 'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;',
      ok: 'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;',
      info: 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'
    };

    el.style.cssText =
      'display:block;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;' +
      (styles[type] || styles.info);

    el.innerHTML = msg;
  }

  function showToast(message, type) {
    var old = $('kym-adm-toast');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.id = 'kym-adm-toast';
    toast.textContent = message;
    toast.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:1000002;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.18);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' +
      (type === 'err'
        ? 'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;'
        : type === 'ok'
          ? 'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;'
          : 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;');

    document.body.appendChild(toast);

    setTimeout(function () {
      if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3500);
  }

  function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('access_token') || '';
  }

  function getCurrentCompanyFromVue() {
    try {
      var app = document.querySelector('#app');
      var company = app.__vue_app__.config.globalProperties.$store.state.Admin.companySelected;
      return {
        id: String(company.stakeholderId || ''),
        name: company.name || ''
      };
    } catch (e) {
      return {
        id: '',
        name: ''
      };
    }
  }

  function getBaseUrl() {
    var script = document.currentScript;
    var src = script && script.src ? script.src : '';

    if (!src) {
      return 'https://cdn.jsdelivr.net/gh/cesargonzalez-ky/admin-tools@main/';
    }

    var clean = src.split('?')[0].split('#')[0];
    return clean.substring(0, clean.lastIndexOf('/') + 1);
  }

  function loadScript(url) {
    var fullUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    return fetch(fullUrl)
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function(moduleCode) {
        try {
          // eval en el scope global para que window.KymatioAdminTools sea accesible
          var script = document.createElement('script');
          script.textContent = moduleCode;
          document.head.appendChild(script);
          return { ok: true, url: url };
        } catch(e) {
          console.error('KAT: error ejecutando modulo', url, e.message);
          return { ok: false, url: url, error: e.message };
        }
      })
      .catch(function(e) {
        console.error('KAT: no se pudo cargar modulo', url, e.message);
        return { ok: false, url: url, error: e.message };
      });
  }

  var existing = $('kym-admin-panel');
  if (existing) existing.parentNode.removeChild(existing);

  var companyInfo = getCurrentCompanyFromVue();

  var state = {
    version: VERSION,
    baseUrl: getBaseUrl(),
    token: getToken(),
    companyId: companyInfo.id,
    companyName: companyInfo.name,
    companyData: null,
    currentSection: null,
    guiMode: true,
    panel: null,
    modules: [],
    modulesMap: {},
    activeGroup: 'config'
  };

  var KAT = {
    state: state,
    $: $,
    escHtml: escHtml,
    safeJsonClone: safeJsonClone,
    setStatus: setStatus,
    showToast: showToast,
    registerModule: registerModule,
    loadCompanyData: loadCompanyData,
    putCompanyPayload: putCompanyPayload,
    resetActionPanels: resetActionPanels,
    renderCurrentGui: renderCurrentGui,
    selectSection: selectSection,
    updateCompanyBanner: updateCompanyBanner
  };

  window.KymatioAdminTools = KAT;

  function registerModule(mod) {
    if (!mod || !mod.key) return;
    if (!mod.group) mod.group = 'config';

    state.modulesMap[mod.key] = mod;

    var replaced = false;
    state.modules = state.modules.map(function (m) {
      if (m.key === mod.key) {
        replaced = true;
        return mod;
      }
      return m;
    });

    if (!replaced) state.modules.push(mod);

    // If modules are registered after the panel is already visible, repaint the section buttons.
    try {
      if (state.panel && document.getElementById('kym-adm-sections')) renderSectionButtons();
    } catch (e) {
      console.warn('Kymatio Admin Tools: could not repaint section buttons', e);
    }
  }

  function registerBuiltinModules() {
    registerModule({
      key: 'surveyflow',
      label: 'Surveyflow',
      group: 'config',
      icon: '&#128200;',
      order: 20,
      getJson: function (d) {
        return {
          journey: {
            surveyflow: d.journey && d.journey.surveyflow
          }
        };
      },
      chatgptUrl: 'https://chatgpt.com/g/g-p-69b2862052e081918097b93ab359f603/c/6a3259aa-3cb8-832d-92e0-6cdc22a46eee'
    });

    registerModule({
      key: 'phish_land',
      label: 'Phishing: Post-landings',
      group: 'config',
      icon: '&#128279;',
      order: 60,
      getJson: function (d) {
        return {
          servicesConfiguration: {
            phishing: {
              landingRedirect:
                d.servicesConfiguration &&
                d.servicesConfiguration.phishing &&
                d.servicesConfiguration.phishing.landingRedirect
            }
          }
        };
      }
    });
  }

  function apiHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + state.token
    };
  }

  async function loadCompanyData(force) {
    if (state.companyData && !force) return state.companyData;

    if (!state.companyId) {
      throw new Error('No se ha podido detectar la empresa activa. Selecciona una empresa y pulsa “Actualizar empresa y datos”.');
    }

    if (!state.token) {
      throw new Error('No se ha encontrado token en localStorage. Asegúrate de estar logado en Kymatio.');
    }

    var url =
      'https://api.kymatio.com/v2/admin/stakeholders/companies/' +
      encodeURIComponent(state.companyId) +
      '?environment=true&journey=true&services=true';

    var res = await fetch(url, {
      headers: apiHeaders()
    });

    var d = await res.json();

    if (!res.ok) {
      throw new Error((d && (d.message || (d.records && d.records.devMessage))) || 'Error HTTP ' + res.status);
    }

    state.companyData = d.records || d;
    return state.companyData;
  }

  async function putCompanyPayload(payload) {
    if (!state.companyId) throw new Error('No hay empresa activa.');
    if (!state.token) throw new Error('No hay token.');

    var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(state.companyId), {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify(payload)
    });

    var rdata = null;
    try {
      rdata = await res.json();
    } catch (e) {}

    if (!res.ok) {
      throw new Error(
        (rdata && rdata.records && rdata.records.devMessage) ||
          (rdata && rdata.message) ||
          'Error HTTP ' + res.status
      );
    }

    state.companyData = null;
    return rdata;
  }

  function createPanel() {
    // Cargar Tabler Icons si no están ya
    if (!document.getElementById('kym-tabler-icons')) {
      var link = document.createElement('link');
      link.id = 'kym-tabler-icons';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css';
      document.head.appendChild(link);
    }
    var div = document.createElement('div');
    div.id = 'kym-admin-panel';
    div.style.cssText = 'position:fixed;top:0;right:0;width:calc(96px + 50vw);height:100vh;z-index:2147483647;display:flex;flex-direction:row;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:13px;color:#1a202c;box-shadow:-4px 0 24px rgba(0,0,0,.25);';

    // ── Sidebar (iconos + texto) ──────────────────────────────────────────────
    var sidebar = document.createElement('div');
    sidebar.id = 'kym-adm-sidebar';
    sidebar.style.cssText = 'width:96px;min-width:96px;background:#0f172a;display:flex;flex-direction:column;align-items:center;padding:10px 0 0;overflow-y:auto;flex-shrink:0;';

    function sidebarBtn(id, icon, label, active) {
      var b = document.createElement('div');
      b.id = id;
      b.dataset.kymNav = '1';
      b.style.cssText = 'width:80px;border-radius:8px;display:flex;flex-direction:column;align-items:center;padding:8px 4px 6px;cursor:pointer;gap:4px;' + (active ? 'background:#3b82f6;' : '');
      b.innerHTML = '<i class="ti ' + icon + '" style="font-size:20px;color:' + (active ? 'white' : '#94a3b8') + '" aria-hidden="true"></i>' +
        '<span style="font-size:12px;font-weight:600;color:' + (active ? 'white' : '#94a3b8') + ';text-align:center;line-height:1.2;">' + label + '</span>';
      return b;
    }

    function sidebarGroup(label, bg, items) {
      var g = document.createElement('div');
      g.style.cssText = 'width:100%;background:' + bg + ';border-radius:10px;margin:0 0 6px;padding:8px 8px 6px;display:flex;flex-direction:column;align-items:center;gap:2px;';
      g.innerHTML = '<p style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 6px;text-align:center;width:100%;">' + label + '</p>';
      items.forEach(function(item) { g.appendChild(item); });
      return g;
    }

    // Logo
    var logo = document.createElement('div');
    logo.style.cssText = 'width:48px;height:48px;background:#1e293b;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;flex-shrink:0;';
    logo.innerHTML = '<i class="ti ti-settings" style="font-size:20px;color:#94a3b8;" aria-hidden="true"></i>';
    sidebar.appendChild(logo);

    // Grupo Configuración
    var configItems = [
      sidebarBtn('kym-nav-services',   'ti-layout-grid',    'Servicios',     false),
      sidebarBtn('kym-nav-surveyflow', 'ti-git-branch',     'Surveyflow',    false),
      sidebarBtn('kym-nav-languages',  'ti-world',          'Idiomas',       false),
      sidebarBtn('kym-nav-phish-dom',  'ti-link',           'Dominios',      false),
      sidebarBtn('kym-nav-phish-att',  'ti-paperclip',      'Adjuntos',      false),
      sidebarBtn('kym-nav-phish-land', 'ti-external-link',  'Post-landings', false),
      sidebarBtn('kym-nav-vishing',    'ti-phone',          'Vishing',       false),
    ];
    sidebar.appendChild(sidebarGroup('Configuración', '#1e293b', configItems));

    // Grupo Masivo
    var bulkItems = [
      sidebarBtn('kym-nav-bulk-loader',      'ti-upload',             'Carga usuarios', false),
      sidebarBtn('kym-nav-resurrection',     'ti-refresh-alert',      'Resurrección',   false),
      sidebarBtn('kym-nav-move',             'ti-arrows-transfer-up', 'Mover dptos.',   false),
      sidebarBtn('kym-nav-email',            'ti-at',                 'Email/Login',    false),
      sidebarBtn('kym-nav-user-search',     'ti-search',             'Buscar usuario', false),
    ];
    sidebar.appendChild(sidebarGroup('Masivo', '#334155', bulkItems));

    // Spacer + contraer/expandir + cerrar
    var spacer = document.createElement('div'); spacer.style.flex = '1'; sidebar.appendChild(spacer);

    var collapseBtn = document.createElement('div');
    collapseBtn.id = 'kym-adm-collapse';
    collapseBtn.style.cssText = 'width:80px;border-radius:8px;display:flex;flex-direction:column;align-items:center;padding:8px 4px 6px;cursor:pointer;gap:4px;margin-bottom:4px;';
    collapseBtn.innerHTML = '<i class="ti ti-layout-sidebar-right-collapse" style="font-size:20px;color:white;" aria-hidden="true"></i><span style="font-size:12px;font-weight:700;color:white;text-align:center;line-height:1.2;">Contraer</span>';
    sidebar.appendChild(collapseBtn);

    var closeBtn2 = document.createElement('div');
    closeBtn2.id = 'kym-adm-close';
    closeBtn2.style.cssText = 'width:80px;border-radius:8px;display:flex;flex-direction:column;align-items:center;padding:8px 4px 6px;cursor:pointer;gap:4px;margin-bottom:8px;';
    closeBtn2.innerHTML = '<i class="ti ti-x" style="font-size:20px;color:white;" aria-hidden="true"></i><span style="font-size:12px;font-weight:700;color:white;text-align:center;line-height:1.2;">Cerrar</span>';
    sidebar.appendChild(closeBtn2);

    // ── Content panel ─────────────────────────────────────────────────────────
    var content = document.createElement('div');
    content.id = 'kym-adm-content';
    content.style.cssText = 'flex:1;background:#fff;display:flex;flex-direction:column;overflow:hidden;border-left:0.5px solid #e2e8f0;';

    var html = '';

    // Header empresa (sticky)
    html += '<div style="background:#f0fdf4;border-bottom:1px solid #bbf7d0;padding:10px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;">';
    html += '<i class="ti ti-building" style="font-size:20px;color:#166534;" aria-hidden="true"></i>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Empresa activa</div>';
    html += '<div class="kym-company-name" style="font-size:15px;font-weight:600;color:#166534;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(state.companyName || '— Sin empresa') + '</div>';
    html += '<div style="font-size:11px;color:#64748b;">ID: <span class="kym-company-id">' + escHtml(state.companyId || '?') + '</span></div>';
    html += '</div>';
    html += '<button id="kym-adm-refresh-company" style="background:#166534;color:white;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;white-space:nowrap;">&#8635; Actualizar</button>';
    html += '</div>';

    // Panel de módulo activo
    html += '<div id="kym-adm-module-header" style="display:none;background:#1e293b;color:white;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;">';
    html += '<i id="kym-adm-module-icon" class="ti ti-settings" style="font-size:18px;" aria-hidden="true"></i>';
    html += '<span id="kym-adm-module-title" style="font-size:15px;font-weight:500;flex:1;">Módulo</span>';
    html += '<a id="kym-adm-btn-chatgpt" href="#" target="_blank" style="display:none;background:#10a37f;color:white;text-decoration:none;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;">&#129302; ChatGPT</a>';
    html += '</div>';

    html += '<div id="kym-adm-module-body" style="flex:1;overflow-y:auto;padding:16px;">';
    // Placeholder inicial
    html += '<div id="kym-adm-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:#94a3b8;">';
    html += '<i class="ti ti-arrow-left" style="font-size:32px;" aria-hidden="true"></i>';
    html += '<p style="font-size:14px;margin:0;">Selecciona un módulo</p>';
    html += '</div>';

    // Paneles JSON (Ver / Modificar)
    html += '<div id="kym-adm-action" style="display:none;">';
    html += '<div id="kym-adm-view-panel" style="display:none;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<span style="font-size:11px;font-weight:600;color:#64748b;">JSON ACTUAL</span>';
    html += '<button id="kym-adm-copy" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;color:#475569;">&#128203; Copiar</button>';
    html += '</div>';
    html += '<pre id="kym-adm-json-view" style="background:#0f172a;color:#34d399;border-radius:8px;padding:14px;font-size:11px;font-family:Menlo,Consolas,monospace;overflow-x:auto;max-height:40vh;white-space:pre-wrap;"></pre>';
    html += '</div>';

    html += '<div id="kym-adm-edit-panel" style="display:none;">';
    html += '<div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px;">EDITAR JSON</div>';
    html += '<textarea id="kym-adm-json-edit" style="width:100%;height:280px;background:#0f172a;color:#fbbf24;border:1px solid #334155;border-radius:8px;padding:14px;font-size:11px;font-family:Menlo,Consolas,monospace;resize:vertical;outline:none;box-sizing:border-box;"></textarea>';
    html += '</div>';

    html += '<div style="display:none;margin-bottom:8px;" id="kym-adm-mode-switch">';
    html += '<button id="kym-adm-langs-switch" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;color:#475569;">{ } Modo JSON</button>';
    html += '</div>';

    html += '<div id="kym-adm-btns-row" style="display:flex;gap:8px;margin-bottom:14px;">';
    html += '<button id="kym-adm-btn-view" style="flex:1;background:#00b89c;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">&#128065; Ver actual</button>';
    html += '<button id="kym-adm-btn-edit" style="flex:1;background:#3b82f6;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">&#9998; Modificar</button>';
    html += '</div>';

    html += '<div id="kym-adm-btn-load-wrap" style="display:none;margin-bottom:14px;">';
    html += '<button id="kym-adm-btn-load" style="width:100%;background:#f59e0b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">&#8615; Cargar actual en editor</button>';
    html += '</div>';

    html += '<div id="kym-adm-save-status" style="display:none;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;"></div>';
    html += '<button id="kym-adm-btn-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;display:none;">&#10003; Actualizar</button>';
    html += '</div>'; // kym-adm-action

    // GUI container
    html += '<div id="kym-adm-gui-container" style="display:none;"></div>';
    // Gui específicas (idiomas, servicios, phishing)
    html += '<div id="kym-adm-gui-langs" style="display:none;"></div>';
    html += '<div id="kym-adm-gui-services" style="display:none;"></div>';
    html += '<div id="kym-adm-gui-phish-att" style="display:none;"></div>';

    html += '</div>'; // kym-adm-module-body

    content.innerHTML = html;
    div.appendChild(sidebar);
    div.appendChild(content);

    state.panel = div;
    document.body.appendChild(div);

    renderSectionButtons();
    bindCoreEvents();
  }

  // Mapeo fijo key -> nav id (independiente de si el módulo está registrado)
  var NAV_MAP = {
    services:             'kym-nav-services',
    surveyflow:           'kym-nav-surveyflow',
    languages:            'kym-nav-languages',
    phish_dom:            'kym-nav-phish-dom',
    phish_att:            'kym-nav-phish-att',
    phish_land:           'kym-nav-phish-land',
    vishing_templates_draft: 'kym-nav-vishing',
    bulk_loader:          'kym-nav-bulk-loader',
    bulk_resurrection:    'kym-nav-resurrection',
    bulk_move_users:      'kym-nav-move',
    bulk_email_login:     'kym-nav-email',
    user_search:          'kym-nav-user-search'
  };

  function renderSectionButtons() {
    if (!state.modules.length) registerBuiltinModules();
    // Asignar onclick a todos los botones de la sidebar de forma directa
    bindSidebarButtons();
  }

  function bindSidebarButtons() {
    Object.keys(NAV_MAP).forEach(function(key) {
      var navId = NAV_MAP[key];
      var btn = document.getElementById(navId);
      if (!btn) return;
      btn.onclick = function() { selectSection(key); };
    });
  }

  function updateTabs() {
    var navMap = NAV_MAP;
    // Reset todos
    Object.values(navMap).forEach(function(id) {
      var el = document.getElementById(id); if (!el) return;
      el.style.background = '';
      el.querySelectorAll('i').forEach(function(i){ i.style.color='#94a3b8'; });
      el.querySelectorAll('span').forEach(function(s){ s.style.color='#94a3b8'; });
    });
    // Activar el actual
    var activeId = navMap[state.currentSection];
    if (activeId) {
      var el = document.getElementById(activeId); if (!el) return;
      el.style.background = '#3b82f6';
      el.querySelectorAll('i').forEach(function(i){ i.style.color='white'; });
      el.querySelectorAll('span').forEach(function(s){ s.style.color='white'; });
    }
  }

  

  function moduleAllowsJsonToggle(mod) {
    if (!mod) return false;
    if (mod.group === 'bulk') return false;
    if (mod.forceGuiOnly || mod.hideModeSwitch) return false;
    return typeof mod.renderGui === 'function' && typeof mod.getJson === 'function';
  }

  function updateCompanyBanner() {
    var nameEl = state.panel && state.panel.querySelector('.kym-company-name');
    var idEl = state.panel && state.panel.querySelector('.kym-company-id');
    if (nameEl) nameEl.textContent = state.companyName || '— Sin empresa seleccionada';
    if (idEl) idEl.textContent = state.companyId || '?';
  }

  function resetActionPanels() {
    $('kym-adm-view-panel').style.display = 'none';
    $('kym-adm-edit-panel').style.display = 'none';
    $('kym-adm-gui-container').style.display = 'none';
    $('kym-adm-save-status').style.display = 'none';
    $('kym-adm-gui-container').innerHTML = '';
  }

  function getCurrentModule() {
    return state.modulesMap[state.currentSection];
  }

  function getCurrentSectionData() {
    var mod = getCurrentModule();
    if (!state.companyData || !mod || !mod.getJson) return null;
    return mod.getJson(state.companyData);
  }

  function selectSection(key) {
    state.currentSection = key;
    state.companyData = null;
    // Expandir automáticamente si está contraído
    if (state.collapsed) {
      state.collapsed = false;
      var panel = document.getElementById('kym-admin-panel');
      var content = $('kym-adm-content');
      var colBtn = $('kym-adm-collapse');
      if (content) content.style.display = 'flex';
      if (panel) panel.style.width = 'calc(96px + 50vw)';
      if (colBtn) {
        colBtn.querySelector('i').className = 'ti ti-layout-sidebar-right-collapse';
        colBtn.querySelector('span').textContent = 'Contraer';
      }
      localStorage.setItem('kym-panel-collapsed', '0');
    }
    updateTabs();

    var mod = getCurrentModule();
    if (!mod) return;

    // Mostrar header del módulo
    var mh = $('kym-adm-module-header');
    if (mh) {
      mh.style.display = 'flex';
      var iconEl = $('kym-adm-module-icon');
      var titleEl = $('kym-adm-module-title');
      if (iconEl) iconEl.className = 'ti ' + (mod.navIcon || 'ti-settings');
      if (titleEl) titleEl.textContent = mod.label;
    }

    // ChatGPT button
    var cgBtn = $('kym-adm-btn-chatgpt');
    if (cgBtn) {
      if (key === 'surveyflow') {
        cgBtn.style.display = 'inline-block';
        cgBtn.href = 'https://chatgpt.com/g/g-p-69b2862052e081918097b93ab359f603/c/6a3259aa-3cb8-832d-92e0-6cdc22a46eee';
      } else { cgBtn.style.display = 'none'; }
    }

    // Ocultar placeholder
    var ph = $('kym-adm-placeholder');
    if (ph) ph.style.display = 'none';

    // Decidir modo GUI o JSON
    var hasGui = typeof mod.renderGui === 'function';
    state.guiMode = hasGui;

    resetActionPanels();

    var modSwitch = $('kym-adm-mode-switch');
    var btnsRow   = $('kym-adm-btns-row');

    var act = $('kym-adm-action');
    if (act) act.style.display = 'block';

    if (hasGui) {
      if (modSwitch) modSwitch.style.display = moduleAllowsJsonToggle(mod) ? 'block' : 'none';
      if (btnsRow)   btnsRow.style.display = 'none';
      renderCurrentGui();
    } else {
      if (modSwitch) modSwitch.style.display = 'none';
      if (btnsRow)   btnsRow.style.display = 'flex';
    }
  }

  

  function renderCurrentGui() {
    var mod = getCurrentModule();
    if (!mod || typeof mod.renderGui !== 'function') return;

    resetActionPanels();
    var container = $('kym-adm-gui-container');
    container.style.display = 'block';
    container.innerHTML = '';
    mod.renderGui(container, KAT);
  }

  function bindCoreEvents() {
    $('kym-adm-close').onclick = function () { state.panel.remove(); };

    $('kym-adm-refresh-company').onclick = function () {
      var c = getCurrentCompanyFromVue();
      state.companyId = c.id; state.companyName = c.name;
      state.token = getToken(); state.companyData = null;
      state.currentSection = null;
      updateCompanyBanner();
      resetModuleArea();
      updateTabs();
      showToast('Empresa actualizada: ' + c.name, 'ok');
    };

    // Colapsar / expandir
    state.collapsed = localStorage.getItem('kym-panel-collapsed') === '1';
    function applyCollapse() {
      var panel = document.getElementById('kym-admin-panel');
      var content = $('kym-adm-content');
      var colBtn = $('kym-adm-collapse');
      if (state.collapsed) {
        if (content) content.style.display = 'none';
        if (panel) { panel.style.width = '96px'; panel.style.right = '0'; }
        if (colBtn) {
          colBtn.querySelector('i').className = 'ti ti-layout-sidebar-right-expand';
          colBtn.querySelector('span').textContent = 'Expandir';
        }
      } else {
        if (content) content.style.display = 'flex';
        if (panel) { panel.style.width = 'calc(96px + 50vw)'; panel.style.right = '0'; }
        if (colBtn) {
          colBtn.querySelector('i').className = 'ti ti-layout-sidebar-right-collapse';
          colBtn.querySelector('span').textContent = 'Contraer';
        }
      }
      localStorage.setItem('kym-panel-collapsed', state.collapsed ? '1' : '0');
    }
    applyCollapse();
    $('kym-adm-collapse').onclick = function () {
      state.collapsed = !state.collapsed;
      applyCollapse();
    };

    $('kym-adm-btn-view').onclick = async function () {
      resetActionPanels();
      $('kym-adm-view-panel').style.display = 'block';
      $('kym-adm-json-view').textContent = 'Cargando...';
      try {
        await loadCompanyData();
        $('kym-adm-json-view').textContent = JSON.stringify(getCurrentSectionData(), null, 2);
      } catch (e) { $('kym-adm-json-view').textContent = 'Error: ' + e.message; }
    };

    $('kym-adm-copy').onclick = function () {
      navigator.clipboard.writeText($('kym-adm-json-view').textContent).then(function () {
        $('kym-adm-copy').innerHTML = '&#10003; Copiado';
        setTimeout(function () { if ($('kym-adm-copy')) $('kym-adm-copy').innerHTML = '&#128203; Copiar'; }, 1500);
      });
    };

    $('kym-adm-btn-edit').onclick = function () {
      resetActionPanels();
      $('kym-adm-edit-panel').style.display = 'block';
      $('kym-adm-save-status').textContent = '';
      $('kym-adm-btn-save').style.display = 'block';
    };

    $('kym-adm-btn-load').onclick = async function () {
      $('kym-adm-json-edit').value = 'Cargando...';
      try {
        await loadCompanyData();
        $('kym-adm-json-edit').value = JSON.stringify(getCurrentSectionData(), null, 2);
      } catch (e) { $('kym-adm-json-edit').value = 'Error: ' + e.message; }
    };

    $('kym-adm-btn-save').onclick = async function () {
      var status = $('kym-adm-save-status');
      var raw = $('kym-adm-json-edit').value.trim();
      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) {
        setStatus(status, '&#10007; JSON no válido: ' + escHtml(e.message), 'err'); return;
      }
      var mod = getCurrentModule();
      var sectionLabel = mod ? mod.label : state.currentSection;
      if (!confirm('Se va a modificar ' + sectionLabel + ' de ' + state.companyName + '. \u00bfContinuar?')) {
        status.style.display = 'none'; return;
      }
      setStatus(status, '&#8987; Guardando...', 'info');
      try {
        await putCompanyPayload(parsed);
        setStatus(status, '&#10003; Cambios realizados en ' + escHtml(sectionLabel), 'ok');
      } catch (e) { setStatus(status, '&#10007; Error: ' + escHtml(e.message), 'err'); }
    };

    var langsSwitch = $('kym-adm-langs-switch');
    if (langsSwitch) langsSwitch.onclick = function () {
      var mod = getCurrentModule();
      state.guiMode = !state.guiMode;
      if (state.guiMode) {
        $('kym-adm-btns-row').style.display = 'none';
        langsSwitch.innerHTML = '{ } Modo JSON';
        renderCurrentGui();
      } else {
        resetActionPanels();
        $('kym-adm-btns-row').style.display = 'flex';
        langsSwitch.innerHTML = '&#127770; Modo GUI';
      }
    };
  }

  function resetModuleArea() {
    var ph = $('kym-adm-placeholder');
    var mh = $('kym-adm-module-header');
    var act = $('kym-adm-action');
    var gui = $('kym-adm-gui-container');
    if (ph) ph.style.display = 'flex';
    if (mh) mh.style.display = 'none';
    if (act) act.style.display = 'none';
    if (gui) { gui.style.display = 'none'; gui.innerHTML = ''; }
  }

  

  async function start() {
    // Create the panel first with built-in modules, then load the optional GUI modules.
    // This avoids showing an empty section list if one external module fails or is cached/blocked.
    registerBuiltinModules();
    createPanel();
    renderSectionButtons();

    var base = state.baseUrl;
    for (var i = 0; i < MODULE_FILES.length; i++) {
      var result = await loadScript(base + MODULE_FILES[i]);
      if (!result.ok) {
        showToast('No se pudo cargar: ' + MODULE_FILES[i], 'err');
      }
      renderSectionButtons();
    }

    console.log('Kymatio Admin Tools loaded:', VERSION, state.modules.map(function (m) { return m.key; }));
    showToast('Kymatio Admin Tools cargado', 'ok');
  }

  start();
})();
