(function () {
  'use strict';

  var VERSION = 'session-analyzer-40-decode-html';
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

  // Equivalencias entre surveyTypeIds con sufijo (_NO_GDPR) y sus versiones base
  // Si el surveyFlow usa el 114 pero las interacciones asignan el 12, son equivalentes
  // Equivalencias: IDs sufijados (_NO_GDPR) <-> IDs base
  // Ej: 114 (CYBERSECURITY001_NO_GDPR) <-> 12 (CYBERSECURITY001)
  var SURVEY_TYPE_EQUIVALENCES = {114:12,115:13,116:14,117:15,118:32,119:33,120:41,121:46};
  var SURVEY_TYPE_EQUIVALENCES_REVERSE = {12:114,13:115,14:116,15:117,32:118,33:119,41:120,46:121};

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

      // Fallback: si el código no está en el mapa, intentar quitando sufijos personalizados
      // como _NO_GDPR, _NO_COOKIES, _LIGHT, etc. (variantes de sesiones estándar)
      if (!info || !info.surveyTypeId) {
        // Quitar cualquier sufijo que empiece por _ y contenga letras (no números de secuencia)
        var fallback = code.replace(/_[A-Z][A-Z_]+$/, '');
        if (fallback !== code) {
          info = STANDARD_SURVEY_TYPE_MAP[fallback];
        }
      }

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
        var nextCode = x.next.toUpperCase();
        var sfInfo = STANDARD_SURVEY_TYPE_MAP[nextCode];
        // Fallback: quitar sufijos personalizados (_NO_GDPR, etc.)
        if (!sfInfo) {
          var fallbackCode = nextCode.replace(/_[A-Z][A-Z_]+$/, '');
          if (fallbackCode !== nextCode) sfInfo = STANDARD_SURVEY_TYPE_MAP[fallbackCode];
        }
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
    state.surveyTypeHasSuccessor = {};
    state.familiesInFlow = [];
    state.lastSurveyTypeIdInFlow = null;
    state.lastSurveyNameInFlow = '';
    state.lastCyberSurveyTypeIdInFlow = null;
    state.surveyFlowParseWarning = false;
    state.activeServices = {};

    try {
      var data = await apiGet('/admin/stakeholders/companies/' + encodeURIComponent(state.companyId) + '?environment=true&journey=true&services=true');
      var company = data.records || data;
      var journey = company && company.journey || {};

      // Guardar servicios activos (para verificar si Impacto está activado)
      var svcDist = (company.services && company.services.distribution) || {};
      var allSvcIds = (svcDist.USER || []).concat(svcDist.CONTROLLER || []).concat(svcDist.ADMIN || []);
      state.activeServices = {};
      allSvcIds.forEach(function(id){ state.activeServices[String(id)] = true; });
      var sf = journey.surveyflow || journey.surveyFlow || journey.flow || null;
      state.surveyFlow = sf;
      state.surveyTypesInFlow = collectSurveyTypes(sf || journey);
      state.surveyFlowParseWarning = !!(sf || journey) && !state.surveyTypesInFlow.length;

      state.surveyTypesInFlow.forEach(function (s) {
        state.surveyTypeSetInFlow[String(s.surveyTypeId)] = true;
        // Añadir equivalente: si el flujo tiene id sufijado (114), también aceptar el base (12)
        var equiv = SURVEY_TYPE_EQUIVALENCES[s.surveyTypeId];
        if (equiv) state.surveyTypeSetInFlow[String(equiv)] = true;
        var equivRev = SURVEY_TYPE_EQUIVALENCES_REVERSE[s.surveyTypeId];
        if (equivRev) state.surveyTypeSetInFlow[String(equivRev)] = true;
        if (s.repeatable) {
          state.repeatableSurveyTypeSet[String(s.surveyTypeId)] = true;
          if (equiv) state.repeatableSurveyTypeSet[String(equiv)] = true;
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
          // Fallback para códigos con sufijos personalizados
          if (!prevInfo) {
            var prevFallback = prevCode.replace(/_[A-Z][A-Z_]+$/, '');
            if (prevFallback !== prevCode) prevInfo = STANDARD_SURVEY_TYPE_MAP[prevFallback];
          }
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

  function isInSurveyFlow(record, sfState) {
    var s = sfState || state;
    return !!(record && s.surveyTypeSetInFlow[String(Number(record.surveyTypeId))]);
  }

  function isSystemSession(record, sfState) {
    return !!(record && SYSTEM_SURVEY_TYPE_IDS[Number(record.surveyTypeId)] && !isInSurveyFlow(record, sfState));
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

  // analyzeUser: acepta compState opcional (para barrido multi-empresa)
  // Si no se pasa, usa el state global
  function analyzeUser(user, records, opts, compState) {
    var sf = compState || state; // estado de surveyFlow a usar
    var base = getUserDisplay(user);
    var rows = { duplicates: [], noNext: [], noWelcome: [], noSessions: [] };
    var all = Array.isArray(records) ? records : [];

    if (!all.length) {
      rows.noSessions.push(Object.assign({}, base));
      rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: 'Sin welcome en absoluto' }));
      return rows;
    }

    // getFlowRecords usa state globalmente — adaptamos usando sf
    var flowRecords = all.filter(function(r) {
      return !!(r && sf.surveyTypeSetInFlow[String(Number(r.surveyTypeId))]);
    });
    if (opts.includeOutsideSurveyFlow) {
      all.forEach(function(r) {
        if (sf.surveyTypeSetInFlow[String(Number(r.surveyTypeId))]) return;
        if (isSystemSession(r, sf)) return;
        if (Number(r.surveyFamilyId) === opts.welcomeFamilyId) return;
        flowRecords.push(r);
      });
    }

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
        if (ALWAYS_REPEATABLE_IDS[k]) return;
        if (sf.repeatableSurveyTypeSet && sf.repeatableSurveyTypeSet[k]) return;
        chooseDuplicateActions(byType[k]).forEach(function (a) {
          rows.duplicates.push(Object.assign({}, base, {
            ambito: opts.includeOutsideSurveyFlow && !sf.surveyTypeSetInFlow[String(Number(a.remove.surveyTypeId))] ? 'Fuera surveyFlow' : 'SurveyFlow',
            sesion: decodeHtml(a.remove.surveyName || a.keep.surveyName) || '',
            surveyTypeId: a.remove.surveyTypeId || a.keep.surveyTypeId || '',
            surveyFamilyId: a.remove.surveyFamilyId || a.keep.surveyFamilyId || '',
            surveyEntityIdEliminar: a.remove.surveyEntityId || '',
            estadoEliminar: a.remove.surveyStatus || '',
            surveyEntityIdConservar: a.keep && a.keep.surveyEntityId || '',
            estadoConservar: a.keep && a.keep.surveyStatus || '',
          }));
        });
      });
    }

    if (opts.checkNoNext) {
      var hasSurveyFlow = sf.surveyTypesInFlow && sf.surveyTypesInFlow.length > 0;
      if (!hasSurveyFlow && !opts.includeOutsideSurveyFlow && !flowRecords.length) {
        // Sin surveyFlow y sin sesiones — no evaluable
      } else {
        var cyberRecords = flowRecords.filter(function(r){ return Number(r.surveyFamilyId) === 8; });
        var pending = cyberRecords.some(function(r){ return ['AVAILABLE','PROGRESS','UNAVAILABLE'].indexOf(r.surveyStatus) >= 0; });
        var finished = cyberRecords.filter(function(r){ return r.surveyStatus === 'FINISH'; });

        if (!pending) {
          if (finished.length) {
            finished.sort(function(a, b){ return dateValue(b.questionDate||b.dateStatus||b.userStartDate) - dateValue(a.questionDate||a.dateStatus||a.userStartDate); });
            var last = finished[0];
            var lastCyberId = sf.lastCyberSurveyTypeIdInFlow || sf.lastSurveyTypeIdInFlow;
            var lastOfFlow = String(lastCyberId || '') === String(last.surveyTypeId || '');
            if (lastOfFlow) {
              // Final de la rama de cyber — reportar con nota informativa (para filtrado)
              rows.noNext.push(Object.assign({}, base, {
                ultimaSesionCompletada: decodeHtml(last.surveyName) || '',
                surveyTypeId: last.surveyTypeId || '',
                fecha: last.questionDate || last.dateStatus || last.userStartDate || '',
                nota: 'Final de la rama de ciberconcienciacion'
              }));
            } else {
              // No es el final del flujo y no tiene cyber pendiente — reportar siempre
              // (el sucesor en el surveyFlow no garantiza que la sesión esté asignada al usuario)
              rows.noNext.push(Object.assign({}, base, {
                ultimaSesionCompletada: decodeHtml(last.surveyName) || '',
                surveyTypeId: last.surveyTypeId || '',
                fecha: last.questionDate || last.dateStatus || last.userStartDate || '',
                nota: 'Sin siguiente sesion en surveyFlow'
              }));
            }
          } else {
            // Sin cyber completada ni pendiente
            // Solo reportar si la welcome está FINISH — si no, el usuario aún está en onboarding
            var sfHasCyber = sf.familiesInFlow && sf.familiesInFlow.indexOf(8) >= 0;
            var welcomeDone = all.some(function(r){
              return (Number(r.surveyFamilyId) === opts.welcomeFamilyId || Number(r.surveyTypeId) === 29)
                     && r.surveyStatus === 'FINISH';
            });
            if ((sfHasCyber || flowRecords.length > 0) && welcomeDone) {
              // Buscar la última sesión completada de cualquier familia para mostrarla
              // Última sesión del surveyFlow completada (excluye phishing, smishing, etc.)
              var sfFinished = flowRecords.filter(function(r){ return r.surveyStatus === 'FINISH'; });
              sfFinished.sort(function(a,b){ return dateValue(b.questionDate||b.dateStatus||b.userStartDate) - dateValue(a.questionDate||a.dateStatus||a.userStartDate); });
              var lastSf = sfFinished[0];
              rows.noNext.push(Object.assign({}, base, {
                ultimaSesionCompletada: lastSf ? (decodeHtml(lastSf.surveyName) || '') : '',
                surveyTypeId: lastSf ? (lastSf.surveyTypeId || '') : '',
                fecha: lastSf ? (lastSf.questionDate || lastSf.dateStatus || lastSf.userStartDate || '') : '',
                nota: 'Welcome completada sin sesiones de ciberconcienciacion'
              }));
            }
          }
        }
      }
    }

    if (opts.checkWelcome) {
      var welcomes = all.filter(function(r){ return Number(r.surveyFamilyId) === opts.welcomeFamilyId || Number(r.surveyTypeId) === 29; });
      if (!welcomes.length) {
        rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: 'Sin welcome en absoluto' }));
      } else {
        var wStates = welcomes.map(function(w){ return w.surveyStatus; }).filter(Boolean).join(', ');
        var hasFinish = welcomes.some(function(w){ return w.surveyStatus === 'FINISH'; });
        var hasFlowSession = flowRecords.length > 0;
        if (hasFinish && !hasFlowSession && (sf.surveyTypesInFlow.length || opts.includeOutsideSurveyFlow)) {
          rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: wStates || 'FINISH', nota: 'Welcome completada pero sin sesiones del surveyFlow' }));
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
    var dupUsers = {};
    r.duplicates.forEach(function (x) { dupUsers[String(x.stakeholderId)] = true; });

    var html = '';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">';
    html += summaryCard('Usuarios analizados', r.totalUsers);
    html += summaryCard('Duplicados', Object.keys(dupUsers).length + ' usuarios / ' + r.duplicates.length + ' sesiones');
    html += summaryCard('Sin siguiente sesion', r.noNext.length);
    html += summaryCard('Con sucesor / fin de flujo', r.noNext.filter(function(x){ return x.nota && x.nota.indexOf('Sin siguiente') < 0 && x.nota.indexOf('ciberconcienciacion') < 0; }).length);
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
    window.XLSX.utils.book_append_sheet(wb, aoaToSheet([
      ['Campo', 'Valor'],
      ['Fecha analisis', r.date],
      ['Empresa', r.companyName],
      ['Company ID', r.companyId],
      ['Usuarios analizados', r.totalUsers],
      ['Politica', 'SurveyFlow principal'],
      ['Incluir fuera del surveyFlow', $('ksa-check-outside') && $('ksa-check-outside').checked ? 'Si' : 'No'],
      ['Sesiones duplicadas a eliminar', r.duplicates.length],

      ['Sin siguiente sesion', r.noNext.length],
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

    var hasImpactInFlow = companyHasImpactInFlow(state.surveyFlow);

    el.innerHTML =
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;color:#166534;font-size:12px;line-height:1.6">' +
      '&#10003; SurveyFlow cargado correctamente.' +
      (lastCyberId
        ? '<br><strong>Ultima sesion de ciberconcienciacion:</strong> ' + esc(lastCyberName || 'surveyTypeId ' + lastCyberId) + ' (' + esc(String(lastCyberId)) + ').'
        : '<br><span style="color:#92400e">No se ha detectado rama de ciberconcienciacion en el flujo.</span>') +
      '<br><strong>KYMATIO_IMPACT en el flujo:</strong> ' +
      (hasImpactInFlow
        ? '<span style="color:#166534">&#10003; Sí</span>'
        : '<span style="color:#92400e">&#10007; No</span>') +
      '<br><strong>Servicio Impacto (id 12) activo:</strong> ' +
      (state.activeServices && state.activeServices['12']
        ? '<span style="color:#166534">&#10003; Sí</span>'
        : '<span style="color:#92400e">&#10007; No — empresa será ignorada en análisis de impacto</span>') +
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

      // Modo muestreo
      // Solo aplicar muestreo si el toggle está ON
      var sampleToggle = document.getElementById('ksa-sample-toggle');
      var sampleActive = sampleToggle && sampleToggle.textContent === 'ON';
      var sampleLimit = sampleActive ? parseInt($('ksa-sample-limit') && $('ksa-sample-limit').value || '', 10) : NaN;
      var forcedCompanyIds = ($('ksa-sample-company') && $('ksa-sample-company').value || '')
        .split(',').map(function(s){ return parseInt(s.trim(), 10); }).filter(function(n){ return !isNaN(n) && n > 0; });
      var isSampleMode = !isNaN(sampleLimit) && sampleLimit > 0;

      if (isSampleMode) {
        var sampled = allCompanies.slice(0, sampleLimit);
        // Añadir todas las empresas forzadas si no están ya incluidas
        forcedCompanyIds.forEach(function(fcid) {
          var alreadyIn = sampled.some(function(c){ return c.stakeholderId === fcid; });
          if (!alreadyIn) {
            var forcedEntry = allCompanies.find(function(c){ return c.stakeholderId === fcid; });
            if (forcedEntry) sampled.push(forcedEntry);
          }
        });
        allCompanies = sampled;
      }

      // Filtro por nombre de empresa
      var exclNameWords = [];
      if ($('ksa-excl-name-demo') && $('ksa-excl-name-demo').checked) exclNameWords.push('demo');
      if ($('ksa-excl-name-test') && $('ksa-excl-name-test').checked) exclNameWords.push('test');
      if ($('ksa-excl-name-poc') && $('ksa-excl-name-poc').checked) exclNameWords.push('poc');

      // Tags a excluir (tipo de entidad)
      var exclTags = [];
      if ($('ksa-excl-tag-internal') && $('ksa-excl-tag-internal').checked) exclTags.push('internal');
      if ($('ksa-excl-tag-demo') && $('ksa-excl-tag-demo').checked) exclTags.push('demo');
      if ($('ksa-excl-tag-test') && $('ksa-excl-tag-test').checked) exclTags.push('test');
      if ($('ksa-excl-tag-poc') && $('ksa-excl-tag-poc').checked) exclTags.push('poc');

      if (exclNameWords.length) {
        var beforeFilter = allCompanies.length;
        allCompanies = allCompanies.filter(function(c) {
          var nameLower = (c.name || '').toLowerCase();
          // Permitir siempre empresas forzadas
          if (forcedCompanyIds.indexOf(c.stakeholderId) >= 0) return true;
          return !exclNameWords.some(function(w) { return nameLower.indexOf(w) >= 0; });
        });
        setStatus('Filtro por nombre: ' + (beforeFilter - allCompanies.length) + ' empresas excluidas.', 'info');
      }

      var total = allCompanies.length;
      setStatus((isSampleMode ? '[MUESTREO] ' : '') + 'Empresas a analizar: ' + total + '. Iniciando...', 'info');

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

          // Filtro por tag "tipo de entidad" — viene en los tags de company (ids 9 y 10)
          if (exclTags.length) {
            var compTags = compData.records && compData.records.tags || {};
            // Tags 9 y 10 son de empresa — buscar si tiene algún valor excluido
            var compTagValues = [];
            [9, 10].forEach(function(tid) {
              var vals = compTags[String(tid)];
              if (Array.isArray(vals)) vals.forEach(function(v){ compTagValues.push((v||'').toLowerCase()); });
            });
            var isExcluded = exclTags.some(function(et) {
              return compTagValues.some(function(tv){ return tv === et.toLowerCase(); });
            });
            if (isExcluded && forcedCompanyIds.indexOf(cid) < 0) { allResults.skipped++; continue; }
          }

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

          // Aplicar límite de usuarios solo si el toggle de muestreo está ON
          var userLimit = sampleActive ? parseInt($('ksa-sample-users') && $('ksa-sample-users').value || '', 10) : NaN;
          var isSampleUsers = !isNaN(userLimit) && userLimit > 0;

          if (isSampleUsers) {
            var sampledUsers = users.slice(0, userLimit);
            // Añadir usuarios forzados (lista separada por comas) si no están en la muestra
            var forcedUserIds = sampleActive ? ($('ksa-sample-user-id') && $('ksa-sample-user-id').value || '')
              .split(',').map(function(s){ return parseInt(s.trim(), 10); }).filter(function(n){ return !isNaN(n) && n > 0; }) : [];
            forcedUserIds.forEach(function(fuid) {
              var inSample = sampledUsers.some(function(u){ return u.stakeholderId === fuid; });
              if (!inSample) {
                var entry = users.find(function(u){ return u.stakeholderId === fuid; });
                if (entry) sampledUsers.push(entry);
              }
            });
            users = sampledUsers;
          }

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
    return apiGet('/admin/stakeholders/companies/' + encodeURIComponent(cid) + '?environment=true&journey=true&services=true&tags=true');
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
      var equiv = SURVEY_TYPE_EQUIVALENCES[s.surveyTypeId];
      if (equiv) tempState.surveyTypeSetInFlow[String(equiv)] = true;
      var equivRev = SURVEY_TYPE_EQUIVALENCES_REVERSE[s.surveyTypeId];
      if (equivRev) tempState.surveyTypeSetInFlow[String(equivRev)] = true;
      if (s.repeatable) {
        tempState.repeatableSurveyTypeSet[String(s.surveyTypeId)] = true;
        if (equiv) tempState.repeatableSurveyTypeSet[String(equiv)] = true;
      }
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
    var rows = analyzeUser(user, records, opts, compState);
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


  // ── Análisis de Impacto ───────────────────────────────────────────────────
  // surveyTypeIds de KYMATIO_IMPACT
  var IMPACT_SURVEY_TYPE_IDS = { '60': 1, '63': 1 }; // KYMATIO_IMPACT, KYMATIO_IMPACT_REFRESH

  function companyHasImpactInFlow(sf) {
    if (!Array.isArray(sf)) return false;
    return sf.some(function(node) {
      var next = (node.next || '').toUpperCase();
      return next === 'KYMATIO_IMPACT' || next === 'KYMATIO_IMPACT_REFRESH';
    });
  }

  function analyzeUserImpact(user, records) {
    var all = Array.isArray(records) ? records : [];

    // Solo reportar si welcome está FINISH — si no, el usuario aún está en onboarding
    var welcomeDone = all.some(function(r) {
      return (Number(r.surveyFamilyId) === 11 || Number(r.surveyTypeId) === 29)
             && r.surveyStatus === 'FINISH';
    });
    if (!welcomeDone) return null; // Welcome no completada — ignorar

    var hasImpact = all.some(function(r) {
      return IMPACT_SURVEY_TYPE_IDS[String(r.surveyTypeId)];
    });
    if (!hasImpact) {
      var base = getUserDisplay(user);
      return Object.assign({}, base, { nota: 'Sin sesion de impacto asignada' });
    }
    return null;
  }

  async function runImpactAnalysis() {
    if (state.running) return;
    if (!state.companyId) { setStatus('No hay empresa seleccionada.', 'err'); return; }
    // Comprobar servicio de Impacto activo (id 12) — solo avisar, no bloquear en 1 empresa
    if (state.activeServices && !state.activeServices['12']) {
      setStatus('\u26a0 El servicio de Impacto (id 12) no está activo en esta empresa. Se analiza igualmente.', 'warn');
    }

    state.running = true;
    state.cancelled = false;
    $('ksa-run-impact').disabled = true;
    $('ksa-cancel').style.display = 'inline-block';
    $('ksa-results').innerHTML = '';
    setStatus('Analizando impacto para ' + state.users.length + ' usuarios...', 'info');

    var noImpact = [];
    var errors = [];
    var done = 0;
    var BATCH = 20;

    for (var i = 0; i < state.users.length; i += BATCH) {
      if (state.cancelled) break;
      var batch = state.users.slice(i, i + BATCH);
      await Promise.all(batch.map(async function(user) {
        try {
          var records = await fetchInteractions(user);
          var row = analyzeUserImpact(user, records);
          if (row) noImpact.push(row);
        } catch(e) {
          errors.push(Object.assign({}, getUserDisplay(user), { error: e.message }));
        }
        done++;
        updateProgress(done, state.users.length);
      }));
      await sleep(SLEEP_MS);
    }

    state.running = false;
    $('ksa-run-impact').disabled = false;
    $('ksa-cancel').style.display = 'none';
    setStatus(
      (state.cancelled ? 'Cancelado. ' : 'Completado. ') +
      'Sin impacto: ' + noImpact.length + ' usuarios. Errores: ' + errors.length,
      state.cancelled ? 'warn' : 'ok'
    );

    renderImpactSummary(noImpact, errors);
  }

  async function runImpactAllCompanies() {
    if (state.running) return;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483648;display:flex;align-items:center;justify-content:center';
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:14px;padding:28px;max-width:420px;width:90%;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.3)';
    box.innerHTML =
      '<div style="font-size:16px;font-weight:800;color:#c2410c;margin-bottom:10px">\u{1F504} Análisis de Impacto — Todas las empresas</div>' +
      '<div style="font-size:13px;color:#475569;line-height:1.6;margin-bottom:20px">' +
        'Se buscarán empresas con <strong>KYMATIO_IMPACT</strong> en su surveyFlow.<br><br>' +
        'Para cada empresa, se identificarán los usuarios <strong>sin ninguna sesión de impacto</strong> asignada (en cualquier estado).' +
      '</div>' +
      '<div style="display:flex;gap:10px">' +
        '<button id="ksa-impact-all-cancel" style="flex:1;padding:10px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>' +
        '<button id="ksa-impact-all-confirm" style="flex:1;padding:10px;background:#ea580c;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Lanzar</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('ksa-impact-all-cancel').onclick = function() { overlay.remove(); };
    document.getElementById('ksa-impact-all-confirm').onclick = async function() {
      overlay.remove();
      await doRunImpactAllCompanies();
    };
  }

  async function doRunImpactAllCompanies() {
    state.running = true;
    state.cancelled = false;
    $('ksa-run-impact-all').disabled = true;
    $('ksa-cancel').style.display = 'inline-block';
    $('ksa-results').innerHTML = '';
    $('ksa-all-progress').style.display = 'block';
    $('ksa-all-progress-bar').style.width = '0%';
    setStatus('Cargando empresas...', 'info');

    try {
      var companiesData = await apiGet('/admin/stakeholders/people/48207/companies');
      var allCompanies = companiesData.records || [];

      // Aplicar filtros de exclusión (mismos que sesiones)
      var exclNameWords = [];
      if ($('ksa-excl-name-demo') && $('ksa-excl-name-demo').checked) exclNameWords.push('demo');
      if ($('ksa-excl-name-test') && $('ksa-excl-name-test').checked) exclNameWords.push('test');
      if ($('ksa-excl-name-poc') && $('ksa-excl-name-poc').checked) exclNameWords.push('poc');
      var exclTags = [];
      if ($('ksa-excl-tag-internal') && $('ksa-excl-tag-internal').checked) exclTags.push('internal');
      if ($('ksa-excl-tag-demo') && $('ksa-excl-tag-demo').checked) exclTags.push('demo');
      if ($('ksa-excl-tag-test') && $('ksa-excl-tag-test').checked) exclTags.push('test');
      if ($('ksa-excl-tag-poc') && $('ksa-excl-tag-poc').checked) exclTags.push('poc');

      if (exclNameWords.length) {
        allCompanies = allCompanies.filter(function(c) {
          var n = (c.name||'').toLowerCase();
          return !exclNameWords.some(function(w){ return n.indexOf(w) >= 0; });
        });
      }

      // Modo muestreo
      var sampleToggle = document.getElementById('ksa-sample-toggle');
      var sampleActive = sampleToggle && sampleToggle.textContent === 'ON';
      var sampleLimit = sampleActive ? parseInt($('ksa-sample-limit') && $('ksa-sample-limit').value || '', 10) : NaN;
      var forcedCompanyIds = sampleActive ? ($('ksa-sample-company') && $('ksa-sample-company').value || '')
        .split(',').map(function(s){ return parseInt(s.trim(), 10); }).filter(function(n){ return !isNaN(n) && n > 0; }) : [];
      var isSampleMode = !isNaN(sampleLimit) && sampleLimit > 0;
      if (isSampleMode) {
        var sampled = allCompanies.slice(0, sampleLimit);
        forcedCompanyIds.forEach(function(fcid) {
          if (!sampled.some(function(c){ return c.stakeholderId === fcid; })) {
            var e = allCompanies.find(function(c){ return c.stakeholderId === fcid; });
            if (e) sampled.push(e);
          }
        });
        allCompanies = sampled;
      }

      var total = allCompanies.length;
      var allNoImpact = [];
      var allErrors = [];
      var companiesAnalyzed = 0;
      var usersAnalyzed = 0;
      var skipped = 0;
      var BATCH = 20;

      for (var ci = 0; ci < allCompanies.length; ci++) {
        if (state.cancelled) break;
        var company = allCompanies[ci];
        var cid = company.stakeholderId;
        updateAllProgress(ci + 1, total, usersAnalyzed, company.name || cid);

        try {
          var compData = await apiGetForCompany(cid);
          var sf = compData.records && compData.records.journey && (compData.records.journey.surveyflow || compData.records.journey.surveyFlow);

          // Filtro por tags
          if (exclTags.length) {
            var compTags = compData.records && compData.records.tags || {};
            var tagVals = [];
            [9,10].forEach(function(tid){ var v=compTags[String(tid)]; if(Array.isArray(v)) v.forEach(function(x){ tagVals.push((x||'').toLowerCase()); }); });
            if (exclTags.some(function(et){ return tagVals.some(function(tv){ return tv===et.toLowerCase(); }); }) && forcedCompanyIds.indexOf(cid)<0) { skipped++; continue; }
          }

          // Solo empresas con servicio Impacto (id 12) activo Y KYMATIO_IMPACT en el surveyFlow
          var compSvcDist = (compData.records && compData.records.services && compData.records.services.distribution) || {};
          var compAllSvcs = (compSvcDist.USER||[]).concat(compSvcDist.CONTROLLER||[]).concat(compSvcDist.ADMIN||[]);
          var hasImpactService = compAllSvcs.indexOf(12) >= 0;
          if (!hasImpactService) { skipped++; continue; }
          if (!companyHasImpactInFlow(sf)) { skipped++; continue; }

          var usersData = await apiGet('/admin/stakeholders/companies/' + encodeURIComponent(cid) + '/people?email=true&login=true');
          var users = (usersData.records || []).map(normalizeUser).filter(function(u){ return !!u.stakeholderId; });
          if (!users.length) { skipped++; continue; }

          // Límite de usuarios en modo muestreo
          var userLimit = sampleActive ? parseInt($('ksa-sample-users') && $('ksa-sample-users').value || '', 10) : NaN;
          var isSampleUsers = !isNaN(userLimit) && userLimit > 0;
          if (isSampleUsers) {
            var sampledU = users.slice(0, userLimit);
            var forcedUIds = sampleActive ? ($('ksa-sample-user-id') && $('ksa-sample-user-id').value || '')
              .split(',').map(function(s){ return parseInt(s.trim(),10); }).filter(function(n){ return !isNaN(n)&&n>0; }) : [];
            forcedUIds.forEach(function(fuid){ if(!sampledU.some(function(u){ return u.stakeholderId===fuid; })){ var e=users.find(function(u){ return u.stakeholderId===fuid; }); if(e) sampledU.push(e); } });
            users = sampledU;
          }

          for (var ui = 0; ui < users.length; ui += BATCH) {
            if (state.cancelled) break;
            var batch = users.slice(ui, ui + BATCH);
            await Promise.all(batch.map(async function(user) {
              try {
                var records = await fetchInteractions(user);
                var row = analyzeUserImpact(user, records);
                if (row) {
                  row.companyId = cid;
                  row.companyName = company.name || '';
                  allNoImpact.push(row);
                }
              } catch(e) {
                allErrors.push({ companyId: cid, companyName: company.name||'', stakeholderId: user.stakeholderId, email: user.email||'', error: e.message });
              }
              usersAnalyzed++;
            }));
            updateAllProgress(ci + 1, total, usersAnalyzed, company.name || cid);
            await sleep(SLEEP_MS);
          }
          companiesAnalyzed++;
        } catch(e) {
          allErrors.push({ companyId: cid, companyName: company.name||'', stakeholderId:'', email:'', error: e.message });
        }
      }

      // Exportar Excel
      await loadXlsx();
      exportImpactExcel(allNoImpact, allErrors, companiesAnalyzed, total, usersAnalyzed);
      setStatus(
        (state.cancelled ? 'Cancelado. ' : '') +
        'Impacto: ' + companiesAnalyzed + ' empresas, ' + usersAnalyzed + ' usuarios. Sin impacto: ' + allNoImpact.length + '. Omitidas: ' + skipped,
        state.cancelled ? 'warn' : 'ok'
      );
    } catch(e) {
      setStatus('Error: ' + esc(e.message), 'err');
    }

    state.running = false;
    $('ksa-run-impact-all').disabled = false;
    $('ksa-cancel').style.display = 'none';
    $('ksa-all-progress').style.display = 'none';
  }

  function renderImpactSummary(noImpact, errors) {
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">';
    html += summaryCard('Usuarios analizados', state.users.length);
    html += summaryCard('Sin sesion de impacto', noImpact.length);
    html += summaryCard('Errores', errors.length);
    html += '</div>';
    html += '<button id="ksa-download-impact" style="width:100%;margin-top:12px;background:#ea580c;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer">Descargar Excel</button>';
    $('ksa-results').innerHTML = html;
    $('ksa-download-impact').onclick = function() {
      ensureXlsx().then(function() {
        exportImpactExcel(noImpact, errors, 1, 1, state.users.length);
      });
    };
  }

  function exportImpactExcel(noImpact, errors, companiesAnalyzed, companiesTotal, usersAnalyzed) {
    var wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, aoaToSheet([
      ['Campo', 'Valor'],
      ['Fecha análisis', new Date().toISOString()],
      ['Empresas analizadas', companiesAnalyzed],
      ['Empresas totales revisadas', companiesTotal],
      ['Usuarios analizados', usersAnalyzed],
      ['Sin sesión de impacto', noImpact.length],
      ['Errores', errors.length]
    ]), 'Resumen');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(noImpact), 'Sin Impacto');
    window.XLSX.utils.book_append_sheet(wb, jsonToSheet(errors), 'Errores');
    var fname = 'kymatio_impacto_' + new Date().toISOString().slice(0,10) + '.xlsx';
    window.XLSX.writeFile(wb, fname);
  }

  function createPanel() {
    var old = $('kym-session-analyzer-panel');
    if (old) old.remove();

    var div = document.createElement('div');
    div.id = 'kym-session-analyzer-panel';
    div.style.cssText = 'position:fixed;top:0;right:0;width:560px;height:100vh;background:white;z-index:2147483647;box-shadow:-4px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#1a202c;font-size:13px';

    div.innerHTML =
      // ── Header ──────────────────────────────────────────────────────────────
      '<div style="background:#1e293b;color:white;padding:14px 18px;display:flex;align-items:center;justify-content:space-between">' +
        '<div><div style="font-weight:800;font-size:15px">Kymatio Session Analyzer</div><div style="font-size:10px;color:#cbd5e1">' + esc(VERSION) + '</div></div>' +
        '<button id="ksa-close" style="background:none;border:none;color:white;font-size:24px;line-height:1;cursor:pointer">&times;</button>' +
      '</div>' +

      // ── Contenido principal ─────────────────────────────────────────────────
      '<div style="overflow:auto;flex:1;padding:16px 18px">' +

        // Selector de modo de análisis
        '<div style="display:flex;gap:6px;margin-bottom:12px">' +
          '<button id="ksa-mode-sessions" style="flex:1;padding:9px;border:none;border-radius:8px;background:#1e293b;color:white;font-weight:700;font-size:12px;cursor:pointer">Sesiones</button>' +
          '<button id="ksa-mode-impact" style="flex:1;padding:9px;border:none;border-radius:8px;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;font-weight:600;font-size:12px;cursor:pointer">&#128260; Impacto</button>' +
        '</div>' +

        // Selector de scope (1 empresa / todas) — compartido por ambos modos
        '<div id="ksa-scope-tabs" style="display:flex;gap:0;margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">' +
          '<button id="ksa-tab-one" style="flex:1;padding:10px;border:none;background:#1e293b;color:white;font-weight:700;font-size:13px;cursor:pointer">1 empresa</button>' +
          '<button id="ksa-tab-all" style="flex:1;padding:10px;border:none;background:#f8fafc;color:#64748b;font-weight:600;font-size:13px;cursor:pointer">&#127758; Todas las empresas</button>' +
        '</div>' +

        '<div id="ksa-status"></div>' +

        // ── Panel: 1 empresa ──────────────────────────────────────────────────
        '<div id="ksa-panel-one">' +
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:11px 13px;margin-bottom:12px">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase">Empresa activa</div>' +
                '<div id="ksa-company" style="font-size:16px;font-weight:800;color:#166534;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Detectando...</div>' +
              '</div>' +
              '<button id="ksa-refresh-company" style="background:#166534;color:white;border:none;border-radius:7px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">Actualizar compania</button>' +
            '</div>' +
          '</div>' +
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
        '</div>' +

        // Botones de impacto — fuera de los paneles, visibles según modo+scope
        '<div style="margin-bottom:10px">' +
          '<button id="ksa-run-impact" style="display:none;width:100%;background:#ea580c;color:white;border:none;border-radius:8px;padding:11px;font-weight:800;font-size:13px;cursor:pointer">&#128260; Analizar impacto (1 empresa)</button>' +
          '<button id="ksa-run-impact-all" style="display:none;width:100%;background:#ea580c;color:white;border:none;border-radius:8px;padding:11px;font-weight:800;font-size:13px;cursor:pointer">&#128260; Analizar impacto (todas las empresas)</button>' +
        '</div>' +

        // ── Panel: Todas las empresas ─────────────────────────────────────────
        '<div id="ksa-panel-all" style="display:none">' +
          '<div style="background:#f3f0ff;border:1px solid #c4b5fd;border-radius:10px;padding:14px;margin-bottom:14px;font-size:12px;color:#5b21b6;line-height:1.6">' +
            '<div style="font-size:13px;font-weight:800;color:#5b21b6;margin-bottom:8px">&#127758; An&#225;lisis de todas las empresas</div>' +
            '<strong>Pol&#237;tica aplicada:</strong><br>' +
            '&#x2022; Sesiones duplicadas de ciberconcienciaci&#243;n<br>' +
            '&#x2022; Usuarios sin siguiente sesi&#243;n en la rama de cyber<br>' +
            '&#x2022; Usuarios sin welcome<br><br>' +
            '<strong>Se ignoran</strong> empresas sin surveyFlow o sin KYMATIO_WELCOME en el flujo.' +
          '</div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:14px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
              '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase">Filtros de exclusi&#243;n</div>' +
            '</div>' +
            '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:5px">Excluir por nombre de empresa:</div>' +
            '<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap">' +
              '<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#475569;cursor:pointer">' +
                '<input type="checkbox" id="ksa-excl-name-demo" checked style="cursor:pointer"> DEMO' +
              '</label>' +
              '<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#475569;cursor:pointer">' +
                '<input type="checkbox" id="ksa-excl-name-test" checked style="cursor:pointer"> TEST' +
              '</label>' +
              '<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#475569;cursor:pointer">' +
                '<input type="checkbox" id="ksa-excl-name-poc" checked style="cursor:pointer"> POC' +
              '</label>' +
            '</div>' +
            '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:5px">Excluir por tag \"tipo de entidad\":</div>' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
              '<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#475569;cursor:pointer">' +
                '<input type="checkbox" id="ksa-excl-tag-internal" checked style="cursor:pointer"> internal' +
              '</label>' +
              '<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#475569;cursor:pointer">' +
                '<input type="checkbox" id="ksa-excl-tag-demo" checked style="cursor:pointer"> Demo' +
              '</label>' +
              '<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#475569;cursor:pointer">' +
                '<input type="checkbox" id="ksa-excl-tag-test" checked style="cursor:pointer"> Test' +
              '</label>' +
              '<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#475569;cursor:pointer">' +
                '<input type="checkbox" id="ksa-excl-tag-poc" checked style="cursor:pointer"> PoC' +
              '</label>' +
            '</div>' +
          '</div>' +

          '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:14px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;cursor:pointer" onclick="var b=document.getElementById(\'ksa-sample-body\');var on=document.getElementById(\'ksa-sample-toggle\');var active=b.style.display!==\'none\';b.style.display=active?\'none\':\'block\';on.textContent=active?\'OFF\':\'ON\';on.style.background=active?\'#94a3b8\':\'#f59e0b\';">' +
              '<span style="font-size:11px;font-weight:800;color:#92400e">MODO MUESTREO</span>' +
              '<span id="ksa-sample-toggle" style="background:#94a3b8;color:white;font-size:10px;font-weight:800;padding:3px 10px;border-radius:999px;min-width:32px;text-align:center">OFF</span>' +
            '</div>' +
            '<div id="ksa-sample-body" style="display:none;padding:0 12px 12px;border-top:1px solid #fde68a">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
              '<div>' +
                '<label style="font-size:11px;color:#78350f;display:block;margin-bottom:3px">Max. empresas</label>' +
                '<input id="ksa-sample-limit" type="number" min="1" max="497" value="10" style="width:100%;padding:6px 8px;border:1px solid #fde68a;border-radius:6px;font-size:12px;box-sizing:border-box">' +
              '</div>' +
              '<div>' +
                '<label style="font-size:11px;color:#78350f;display:block;margin-bottom:3px">Max. usuarios/empresa</label>' +
                '<input id="ksa-sample-users" type="number" min="1" value="20" style="width:100%;padding:6px 8px;border:1px solid #fde68a;border-radius:6px;font-size:12px;box-sizing:border-box">' +
              '</div>' +
              '<div>' +
                '<label style="font-size:11px;color:#78350f;display:block;margin-bottom:3px">Forzar empresa ID</label>' +
                '<input id="ksa-sample-company" type="text" value="335809,75404" placeholder="ej: 335809,75404" style="width:100%;padding:6px 8px;border:1px solid #fde68a;border-radius:6px;font-size:12px;box-sizing:border-box">' +
              '</div>' +
              '<div>' +
                '<label style="font-size:11px;color:#78350f;display:block;margin-bottom:3px">Forzar usuario ID</label>' +
                '<input id="ksa-sample-user-id" type="text" value="350863,388613,388632,94497,95210" style="width:100%;padding:6px 8px;border:1px solid #fde68a;border-radius:6px;font-size:12px;box-sizing:border-box">' +
              '</div>' +
            '</div>' +
            '</div>' +
          '</div>' +
          '<div id="ksa-all-progress" style="display:none;margin-bottom:10px">' +
            '<div style="background:#e2e8f0;border-radius:999px;height:6px;overflow:hidden">' +
              '<div id="ksa-all-progress-bar" style="height:100%;background:#7c3aed;width:0%;transition:width .3s"></div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-bottom:10px">' +
            '<button id="ksa-run-all" style="flex:1;background:#7c3aed;color:white;border:none;border-radius:8px;padding:11px;font-weight:800;font-size:13px;cursor:pointer">&#9654; Lanzar an&#225;lisis</button>' +
            '<button id="ksa-cancel" style="display:none;background:white;border:1px solid #e2e8f0;color:#475569;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">Cancelar</button>' +
          '</div>' +
        '</div>' +

        '<div id="ksa-panel-impact" style="display:none">' +'<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin-bottom:14px;font-size:12px;color:#c2410c;line-height:1.6">' +'<div style="font-size:13px;font-weight:800;color:#c2410c;margin-bottom:8px">&#128260; Análisis de Impacto</div>' +'<strong>Lógica:</strong><br>' +'&#x2022; Comprueba si el surveyFlow tiene sesiones de KYMATIO_IMPACT<br>' +'&#x2022; Si no hay KYMATIO_IMPACT en el flujo, la empresa se ignora<br>' +'&#x2022; Si hay KYMATIO_IMPACT, detecta usuarios sin ninguna sesión de impacto (en cualquier estado)' +'</div>' +'</div>' +'<div id="ksa-results"></div>' +
      '</div>';

    document.body.appendChild(div);
    $('ksa-close').onclick = function () { div.remove(); };
    $('ksa-cancel').onclick = function () { state.cancelled = true; setStatus('Cancelando al terminar el lote actual...', 'warn'); };
    $('ksa-run').onclick = runAnalysis;
    $('ksa-refresh-company').onclick = refreshCompany;
    $('ksa-run-impact').onclick = runImpactAnalysis;
    $('ksa-run-impact-all').onclick = runImpactAllCompanies;
    $('ksa-run-all').onclick = runAllCompanies;

    // Lógica de pestañas
    var currentMode = 'sessions'; // 'sessions' | 'impact'
    var currentScope = 'one'; // 'one' | 'all'

    function updateScopeUI() {
      var isOne = currentScope === 'one';
      $('ksa-tab-one').style.background = isOne ? '#1e293b' : '#f8fafc';
      $('ksa-tab-one').style.color = isOne ? 'white' : '#64748b';
      $('ksa-tab-all').style.background = isOne ? '#f8fafc' : '#7c3aed';
      $('ksa-tab-all').style.color = isOne ? '#64748b' : 'white';
      $('ksa-panel-one').style.display = isOne ? 'block' : 'none';
      $('ksa-panel-all').style.display = isOne ? 'none' : 'block';
      // El panel de impacto se superpone al panel de scope
      var isImpact = currentMode === 'impact';
      $('ksa-panel-impact').style.display = isImpact ? 'block' : 'none';
      $('ksa-scope-tabs').style.display = 'flex';
      // Botones de acción según modo
      if ($('ksa-run')) $('ksa-run').style.display = (!isImpact && isOne) ? 'block' : 'none';
      if ($('ksa-run-all')) $('ksa-run-all').style.display = (!isImpact && !isOne) ? 'block' : 'none';
      if ($('ksa-run-impact')) $('ksa-run-impact').style.display = (isImpact && isOne) ? 'block' : 'none';
      if ($('ksa-run-impact-all')) $('ksa-run-impact-all').style.display = (isImpact && !isOne) ? 'block' : 'none';
    }

    $('ksa-mode-sessions').onclick = function() {
      currentMode = 'sessions';
      $('ksa-mode-sessions').style.background = '#1e293b'; $('ksa-mode-sessions').style.color = 'white';
      $('ksa-mode-impact').style.background = '#f8fafc'; $('ksa-mode-impact').style.color = '#64748b';
      $('ksa-panel-one').style.display = currentScope === 'one' ? 'block' : 'none';
      $('ksa-panel-all').style.display = currentScope === 'all' ? 'block' : 'none';
      $('ksa-panel-impact').style.display = 'none';
      updateScopeUI();
    };
    $('ksa-mode-impact').onclick = function() {
      currentMode = 'impact';
      $('ksa-mode-impact').style.background = '#ea580c'; $('ksa-mode-impact').style.color = 'white';
      $('ksa-mode-sessions').style.background = '#f8fafc'; $('ksa-mode-sessions').style.color = '#64748b';
      $('ksa-panel-one').style.display = 'none';
      $('ksa-panel-all').style.display = 'none';
      $('ksa-panel-impact').style.display = 'block';
      updateScopeUI();
    };

    $('ksa-tab-one').onclick = function() {
      currentScope = 'one';
      updateScopeUI();
    };
    $('ksa-tab-all').onclick = function() {
      currentScope = 'all';
      updateScopeUI();
    };

    // Estado inicial
    updateScopeUI();
    init();
  }

  createPanel();
})();
