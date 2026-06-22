(function () {
  'use strict';

  var SCRIPT_VERSION = '2026-06-22-fixed-inline';

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

  var existing = $('kym-admin-panel');
  if (existing) existing.parentNode.removeChild(existing);

  var token = getToken();
  var companyInfo = getCurrentCompanyFromVue();
  var companyId = companyInfo.id;
  var companyName = companyInfo.name;
  var companyData = null;
  var currentSection = null;
  var guiMode = true;

  var LANG_NAMES = {
    'es-es': 'Español',
    'es-mx': 'Español (Latam)',
    'en-us': 'Inglés',
    'eu': 'Euskera',
    'pl': 'Polaco',
    'cat': 'Catalán',
    'pt-pt': 'Portugués (Portugal)',
    'pt-br': 'Portugués (Brasil)',
    'sv': 'Sueco',
    'fr': 'Francés',
    'it': 'Italiano',
    'de': 'Alemán'
  };

  var ALL_LANGS = [
    'es-es',
    'es-mx',
    'en-us',
    'eu',
    'pl',
    'cat',
    'pt-pt',
    'pt-br',
    'sv',
    'fr',
    'it',
    'de'
  ];

  var SERVICES = [
    { id: 1, label: 'Concienciación' },
    { id: 2, label: 'Bienestar' },
    { id: 3, label: 'GRI' },
    { id: 4, label: 'Phishing' },
    { id: 5, label: 'ABS' },
    { id: 6, label: 'Federación (SAML)' },
    { id: 7, label: 'Neurophishing' },
    { id: 8, label: 'Burnout' },
    { id: 9, label: 'SCIM' },
    { id: 10, label: 'Smishing' },
    { id: 11, label: 'Neurosmishing', disabled: true },
    { id: 12, label: 'Impacto' },
    { id: 13, label: 'Ingeniería Social' },
    { id: 14, label: 'Arquetipo' },
    { id: 15, label: 'Ranking' },
    { id: 16, label: 'Personalización de sesiones' },
    { id: 17, label: 'Logros' },
    { id: 18, label: 'Gamificación', disabled: true },
    { id: 19, label: 'HRM (Human Risk Management)' },
    { id: 20, label: 'MFA (Múltiple Factor de Autenticación)' },
    { id: 21, label: 'Vishing' },
    { id: 22, label: 'Neurovishing', disabled: true },
    { id: 23, label: 'Formación (NIS...)' }
  ];

  var SECTIONS = {
    services: {
      label: 'Servicios',
      icon: '&#9881;',
      get: function (d) {
        return {
          services: d.servicesRaw && d.servicesRaw.distribution
        };
      },
      mode: 'services'
    },
    surveyflow: {
      label: 'Surveyflow',
      icon: '&#128200;',
      get: function (d) {
        return {
          journey: {
            surveyflow: d.journey && d.journey.surveyflow
          }
        };
      },
      mode: 'json'
    },
    languages: {
      label: 'Idiomas',
      icon: '&#127760;',
      get: function (d) {
        return {
          environment: {
            languages: d.environment && d.environment.languages
          }
        };
      },
      mode: 'languages'
    },
    phish_dom: {
      label: 'Phishing: Dominios',
      icon: '&#128279;',
      get: function (d) {
        return {
          servicesConfiguration: {
            phishing: {
              domains:
                d.servicesConfiguration &&
                d.servicesConfiguration.phishing &&
                d.servicesConfiguration.phishing.domains
            }
          }
        };
      },
      mode: 'json'
    },
    phish_att: {
      label: 'Phishing: Adjuntos',
      icon: '&#128206;',
      get: function (d) {
        return {
          servicesConfiguration: {
            phishing: {
              attachment:
                d.servicesConfiguration &&
                d.servicesConfiguration.phishing &&
                d.servicesConfiguration.phishing.attachment
            }
          }
        };
      },
      mode: 'attachments'
    },
    phish_land: {
      label: 'Phishing: Post-landings',
      icon: '&#128279;',
      get: function (d) {
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
      },
      mode: 'json'
    }
  };

  function apiHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    };
  }

  async function loadCompanyData(force) {
    if (companyData && !force) return companyData;

    if (!companyId) {
      throw new Error('No se ha podido detectar la empresa activa. Selecciona una empresa y pulsa “Actualizar empresa y datos”.');
    }

    if (!token) {
      throw new Error('No se ha encontrado token en localStorage. Asegúrate de estar logado en Kymatio.');
    }

    var url =
      'https://api.kymatio.com/v2/admin/stakeholders/companies/' +
      encodeURIComponent(companyId) +
      '?environment=true&journey=true&services=true';

    var res = await fetch(url, {
      headers: apiHeaders()
    });

    var d = await res.json();

    if (!res.ok) {
      throw new Error((d && (d.message || (d.records && d.records.devMessage))) || 'Error HTTP ' + res.status);
    }

    companyData = d.records || d;
    return companyData;
  }

  function getSectionData() {
    if (!companyData || !currentSection) return null;
    return SECTIONS[currentSection].get(companyData);
  }

  async function putCompanyPayload(payload) {
    if (!companyId) throw new Error('No hay empresa activa.');
    if (!token) throw new Error('No hay token.');

    var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId), {
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

    companyData = null;
    return rdata;
  }

  function createPanel() {
    var div = document.createElement('div');
    div.id = 'kym-admin-panel';
    div.style.cssText =
      'position:fixed;top:0;right:0;width:560px;height:100vh;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.18);z-index:999999;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:13px;color:#1a202c;';

    var html = '';

    html += '<div style="background:#1e293b;color:white;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">';
    html += '<div>';
    html += '<div style="font-weight:700;font-size:15px">&#9881; Kymatio Admin Tools</div>';
    html += '<div style="font-size:10px;color:#cbd5e1;margin-top:2px">v. ' + escHtml(SCRIPT_VERSION) + '</div>';
    html += '</div>';
    html += '<button id="kym-adm-close" style="background:none;border:none;color:white;font-size:22px;cursor:pointer;line-height:1">&#215;</button>';
    html += '</div>';

    html += '<div style="overflow-y:auto;flex:1;padding:18px">';

    html += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
    html += '<div style="font-size:22px">&#127970;</div>';
    html += '<div style="flex:1">';
    html += '<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Empresa activa</div>';
    html += '<div class="kym-company-name" style="font-size:18px;font-weight:700;color:#166534">' + escHtml(companyName || '— Sin empresa seleccionada') + '</div>';
    html += '<div style="font-size:11px;color:#64748b">ID: <span class="kym-company-id">' + escHtml(companyId || '?') + '</span></div>';
    html += '</div>';
    html += '</div>';
    html += '<button id="kym-adm-refresh-company" style="width:100%;background:#166534;color:white;border:none;padding:8px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">&#8635; Actualizar empresa y datos</button>';
    html += '</div>';

    html += '<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Selecciona una sección</div>';
    html += '<div id="kym-adm-sections" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';

    Object.keys(SECTIONS).forEach(function (key) {
      var s = SECTIONS[key];
      html += '<button data-section="' + escHtml(key) + '" class="kym-sec-btn" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;text-align:left;cursor:pointer;font-size:13px;font-weight:600;color:#1a202c;display:flex;align-items:center;gap:8px">';
      html += '<span>' + s.icon + '</span><span>' + escHtml(s.label) + '</span>';
      html += '</button>';
    });

    html += '</div>';

    html += '<div id="kym-adm-action" style="display:none">';
    html += '<hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div id="kym-adm-section-title" style="font-size:14px;font-weight:700;color:#1a202c"></div>';
    html += '<button id="kym-adm-back" style="background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;text-decoration:underline">&#8592; Volver</button>';
    html += '</div>';

    html += '<a id="kym-adm-btn-chatgpt" href="https://chatgpt.com/g/g-p-69b2862052e081918097b93ab359f603/c/6a3259aa-3cb8-832d-92e0-6cdc22a46eee" target="_blank" style="display:none;width:100%;box-sizing:border-box;margin-bottom:10px;background:#10a37f;color:white;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;text-align:center">&#129302; Abrir ChatGPT &mdash; Surveyflows</a>';

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
    html += '<div id="kym-adm-save-status" style="display:none;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center"></div>';
    html += '</div>';

    html += '<div id="kym-adm-gui-langs" style="display:none"></div>';
    html += '<div id="kym-adm-gui-services" style="display:none"></div>';
    html += '<div id="kym-adm-gui-attachments" style="display:none"></div>';

    html += '</div>';
    html += '</div>';

    div.innerHTML = html;
    document.body.appendChild(div);

    return div;
  }

  var panel = createPanel();

  function updateCompanyBanner() {
    var nameEl = panel.querySelector('.kym-company-name');
    var idEl = panel.querySelector('.kym-company-id');
    if (nameEl) nameEl.textContent = companyName || '— Sin empresa seleccionada';
    if (idEl) idEl.textContent = companyId || '?';
  }

  function resetActionPanels() {
    $('kym-adm-view-panel').style.display = 'none';
    $('kym-adm-edit-panel').style.display = 'none';
    $('kym-adm-gui-langs').style.display = 'none';
    $('kym-adm-gui-services').style.display = 'none';
    $('kym-adm-gui-attachments').style.display = 'none';
    $('kym-adm-save-status').style.display = 'none';
  }

  function selectSection(key) {
    currentSection = key;
    companyData = null;
    guiMode = true;

    var s = SECTIONS[key];

    $('kym-adm-section-title').innerHTML = s.icon + ' ' + escHtml(s.label);
    $('kym-adm-action').style.display = 'block';
    $('kym-adm-btn-chatgpt').style.display = key === 'surveyflow' ? 'block' : 'none';

    resetActionPanels();

    var hasGui = s.mode === 'languages' || s.mode === 'services' || s.mode === 'attachments';

    $('kym-adm-mode-switch').style.display = hasGui ? 'block' : 'none';
    $('kym-adm-btns-row').style.display = hasGui ? 'none' : 'flex';
    $('kym-adm-mode-toggle').innerHTML = '{ } Modo JSON';

    if (s.mode === 'languages') renderLanguagesGui();
    if (s.mode === 'services') renderServicesGui();
    if (s.mode === 'attachments') renderAttachmentsGui();
  }

  function renderLanguagesGui() {
    resetActionPanels();
    $('kym-adm-gui-langs').style.display = 'block';
    $('kym-adm-gui-langs').innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando idiomas...</div>';

    loadCompanyData()
      .then(function (data) {
        var langs = (data.environment && data.environment.languages) || {};
        var list = langs.list || [];
        var def = langs.default || '';

        var html = '';
        html += '<div style="margin-bottom:10px"><span style="font-size:11px;font-weight:600;color:#64748b">IDIOMAS DISPONIBLES</span></div>';
        html += '<div id="kym-adm-langs-list" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">';

        ALL_LANGS.forEach(function (code) {
          var checked = list.indexOf(code) >= 0 ? 'checked' : '';
          html += '<label id="kym-lang-row-' + escHtml(code) + '" style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc">';
          html += '<input type="checkbox" class="kym-lang-check" id="kym-lang-' + escHtml(code) + '" value="' + escHtml(code) + '" ' + checked + ' style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
          html += '<span style="flex:1;font-size:13px">' + escHtml(LANG_NAMES[code] || code) + '</span>';
          html += '<span style="font-size:11px;color:#94a3b8;font-family:monospace">' + escHtml(code) + '</span>';
          html += '</label>';
        });

        html += '</div>';
        html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px">';
        html += '<div style="font-size:11px;font-weight:600;color:#1e40af;margin-bottom:6px">IDIOMA POR DEFECTO</div>';
        html += '<select id="kym-adm-lang-default" style="width:100%;padding:7px 10px;border:1px solid #bfdbfe;border-radius:6px;font-size:13px;background:white;color:#1a202c"></select>';
        html += '<div id="kym-adm-lang-default-err" style="display:none;color:#e53e3e;font-size:11px;margin-top:4px">&#9888; Debes tener al menos un idioma activo y seleccionar el idioma por defecto</div>';
        html += '</div>';
        html += '<button id="kym-adm-langs-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar idiomas</button>';
        html += '<div id="kym-adm-langs-status" style="display:none"></div>';

        $('kym-adm-gui-langs').innerHTML = html;

        function updateRowsAndDefault(keep) {
          var selected = [];
          ALL_LANGS.forEach(function (code) {
            var cb = $('kym-lang-' + code);
            var row = $('kym-lang-row-' + code);
            if (cb && cb.checked) selected.push(code);
            if (row && cb) {
              row.style.background = cb.checked ? '#f0fdf4' : '#f8fafc';
              row.style.borderColor = cb.checked ? '#bbf7d0' : '#e2e8f0';
            }
          });

          var sel = $('kym-adm-lang-default');
          sel.innerHTML = '';
          selected.forEach(function (code) {
            var opt = document.createElement('option');
            opt.value = code;
            opt.textContent = (LANG_NAMES[code] || code) + ' (' + code + ')';
            sel.appendChild(opt);
          });

          if (selected.indexOf(keep) >= 0) sel.value = keep;
          else if (selected.indexOf(def) >= 0) sel.value = def;
        }

        ALL_LANGS.forEach(function (code) {
          var cb = $('kym-lang-' + code);
          if (cb) {
            cb.addEventListener('change', function () {
              updateRowsAndDefault($('kym-adm-lang-default').value);
              $('kym-adm-lang-default-err').style.display = 'none';
            });
          }
        });

        updateRowsAndDefault(def);

        $('kym-adm-langs-save').onclick = async function () {
          var selected = [];
          ALL_LANGS.forEach(function (code) {
            var cb = $('kym-lang-' + code);
            if (cb && cb.checked) selected.push(code);
          });

          var defLang = $('kym-adm-lang-default').value;
          var errEl = $('kym-adm-lang-default-err');
          var status = $('kym-adm-langs-status');

          if (!selected.length || !defLang || selected.indexOf(defLang) < 0) {
            errEl.style.display = 'block';
            return;
          }

          errEl.style.display = 'none';

          if (!confirm('Se van a guardar los idiomas de ' + companyName + '.\n\nIdiomas: ' + selected.join(', ') + '\nDefault: ' + defLang + '\n\n¿Quieres continuar?')) {
            return;
          }

          setStatus(status, '&#8987; Guardando...', 'info');

          try {
            await putCompanyPayload({
              environment: {
                languages: {
                  list: selected,
                  default: defLang
                }
              }
            });
            setStatus(status, '&#10003; Idiomas guardados correctamente', 'ok');
          } catch (e) {
            setStatus(status, '&#10007; Error: ' + escHtml(e.message), 'err');
          }
        };
      })
      .catch(function (e) {
        $('kym-adm-gui-langs').innerHTML =
          '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">Error: ' +
          escHtml(e.message) +
          '</div>';
      });
  }

  function renderServicesGui() {
    resetActionPanels();
    $('kym-adm-gui-services').style.display = 'block';
    $('kym-adm-gui-services').innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando servicios...</div>';

    loadCompanyData()
      .then(function (data) {
        var dist = (data.servicesRaw && data.servicesRaw.distribution) || {};
        var userSvcs = dist.USER || [];
        var adminSvcs = dist.ADMIN || [];
        var ctrlSvcs = dist.CONTROLLER || [];

        function isActive(id) {
          return userSvcs.indexOf(id) >= 0 || adminSvcs.indexOf(id) >= 0 || ctrlSvcs.indexOf(id) >= 0;
        }

        var html = '';
        html += '<div style="margin-bottom:10px"><span style="font-size:11px;font-weight:600;color:#64748b">SERVICIOS</span></div>';
        html += '<div id="kym-adm-services-list" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">';

        SERVICES.forEach(function (svc) {
          var checked = isActive(svc.id) ? 'checked' : '';
          var disabled = svc.disabled ? 'disabled' : '';
          var opacity = svc.disabled ? 'opacity:.5;cursor:not-allowed;' : 'cursor:pointer;';
          html += '<label id="kym-svc-row-' + svc.id + '" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;' + opacity + (svc.id === 5 ? 'grid-column:1/-1;' : '') + '">';
          html += '<input type="checkbox" id="kym-svc-' + svc.id + '" value="' + svc.id + '" ' + checked + ' ' + disabled + ' style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
          html += '<span style="flex:1;font-size:12px">' + svc.id + ' — ' + escHtml(svc.label) + '</span>';

          if (svc.id === 5) {
            html += '</label>';
            html += '<div id="kym-abs-mode-wrapper" style="grid-column:1/-1;display:none;margin-top:-4px;margin-bottom:6px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc">';
            html += '<div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:5px">Modo ABS</div>';
            html += '<select id="kym-abs-mode" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;background:white">';
            html += '<option value="informativo">Informativo</option>';
            html += '<option value="silencioso">Silencioso</option>';
            html += '<option value="analisis">Análisis</option>';
            html += '</select>';
            html += '</div>';
          } else {
            html += '</label>';
          }
        });

        html += '</div>';
        html += '<button id="kym-adm-services-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar servicios</button>';
        html += '<div id="kym-adm-services-status" style="display:none"></div>';

        $('kym-adm-gui-services').innerHTML = html;

        function updateSvcRow(id) {
          var cb = $('kym-svc-' + id);
          var row = $('kym-svc-row-' + id);
          if (!cb || !row) return;
          row.style.background = cb.checked ? '#f0fdf4' : '#f8fafc';
          row.style.borderColor = cb.checked ? '#bbf7d0' : '#e2e8f0';

          var absWrap = $('kym-abs-mode-wrapper');
          if (absWrap && id === 5) {
            absWrap.style.display = cb.checked ? 'block' : 'none';
          }
        }

        SERVICES.forEach(function (svc) {
          updateSvcRow(svc.id);
          var cb = $('kym-svc-' + svc.id);
          if (!cb || svc.disabled) return;

          cb.addEventListener('change', function () {
            if (svc.id === 7 && cb.checked) {
              var social = $('kym-svc-13');
              if (social && !social.checked) {
                cb.checked = false;
                alert('Neurophishing requiere tener activa Ingeniería Social.');
              }
            }

            if (svc.id === 13 && !cb.checked) {
              var neuro = $('kym-svc-7');
              if (neuro) neuro.checked = false;
              updateSvcRow(7);
            }

            updateSvcRow(svc.id);
          });
        });

        var absCb = $('kym-svc-5');
        var absMode = $('kym-abs-mode');

        if (absCb && absCb.checked && absMode) {
          var inUser = userSvcs.indexOf(5) >= 0;
          var inCtrl = ctrlSvcs.indexOf(5) >= 0;
          var inAdmin = adminSvcs.indexOf(5) >= 0;

          if (inUser && inCtrl && inAdmin) absMode.value = 'informativo';
          else if (!inUser && inCtrl && inAdmin) absMode.value = 'silencioso';
          else if (!inUser && !inCtrl && inAdmin) absMode.value = 'analisis';
          else absMode.value = 'informativo';
        }

        $('kym-adm-services-save').onclick = async function () {
          var status = $('kym-adm-services-status');
          var active = [];

          SERVICES.forEach(function (svc) {
            if (svc.id === 5) return;
            var cb = $('kym-svc-' + svc.id);
            if (cb && cb.checked) active.push(svc.id);
          });

          var dataNow = await loadCompanyData();
          var distNow = (dataNow.servicesRaw && dataNow.servicesRaw.distribution) || {};
          var reseller = distNow.RESELLER || [];

          var userList = active.slice();
          var ctrlList = active.slice();
          var adminList = active.slice();

          var absChecked = $('kym-svc-5') && $('kym-svc-5').checked;
          if (absChecked) {
            var mode = $('kym-abs-mode').value;
            if (mode === 'informativo') {
              userList.push(5);
              ctrlList.push(5);
              adminList.push(5);
            } else if (mode === 'silencioso') {
              ctrlList.push(5);
              adminList.push(5);
            } else if (mode === 'analisis') {
              adminList.push(5);
            }
          }

          userList.sort(function (a, b) { return a - b; });
          ctrlList.sort(function (a, b) { return a - b; });
          adminList.sort(function (a, b) { return a - b; });

          if (!confirm('Se van a guardar los servicios de ' + companyName + '.\n\n¿Quieres continuar?')) return;

          setStatus(status, '&#8987; Guardando...', 'info');

          try {
            await putCompanyPayload({
              services: {
                USER: userList,
                CONTROLLER: ctrlList,
                ADMIN: adminList,
                RESELLER: reseller
              }
            });
            setStatus(status, '&#10003; Servicios guardados correctamente', 'ok');
          } catch (e) {
            setStatus(status, '&#10007; Error: ' + escHtml(e.message), 'err');
          }
        };
      })
      .catch(function (e) {
        $('kym-adm-gui-services').innerHTML =
          '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">Error: ' +
          escHtml(e.message) +
          '</div>';
      });
  }

  function renderAttachmentsGui() {
    resetActionPanels();
    $('kym-adm-gui-attachments').style.display = 'block';
    $('kym-adm-gui-attachments').innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando adjuntos...</div>';

    loadCompanyData()
      .then(function (data) {
        var sc = data.servicesConfiguration || {};
        var ph = sc.phishing || {};
        var attData = safeJsonClone(ph.attachment || []);
        var companyLangs = (data.environment && data.environment.languages && data.environment.languages.list) || ['es-es', 'en-us'];

        function renderList() {
          var list = $('kym-att-list');
          list.innerHTML = '';

          if (!attData.length) {
            list.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px">No hay adjuntos configurados</div>';
            return;
          }

          attData.forEach(function (item, idx) {
            var names = item.attachment || {};
            var urls = item.url || {};
            var firstName = names['es-es'] || names['es-mx'] || names['en-us'] || names[Object.keys(names)[0]] || '(sin nombre)';

            var row = document.createElement('div');
            row.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;overflow:hidden';

            var header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer';

            var title = document.createElement('span');
            title.style.cssText = 'flex:1;font-size:13px;font-weight:500';
            title.textContent = firstName;

            var editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.style.cssText = 'background:#0369a1;color:white;border:none;padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer';

            var delBtn = document.createElement('button');
            delBtn.innerHTML = '&#10007;';
            delBtn.style.cssText = 'background:#fee2e2;color:#c53030;border:none;padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer';

            var arrow = document.createElement('span');
            arrow.innerHTML = '&#9660;';
            arrow.style.cssText = 'font-size:12px;color:#94a3b8';

            var detail = document.createElement('div');
            detail.style.cssText = 'display:none;padding:0 12px 10px;border-top:1px solid #e2e8f0;background:white';

            Object.keys(names).forEach(function (lang) {
              var block = document.createElement('div');
              block.style.cssText = 'margin-top:8px';
              block.innerHTML =
                '<div style="font-size:10px;font-weight:600;color:#64748b;margin-bottom:2px">' +
                escHtml((LANG_NAMES[lang] || lang).toUpperCase()) +
                '</div>' +
                '<div style="font-size:12px;color:#475569">&#128196; ' +
                escHtml(urls[lang] || '') +
                '</div>' +
                '<div style="font-size:12px;color:#475569">&#128065; ' +
                escHtml(names[lang] || '') +
                '</div>';
              detail.appendChild(block);
            });

            header.onclick = function () {
              detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            };

            editBtn.onclick = function (ev) {
              ev.stopPropagation();
              openAttachmentModal(idx);
            };

            delBtn.onclick = function (ev) {
              ev.stopPropagation();
              if (!confirm('¿Eliminar este adjunto?')) return;
              attData.splice(idx, 1);
              renderList();
            };

            header.appendChild(title);
            header.appendChild(editBtn);
            header.appendChild(delBtn);
            header.appendChild(arrow);
            row.appendChild(header);
            row.appendChild(detail);
            list.appendChild(row);
          });
        }

        function buildModalLangBlock(lang, urlValue, nameValue) {
          var block = document.createElement('div');
          block.dataset.lang = lang;
          block.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#f8fafc';

          var top = document.createElement('div');
          top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';

          var label = document.createElement('span');
          label.style.cssText = 'font-size:11px;font-weight:600;color:#1e40af;text-transform:uppercase';
          label.textContent = (LANG_NAMES[lang] || lang) + ' (' + lang + ')';

          var removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&#10007;';
          removeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px';

          removeBtn.onclick = function () {
            block.remove();
          };

          top.appendChild(label);
          top.appendChild(removeBtn);

          var urlLabel = document.createElement('label');
          urlLabel.textContent = 'Archivo (URL)';
          urlLabel.style.cssText = 'font-size:11px;color:#64748b;display:block;margin-bottom:3px';

          var urlInput = document.createElement('input');
          urlInput.type = 'text';
          urlInput.dataset.field = 'url';
          urlInput.value = urlValue || '';
          urlInput.placeholder = 'archivo.docx';
          urlInput.style.cssText = 'width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;margin-bottom:8px;box-sizing:border-box';

          var nameLabel = document.createElement('label');
          nameLabel.textContent = 'Nombre a mostrar';
          nameLabel.style.cssText = 'font-size:11px;color:#64748b;display:block;margin-bottom:3px';

          var nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.dataset.field = 'name';
          nameInput.value = nameValue || '';
          nameInput.placeholder = 'Descripción del adjunto';
          nameInput.style.cssText = 'width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;box-sizing:border-box';

          block.appendChild(top);
          block.appendChild(urlLabel);
          block.appendChild(urlInput);
          block.appendChild(nameLabel);
          block.appendChild(nameInput);

          return block;
        }

        function openAttachmentModal(idx) {
          var isNew = idx === -1;
          var item = isNew ? { url: {}, attachment: {} } : safeJsonClone(attData[idx]);

          var overlay = document.createElement('div');
          overlay.id = 'kym-att-modal';
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000000;display:flex;align-items:center;justify-content:center';

          var box = document.createElement('div');
          box.style.cssText = 'background:white;border-radius:12px;padding:24px;width:460px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';

          box.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
            '<div style="font-size:15px;font-weight:700;color:#1a202c">' +
            (isNew ? 'Nuevo adjunto' : 'Editar adjunto') +
            '</div>' +
            '<button id="kym-att-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b;line-height:1">&#215;</button>' +
            '</div>' +
            '<div id="kym-att-modal-body" style="display:flex;flex-direction:column;gap:12px"></div>' +
            '<div style="display:flex;gap:8px;margin-top:16px">' +
            '<select id="kym-att-modal-lang-add" style="flex:1;padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px"></select>' +
            '<button id="kym-att-modal-add-lang" style="background:#0369a1;color:white;border:none;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">+ Idioma</button>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button id="kym-att-modal-cancel" style="flex:1;background:white;border:1px solid #e2e8f0;color:#475569;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">Cancelar</button>' +
            '<button id="kym-att-modal-save" style="flex:1;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Aplicar</button>' +
            '</div>';

          overlay.appendChild(box);
          document.body.appendChild(overlay);

          var body = $('kym-att-modal-body');
          var langs = Object.keys(item.attachment || {});
          if (!langs.length) langs = companyLangs.slice(0, 2);

          langs.forEach(function (lang) {
            body.appendChild(
              buildModalLangBlock(
                lang,
                item.url && item.url[lang],
                item.attachment && item.attachment[lang]
              )
            );
          });

          function refreshLangSelect() {
            var existing = [];
            body.querySelectorAll('[data-lang]').forEach(function (el) {
              existing.push(el.dataset.lang);
            });

            var sel = $('kym-att-modal-lang-add');
            sel.innerHTML = '';

            companyLangs.forEach(function (lang) {
              if (existing.indexOf(lang) < 0) {
                var opt = document.createElement('option');
                opt.value = lang;
                opt.textContent = LANG_NAMES[lang] || lang;
                sel.appendChild(opt);
              }
            });

            sel.parentElement.style.display = sel.options.length ? 'flex' : 'none';
          }

          refreshLangSelect();

          $('kym-att-modal-close').onclick = function () {
            overlay.remove();
          };

          $('kym-att-modal-cancel').onclick = function () {
            overlay.remove();
          };

          $('kym-att-modal-add-lang').onclick = function () {
            var sel = $('kym-att-modal-lang-add');
            var lang = sel.value;
            if (!lang) return;
            body.appendChild(buildModalLangBlock(lang, '', ''));
            refreshLangSelect();
          };

          $('kym-att-modal-save').onclick = function () {
            var newUrl = {};
            var newAttachment = {};
            var valid = true;

            body.querySelectorAll('[data-lang]').forEach(function (block) {
              var lang = block.dataset.lang;
              var urlInput = block.querySelector('[data-field="url"]');
              var nameInput = block.querySelector('[data-field="name"]');

              var urlVal = urlInput.value.trim();
              var nameVal = nameInput.value.trim();

              if (!urlVal || !nameVal) valid = false;

              newUrl[lang] = urlVal;
              newAttachment[lang] = nameVal;
            });

            if (!valid || !Object.keys(newUrl).length) {
              alert('Todos los campos son obligatorios.');
              return;
            }

            var newItem = {
              url: newUrl,
              attachment: newAttachment
            };

            if (isNew) attData.push(newItem);
            else attData[idx] = newItem;

            overlay.remove();
            renderList();
          };
        }

        var html = '';
        html += '<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">';
        html += '<span style="font-size:11px;font-weight:600;color:#64748b">ADJUNTOS DE PHISHING</span>';
        html += '<button id="kym-att-add" style="background:#0369a1;color:white;border:none;padding:5px 12px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">+ Añadir adjunto</button>';
        html += '</div>';
        html += '<div id="kym-att-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px"></div>';
        html += '<button id="kym-att-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar adjuntos</button>';
        html += '<div id="kym-att-status" style="display:none"></div>';

        $('kym-adm-gui-attachments').innerHTML = html;

        $('kym-att-add').onclick = function () {
          openAttachmentModal(-1);
        };

        $('kym-att-save').onclick = async function () {
          var status = $('kym-att-status');

          if (!confirm('Se van a guardar los adjuntos de ' + companyName + '.\n\n¿Quieres continuar?')) return;

          setStatus(status, '&#8987; Guardando...', 'info');

          try {
            var currentData = await loadCompanyData();
            var currentSc = currentData.servicesConfiguration || {};
            var currentPh = currentSc.phishing || {};

            var payload = {
              servicesConfiguration: Object.assign({}, currentSc, {
                phishing: Object.assign({}, currentPh, {
                  attachment: attData
                })
              })
            };

            await putCompanyPayload(payload);
            setStatus(status, '&#10003; Adjuntos guardados correctamente', 'ok');
          } catch (e) {
            setStatus(status, '&#10007; Error: ' + escHtml(e.message), 'err');
          }
        };

        renderList();
      })
      .catch(function (e) {
        $('kym-adm-gui-attachments').innerHTML =
          '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">Error: ' +
          escHtml(e.message) +
          '</div>';
      });
  }

  panel.querySelectorAll('.kym-sec-btn').forEach(function (btn) {
    btn.onclick = function () {
      selectSection(this.getAttribute('data-section'));
    };
  });

  $('kym-adm-close').onclick = function () {
    panel.remove();
  };

  $('kym-adm-refresh-company').onclick = function () {
    var c = getCurrentCompanyFromVue();
    companyId = c.id;
    companyName = c.name;
    token = getToken();
    companyData = null;
    currentSection = null;
    updateCompanyBanner();
    $('kym-adm-action').style.display = 'none';
    resetActionPanels();
    showToast('Empresa actualizada', 'ok');
  };

  $('kym-adm-back').onclick = function () {
    $('kym-adm-action').style.display = 'none';
    resetActionPanels();
    currentSection = null;
  };

  $('kym-adm-btn-view').onclick = async function () {
    resetActionPanels();
    $('kym-adm-view-panel').style.display = 'block';
    $('kym-adm-json-view').textContent = 'Cargando...';

    try {
      await loadCompanyData();
      var section = getSectionData();
      $('kym-adm-json-view').textContent = JSON.stringify(section, null, 2);
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
      var section = getSectionData();
      $('kym-adm-json-edit').value = JSON.stringify(section, null, 2);
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
      setStatus(status, '&#10007; JSON no válido: ' + escHtml(e.message), 'err');
      return;
    }

    var sectionLabel = SECTIONS[currentSection] ? SECTIONS[currentSection].label : currentSection;

    if (!confirm('Se va a proceder a la modificación de ' + sectionLabel + ' de la empresa ' + companyName + '.\n\n¿Quieres continuar?')) {
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
    if (!currentSection) return;

    var mode = SECTIONS[currentSection].mode;
    guiMode = !guiMode;

    if (guiMode) {
      $('kym-adm-btns-row').style.display = 'none';
      $('kym-adm-mode-toggle').innerHTML = '{ } Modo JSON';

      if (mode === 'languages') renderLanguagesGui();
      if (mode === 'services') renderServicesGui();
      if (mode === 'attachments') renderAttachmentsGui();
    } else {
      resetActionPanels();
      $('kym-adm-btns-row').style.display = 'flex';
      $('kym-adm-mode-toggle').innerHTML = '&#127770; Modo GUI';
    }
  };

  console.log('Kymatio Admin Tools loaded:', SCRIPT_VERSION);
  showToast('Kymatio Admin Tools cargado', 'ok');
})();
