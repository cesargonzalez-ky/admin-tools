(function () {
  'use strict';

  var MOD_VERSION = 'session-loader-v2';

  if (!window.KymatioAdminTools) { console.error('KAT no cargado'); return; }
  var KAT = window.KymatioAdminTools;

  var API_SESSIONS = 'https://api.kymatio.com/v2/admin/mgm/sessions';
  var PAUSE_MS = 400;   // pausa entre llamadas a la API

  // Las 7 temáticas de una sesión de concienciación, en el orden de la plataforma
  var TOPICS = [
    { code: 'DATAPROTECTION',     key: 'dataprotection' },
    { code: 'MALWARE',            key: 'malware' },
    { code: 'COMMUNICATIONS',     key: 'communications' },
    { code: 'PASSWORDMANAGEMENT', key: 'passwords' },
    { code: 'WORKPLACE',          key: 'workplace' },
    { code: 'SOCIALENGINEERING',  key: 'socialengineering' },
    { code: 'COMPLIANCE',         key: 'compliance' }
  ];
  var TEMA_A_CODIGO = {
    'data protection': 'DATAPROTECTION', 'proteccion de datos': 'DATAPROTECTION',
    'malware': 'MALWARE',
    'communications': 'COMMUNICATIONS', 'comunicaciones': 'COMMUNICATIONS',
    'password management': 'PASSWORDMANAGEMENT', 'gestion de contrasenas': 'PASSWORDMANAGEMENT',
    'workplace': 'WORKPLACE', 'puesto de trabajo': 'WORKPLACE',
    'social engineering': 'SOCIALENGINEERING', 'ingenieria social': 'SOCIALENGINEERING',
    'compliance': 'COMPLIANCE', 'cumplimiento': 'COMPLIANCE'
  };
  var CLAVE_A_CODIGO = {};
  TOPICS.forEach(function (t) { CLAVE_A_CODIGO[t.key] = t.code; });

  // ── Utilidades ───────────────────────────────────────────────────────────────

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function txt(v) { return v == null ? '' : String(v); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function stable(v) {   // JSON con claves ordenadas, para comparar sin depender del orden
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
        .map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  async function loadXlsx() {
    if (window.XLSX) return;
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function readFileBuffer(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(new Error('No se pudo leer el archivo')); };
      fr.readAsArrayBuffer(file);
    });
  }

  // ── Lectura y validación del Excel ───────────────────────────────────────────

  function normRows(ws) {
    var rows = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    var out = [];
    rows.forEach(function (r, i) {
      var o = {}, hay = false;
      Object.keys(r).forEach(function (k) {
        o[norm(k)] = r[k];
        if (r[k] !== '' && r[k] != null) hay = true;
      });
      if (hay) { o.__fila = i + 2; out.push(o); }
    });
    return { rows: out, headers: rows.length ? Object.keys(rows[0]).map(norm) : [] };
  }

  function findSheet(wb, regex) {
    var hidden = {};
    ((wb.Workbook && wb.Workbook.Sheets) || []).forEach(function (s) { if (s.Hidden) hidden[s.name] = true; });
    return wb.SheetNames.filter(function (n) { return regex.test(norm(n)) && !hidden[n]; });
  }

  function parseWorkbook(wb) {
    var res = { errors: [], warnings: [], langs: [], themes: {}, langIssues: {}, resumen: {} };
    function err(m) { res.errors.push(m); }

    var sq = findSheet(wb, /question|pregunta/), sa = findSheet(wb, /action|accion/), ss = findSheet(wb, /asset|activo/);
    if (sq.length !== 1) err('No encuentro una única hoja de preguntas (Questions/Preguntas); encontradas: ' + (sq.join(', ') || 'ninguna'));
    if (sa.length !== 1) err('No encuentro una única hoja de acciones (Actions/Acciones); encontradas: ' + (sa.join(', ') || 'ninguna'));
    if (ss.length !== 1) err('No encuentro una única hoja de assets (Assets/Activos); encontradas: ' + (ss.join(', ') || 'ninguna'));
    if (res.errors.length) return res;

    var Q = normRows(wb.Sheets[sq[0]]), A = normRows(wb.Sheets[sa[0]]), S = normRows(wb.Sheets[ss[0]]);
    function faltan(h, req, hoja) {
      var f = req.filter(function (c) { return h.indexOf(c) < 0; });
      if (f.length) err('En la hoja ' + hoja + ' faltan columnas: ' + f.join(', '));
    }
    faltan(Q.headers, ['language', 'question_es', 'respuesta1', 'respuesta2', 'respuesta3', 'valorback1', 'valorback2', 'valorback3', 'feedback 1', 'feedback 2', 'feedback 3'], 'de preguntas');
    if (Q.headers.indexOf('tema') < 0 && Q.headers.indexOf('orden') < 0) err('En la hoja de preguntas hace falta la columna Tema o la columna Orden');
    faltan(A.headers, ['locale', 'dimension', 'title own', 'description own'], 'de acciones');
    faltan(S.headers, ['lang', 'type', 'link (titulo)', 'url (contenido)', 'codigo id producto'], 'de assets');
    if (res.errors.length) return res;

    var langSet = {};
    function tema(code) { if (!res.themes[code]) res.themes[code] = { question: {}, action: {}, assets: [] }; return res.themes[code]; }

    // Preguntas
    Q.rows.forEach(function (r) {
      var lang = norm(r['language']);
      if (!lang) { err('Preguntas, fila ' + r.__fila + ': falta el idioma'); return; }
      langSet[lang] = true;
      var porTema = TEMA_A_CODIGO[norm(r['tema'])];
      var ord = parseInt(r['orden'], 10);
      var porOrden = ord >= 1 && ord <= 7 ? TOPICS[ord - 1].code : null;
      var code = porTema || porOrden;
      if (!code) { err('Preguntas, fila ' + r.__fila + ': no reconozco la temática (Tema="' + txt(r['tema']) + '", Orden="' + txt(r['orden']) + '")'); return; }
      if (porTema && porOrden && porTema !== porOrden) { err('Preguntas, fila ' + r.__fila + ': Tema (' + porTema + ') y Orden (' + ord + ') apuntan a temáticas distintas'); return; }
      var t = tema(code);
      if (t.question[lang]) { err('Preguntas, fila ' + r.__fila + ': hay dos preguntas para ' + code + ' en ' + lang); return; }
      var choices = [], correctas = [];
      for (var i = 1; i <= 3; i++) {
        var vf = parseInt(r['valorfront' + i], 10);
        var val = isNaN(vf) ? i : vf;
        choices.push({ value: val, text: txt(r['respuesta' + i]), exp: txt(r['feedback ' + i]) });
        if (parseInt(r['valorback' + i], 10) === 1) correctas.push(val);
      }
      t.question[lang] = { title: txt(r['question_es']), choices: choices, correct: correctas.length === 1 ? correctas[0] : null, nCorrectas: correctas.length, fila: r.__fila };
    });

    // Acciones
    A.rows.forEach(function (r) {
      var lang = norm(r['locale']);
      if (!lang) { err('Acciones, fila ' + r.__fila + ': falta el idioma (Locale)'); return; }
      langSet[lang] = true;
      var code = txt(r['dimension']).trim().toUpperCase();
      if (!CLAVE_A_CODIGO[code.toLowerCase()] && !TOPICS.some(function (t) { return t.code === code; })) { err('Acciones, fila ' + r.__fila + ': dimensión desconocida "' + txt(r['dimension']) + '"'); return; }
      var t = tema(code);
      if (t.action[lang]) { err('Acciones, fila ' + r.__fila + ': hay dos acciones para ' + code + ' en ' + lang); return; }
      t.action[lang] = { title: txt(r['title own']), desc: txt(r['description own']), fila: r.__fila };
    });

    // Assets (se emparejan entre idiomas por "código ID producto")
    var porCodigo = {};
    S.rows.forEach(function (r) {
      var lang = norm(r['lang']);
      var cod = txt(r['codigo id producto']).trim();
      if (!lang) { err('Assets, fila ' + r.__fila + ': falta el idioma (Lang)'); return; }
      langSet[lang] = true;
      var m = cod.toLowerCase().match(/_(dataprotection|malware|communications|passwords|workplace|socialengineering|compliance)_/);
      if (!m) { err('Assets, fila ' + r.__fila + ': no puedo deducir la temática del código "' + cod + '"'); return; }
      var code = CLAVE_A_CODIGO[m[1]];
      var type = norm(r['type']);
      if (type !== 'html' && type !== 'youtube') { err('Assets, fila ' + r.__fila + ': tipo "' + txt(r['type']) + '" no admitido (solo html o youtube)'); return; }
      var k = code + '|' + cod.toLowerCase();
      if (!porCodigo[k]) { porCodigo[k] = { code: code, type: type, per: {} }; tema(code).assets.push(porCodigo[k]); }
      var a = porCodigo[k];
      if (a.type !== type) { err('Assets, fila ' + r.__fila + ': el tipo de "' + cod + '" cambia entre idiomas'); return; }
      if (a.per[lang]) { err('Assets, fila ' + r.__fila + ': "' + cod + '" está repetido en ' + lang); return; }
      var url = txt(r['url (contenido)']);
      if (type === 'html' && url.length >= 32000) res.warnings.push('Assets, fila ' + r.__fila + ': el HTML tiene ' + url.length + ' caracteres, cerca del límite de celda de Excel (32.767); puede estar cortado');
      a.per[lang] = { link: txt(r['link (titulo)']), url: url, fila: r.__fila };
    });

    res.langs = Object.keys(langSet).sort();
    res.langs.forEach(function (l) { res.langIssues[l] = []; });

    // Completitud por temática e idioma
    TOPICS.forEach(function (tp) {
      var t = res.themes[tp.code];
      if (!t) { err('Falta por completo la temática ' + tp.code + ' (sin pregunta, acción ni assets)'); return; }
      if (!t.assets.length) err(tp.code + ': no hay ningún asset');
      res.langs.forEach(function (l) {
        var q = t.question[l], a = t.action[l], iss = res.langIssues[l];
        if (!q) iss.push(tp.code + ': falta la pregunta en ' + l);
        else {
          if (!q.title.trim()) iss.push(tp.code + ': pregunta vacía en ' + l);
          q.choices.forEach(function (c, i) {
            if (!c.text.trim()) iss.push(tp.code + ': respuesta ' + (i + 1) + ' vacía en ' + l);
            if (!c.exp.trim()) iss.push(tp.code + ': feedback ' + (i + 1) + ' vacío en ' + l);
          });
          if (q.nCorrectas !== 1) iss.push(tp.code + ': debe haber exactamente una respuesta correcta (ValorBack = 1) y hay ' + q.nCorrectas + ' en ' + l);
        }
        if (!a) iss.push(tp.code + ': falta la acción en ' + l);
        else {
          if (!a.title.trim()) iss.push(tp.code + ': título de la acción vacío en ' + l);
          if (!a.desc.trim()) iss.push(tp.code + ': descripción de la acción vacía en ' + l);
        }
        t.assets.forEach(function (as) {
          var p = as.per[l];
          if (!p) iss.push(tp.code + ': falta el asset "' + (as.type) + '" en ' + l);
          else {
            if (!p.link.trim()) iss.push(tp.code + ': asset ' + as.type + ' sin título en ' + l);
            if (!p.url.trim()) iss.push(tp.code + ': asset ' + as.type + ' sin contenido en ' + l);
            if (as.type === 'youtube' && p.url.trim() && !/^[A-Za-z0-9_-]{11}$/.test(p.url.trim())) res.warnings.push(tp.code + ': el código de YouTube "' + p.url.trim() + '" (' + l + ') no tiene 11 caracteres');
          }
        });
      });
    });
    res.resumen = { temas: Object.keys(res.themes).length, preguntas: Q.rows.length, acciones: A.rows.length, assets: S.rows.length };
    return res;
  }

  // ── Construcción del cuerpo (misma forma que envía la pantalla) ──────────────

  function dict(porIdioma, langs, original) {
    var d = {};
    langs.forEach(function (l) {
      if (porIdioma[l] === undefined) return;
      d[l] = { default: porIdioma[l], original_language: original };
      if (l !== original) d[l].translation_type = 'manual';
    });
    return { dictionary: d };
  }

  function buildTheme(code, t, langs, original, auto) {
    var porIdioma = function (fn) { var o = {}; langs.forEach(function (l) { o[l] = fn(l); }); return o; };
    var nChoices = 3, choices = [];
    for (var i = 0; i < nChoices; i++) {
      (function (i) {
        choices.push({
          value: t.question[original].choices[i].value,
          text: dict(porIdioma(function (l) { return t.question[l].choices[i].text; }), langs, original),
          explanation: dict(porIdioma(function (l) { return t.question[l].choices[i].exp; }), langs, original)
        });
      })(i);
    }
    return {
      topicCode: code,
      action: {
        id: null, psychoCode: null,
        title: dict(porIdioma(function (l) { return t.action[l].title; }), langs, original),
        description: dict(porIdioma(function (l) { return t.action[l].desc; }), langs, original),
        autoTranslate: !!auto,
        isActive: true
      },
      question: {
        content: { title: dict(porIdioma(function (l) { return t.question[l].title; }), langs, original), choices: choices },
        correctChoiceValue: t.question[original].correct,
        autoTranslate: !!auto
      },
      assets: t.assets.map(function (as) {
        var content = {};
        langs.forEach(function (l) {
          content[l] = { default: { url: as.per[l].url, link: as.per[l].link, type: as.type, source: 'external' }, original_language: original };
          if (l !== original) content[l].translation_type = 'manual';
        });
        return { id: null, psychoCode: null, assetContent: content, isAutomatic: !!auto, sharedWith: [] };
      })
    };
  }

  function toUiTheme(t) {   // de lo que devuelve el servidor a lo que envía la pantalla
    if (!t || !t.action) return { topicCode: t && t.topicCode, action: null };
    function pick(o, ks) { var r = {}; ks.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; }
    return {
      topicCode: t.topicCode,
      action: pick(t.action, ['id', 'psychoCode', 'title', 'description', 'autoTranslate', 'isActive']),
      question: t.question ? { content: t.question.content, correctChoiceValue: t.question.correctChoiceValue, autoTranslate: t.question.autoTranslate } : undefined,
      assets: (t.assets || []).map(function (a) { return pick(a, ['id', 'psychoCode', 'assetContent', 'isAutomatic', 'sharedWith']); })
    };
  }

  // ── API ──────────────────────────────────────────────────────────────────────

  async function api(method, url, body) {
    var token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    var res = await fetch(url, {
      method: method,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    var d = null; try { d = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((d && (d.message || (d.records && d.records.message))) || ('HTTP ' + res.status));
    return d && d.records !== undefined ? d.records : d;
  }

  async function findSession(code) {
    var recs = await api('GET', API_SESSIONS + '?page=1&limit=100&search=' + encodeURIComponent(code));
    recs = Array.isArray(recs) ? recs : [];
    return {
      exact: recs.filter(function (s) { return s.name === code; }),
      similar: recs.filter(function (s) { return s.name !== code && norm(s.name) === norm(code); })
    };
  }

  // Recorre el listado buscando por surveyId (no se asume que coincida con el id de la sesión)
  async function findBySurveyId(n) {
    var found = [];
    for (var page = 1; page <= 10; page++) {
      var recs = await api('GET', API_SESSIONS + '?page=' + page + '&limit=100');
      recs = Array.isArray(recs) ? recs : [];
      recs.forEach(function (s) { if (String(s.surveyId) === String(n)) found.push(s); });
      if (recs.length < 100) break;
      await sleep(PAUSE_MS);
    }
    return found;
  }

  // 1º por código único; si no aparece y lo escrito es un número, 2º como surveyId; si no, no encontrada
  async function resolveSession(entrada, log) {
    var porCodigo = await findSession(entrada);
    if (porCodigo.exact.length) return { via: 'codigo', exact: porCodigo.exact, similar: porCodigo.similar };
    if (/^\d+$/.test(entrada)) {
      if (log) log('No hay ningún código único "' + entrada + '"; lo pruebo como surveyId…');
      await sleep(PAUSE_MS);
      var porSurvey = await findBySurveyId(entrada);
      if (porSurvey.length) return { via: 'surveyId', exact: porSurvey, similar: [] };
    }
    return { via: null, exact: [], similar: porCodigo.similar };
  }

  // ── Interfaz ─────────────────────────────────────────────────────────────────

  function renderGui(container, kat) {
    var parsed = null;
    var store = (function () { var a = document.querySelector('#app'); return a && a.__vue_app__ && a.__vue_app__.config.globalProperties.$store; })();
    function ctx() {
      var s = store && store.state && store.state.Admin && store.state.Admin.companySelected;
      return { id: s && s.stakeholderId, name: (s && s.name) || '' };
    }
    function $(id) { return document.getElementById(id); }
    var esc = function (s) { return kat.escHtml(s); };

    var c0 = ctx();
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">' +
        '<span style="font-size:11px;color:#94a3b8">v: ' + esc(MOD_VERSION) + '</span>' +
        '<span style="font-size:12px;color:#475569">Empresa del contexto: <strong id="kym-sl-ctx">' + esc(c0.name) + '</strong> <span style="color:#94a3b8">(ID ' + esc(String(c0.id)) + ')</span></span>' +
      '</div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px;margin-bottom:12px;font-size:12.5px;color:#0369a1;line-height:1.6">' +
        'Carga el contenido de una sesión de concienciación (7 temáticas) desde un Excel con las hojas <strong>Questions</strong>, <strong>Actions</strong> y <strong>Assets</strong>. ' +
        'Las sesiones se quedan siempre en <strong>borrador: nunca se publican</strong>.' +
      '</div>' +
      '<div style="display:flex;gap:16px;margin-bottom:10px;font-size:13px">' +
        '<label style="cursor:pointer"><input type="radio" name="kym-sl-mode" id="kym-sl-mode-create" checked> Crear sesión nueva</label>' +
        '<label style="cursor:pointer"><input type="radio" name="kym-sl-mode" id="kym-sl-mode-modify"> Modificar una existente</label>' +
      '</div>' +
      '<div style="margin-bottom:10px"><label style="display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:4px">Excel</label>' +
        '<input type="file" id="kym-sl-file" accept=".xlsx,.xlsm" style="font-size:13px;width:100%;box-sizing:border-box"></div>' +
      '<div id="kym-sl-report" style="display:none;margin-bottom:10px;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.6"></div>' +
      '<div style="margin-bottom:10px"><label style="display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:4px" id="kym-sl-code-label">Código único de la sesión nueva</label>' +
        '<input type="text" id="kym-sl-code" placeholder="p. ej. KYMATIO_CYBERSECURITY_N003" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px"></div>' +
      '<div id="kym-sl-createopts" style="margin-bottom:10px">' +
        '<div style="display:flex;gap:10px;margin-bottom:8px;flex-wrap:wrap">' +
          '<label style="font-size:12px;color:#475569">Idioma original <select id="kym-sl-orig" style="padding:5px;border:1px solid #cbd5e1;border-radius:6px"></select></label>' +
          '<label style="font-size:12px;color:#475569">Traducción <select id="kym-sl-trans" style="padding:5px;border:1px solid #cbd5e1;border-radius:6px"><option value="manual">Manual (idiomas del Excel)</option><option value="auto">Automática (solo el original)</option></select></label>' +
        '</div>' +
        '<div id="kym-sl-names"></div>' +
      '</div>' +
      '<button id="kym-sl-run" style="width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">&#9654; Crear sesión</button>' +
      '<div id="kym-sl-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:10px"></div>' +
      '<div id="kym-sl-log" style="display:none;background:#0f172a;border-radius:8px;padding:12px;font-size:11px;font-family:Menlo,Consolas,monospace;max-height:220px;overflow-y:auto;margin-bottom:10px"></div>';

    var names = {};   // idioma → nombre (solo creación)

    function mode() { return $('kym-sl-mode-modify').checked ? 'modify' : 'create'; }
    function setStatus(msg, type) {
      var el = $('kym-sl-status');
      var s = { err: 'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;', ok: 'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;', info: 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;', warn: 'background:#fffbeb;border:1px solid #fde68a;color:#92400e;' };
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:10px;' + (s[type] || s.info);
      el.innerHTML = msg;
    }
    function addLog(msg, type) {
      var el = $('kym-sl-log'); el.style.display = 'block';
      var l = document.createElement('div');
      l.style.cssText = 'padding:1px 0;' + (type === 'ok' ? 'color:#4ade80;' : type === 'err' ? 'color:#f87171;' : type === 'warn' ? 'color:#fbbf24;' : 'color:#94a3b8;');
      l.textContent = (type === 'ok' ? '✓ ' : type === 'err' ? '✗ ' : type === 'warn' ? '⚠ ' : '· ') + msg;
      el.appendChild(l); el.scrollTop = el.scrollHeight;
    }

    function confirmModal(html, okText) {
      return new Promise(function (resolve) {
        var ov = document.createElement('div');
        ov.id = 'kym-sl-modal';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px';
        ov.innerHTML = '<div style="background:white;border-radius:12px;padding:22px;max-width:520px;width:100%;max-height:85vh;overflow:auto;font-size:13.5px;line-height:1.6;color:#1e293b">' +
          '<div style="font-weight:800;font-size:15px;margin-bottom:10px">Confirmar</div>' + html +
          '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">' +
          '<button id="kym-sl-modal-cancel" style="background:#f1f5f9;border:none;border-radius:8px;padding:9px 16px;cursor:pointer;font-weight:600">Cancelar</button>' +
          '<button id="kym-sl-modal-ok" style="background:#1e293b;color:white;border:none;border-radius:8px;padding:9px 16px;cursor:pointer;font-weight:700">' + esc(okText) + '</button></div></div>';
        document.body.appendChild(ov);
        function cerrar(v) { ov.remove(); resolve(v); }
        ov.querySelector('#kym-sl-modal-cancel').onclick = function () { cerrar(false); };
        ov.querySelector('#kym-sl-modal-ok').onclick = function () { cerrar(true); };
      });
    }

    function renderNames() {
      var el = $('kym-sl-names'); el.innerHTML = '';
      if (!parsed) return;
      var orig = $('kym-sl-orig').value, auto = $('kym-sl-trans').value === 'auto';
      var langs = auto ? [orig] : parsed.langs;
      langs.forEach(function (l) {
        var row = document.createElement('div'); row.style.cssText = 'margin-bottom:6px';
        var inp = document.createElement('input');
        inp.type = 'text'; inp.value = names[l] || ''; inp.placeholder = 'Nombre de la sesión en ' + l + (l === orig ? ' (idioma original)' : '');
        inp.style.cssText = 'width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px';
        inp.oninput = function () { names[l] = inp.value; };
        row.appendChild(inp); el.appendChild(row);
      });
    }

    function syncMode() {
      var m = mode();
      $('kym-sl-createopts').style.display = m === 'create' ? 'block' : 'none';
      $('kym-sl-code-label').textContent = m === 'create' ? 'Código único de la sesión nueva' : 'Código único o surveyId de la sesión que se va a modificar';
      $('kym-sl-code').placeholder = m === 'create' ? 'p. ej. KYMATIO_CYBERSECURITY_N003' : 'Código único (o, si no lo tienes, el surveyId)';
      $('kym-sl-run').innerHTML = m === 'create' ? '&#9654; Crear sesión' : '&#9654; Modificar sesión';
    }
    $('kym-sl-mode-create').onchange = syncMode;
    $('kym-sl-mode-modify').onchange = syncMode;
    $('kym-sl-trans').onchange = renderNames;
    $('kym-sl-orig').onchange = renderNames;

    $('kym-sl-file').onchange = async function (e) {
      var file = e.target.files && e.target.files[0];
      parsed = null; $('kym-sl-report').style.display = 'none';
      if (!file) return;
      try {
        await loadXlsx();
        var buf = await readFileBuffer(file);
        var wb = window.XLSX.read(buf, { type: 'array' });
        parsed = parseWorkbook(wb);
      } catch (ex) {
        parsed = { errors: ['No se pudo leer el Excel: ' + ex.message], warnings: [], langs: [], themes: {}, langIssues: {} };
      }
      var rep = $('kym-sl-report'), p = parsed;
      var partes = [];
      if (!p.errors.length) {
        partes.push('<strong>&#10003; ' + esc(file.name) + '</strong>: ' + p.resumen.temas + ' temáticas · ' + p.resumen.preguntas + ' filas de preguntas · ' + p.resumen.acciones + ' de acciones · ' + p.resumen.assets + ' de assets · idiomas: <strong>' + esc(p.langs.join(', ')) + '</strong>');
      } else {
        partes.push('<strong>&#10007; ' + esc(file.name) + '</strong>: hay errores que impiden cargarlo');
        p.errors.slice(0, 12).forEach(function (m) { partes.push('· ' + esc(m)); });
        if (p.errors.length > 12) partes.push('· … y ' + (p.errors.length - 12) + ' más');
      }
      p.langs.forEach(function (l) {
        var n = (p.langIssues[l] || []).length;
        if (n) { partes.push('<span style="color:#b45309">&#9888; ' + esc(l) + ' incompleto (' + n + ' problemas); no podrá cargarse ese idioma. Ejemplo: ' + esc(p.langIssues[l][0]) + '</span>'); }
      });
      p.warnings.slice(0, 5).forEach(function (m) { partes.push('<span style="color:#b45309">&#9888; ' + esc(m) + '</span>'); });
      rep.style.display = 'block';
      rep.style.cssText = 'display:block;margin-bottom:10px;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.6;' + (p.errors.length ? 'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;' : 'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;');
      rep.innerHTML = partes.join('<br>');
      var sel = $('kym-sl-orig'); sel.innerHTML = '';
      p.langs.forEach(function (l) { var o = document.createElement('option'); o.value = l; o.textContent = l; sel.appendChild(o); });
      if (p.langs.indexOf('es-es') >= 0) sel.value = 'es-es';
      $('kym-sl-trans').value = p.langs.length > 1 ? 'manual' : 'auto';
      renderNames();
    };

    function errorsOf(langs) {   // problemas bloqueantes de los idiomas que se van a usar
      var out = [];
      langs.forEach(function (l) { (parsed.langIssues[l] || []).forEach(function (m) { out.push(m); }); });
      return out;
    }
    function resumenTemas(themes) {
      return themes.filter(function (t) { return t && t.action; }).length + ' de 7 temáticas con contenido';
    }

    $('kym-sl-run').onclick = async function () {
      var btn = $('kym-sl-run');
      $('kym-sl-log').innerHTML = '';
      try {
        if (!parsed) { setStatus('&#10007; Sube primero el Excel.', 'err'); return; }
        if (parsed.errors.length) { setStatus('&#10007; El Excel tiene errores; corrígelos y vuelve a subirlo.', 'err'); return; }
        var code = $('kym-sl-code').value.trim();
        if (!code) { setStatus('&#10007; ' + (mode() === 'create' ? 'Indica el código de la sesión.' : 'Indica el código único o el surveyId de la sesión.'), 'err'); return; }
        btn.disabled = true;

        if (mode() === 'create') await crear(code); else await modificar(code);
      } catch (ex) {
        setStatus('&#10007; ' + esc(ex.message), 'err'); addLog(ex.message, 'err');
      } finally { btn.disabled = false; }
    };

    function verificar(rec, esperadas, codigos) {
      var dif = [];
      codigos.forEach(function (code) {
        var srv = (rec.themes || []).filter(function (t) { return t.topicCode === code; })[0];
        var exp = esperadas.filter(function (t) { return t.topicCode === code; })[0];
        if (stable(toUiTheme(srv)) !== stable(exp)) dif.push(code);
      });
      return dif;
    }

    async function crear(code) {
      var c = ctx();
      if (!c.id) throw new Error('No hay empresa seleccionada en el contexto.');
      var original = $('kym-sl-orig').value, auto = $('kym-sl-trans').value === 'auto';
      if (parsed.langs.indexOf(original) < 0) throw new Error('El idioma original ' + original + ' no está en el Excel.');
      var langs = auto ? [original] : parsed.langs;
      var bloqueos = errorsOf(langs);
      if (bloqueos.length) throw new Error('El Excel está incompleto para ' + langs.join(', ') + ': ' + bloqueos.slice(0, 3).join(' · ') + (bloqueos.length > 3 ? ' …(+' + (bloqueos.length - 3) + ')' : ''));
      var nombres = {};
      for (var i = 0; i < langs.length; i++) {
        var n = (names[langs[i]] || '').trim();
        if (!n) throw new Error('Falta el nombre de la sesión en ' + langs[i] + '.');
        nombres[langs[i]] = n;
      }
      setStatus('Comprobando que el código no existe…', 'info'); addLog('Buscando "' + code + '"…');
      var f = await findSession(code);
      if (f.exact.length) throw new Error('Ya existe una sesión con el código ' + code + '. Usa "Modificar" o cambia el código.');
      if (f.similar.length) addLog('Aviso: existe un código parecido (' + f.similar[0].name + ')', 'warn');

      var themes = TOPICS.map(function (tp) { return buildTheme(tp.code, parsed.themes[tp.code], langs, original, auto); });
      var ok = await confirmModal(
        '<p>Se va a <strong>crear una sesión nueva</strong> en la empresa:</p>' +
        '<p style="background:#f1f5f9;border-radius:8px;padding:10px 12px"><strong>' + esc(c.name) + '</strong> <span style="color:#64748b">(ID ' + esc(String(c.id)) + ')</span></p>' +
        '<ul style="margin:0 0 6px 18px;padding:0"><li>Código: <strong>' + esc(code) + '</strong></li><li>Nombre: ' + esc(nombres[original]) + '</li>' +
        '<li>Idioma original: ' + esc(original) + ' · traducción ' + (auto ? 'automática (solo el original)' : 'manual (' + esc(langs.join(', ')) + ')') + '</li>' +
        '<li>Contenido: ' + resumenTemas(themes) + '</li></ul>' +
        '<p style="margin:6px 0 0;color:#64748b;font-size:12.5px">Quedará en <strong>borrador</strong>; no se publica. La empresa no se puede cambiar después.</p>', 'Crear sesión');
      if (!ok) { setStatus('Cancelado. No se ha creado nada.', 'info'); return; }

      var raiz = { name: code, label: nombres[original], surveyTypeId: null, companyId: c.id, isActive: false, originalLanguage: original, nameTranslations: nombres, translationTypeIsAutomatic: auto };
      setStatus('Creando la sesión…', 'info'); addLog('POST: creando la sesión en ' + c.name + ' (ID ' + c.id + ')…');
      var rec = await api('POST', API_SESSIONS, Object.assign({}, raiz, { themes: TOPICS.map(function (tp) { return { topicCode: tp.code, action: null }; }) }));
      if (!rec || !rec.id) throw new Error('La API no devolvió el id de la sesión creada.');
      addLog('Sesión creada con id ' + rec.id + ' (empresa ' + rec.companyId + ')', 'ok');
      if (rec.companyId !== c.id) addLog('Aviso: la empresa asignada (' + rec.companyId + ') no coincide con la del contexto (' + c.id + ')', 'warn');

      await sleep(PAUSE_MS);
      setStatus('Cargando el contenido de las 7 temáticas…', 'info'); addLog('PUT: cargando ' + resumenTemas(themes) + '…');
      await api('PUT', API_SESSIONS + '/' + rec.id, Object.assign({}, raiz, { companyId: rec.companyId, themes: themes }));
      addLog('Contenido guardado', 'ok');

      await sleep(PAUSE_MS);
      var leido = await api('GET', API_SESSIONS + '/' + rec.id);
      var dif = verificar(leido, themes, TOPICS.map(function (t) { return t.code; }));
      if (dif.length) addLog('El servidor normalizó o difiere en: ' + dif.join(', ') + ' (revisa la sesión en pantalla)', 'warn');
      else addLog('Verificado: lo leído de vuelta coincide con lo enviado', 'ok');
      addLog('Estado: borrador=' + leido.isDraft + ', publicada=' + leido.isPublished + ', completa=' + leido.completed, 'info');
      setStatus('&#10003; Sesión <strong>' + esc(code) + '</strong> creada (id ' + rec.id + ') en borrador.', 'ok');
      kat.showToast('Sesión creada: ' + code, 'ok');
    }

    async function modificar(entrada) {
      var esNumero = /^\d+$/.test(entrada);
      setStatus('Buscando la sesión…', 'info'); addLog('Buscando por código único "' + entrada + '"…');
      var f = await resolveSession(entrada, function (m) { addLog(m); });
      if (!f.exact.length) throw new Error('No existe ninguna sesión con el código único ' + entrada + (esNumero ? ' ni con el surveyId ' + entrada : '') + (f.similar.length ? ' (¿quisiste decir ' + f.similar[0].name + '?)' : '') + '.');
      if (f.exact.length > 1) throw new Error('Hay ' + f.exact.length + ' sesiones con el ' + (f.via === 'surveyId' ? 'surveyId ' : 'código único ') + entrada + '; no sé cuál modificar.');
      var id = f.exact[0].id, code = f.exact[0].name;
      addLog(f.via === 'surveyId' ? 'Encontrada por surveyId ' + entrada + ' → código ' + code + ' (id ' + id + ')' : 'Encontrada por código único (id ' + id + ')', 'ok');
      await sleep(PAUSE_MS);
      var rec = await api('GET', API_SESSIONS + '/' + id);
      if (rec.isPublished || rec.isDraft === false) throw new Error('La sesión ' + code + ' está publicada (o no es un borrador). Solo se modifican borradores.');
      if (rec.usage && rec.usage.structureLocked) throw new Error('La estructura de la sesión ' + code + ' está bloqueada.');

      var original = rec.originalLanguage, auto = !!rec.translationTypeIsAutomatic;
      if (parsed.langs.indexOf(original) < 0) throw new Error('El idioma original de la sesión (' + original + ') no está en el Excel.');
      var langs = auto ? [original] : parsed.langs;
      var bloqueos = errorsOf(langs);
      if (bloqueos.length) throw new Error('El Excel está incompleto para ' + langs.join(', ') + ': ' + bloqueos.slice(0, 3).join(' · ') + (bloqueos.length > 3 ? ' …(+' + (bloqueos.length - 3) + ')' : ''));

      var avisos = [];
      if (auto && parsed.langs.length > 1) avisos.push('La sesión está en <strong>traducción automática</strong>: solo se carga ' + esc(original) + '; se ignoran ' + esc(parsed.langs.filter(function (l) { return l !== original; }).join(', ')) + ' del Excel.');
      if (!auto) {
        var extra = Object.keys(rec.nameTranslations || {}).filter(function (l) { return parsed.langs.indexOf(l) < 0; });
        if (extra.length) avisos.push('La sesión tiene traducciones en ' + esc(extra.join(', ')) + ' que el Excel no trae: se perderían en las temáticas que se carguen.');
      }

      var actuales = (rec.themes || []).map(toUiTheme);
      var nuevas = TOPICS.map(function (tp) {
        var ex = actuales.filter(function (t) { return t.topicCode === tp.code; })[0];
        return parsed.themes[tp.code] ? buildTheme(tp.code, parsed.themes[tp.code], langs, original, auto) : (ex || { topicCode: tp.code, action: null });
      });
      var cambian = nuevas.filter(function (t) {
        var ex = actuales.filter(function (x) { return x.topicCode === t.topicCode; })[0];
        return stable(t) !== stable(ex || { topicCode: t.topicCode, action: null });
      }).map(function (t) { return t.topicCode; });

      if (!cambian.length) { setStatus('Sin cambios: el contenido de la sesión ya coincide con el Excel. No se ha enviado nada.', 'ok'); addLog('Sin cambios; no se envía nada', 'ok'); return; }

      var ok = await confirmModal(
        '<p>Se va a <strong>modificar</strong> la sesión (en borrador):</p>' +
        '<p style="background:#f1f5f9;border-radius:8px;padding:10px 12px"><strong>' + esc(rec.name) + '</strong> · ' + esc(rec.label || '') + ' <span style="color:#64748b">(id ' + esc(String(id)) + ', surveyId ' + esc(String(rec.surveyId)) + ', empresa ' + esc(String(rec.companyId)) + ')</span></p>' +
        (f.via === 'surveyId' ? '<p style="margin:0 0 6px;color:#92400e;font-size:12.5px">Localizada por <strong>surveyId ' + esc(entrada) + '</strong>: no había ningún código único con ese valor. Comprueba que es la sesión que buscas.</p>' : '') +
        '<ul style="margin:0 0 6px 18px;padding:0"><li>Temáticas que cambian: <strong>' + cambian.length + ' de 7</strong> (' + esc(cambian.join(', ')) + ')</li>' +
        '<li>Idiomas que se cargan: ' + esc(langs.join(', ')) + ' · traducción ' + (auto ? 'automática' : 'manual') + '</li></ul>' +
        (avisos.length ? '<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;color:#92400e;font-size:12.5px">' + avisos.join('<br>') + '</p>' : '') +
        '<p style="margin:6px 0 0;color:#64748b;font-size:12.5px">El contenido de cada temática del Excel <strong>sustituye por completo</strong> al anterior. La empresa no cambia y no se publica.</p>', 'Modificar sesión');
      if (!ok) { setStatus('Cancelado. No se ha modificado nada.', 'info'); return; }

      avisos.forEach(function (a) { addLog(a.replace(/<[^>]+>/g, ''), 'warn'); });
      var cuerpo = { name: rec.name, label: rec.label, surveyTypeId: rec.surveyTypeId, companyId: rec.companyId, isActive: rec.isActive, originalLanguage: rec.originalLanguage, nameTranslations: rec.nameTranslations, translationTypeIsAutomatic: rec.translationTypeIsAutomatic, themes: nuevas };
      setStatus('Guardando los cambios…', 'info'); addLog('PUT: ' + cambian.length + ' temáticas…');
      await api('PUT', API_SESSIONS + '/' + id, cuerpo);
      addLog('Contenido guardado', 'ok');

      await sleep(PAUSE_MS);
      var leido = await api('GET', API_SESSIONS + '/' + id);
      var dif = verificar(leido, nuevas, cambian);
      if (dif.length) addLog('El servidor normalizó o difiere en: ' + dif.join(', ') + ' (revisa la sesión en pantalla)', 'warn');
      else addLog('Verificado: lo leído de vuelta coincide con lo enviado', 'ok');
      addLog('Estado: borrador=' + leido.isDraft + ', publicada=' + leido.isPublished + ', completa=' + leido.completed, 'info');
      setStatus('&#10003; Sesión <strong>' + esc(code) + '</strong> modificada (' + cambian.length + ' temáticas). Sigue en borrador.', 'ok');
      kat.showToast('Sesión modificada: ' + code, 'ok');
    }

    syncMode();
  }

  KAT.registerModule({
    key:          'session_loader',
    label:        'Cargar sesiones desde Excel',
    group:        'bulk',
    icon:         '&#128218;',
    order:        80,
    version:      MOD_VERSION,
    renderGui:    renderGui,
    forceGuiOnly: true
  });

})();
