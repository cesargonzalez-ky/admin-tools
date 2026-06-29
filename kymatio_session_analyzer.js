(function () {
  'use strict';

  var VERSION = 'session-analyzer-18-all-companies';
  var API = 'https://api.kymatio.com/v2';
  var BATCH_SIZE = 20;
  var SLEEP_MS = 300;

  var FAMILY_NAMES = {
    1: 'Informacion y funciones',
    8: 'Ciberconcienciacion',
    11: 'Welcome / Bienvenida',
    13: 'Ingenieria social / Phishing',
    15: 'Pwned',
    18: 'Gamificacion'
  };

  // Sesiones tecnicas/sistema que pueden quedar en PROGRESS de forma permanente.
  // Desde v03 solo se ignoran si NO forman parte del surveyFlow real de la empresa.
  var SYSTEM_SURVEY_TYPE_IDS = {
    133: true
  };

  // Mapa estandar para traducir codigos funcionales del surveyFlow a surveyTypeId.
  // En surveyFlow las sesiones estandar suelen aparecer como KYMATIO_CYBERSECURITY001,
  // KYMATIO_WELCOME, etc., sin incluir surveyTypeId.
  var STANDARD_SURVEY_TYPE_MAP = (function () {
    var m = {};

    function add(code, id, familyId, familyName) {
      m[String(code).toUpperCase()] = {
        surveyTypeId: Number(id),
        surveyFamilyId: familyId == null || familyId === '' ? null : Number(familyId),
        name: String(code),
        familyName: familyName || ''
      };
    }

    add('KYMATIO_INSIDER_RED', 1, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_GRI_COMMITMENT', 2, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_CLIMATE_PLUS_BLUE', 3, 10, 'KYMATIO_CLIMA_PLUS');
    add('KYMATIO_GRI_TRUST', 4, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_GRI_CHALLENGE', 5, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_MULTI_RISK', 6, null, '');
    add('KYMATIO_PHISHING_GLOBAL', 7, 12, 'KYMATIO_GLOBAL');
    add('KYMATIO_BREACH_GLOBAL', 8, 12, 'KYMATIO_GLOBAL');
    add('KYMATIO_GRI_PRAGMATISM', 9, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_VISHING', 10, null, '');
    add('KYMATIO_NEUROVISHING', 11, null, '');

    // KYMATIO_CYBERSECURITY001..006 => 12..17
    for (var i = 1; i <= 6; i++) add('KYMATIO_CYBERSECURITY' + String(i).padStart(3, '0'), 11 + i, 8, 'KYMATIO_CYBERSECURITY');

    add('KYMATIO_NIS2', 18, null, '');
    add('KYMATIO_GRI_DISSATISFACTION', 19, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_GRI_NEGLIGENCE', 20, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_GRI_EXPEDITION', 21, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_GRI_OVERLOAD', 22, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_CLIMATE_PLUS', 23, 10, 'KYMATIO_CLIMA_PLUS');
    add('KYMATIO_INSIDER_RED_REFRESH', 24, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_CYBERSECURITY_GLOBAL', 25, 12, 'KYMATIO_GLOBAL');
    add('KYMATIO_CLIMATE_GLOBAL', 26, 12, 'KYMATIO_GLOBAL');
    add('KYMATIO_INSIDER_GREEN', 27, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_INSIDER_GREEN_REFRESH', 28, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_WELCOME', 29, 11, 'KYMATIO_WELCOME');
    add('KYMATIO_GRI_DIVERGENCE', 30, 2, 'KYMATIO_GRI_PLUS');
    add('KYMATIO_GRI_GLOBAL', 31, 12, 'KYMATIO_GLOBAL');

    // KYMATIO_CYBERSECURITY007..026 => 32..51
    for (var j = 7; j <= 26; j++) add('KYMATIO_CYBERSECURITY' + String(j).padStart(3, '0'), j + 25, 8, 'KYMATIO_CYBERSECURITY');

    add('KYMATIO_PHISHING_MANUAL', 52, 13, 'KYMATIO_PHISHING');
    add('KYMATIO_GAMING_BREACH', 53, 15, 'KYMATIO_GAMING');
    add('KYMATIO_SCORE_GLOBAL', 54, 12, 'KYMATIO_GLOBAL');
    add('KYMATIO_TRAININGBOT', 55, null, '');
    add('KYMATIO_NPS', 56, 4, 'KYMATIO_FREETEXT');
    add('KYMATIO_NEUROPHISHING', 57, 13, 'KYMATIO_PHISHING');
    add('KYMATIO_GAMING_BREACH_CORPORATE', 58, 15, 'KYMATIO_GAMING');
    add('KYMATIO_ARCHETYPE', 59, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_IMPACT', 60, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_INSIDER_BLUE', 61, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_ARCHETYPE_REFRESH', 62, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_IMPACT_REFRESH', 63, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_INSIDER_BLUE_REFRESH', 64, 1, 'KYMATIO_DIRECT');

    // KYMATIO_CYBERSECURITY027..074 => 65..112
    for (var k = 27; k <= 74; k++) add('KYMATIO_CYBERSECURITY' + String(k).padStart(3, '0'), k + 38, 8, 'KYMATIO_CYBERSECURITY');

    add('KYMATIO_CYBERSECURITYS21', 113, 8, 'KYMATIO_CYBERSECURITY');
    add('KYMATIO_CYBERSECURITY001_NO_GDPR', 114, 8, 'KYMATIO_CYBERSECURITY');
    add('KYMATIO_CYBERSECURITY002_NO_GDPR', 115, 8, 'KYMATIO_CYBERSECURITY');
    add('KYMATIO_CYBERSECURITY003_NO_GDPR', 116, 8, 'KYMATIO_CYBERSECURITY');
    add('KYMATIO_CYBERSECURITY004_NO_GDPR', 117, 8, 'KYMATIO_CYBERSECURITY');
    add('KYMATIO_CYBERSECURITY007_NO_GDPR', 118, 8, 'KYMATIO_CYBERSECURITY');
    add('KYMATIO_CYBERSECURITY008_NO_GDPR', 119, 8, 'KYMATIO_CYBERSECURITY');
    add('KYMATIO_CYBERSECURITY016_NO_GDPR', 120, 8, 'KYMATIO_CYBERSECURITY');
    add('KYMATIO_CYBERSECURITY021_NO_GDPR', 121, 8, 'KYMATIO_CYBERSECURITY');

    add('KYMATIO_ASSETS_GLOBAL', 122, 12, 'KYMATIO_GLOBAL');
    add('KYMATIO_GRI_AMBITION', 123, 1, 'KYMATIO_DIRECT');
    add('KYMATIO_BURNOUT', 124, 16, 'KYMATIO_BURNOUT');
    add('KYMATIO_SOCIAL_ENGINEERING_GLOBAL', 125, 12, 'KYMATIO_GLOBAL');
    add('KYMATIO_BURNOUT_GLOBAL', 126, 12, 'KYMATIO_GLOBAL');
    add('KYMATIO_SMISHING', 127, null, '');
    add('KYMATIO_NEUROSMISHING', 128, null, '');
    add('KYMATIO_SOCIAL_ENGINERING', 129, null, '');
    add('KYMATIO_RANKING', 130, null, '');
    add('KYMATIO_GAMING', 131, 18, 'KYMATIO_GAMING');
    add('KYMATIO_CUSTOM', 133, null, '');
    add('KYMATIO_CYBOT', 134, null, '');
    add('KYMATIO_WELLBOT', 135, null, '');
    add('KYMATIO_KYBOT', 136, null, '');
    add('KYMATIO_SUPBOT', 137, null, '');
    add('KYMATIO_ABSBOT', 138, null, '');
    add('KYMATIO_COMPANYBOT', 139, null, '');
    // Aliases reales que aparecen en el surveyFlow (distintos de los nombres internos)
    add('KYMATIO_PHISHING', 7, 13, 'KYMATIO_PHISHING');              // alias real en surveyFlow
    add('KYMATIO_BREACH_CORPORATE', 8, 12, 'KYMATIO_GLOBAL');        // alias real en surveyFlow

    return m;
  })();

  var DEFAULT_POLICY = {
    name: 'SurveyFlow principal',
    checkSurveyFlow: true,
    checkDuplicates: true,
    checkNoNext: true,
    checkWelcome: true,
    welcomeFamilyId: 11,
    useSurveyFlowLastException: true,
    includeOutsideSurveyFlow: false
  };

  var state = {
    companyId: '',
    companyName: '',
    users: [],
    surveyFlow: null,
    surveyTypesInFlow: [],
    surveyTypeSetInFlow: {},
    familiesInFlow: [],
    lastSurveyTypeIdInFlow: null,
    lastSurveyNameInFlow: '',
    surveyFlowParseWarning: false,
    results: null,
    running: false,
    cancelled: false
  };

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function decodeHtml(v) {
    var t = document.createElement('textarea');
    t.innerHTML = String(v == null ? '' : v);
    return t.value;
  }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function getStore() {
    var el = document.querySelector('[data-v-app]') || document.querySelector('#app');
    return el && el.__vue_app__ && el.__vue_app__.config && el.__vue_app__.config.globalProperties && el.__vue_app__.config.globalProperties.$store;
  }

  function apiHeaders() {
    return { Accept: 'application/json', 'Content-Type': 'application/json' };
  }

  async function apiGet(path) {
    var res = await fetch(API + path, { credentials: 'include', headers: apiHeaders() });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var msg = (data && data.message) || (data && data.records && data.records.devMessage) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  function detectCompany() {
    var cid = localStorage.getItem('managedCompanyId') || '';
    var cname = '';

    try {
      var cs = JSON.parse(localStorage.getItem('companySelected') || 'null');
      if (cs) {
        cid = String(cs.stakeholderId || cs.id || cid || '');
        cname = cs.name || cname;
      }
    } catch (e) {}

    try {
      var store = getStore();
      var st = store && store.state;
      var c = st && st.Admin && st.Admin.companySelected || st && st.Controller && st.Controller.companySelected;
      if (c) {
        cid = String(c.stakeholderId || c.id || cid || '');
        cname = c.name || cname;
      }
    } catch (e2) {}

    state.companyId = cid;
    state.companyName = cname || ('Empresa ' + (cid || '?'));
  }

  function normalizeUser(u) {
    return {
      stakeholderId: u.stakeholderId || u.id || u.personId || '',
      name: u.name || '',
      surname: u.surname || u.lastName || '',
      email: u.email || u.mail || '',
      department: u.stakeholderDepartmentName || u.departmentName || u.department || ''
    };
  }

  async function loadUsers() {
    var store = getStore();
    var fromStore = [];
    try {
      fromStore = (store && store.state && store.state.Users && store.state.Users.users) || [];
    } catch (e) {}

    if (Array.isArray(fromStore) && fromStore.length) {
      state.users = fromStore.map(normalizeUser).filter(function (u) { return !!u.stakeholderId; });
      return state.users;
    }

    var candidates = [
      '/controller/stakeholders/companies/' + encodeURIComponent(state.companyId) + '/people?stakeholderDepartmentId=true&email=true&login=true&tags=true',
      '/controller/stakeholders/companies/' + encodeURIComponent(state.companyId) + '/people',
      '/admin/stakeholders/companies/' + encodeURIComponent(state.companyId) + '/people?stakeholderDepartmentId=true&email=true&login=true&tags=true'
    ];

    var lastErr = null;
    for (var i = 0; i < candidates.length; i++) {
      try {
        var data = await apiGet(candidates[i]);
        var records = Array.isArray(data.records) ? data.records : [];
        if (records.length) {
          state.users = records.map(normalizeUser).filter(function (u) { return !!u.stakeholderId; });
          return state.users;
        }
      } catch (e2) { lastErr = e2; }
    }

    throw new Error('No se han podido cargar usuarios. Entra en Operador > Usuarios y vuelve a lanzar el bookmarklet. Ultimo error: ' + (lastErr && lastErr.message || 'sin datos'));
  }

  function valueByPath(obj, path) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (!cur || typeof cur !== 'object') return null;
      cur = cur[path[i]];
    }
    return cur;
  }

  function asNumberId(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'object') {
      return Number(v.surveyTypeId || v.typeId || v.id || v.value || 0);
    }
    return Number(v || 0);
  }

  function localizedName(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v !== 'object') return String(v);
    try {
      var d = v.name && v.name.dictionary || v.dictionary || null;
      if (d) return d['es-es'] || d['en-us'] || d[Object.keys(d)[0]] || '';
    } catch (e) {}
    return v.name || v.title || v.label || v.code || '';
  }

  function addSurveyTypeFromCode(out, seen, text) {
    if (!text) return false;
    var matches = String(text).toUpperCase().match(/KYMATIO_[A-Z0-9_]+/g) || [];
    var added = false;

    matches.forEach(function (raw) {
      var code = raw.replace(/[^A-Z0-9_]/g, '');
      var info = STANDARD_SURVEY_TYPE_MAP[code];
      if (!info || !info.surveyTypeId) return;

      var key = String(info.surveyTypeId);
      if (seen[key]) return;
      seen[key] = true;
      out.push({
        surveyTypeId: info.surveyTypeId,
        surveyFamilyId: info.surveyFamilyId || null,
        name: info.name || code,
        source: 'standard-map'
      });
      added = true;
    });

    return added;
  }

  function pushSurveyType(out, seen, x) {
    if (!x || typeof x !== 'object') return;

    var typeCandidates = [
      x.surveyTypeId,
      x.survey_type_id,
      x.surveyTypeID,
      x.survey_type,
      x.surveyType,
      x.typeSurveyId,
      x.typeId,
      valueByPath(x, ['survey', 'surveyTypeId']),
      valueByPath(x, ['survey', 'typeId']),
      valueByPath(x, ['surveyType', 'surveyTypeId']),
      valueByPath(x, ['surveyType', 'id']),
      valueByPath(x, ['campaignType', 'surveyTypeId'])
    ];

    var typeId = 0;
    for (var i = 0; i < typeCandidates.length; i++) {
      typeId = asNumberId(typeCandidates[i]);
      if (typeId) break;
    }

    if (!typeId) {
      var codeCandidates = [
        x.surveyType,
        x.surveyTypeCode,
        x.survey_type,
        x.type,
        x.code,
        x.value,
        x.name,
        x.title,
        x.label,
        valueByPath(x, ['survey', 'surveyType']),
        valueByPath(x, ['survey', 'code']),
        valueByPath(x, ['surveyType', 'code']),
        valueByPath(x, ['surveyType', 'name'])
      ];

      var mapped = false;
      for (var ci = 0; ci < codeCandidates.length; ci++) {
        if (addSurveyTypeFromCode(out, seen, localizedName(codeCandidates[ci]) || codeCandidates[ci])) mapped = true;
      }

      if (!mapped) return;
      return;
    }

    var familyId = asNumberId(
      x.surveyFamilyId ||
      x.survey_family_id ||
      x.familyId ||
      x.surveyFamily ||
      valueByPath(x, ['survey', 'surveyFamilyId']) ||
      valueByPath(x, ['surveyFamily', 'id'])
    );

    var name =
      localizedName(x.surveyName) ||
      localizedName(x.name) ||
      localizedName(x.title) ||
      localizedName(x.label) ||
      localizedName(x.campaignTypeName) ||
      localizedName(x.campaignType) ||
      localizedName(valueByPath(x, ['survey', 'name'])) ||
      localizedName(valueByPath(x, ['surveyType', 'name'])) ||
      '';

    // Detectar repeatable — la API usa 'repeteable' (typo)
    var repCandidates = [
      x.repeteable, x.repeatable, x.isRepeatable, x.is_repeatable, x.repeat, x.canRepeat
    ];
    var isRepeatable = false;
    for (var ri = 0; ri < repCandidates.length; ri++) {
      if (repCandidates[ri] === true || repCandidates[ri] === 1 || repCandidates[ri] === 'true') {
        isRepeatable = true; break;
      }
    }

    var key = String(typeId);
    if (seen[key]) return;
    seen[key] = true;
    out.push({ surveyTypeId: typeId, surveyFamilyId: familyId || null, name: decodeHtml(name || ''), repeatable: isRepeatable });
  }

  function collectSurveyTypes(obj) {
    var out = [];
    var seenType = {};
    var seenNode = [];

    function walk(x) {
      if (!x) return;

      if (typeof x === 'string') {
        addSurveyTypeFromCode(out, seenType, x);
        return;
      }

      if (typeof x !== 'object') return;
      if (seenNode.indexOf(x) >= 0) return;
      seenNode.push(x);

      // Formato real del surveyFlow: {next:'KYMATIO_CODE', repeteable:bool, previous:..., date:...}
      if (typeof x.next === 'string' && x.next.indexOf('KYMATIO_') === 0) {
        var sfInfo = STANDARD_SURVEY_TYPE_MAP[x.next.toUpperCase()];
        if (sfInfo && sfInfo.surveyTypeId) {
          var sfKey = String(sfInfo.surveyTypeId);
          if (!seenType[sfKey]) {
            seenType[sfKey] = true;
            var sfRep = (x.repeteable === true || x.repeatable === true ||
                         x.repeteable === 1 || x.repeatable === 1);
            out.push({
              surveyTypeId: sfInfo.surveyTypeId,
              surveyFamilyId: sfInfo.surveyFamilyId || null,
              name: sfInfo.name || x.next,
              repeatable: sfRep,
              source: 'surveyflow-next'
            });
          }
        }
        return; // No seguir bajando — evitar duplicados
      }

      pushSurveyType(out, seenType, x);

      Object.keys(x).forEach(function (k) { walk(x[k]); });
    }

    walk(obj);
    return out;
  }

  async function loadSurveyFlow() {
    state.surveyFlow = null;
    state.surveyTypesInFlow = [];
    state.surveyTypeSetInFlow = {};
    state.repeatableSurveyTypeSet = {};
    state.surveyTypeHasSuccessor = {}; // surveyTypeId -> true si hay un nodo que lo tiene como previous
    state.familiesInFlow = [];
    state.lastSurveyTypeIdInFlow = null;
    state.lastSurveyNameInFlow = '';
    state.lastCyberSurveyTypeIdInFlow = null;
    state.surveyFlowParseWarning = false;

    try {
      var data = await apiGet('/admin/stakeholders/companies/' + encodeURIComponent(state.companyId) + '?environment=true&journey=true&services=true');
      var company = data.records || data;
      var journey = company && company.journey || {};
      var sf = journey.surveyflow || journey.surveyFlow || journey.flow || null;
      state.surveyFlow = sf;
      state.surveyTypesInFlow = collectSurveyTypes(sf || journey);
      state.surveyFlowParseWarning = !!(sf || journey) && !state.surveyTypesInFlow.length;

      state.surveyTypesInFlow.forEach(function (s) {
        state.surveyTypeSetInFlow[String(s.surveyTypeId)] = true;
        if (s.repeatable) {
          state.repeatableSurveyTypeSet[String(s.surveyTypeId)] = true;
        }
        if (s.surveyFamilyId && state.familiesInFlow.indexOf(s.surveyFamilyId) < 0) {
          state.familiesInFlow.push(s.surveyFamilyId);
        }
      });

      // Construir mapa de sucesores centrado en la rama de cyber:
      // Para cada nodo del surveyFlow, si su 'previous' es una sesión de cyber (familyId 8),
      // marcar ese surveyTypeId como "tiene sucesor configurado en la rama"
      // También marcamos el sucesor de sesiones custom que estén en la rama cyber
      if (Array.isArray(sf)) {
        // Primero construir índice por next
        var sfByNext = {};
        sf.forEach(function(node) { if (node.next) sfByNext[node.next.toUpperCase()] = node; });

        sf.forEach(function(node) {
          var prev = node.previous;
          if (!prev || typeof prev !== 'string') return;
          var prevCode = prev.toUpperCase();
          var prevInfo = STANDARD_SURVEY_TYPE_MAP[prevCode];
          if (prevInfo && prevInfo.surveyTypeId) {
            // Marcar si el nodo previo es cyber (familyId 8) o está en la rama
            // (el sucesor de cyber puede ser no-cyber, pero lo que importa es que
            //  la sesión cyber tiene un nodo siguiente en el flujo)
            if (prevInfo.surveyFamilyId === 8 || state.surveyTypeSetInFlow[String(prevInfo.surveyTypeId)]) {
              state.surveyTypeHasSuccessor[String(prevInfo.surveyTypeId)] = true;
            }
          }
          // Sesiones custom: si previousSurveyId apunta a una sesión que está en el flujo
          if (node.previousSurveyId) {
            state.surveyTypeHasSuccessor['custom_' + String(node.previousSurveyId)] = true;
          }
        });

        // Propagar: si una sesión no-cyber tiene sucesor y está justo antes de cyber,
        // también marcar la cyber previa como con sucesor
        // (cubre el caso CYBER032 -> CUSTOM -> CYBER033)
        var changed = true;
        var maxIter = sf.length;
        while (changed && maxIter-- > 0) {
          changed = false;
          sf.forEach(function(node) {
            var nextCode = node.next && node.next.toUpperCase();
            var nextInfo = nextCode && STANDARD_SURVEY_TYPE_MAP[nextCode];
            var prevCode2 = node.previous && node.previous.toUpperCase();
            var prevInfo2 = prevCode2 && STANDARD_SURVEY_TYPE_MAP[prevCode2];
            if (!prevInfo2 || !nextInfo) return;
            // Si el sucesor tiene sucesor, el predecesor también tiene sucesor
            if (state.surveyTypeHasSuccessor[String(nextInfo.surveyTypeId)] &&
                !state.surveyTypeHasSuccessor[String(prevInfo2.surveyTypeId)]) {
              state.surveyTypeHasSuccessor[String(prevInfo2.surveyTypeId)] = true;
              changed = true;
            }
          });
        }
      }

      if (state.surveyTypesInFlow.length) {
        var last = state.surveyTypesInFlow[state.surveyTypesInFlow.length - 1];
        state.lastSurveyTypeIdInFlow = last.surveyTypeId;
        state.lastSurveyNameInFlow = last.name || '';
      }

      // Calcular la última sesión de cyber de la rama:
      // es la sesión de cyber que NO tiene sucesor marcado en surveyTypeHasSuccessor
      // (o que tiene sucesor pero ese sucesor no lleva a más cyber)
      state.lastCyberSurveyTypeIdInFlow = null;
      var cyberInFlow = state.surveyTypesInFlow.filter(function(s){ return s.surveyFamilyId === 8; });
      if (cyberInFlow.length) {
        // La última cyber sin sucesor configurado es el final de la rama
        var lastCyber = null;
        for (var ci = cyberInFlow.length - 1; ci >= 0; ci--) {
          var cs = cyberInFlow[ci];
          if (!state.surveyTypeHasSuccessor[String(cs.surveyTypeId)]) {
            lastCyber = cs;
            break;
          }
        }
        // Si todas tienen sucesor, la última del array es el final
        if (!lastCyber) lastCyber = cyberInFlow[cyberInFlow.length - 1];
        state.lastCyberSurveyTypeIdInFlow = lastCyber.surveyTypeId;
      }

      state.familiesInFlow.sort(function (a, b) { return a - b; });
    } catch (e) {
      state.surveyFlow = null;
      state.surveyTypesInFlow = [];
      state.surveyTypeSetInFlow = {};
      state.familiesInFlow = [];
      state.lastSurveyTypeIdInFlow = null;
      state.lastSurveyNameInFlow = '';
      state.surveyFlowParseWarning = false;
    }
  }

  function familyLabel(id) {
    return (FAMILY_NAMES[id] || ('Familia ' + id)) + ' (' + id + ')';
  }

  function isInSurveyFlow(record) {
    return !!(record && state.surveyTypeSetInFlow[String(Number(record.surveyTypeId))]);
  }

  function isSystemSession(record) {
    return !!(record && SYSTEM_SURVEY_TYPE_IDS[Number(record.surveyTypeId)] && !isInSurveyFlow(record));
  }

  function dateValue(v) {
    if (!v) return 0;
    var d = new Date(String(v).replace(' ', 'T'));
    var t = d.getTime();
    return isNaN(t) ? 0 : t;
  }

  function getUserDisplay(u) {
    return {
      stakeholderId: u.stakeholderId,
      nombre: u.name,
      apellidos: u.surname,
      email: u.email,
      departamento: u.department
    };
  }

  function isLikelyOperationalFlowRecord(record, opts) {
    if (!record) return false;
    var familyId = Number(record.surveyFamilyId || 0);
    var typeId = Number(record.surveyTypeId || 0);
    var name = String(decodeHtml(record.surveyName || '')).toLowerCase();

    if (familyId === opts.welcomeFamilyId) return false;
    if (typeId === 52 || name === 'phishing' || name.indexOf('phishing') >= 0) return false;
    if (typeId === 58 || familyId === 15 || name.indexOf('pwned') >= 0) return false;
    if (SYSTEM_SURVEY_TYPE_IDS[typeId]) return false;

    return true;
  }

  function chooseDuplicateActions(items) {
    var finish = items.filter(function (x) { return x.surveyStatus === 'FINISH'; });
    var non = items.filter(function (x) { return x.surveyStatus !== 'FINISH'; });
    var keep;
    var del = [];
    var requiresIt = false;

    if (finish.length && non.length) {
      finish.sort(function (a, b) { return dateValue(a.userStartDate || a.dateStatus) - dateValue(b.userStartDate || b.dateStatus); });
      keep = finish[0];
      del = non.slice();
      requiresIt = true;
    } else if (finish.length > 1) {
      finish.sort(function (a, b) { return dateValue(a.userStartDate || a.dateStatus) - dateValue(b.userStartDate || b.dateStatus); });
      keep = finish[0];
      del = finish.slice(1);
      requiresIt = false;
    } else {
      non.sort(function (a, b) { return dateValue(a.userStartDate || a.dateStatus) - dateValue(b.userStartDate || b.dateStatus); });
      keep = non[0];
      del = non.slice(1);
      requiresIt = true;
    }

    return del.map(function (d) { return { keep: keep, remove: d, requiresIt: requiresIt || d.surveyStatus !== 'FINISH' }; });
  }

  function getFlowRecords(all, opts) {
    var records = all.filter(function (r) { return isInSurveyFlow(r); });

    if (opts.includeOutsideSurveyFlow) {
      all.forEach(function (r) {
        if (isInSurveyFlow(r)) return;
        if (isSystemSession(r)) return;
        if (Number(r.surveyFamilyId) === opts.welcomeFamilyId) return;
        records.push(r);
      });
    }

    return records;
  }

  // surveyTypeIds inherentemente repetibles — nunca se reportan como duplicados:
  // Phishing:  KYMATIO_PHISHING(7), KYMATIO_PHISHING_MANUAL(52), KYMATIO_NEUROPHISHING(57)
  // Breach:    KYMATIO_BREACH_GLOBAL/BREACH_CORPORATE(8), KYMATIO_GAMING_BREACH(53), KYMATIO_GAMING_BREACH_CORPORATE(58)
  // Vishing:   KYMATIO_VISHING(10), KYMATIO_NEUROVISHING(11)
  // Smishing:  KYMATIO_SMISHING(127), KYMATIO_NEUROSMISHING(128)
  // Gaming:    KYMATIO_GAMING(131)
  var ALWAYS_REPEATABLE_IDS = {
    '7':1, '8':1, '10':1, '11':1,
    '52':1, '53':1, '57':1, '58':1,
    '127':1, '128':1, '131':1
  };

  function analyzeUser(user, records, opts) {
    var base = getUserDisplay(user);
    var rows = { duplicates: [], noNext: [], noWelcome: [], noSessions: [] };
    var all = Array.isArray(records) ? records : [];

    if (!all.length) {
      rows.noSessions.push(Object.assign({}, base));
      rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: 'Sin welcome en absoluto' }));
      return rows;
    }

    var flowRecords = getFlowRecords(all, opts);

    if (opts.checkDuplicates) {
      var byType = {};
      flowRecords.forEach(function (r) {
        var k = String(r.surveyTypeId || '');
        if (!k) return;
        if (!byType[k]) byType[k] = [];
        byType[k].push(r);
      });

      Object.keys(byType).forEach(function (k) {
        if (byType[k].length <= 1) return;
        // Excluir sesiones inherentemente repetibles (phishing, smishing, vishing, breach, gaming)
        if (ALWAYS_REPEATABLE_IDS[k]) return;
        // Excluir también las marcadas como repeatable en el surveyFlow
        if (state.repeatableSurveyTypeSet && state.repeatableSurveyTypeSet[k]) return;
        chooseDuplicateActions(byType[k]).forEach(function (a) {
          rows.duplicates.push(Object.assign({}, base, {
            ambito: opts.includeOutsideSurveyFlow && !isInSurveyFlow(a.remove) ? 'Fuera surveyFlow' : 'SurveyFlow',
            sesion: a.remove.surveyName || a.keep.surveyName || '',
            surveyTypeId: a.remove.surveyTypeId || a.keep.surveyTypeId || '',
            surveyFamilyId: a.remove.surveyFamilyId || a.keep.surveyFamilyId || '',
            surveyEntityIdEliminar: a.remove.surveyEntityId || '',
            estadoEliminar: a.remove.surveyStatus || '',
            surveyEntityIdConservar: a.keep && a.keep.surveyEntityId || '',
            estadoConservar: a.keep && a.keep.surveyStatus || '',
            requiereIT: a.requiresIt ? 'Si' : 'No'
          }));
        });
      });
    }

    if (opts.checkNoNext) {
      if (!state.surveyTypesInFlow.length && !opts.includeOutsideSurveyFlow && !flowRecords.length) {
        // No evaluable: surveyFlow sin sesiones útiles — no reportar
      } else {
        // Analizar solo la rama de cyber (familyId 8)
        var cyberRecords = flowRecords.filter(function(r){ return Number(r.surveyFamilyId) === 8; });
        var pending = cyberRecords.some(function (r) { return ['AVAILABLE', 'PROGRESS', 'UNAVAILABLE'].indexOf(r.surveyStatus) >= 0; });
        var finished = cyberRecords.filter(function (r) { return r.surveyStatus === 'FINISH'; });

        if (!pending) {
          if (finished.length) {
            finished.sort(function (a, b) { return dateValue(b.questionDate || b.dateStatus || b.userStartDate) - dateValue(a.questionDate || a.dateStatus || a.userStartDate); });
            var last = finished[0];
            var lastOfFlow = false;
            var hasSuccessor = false;
            if (last) {
              var lastCyberId = state.lastCyberSurveyTypeIdInFlow || state.lastSurveyTypeIdInFlow;
              lastOfFlow = String(lastCyberId || '') === String(last.surveyTypeId || '');
            }
            if (last && state.surveyTypeHasSuccessor && state.surveyTypeHasSuccessor[String(last.surveyTypeId || '')]) {
              hasSuccessor = true;
            }

            if (lastOfFlow) {
              // Final de la rama — no reportar (check siempre activo)
            } else if (!hasSuccessor) {
              // No tiene sucesor configurado — problema real
              rows.noNext.push(Object.assign({}, base, {
                ultimaSesionCompletada: last.surveyName || '',
                surveyTypeId: last.surveyTypeId || '',
                fecha: last.questionDate || last.dateStatus || last.userStartDate || '',
                nota: 'Sin siguiente sesion en surveyFlow',
                requiereIT: 'Si'
              }));
            }
            // Si hasSuccessor: sesión programada a futuro — no reportar
          } else if (cyberRecords.length === 0 && flowRecords.length > 0) {
            // Tiene sesiones de flujo pero ninguna de cyber — no es problema de cyber
          } else {
            // Sin ninguna sesión de cyber completada ni pendiente
            rows.noNext.push(Object.assign({}, base, {
              ultimaSesionCompletada: '',
              surveyTypeId: '',
              fecha: '',
              nota: 'Sin sesiones de ciberconcienciacion en surveyFlow',
              requiereIT: 'Si'
            }));
          }
        }
      }
    }

    if (opts.checkWelcome) {
      var welcomes = all.filter(function (r) { return Number(r.surveyFamilyId) === opts.welcomeFamilyId || Number(r.surveyTypeId) === 29; });
      var hasFlowSession = flowRecords.length > 0;
      if (!welcomes.length) {
        rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: 'Sin welcome en absoluto' }));
      } else {
        var states = welcomes.map(function (w) { return w.surveyStatus; }).filter(Boolean).join(', ');
        var hasFinish = welcomes.some(function (w) { return w.surveyStatus === 'FINISH'; });
        if (hasFinish && !hasFlowSession && (state.surveyTypesInFlow.length || opts.includeOutsideSurveyFlow)) {
          rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: states || 'FINISH', nota: 'Welcome completada pero sin sesiones del surveyFlow' }));
        }
      }
    }

    return rows;
  }

  async function fetchInteractions(user) {
    var data = await apiGet('/controller/traits/' + encodeURIComponent(user.stakeholderId) + '/interactions?dummies=false');
    return Array.isArray(data.records) ? data.records : [];
  }

  function getSelectedOptions() {
    return {
      checkSurveyFlow: true,
      checkDuplicates: true,
      checkNoNext: true,
      checkWelcome: true,
      welcomeFamilyId: 11,
      useSurveyFlowLastException: true,
      includeOutsideSurveyFlow: false
    };
  }

  function setStatus(text, type) {
    var el = $('ksa-status');
    if (!el) return;
    var colors = {
      info: 'background:#eff6ff;border-color:#bfdbfe;color:#1e40af',
      ok: 'background:#f0fdf4;border-color:#bbf7d0;color:#166534',
      err: 'background:#fff5f5;border-color:#fed7d7;color:#c53030',
      warn: 'background:#fffbeb;border-color:#fde68a;color:#92400e'
    };
    el.style.cssText = 'display:block;padding:10px 12px;border:1px solid;border-radius:8px;font-size:12px;line-height:1.45;margin-bottom:12px;' + (colors[type] || colors.info);
    el.innerHTML = text;
  }

  function updateProgress(done, total) {
    var pct = total ? Math.round(done * 100 / total) : 0;
    $('ksa-progress').style.display = 'block';
    $('ksa-bar').style.width = pct + '%';
    $('ksa-progress-text').textContent = done + '/' + total + ' usuarios (' + pct + '%)';
  }

  function renderSummary() {
    var r = state.results;
    if (!r) return;
    var noNextProblem = r.noNext.filter(function (x) { return x.problema === 'Si'; }).length;
    var noNextOk = r.noNext.filter(function (x) { return x.problema === 'No'; }).length;
    var dupUsers = {};
    r.duplicates.forEach(function (x) { dupUsers[String(x.stakeholderId)] = true; });
    var dupIt = r.duplicates.filter(function (x) { return x.requiereIT === 'Si'; }).length;

    var html = '';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">';
    html += summaryCard('Usuarios analizados', r.totalUsers);
    html += summaryCard('Duplicados', Object.keys(dupUsers).length + ' usuarios / ' + r.duplicates.length + ' sesiones');
    html += summaryCard('Duplicados con accion IT', dupIt);
    html += summaryCard('Sin siguiente sesion', noNextProblem);
    html += summaryCard('No problema / no evaluable', noNextOk);
    html += summaryCard('Sin welcome', r.noWelcome.length);
    html += summaryCard('Sin ninguna sesion', r.noSessions.length);
    html += summaryCard('Errores', r.errors.length);
    html += '</div>';
    html += '<button id="ksa-download" style="width:100%;margin-top:12px;background:#1e293b;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer">Descargar Excel</button>';
    $('ksa-results').innerHTML = html;
    $('ksa-download').onclick = downloadExcel;
  }

  function summaryCard(title, value) {
    return '<div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:10px 12px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">' + esc(title) + '</div><div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:3px">' + esc(value) + '</div></div>';
  }

  async function runAnalysis() {
    if (state.running) return;
    state.running = true;
    state.cancelled = false;
    $('ksa-run').disabled = true;
    $('ksa-cancel').style.display = 'inline-block';
    $('ksa-results').innerHTML = '';

    var opts = getSelectedOptions();
    if (!opts.checkSurveyFlow) {
      setStatus('El analisis principal necesita surveyFlow. Activa "Analizar sesiones del surveyFlow" o usa el modo avanzado fuera del surveyFlow.', 'warn');
      state.running = false;
      $('ksa-run').disabled = false;
      $('ksa-run-all').disabled = false;
      $('ksa-cancel').style.display = 'none';
      return;
    }

    var results = {
      date: new Date().toISOString(),
      companyId: state.companyId,
      companyName: state.companyName,
      totalUsers: state.users.length,
      duplicates: [],
      noNext: [],
      noWelcome: [],
      noSessions: [],
      errors: []
    };

    setStatus('Analizando sesiones contra el surveyFlow real de la empresa...', 'info');
    updateProgress(0, state.users.length);

    var done = 0;
    for (var i = 0; i < state.users.length; i += BATCH_SIZE) {
      if (state.cancelled) break;
      var batch = state.users.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async function (user) {
        try {
          var records = await fetchInteractions(user);
          var partial = analyzeUser(user, records, opts);
          results.duplicates = results.duplicates.concat(partial.duplicates);
          results.noNext = results.noNext.concat(partial.noNext);
          results.noWelcome = results.noWelcome.concat(partial.noWelcome);
          results.noSessions = results.noSessions.concat(partial.noSessions);
        } catch (e) {
          results.errors.push(Object.assign({}, getUserDisplay(user), { error: e.message }));
        }
        done += 1;
        updateProgress(done, state.users.length);
      }));
      await sleep(SLEEP_MS);
    }

    state.results = results;
    state.running = false;
    $('ksa-run').disabled = false;
    $('ksa-cancel').style.display = 'none';
    setStatus(state.cancelled ? 'Analisis cancelado. Puedes descargar el resultado parcial.' : 'Analisis completado.', state.cancelled ? 'warn' : 'ok');
    renderSummary();
  }

  function ensureXlsx() {
    return new Promise(function (resolve, reject) {
      if (window.XLSX) return resolve();
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('No se pudo cargar SheetJS.')); };
      document.head.appendChild(s);
    });
  }

  function aoaToSheet(rows) { return window.XLSX.utils.aoa_to_sheet(rows); }
  function jsonToSheet(rows) { return window.XLSX.utils.json_to_sheet(rows.length ? rows : [{}]); }

  async function downloadExcel() {
    if (!state.results) return;
    await ensureXlsx();
    var r = state.results;
    var wb = window.XLSX.utils.book_new();
    var noNextProblem = r.noNext.filter(function (x) { return x.problema === 'Si'; }).length;

    window.XLSX.utils.book_append_sheet(wb, aoaToSheet([
      ['Campo', 'Valor'],
      ['Fecha analisis', r.date],
      ['Empresa', r.companyName],
      ['Company ID', r.companyId],
      ['Usuarios analizados', r.totalUsers],
      ['Politica', 'SurveyFlow principal'],
      ['Incluir fuera del surveyFlow', $('ksa-check-outside') && $('ksa-check-outside').checked ? 'Si' : 'No'],
      ['Sesiones duplicadas a eliminar', r.duplicates.length],
      ['Duplicados que requieren IT', r.duplicates.filter(function (x) { return x.requiereIT === 'Si'; }).length],
      ['Sin siguiente sesion problema', noNextProblem],
      ['Sin welcome', r.noWelcome.length],
      ['Sin ninguna sesion', r.noSessions.length],
      ['Errores', r.errors.length],
      ['SurveyFlow detectado', state.surveyFlow ? 'Si' : 'No'],
      ['SurveyTypeIds en surveyFlow', state.surveyTypesInFlow.map(function (x) { return x.surveyTypeId; }).join(', ')],
      ['Mapa estandar SurveyType usado', 'Si'],
      ['Ultima sesion surveyFlow', (state.lastSurveyNameInFlow || '') + ' (' + (state.lastSurveyTypeIdInFlow || '') + ')']
    ]), 'Resumen');

    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(r.duplicates), 'Sesiones Duplicadas');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(r.noNext), 'Sin Siguiente Sesion');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(r.noWelcome), 'Sin Welcome');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(r.noSessions), 'Sin Ninguna Sesion');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(r.errors), 'Errores');

    var fname = 'kymatio_session_analyzer_' + String(r.companyName || r.companyId).replace(/[^a-z0-9_-]+/gi, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    window.XLSX.writeFile(wb, fname);
  }

  function renderSurveyFlowInfo() {
    var el = $('ksa-surveyflow-info');
    if (!el) return;

    if (!state.surveyTypesInFlow.length) {
      el.innerHTML = '<div style="color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px">&#9888; No se ha podido cargar el surveyFlow.</div>';
      return;
    }

    var lastCyberName = '';
    var lastCyberId = state.lastCyberSurveyTypeIdInFlow;
    if (lastCyberId) {
      var lastCyberEntry = state.surveyTypesInFlow.find(function(s){ return s.surveyTypeId === lastCyberId; });
      lastCyberName = lastCyberEntry ? (lastCyberEntry.name || '') : '';
    }

    el.innerHTML =
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;color:#166534;font-size:12px;line-height:1.6">' +
      '&#10003; SurveyFlow cargado correctamente.' +
      (lastCyberId
        ? '<br><strong>Ultima sesion de ciberconcienciacion:</strong> ' + esc(lastCyberName || 'surveyTypeId ' + lastCyberId) + ' (' + esc(String(lastCyberId)) + ').'
        : '<br><span style="color:#92400e">No se ha detectado rama de ciberconcienciacion en el flujo.</span>') +
      '</div>';
  }

  async function prepareCompany() {
    detectCompany();
    $('ksa-company').textContent = state.companyName + ' · ID ' + (state.companyId || '?');
    $('ksa-run').disabled = true;
    $('ksa-results').innerHTML = '';
    state.results = null;
    state.users = [];
    state.surveyFlow = null;
    state.surveyTypesInFlow = [];
    state.surveyTypeSetInFlow = {};
    state.repeatableSurveyTypeSet = {};
    state.familiesInFlow = [];
    state.lastSurveyTypeIdInFlow = null;
    state.lastSurveyNameInFlow = '';
    state.lastCyberSurveyTypeIdInFlow = null;
    $('ksa-surveyflow-info').innerHTML = '<div style="color:#94a3b8">Cargando surveyFlow...</div>';

    try {
      setStatus('Cargando usuarios y surveyFlow...', 'info');
      await Promise.all([loadUsers(), loadSurveyFlow()]);
      renderSurveyFlowInfo();
      var sfMsg = state.surveyTypesInFlow.length ? 'SurveyFlow detectado con ' + state.surveyTypesInFlow.length + ' sesiones/tipos.' : 'No se pudo extraer surveyFlow util; el analisis principal quedara como no evaluable.';
      setStatus('Empresa preparada: ' + state.users.length + ' usuarios. ' + sfMsg + ' El analisis principal no se basara solo en surveyFamilyId.', state.surveyTypesInFlow.length ? 'ok' : 'warn');
      $('ksa-run').disabled = false;
      $('ksa-run-all').disabled = false;
    } catch (e) {
      renderSurveyFlowInfo();
      setStatus('Error inicial: ' + esc(e.message), 'err');
    }
  }

  async function refreshCompany() {
    if (state.running) {
      setStatus('No se puede actualizar compania mientras hay un analisis en curso.', 'warn');
      return;
    }
    await prepareCompany();
  }

  async function init() {
    await prepareCompany();
  }


  // ── Análisis de todas las empresas ───────────────────────────────────────────
  async function runAllCompanies() {
    if (state.running) return;

    // Modal de confirmación
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483648;display:flex;align-items:center;justify-content:center';
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:14px;padding:28px;max-width:420px;width:90%;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.3)';
    box.innerHTML =
      '<div style="font-size:16px;font-weight:800;color:#1a202c;margin-bottom:10px">&#127758; Analizar TODAS las empresas</div>' +
      '<div style="font-size:13px;color:#475569;line-height:1.6;margin-bottom:20px">' +
        'Se analizarán <strong>todas las empresas</strong> de la plataforma.<br><br>' +
        'Política aplicada:<br>' +
        '&#x2022; Sesiones duplicadas de cyber<br>' +
        '&#x2022; Usuarios sin siguiente sesión en la rama de cyber<br>' +
        '&#x2022; Usuarios sin welcome<br><br>' +
        '<strong>Se ignorarán</strong> las empresas sin surveyFlow o sin welcome detectado en el flujo.<br><br>' +
        'El proceso puede tardar varios minutos. El resultado se descargará como Excel.' +
      '</div>' +
      '<div style="display:flex;gap:10px">' +
        '<button id="ksa-all-cancel-modal" style="flex:1;padding:10px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>' +
        '<button id="ksa-all-confirm-modal" style="flex:1;padding:10px;background:#7c3aed;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">&#9654; Lanzar análisis</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('ksa-all-cancel-modal').onclick = function() { overlay.remove(); };
    document.getElementById('ksa-all-confirm-modal').onclick = async function() {
      overlay.remove();
      await doRunAllCompanies();
    };
  }

  async function doRunAllCompanies() {
    state.running = true;
    state.cancelled = false;
    $('ksa-run').disabled = true;
    $('ksa-run-all').disabled = true;
    $('ksa-cancel').style.display = 'inline-block';
    $('ksa-results').innerHTML = '';
    $('ksa-all-progress').style.display = 'block';
    $('ksa-all-progress-bar').style.width = '0%';
    setStatus('Cargando listado de empresas...', 'info');

    var opts = {
      checkSurveyFlow: true,
      checkDuplicates: true,
      checkNoNext: true,
      checkWelcome: true,
      welcomeFamilyId: 11,
      useSurveyFlowLastException: true,
      includeOutsideSurveyFlow: false
    };

    try {
      // 1. Obtener todas las empresas
      var companiesData = await apiGet('/admin/stakeholders/people/48207/companies');
      var allCompanies = companiesData.records || [];
      var total = allCompanies.length;
      setStatus('Empresas cargadas: ' + total + '. Iniciando análisis...', 'info');

      // Resultados globales
      var allResults = { duplicates: [], noNext: [], noWelcome: [], noSessions: [], errors: [], skipped: 0 };
      var companiesAnalyzed = 0;
      var usersAnalyzed = 0;
      var BATCH_SIZE = 20;
      var SLEEP_MS = 200;

      for (var ci = 0; ci < allCompanies.length; ci++) {
        if (state.cancelled) break;

        var company = allCompanies[ci];
        var cid = company.stakeholderId;
        var cname = company.name || ('Empresa ' + cid);

        // Actualizar progreso
        updateAllProgress(ci + 1, total, usersAnalyzed, cname);

        try {
          // 2. Cargar surveyFlow de la empresa — si no tiene welcome, saltar
          var compData = await apiGetForCompany(cid);
          var journey = compData.records && compData.records.journey || {};
          var sf = journey.surveyflow || journey.surveyFlow || null;

          if (!sf || !Array.isArray(sf)) { allResults.skipped++; continue; }

          // Verificar si tiene welcome en el surveyFlow
          var hasWelcome = sf.some(function(n) {
            return n.next && (n.next.toUpperCase() === 'KYMATIO_WELCOME');
          });
          if (!hasWelcome) { allResults.skipped++; continue; }

          // 3. Construir surveyTypesInFlow para esta empresa (reutilizar lógica existente)
          var companyState = buildCompanyState(sf);
          if (!companyState.surveyTypesInFlow.length) { allResults.skipped++; continue; }

          // 4. Cargar usuarios de la empresa
          var usersData = await apiGet('/admin/stakeholders/companies/' + encodeURIComponent(cid) + '/people?email=true&login=true');
          var users = (usersData.records || []).map(normalizeUser).filter(function(u){ return !!u.stakeholderId; });
          if (!users.length) { allResults.skipped++; continue; }

          // 5. Analizar usuarios en lotes
          for (var ui = 0; ui < users.length; ui += BATCH_SIZE) {
            if (state.cancelled) break;
            var batch = users.slice(ui, ui + BATCH_SIZE);
            await Promise.all(batch.map(async function(user) {
              try {
                var interactions = await fetchInteractions(user);
                var rows = analyzeUserWithState(user, interactions, opts, companyState, cname, cid);
                allResults.duplicates = allResults.duplicates.concat(rows.duplicates);
                allResults.noNext     = allResults.noNext.concat(rows.noNext);
                allResults.noWelcome  = allResults.noWelcome.concat(rows.noWelcome);
                allResults.noSessions = allResults.noSessions.concat(rows.noSessions);
                usersAnalyzed++;
              } catch(e) {
                allResults.errors.push({ companyId: cid, companyName: cname, stakeholderId: user.stakeholderId, email: user.email || '', error: e.message });
              }
            }));
            updateAllProgress(ci + 1, total, usersAnalyzed, cname);
            await sleep(SLEEP_MS);
          }

          companiesAnalyzed++;
        } catch(e) {
          allResults.errors.push({ companyId: cid, companyName: cname, stakeholderId: '', email: '', error: e.message });
        }
      }

      // 6. Generar Excel
      setStatus('Generando Excel...', 'info');
      await loadXlsx();
      exportAllCompaniesExcel(allResults, companiesAnalyzed, allCompanies.length, usersAnalyzed);
      setStatus(
        (state.cancelled ? 'Cancelado. ' : '') +
        'Análisis completado: ' + companiesAnalyzed + ' empresas, ' + usersAnalyzed + ' usuarios. ' +
        'Omitidas: ' + allResults.skipped + '.',
        state.cancelled ? 'warn' : 'ok'
      );

    } catch(e) {
      setStatus('Error: ' + esc(e.message), 'err');
    }

    state.running = false;
    $('ksa-run').disabled = false;
    $('ksa-run-all').disabled = false;
    $('ksa-cancel').style.display = 'none';
    $('ksa-all-progress').style.display = 'none';
  }

  function updateAllProgress(companiesDone, companiesTotal, usersDone, currentCompany) {
    var pct = Math.round(companiesDone / companiesTotal * 100);
    setStatus(
      '&#9654; Empresa ' + companiesDone + ' / ' + companiesTotal +
      ' (' + pct + '%) &mdash; ' + esc(currentCompany) +
      '<br>Usuarios analizados: ' + usersDone,
      'info'
    );
    // Barra de progreso en el DOM
    var bar = $('ksa-all-progress-bar');
    if (bar) bar.style.width = pct + '%';
  }

  async function apiGetForCompany(cid) {
    return apiGet('/admin/stakeholders/companies/' + encodeURIComponent(cid) + '?environment=true&journey=true&services=true');
  }

  function buildCompanyState(sf) {
    // Construye un estado mínimo de surveyFlow para una empresa
    var tempState = {
      surveyFlow: sf,
      surveyTypesInFlow: [],
      surveyTypeSetInFlow: {},
      repeatableSurveyTypeSet: {},
      surveyTypeHasSuccessor: {},
      familiesInFlow: [],
      lastSurveyTypeIdInFlow: null,
      lastCyberSurveyTypeIdInFlow: null
    };

    tempState.surveyTypesInFlow = collectSurveyTypes(sf);
    tempState.surveyTypesInFlow.forEach(function(s) {
      tempState.surveyTypeSetInFlow[String(s.surveyTypeId)] = true;
      if (s.repeatable) tempState.repeatableSurveyTypeSet[String(s.surveyTypeId)] = true;
      if (s.surveyFamilyId && tempState.familiesInFlow.indexOf(s.surveyFamilyId) < 0) {
        tempState.familiesInFlow.push(s.surveyFamilyId);
      }
    });

    // Sucesores
    sf.forEach(function(node) {
      var prev = node.previous;
      if (!prev || typeof prev !== 'string') return;
      var prevInfo = STANDARD_SURVEY_TYPE_MAP[prev.toUpperCase()];
      if (prevInfo && prevInfo.surveyTypeId) {
        if (prevInfo.surveyFamilyId === 8 || tempState.surveyTypeSetInFlow[String(prevInfo.surveyTypeId)]) {
          tempState.surveyTypeHasSuccessor[String(prevInfo.surveyTypeId)] = true;
        }
      }
    });

    // Última sesión
    if (tempState.surveyTypesInFlow.length) {
      var last = tempState.surveyTypesInFlow[tempState.surveyTypesInFlow.length - 1];
      tempState.lastSurveyTypeIdInFlow = last.surveyTypeId;
    }

    // Última cyber
    var cyberInFlow = tempState.surveyTypesInFlow.filter(function(s){ return s.surveyFamilyId === 8; });
    if (cyberInFlow.length) {
      var lastCyber = null;
      for (var ci = cyberInFlow.length - 1; ci >= 0; ci--) {
        if (!tempState.surveyTypeHasSuccessor[String(cyberInFlow[ci].surveyTypeId)]) {
          lastCyber = cyberInFlow[ci]; break;
        }
      }
      if (!lastCyber) lastCyber = cyberInFlow[cyberInFlow.length - 1];
      tempState.lastCyberSurveyTypeIdInFlow = lastCyber.surveyTypeId;
    }

    return tempState;
  }

  function analyzeUserWithState(user, records, opts, compState, companyName, companyId) {
    // Igual que analyzeUser pero usando compState en lugar del state global
    // y añadiendo companyName/companyId al resultado
    var savedState = {
      surveyTypesInFlow: state.surveyTypesInFlow,
      surveyTypeSetInFlow: state.surveyTypeSetInFlow,
      repeatableSurveyTypeSet: state.repeatableSurveyTypeSet,
      surveyTypeHasSuccessor: state.surveyTypeHasSuccessor,
      familiesInFlow: state.familiesInFlow,
      lastSurveyTypeIdInFlow: state.lastSurveyTypeIdInFlow,
      lastCyberSurveyTypeIdInFlow: state.lastCyberSurveyTypeIdInFlow
    };

    // Aplicar estado de la empresa
    state.surveyTypesInFlow = compState.surveyTypesInFlow;
    state.surveyTypeSetInFlow = compState.surveyTypeSetInFlow;
    state.repeatableSurveyTypeSet = compState.repeatableSurveyTypeSet;
    state.surveyTypeHasSuccessor = compState.surveyTypeHasSuccessor;
    state.familiesInFlow = compState.familiesInFlow;
    state.lastSurveyTypeIdInFlow = compState.lastSurveyTypeIdInFlow;
    state.lastCyberSurveyTypeIdInFlow = compState.lastCyberSurveyTypeIdInFlow;

    var rows = analyzeUser(user, records, opts);

    // Restaurar estado global
    state.surveyTypesInFlow = savedState.surveyTypesInFlow;
    state.surveyTypeSetInFlow = savedState.surveyTypeSetInFlow;
    state.repeatableSurveyTypeSet = savedState.repeatableSurveyTypeSet;
    state.surveyTypeHasSuccessor = savedState.surveyTypeHasSuccessor;
    state.familiesInFlow = savedState.familiesInFlow;
    state.lastSurveyTypeIdInFlow = savedState.lastSurveyTypeIdInFlow;
    state.lastCyberSurveyTypeIdInFlow = savedState.lastCyberSurveyTypeIdInFlow;

    // Añadir companyName y companyId a cada fila
    ['duplicates','noNext','noWelcome','noSessions'].forEach(function(key) {
      rows[key].forEach(function(row) {
        row.companyId = companyId;
        row.companyName = companyName;
      });
    });

    return rows;
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

  function exportAllCompaniesExcel(results, companiesAnalyzed, companiesTotal, usersAnalyzed) {
    var wb = window.XLSX.utils.book_new();

    // Resumen
    var summaryRows = [
      ['Campo', 'Valor'],
      ['Fecha análisis', new Date().toISOString()],
      ['Empresas analizadas', companiesAnalyzed],
      ['Empresas totales', companiesTotal],
      ['Empresas omitidas (sin SF/welcome)', companiesTotal - companiesAnalyzed - results.skipped],
      ['Usuarios analizados', usersAnalyzed],
      ['Sesiones duplicadas', results.duplicates.length],
      ['Sin siguiente sesión', results.noNext.length],
      ['Sin welcome', results.noWelcome.length],
      ['Sin ninguna sesión', results.noSessions.length],
      ['Errores', results.errors.length]
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(summaryRows), 'Resumen');

    // Función para añadir columnas de company al inicio
    function addCompanyCols(rows) {
      if (!rows.length) return rows;
      return rows.map(function(r) {
        return Object.assign({ companyId: r.companyId, companyName: r.companyName }, r);
      });
    }

    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(addCompanyCols(results.duplicates)), 'Sesiones Duplicadas');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(addCompanyCols(results.noNext)), 'Sin Siguiente Sesion');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(addCompanyCols(results.noWelcome)), 'Sin Welcome');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(addCompanyCols(results.noSessions)), 'Sin Ninguna Sesion');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(results.errors), 'Errores');

    var fname = 'kymatio_session_analyzer_TODAS_EMPRESAS_' + new Date().toISOString().slice(0,10) + '.xlsx';
    window.XLSX.writeFile(wb, fname);
  }

  function createPanel() {
    var old = $('kym-session-analyzer-panel');
    if (old) old.remove();

    var div = document.createElement('div');
    div.id = 'kym-session-analyzer-panel';
    div.style.cssText = 'position:fixed;top:0;right:0;width:560px;height:100vh;background:white;z-index:2147483647;box-shadow:-4px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#1a202c;font-size:13px';

    div.innerHTML =
      '<div style="background:#1e293b;color:white;padding:14px 18px;display:flex;align-items:center;justify-content:space-between">' +
        '<div><div style="font-weight:800;font-size:15px">Kymatio Session Analyzer</div><div style="font-size:10px;color:#cbd5e1">' + esc(VERSION) + '</div></div>' +
        '<button id="ksa-close" style="background:none;border:none;color:white;font-size:24px;line-height:1;cursor:pointer">&times;</button>' +
      '</div>' +
      '<div style="overflow:auto;flex:1;padding:16px 18px">' +
        '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:11px 13px;margin-bottom:12px">' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase">Empresa activa</div>' +
              '<div id="ksa-company" style="font-size:16px;font-weight:800;color:#166534;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Detectando...</div>' +
            '</div>' +
            '<button id="ksa-refresh-company" style="background:#166534;color:white;border:none;border-radius:7px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">Actualizar compania</button>' +
          '</div>' +
        '</div>' +
        '<div id="ksa-status"></div>' +
        
        '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px">' +
          '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:8px">SurveyFlow detectado</div>' +
          '<div id="ksa-surveyflow-info"><div style="color:#94a3b8">Cargando...</div></div>' +
        '</div>' +
        '<div id="ksa-progress" style="display:none;margin-bottom:12px">' +
          '<div style="height:9px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px"><div id="ksa-bar" style="height:100%;width:0%;background:#1e293b;border-radius:999px"></div></div>' +
          '<div id="ksa-progress-text" style="font-size:12px;color:#64748b">0/0</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px">' +
          '<button id="ksa-run" disabled style="flex:1;background:#1e293b;color:white;border:none;border-radius:8px;padding:10px;font-weight:800;cursor:pointer;opacity:.9">Lanzar analisis</button>' +
          '<button id="ksa-cancel" style="display:none;background:white;border:1px solid #e2e8f0;color:#475569;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">Cancelar</button>' +
        '</div>' +
        '<div style="border-top:2px solid #e2e8f0;margin:4px 0 12px"></div>' +
        '<button id="ksa-run-all" disabled style="width:100%;background:#7c3aed;color:white;border:none;border-radius:8px;padding:11px;font-weight:800;font-size:13px;cursor:pointer;margin-bottom:6px">&#127758; Analizar TODAS las empresas</button>' +
        '<div style="font-size:11px;color:#64748b;text-align:center;margin-bottom:12px">Pol\u00edtica: duplicados + sin siguiente sesi\u00f3n de cyber + sin welcome. Solo empresas con surveyFlow y welcome detectado.</div>' +
        '<div id="ksa-all-progress" style="display:none;margin-bottom:10px">' +'<div style="background:#e2e8f0;border-radius:999px;height:6px;overflow:hidden">' +'<div id="ksa-all-progress-bar" style="height:100%;background:#7c3aed;width:0%;transition:width .3s"></div>' +'</div></div>' +'<div id="ksa-results"></div>' +
      '</div>';

    document.body.appendChild(div);
    $('ksa-close').onclick = function () { div.remove(); };
    $('ksa-cancel').onclick = function () { state.cancelled = true; setStatus('Cancelando al terminar el lote actual...', 'warn'); };
    $('ksa-run').onclick = runAnalysis;
    $('ksa-refresh-company').onclick = refreshCompany;
    $('ksa-run-all').onclick = runAllCompanies;
    init();
  }

  createPanel();
})();
