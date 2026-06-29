(function () {
  'use strict';

  var VERSION = 'session-analyzer-03-surveyflow-driven';
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

  function pushSurveyType(out, seen, x) {
    var typeId = Number(x.surveyTypeId || x.typeId || x.campaignTypeId || 0);
    if (!typeId) return;
    var familyId = Number(x.surveyFamilyId || x.familyId || x.surveyFamily || 0);
    var name = x.surveyName || x.name || x.title || x.label || x.campaignType || x.campaignTypeName || '';
    var key = String(typeId);
    if (seen[key]) return;
    seen[key] = true;
    out.push({ surveyTypeId: typeId, surveyFamilyId: familyId || null, name: decodeHtml(name || '') });
  }

  function collectSurveyTypes(obj) {
    var out = [];
    var seenType = {};
    var seenNode = [];

    function walk(x) {
      if (!x || typeof x !== 'object') return;
      if (seenNode.indexOf(x) >= 0) return;
      seenNode.push(x);

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
    state.familiesInFlow = [];
    state.lastSurveyTypeIdInFlow = null;
    state.lastSurveyNameInFlow = '';

    try {
      var data = await apiGet('/admin/stakeholders/companies/' + encodeURIComponent(state.companyId) + '?environment=true&journey=true&services=true');
      var company = data.records || data;
      var journey = company && company.journey || {};
      var sf = journey.surveyflow || journey.surveyFlow || journey.flow || null;
      state.surveyFlow = sf;
      state.surveyTypesInFlow = collectSurveyTypes(sf || journey);

      state.surveyTypesInFlow.forEach(function (s) {
        state.surveyTypeSetInFlow[String(s.surveyTypeId)] = true;
        if (s.surveyFamilyId && state.familiesInFlow.indexOf(s.surveyFamilyId) < 0) {
          state.familiesInFlow.push(s.surveyFamilyId);
        }
      });

      if (state.surveyTypesInFlow.length) {
        var last = state.surveyTypesInFlow[state.surveyTypesInFlow.length - 1];
        state.lastSurveyTypeIdInFlow = last.surveyTypeId;
        state.lastSurveyNameInFlow = last.name || '';
      }

      state.familiesInFlow.sort(function (a, b) { return a - b; });
    } catch (e) {
      state.surveyFlow = null;
      state.surveyTypesInFlow = [];
      state.surveyTypeSetInFlow = {};
      state.familiesInFlow = [];
      state.lastSurveyTypeIdInFlow = null;
      state.lastSurveyNameInFlow = '';
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

  function analyzeUser(user, records, opts) {
    var base = getUserDisplay(user);
    var rows = { duplicates: [], noNext: [], noWelcome: [], noSessions: [] };
    var all = Array.isArray(records) ? records : [];

    if (!all.length) {
      rows.noSessions.push(Object.assign({}, base));
      rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: 'Sin welcome en absoluto', problema: 'Si' }));
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
      if (!state.surveyTypesInFlow.length && !opts.includeOutsideSurveyFlow) {
        rows.noNext.push(Object.assign({}, base, {
          ultimaSesionCompletada: '',
          surveyTypeId: '',
          fecha: '',
          nota: 'No evaluable: surveyFlow no disponible',
          problema: 'No',
          requiereIT: 'No'
        }));
      } else {
        var pending = flowRecords.some(function (r) { return ['AVAILABLE', 'PROGRESS', 'UNAVAILABLE'].indexOf(r.surveyStatus) >= 0; });
        var finished = flowRecords.filter(function (r) { return r.surveyStatus === 'FINISH'; });

        if (!pending) {
          if (finished.length) {
            finished.sort(function (a, b) { return dateValue(b.questionDate || b.dateStatus || b.userStartDate) - dateValue(a.questionDate || a.dateStatus || a.userStartDate); });
            var last = finished[0];
            var lastOfFlow = false;
            if (opts.useSurveyFlowLastException && last) {
              lastOfFlow = String(state.lastSurveyTypeIdInFlow || '') === String(last.surveyTypeId || '');
            }
            rows.noNext.push(Object.assign({}, base, {
              ultimaSesionCompletada: last.surveyName || '',
              surveyTypeId: last.surveyTypeId || '',
              fecha: last.questionDate || last.dateStatus || last.userStartDate || '',
              nota: lastOfFlow ? 'Ultima sesion del surveyFlow' : 'Sin siguiente sesion en surveyFlow',
              problema: lastOfFlow ? 'No' : 'Si',
              requiereIT: lastOfFlow ? 'No' : 'Si'
            }));
          } else {
            rows.noNext.push(Object.assign({}, base, {
              ultimaSesionCompletada: '',
              surveyTypeId: '',
              fecha: '',
              nota: 'Sin sesiones del surveyFlow',
              problema: 'Si',
              requiereIT: 'Si'
            }));
          }
        }
      }
    }

    if (opts.checkWelcome) {
      var welcomes = all.filter(function (r) { return Number(r.surveyFamilyId) === opts.welcomeFamilyId; });
      var hasFlowSession = flowRecords.length > 0;
      if (!welcomes.length) {
        rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: 'Sin welcome en absoluto', problema: 'Si' }));
      } else {
        var states = welcomes.map(function (w) { return w.surveyStatus; }).filter(Boolean).join(', ');
        var hasFinish = welcomes.some(function (w) { return w.surveyStatus === 'FINISH'; });
        if (hasFinish && !hasFlowSession) {
          rows.noWelcome.push(Object.assign({}, base, { estadoWelcome: states || 'FINISH', problema: 'Si', nota: 'Welcome completada pero sin sesiones del surveyFlow' }));
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
      checkSurveyFlow: $('ksa-check-surveyflow').checked,
      checkDuplicates: $('ksa-check-duplicates').checked,
      checkNoNext: $('ksa-check-nonext').checked,
      checkWelcome: $('ksa-check-welcome').checked,
      welcomeFamilyId: 11,
      useSurveyFlowLastException: $('ksa-check-lastflow').checked,
      includeOutsideSurveyFlow: $('ksa-check-outside').checked
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
      el.innerHTML = '<div style="color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px">No se han detectado sesiones en el surveyFlow. El analisis de "sin siguiente sesion" se marcara como no evaluable salvo que actives el modo avanzado.</div>';
      return;
    }

    var preview = state.surveyTypesInFlow.slice(0, 12).map(function (s) {
      return '<span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:4px 8px;margin:2px;font-size:11px">' + esc(s.name || ('surveyTypeId ' + s.surveyTypeId)) + ' · ' + esc(s.surveyTypeId) + '</span>';
    }).join('');

    if (state.surveyTypesInFlow.length > 12) {
      preview += '<span style="display:inline-block;color:#64748b;font-size:11px;margin-left:4px">+' + (state.surveyTypesInFlow.length - 12) + ' mas</span>';
    }

    el.innerHTML =
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;color:#1e40af;font-size:12px;line-height:1.45">' +
      '<strong>SurveyFlow detectado:</strong> ' + state.surveyTypesInFlow.length + ' surveyTypeId. ' +
      '<br><strong>Familias dentro del flujo:</strong> ' + (state.familiesInFlow.map(familyLabel).join(', ') || 'no detectadas') + '.' +
      '<br><strong>Ultima sesion detectada:</strong> ' + esc(state.lastSurveyNameInFlow || 'sin nombre') + ' (' + esc(state.lastSurveyTypeIdInFlow || '') + ').' +
      '<div style="margin-top:7px">' + preview + '</div>' +
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
    state.familiesInFlow = [];
    state.lastSurveyTypeIdInFlow = null;
    state.lastSurveyNameInFlow = '';
    $('ksa-surveyflow-info').innerHTML = '<div style="color:#94a3b8">Cargando surveyFlow...</div>';

    try {
      setStatus('Cargando usuarios y surveyFlow...', 'info');
      await Promise.all([loadUsers(), loadSurveyFlow()]);
      renderSurveyFlowInfo();
      var sfMsg = state.surveyTypesInFlow.length ? 'SurveyFlow detectado con ' + state.surveyTypesInFlow.length + ' sesiones/tipos.' : 'No se pudo detectar surveyFlow util.';
      setStatus('Empresa preparada: ' + state.users.length + ' usuarios. ' + sfMsg + ' El analisis principal usara surveyFlow, no solo surveyFamilyId.', state.surveyTypesInFlow.length ? 'ok' : 'warn');
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
          '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:8px">Politica de analisis</div>' +
          '<label style="display:flex;gap:8px;margin-bottom:7px"><input id="ksa-check-surveyflow" type="checkbox" checked> <span>Analizar sesiones del surveyFlow</span></label>' +
          '<label style="display:flex;gap:8px;margin-bottom:7px"><input id="ksa-check-duplicates" type="checkbox" checked> <span>Detectar duplicados dentro del surveyFlow</span></label>' +
          '<label style="display:flex;gap:8px;margin-bottom:7px"><input id="ksa-check-nonext" type="checkbox" checked> <span>Detectar usuarios sin siguiente sesion en surveyFlow</span></label>' +
          '<label style="display:flex;gap:8px;margin-bottom:7px"><input id="ksa-check-welcome" type="checkbox" checked> <span>Revisar welcome</span></label>' +
          '<label style="display:flex;gap:8px;margin-bottom:7px"><input id="ksa-check-lastflow" type="checkbox" checked> <span>Usar excepcion de ultima sesion del surveyFlow</span></label>' +
          '<label style="display:flex;gap:8px;margin-bottom:0"><input id="ksa-check-outside" type="checkbox"> <span>Incluir sesiones fuera del surveyFlow como analisis avanzado</span></label>' +
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
        '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;color:#92400e;font-size:12px;line-height:1.45;margin-bottom:12px">' +
          '<strong>Analizar todas las empresas:</strong> reservado para la siguiente fase. Politica propuesta: surveyFlow como fuente principal, welcome aparte y fuera del surveyFlow desactivado por defecto.' +
        '</div>' +
        '<div id="ksa-results"></div>' +
      '</div>';

    document.body.appendChild(div);
    $('ksa-close').onclick = function () { div.remove(); };
    $('ksa-cancel').onclick = function () { state.cancelled = true; setStatus('Cancelando al terminar el lote actual...', 'warn'); };
    $('ksa-run').onclick = runAnalysis;
    $('ksa-refresh-company').onclick = refreshCompany;
    init();
  }

  createPanel();
})();
