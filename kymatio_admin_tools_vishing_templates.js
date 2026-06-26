(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  var MODULE_VERSION = 'vishing-06-admin-full-config';
  var SURVEY_TYPE_ID = 10;
  var AGENT_ID = 151;

  var LANG_NAMES = {
    'es-es': 'Español (España)',
    'es-mx': 'Español (Latam)',
    'en-us': 'Inglés (US)',
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

  var CATEGORIES = [
    { id: 1, label: 'Corporate', token: 'CORPORATE' },
    { id: 2, label: 'Shopping', token: 'SHOPPING' },
    { id: 3, label: 'Banking', token: 'BANKING' },
    { id: 4, label: 'Public', token: 'PUBLIC' },
    { id: 5, label: 'Custom', token: 'CUSTOM' },
    { id: 6, label: 'Other', token: 'OTHER' },
    { id: 8, label: 'Bets&Gaming', token: 'BETS_GAMING' },
    { id: 9, label: 'Delivery', token: 'DELIVERY' },
    { id: 10, label: 'Media&online', token: 'MEDIA_ONLINE' }
  ];

  var LEVELS = [
    { id: 1, label: 'Básico', token: 'BASIC' },
    { id: 2, label: 'Medio', token: 'MEDIUM' },
    { id: 3, label: 'Avanzado', token: 'ADVANCED' }
  ];

  var VOICES = [
    ['Benedita', 'Femenino', 'Portugués', 'Portuguesa'],
    ['Lucy', 'Femenino', 'Inglés', 'Británica'],
    ['Jules', 'Masculino', 'Francés', 'Francés'],
    ['Brando', 'Masculino', 'Italiano', 'Italiano'],
    ['Laura', 'Femenino', 'Español', 'Madrileña'],
    ['Ana', 'Femenino', 'Español', 'Andaluz'],
    ['Carmen', 'Femenino', 'Español', 'Extremeño'],
    ['Fernanda', 'Femenino', 'Español', 'Chileno'],
    ['Nicolás', 'Masculino', 'Español', 'Chileno'],
    ['Mónica', 'Femenino', 'Español', 'Castellano'],
    ['Juan', 'Masculino', 'Español', 'Mexicano'],
    ['Daniela', 'Femenino', 'Español', 'Colombiana'],
    ['João', 'Masculino', 'Portugués', 'Portugués'],
    ['Sara', 'Femenino', 'Español', 'Madrileña'],
    ['María', 'Femenino', 'Español', 'Valenciano'],
    ['Antonio', 'Masculino', 'Español', 'Castellano'],
    ['Lauren', 'Femenino', 'Inglés', 'Norteamericano'],
    ['Arianna', 'Femenino', 'Italiano', 'Italiana'],
    ['Mark', 'Masculino', 'Inglés', 'Norteamericano'],
    ['Socorrinha', 'Femenino', 'Portugués', 'Portuguesa'],
    ['Marlene', 'Femenino', 'Español', 'Mexicana'],
    ['Laura (fast)', 'Femenino', 'Español', 'Madrileña'],
    ['Amélie', 'Femenino', 'Francés', 'Canadiense'],
    ['Marcèles', 'Masculino', 'Neerlandés', 'Holandés'],
    ['Julia', 'Femenino', 'Español', 'Mexicana'],
    ['Adam', 'Masculino', 'Inglés', 'Americano'],
    ['Callie', 'Femenino', 'Inglés', 'Americana']
  ];

  var EVENTS = [
    ['USER_EMAIL', 'Correo electrónico'],
    ['USER_DNI', 'DNI / documento de identidad'],
    ['USER_LOCATION', 'Ubicación / dirección'],
    ['USER_PASSWORD', 'Contraseña'],
    ['USER_MANAGER', 'Responsable / manager'],
    ['USER_BANK_ACCOUNT', 'Cuenta bancaria'],
    ['USER_CREDIT_CARD', 'Tarjeta de crédito'],
    ['USER_POSITION', 'Departamento / puesto']
  ];

  var DEF = {
    CALL_SENT: { level: 2, condition: null, puntuation: 1, icon: 'sending.svg', color: '#1BC5BD' },
    USER_EMAIL: { level: 4, condition: null, puntuation: 0.3, icon: 'write.svg', color: '#FFA500' },
    USER_DNI: { level: 3, condition: null, puntuation: 0.6, icon: 'write.svg', color: '#FFA500' },
    USER_LOCATION: { level: 3, condition: null, puntuation: 0.6, icon: 'write.svg', color: '#FFA500' },
    USER_PASSWORD: { level: 5, condition: null, puntuation: 0, icon: 'write.svg', color: '#F64E60' },
    USER_MANAGER: { level: 4, condition: null, puntuation: 0.4, icon: 'write.svg', color: '#FFA500' },
    USER_BANK_ACCOUNT: { level: 5, condition: null, puntuation: 0, icon: 'write.svg', color: '#F64E60' },
    USER_CREDIT_CARD: { level: 5, condition: null, puntuation: 0, icon: 'write.svg', color: '#F64E60' },
    USER_POSITION: { level: 4, condition: null, puntuation: 0.4, icon: 'write.svg', color: '#FFA500' }
  };

  var DAYS = [
    ['Monday', 'Lunes'],
    ['Tuesday', 'Martes'],
    ['Wednesday', 'Miércoles'],
    ['Thursday', 'Jueves'],
    ['Friday', 'Viernes'],
    ['Saturday', 'Sábado'],
    ['Sunday', 'Domingo']
  ];

  function renderGui(container, tools) {
    var state = {
      langs: ['es-es'],
      defLang: 'es-es',
      list: [],
      rawListCount: 0,
      page: 0,
      activeLocale: null,
      editItem: null,
      editBundle: null,
      editByLocale: {},
      dirtyCampaignType: false,
      loadedOnce: false
    };

    var $ = tools.$;
    var esc = tools.escHtml;
    var status = tools.setStatus;

    function h(v) { return esc(v == null ? '' : v); }
    function css(extra) { return 'width:100%;padding:7px 9px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;box-sizing:border-box;background:white;color:#1a202c;' + (extra || ''); }
    function label(t, req) { return '<label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">' + h(t) + (req ? ' <span style="color:#e53e3e">*</span>' : '') + '</label>'; }
    function title(t) { return '<div style="font-size:12px;font-weight:800;color:#1e293b;margin:16px 0 8px;padding-top:10px;border-top:1px solid #e2e8f0">' + h(t) + '</div>'; }
    function val(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
    function org() { return (tools.state.companyName || 'Organización sin nombre') + ' (' + (tools.state.companyId || '?') + ')'; }
    function activeCompanyId() { return Number(tools.state.companyId || 0); }
    function headers() { return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tools.state.token }; }

    function shell() {
      return '<div style="background:#fff7ed;border:2px solid #fb923c;border-radius:10px;padding:12px 14px;margin-bottom:12px;color:#9a3412">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">' +
          '<div style="font-size:22px;font-weight:900">BORRADOR</div>' +
          '<div style="font-size:11px;font-weight:800;background:#fed7aa;color:#9a3412;border:1px solid #fdba74;border-radius:999px;padding:3px 8px;white-space:nowrap">' + h(MODULE_VERSION) + '</div>' +
        '</div>' +
        '<div style="font-size:12px;margin-top:2px">Módulo inicial en pruebas. No usar como definitivo hasta validación.</div>' +
      '</div>';
    }

    async function fetchJson(url, options) {
      var res = await fetch(url, Object.assign({ headers: headers() }, options || {}));
      var json = null;
      try { json = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error((json && json.records && json.records.devMessage) || (json && json.message) || ('Error HTTP ' + res.status));
      return json;
    }

    function recordsOf(json) {
      if (!json) return [];
      if (Array.isArray(json)) return json;
      if (Array.isArray(json.records)) return json.records;
      if (json.records && Array.isArray(json.records.data)) return json.records.data;
      if (Array.isArray(json.data)) return json.data;
      return [];
    }

    function recordOf(json) {
      if (!json) return null;
      if (json.records && !Array.isArray(json.records)) return json.records;
      if (Array.isArray(json.records)) return json.records[0] || null;
      return json;
    }

    function pick(obj, paths) {
      for (var i = 0; i < paths.length; i++) {
        var cur = obj;
        var parts = paths[i].split('.');
        for (var j = 0; j < parts.length; j++) {
          if (cur == null) break;
          cur = cur[parts[j]];
        }
        if (cur != null && cur !== '') return cur;
      }
      return null;
    }

    function asNumber(v) {
      if (v == null || v === '') return null;
      var n = Number(v);
      return isFinite(n) ? n : null;
    }

    function surveyTypeOf(item) {
      return asNumber(pick(item, ['surveyTypeId', 'common.surveyTypeId', 'template.surveyTypeId', 'campaign.surveyTypeId']));
    }

    function companyIdOf(item) {
      return asNumber(pick(item, [
        'stakeholderCompanyId',
        'companyId',
        'common.stakeholderCompanyId',
        'common.companyId',
        'template.stakeholderCompanyId',
        'template.companyId',
        'stakeholderCompany.id',
        'company.id',
        'common.stakeholderCompany.id',
        'common.company.id'
      ]));
    }

    function templateCampaignIdOf(item) {
      return pick(item, ['templateCampaignId', 'id', 'campaignTemplateId', 'templateId', 'template.id']);
    }

    function campaignTypeIdOf(item) {
      return pick(item, ['campaignTypeId', 'common.campaignTypeId', 'typeId', 'common.typeId', 'campaignType.id']);
    }

    function campaignTypeOf(item) {
      return pick(item, ['campaignType', 'common.campaignType', 'campaignTypeCode', 'common.campaignTypeCode', 'campaignTypeName', 'common.campaignTypeName']) || '';
    }

    function nameOf(item, locale) {
      locale = locale || state.defLang || 'es-es';
      var dictionary = pick(item, ['name.name.dictionary', 'common.name.name.dictionary', 'name.dictionary', 'common.name.dictionary']);
      if (dictionary && typeof dictionary === 'object') return dictionary[locale] || dictionary['es-es'] || dictionary[Object.keys(dictionary)[0]] || '';
      return pick(item, ['name', 'common.name', 'templateName', 'title', 'common.title']) || '(sin nombre)';
    }

    function localesOf(item) {
      var locales = pick(item, ['locales', 'common.locales', 'languages', 'common.languages']);
      if (Array.isArray(locales) && locales.length) return locales.slice();
      var dictionary = pick(item, ['name.name.dictionary', 'common.name.name.dictionary', 'name.dictionary', 'common.name.dictionary']);
      if (dictionary && typeof dictionary === 'object') return Object.keys(dictionary);
      return [state.defLang || 'es-es'];
    }

    function findId(obj, keys) {
      var found = null;
      function walk(x) {
        if (found || !x || typeof x !== 'object') return;
        keys.forEach(function (k) {
          if (!found && x[k] != null && /^\d+$/.test(String(x[k]))) found = Number(x[k]);
        });
        Object.keys(x).forEach(function (k) { if (!found) walk(x[k]); });
      }
      walk(obj);
      return found;
    }

    function extractCampaignTypeId(json) {
      var id = findId(json, ['campaignTypeId', 'typeId', 'id']);
      if (!id) throw new Error('No he podido detectar el campaignTypeId en la respuesta del armazón. Revisa consola.');
      return id;
    }

    function langLabel(code) {
      return (LANG_NAMES[code] || code) + ' (' + code + ')';
    }

    function opt(list, selected, valueKey, labelKey) {
      var s = '';
      list.forEach(function (x) {
        var v = valueKey ? x[valueKey] : x[0];
        var l = labelKey ? x[labelKey] : x[1];
        s += '<option value="' + h(v) + '" ' + (String(v) === String(selected) ? 'selected' : '') + '>' + h(l) + '</option>';
      });
      return s;
    }

    function langOptions(sel) {
      var s = '';
      state.langs.forEach(function (code) {
        s += '<option value="' + h(code) + '" ' + (code === sel ? 'selected' : '') + '>' + h(langLabel(code)) + '</option>';
      });
      return s;
    }

    function catOptions(sel) { return opt(CATEGORIES, sel, 'id', 'label'); }
    function lvlOptions(sel) { return opt(LEVELS, sel, 'id', 'label'); }

    function voiceOptions(sel) {
      var s = '<option value="">Seleccionar voz...</option>';
      VOICES.forEach(function (v) {
        var txt = v[0] + ' - ' + v[1] + ' - ' + v[2] + ' - ' + v[3];
        s += '<option value="' + h(v[0]) + '" ' + (v[0] === sel ? 'selected' : '') + '>' + h(txt) + '</option>';
      });
      return s;
    }

    function eventOptions(sel) {
      var s = '<option value="">Sin evento</option>';
      EVENTS.forEach(function (e) {
        s += '<option value="' + h(e[0]) + '" ' + (e[0] === sel ? 'selected' : '') + '>' + h(e[1] + ' (' + e[0] + ')') + '</option>';
      });
      return s;
    }

    function iconOptions(sel) {
      return '<option value="sending.svg" ' + (sel === 'sending.svg' ? 'selected' : '') + '>sending.svg - llamada enviada</option>' +
        '<option value="write.svg" ' + (sel === 'write.svg' ? 'selected' : '') + '>write.svg - recogida de información</option>';
    }

    function byId(list, id) {
      for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
      return list[0];
    }

    function norm(s) {
      return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_').toUpperCase() || 'TEMPLATE';
    }

    function suggest() {
      return byId(CATEGORIES, val('kat-vcat')).token + '_' + byId(LEVELS, val('kat-vlev')).token + '_VISHING_' + norm(val('kat-vname') || 'Plantilla');
    }

    function syncCampaign(force) {
      var e = $('kat-vctype');
      if (e && (force || !state.dirtyCampaignType)) e.value = suggest();
    }

    function parseNum(v, name, dec) {
      var n = dec ? parseFloat(String(v).replace(',', '.')) : parseInt(v, 10);
      if (!isFinite(n)) throw new Error(name + ' debe ser numérico.');
      return n;
    }

    function req(v, name) {
      if (!String(v || '').trim()) throw new Error('El campo "' + name + '" es obligatorio.');
    }

    function cond(v) {
      var s = String(v || '').trim();
      return (!s || s.toLowerCase() === 'null') ? null : s;
    }

    function assertTime(a, b, name) {
      if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) throw new Error(name + ' debe tener formato HH:MM.');
      if (b <= a) throw new Error(name + ': la hora final debe ser posterior.');
    }

    function isVishingTemplate(item) {
      return Number(surveyTypeOf(item)) === SURVEY_TYPE_ID;
    }

    function belongsToActiveCompany(item) {
      var itemCid = companyIdOf(item);
      if (itemCid == null) return true;
      return Number(itemCid) === activeCompanyId();
    }

    function renderList() {
      container.innerHTML = shell() +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
          '<span style="font-size:11px;font-weight:700;color:#64748b">PLANTILLAS DE VISHING</span>' +
          '<button id="kat-vnew" style="background:#1e293b;color:white;border:0;padding:7px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">+ Crear nueva</button>' +
        '</div>' +
        '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#1e40af;font-size:12px"><b>Organización:</b><br>' + h(org()) + '</div>' +
        '<div style="margin-bottom:8px">' + label('Buscar', false) + '<input id="kat-vsearch" style="' + css() + '" placeholder="Nombre, idioma o campaignType"></div>' +
        '<div id="kat-vstatus" style="display:none"></div>' +
        '<div id="kat-vrows"></div>' +
        '<div style="display:flex;gap:8px;align-items:center"><button id="kat-vprev" style="padding:5px 10px;border:1px solid #e2e8f0;background:white;border-radius:5px">Anterior</button><div id="kat-vpage" style="flex:1;text-align:center;font-size:11px;color:#64748b">Cargando...</div><button id="kat-vnext" style="padding:5px 10px;border:1px solid #e2e8f0;background:white;border-radius:5px">Siguiente</button></div>';

      $('kat-vnew').onclick = function () { renderCreateForm(); };
      $('kat-vsearch').oninput = function () { state.page = 0; renderRows(); };
      $('kat-vprev').onclick = function () { state.page--; renderRows(); };
      $('kat-vnext').onclick = function () { state.page++; renderRows(); };
      renderRows();
      loadList();
    }

    async function loadList() {
      var st = $('kat-vstatus');
      try {
        status(st, '⌛ Cargando plantillas de ' + org() + '...', 'info');
        var cid = activeCompanyId();
        var json = await fetchJson('https://api.kymatio.com/v2/campaigns/templates?companyId=' + encodeURIComponent(cid));
        var all = recordsOf(json);
        state.rawListCount = all.length;
        state.list = all.filter(function (it) { return isVishingTemplate(it) && belongsToActiveCompany(it); });
        state.page = 0;
        state.loadedOnce = true;
        status(st, '✓ Plantillas cargadas: ' + state.list.length + ' de ' + org() + ' · recibidas del endpoint: ' + all.length, 'ok');
        renderRows();
      } catch (e) {
        state.loadedOnce = true;
        status(st, '✗ ' + h(e.message), 'err');
        renderRows();
      }
    }

    function renderRows() {
      var box = $('kat-vrows');
      if (!box) return;
      var q = String(val('kat-vsearch')).toLowerCase();
      var data = state.list.filter(function (it) {
        var locales = localesOf(it).join(' ');
        var txt = [nameOf(it), campaignTypeOf(it), campaignTypeIdOf(it), templateCampaignIdOf(it), locales].join(' ').toLowerCase();
        return !q || txt.indexOf(q) >= 0;
      });
      var max = Math.max(0, Math.ceil(data.length / 5) - 1);
      if (state.page < 0) state.page = 0;
      if (state.page > max) state.page = max;
      var rows = data.slice(state.page * 5, state.page * 5 + 5);
      box.innerHTML = '';

      if (!state.loadedOnce) {
        box.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;margin-bottom:10px">Cargando listado automáticamente...</div>';
      } else if (!rows.length) {
        box.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;margin-bottom:10px">No hay plantillas de Vishing asignadas a esta organización.</div>';
      }

      rows.forEach(function (it) {
        var row = document.createElement('div');
        row.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px';
        var locHtml = localesOf(it).map(function (l) {
          return '<span style="background:#eff6ff;color:#1e40af;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600">' + h(l) + '</span>';
        }).join(' ');
        row.innerHTML = '<div style="display:flex;gap:8px;align-items:center">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + h(nameOf(it)) + '</div>' +
            '<div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + h(campaignTypeOf(it)) + '</div>' +
            '<div style="font-size:10px;color:#94a3b8">templateCampaignId: ' + h(templateCampaignIdOf(it) || '?') + ' · campaignTypeId: ' + h(campaignTypeIdOf(it) || '?') + '</div>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">' + locHtml + '</div>' +
          '</div>' +
          '<button class="edit" style="background:#0369a1;color:white;border:0;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Editar</button>' +
        '</div>';
        row.querySelector('.edit').onclick = function () { renderEditLoading(it); };
        box.appendChild(row);
      });

      if ($('kat-vpage')) $('kat-vpage').textContent = 'Página ' + (state.page + 1) + ' de ' + (max + 1) + ' · ' + data.length + ' plantillas';
      if ($('kat-vprev')) $('kat-vprev').disabled = state.page <= 0;
      if ($('kat-vnext')) $('kat-vnext').disabled = state.page >= max;
    }

    function paramsHtml(params) {
      var pairs = [];
      Object.keys(params || {}).forEach(function (k) { pairs.push([k, params[k]]); });
      [['target_name', '{{PERSON_NAME}}'], ['phone_number', '{{PHONE_NUMBER}}'], ['target_information', '{{COMPANY_NAME}}']].forEach(function (d) {
        if (!params || params[d[0]] == null) pairs.push(d);
      });
      while (pairs.length < 6) pairs.push(['', '']);
      var s = '';
      for (var i = 0; i < 6; i++) {
        s += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px"><input id="kat-vpkey' + i + '" placeholder="clave" value="' + h(pairs[i][0]) + '" style="' + css() + '"><input id="kat-vpval' + i + '" placeholder="valor" value="' + h(pairs[i][1]) + '" style="' + css() + '"></div>';
      }
      return s;
    }

    function daysHtml(activeDays) {
      var active = activeDays && activeDays.length ? activeDays : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      var s = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      DAYS.forEach(function (d) {
        s += '<label style="font-size:12px;color:#475569"><input id="kat-vday' + d[0] + '" type="checkbox" ' + (active.indexOf(d[0]) >= 0 ? 'checked' : '') + '> ' + h(d[1]) + '</label>';
      });
      return s + '</div>';
    }

    function eventBlock(i, evData) {
      var d = evData || { event: '', level: 4, condition: null, puntuation: 0.4, icon: 'write.svg', color: '#FFA500', extraction: '' };
      return '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px">' +
        '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px">Evento ' + i + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 70px 90px;gap:8px;margin-bottom:8px"><div>' + label('Evento', false) + '<select id="kat-vevent' + i + '" style="' + css() + '">' + eventOptions(d.event) + '</select></div><div>' + label('Nivel', false) + '<input id="kat-vlvl' + i + '" type="number" value="' + h(d.level) + '" style="' + css() + '"></div><div>' + label('Puntuación', false) + '<input id="kat-vpunt' + i + '" type="number" step="0.1" value="' + h(d.puntuation) + '" style="' + css() + '"></div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 90px;gap:8px;margin-bottom:8px"><div>' + label('Condición', false) + '<input id="kat-vcond' + i + '" value="' + h(d.condition == null ? 'null' : d.condition) + '" style="' + css() + '"></div><div>' + label('Icono', false) + '<select id="kat-vicon' + i + '" style="' + css() + '">' + iconOptions(d.icon) + '</select></div><div>' + label('Color', false) + '<input id="kat-vcolor' + i + '" type="color" value="' + h(d.color || '#FFA500') + '" style="' + css('padding:2px;height:32px') + '"></div></div>' +
        '<div>' + label('Prompt de extracción', false) + '<textarea id="kat-vext' + i + '" rows="4" style="' + css('resize:vertical') + '">' + h(d.extraction || '') + '</textarea></div>' +
      '</div>';
    }

    function setEventDefault(i) {
      var e = val('kat-vevent' + i);
      if (!e) return;
      var d = DEF[e] || DEF.USER_MANAGER;
      $('kat-vlvl' + i).value = d.level;
      $('kat-vcond' + i).value = d.condition == null ? 'null' : d.condition;
      $('kat-vpunt' + i).value = d.puntuation;
      $('kat-vicon' + i).value = d.icon;
      $('kat-vcolor' + i).value = d.color;
    }

    function normalizeProfile(p) {
      p = p || {};
      return {
        person_name: p.person_name || p.personName || '',
        person_voice: p.person_voice || p.personVoice || '',
        company_name: p.company_name || p.companyName || '',
        department_name: p.department_name || p.departmentName || '',
        person_information: p.person_information || p.personInformation || '',
        company_information: p.company_information || p.companyInformation || '',
        department_information: p.department_information || p.departmentInformation || ''
      };
    }

    function normalizeContent(locale, rec, item, detail) {
      rec = rec || {};
      var cfg = rec.configuration || {};
      var setup = cfg.setup || {};
      var agent = rec.agent || cfg.agent || setup.agent || {};
      var timetable = rec.timetable || cfg.timetable || setup.timetable || {};
      var mapping = rec.mapping || cfg.mapping || {};
      var events = mapping.events || rec.events || [];
      var calculus = mapping.calculus || [];
      var extraction = mapping.extraction || {};
      var eventsStyle = mapping.eventsStyle || rec.eventsStyle || {};
      var params = mapping.params || rec.params || cfg.params || {};
      var profiles = agent.profiles || [];
      var userEvents = [];

      if (calculus && calculus.length) {
        calculus.forEach(function (c) {
          if (!c || c.event === 'CALL_SENT') return;
          var st = eventsStyle[c.event] || {};
          userEvents.push({
            event: c.event,
            level: c.level,
            condition: c.condition,
            puntuation: c.puntuation,
            extraction: extraction[c.event] || '',
            icon: st.icon || (DEF[c.event] && DEF[c.event].icon) || 'write.svg',
            color: st.color || (DEF[c.event] && DEF[c.event].color) || '#FFA500'
          });
        });
      } else {
        events.forEach(function (ev) {
          if (!ev || ev === 'CALL_SENT') return;
          var def = DEF[ev] || DEF.USER_MANAGER;
          var st = eventsStyle[ev] || {};
          userEvents.push({
            event: ev,
            level: def.level,
            condition: null,
            puntuation: def.puntuation,
            extraction: extraction[ev] || '',
            icon: st.icon || def.icon,
            color: st.color || def.color
          });
        });
      }

      while (userEvents.length < 4) userEvents.push({ event: '', level: 4, condition: null, puntuation: 0.4, extraction: '', icon: 'write.svg', color: '#FFA500' });

      return {
        locale: locale,
        name: rec.name || nameOf(detail || item, locale) || '',
        campaignType: campaignTypeOf(detail || item),
        campaignTypeId: campaignTypeIdOf(detail || item) || campaignTypeIdOf(item),
        templateCampaignId: templateCampaignIdOf(detail || item) || templateCampaignIdOf(item),
        categoryId: pick(detail || item, ['categoryId', 'common.categoryId']) || 5,
        levelId: pick(detail || item, ['levelId', 'common.levelId']) || 3,
        greeting: agent.greeting || '',
        p1: normalizeProfile(profiles[0]),
        p2: profiles[1] ? normalizeProfile(profiles[1]) : normalizeProfile({}),
        days: timetable.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeRanges: timetable.timeRanges || [{ start: '09:00', end: '14:00' }, { start: '16:00', end: '18:00' }],
        callInterval: timetable.callInterval || 2,
        callLimit: timetable.callLimit || 2,
        params: params || {},
        events: userEvents.slice(0, 4),
        fixedIcon: (eventsStyle.CALL_SENT && eventsStyle.CALL_SENT.icon) || 'sending.svg',
        fixedColor: (eventsStyle.CALL_SENT && eventsStyle.CALL_SENT.color) || '#1BC5BD',
        raw: rec
      };
    }

    function configLocaleOf(rec) {
      return pick(rec, ['configuration.params.locale', 'params.locale']);
    }

    async function loadAdminTemplateContent(templateCampaignId, locale, allowAnyLocale) {
      var urls = [];
      if (locale) {
        urls.push('https://api.kymatio.com/v2/admin/mgm/campaigns/templates/' + encodeURIComponent(templateCampaignId) + '?locale=' + encodeURIComponent(locale));
      }
      urls.push('https://api.kymatio.com/v2/admin/mgm/campaigns/templates/' + encodeURIComponent(templateCampaignId));

      for (var u = 0; u < urls.length; u++) {
        try {
          var json = await fetchJson(urls[u]);
          var rec = recordOf(json) || {};
          if (!rec || !rec.configuration) continue;
          var recLocale = configLocaleOf(rec);
          if (locale && recLocale && String(recLocale).toLowerCase() !== String(locale).toLowerCase() && !allowAnyLocale) continue;
          rec._source = 'admin-full';
          return rec;
        } catch (e) {
          // Probamos la siguiente variante.
        }
      }
      return null;
    }

    async function loadControllerTemplateContent(cid, campaignTypeId, locale) {
      var json = await fetchJson('https://api.kymatio.com/v2/controller/campaigns/' + encodeURIComponent(cid) + '/templates/' + encodeURIComponent(campaignTypeId) + '?locale=' + encodeURIComponent(locale));
      var rec = recordOf(json) || {};
      rec._source = 'controller-partial';
      return rec;
    }

    async function loadTemplateBundle(item) {
      var cid = activeCompanyId();
      var templateCampaignId = templateCampaignIdOf(item);
      if (!templateCampaignId) throw new Error('No he podido detectar templateCampaignId de la plantilla.');

      var detailJson = await fetchJson('https://api.kymatio.com/v2/campaigns/templates/' + encodeURIComponent(templateCampaignId) + '?companyId=' + encodeURIComponent(cid));
      var detail = recordOf(detailJson) || item;
      var detailCid = companyIdOf(detail);
      if (detailCid != null && Number(detailCid) !== cid) throw new Error('Esta plantilla pertenece a otra empresa.');

      var campaignTypeId = campaignTypeIdOf(detail) || campaignTypeIdOf(item);
      if (!campaignTypeId) throw new Error('No he podido detectar campaignTypeId de la plantilla.');

      var locales = localesOf(detail);
      if (!locales.length) locales = localesOf(item);

      var defaultAdminRec = await loadAdminTemplateContent(templateCampaignId, null, true);
      var defaultLocale = defaultAdminRec && configLocaleOf(defaultAdminRec);
      if ((!locales.length || (locales.length === 1 && !locales[0])) && defaultLocale) locales = [defaultLocale];
      if (!locales.length) locales = [state.defLang || 'es-es'];

      var byLocale = {};
      for (var i = 0; i < locales.length; i++) {
        var locale = locales[i] || defaultLocale || state.defLang || 'es-es';
        var rec = null;
        if (defaultAdminRec && defaultLocale && String(defaultLocale).toLowerCase() === String(locale).toLowerCase()) {
          rec = defaultAdminRec;
        }
        if (!rec) rec = await loadAdminTemplateContent(templateCampaignId, locale, false);
        if (!rec) {
          try {
            rec = await loadControllerTemplateContent(cid, campaignTypeId, locale);
            rec._warning = 'Contenido cargado desde controller: puede no incluir mapping completo.';
          } catch (e1) {
            rec = { _loadError: e1.message, _source: 'none' };
          }
        }
        byLocale[locale] = normalizeContent(locale, rec, item, detail);
        byLocale[locale].source = rec && rec._source || '';
        byLocale[locale].loadWarning = rec && (rec._warning || rec._loadError) || '';
      }

      return {
        item: item,
        detail: detail,
        templateCampaignId: templateCampaignId,
        campaignTypeId: campaignTypeId,
        locales: locales,
        byLocale: byLocale
      };
    }

    function renderEditLoading(item) {
      container.innerHTML = shell() + '<div style="padding:20px;text-align:center;color:#64748b">⌛ Cargando plantilla completa...</div>';
      loadTemplateBundle(item).then(function (bundle) {
        state.editItem = item;
        state.editBundle = bundle;
        state.editByLocale = bundle.byLocale;
        state.activeLocale = bundle.locales[0];
        renderEditTabs();
      }).catch(function (e) {
        container.innerHTML = shell() +
          '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">✗ Error cargando plantilla: ' + h(e.message) + '</div>' +
          '<button id="kat-vback" style="margin-top:10px;background:0;border:0;color:#64748b;text-decoration:underline;cursor:pointer">← Volver</button>';
        $('kat-vback').onclick = renderList;
      });
    }

    function saveActiveLocaleDraft() {
      if (!state.editBundle || !state.activeLocale || !$('kat-vname')) return;
      try {
        var f = collect(false);
        state.editByLocale[state.activeLocale] = formToData(f, state.editByLocale[state.activeLocale] || {});
      } catch (e) {
        // No bloqueamos el cambio de pestaña por errores de formulario en borrador.
      }
    }

    function renderEditTabs() {
      var bundle = state.editBundle;
      var active = state.activeLocale || bundle.locales[0];
      var tabs = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:11px;font-weight:700;color:#64748b">EDITAR PLANTILLA</span><button id="kat-vback" style="background:0;border:0;color:#64748b;text-decoration:underline;cursor:pointer">← Volver</button></div>';
      tabs += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#1e40af;font-size:12px"><b>Organización:</b><br>' + h(org()) + '<br><b>templateCampaignId:</b> ' + h(bundle.templateCampaignId) + ' · <b>campaignTypeId:</b> ' + h(bundle.campaignTypeId) + '</div>';
      tabs += '<div style="display:flex;gap:4px;flex-wrap:wrap;border-bottom:2px solid #e2e8f0;margin-bottom:14px">';
      bundle.locales.forEach(function (loc) {
        var isActive = loc === active;
        tabs += '<button class="kat-vtab" data-locale="' + h(loc) + '" style="padding:7px 12px;border-radius:6px 6px 0 0;border:1px solid ' + (isActive ? '#1e293b' : '#e2e8f0') + ';border-bottom:' + (isActive ? '2px solid white' : '1px solid #e2e8f0') + ';background:' + (isActive ? 'white' : '#f8fafc') + ';color:' + (isActive ? '#1e293b' : '#64748b') + ';font-size:12px;font-weight:' + (isActive ? '800' : '600') + ';cursor:pointer;margin-bottom:-2px">' + h(langLabel(loc)) + '</button>';
      });
      tabs += '<button id="kat-vadd-lang" style="padding:7px 12px;border-radius:6px 6px 0 0;border:1px dashed #94a3b8;background:white;color:#64748b;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:-2px">+ Idioma</button>';
      tabs += '</div><div id="kat-vformwrap"></div>';
      container.innerHTML = shell() + tabs;
      $('kat-vback').onclick = renderList;
      container.querySelectorAll('.kat-vtab').forEach(function (btn) {
        btn.onclick = function () {
          saveActiveLocaleDraft();
          state.activeLocale = this.getAttribute('data-locale');
          renderEditTabs();
        };
      });
      $('kat-vadd-lang').onclick = addLanguage;
      renderFormHtml('edit', state.editByLocale[active] || normalizeContent(active, {}, state.editItem, state.editBundle.detail), $('kat-vformwrap'));
    }

    function addLanguage() {
      saveActiveLocaleDraft();
      var used = state.editBundle.locales.slice();
      var available = state.langs.filter(function (l) { return used.indexOf(l) < 0; });
      if (!available.length) {
        alert('No hay más idiomas activos disponibles para añadir.');
        return;
      }
      var code = prompt('Idiomas disponibles: ' + available.join(', ') + '\n\nEscribe el código del idioma que quieres añadir:');
      if (!code) return;
      code = String(code).trim().toLowerCase();
      if (available.indexOf(code) < 0) {
        alert('Idioma no válido o ya existente.');
        return;
      }
      var base = state.editByLocale[state.activeLocale] || normalizeContent(code, {}, state.editItem, state.editBundle.detail);
      var copy = JSON.parse(JSON.stringify(base));
      copy.locale = code;
      copy.name = '';
      copy.greeting = '';
      state.editBundle.locales.push(code);
      state.editByLocale[code] = copy;
      state.activeLocale = code;
      renderEditTabs();
    }

    function renderCreateForm() {
      state.activeLocale = state.defLang;
      var d = normalizeContent(state.defLang, {}, {}, {});
      d.name = '';
      d.campaignType = '';
      d.campaignTypeId = '';
      d.templateCampaignId = '';
      container.innerHTML = shell() + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:11px;font-weight:700;color:#64748b">CREAR PLANTILLA</span><button id="kat-vback" style="background:0;border:0;color:#64748b;text-decoration:underline;cursor:pointer">← Volver</button></div><div id="kat-vformwrap"></div>';
      $('kat-vback').onclick = renderList;
      renderFormHtml('create', d, $('kat-vformwrap'));
    }

    function renderFormHtml(mode, d, target) {
      var tr1 = d.timeRanges && d.timeRanges[0] ? d.timeRanges[0] : { start: '09:00', end: '14:00' };
      var tr2 = d.timeRanges && d.timeRanges[1] ? d.timeRanges[1] : { start: '16:00', end: '18:00' };
      var p1 = d.p1 || normalizeProfile({});
      var p2 = d.p2 || normalizeProfile({});
      var fixed = { icon: d.fixedIcon || 'sending.svg', color: d.fixedColor || '#1BC5BD' };
      var events = d.events || [];
      while (events.length < 4) events.push({ event: '', level: 4, condition: null, puntuation: 0.4, extraction: '', icon: 'write.svg', color: '#FFA500' });

      target.innerHTML =
        title('1. Identificación') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>' + label('Nombre de la plantilla', true) + '<input id="kat-vname" value="' + h(d.name || '') + '" style="' + css() + '"></div><div>' + label('Idioma', true) + '<select id="kat-vlang" style="' + css() + '">' + langOptions(d.locale) + '</select></div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>' + label('Categoría', true) + '<select id="kat-vcat" style="' + css() + '">' + catOptions(d.categoryId || 5) + '</select></div><div>' + label('Nivel', true) + '<select id="kat-vlev" style="' + css() + '">' + lvlOptions(d.levelId || 3) + '</select></div></div>' +
        '<div style="margin-bottom:8px">' + label('Tipo de campaña', true) + '<input id="kat-vctype" value="' + h(d.campaignType || '') + '" style="' + css() + '"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>' + label('campaignTypeId', false) + '<input id="kat-vtypeid" value="' + h(d.campaignTypeId || '') + '" readonly style="' + css('background:#f8fafc;color:#64748b') + '"></div><div>' + label('templateCampaignId', false) + '<input id="kat-vtplid" value="' + h(d.templateCampaignId || '') + '" readonly style="' + css('background:#f8fafc;color:#64748b') + '"></div></div>' +
        '<div>' + label('Agente', false) + '<input value="151" readonly style="' + css('background:#f8fafc;color:#64748b') + '"></div>' +
        title('2. Configuración del agente') + '<div>' + label('Saludo inicial', true) + '<textarea id="kat-vgreeting" rows="4" style="' + css('resize:vertical') + '">' + h(d.greeting || '') + '</textarea></div>' +
        title('3. Perfiles de voz') +
        '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Perfil 1 obligatorio</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>' + label('Nombre del personaje', true) + '<input id="kat-vpname1" value="' + h(p1.person_name || '') + '" style="' + css() + '"></div><div>' + label('Voz del personaje', true) + '<select id="kat-vvoice1" style="' + css() + '">' + voiceOptions(p1.person_voice || '') + '</select></div></div></div>' +
        '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Perfil 2 opcional</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>' + label('Nombre del personaje', false) + '<input id="kat-vpname2" value="' + h(p2.person_name || '') + '" style="' + css() + '"></div><div>' + label('Voz del personaje', false) + '<select id="kat-vvoice2" style="' + css() + '">' + voiceOptions(p2.person_voice || '') + '</select></div></div></div>' +
        title('4. Contexto de la llamada') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>' + label('Empresa ficticia', true) + '<input id="kat-vcompany" value="' + h(p1.company_name || '') + '" style="' + css() + '"></div><div>' + label('Departamento ficticio', true) + '<input id="kat-vdept" value="' + h(p1.department_name || '') + '" style="' + css() + '"></div></div>' +
        '<div style="margin-bottom:8px">' + label('Información del personaje', true) + '<input id="kat-vpersoninfo" value="' + h(p1.person_information || '') + '" style="' + css() + '"></div>' +
        '<div style="margin-bottom:8px">' + label('Información de la empresa', true) + '<textarea id="kat-vcompanyinfo" rows="3" style="' + css('resize:vertical') + '">' + h(p1.company_information || '') + '</textarea></div>' +
        '<div>' + label('Información del departamento', true) + '<textarea id="kat-vdeptinfo" rows="3" style="' + css('resize:vertical') + '">' + h(p1.department_information || '') + '</textarea></div>' +
        title('5. Programación de llamadas - configuración avanzada') +
        '<details open style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:#475569">Horario y límites</summary><div style="margin-top:10px">' + label('Días', true) + daysHtml(d.days) + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>' + label('Franja 1 inicio', true) + '<input id="kat-vt1s" type="time" value="' + h(tr1.start || '09:00') + '" style="' + css() + '"></div><div>' + label('Franja 1 fin', true) + '<input id="kat-vt1e" type="time" value="' + h(tr1.end || '14:00') + '" style="' + css() + '"></div><div>' + label('Franja 2 inicio', false) + '<input id="kat-vt2s" type="time" value="' + h(tr2.start || '') + '" style="' + css() + '"></div><div>' + label('Franja 2 fin', false) + '<input id="kat-vt2e" type="time" value="' + h(tr2.end || '') + '" style="' + css() + '"></div><div>' + label('Intervalo entre llamadas', true) + '<input id="kat-vinterval" type="number" value="' + h(d.callInterval || 2) + '" min="1" style="' + css() + '"></div><div>' + label('Límite de llamadas', true) + '<input id="kat-vlimit" type="number" value="' + h(d.callLimit || 2) + '" min="1" style="' + css() + '"></div></div></details>' +
        title('6. Parámetros de la llamada') + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px">' + paramsHtml(d.params || {}) + '</div>' +
        title('7. Eventos de la campaña') +
        '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Evento 0 fijo</b><div style="display:grid;grid-template-columns:1fr 70px 90px;gap:8px;margin-top:8px"><input value="CALL_SENT" readonly style="' + css('background:#f8fafc;color:#64748b') + '"><input value="2" readonly style="' + css('background:#f8fafc;color:#64748b') + '"><input value="1" readonly style="' + css('background:#f8fafc;color:#64748b') + '"></div><div style="display:grid;grid-template-columns:1fr 1fr 90px;gap:8px;margin-top:8px"><input value="null" readonly style="' + css('background:#f8fafc;color:#64748b') + '"><select id="kat-vfixedicon" style="' + css() + '">' + iconOptions(fixed.icon) + '</select><input id="kat-vfixedcolor" type="color" value="' + h(fixed.color) + '" style="' + css('padding:2px;height:32px') + '"></div></div>' +
        eventBlock(1, events[0]) + eventBlock(2, events[1]) + eventBlock(3, events[2]) + eventBlock(4, events[3]) +
        '<div style="display:flex;gap:8px;margin-top:14px"><button id="kat-vjson" style="flex:1;background:white;border:1px solid #e2e8f0;color:#475569;padding:9px;border-radius:6px;font-weight:700;cursor:pointer">Ver JSON</button><button id="kat-vsave" style="flex:1;background:#1e293b;color:white;border:0;padding:9px;border-radius:6px;font-weight:700;cursor:pointer">✓ Guardar</button></div><div id="kat-vformstatus" style="display:none"></div><pre id="kat-vpreview" style="display:none;background:#0f172a;color:#cbd5e1;border-radius:8px;padding:12px;font-size:11px;white-space:pre-wrap;max-height:360px;overflow:auto;margin-top:10px"></pre>';

      ['kat-vname', 'kat-vcat', 'kat-vlev'].forEach(function (id) {
        if ($(id)) {
          $(id).oninput = function () { syncCampaign(false); };
          $(id).onchange = function () { syncCampaign(false); };
        }
      });
      if ($('kat-vctype')) $('kat-vctype').oninput = function () { state.dirtyCampaignType = true; };
      if (mode === 'create') syncCampaign(true);
      [1, 2, 3, 4].forEach(function (i) {
        if ($('kat-vevent' + i)) $('kat-vevent' + i).onchange = function () { setEventDefault(i); };
      });
      $('kat-vjson').onclick = function () {
        try {
          var payload = (mode === 'edit') ? buildEditPayload() : template(collect(true));
          $('kat-vpreview').style.display = 'block';
          $('kat-vpreview').textContent = JSON.stringify(payload, null, 2);
        } catch (e) {
          status($('kat-vformstatus'), '✗ ' + h(e.message), 'err');
        }
      };
      $('kat-vsave').onclick = function () { save(mode).catch(function (e) { status($('kat-vformstatus'), '✗ ' + h(e.message), 'err'); }); };
    }

    function collect(validate) {
      var f = {
        name: val('kat-vname'),
        locale: val('kat-vlang'),
        categoryId: parseInt(val('kat-vcat'), 10),
        levelId: parseInt(val('kat-vlev'), 10),
        campaignType: val('kat-vctype'),
        campaignTypeId: val('kat-vtypeid') ? parseInt(val('kat-vtypeid'), 10) : null,
        templateCampaignId: val('kat-vtplid'),
        greeting: val('kat-vgreeting')
      };

      if (validate !== false) {
        req(f.name, 'Nombre de la plantilla');
        req(f.locale, 'Idioma');
        req(f.campaignType, 'Tipo de campaña');
        req(f.greeting, 'Saludo inicial');
      }

      var ctx = {
        company_name: val('kat-vcompany'),
        department_name: val('kat-vdept'),
        person_information: val('kat-vpersoninfo'),
        company_information: val('kat-vcompanyinfo'),
        department_information: val('kat-vdeptinfo')
      };

      if (validate !== false) {
        req(ctx.company_name, 'Empresa ficticia');
        req(ctx.department_name, 'Departamento ficticio');
        req(ctx.person_information, 'Información del personaje');
        req(ctx.company_information, 'Información de la empresa');
        req(ctx.department_information, 'Información del departamento');
      }

      var n1 = val('kat-vpname1');
      var v1 = val('kat-vvoice1');
      var n2 = val('kat-vpname2');
      var v2 = val('kat-vvoice2');
      if (validate !== false) {
        req(n1, 'Nombre del personaje 1');
        req(v1, 'Voz del personaje 1');
        if ((n2 && !v2) || (!n2 && v2)) throw new Error('El perfil 2 debe tener nombre y voz, o quedar vacío.');
      }

      f.profiles = [Object.assign({ person_name: n1, person_voice: v1 }, ctx)];
      if (n2 && v2) f.profiles.push(Object.assign({ person_name: n2, person_voice: v2 }, ctx));

      f.days = [];
      DAYS.forEach(function (d) { if ($('kat-vday' + d[0]) && $('kat-vday' + d[0]).checked) f.days.push(d[0]); });
      if (validate !== false && !f.days.length) throw new Error('Selecciona al menos un día.');

      var t1s = val('kat-vt1s');
      var t1e = val('kat-vt1e');
      var t2s = val('kat-vt2s');
      var t2e = val('kat-vt2e');
      if (validate !== false) assertTime(t1s, t1e, 'Franja 1');
      f.timeRanges = [{ start: t1s || '09:00', end: t1e || '14:00' }];
      if (t2s || t2e) {
        if (validate !== false) assertTime(t2s, t2e, 'Franja 2');
        f.timeRanges.push({ start: t2s, end: t2e });
      }

      f.callInterval = parseNum(val('kat-vinterval') || '2', 'Intervalo entre llamadas', false);
      f.callLimit = parseNum(val('kat-vlimit') || '2', 'Límite de llamadas', false);
      if (validate !== false && (f.callInterval < 1 || f.callLimit < 1)) throw new Error('Intervalo y límite deben ser mayores que 0.');

      f.params = [];
      for (var p = 0; p < 6; p++) {
        var k = val('kat-vpkey' + p);
        var vv = val('kat-vpval' + p);
        if (validate !== false && ((k && !vv) || (!k && vv))) throw new Error('El parámetro ' + (p + 1) + ' debe tener clave y valor, o estar vacío.');
        if (k && vv) f.params.push({ key: k, value: vv });
      }

      f.events = [];
      var seen = {};
      for (var i = 1; i <= 4; i++) {
        var ev = val('kat-vevent' + i);
        if (!ev) continue;
        if (validate !== false && seen[ev]) throw new Error('Evento repetido: ' + ev);
        seen[ev] = true;
        var ex = val('kat-vext' + i);
        var ico = val('kat-vicon' + i);
        var col = val('kat-vcolor' + i);
        if (validate !== false) {
          req(ex, 'Prompt de extracción evento ' + i);
          if (!/^#[0-9A-Fa-f]{6}$/.test(col)) throw new Error('Color no válido en evento ' + i);
        }
        f.events.push({
          event: ev,
          level: parseNum(val('kat-vlvl' + i) || '4', 'Nivel evento ' + i, false),
          condition: cond(val('kat-vcond' + i)),
          puntuation: parseNum(val('kat-vpunt' + i) || '0', 'Puntuación evento ' + i, true),
          extraction: ex,
          icon: ico || 'write.svg',
          color: col || '#FFA500'
        });
      }

      f.fixedIcon = val('kat-vfixedicon') || 'sending.svg';
      f.fixedColor = val('kat-vfixedcolor') || '#1BC5BD';
      return f;
    }

    function formToData(f, current) {
      current = current || {};
      return {
        locale: f.locale,
        name: f.name,
        campaignType: f.campaignType,
        campaignTypeId: f.campaignTypeId,
        templateCampaignId: f.templateCampaignId || current.templateCampaignId,
        categoryId: f.categoryId,
        levelId: f.levelId,
        greeting: f.greeting,
        p1: normalizeProfile(f.profiles[0]),
        p2: f.profiles[1] ? normalizeProfile(f.profiles[1]) : normalizeProfile({}),
        days: f.days,
        timeRanges: f.timeRanges,
        callInterval: f.callInterval,
        callLimit: f.callLimit,
        params: paramsObj(f),
        events: f.events,
        fixedIcon: f.fixedIcon,
        fixedColor: f.fixedColor,
        raw: current.raw || {}
      };
    }

    function paramsObj(f) {
      var out = {};
      (f.params || []).forEach(function (p) { out[p.key] = p.value; });
      return out;
    }

    function skeleton(f) {
      var d = {};
      d[f.locale] = f.name;
      return {
        name: { name: { dictionary: d } },
        categoryId: f.categoryId,
        levelId: f.levelId,
        surveyTypeId: SURVEY_TYPE_ID,
        campaignType: f.campaignType,
        stakeholderCompanyId: activeCompanyId()
      };
    }

    function templateEntryFromData(d) {
      var params = d.params || {};
      var events = ['CALL_SENT'];
      var calculus = [{ event: 'CALL_SENT', level: 2, condition: null, puntuation: 1 }];
      var extraction = {};
      var styles = { CALL_SENT: { icon: d.fixedIcon || 'sending.svg', color: d.fixedColor || '#1BC5BD' } };
      (d.events || []).forEach(function (e) {
        if (!e || !e.event) return;
        events.push(e.event);
        calculus.push({ event: e.event, level: e.level, condition: e.condition, puntuation: e.puntuation });
        extraction[e.event] = e.extraction || '';
        styles[e.event] = { icon: e.icon || 'write.svg', color: e.color || '#FFA500' };
      });
      var profiles = [Object.assign({}, d.p1 || {})];
      if (d.p2 && d.p2.person_name && d.p2.person_voice) profiles.push(Object.assign({}, d.p2));
      return {
        name: d.name || '',
        params: { locale: d.locale },
        configuration: {
          agent: { agentId: AGENT_ID, greeting: d.greeting || '', profiles: profiles },
          timetable: { days: d.days || [], timeRanges: d.timeRanges || [], callInterval: d.callInterval || 2, callLimit: d.callLimit || 2 }
        },
        mapping: { events: events, params: params, calculus: calculus, extraction: extraction, eventsStyle: styles }
      };
    }

    function template(f) {
      var data = formToData(f, {});
      return {
        campaignType: f.campaignType,
        campaignTypeId: f.campaignTypeId,
        stakeholderCompanyId: activeCompanyId(),
        surveyTypeId: SURVEY_TYPE_ID,
        templates: [templateEntryFromData(data)]
      };
    }

    function buildEditPayload() {
      saveActiveLocaleDraft();
      var firstLocale = state.editBundle.locales[0];
      var first = state.editByLocale[state.activeLocale] || state.editByLocale[firstLocale] || {};
      return {
        campaignType: first.campaignType || campaignTypeOf(state.editBundle.detail) || campaignTypeOf(state.editItem),
        campaignTypeId: first.campaignTypeId || state.editBundle.campaignTypeId,
        stakeholderCompanyId: activeCompanyId(),
        surveyTypeId: SURVEY_TYPE_ID,
        templates: state.editBundle.locales.map(function (locale) { return templateEntryFromData(state.editByLocale[locale] || {}); })
      };
    }

    async function save(mode) {
      var st = $('kat-vformstatus');
      if (mode === 'create') {
        var f = collect(true);
        if (!confirm('Se va a crear una plantilla de Vishing en ' + org() + '.\n\n¿Quieres continuar?')) return;
        status(st, '⌛ Creando armazón...', 'info');
        var r = await fetchJson('https://api.kymatio.com/v2/admin/mgm/campaigns/types', { method: 'POST', body: JSON.stringify(skeleton(f)) });
        console.log('Vishing BORRADOR armazón', r);
        f.campaignTypeId = extractCampaignTypeId(r);
        if ($('kat-vtypeid')) $('kat-vtypeid').value = f.campaignTypeId;
        status(st, '⌛ Creando contenido...', 'info');
        var tr = await fetchJson('https://api.kymatio.com/v2/admin/mgm/campaigns/templates', { method: 'POST', body: JSON.stringify(template(f)) });
        console.log('Vishing BORRADOR contenido', tr);
        status(st, '✓ Plantilla creada correctamente. campaignTypeId: ' + h(f.campaignTypeId), 'ok');
        return;
      }

      collect(true);
      var payload = buildEditPayload();
      var tplCampaignId = state.editBundle && state.editBundle.templateCampaignId;
      if (!tplCampaignId) throw new Error('No hay templateCampaignId.');
      if (!confirm('Se va a guardar la plantilla de Vishing de ' + org() + ' con ' + payload.templates.length + ' idioma(s).\n\n¿Continuar?')) return;
      status(st, '⌛ Actualizando plantilla...', 'info');
      await fetchJson('https://api.kymatio.com/v2/admin/mgm/campaigns/templates/' + encodeURIComponent(tplCampaignId), { method: 'PUT', body: JSON.stringify(payload) });
      status(st, '✓ Plantilla actualizada correctamente.', 'ok');
    }

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando editor BORRADOR...</div>';
    tools.loadCompanyData().then(function (data) {
      var l = (data.environment && data.environment.languages) || {};
      state.langs = (Array.isArray(l.list) && l.list.length) ? l.list.slice() : ['es-es'];
      state.defLang = l.default || state.langs[0] || 'es-es';
      renderList();
    }).catch(function (e) {
      container.innerHTML = '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">Error: ' + h(e.message) + '</div>';
    });
  }

  KAT.registerModule({
    key: 'vishing_templates_draft',
    label: 'BORRADOR - Plantillas de Vishing',
    icon: '&#9742;',
    order: 75,
    forceGuiOnly: true,
    hideModeSwitch: true,
    renderGui: renderGui
  });
})();
