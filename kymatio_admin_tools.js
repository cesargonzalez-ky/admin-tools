(function() {
  var existing = document.getElementById('kym-admin-panel');
  if (existing) existing.parentNode.removeChild(existing);

  var token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
  var companyId = '', companyName = '';
  try {
    var company = document.querySelector('#app').__vue_app__.config.globalProperties.$store.state.Admin.companySelected;
    companyId   = String(company.stakeholderId || '');
    companyName = company.name || '';
  } catch(e) {}

  var companyData = null;

  var SECTIONS = {
    services:   { label: 'Servicios',               icon: '&#9881;',   get: function(d) { return { services: d.servicesRaw && d.servicesRaw.distribution }; } },
    surveyflow: { label: 'Surveyflow',               icon: '&#128200;', get: function(d) { return { journey: { surveyflow: d.journey && d.journey.surveyflow } }; } },
    languages:  { label: 'Idiomas',                  icon: '&#127760;', get: function(d) { return { environment: { languages: d.environment && d.environment.languages } }; } },
    phish_dom:  { label: 'Phishing: Dominios',       icon: '&#128279;', get: function(d) { return { servicesConfiguration: { phishing: { domains: d.servicesConfiguration && d.servicesConfiguration.phishing && d.servicesConfiguration.phishing.domains } } }; } },
    phish_att:  { label: 'Phishing: Adjuntos',       icon: '&#128206;', get: function(d) { return { servicesConfiguration: { phishing: { attachment: d.servicesConfiguration && d.servicesConfiguration.phishing && d.servicesConfiguration.phishing.attachment } } }; } },
    phish_land: { label: 'Phishing: Post-landings',  icon: '&#128279;', get: function(d) { return { servicesConfiguration: { phishing: { landingRedirect: d.servicesConfiguration && d.servicesConfiguration.phishing && d.servicesConfiguration.phishing.landingRedirect } } }; } },
  };

  // ── Panel HTML ────────────────────────────────────────────────────────────
  var div = document.createElement('div');
  div.id = 'kym-admin-panel';
  div.style.cssText = 'position:fixed;top:0;right:0;width:560px;height:100vh;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.18);z-index:999999;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:13px;color:#1a202c;';

  var html = '';
  // Header
  html += '<div style="background:#1e293b;color:white;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">';
  html += '<div style="font-weight:700;font-size:15px">&#9881; Kymatio Admin Tools</div>';
  html += '<button id="kym-adm-close" style="background:none;border:none;color:white;font-size:22px;cursor:pointer;line-height:1">&#215;</button>';
  html += '</div>';

  html += '<div style="overflow-y:auto;flex:1;padding:18px">';

  // Banner empresa
  html += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-bottom:16px">';
  html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
  html += '<div style="font-size:22px">&#127970;</div>';
  html += '<div style="flex:1">';
  html += '<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Empresa activa</div>';
  html += '<div class="kym-company-name" style="font-size:18px;font-weight:700;color:#166534">' + (companyName||'&mdash; Sin empresa seleccionada') + '</div>';
  html += '<div style="font-size:11px;color:#64748b">ID: <span class="kym-company-id">' + (companyId||'?') + '</span></div>';
  html += '</div></div>';
  html += '<button id="kym-adm-refresh-company" style="width:100%;background:#166534;color:white;border:none;padding:8px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">&#8635; Actualizar empresa y datos</button>';
  html += '</div>';

  // Secciones — botones
  html += '<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Selecciona una sección</div>';
  html += '<div id="kym-adm-sections" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
  Object.keys(SECTIONS).forEach(function(key) {
    var s = SECTIONS[key];
    html += '<div style="display:flex;gap:8px;align-items:center">';
    html += '<button data-section="' + key + '" class="kym-sec-btn" style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;text-align:left;cursor:pointer;font-size:13px;font-weight:600;color:#1a202c;display:flex;align-items:center;gap:8px">';
    html += '<span>' + s.icon + '</span><span>' + s.label + '</span>';
    html += '</button>';
    html += '</div>';
  });
  html += '</div>';

  // Área de acción (aparece al seleccionar sección)
  html += '<div id="kym-adm-action" style="display:none">';
  html += '<hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:16px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  html += '<div id="kym-adm-section-title" style="font-size:14px;font-weight:700;color:#1a202c"></div>';
  html += '<button id="kym-adm-back" style="background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;text-decoration:underline">&#8592; Volver</button>';
  html += '</div>';
  html += '<a id="kym-adm-btn-chatgpt" href="https://chatgpt.com/g/g-p-69b2862052e081918097b93ab359f603/c/6a3259aa-3cb8-832d-92e0-6cdc22a46eee" target="_blank" style="display:none;width:100%;box-sizing:border-box;margin-bottom:10px;background:#10a37f;color:white;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;text-align:center">&#129302; Abrir ChatGPT &mdash; Surveyflows</a>';
  // Botones Ver / Modificar
  html += '<div id="kym-adm-mode-switch" style="display:none;margin-bottom:8px">';
  html += '<button id="kym-adm-langs-switch" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;color:#475569">{ } Modo JSON</button>';
  html += '</div>';
  html += '<div id="kym-adm-btns-row" style="display:flex;gap:8px;margin-bottom:14px">';
  html += '<button id="kym-adm-btn-view" style="flex:1;background:#00b89c;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#128065; Ver actual</button>';
  html += '<button id="kym-adm-btn-edit" style="flex:1;background:#3b82f6;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#9998; Modificar</button>';
  html += '</div>';

  // Panel "Ver"
  html += '<div id="kym-adm-view-panel" style="display:none">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html += '<span style="font-size:11px;font-weight:600;color:#64748b">JSON ACTUAL</span>';
  html += '<button id="kym-adm-copy" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;color:#475569">&#128203; Copiar</button>';
  html += '</div>';
  html += '<pre id="kym-adm-json-view" style="background:#0f172a;color:#34d399;border-radius:8px;padding:14px;font-size:11px;font-family:Menlo,Consolas,monospace;overflow:auto;max-height:400px;white-space:pre-wrap;word-break:break-all;margin:0"></pre>';
  html += '</div>';

  // Panel "Modificar"
  html += '<div id="kym-adm-edit-panel" style="display:none">';
  html += '<div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px">EDITAR JSON</div>';
  html += '<textarea id="kym-adm-json-edit" style="width:100%;height:300px;background:#0f172a;color:#fbbf24;border:1px solid #334155;border-radius:8px;padding:14px;font-size:11px;font-family:Menlo,Consolas,monospace;resize:vertical;outline:none"></textarea>';
  html += '<div style="display:flex;gap:8px;margin-top:10px">';
  html += '<button id="kym-adm-btn-load" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">&#8635; Cargar actual</button>';
  html += '<button id="kym-adm-btn-save" style="flex:1;background:#3b82f6;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Actualizar</button>';
  html += '</div>';
  html += '<div id="kym-adm-save-status" style="display:none;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center"></div>';
  html += '</div>';

  // Panel GUI Idiomas
  html += '<div id="kym-adm-gui-langs" style="display:none">';
  html += '<div style="margin-bottom:10px">';
  html += '<span style="font-size:11px;font-weight:600;color:#64748b">IDIOMAS DISPONIBLES</span>';
  html += '</div>';
  html += '<div id="kym-adm-langs-list" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-es-es">' +
    '<input type="checkbox" id="kym-lang-es-es" value="es-es" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Español</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">es-es</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-es-mx">' +
    '<input type="checkbox" id="kym-lang-es-mx" value="es-mx" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Español (Latam)</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">es-mx</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-en-us">' +
    '<input type="checkbox" id="kym-lang-en-us" value="en-us" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Inglés</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">en-us</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-eu">' +
    '<input type="checkbox" id="kym-lang-eu" value="eu" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Euskera</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">eu</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-pl">' +
    '<input type="checkbox" id="kym-lang-pl" value="pl" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Polaco</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">pl</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-cat">' +
    '<input type="checkbox" id="kym-lang-cat" value="cat" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Catalán</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">cat</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-pt-pt">' +
    '<input type="checkbox" id="kym-lang-pt-pt" value="pt-pt" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Portugués (Portugal)</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">pt-pt</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-pt-br">' +
    '<input type="checkbox" id="kym-lang-pt-br" value="pt-br" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Portugués (Brasil)</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">pt-br</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-sv">' +
    '<input type="checkbox" id="kym-lang-sv" value="sv" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Sueco</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">sv</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-fr">' +
    '<input type="checkbox" id="kym-lang-fr" value="fr" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Francés</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">fr</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-it">' +
    '<input type="checkbox" id="kym-lang-it" value="it" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Italiano</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">it</span>' +
  '</label>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc" id="kym-lang-row-de">' +
    '<input type="checkbox" id="kym-lang-de" value="de" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">' +
    '<span style="flex:1;font-size:13px">Alemán</span>' +
    '<span style="font-size:11px;color:#94a3b8;font-family:monospace">de</span>' +
  '</label>';
  html += '</div>';
  html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px">';
  html += '<div style="font-size:11px;font-weight:600;color:#1e40af;margin-bottom:6px">IDIOMA POR DEFECTO</div>';
  html += '<select id="kym-adm-lang-default" style="width:100%;padding:7px 10px;border:1px solid #bfdbfe;border-radius:6px;font-size:13px;background:white;color:#1a202c"></select>';
  html += '<div id="kym-adm-lang-default-err" style="display:none;color:#e53e3e;font-size:11px;margin-top:4px">&#9888; Debes tener al menos un idioma activo y seleccionar el idioma por defecto</div>';
  html += '</div>';
  html += '<button id="kym-adm-langs-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar idiomas</button>';
  html += '<div id="kym-adm-langs-status" style="display:none;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center"></div>';
  html += '</div>'; // gui-langs

  // Panel GUI Servicios
  html += '<div id="kym-adm-gui-services" style="display:none">';
  html += '<div style="margin-bottom:10px"><span style="font-size:11px;font-weight:600;color:#64748b">SERVICIOS</span></div>';
  html += '<div id="kym-adm-services-list" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-1">';
  html += '<input type="checkbox" id="kym-svc-1" value="1" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">1 — Concienciación</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-2">';
  html += '<input type="checkbox" id="kym-svc-2" value="2" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">2 — Bienestar</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-3">';
  html += '<input type="checkbox" id="kym-svc-3" value="3" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">3 — GRI</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-4">';
  html += '<input type="checkbox" id="kym-svc-4" value="4" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">4 — Phishing</span>';
  html += '</label>';
  html += '<div style="grid-column:1/-1;padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc" id="kym-svc-row-5">';
  html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
  html += '<input type="checkbox" id="kym-svc-5" value="5" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:13px">5 — ABS</span>';
  html += '</div>';
  html += '<div id="kym-abs-mode-row" style="display:none;padding-left:25px">';
  html += '<select id="kym-abs-mode" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;background:white">';
  html += '<option value="informativo">Informativo</option>';
  html += '<option value="silencioso">Silencioso</option>';
  html += '<option value="analisis">An\u00e1lisis</option>';
  html += '</select></div>';
  html += '</div>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-6">';
  html += '<input type="checkbox" id="kym-svc-6" value="6" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">6 — Federación (SAML)</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-7">';
  html += '<input type="checkbox" id="kym-svc-7" value="7" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">7 — Neurophishing</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-8">';
  html += '<input type="checkbox" id="kym-svc-8" value="8" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">8 — Burnout</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-9">';
  html += '<input type="checkbox" id="kym-svc-9" value="9" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">9 — SCIM</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-10">';
  html += '<input type="checkbox" id="kym-svc-10" value="10" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">10 — Smishing</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;opacity:.5;cursor:not-allowed" id="kym-svc-row-11">';
  html += '<input type="checkbox" id="kym-svc-11" value="11" disabled style="width:15px;height:15px;cursor:not-allowed">';
  html += '<span style="flex:1;font-size:12px;color:#94a3b8">11 — Neurosmishing</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-12">';
  html += '<input type="checkbox" id="kym-svc-12" value="12" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">12 — Impacto</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-13">';
  html += '<input type="checkbox" id="kym-svc-13" value="13" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">13 — Ingeniería Social</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-14">';
  html += '<input type="checkbox" id="kym-svc-14" value="14" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">14 — Arquetipo</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-15">';
  html += '<input type="checkbox" id="kym-svc-15" value="15" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">15 — Ranking</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-16">';
  html += '<input type="checkbox" id="kym-svc-16" value="16" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">16 — Personalización de sesiones</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-17">';
  html += '<input type="checkbox" id="kym-svc-17" value="17" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">17 — Logros</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;opacity:.5;cursor:not-allowed" id="kym-svc-row-18">';
  html += '<input type="checkbox" id="kym-svc-18" value="18" disabled style="width:15px;height:15px;cursor:not-allowed">';
  html += '<span style="flex:1;font-size:12px;color:#94a3b8">18 — Gamificación</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-19">';
  html += '<input type="checkbox" id="kym-svc-19" value="19" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">19 — HRM (Human Risk Management)</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-20">';
  html += '<input type="checkbox" id="kym-svc-20" value="20" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">20 — MFA (Múltiple Factor de Autenticación)</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-21">';
  html += '<input type="checkbox" id="kym-svc-21" value="21" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">21 — Vishing</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;opacity:.5;cursor:not-allowed" id="kym-svc-row-22">';
  html += '<input type="checkbox" id="kym-svc-22" value="22" disabled style="width:15px;height:15px;cursor:not-allowed">';
  html += '<span style="flex:1;font-size:12px;color:#94a3b8">22 — Neurovishing</span>';
  html += '</label>';
  html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer" id="kym-svc-row-23">';
  html += '<input type="checkbox" id="kym-svc-23" value="23" style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
  html += '<span style="flex:1;font-size:12px">23 — Formación (NIS...)</span>';
  html += '</label>';
  html += '</div>'; // services-list
  html += '<button id="kym-adm-services-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar servicios</button>';
  html += '<div id="kym-adm-services-status" style="display:none;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center"></div>';
  html += '</div>'; // gui-services

  // Panel GUI Phishing Adjuntos
  html += '<div id="kym-adm-gui-phish-att" style="display:none">';
  html += '<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">';
  html += '<span style="font-size:11px;font-weight:600;color:#64748b">ADJUNTOS DE PHISHING</span>';
  html += '<button id="kym-att-add" style="background:#0369a1;color:white;border:none;padding:5px 12px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">+ A\u00f1adir adjunto</button>';
  html += '</div>';
  html += '<div id="kym-att-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px"></div>';
  html += '<button id="kym-att-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar adjuntos</button>';
  html += '<div id="kym-att-status" style="display:none;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center"></div>';
  html += '</div>'; // gui-phish-att

  // Modal para editar adjunto
  html += '<div id="kym-att-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000000;align-items:center;justify-content:center">';
  html += '<div style="background:white;border-radius:12px;padding:24px;width:460px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
  html += '<div style="font-size:15px;font-weight:700;color:#1a202c" id="kym-att-modal-title">Adjunto</div>';
  html += '<button id="kym-att-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b;line-height:1">&#215;</button>';
  html += '</div>';
  html += '<div id="kym-att-modal-body" style="display:flex;flex-direction:column;gap:12px"></div>';
  html += '<div style="display:flex;gap:8px;margin-top:16px">';
  html += '<select id="kym-att-modal-lang-add" style="flex:1;padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px"></select>';
  html += '<button id="kym-att-modal-add-lang" style="background:#0369a1;color:white;border:none;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">+ Idioma</button>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-top:12px">';
  html += '<button id="kym-att-modal-cancel" style="flex:1;background:white;border:1px solid #e2e8f0;color:#475569;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">Cancelar</button>';
  html += '<button id="kym-att-modal-save" style="flex:1;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Aplicar</button>';
  html += '</div>';
  html += '</div></div>'; // modal

  html += '</div>'; // kym-adm-action
  html += '</div>'; // scroll

  div.innerHTML = html;
  document.body.appendChild(div);

  // ── Estado ────────────────────────────────────────────────────────────────
  var currentSection = null;

  function apiH() { return {'Content-Type':'application/json','Authorization':'Bearer ' + token}; }

  function getToken() { return token; }
  function getCid()   { return companyId; }

  // ── Cerrar ────────────────────────────────────────────────────────────────
  document.getElementById('kym-adm-close').onclick = function() { div.style.display = 'none'; };

  document.getElementById('kym-adm-refresh-company').onclick = function() {
    try {
      var company = document.querySelector('#app').__vue_app__.config.globalProperties.$store.state.Admin.companySelected;
      companyId   = String(company.stakeholderId || '');
      companyName = company.name || '';
    } catch(e) {}
    companyData = null; // invalidar cache
    document.querySelector('#kym-admin-panel .kym-company-name').textContent = companyName || '—';
    document.querySelector('#kym-admin-panel .kym-company-id').textContent   = companyId  || '?';
    // Volver a la pantalla inicial
    document.getElementById('kym-adm-action').style.display = 'none';
    document.getElementById('kym-adm-view-panel').style.display = 'none';
    document.getElementById('kym-adm-edit-panel').style.display = 'none';
    currentSection = null;
  };
  document.getElementById('kym-adm-back').onclick  = function() {
    document.getElementById('kym-adm-action').style.display = 'none';
    document.getElementById('kym-adm-view-panel').style.display = 'none';
    document.getElementById('kym-adm-edit-panel').style.display = 'none';
    currentSection = null;
  };

  // ── Seleccionar sección ───────────────────────────────────────────────────
  document.querySelectorAll('.kym-sec-btn').forEach(function(btn) {
    btn.onclick = function() {
      currentSection = this.getAttribute('data-section');
      companyData = null;
      var s = SECTIONS[currentSection];
      document.getElementById('kym-adm-section-title').innerHTML = s.icon + ' ' + s.label;
      document.getElementById('kym-adm-action').style.display = 'block';
      document.getElementById('kym-adm-btn-chatgpt').style.display = (currentSection === 'surveyflow') ? 'block' : 'none';
      document.getElementById('kym-adm-view-panel').style.display = 'none';
      document.getElementById('kym-adm-edit-panel').style.display = 'none';
      document.getElementById('kym-adm-gui-langs').style.display = 'none';
      document.getElementById('kym-adm-save-status').style.display = 'none';
      // GUI o botones según sección
      var isGuiLangs   = (currentSection === 'languages');
      var isGuiSvc     = (currentSection === 'services');
      var isGuiPhishAtt= (currentSection === 'phish_att');
      var isGui = isGuiLangs || isGuiSvc || isGuiPhishAtt;
      document.getElementById('kym-adm-mode-switch').style.display    = isGui ? 'block' : 'none';
      document.getElementById('kym-adm-btns-row').style.display       = isGui ? 'none'  : 'flex';
      document.getElementById('kym-adm-gui-services').style.display   = 'none';
      document.getElementById('kym-adm-gui-phish-att').style.display  = 'none';
      if (isGuiLangs)    { showLangsGui(); }
      if (isGuiSvc)      { showServicesGui(); }
      if (isGuiPhishAtt) { showPhishAttGui(); }
    };
  });;

  // ── Cargar datos de la empresa ────────────────────────────────────────────
  async function loadCompanyData() {
    if (companyData) return companyData;
    var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/' + getCid() + '?environment=true&journey=true&services=true', {headers: apiH()});
    var d = await res.json();
    companyData = d.records || d;
    return companyData;
  }

  function getSectionData() {
    if (!companyData || !currentSection) return null;
    return SECTIONS[currentSection].get(companyData);
  }

  // ── Ver actual ────────────────────────────────────────────────────────────
  document.getElementById('kym-adm-btn-view').onclick = async function() {
    document.getElementById('kym-adm-view-panel').style.display = 'block';
    document.getElementById('kym-adm-edit-panel').style.display = 'none';
    document.getElementById('kym-adm-json-view').textContent = 'Cargando...';
    var data = await loadCompanyData();
    var section = getSectionData();
    document.getElementById('kym-adm-json-view').textContent = JSON.stringify(section, null, 2);
  };

  // ── Copiar ────────────────────────────────────────────────────────────────
  document.getElementById('kym-adm-copy').onclick = function() {
    var text = document.getElementById('kym-adm-json-view').textContent;
    navigator.clipboard.writeText(text).then(function() {
      document.getElementById('kym-adm-copy').innerHTML = '&#10003; Copiado';
      setTimeout(function() { document.getElementById('kym-adm-copy').innerHTML = '&#128203; Copiar'; }, 1500);
    });
  };

  // ── Modificar ─────────────────────────────────────────────────────────────
  document.getElementById('kym-adm-btn-edit').onclick = function() {
    document.getElementById('kym-adm-edit-panel').style.display = 'block';
    document.getElementById('kym-adm-view-panel').style.display = 'none';
    document.getElementById('kym-adm-save-status').textContent = '';
  };

  // Cargar actual en el editor
  document.getElementById('kym-adm-btn-load').onclick = async function() {
    document.getElementById('kym-adm-json-edit').value = 'Cargando...';
    await loadCompanyData();
    var section = getSectionData();
    document.getElementById('kym-adm-json-edit').value = JSON.stringify(section, null, 2);
  };

  // ── Guardar ───────────────────────────────────────────────────────────────
  document.getElementById('kym-adm-btn-save').onclick = async function() {
    var status = document.getElementById('kym-adm-save-status');

    function showStatus(msg, type) {
      var styles = {
        err:  'background:#fff5f5;border:1px solid #fed7d7;color:#c53030',
        ok:   'background:#f0fff4;border:1px solid #9ae6b4;color:#276749',
        info: 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af'
      };
      status.style.cssText = 'display:block;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;' + (styles[type] || styles.info);
      status.innerHTML = msg;
    }

    var raw = document.getElementById('kym-adm-json-edit').value.trim();
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      showStatus('&#10007; JSON no valido: ' + e.message, 'err');
      return;
    }

    var sectionLabel = SECTIONS[currentSection] ? SECTIONS[currentSection].label : currentSection;
    if (!confirm('Se va a proceder a la modificacion de ' + sectionLabel + ' de la empresa ' + companyName + '.\n\n¿Quieres continuar?')) {
      status.style.display = 'none';
      return;
    }

    showStatus('&#8987; Guardando...', 'info');

    try {
      var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/' + getCid(), {
        method: 'PUT',
        headers: apiH(),
        body: JSON.stringify(parsed)
      });
      var rdata = await res.json();
      if (res.ok || res.status === 200) {
        companyData = null;
        showStatus('&#10003; Cambios realizados correctamente en ' + sectionLabel, 'ok');
      } else {
        var msg = (rdata.records && rdata.records.devMessage) || rdata.message || res.status;
        showStatus('&#10007; Error: ' + msg, 'err');
      }
    } catch(e) {
      showStatus('&#10007; Error de red: ' + e.message, 'err');
    }
  };


  // ── GUI Idiomas ─────────────────────────────────────────────────────────────
  async function showLangsGui() {
    guiMode = true;
    document.getElementById('kym-adm-gui-langs').style.display = 'block';
    document.getElementById('kym-adm-gui-services').style.display = 'none';
    document.getElementById('kym-adm-gui-phish-att').style.display = 'none';
    document.getElementById('kym-adm-btns-row').style.display = 'none';
    document.getElementById('kym-adm-view-panel').style.display = 'none';
    document.getElementById('kym-adm-edit-panel').style.display = 'none';
    document.getElementById('kym-adm-langs-status').style.display = 'none';
    document.getElementById('kym-adm-langs-switch').innerHTML = '{ } Modo JSON';

    var data = await loadCompanyData();
    var langs   = data.environment && data.environment.languages;
    var list    = (langs && langs.list)    || [];
    var defLang = (langs && langs.default) || '';

    // Marcar checkboxes
    document.getElementById('kym-lang-es-es').checked = list.indexOf('es-es') >= 0;
    document.getElementById('kym-lang-es-mx').checked = list.indexOf('es-mx') >= 0;
    document.getElementById('kym-lang-en-us').checked = list.indexOf('en-us') >= 0;
    document.getElementById('kym-lang-eu').checked = list.indexOf('eu') >= 0;
    document.getElementById('kym-lang-pl').checked = list.indexOf('pl') >= 0;
    document.getElementById('kym-lang-cat').checked = list.indexOf('cat') >= 0;
    document.getElementById('kym-lang-pt-pt').checked = list.indexOf('pt-pt') >= 0;
    document.getElementById('kym-lang-pt-br').checked = list.indexOf('pt-br') >= 0;
    document.getElementById('kym-lang-sv').checked = list.indexOf('sv') >= 0;
    document.getElementById('kym-lang-fr').checked = list.indexOf('fr') >= 0;
    document.getElementById('kym-lang-it').checked = list.indexOf('it') >= 0;
    document.getElementById('kym-lang-de').checked = list.indexOf('de') >= 0;

    updateLangDefault(defLang);
    updateLangRows();
  }

  function updateLangRows() {
    var r0 = document.getElementById('kym-lang-row-es-es');
    if (r0) { r0.style.background = document.getElementById('kym-lang-es-es').checked ? '#f0fdf4' : '#f8fafc'; r0.style.borderColor = document.getElementById('kym-lang-es-es').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r1 = document.getElementById('kym-lang-row-es-mx');
    if (r1) { r1.style.background = document.getElementById('kym-lang-es-mx').checked ? '#f0fdf4' : '#f8fafc'; r1.style.borderColor = document.getElementById('kym-lang-es-mx').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r2 = document.getElementById('kym-lang-row-en-us');
    if (r2) { r2.style.background = document.getElementById('kym-lang-en-us').checked ? '#f0fdf4' : '#f8fafc'; r2.style.borderColor = document.getElementById('kym-lang-en-us').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r3 = document.getElementById('kym-lang-row-eu');
    if (r3) { r3.style.background = document.getElementById('kym-lang-eu').checked ? '#f0fdf4' : '#f8fafc'; r3.style.borderColor = document.getElementById('kym-lang-eu').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r4 = document.getElementById('kym-lang-row-pl');
    if (r4) { r4.style.background = document.getElementById('kym-lang-pl').checked ? '#f0fdf4' : '#f8fafc'; r4.style.borderColor = document.getElementById('kym-lang-pl').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r5 = document.getElementById('kym-lang-row-cat');
    if (r5) { r5.style.background = document.getElementById('kym-lang-cat').checked ? '#f0fdf4' : '#f8fafc'; r5.style.borderColor = document.getElementById('kym-lang-cat').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r6 = document.getElementById('kym-lang-row-pt-pt');
    if (r6) { r6.style.background = document.getElementById('kym-lang-pt-pt').checked ? '#f0fdf4' : '#f8fafc'; r6.style.borderColor = document.getElementById('kym-lang-pt-pt').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r6b = document.getElementById('kym-lang-row-pt-br');
    if (r6b) { r6b.style.background = document.getElementById('kym-lang-pt-br').checked ? '#f0fdf4' : '#f8fafc'; r6b.style.borderColor = document.getElementById('kym-lang-pt-br').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r7 = document.getElementById('kym-lang-row-sv');
    if (r7) { r7.style.background = document.getElementById('kym-lang-sv').checked ? '#f0fdf4' : '#f8fafc'; r7.style.borderColor = document.getElementById('kym-lang-sv').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r8 = document.getElementById('kym-lang-row-fr');
    if (r8) { r8.style.background = document.getElementById('kym-lang-fr').checked ? '#f0fdf4' : '#f8fafc'; r8.style.borderColor = document.getElementById('kym-lang-fr').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r9 = document.getElementById('kym-lang-row-it');
    if (r9) { r9.style.background = document.getElementById('kym-lang-it').checked ? '#f0fdf4' : '#f8fafc'; r9.style.borderColor = document.getElementById('kym-lang-it').checked ? '#bbf7d0' : '#e2e8f0'; }
    var r10 = document.getElementById('kym-lang-row-de');
    if (r10) { r10.style.background = document.getElementById('kym-lang-de').checked ? '#f0fdf4' : '#f8fafc'; r10.style.borderColor = document.getElementById('kym-lang-de').checked ? '#bbf7d0' : '#e2e8f0'; }
  }

  function updateLangDefault(current) {
    var sel = document.getElementById('kym-adm-lang-default');
    if (!sel) return;
    sel.innerHTML = '';
    if (document.getElementById('kym-lang-es-es').checked) { var o=document.createElement('option'); o.value='es-es'; o.textContent='Español (es-es)'; if(current==='es-es') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-es-mx').checked) { var o=document.createElement('option'); o.value='es-mx'; o.textContent='Español (Latam) (es-mx)'; if(current==='es-mx') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-en-us').checked) { var o=document.createElement('option'); o.value='en-us'; o.textContent='Inglés (en-us)'; if(current==='en-us') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-eu').checked) { var o=document.createElement('option'); o.value='eu'; o.textContent='Euskera (eu)'; if(current==='eu') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-pl').checked) { var o=document.createElement('option'); o.value='pl'; o.textContent='Polaco (pl)'; if(current==='pl') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-cat').checked) { var o=document.createElement('option'); o.value='cat'; o.textContent='Catalán (cat)'; if(current==='cat') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-pt-pt').checked) { var o=document.createElement('option'); o.value='pt-pt'; o.textContent='Portugués (Portugal) (pt-pt)'; if(current==='pt-pt') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-sv').checked) { var o=document.createElement('option'); o.value='sv'; o.textContent='Sueco (sv)'; if(current==='sv') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-fr').checked) { var o=document.createElement('option'); o.value='fr'; o.textContent='Francés (fr)'; if(current==='fr') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-it').checked) { var o=document.createElement('option'); o.value='it'; o.textContent='Italiano (it)'; if(current==='it') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-pt-br').checked) { var o=document.createElement('option'); o.value='pt-br'; o.textContent='Portugués (Brasil) (pt-br)'; if(current==='pt-br') o.selected=true; sel.appendChild(o); }
    if (document.getElementById('kym-lang-de').checked) { var o=document.createElement('option'); o.value='de'; o.textContent='Alemán (de)'; if(current==='de') o.selected=true; sel.appendChild(o); }
  }

  // Checkboxes onchange
  ['kym-lang-es-es','kym-lang-es-mx','kym-lang-en-us','kym-lang-eu','kym-lang-pl','kym-lang-cat','kym-lang-pt-pt','kym-lang-pt-br','kym-lang-sv','kym-lang-fr','kym-lang-it','kym-lang-de'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', function() {
      var cur = document.getElementById('kym-adm-lang-default').value;
      updateLangDefault(cur);
      updateLangRows();
      document.getElementById('kym-adm-lang-default-err').style.display = 'none';
    });
  });

  // Switch GUI/JSON
  var guiMode = true;
  var langsSwitch = document.getElementById('kym-adm-langs-switch');
  document.getElementById('kym-adm-langs-switch').onclick = function() {
    guiMode = !guiMode;
    if (guiMode) {
      document.getElementById('kym-adm-btns-row').style.display = 'none';
      document.getElementById('kym-adm-view-panel').style.display = 'none';
      document.getElementById('kym-adm-edit-panel').style.display = 'none';
      this.innerHTML = '{ } Modo JSON';
      if (currentSection === 'languages') showLangsGui();
      if (currentSection === 'services')  showServicesGui();
    } else {
      document.getElementById('kym-adm-gui-langs').style.display = 'none';
      document.getElementById('kym-adm-gui-services').style.display = 'none';
      document.getElementById('kym-adm-gui-phish-att').style.display = 'none';
      document.getElementById('kym-adm-btns-row').style.display = 'flex';
      this.innerHTML = '&#127770; Modo GUI';
    }
  };

  // Guardar idiomas
  var langsSave = document.getElementById('kym-adm-langs-save');
  if (langsSave) langsSave.onclick = async function() {
    var status = document.getElementById('kym-adm-langs-status');
    var errEl  = document.getElementById('kym-adm-lang-default-err');
    var selected = [];
    if (document.getElementById('kym-lang-es-es').checked) selected.push('es-es');
    if (document.getElementById('kym-lang-es-mx').checked) selected.push('es-mx');
    if (document.getElementById('kym-lang-en-us').checked) selected.push('en-us');
    if (document.getElementById('kym-lang-eu').checked) selected.push('eu');
    if (document.getElementById('kym-lang-pl').checked) selected.push('pl');
    if (document.getElementById('kym-lang-cat').checked) selected.push('cat');
    if (document.getElementById('kym-lang-pt-pt').checked) selected.push('pt-pt');
    if (document.getElementById('kym-lang-pt-br').checked) selected.push('pt-br');
    if (document.getElementById('kym-lang-sv').checked) selected.push('sv');
    if (document.getElementById('kym-lang-fr').checked) selected.push('fr');
    if (document.getElementById('kym-lang-it').checked) selected.push('it');
    if (document.getElementById('kym-lang-de').checked) selected.push('de');

    var defLang = document.getElementById('kym-adm-lang-default').value;
    if (selected.length === 0 || !defLang || selected.indexOf(defLang) < 0) {
      errEl.style.display = 'block'; return;
    }
    errEl.style.display = 'none';

    var sectionLabel = 'Idiomas';
    if (!confirm('Se van a guardar los idiomas de ' + companyName + '.\n\nIdiomas: ' + selected.join(', ') + '\nDefault: ' + defLang + '\n\n\u00bfQuieres continuar?')) return;

    function showSt(msg, type) {
      var styles = {ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749', err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030', info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af'};
      status.style.cssText = 'display:block;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;' + (styles[type]||styles.info);
      status.innerHTML = msg;
    }
    showSt('&#8987; Guardando...', 'info');
    try {
      var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/' + getCid(), {
        method: 'PUT', headers: apiH(),
        body: JSON.stringify({ environment: { languages: { list: selected, default: defLang } } })
      });
      var rdata = await res.json();
      if (res.ok || res.status === 200) {
        companyData = null;
        showSt('&#10003; Idiomas guardados correctamente en ' + sectionLabel, 'ok');
      } else {
        var msg = (rdata.records&&rdata.records.devMessage)||rdata.message||res.status;
        showSt('&#10007; Error: ' + msg, 'err');
      }
    } catch(e) { showSt('&#10007; Error de red: ' + e.message, 'err'); }
  };


  // ── GUI Servicios ──────────────────────────────────────────────────────────
  async function showServicesGui() {
    document.getElementById('kym-adm-gui-services').style.display = 'block';
    document.getElementById('kym-adm-gui-langs').style.display = 'none';
    document.getElementById('kym-adm-gui-phish-att').style.display = 'none';
    document.getElementById('kym-adm-view-panel').style.display = 'none';
    document.getElementById('kym-adm-edit-panel').style.display = 'none';
    document.getElementById('kym-adm-services-status').style.display = 'none';
    document.getElementById('kym-adm-langs-switch').innerHTML = '{ } Modo JSON';

    var data = await loadCompanyData();
    var dist = data.servicesRaw && data.servicesRaw.distribution || {};
    var userSvcs  = dist.USER       || [];
    var adminSvcs = dist.ADMIN      || [];
    var ctrlSvcs  = dist.CONTROLLER || [];

    // Un servicio está "activo" si está en USER o ADMIN o CONTROLLER
    function isActive(id) {
      return userSvcs.indexOf(id)>=0 || adminSvcs.indexOf(id)>=0 || ctrlSvcs.indexOf(id)>=0;
    }

    var cb1 = document.getElementById('kym-svc-1');
    if (cb1) { cb1.checked = isActive(1); updateSvcRow(1); }
    var cb2 = document.getElementById('kym-svc-2');
    if (cb2) { cb2.checked = isActive(2); updateSvcRow(2); }
    var cb3 = document.getElementById('kym-svc-3');
    if (cb3) { cb3.checked = isActive(3); updateSvcRow(3); }
    var cb4 = document.getElementById('kym-svc-4');
    if (cb4) { cb4.checked = isActive(4); updateSvcRow(4); }
    var cb5 = document.getElementById('kym-svc-5');
    if (cb5) { cb5.checked = isActive(5); updateSvcRow(5); }
    var cb6 = document.getElementById('kym-svc-6');
    if (cb6) { cb6.checked = isActive(6); updateSvcRow(6); }
    var cb7 = document.getElementById('kym-svc-7');
    if (cb7) { cb7.checked = isActive(7); updateSvcRow(7); }
    var cb8 = document.getElementById('kym-svc-8');
    if (cb8) { cb8.checked = isActive(8); updateSvcRow(8); }
    var cb9 = document.getElementById('kym-svc-9');
    if (cb9) { cb9.checked = isActive(9); updateSvcRow(9); }
    var cb10 = document.getElementById('kym-svc-10');
    if (cb10) { cb10.checked = isActive(10); updateSvcRow(10); }
    var cb11 = document.getElementById('kym-svc-11');
    if (cb11) { cb11.checked = isActive(11); updateSvcRow(11); }
    var cb12 = document.getElementById('kym-svc-12');
    if (cb12) { cb12.checked = isActive(12); updateSvcRow(12); }
    var cb13 = document.getElementById('kym-svc-13');
    if (cb13) { cb13.checked = isActive(13); updateSvcRow(13); }
    var cb14 = document.getElementById('kym-svc-14');
    if (cb14) { cb14.checked = isActive(14); updateSvcRow(14); }
    var cb15 = document.getElementById('kym-svc-15');
    if (cb15) { cb15.checked = isActive(15); updateSvcRow(15); }
    var cb16 = document.getElementById('kym-svc-16');
    if (cb16) { cb16.checked = isActive(16); updateSvcRow(16); }
    var cb17 = document.getElementById('kym-svc-17');
    if (cb17) { cb17.checked = isActive(17); updateSvcRow(17); }
    var cb18 = document.getElementById('kym-svc-18');
    if (cb18) { cb18.checked = isActive(18); updateSvcRow(18); }
    var cb19 = document.getElementById('kym-svc-19');
    if (cb19) { cb19.checked = isActive(19); updateSvcRow(19); }
    var cb20 = document.getElementById('kym-svc-20');
    if (cb20) { cb20.checked = isActive(20); updateSvcRow(20); }
    var cb21 = document.getElementById('kym-svc-21');
    if (cb21) { cb21.checked = isActive(21); updateSvcRow(21); }
    var cb22 = document.getElementById('kym-svc-22');
    if (cb22) { cb22.checked = isActive(22); updateSvcRow(22); }
    var cb23 = document.getElementById('kym-svc-23');
    if (cb23) { cb23.checked = isActive(23); updateSvcRow(23); }

    // ABS: detectar modo
    var absCb = document.getElementById('kym-svc-5');
    var absModeRow = document.getElementById('kym-abs-mode-row');
    var absModeEl  = document.getElementById('kym-abs-mode');
    if (absCb && absCb.checked) {
      absModeRow.style.display = 'block';
      var inUser  = userSvcs.indexOf(5) >= 0;
      var inCtrl  = ctrlSvcs.indexOf(5) >= 0;
      var inAdmin = adminSvcs.indexOf(5) >= 0;
      if (inUser && inCtrl && inAdmin)       absModeEl.value = 'informativo';
      else if (!inUser && inCtrl && inAdmin) absModeEl.value = 'silencioso';
      else if (!inUser && !inCtrl && inAdmin) absModeEl.value = 'analisis';
      else absModeEl.value = 'informativo';
    } else if (absModeRow) {
      absModeRow.style.display = 'none';
    }
  }

  function updateSvcRow(id) {
    var cb  = document.getElementById('kym-svc-'+id);
    var row = document.getElementById('kym-svc-row-'+id);
    if (!cb || !row) return;
    if (id === 5) {
      row.style.background   = cb.checked ? '#f0fdf4' : '#f8fafc';
      row.style.borderColor  = cb.checked ? '#bbf7d0' : '#e2e8f0';
      var mr = document.getElementById('kym-abs-mode-row');
      if (mr) mr.style.display = cb.checked ? 'block' : 'none';
    } else {
      row.style.background  = cb.checked ? '#f0fdf4' : '#f8fafc';
      row.style.borderColor = cb.checked ? '#bbf7d0' : '#e2e8f0';
    }
  }

  // Checkboxes de servicios
  [1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,19,20,21,23].forEach(function(id) {
    var el = document.getElementById('kym-svc-'+id);
    if (el) el.addEventListener('change', function() {
      updateSvcRow(id);
      // Regla: Neurophishing (7) requiere Ingeniería Social (13)
      if (id === 13) {
        var cb7 = document.getElementById('kym-svc-7');
        var cb13 = document.getElementById('kym-svc-13');
        if (cb7 && cb13 && !cb13.checked) {
          cb7.checked = false;
          updateSvcRow(7);
        }
      }
      if (id === 7) {
        var cb7 = document.getElementById('kym-svc-7');
        var cb13 = document.getElementById('kym-svc-13');
        if (cb7 && cb7.checked && cb13 && !cb13.checked) {
          cb7.checked = false;
          updateSvcRow(7);
          alert('Neurophishing requiere tener activa Ingenier\u00eda Social.');
        }
      }
    });
  });

  // Guardar servicios
  var svcSave = document.getElementById('kym-adm-services-save');
  if (svcSave) svcSave.onclick = async function() {
    var status = document.getElementById('kym-adm-services-status');
    function showSt(msg, type) {
      var styles = {ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749',err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030',info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af'};
      status.style.cssText = 'display:block;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;'+(styles[type]||styles.info);
      status.innerHTML = msg;
    }

    // Recoger servicios activos (excepto ABS que se trata aparte)
    var active = [];
    if (document.getElementById('kym-svc-1') && document.getElementById('kym-svc-1').checked && 1 !== 5) active.push(1);
    if (document.getElementById('kym-svc-2') && document.getElementById('kym-svc-2').checked && 2 !== 5) active.push(2);
    if (document.getElementById('kym-svc-3') && document.getElementById('kym-svc-3').checked && 3 !== 5) active.push(3);
    if (document.getElementById('kym-svc-4') && document.getElementById('kym-svc-4').checked && 4 !== 5) active.push(4);
    if (document.getElementById('kym-svc-5') && document.getElementById('kym-svc-5').checked && 5 !== 5) active.push(5);
    if (document.getElementById('kym-svc-6') && document.getElementById('kym-svc-6').checked && 6 !== 5) active.push(6);
    if (document.getElementById('kym-svc-7') && document.getElementById('kym-svc-7').checked && 7 !== 5) active.push(7);
    if (document.getElementById('kym-svc-8') && document.getElementById('kym-svc-8').checked && 8 !== 5) active.push(8);
    if (document.getElementById('kym-svc-9') && document.getElementById('kym-svc-9').checked && 9 !== 5) active.push(9);
    if (document.getElementById('kym-svc-10') && document.getElementById('kym-svc-10').checked && 10 !== 5) active.push(10);
    if (document.getElementById('kym-svc-11') && document.getElementById('kym-svc-11').checked && 11 !== 5) active.push(11);
    if (document.getElementById('kym-svc-12') && document.getElementById('kym-svc-12').checked && 12 !== 5) active.push(12);
    if (document.getElementById('kym-svc-13') && document.getElementById('kym-svc-13').checked && 13 !== 5) active.push(13);
    if (document.getElementById('kym-svc-14') && document.getElementById('kym-svc-14').checked && 14 !== 5) active.push(14);
    if (document.getElementById('kym-svc-15') && document.getElementById('kym-svc-15').checked && 15 !== 5) active.push(15);
    if (document.getElementById('kym-svc-16') && document.getElementById('kym-svc-16').checked && 16 !== 5) active.push(16);
    if (document.getElementById('kym-svc-17') && document.getElementById('kym-svc-17').checked && 17 !== 5) active.push(17);
    if (document.getElementById('kym-svc-18') && document.getElementById('kym-svc-18').checked && 18 !== 5) active.push(18);
    if (document.getElementById('kym-svc-19') && document.getElementById('kym-svc-19').checked && 19 !== 5) active.push(19);
    if (document.getElementById('kym-svc-20') && document.getElementById('kym-svc-20').checked && 20 !== 5) active.push(20);
    if (document.getElementById('kym-svc-21') && document.getElementById('kym-svc-21').checked && 21 !== 5) active.push(21);
    if (document.getElementById('kym-svc-22') && document.getElementById('kym-svc-22').checked && 22 !== 5) active.push(22);
    if (document.getElementById('kym-svc-23') && document.getElementById('kym-svc-23').checked && 23 !== 5) active.push(23);

    // Cargar distribución actual para preservar RESELLER
    var data = await loadCompanyData();
    var dist     = data.servicesRaw && data.servicesRaw.distribution || {};
    var reseller = dist.RESELLER || [];

    // Construir nuevas listas (USER/CONTROLLER/ADMIN comparten los mismos servicios activos)
    var userList  = active.slice();
    var ctrlList  = active.slice();
    var adminList = active.slice();

    // ABS según modo
    var absCb = document.getElementById('kym-svc-5');
    if (absCb && absCb.checked) {
      var mode = document.getElementById('kym-abs-mode').value;
      if (mode === 'informativo') { userList.push(5); ctrlList.push(5); adminList.push(5); }
      else if (mode === 'silencioso') { ctrlList.push(5); adminList.push(5); }
      else if (mode === 'analisis')   { adminList.push(5); }
    }

    // Ordenar
    userList.sort(function(a,b){return a-b;});
    ctrlList.sort(function(a,b){return a-b;});
    adminList.sort(function(a,b){return a-b;});

    if (!confirm('Se van a guardar los servicios de '+companyName+'.\n\n\u00bfQuieres continuar?')) return;
    showSt('&#8987; Guardando...', 'info');

    var payload = { services: { USER: userList, CONTROLLER: ctrlList, ADMIN: adminList, RESELLER: reseller } };
    try {
      var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/'+getCid(), {
        method: 'PUT', headers: apiH(),
        body: JSON.stringify(payload)
      });
      var rdata = await res.json();
      if (res.ok || res.status === 200) {
        companyData = null;
        showSt('&#10003; Servicios guardados correctamente', 'ok');
      } else {
        var msg = (rdata.records&&rdata.records.devMessage)||rdata.message||res.status;
        showSt('&#10007; Error: '+msg, 'err');
      }
    } catch(e) { showSt('&#10007; Error de red: '+e.message, 'err'); }
  };


  // ── GUI Phishing Adjuntos ──────────────────────────────────────────────────
  var attData     = [];   // copia local del array de adjuntos
  var attEditIdx  = -1;   // índice del adjunto en edición (-1 = nuevo)
  var companyLangs = [];  // idiomas disponibles en la empresa

  var LANG_NAMES = {'es-es': 'Español', 'es-mx': 'Español (Latam)', 'en-us': 'Inglés', 'eu': 'Euskera', 'pl': 'Polaco', 'cat': 'Catalán', 'pt-pt': 'Portugués (Portugal)', 'pt-br': 'Portugués (Brasil)', 'sv': 'Sueco', 'fr': 'Francés', 'it': 'Italiano', 'de': 'Alemán'};

  async function showPhishAttGui() {
    document.getElementById('kym-adm-gui-phish-att').style.display = 'block';
    document.getElementById('kym-adm-gui-langs').style.display = 'none';
    document.getElementById('kym-adm-gui-services').style.display = 'none';
    document.getElementById('kym-adm-btns-row').style.display = 'none';
    document.getElementById('kym-adm-view-panel').style.display = 'none';
    document.getElementById('kym-adm-edit-panel').style.display = 'none';
    document.getElementById('kym-att-status').style.display = 'none';
    document.getElementById('kym-adm-langs-switch').innerHTML = '{ } Modo JSON';

    var data = await loadCompanyData();
    var att  = data.servicesConfiguration && data.servicesConfiguration.phishing && data.servicesConfiguration.phishing.attachment;
    attData  = att ? JSON.parse(JSON.stringify(att)) : [];

    // Idiomas de la empresa
    companyLangs = (data.environment && data.environment.languages && data.environment.languages.list) || ['es-es','en-us'];

    renderAttList();
  }

  function langName(code) { return LANG_NAMES[code] || code; }

  function renderAttList() {
    var list = document.getElementById('kym-att-list');
    list.innerHTML = '';
    if (!attData.length) {
      list.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px">No hay adjuntos configurados</div>';
      return;
    }
    attData.forEach(function(item, idx) {
      var nameEs = (item.attachment && (item.attachment['es-es'] || item.attachment['es-mx'] || Object.values(item.attachment)[0])) || '(sin nombre)';
      var row = document.createElement('div');
      row.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;overflow:hidden';
      row.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">' +
          '<span style="flex:1;font-size:13px;font-weight:500">' + nameEs + '</span>' +
          '<button onclick="event.stopPropagation();openAttModal('+idx+')" style="background:#0369a1;color:white;border:none;padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer">Editar</button>' +
          '<button onclick="event.stopPropagation();deleteAtt('+idx+')" style="background:#fee2e2;color:#c53030;border:none;padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer">&#10007;</button>' +
          '<span style="font-size:12px;color:#94a3b8">&#9660;</span>' +
        '</div>' +
        '<div style="display:none;padding:0 12px 10px;border-top:1px solid #e2e8f0;background:white">' +
          Object.keys(item.attachment || {}).map(function(lang) {
            return '<div style="margin-top:8px"><div style="font-size:10px;font-weight:600;color:#64748b;margin-bottom:2px">' + langName(lang).toUpperCase() + '</div>' +
              '<div style="font-size:12px;color:#475569">&#128196; ' + (item.url && item.url[lang] || '') + '</div>' +
              '<div style="font-size:12px;color:#475569">&#128065; ' + (item.attachment[lang] || '') + '</div></div>';
          }).join('') +
        '</div>';
      list.appendChild(row);
    });
  }

  function deleteAtt(idx) {
    if (!confirm('\u00bfEliminar este adjunto?')) return;
    attData.splice(idx, 1);
    renderAttList();
  }

  function openAttModal(idx) {
    attEditIdx = idx;
    var isNew  = (idx === -1);
    var item   = isNew ? {url:{}, attachment:{}} : JSON.parse(JSON.stringify(attData[idx]));
    document.getElementById('kym-att-modal-title').textContent = isNew ? 'Nuevo adjunto' : 'Editar adjunto';

    // Construir campos por idioma
    var body = document.getElementById('kym-att-modal-body');
    body.innerHTML = '';
    var langs = Object.keys(item.attachment || {});
    if (!langs.length) langs = ['es-es','en-us'];

    langs.forEach(function(lang) {
      body.appendChild(buildLangBlock(lang, (item.url && item.url[lang]) || '', (item.attachment && item.attachment[lang]) || '', !isNew));
    });

    // Selector de idiomas para añadir
    var sel = document.getElementById('kym-att-modal-lang-add');
    sel.innerHTML = '';
    companyLangs.forEach(function(l) {
      if (langs.indexOf(l) < 0) {
        var o = document.createElement('option');
        o.value = l; o.textContent = langName(l);
        sel.appendChild(o);
      }
    });
    sel.parentElement.style.display = sel.options.length ? 'flex' : 'none';

    // Guardar referencia al item
    document.getElementById('kym-att-modal').dataset.editItem = JSON.stringify(item);
    document.getElementById('kym-att-modal').style.display = 'flex';
  }

  function buildLangBlock(lang, urlVal, attVal, canDelete) {
    var div = document.createElement('div');
    div.dataset.lang = lang;
    div.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#f8fafc';
    div.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<span style="font-size:11px;font-weight:600;color:#1e40af;text-transform:uppercase">' + langName(lang) + ' (' + lang + ')</span>' +
        (canDelete ? '<button onclick="this.closest('[data-lang]').remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px">&#10007;</button>' : '') +
      '</div>' +
      '<label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Archivo (URL)</label>' +
      '<input type="text" data-field="url" value="' + urlVal.replace(/"/g,'&quot;') + '" placeholder="archivo.docx" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;margin-bottom:8px;box-sizing:border-box">' +
      '<label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Nombre a mostrar</label>' +
      '<input type="text" data-field="att" value="' + attVal.replace(/"/g,'&quot;') + '" placeholder="Descripci\u00f3n del adjunto" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;box-sizing:border-box">';
    return div;
  }

  // Añadir idioma en modal
  document.getElementById('kym-att-modal-add-lang').onclick = function() {
    var sel  = document.getElementById('kym-att-modal-lang-add');
    var lang = sel.value; if (!lang) return;
    var body = document.getElementById('kym-att-modal-body');
    body.appendChild(buildLangBlock(lang, '', '', true));
    sel.remove(sel.selectedIndex);
    sel.parentElement.style.display = sel.options.length ? 'flex' : 'none';
  };

  // Cerrar modal
  document.getElementById('kym-att-modal-close').onclick  =
  document.getElementById('kym-att-modal-cancel').onclick = function() {
    document.getElementById('kym-att-modal').style.display = 'none';
  };

  // Aplicar cambios del modal
  document.getElementById('kym-att-modal-save').onclick = function() {
    var body   = document.getElementById('kym-att-modal-body');
    var blocks = body.querySelectorAll('[data-lang]');
    var newUrl = {}, newAtt = {};
    var valid  = true;
    blocks.forEach(function(b) {
      var lang   = b.dataset.lang;
      var urlVal = b.querySelector('[data-field="url"]').value.trim();
      var attVal = b.querySelector('[data-field="att"]').value.trim();
      if (!urlVal || !attVal) { valid = false; return; }
      newUrl[lang] = urlVal;
      newAtt[lang] = attVal;
    });
    if (!valid || !Object.keys(newUrl).length) {
      alert('Todos los campos son obligatorios.');
      return;
    }
    var item = {url: newUrl, attachment: newAtt};
    if (attEditIdx === -1) {
      attData.push(item);
    } else {
      attData[attEditIdx] = item;
    }
    document.getElementById('kym-att-modal').style.display = 'none';
    renderAttList();
  };

  // Botón añadir nuevo
  document.getElementById('kym-att-add').onclick = function() { openAttModal(-1); };

  // Guardar
  document.getElementById('kym-att-save').onclick = async function() {
    var status = document.getElementById('kym-att-status');
    function showSt(msg, type) {
      var styles = {ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749',err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030',info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af'};
      status.style.cssText = 'display:block;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;'+(styles[type]||styles.info);
      status.innerHTML = msg;
    }
    if (!confirm('Se van a guardar los adjuntos de '+companyName+'.\n\n\u00bfQuieres continuar?')) return;
    showSt('&#8987; Guardando...','info');
    try {
      var data = await loadCompanyData();
      var sc   = data.servicesConfiguration || {};
      var ph   = sc.phishing || {};
      var payload = { servicesConfiguration: Object.assign({}, sc, { phishing: Object.assign({}, ph, { attachment: attData }) }) };
      var res  = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/'+getCid(), {
        method:'PUT', headers:apiH(), body:JSON.stringify(payload)
      });
      var rdata = await res.json();
      if (res.ok || res.status===200) {
        companyData = null;
        showSt('&#10003; Adjuntos guardados correctamente','ok');
      } else {
        var msg = (rdata.records&&rdata.records.devMessage)||rdata.message||res.status;
        showSt('&#10007; Error: '+msg,'err');
      }
    } catch(e) { showSt('&#10007; Error de red: '+e.message,'err'); }
  };

})();
