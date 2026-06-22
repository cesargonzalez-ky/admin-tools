(function () {
  'use strict';

  var VERSION = '2026-06-22-modular-03-bulk-02';

  var MODULE_FILES = [
    'kymatio_admin_tools_services.js',
    'kymatio_admin_tools_languages.js',
    'kymatio_admin_tools_phishing_domains.js',
    'kymatio_admin_tools_phishing_attachments.js',
    'kymatio_admin_tools_phishing_landings.js',
    'kymatio_admin_tools_bulk_email_login.js'
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
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
      s.onload = function () {
        resolve({ ok: true, url: url });
      };
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
    var div = document.createElement('div');
    div.id = 'kym-admin-panel';
    div.style.cssText =
      'position:fixed;top:0;right:0;width:560px;height:100vh;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.18);z-index:2147483647;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:13px;color:#1a202c;';

    var html = '';

    html += '<div style="background:#1e293b;color:white;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">';
    html += '<div>';
    html += '<div style="font-weight:700;font-size:15px">&#9881; Kymatio Admin Tools</div>';
    html += '<div style="font-size:10px;color:#cbd5e1;margin-top:2px">v. ' + escHtml(VERSION) + '</div>';
    html += '</div>';
    html += '<button id="kym-adm-close" style="background:none;border:none;color:white;font-size:22px;cursor:pointer;line-height:1">&#215;</button>';
    html += '</div>';

    html += '<div style="overflow-y:auto;flex:1;padding:18px">';

    html += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
    html += '<div style="font-size:22px">&#127970;</div>';
    html += '<div style="flex:1">';
    html += '<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Empresa activa</div>';
    html += '<div class="kym-company-name" style="font-size:18px;font-weight:700;color:#166534">' + escHtml(state.companyName || '— Sin empresa seleccionada') + '</div>';
    html += '<div style="font-size:11px;color:#64748b">ID: <span class="kym-company-id">' + escHtml(state.companyId || '?') + '</span></div>';
    html += '</div>';
    html += '</div>';
    html += '<button id="kym-adm-refresh-company" style="width:100%;background:#166534;color:white;border:none;padding:8px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">&#8635; Actualizar empresa y datos</button>';
    html += '</div>';

    html += '<div id="kym-adm-tabs" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
    html += '<button id="kym-adm-tab-config" data-kym-group="config" style="border:1px solid #1e293b;background:#1e293b;color:white;border-radius:8px;padding:9px 10px;font-size:13px;font-weight:700;cursor:pointer">Configuración</button>';
    html += '<button id="kym-adm-tab-bulk" data-kym-group="bulk" style="border:1px solid #e2e8f0;background:#f8fafc;color:#475569;border-radius:8px;padding:9px 10px;font-size:13px;font-weight:700;cursor:pointer">Acciones masivas</button>';
    html += '</div>';
    html += '<div id="kym-adm-sections" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px"></div>';

    html += '<div id="kym-adm-action" style="display:none">';
    html += '<hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div id="kym-adm-section-title" style="font-size:14px;font-weight:700;color:#1a202c"></div>';
    html += '<button id="kym-adm-back" style="background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;text-decoration:underline">&#8592; Volver</button>';
    html += '</div>';

    html += '<a id="kym-adm-btn-chatgpt" href="#" target="_blank" style="display:none;width:100%;box-sizing:border-box;margin-bottom:10px;background:#10a37f;color:white;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;text-align:center">&#129302; Abrir ChatGPT</a>';

    html += '<div id="kym-adm-mode-switch" style="display:none;margin-bottom:8px">';
    html += '<button id="kym-adm-mode-toggle" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;color:#475569">{ } Modo JSON</button>';
    html += '</div>';

    html += '<div id="kym-adm-btns-row" style="display:flex;gap:8px;margin-bottom:14px">';
    html += '<button id="kym-adm-btn-view" style="flex:1;background:#00b89c;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#128065; Ver actual</button>';
    html += '<button id="kym-adm-btn-edit" style="flex:1;background:#3b82f6;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#9998; Modificar</button>';
    html += '</div>';

    html += '<div id="kym-adm-view-panel" style="display:none">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    html += '<span style="font-size:11px;font-weight:600;color:#64748b">JSON ACTUAL</span>';
    html += '<button id="kym-adm-copy" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;color:#475569">&#128203; Copiar</button>';
    html += '</div>';
    html += '<pre id="kym-adm-json-view" style="background:#0f172a;color:#34d399;border-radius:8px;padding:14px;font-size:11px;font-family:Menlo,Consolas,monospace;overflow:auto;max-height:400px;white-space:pre-wrap;word-break:break-all;margin:0"></pre>';
    html += '</div>';

    html += '<div id="kym-adm-edit-panel" style="display:none">';
    html += '<div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px">EDITAR JSON</div>';
    html += '<textarea id="kym-adm-json-edit" style="width:100%;height:300px;background:#0f172a;color:#fbbf24;border:1px solid #334155;border-radius:8px;padding:14px;font-size:11px;font-family:Menlo,Consolas,monospace;resize:vertical;outline:none;box-sizing:border-box"></textarea>';
    html += '<div style="display:flex;gap:8px;margin-top:10px">';
    html += '<button id="kym-adm-btn-load" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">&#8635; Cargar actual</button>';
    html += '<button id="kym-adm-btn-save" style="flex:1;background:#3b82f6;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Actualizar</button>';
    html += '</div>';
    html += '<div id="kym-adm-save-status" style="display:none"></div>';
    html += '</div>';

    html += '<div id="kym-adm-gui-container" style="display:none"></div>';

    html += '</div>';
    html += '</div>';

    div.innerHTML = html;
    document.body.appendChild(div);
    state.panel = div;

    renderSectionButtons();
    bindCoreEvents();
  }

  function renderSectionButtons() {
    var container = $('kym-adm-sections');
    if (!container) return;
    container.innerHTML = '';

    // Safety net: the built-in modules must always exist, even if an external module fails.
    if (!state.modules.length) {
      registerBuiltinModules();
    }

    updateTabs();

    if (!state.modules.length) {
      container.innerHTML = '<div style="grid-column:1/-1;padding:12px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030;font-size:12px">No se ha registrado ningún módulo. Revisa la consola del navegador.</div>';
      return;
    }

    var groupKey = state.activeGroup || 'config';
    var mods = state.modules
      .filter(function (m) {
        var g = m.group || 'config';
        return groupKey === 'config' ? g !== 'bulk' : g === groupKey;
      })
      .slice()
      .sort(function (a, b) {
        return (a.order || 999) - (b.order || 999);
      });

    if (!mods.length) {
      container.innerHTML = '<div style="grid-column:1/-1;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b;font-size:12px">No hay módulos disponibles en esta pestaña.</div>';
      return;
    }

    mods.forEach(function (mod) {
      var btn = document.createElement('button');
      btn.dataset.section = mod.key;
      btn.className = 'kym-sec-btn';
      btn.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;text-align:left;cursor:pointer;font-size:13px;font-weight:600;color:#1a202c;display:flex;align-items:center;gap:8px';
      btn.innerHTML = '<span>' + (mod.icon || '&#8226;') + '</span><span>' + escHtml(mod.label) + '</span>';
      btn.onclick = function () {
        selectSection(mod.key);
      };
      container.appendChild(btn);
    });
  }

  function updateTabs() {
    var configTab = $('kym-adm-tab-config');
    var bulkTab = $('kym-adm-tab-bulk');
    if (!configTab || !bulkTab) return;

    function paint(btn, active) {
      btn.style.background = active ? '#1e293b' : '#f8fafc';
      btn.style.borderColor = active ? '#1e293b' : '#e2e8f0';
      btn.style.color = active ? 'white' : '#475569';
    }

    paint(configTab, (state.activeGroup || 'config') === 'config');
    paint(bulkTab, state.activeGroup === 'bulk');
  }

  function moduleAllowsJsonToggle(mod) {
    if (!mod) return false;
    if (mod.group === 'bulk') return false;
    if (mod.forceGuiOnly) return false;
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
    state.guiMode = true;

    var mod = getCurrentModule();
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
    $('kym-adm-close').onclick = function () {
      state.panel.remove();
    };

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
      showToast('Empresa actualizada', 'ok');
    };

    function switchGroup(group) {
      state.activeGroup = group;
      state.currentSection = null;
      $('kym-adm-action').style.display = 'none';
      resetActionPanels();
      renderSectionButtons();
    }

    $('kym-adm-tab-config').onclick = function () {
      switchGroup('config');
    };

    $('kym-adm-tab-bulk').onclick = function () {
      switchGroup('bulk');
    };

    $('kym-adm-back').onclick = function () {
      $('kym-adm-action').style.display = 'none';
      resetActionPanels();
      state.currentSection = null;
    };

    $('kym-adm-btn-view').onclick = async function () {
      resetActionPanels();
      $('kym-adm-view-panel').style.display = 'block';
      $('kym-adm-json-view').textContent = 'Cargando...';

      try {
        await loadCompanyData();
        $('kym-adm-json-view').textContent = JSON.stringify(getCurrentSectionData(), null, 2);
      } catch (e) {
        $('kym-adm-json-view').textContent = 'Error: ' + e.message;
      }
    };

    $('kym-adm-copy').onclick = function () {
      var text = $('kym-adm-json-view').textContent;

      navigator.clipboard.writeText(text).then(function () {
        $('kym-adm-copy').innerHTML = '&#10003; Copiado';
        setTimeout(function () {
          if ($('kym-adm-copy')) $('kym-adm-copy').innerHTML = '&#128203; Copiar';
        }, 1500);
      });
    };

    $('kym-adm-btn-edit').onclick = function () {
      resetActionPanels();
      $('kym-adm-edit-panel').style.display = 'block';
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
        setStatus(status, '&#10007; JSON no valido: ' + escHtml(e.message), 'err');
        return;
      }

      var mod = getCurrentModule();
      var sectionLabel = mod ? mod.label : state.currentSection;

      if (!confirm('Se va a proceder a la modificacion de ' + sectionLabel + ' de la empresa ' + state.companyName + '.\n\n¿Quieres continuar?')) {
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
