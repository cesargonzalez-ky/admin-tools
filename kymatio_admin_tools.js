(function () {
  'use strict';

  var VERSION = '2026-07-09-sidebar-admin-profile-audit';

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
    'kymatio_admin_tools_vishing_templates.js',
    'kymatio_admin_tools_admin_profile_audit.js'
  ];

  var NAV_MAP = {
    services:                'kym-nav-services',
    surveyflow:              'kym-nav-surveyflow',
    languages:               'kym-nav-languages',
    phish_dom:               'kym-nav-phish-dom',
    phish_att:               'kym-nav-phish-att',
    phish_land:              'kym-nav-phish-land',
    vishing_templates_draft: 'kym-nav-vishing',
    bulk_loader:             'kym-nav-bulk-loader',
    bulk_resurrection:       'kym-nav-resurrection',
    bulk_move_users:         'kym-nav-move',
    bulk_email_login:        'kym-nav-email',
    bulk_delete_users:       'kym-nav-delete',
    bulk_user_dept_report:   'kym-nav-dept-report',
    admin_profile_audit:     'kym-nav-profile-audit',
    user_search:             'kym-nav-user-search',
    tag_manager:             'kym-nav-tag-manager'
  };

  function $(id) { return document.getElementById(id); }

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function safeJsonClone(obj) {
    return JSON.parse(JSON.stringify(obj == null ? null : obj));
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    var styles = {
      err:  'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;',
      ok:   'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;',
      info: 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'
    };
    el.style.cssText = 'display:block;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;' + (styles[type] || styles.info);
    el.innerHTML = msg;
  }

  function showToast(message, type) {
    var old = $('kym-adm-toast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'kym-adm-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:1000002;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.18);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' +
      (type === 'err' ? 'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;' :
       type === 'ok'  ? 'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;' :
                        'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;');
    document.body.appendChild(toast);
    setTimeout(function () { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); }, 3500);
  }

  function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('access_token') || '';
  }

  function getCurrentCompanyFromVue() {
    try {
      var app = document.querySelector('#app');
      var company = app.__vue_app__.config.globalProperties.$store.state.Admin.companySelected;
      return { id: String(company.stakeholderId || ''), name: company.name || '' };
    } catch (e) {
      return { id: '', name: '' };
    }
  }

  function getBaseUrl() {
    var script = document.currentScript;
    var src = script && script.src ? script.src : '';
    if (!src) return 'https://cdn.jsdelivr.net/gh/cesargonzalez-ky/admin-tools@main/';
    var clean = src.split('?')[0].split('#')[0];
    return clean.substring(0, clean.lastIndexOf('/') + 1);
  }

  function loadScript(url) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
      s.onload = function () { resolve({ ok: true, url: url }); };
      s.onerror = function () {
        console.error('Kymatio Admin Tools: no se pudo cargar modulo', url);
        resolve({ ok: false, url: url });
      };
      document.head.appendChild(s);
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
    activeGroup: 'config',
    collapsed: localStorage.getItem('kym-panel-collapsed') === '1'
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
      if (m.key === mod.key) { replaced = true; return mod; }
      return m;
    });
    if (!replaced) state.modules.push(mod);
    try {
      if (state.panel && document.getElementById('kym-adm-sidebar')) renderSidebarButtons();
    } catch (e) {
      console.warn('Kymatio Admin Tools: could not repaint sidebar', e);
    }
  }

  function registerBuiltinModules() {
    registerModule({
      key: 'surveyflow',
      label: 'Surveyflow',
      group: 'config',
      icon: '&#128200;',
      order: 20,
      getJson: function (d) { return { journey: { surveyflow: d.journey && d.journey.surveyflow } }; },
      chatgptUrl: 'https://chatgpt.com/g/g-p-69b2862052e081918097b93ab359f603/c/6a3259aa-3cb8-832d-92e0-6cdc22a46eee'
    });
    registerModule({
      key: 'phish_land',
      label: 'Phishing: Post-landings',
      group: 'config',
      icon: '&#128279;',
      order: 60,
      getJson: function (d) {
        return { servicesConfiguration: { phishing: { landingRedirect: d.servicesConfiguration && d.servicesConfiguration.phishing && d.servicesConfiguration.phishing.landingRedirect } } };
      }
    });
  }

  function apiHeaders() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token };
  }

  async function loadCompanyData(force) {
    if (state.companyData && !force) return state.companyData;
    if (!state.companyId) throw new Error('No se ha podido detectar la empresa activa. Selecciona una empresa y pulsa "Actualizar empresa y datos".');
    if (!state.token) throw new Error('No se ha encontrado token en localStorage. Aseg\u00farate de estar logado en Kymatio.');
    var url = 'https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(state.companyId) + '?environment=true&journey=true&services=true';
    var res = await fetch(url, { headers: apiHeaders() });
    var d = await res.json();
    if (!res.ok) throw new Error((d && (d.message || (d.records && d.records.devMessage))) || 'Error HTTP ' + res.status);
    state.companyData = d.records || d;
    return state.companyData;
  }

  async function putCompanyPayload(payload) {
    if (!state.companyId) throw new Error('No hay empresa seleccionada.');
    var url = 'https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(state.companyId);
    var res = await fetch(url, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(payload) });
    var d = await res.json();
    if (!res.ok) throw new Error((d && (d.message || (d.records && d.records.devMessage))) || 'Error HTTP ' + res.status);
    state.companyData = null;
    return d.records || d;
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  function sidebarSection(label) {
    return '<div style="padding:6px 10px 2px;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.8px">' + label + '</div>';
  }

  function renderSidebarButtons() {
    var sidebar = $('kym-adm-sidebar');
    if (!sidebar) return;

    var configMods = state.modules.filter(function (m) { return m.group === 'config'; }).sort(function (a, b) { return (a.order || 999) - (b.order || 999); });
    var bulkMods   = state.modules.filter(function (m) { return m.group === 'bulk'; }).sort(function (a, b) { return (a.order || 999) - (b.order || 999); });

    var html = '';
    if (configMods.length) {
      html += sidebarSection('Configuraci\u00f3n');
      configMods.forEach(function (mod) {
        var navId = NAV_MAP[mod.key] || ('kym-nav-' + mod.key);
        var active = state.currentSection === mod.key;
        html += '<button id="' + navId + '" data-section="' + mod.key + '" style="' +
          'display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;text-align:left;transition:background .15s;' +
          (active ? 'background:#1e293b;color:white;' : 'background:transparent;color:#1a202c;') +
          '">' + (mod.icon || '&#8226;') + '<span>' + escHtml(mod.label) + '</span></button>';
      });
    }
    if (bulkMods.length) {
      html += sidebarSection('Masivo');
      bulkMods.forEach(function (mod) {
        var navId = NAV_MAP[mod.key] || ('kym-nav-' + mod.key);
        var active = state.currentSection === mod.key;
        html += '<button id="' + navId + '" data-section="' + mod.key + '" style="' +
          'display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;text-align:left;transition:background .15s;' +
          (active ? 'background:#1e293b;color:white;' : 'background:transparent;color:#1a202c;') +
          '">' + (mod.icon || '&#8226;') + '<span>' + escHtml(mod.label) + '</span></button>';
      });
    }

    sidebar.innerHTML = html;

    sidebar.querySelectorAll('button[data-section]').forEach(function (btn) {
      btn.onclick = function () { selectSection(btn.dataset.section); };
    });
  }

  function selectSection(key) {
    state.currentSection = key;
    state.companyData = null;
    state.guiMode = true;

    // Auto-expandir si está contraído
    if (state.collapsed) {
      state.collapsed = false;
      var panel = document.getElementById('kym-admin-panel');
      var content = $('kym-adm-content');
      var colBtn = $('kym-adm-collapse');
      if (content) content.style.display = 'flex';
      if (panel) panel.style.width = 'calc(96px + 50vw)';
      if (colBtn) colBtn.textContent = '\u25c4';
      localStorage.setItem('kym-panel-collapsed', '0');
    }

    renderSidebarButtons();

    var mod = state.modulesMap[key];
    if (!mod) return;

    $('kym-adm-section-title').innerHTML = (mod.icon || '&#8226;') + ' ' + escHtml(mod.label);
    $('kym-adm-action').style.display = 'block';

    if (mod.chatgptUrl) {
      $('kym-adm-btn-chatgpt').href = mod.chatgptUrl;
      $('kym-adm-btn-chatgpt').style.display = 'block';
    } else {
      $('kym-adm-btn-chatgpt').style.display = 'none';
    }

    resetActionPanels();

    var hasGui = typeof mod.renderGui === 'function';
    var allowJsonToggle = moduleAllowsJsonToggle(mod);
    $('kym-adm-mode-switch').style.display = allowJsonToggle ? 'block' : 'none';
    $('kym-adm-btns-row').style.display = hasGui ? 'none' : 'flex';
    $('kym-adm-mode-toggle').innerHTML = '{ } Modo JSON';

    if (hasGui) renderCurrentGui();
  }

  function moduleAllowsJsonToggle(mod) {
    if (!mod) return false;
    if (mod.group === 'bulk') return false;
    if (mod.forceGuiOnly || mod.hideModeSwitch) return false;
    return typeof mod.renderGui === 'function' && typeof mod.getJson === 'function';
  }

  function updateCompanyBanner() {
    var nameEl = state.panel && state.panel.querySelector('.kym-company-name');
    var idEl   = state.panel && state.panel.querySelector('.kym-company-id');
    if (nameEl) nameEl.textContent = state.companyName || '\u2014 Sin empresa seleccionada';
    if (idEl)   idEl.textContent   = state.companyId   || '?';
  }

  function resetActionPanels() {
    $('kym-adm-view-panel').style.display = 'none';
    $('kym-adm-edit-panel').style.display = 'none';
    $('kym-adm-gui-container').style.display = 'none';
    $('kym-adm-save-status').style.display = 'none';
    $('kym-adm-gui-container').innerHTML = '';
  }

  function getCurrentModule() { return state.modulesMap[state.currentSection]; }

  function getCurrentSectionData() {
    var mod = getCurrentModule();
    if (!state.companyData || !mod || !mod.getJson) return null;
    return mod.getJson(state.companyData);
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

  // ── Panel HTML ───────────────────────────────────────────────────────────────

  function createPanel() {
    var panel = document.createElement('div');
    panel.id = 'kym-admin-panel';
    panel.style.cssText = 'position:fixed;top:0;right:0;height:100vh;z-index:1000001;display:flex;flex-direction:row;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:-4px 0 32px rgba(0,0,0,.18);transition:width .2s;width:' + (state.collapsed ? '48px' : 'calc(96px + 50vw)') + ';';

    // ── Sidebar izquierda ────────────────────────────────────────────────────
    var sidebarEl = document.createElement('div');
    sidebarEl.style.cssText = 'width:180px;min-width:180px;background:#f8fafc;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;overflow:hidden;';

    // Cabecera del sidebar: botones contraer y cerrar (pequeños, arriba)
    var sidebarHeader = document.createElement('div');
    sidebarHeader.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:4px;padding:6px 8px;border-bottom:1px solid #e2e8f0;';

    var colBtn = document.createElement('button');
    colBtn.id = 'kym-adm-collapse';
    colBtn.title = state.collapsed ? 'Expandir' : 'Contraer';
    colBtn.textContent = state.collapsed ? '\u25ba' : '\u25c4';
    colBtn.style.cssText = 'background:none;border:1px solid #e2e8f0;border-radius:5px;cursor:pointer;font-size:10px;color:#64748b;padding:3px 7px;line-height:1;';

    var closeBtn = document.createElement('button');
    closeBtn.id = 'kym-adm-close';
    closeBtn.title = 'Cerrar';
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = 'background:none;border:1px solid #e2e8f0;border-radius:5px;cursor:pointer;font-size:13px;color:#64748b;padding:1px 6px;line-height:1;';

    sidebarHeader.appendChild(colBtn);
    sidebarHeader.appendChild(closeBtn);

    // Empresa activa en sidebar
    var companyBadge = document.createElement('div');
    companyBadge.style.cssText = 'padding:8px 10px;border-bottom:1px solid #e2e8f0;';
    companyBadge.innerHTML =
      '<div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Empresa activa</div>' +
      '<div class="kym-company-name" style="font-size:11px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(state.companyName || '\u2014') + '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">' +
        '<span class="kym-company-id" style="font-size:10px;color:#64748b;">ID: ' + escHtml(state.companyId || '?') + '</span>' +
        '<button id="kym-adm-refresh-company" style="font-size:9px;background:#1e293b;color:white;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;">\u21bb</button>' +
      '</div>';

    // Lista de módulos en el sidebar
    var sidebarList = document.createElement('div');
    sidebarList.id = 'kym-adm-sidebar';
    sidebarList.style.cssText = 'flex:1;overflow-y:auto;padding:6px 6px;';

    sidebarEl.appendChild(sidebarHeader);
    sidebarEl.appendChild(companyBadge);
    sidebarEl.appendChild(sidebarList);

    // ── Contenido derecha ────────────────────────────────────────────────────
    var contentEl = document.createElement('div');
    contentEl.id = 'kym-adm-content';
    contentEl.style.cssText = 'flex:1;min-width:0;background:white;display:' + (state.collapsed ? 'none' : 'flex') + ';flex-direction:column;overflow:hidden;';

    // Header del contenido
    var contentHeader = document.createElement('div');
    contentHeader.style.cssText = 'background:#1e293b;color:white;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
    contentHeader.innerHTML =
      '<div>' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:.5px;opacity:.7">KYMATIO ADMIN TOOLS</div>' +
        '<div style="font-size:10px;opacity:.5">' + escHtml(VERSION) + '</div>' +
      '</div>';

    // Área de acción (título + botones)
    var actionEl = document.createElement('div');
    actionEl.id = 'kym-adm-action';
    actionEl.style.cssText = 'display:none;flex:1;flex-direction:column;overflow:hidden;';

    actionEl.innerHTML =
      '<div style="padding:12px 18px 0;border-bottom:1px solid #e2e8f0;flex-shrink:0;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
          '<button id="kym-adm-back" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;color:#64748b;">\u2190 Volver</button>' +
          '<div id="kym-adm-section-title" style="font-size:14px;font-weight:700;color:#1e293b;flex:1;"></div>' +
          '<a id="kym-adm-btn-chatgpt" href="#" target="_blank" style="display:none;font-size:11px;background:#10a37f;color:white;border-radius:6px;padding:5px 10px;text-decoration:none;font-weight:600;">ChatGPT</a>' +
        '</div>' +
        '<div id="kym-adm-mode-switch" style="display:none;margin-bottom:10px;">' +
          '<button id="kym-adm-mode-toggle" style="font-size:11px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 12px;cursor:pointer;color:#475569;font-weight:600;">{ } Modo JSON</button>' +
        '</div>' +
      '</div>' +
      '<div id="kym-adm-btns-row" style="display:none;gap:8px;padding:12px 18px;flex-shrink:0;">' +
        '<button id="kym-adm-btn-view" style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;color:#1a202c;">&#128065; Ver JSON</button>' +
        '<button id="kym-adm-btn-edit" style="flex:1;background:#1e293b;color:white;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;">&#9998; Editar JSON</button>' +
      '</div>' +
      '<div id="kym-adm-view-panel" style="display:none;flex:1;flex-direction:column;overflow:hidden;padding:12px 18px;">' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">' +
          '<button id="kym-adm-copy" style="font-size:11px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 12px;cursor:pointer;font-weight:600;">&#128203; Copiar</button>' +
        '</div>' +
        '<pre id="kym-adm-json-view" style="flex:1;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:14px;font-size:12px;font-family:Menlo,Consolas,monospace;margin:0;white-space:pre-wrap;word-break:break-all;"></pre>' +
      '</div>' +
      '<div id="kym-adm-edit-panel" style="display:none;flex:1;flex-direction:column;overflow:hidden;padding:12px 18px;">' +
        '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
          '<button id="kym-adm-btn-load" style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;font-size:12px;font-weight:600;cursor:pointer;color:#1a202c;">&#8635; Cargar actual</button>' +
          '<button id="kym-adm-btn-save" style="flex:1;background:#0f766e;color:white;border:none;border-radius:6px;padding:6px;font-size:12px;font-weight:600;cursor:pointer;">&#128190; Guardar</button>' +
        '</div>' +
        '<textarea id="kym-adm-json-edit" spellcheck="false" style="flex:1;background:#0f172a;color:#e2e8f0;border:none;border-radius:8px;padding:14px;font-size:12px;font-family:Menlo,Consolas,monospace;resize:none;outline:none;"></textarea>' +
        '<div id="kym-adm-save-status" style="display:none;margin-top:8px;"></div>' +
      '</div>' +
      '<div id="kym-adm-gui-container" style="display:none;flex:1;overflow-y:auto;padding:14px 18px;"></div>';

    contentEl.appendChild(contentHeader);
    contentEl.appendChild(actionEl);

    // Placeholder cuando no hay sección seleccionada
    var placeholder = document.createElement('div');
    placeholder.id = 'kym-adm-placeholder';
    placeholder.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;';
    placeholder.textContent = '\u2190 Selecciona un m\u00f3dulo';
    contentEl.appendChild(placeholder);

    panel.appendChild(sidebarEl);
    panel.appendChild(contentEl);
    document.body.appendChild(panel);
    state.panel = panel;

    return panel;
  }

  function bindCoreEvents() {
    $('kym-adm-close').onclick = function () { state.panel.remove(); };

    $('kym-adm-refresh-company').onclick = function () {
      var c = getCurrentCompanyFromVue();
      state.companyId = c.id;
      state.companyName = c.name;
      state.token = getToken();
      state.companyData = null;
      state.currentSection = null;
      updateCompanyBanner();
      $('kym-adm-action').style.display = 'none';
      resetActionPanels();
      renderSidebarButtons();
      showToast('Empresa actualizada', 'ok');
    };

    $('kym-adm-collapse').onclick = function () {
      state.collapsed = !state.collapsed;
      var panel = document.getElementById('kym-admin-panel');
      var content = $('kym-adm-content');
      var colBtn = $('kym-adm-collapse');
      if (state.collapsed) {
        if (content) content.style.display = 'none';
        if (panel) panel.style.width = '48px';
        if (colBtn) { colBtn.textContent = '\u25ba'; colBtn.title = 'Expandir'; }
      } else {
        if (content) content.style.display = 'flex';
        if (panel) panel.style.width = 'calc(96px + 50vw)';
        if (colBtn) { colBtn.textContent = '\u25c4'; colBtn.title = 'Contraer'; }
      }
      localStorage.setItem('kym-panel-collapsed', state.collapsed ? '1' : '0');
    };

    $('kym-adm-back').onclick = function () {
      $('kym-adm-action').style.display = 'none';
      resetActionPanels();
      state.currentSection = null;
      renderSidebarButtons();
    };

    $('kym-adm-btn-view').onclick = async function () {
      resetActionPanels();
      $('kym-adm-view-panel').style.display = 'flex';
      $('kym-adm-json-view').textContent = 'Cargando...';
      try {
        await loadCompanyData();
        $('kym-adm-json-view').textContent = JSON.stringify(getCurrentSectionData(), null, 2);
      } catch (e) {
        $('kym-adm-json-view').textContent = 'Error: ' + e.message;
      }
    };

    $('kym-adm-copy').onclick = function () {
      navigator.clipboard.writeText($('kym-adm-json-view').textContent).then(function () {
        $('kym-adm-copy').innerHTML = '&#10003; Copiado';
        setTimeout(function () { if ($('kym-adm-copy')) $('kym-adm-copy').innerHTML = '&#128203; Copiar'; }, 1500);
      });
    };

    $('kym-adm-btn-edit').onclick = function () {
      resetActionPanels();
      $('kym-adm-edit-panel').style.display = 'flex';
      $('kym-adm-save-status').textContent = '';
    };

    $('kym-adm-btn-load').onclick = async function () {
      $('kym-adm-json-edit').value = 'Cargando...';
      try {
        await loadCompanyData();
        $('kym-adm-json-edit').value = JSON.stringify(getCurrentSectionData(), null, 2);
      } catch (e) {
        $('kym-adm-json-edit').value = 'Error: ' + e.message;
      }
    };

    $('kym-adm-btn-save').onclick = async function () {
      var status = $('kym-adm-save-status');
      var raw = $('kym-adm-json-edit').value.trim();
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        setStatus(status, '&#10007; JSON no v\u00e1lido: ' + escHtml(e.message), 'err');
        return;
      }
      var mod = getCurrentModule();
      var sectionLabel = mod ? mod.label : state.currentSection;
      if (!confirm('Se va a proceder a la modificaci\u00f3n de ' + sectionLabel + ' de la empresa ' + state.companyName + '.\n\n\u00bfQuieres continuar?')) {
        status.style.display = 'none';
        return;
      }
      setStatus(status, '&#8987; Guardando...', 'info');
      try {
        await putCompanyPayload(parsed);
        setStatus(status, '&#10003; Cambios realizados correctamente en ' + escHtml(sectionLabel), 'ok');
      } catch (e) {
        setStatus(status, '&#10007; Error: ' + escHtml(e.message), 'err');
      }
    };

    $('kym-adm-mode-toggle').onclick = function () {
      var mod = getCurrentModule();
      if (!moduleAllowsJsonToggle(mod)) return;
      state.guiMode = !state.guiMode;
      if (state.guiMode) {
        $('kym-adm-btns-row').style.display = 'none';
        $('kym-adm-mode-toggle').innerHTML = '{ } Modo JSON';
        renderCurrentGui();
      } else {
        resetActionPanels();
        $('kym-adm-btns-row').style.display = 'flex';
        $('kym-adm-mode-toggle').innerHTML = '&#127770; Modo GUI';
      }
    };
  }

  async function start() {
    registerBuiltinModules();
    createPanel();
    bindCoreEvents();
    renderSidebarButtons();

    var base = state.baseUrl;
    for (var i = 0; i < MODULE_FILES.length; i++) {
      var result = await loadScript(base + MODULE_FILES[i]);
      if (!result.ok) showToast('No se pudo cargar: ' + MODULE_FILES[i], 'err');
      renderSidebarButtons();
    }

    console.log('Kymatio Admin Tools loaded:', VERSION, state.modules.map(function (m) { return m.key; }));
    showToast('Kymatio Admin Tools cargado', 'ok');
  }

  start();
})();
