(function () {
  'use strict';

  var VERSION = '2026-07-13-content-mgmt-v3';

  var MODULE_FILES = [
    'kymatio_content_management_assets.js',
    'kymatio_content_management_actions.js',
    'kymatio_content_management_questions.js'
  ];

  // ── Utilidades core ──────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('access_token') || '';
  }

  function getBaseUrl() {
    var script = document.currentScript;
    var src = script && script.src ? script.src : '';
    if (!src) return 'https://cdn.jsdelivr.net/gh/cesargonzalez-ky/admin-tools@main/';
    var clean = src.split('?')[0].split('#')[0];
    return clean.substring(0, clean.lastIndexOf('/') + 1);
  }

  function loadScript(url) {
    return new Promise(function(resolve) {
      var s = document.createElement('script');
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
      s.onload = function() { resolve({ ok: true, url: url }); };
      s.onerror = function() {
        console.error('KCM: no se pudo cargar módulo', url);
        resolve({ ok: false, url: url });
      };
      document.head.appendChild(s);
    });
  }

  function showToast(msg, type) {
    var old = $('kcm-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'kcm-toast';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:1000002;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.18);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' +
      (type === 'err' ? 'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;' :
       type === 'ok'  ? 'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;' :
                        'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;');
    document.body.appendChild(t);
    setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
  }

  // ── Estado global ────────────────────────────────────────────────────────────

  var state = {
    version: VERSION,
    baseUrl: getBaseUrl(),
    token: getToken(),
    modules: [],
    modulesMap: {},
    currentSection: null,
    panel: null
  };

  var KCM = {
    state: state,
    $: $,
    escHtml: escHtml,
    showToast: showToast,
    registerModule: registerModule,
    selectSection: selectSection,
    apiGet: apiGet,
    apiPost: apiPost,
    loadXlsx: loadXlsx
  };

  window.KymatioContentManagement = KCM;

  // ── API helpers ──────────────────────────────────────────────────────────────

  var BASE_URL = 'https://api.kymatio.com/v2/';

  function apiHeaders() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token };
  }

  async function apiGet(path, params) {
    var url = BASE_URL + path;
    if (params) {
      var qs = Object.keys(params)
        .filter(function(k){ return params[k] !== undefined && params[k] !== null; })
        .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
        .join('&');
      if (qs) url += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
    }
    var res = await fetch(url, { headers: apiHeaders() });
    var d = await res.json();
    if (!res.ok) throw new Error((d && d.message) || 'Error HTTP ' + res.status);
    return d;
  }

  async function apiPost(path, body) {
    var res = await fetch(BASE_URL + path, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body)
    });
    var d = await res.json();
    if (!res.ok) throw new Error((d && d.message) || 'Error HTTP ' + res.status);
    return d;
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

  // ── Registro de módulos ───────────────────────────────────────────────────────

  function registerModule(mod) {
    if (!mod || !mod.key) return;
    if (!mod.group) mod.group = 'assets';
    state.modulesMap[mod.key] = mod;
    var replaced = false;
    state.modules = state.modules.map(function(m) {
      if (m.key === mod.key) { replaced = true; return mod; }
      return m;
    });
    if (!replaced) state.modules.push(mod);
    try {
      if (state.panel && $('kcm-sidebar')) renderSidebarButtons();
    } catch(e) {}
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  function sidebarSection(label) {
    return '<div style="padding:8px 10px 4px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.6px;margin-top:4px">' + label + '</div>';
  }

  function renderSidebarButtons() {
    var sidebar = $('kcm-sidebar');
    if (!sidebar) return;

    var groups = {};
    state.modules.forEach(function(mod) {
      var g = mod.group || 'assets';
      if (!groups[g]) groups[g] = [];
      groups[g].push(mod);
    });

    var html = '';
    Object.keys(groups).sort().forEach(function(g) {
      html += sidebarSection(g.toUpperCase());
      groups[g].sort(function(a,b){ return (a.order||999)-(b.order||999); }).forEach(function(mod) {
        var active = state.currentSection === mod.key;
        html += '<button data-section="' + escHtml(mod.key) + '" style="' +
          'display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;text-align:left;' +
          (active ? 'background:#1e293b;color:white;' : 'background:transparent;color:#1a202c;') +
          '">' + (mod.icon || '&#8226;') + ' <span>' + escHtml(mod.label) + '</span></button>';
      });
    });

    sidebar.innerHTML = html;
    sidebar.querySelectorAll('button[data-section]').forEach(function(btn) {
      btn.onclick = function() { selectSection(btn.dataset.section); };
    });
  }

  function selectSection(key) {
    state.currentSection = key;
    renderSidebarButtons();

    var mod = state.modulesMap[key];
    if (!mod) return;

    var titleEl = $('kcm-section-title');
    var contentEl = $('kcm-section-content');
    if (titleEl) titleEl.innerHTML = (mod.icon || '') + ' ' + escHtml(mod.label);
    if (contentEl) {
      contentEl.innerHTML = '';
      if (typeof mod.render === 'function') mod.render(contentEl, KCM);
    }

    $('kcm-action').style.display = 'flex';
    $('kcm-back').onclick = function() {
      $('kcm-action').style.display = 'none';
      state.currentSection = null;
      renderSidebarButtons();
    };
  }

  // ── Panel ────────────────────────────────────────────────────────────────────

  function createPanel() {
    var existing = $('kcm-panel');
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id = 'kcm-panel';
    panel.style.cssText = 'position:fixed;top:0;right:0;height:100vh;z-index:1000001;display:flex;flex-direction:row;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:-4px 0 32px rgba(0,0,0,.18);width:calc(180px + 50vw);';
    state.panel = panel;

    // ── Sidebar ────────────────────────────────────────────────────────────────
    var sidebarEl = document.createElement('div');
    sidebarEl.style.cssText = 'width:180px;min-width:180px;background:#f8fafc;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;overflow:hidden;';

    // Cabecera sidebar: botones
    var sidebarHeader = document.createElement('div');
    sidebarHeader.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:8px;border-bottom:1px solid #e2e8f0;flex-shrink:0;';

    var colBtn = document.createElement('button');
    colBtn.id = 'kcm-collapse';
    colBtn.innerHTML = '&#9668; Contraer';
    colBtn.style.cssText = 'background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#475569;padding:5px 8px;text-align:left;width:100%;';

    var closeBtn = document.createElement('button');
    closeBtn.id = 'kcm-close';
    closeBtn.innerHTML = '&#215; Cerrar panel';
    closeBtn.style.cssText = 'background:#fff5f5;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#c53030;padding:5px 8px;text-align:left;width:100%;';

    sidebarHeader.appendChild(colBtn);
    sidebarHeader.appendChild(closeBtn);

    // Título del tool
    var sidebarTitle = document.createElement('div');
    sidebarTitle.style.cssText = 'padding:10px;border-bottom:1px solid #e2e8f0;flex-shrink:0;';
    sidebarTitle.innerHTML =
      '<div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Gestión de Contenidos</div>' +
      '<div style="font-size:10px;color:#94a3b8;margin-top:2px;line-height:1.5">Core: ' + escHtml(VERSION) + '</div>' +
'';

    // Lista módulos
    var sidebarList = document.createElement('div');
    sidebarList.id = 'kcm-sidebar';
    sidebarList.style.cssText = 'flex:1;overflow-y:auto;padding:6px;min-height:0;';

    sidebarEl.appendChild(sidebarHeader);
    sidebarEl.appendChild(sidebarTitle);
    sidebarEl.appendChild(sidebarList);

    // ── Contenido ──────────────────────────────────────────────────────────────
    var contentEl = document.createElement('div');
    contentEl.id = 'kcm-content';
    contentEl.style.cssText = 'flex:1;min-width:0;background:white;display:flex;flex-direction:column;overflow:hidden;min-height:0;';

    // Header contenido
    var contentHeader = document.createElement('div');
    contentHeader.style.cssText = 'background:#1e293b;color:white;padding:12px 18px;flex-shrink:0;';
    contentHeader.innerHTML = '<div style="font-weight:800;font-size:14px">&#128196; Kymatio — Gestión de Contenidos</div>';

    // Área de acción
    var actionEl = document.createElement('div');
    actionEl.id = 'kcm-action';
    actionEl.style.cssText = 'display:flex;flex:1;flex-direction:column;overflow:auto;min-height:0;';

    actionEl.innerHTML =
      '<div style="padding:12px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;flex-shrink:0;">' +
        '<button id="kcm-back" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;color:#64748b;">&#8592; Volver</button>' +
        '<div id="kcm-section-title" style="font-size:14px;font-weight:700;color:#1e293b;flex:1;"></div>' +
      '</div>' +
      '<div id="kcm-section-content" style="flex:1;overflow-y:auto;padding:16px 18px;min-height:0;"></div>';

    contentEl.appendChild(contentHeader);
    contentEl.appendChild(actionEl);

    panel.appendChild(sidebarEl);
    panel.appendChild(contentEl);
    document.body.appendChild(panel);

    // ── Eventos ────────────────────────────────────────────────────────────────
    closeBtn.onclick = function() { panel.remove(); };

    var collapsed = false;
    colBtn.onclick = function() {
      collapsed = !collapsed;
      if (collapsed) {
        contentEl.style.display = 'none';
        panel.style.width = '180px';
        colBtn.innerHTML = '&#9658; Expandir';
      } else {
        contentEl.style.display = 'flex';
        panel.style.width = 'calc(180px + 50vw)';
        colBtn.innerHTML = '&#9668; Contraer';
      }
    };
  }

  // ── Arranque ─────────────────────────────────────────────────────────────────

  async function start() {
    createPanel();
    renderSidebarButtons();

    var base = state.baseUrl;
    for (var i = 0; i < MODULE_FILES.length; i++) {
      var result = await loadScript(base + MODULE_FILES[i]);
      if (!result.ok) showToast('No se pudo cargar: ' + MODULE_FILES[i], 'err');
      renderSidebarButtons();
    }

    console.log('Kymatio Content Management loaded:', VERSION, state.modules.map(function(m){ return m.key; }));
    showToast('Kymatio Gestión de Contenidos cargado', 'ok');
  }

  start();
})();
