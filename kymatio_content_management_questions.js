(function () {
  'use strict';

  var MOD_VERSION = 'questions-v1';

  if (!window.KymatioContentManagement) {
    console.error('KCM: core no cargado');
    return;
  }

  var KCM = window.KymatioContentManagement;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function decodeHtml(v) {
    if (!v) return '';
    try {
      var t = document.createElement('textarea');
      t.innerHTML = String(v);
      return t.value;
    } catch(e) { return String(v); }
  }

  function getText(field, locale) {
    try { return decodeHtml(field.dictionary[locale || 'es-es'].default || ''); } catch(e) { return ''; }
  }

  // ── Reference maps ────────────────────────────────────────────────────────────

  async function fetchReferenceMaps() {
    var token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    function apiRaw(path) {
      return fetch('https://api.kymatio.com/v2/' + path, {
        headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
      }).then(function(r){ return r.json(); }).then(function(d){ return d.records || []; });
    }
    var results = await Promise.all([
      apiRaw('misc/reference/topics'),
      apiRaw('misc/reference/services'),
      apiRaw('misc/reference/question-groups')
    ]);
    var topicMap = {};
    results[0].forEach(function(t){
      var label = '';
      try { label = decodeHtml(t.text.dictionary['es-es'].default); } catch(e){}
      topicMap[t.value] = label || t.value;
    });
    var serviceMap = {};
    results[1].forEach(function(s){ serviceMap[String(s.id)] = s.label || s.name || ''; });
    var groupMap = {};
    results[2].forEach(function(g){ groupMap[String(g.id)] = g.name || g.label || ''; });
    return {topicMap: topicMap, serviceMap: serviceMap, groupMap: groupMap};
  }

  // ── Fetch all questions ────────────────────────────────────────────────────────

  async function fetchAllQuestions(onProgress) {
    var all = [];
    var seen = {};

    async function fetchPages(isActive) {
      var page = 1;
      var totalPages = null;
      while (true) {
        var r = await KCM.apiGet('admin/mgm/questions', {
          page: page, limit: 100, isActive: isActive,
          sortBy: 'questionId', order: 'asc'
        });
        var records = r.records || [];
        var meta = r._meta && r._meta.pagination;
        if (meta && meta.totalPages && totalPages === null) totalPages = meta.totalPages;
        records.forEach(function(q) {
          if (!seen[q.questionId]) {
            seen[q.questionId] = true;
            all.push(q);
          }
        });
        if (onProgress) onProgress(all.length, isActive ? 'activas' : 'inactivas');
        if (!records.length) break;
        if (totalPages !== null && page >= totalPages) break;
        if (totalPages === null && records.length < 100) break;
        page++;
      }
    }

    await fetchPages(true);
    await fetchPages(false);
    return all;
  }

  // ── Build rows ────────────────────────────────────────────────────────────────

  function buildRows(questions, refMaps) {
    // Calcular max choices y successMessages para columnas dinámicas
    var maxChoices = 0;
    var maxSuccess = 0;
    questions.forEach(function(q) {
      var ch = q.question && q.question.choices ? q.question.choices.length : 0;
      var sm = q.question && q.question.successMessage ? q.question.successMessage.length : 0;
      if (ch > maxChoices) maxChoices = ch;
      if (sm > maxSuccess) maxSuccess = sm;
    });

    return questions.map(function(q) {
      var qq = q.question || {};
      var dims = (q.dimensions || []).map(function(d){ return d.dimensionName || d.dimensionId; }).join(', ');
      var topic = qq.topic || '';
      var topicLabel = (refMaps && refMaps.topicMap && refMaps.topicMap[topic]) || topic;
      var serviceLabel = (refMaps && refMaps.serviceMap && refMaps.serviceMap[String(qq.service || '')]) || String(qq.service || '');
      var groupLabel = (refMaps && refMaps.groupMap && refMaps.groupMap[String(q.questionGroupId || '')]) || String(q.questionGroupId || '');

      var row = {
        'questionId':     q.questionId,
        'psychoCode':     q.psychoCode || '',
        'type':           qq.type || '',
        'topic':          topic + (topicLabel && topicLabel !== topic ? ' (' + topicLabel + ')' : ''),
        'service':        serviceLabel,
        'isRequired':     qq.isRequired ? 'Sí' : 'No',
        'questionGroup':  groupLabel,
        'dimensions':     dims,
        'Título (es-es)': getText(qq.title),
        'status':         q.isActive ? 'Activa' : 'Inactiva'
      };

      // Choices (opción A — una columna por choice)
      for (var c = 1; c <= maxChoices; c++) {
        var choice = qq.choices && qq.choices[c - 1];
        row['choice_' + c + ' (es-es)'] = choice ? getText(choice.text) : '';
      }

      // SuccessMessages (una columna por mensaje)
      for (var s = 1; s <= maxSuccess; s++) {
        var sm = qq.successMessage && qq.successMessage[s - 1];
        row['successMsg_' + s + ' (es-es)'] = sm ? getText(sm.text) : '';
      }

      return row;
    });
  }

  function exportExcel(questions, refMaps) {
    var rows = buildRows(questions, refMaps);
    var ws = window.XLSX.utils.json_to_sheet(rows);
    var cols = Object.keys(rows[0] || {});
    ws['!cols'] = cols.map(function(col) {
      var max = col.length;
      rows.forEach(function(r){ var v = String(r[col]||''); if(v.length > max) max = v.length; });
      return { wch: Math.min(max + 2, 120) };
    });
    var wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Preguntas');
    var resumen = [
      ['Campo', 'Valor'],
      ['Fecha exportación', new Date().toISOString().slice(0,19).replace('T',' ')],
      ['Total preguntas', questions.length],
      ['Activas', questions.filter(function(q){ return q.isActive; }).length],
      ['Inactivas', questions.filter(function(q){ return !q.isActive; }).length]
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(resumen), 'Resumen');
    window.XLSX.writeFile(wb, 'kymatio_questions_' + new Date().toISOString().slice(0,10) + '.xlsx');
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function render(container, kcm) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kcm.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#0369a1;line-height:1.6">' +
        'Exporta <strong>todas las preguntas</strong> de la plataforma (activas e inactivas).<br>' +
        'Incluye título, choices y successMessages en <strong>es-es</strong>.' +
      '</div>' +
      '<div id="kcm-q-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +
      '<div id="kcm-q-progress" style="display:none;margin-bottom:12px;">' +
        '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px;">' +
          '<div id="kcm-q-bar" style="height:100%;background:#1e293b;width:0%;transition:width .3s;"></div>' +
        '</div>' +
        '<div id="kcm-q-progress-text" style="font-size:12px;color:#64748b;text-align:center;"></div>' +
      '</div>' +
      '<button id="kcm-q-run" style="width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Descargar Excel de preguntas</button>' +
      '<div id="kcm-q-summary" style="display:none;background:#f0fff4;border:1px solid #9ae6b4;border-radius:8px;padding:12px;font-size:13px;color:#276749;"></div>';

    function setStatus(msg, type) {
      var el = document.getElementById('kcm-q-status');
      if (!el) return;
      var s = {err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;', ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;', info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'};
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;' + (s[type]||s.info);
      el.innerHTML = msg;
    }

    document.getElementById('kcm-q-run').onclick = async function() {
      var btn = document.getElementById('kcm-q-run');
      btn.disabled = true; btn.textContent = '⏳ Cargando...';
      document.getElementById('kcm-q-progress').style.display = 'block';
      document.getElementById('kcm-q-summary').style.display = 'none';
      setStatus('Cargando mapas de referencia...', 'info');

      try {
        var refMaps = await fetchReferenceMaps();
        setStatus('Cargando preguntas...', 'info');

        var questions = await fetchAllQuestions(function(count, tipo) {
          var bar = document.getElementById('kcm-q-bar');
          var txt = document.getElementById('kcm-q-progress-text');
          if (bar) bar.style.width = Math.min(count / 20, 90) + '%';
          if (txt) txt.textContent = count + ' preguntas cargadas (' + tipo + ')...';
        });

        if (!questions.length) throw new Error('No se encontraron preguntas.');

        document.getElementById('kcm-q-bar').style.width = '100%';
        document.getElementById('kcm-q-progress-text').textContent = 'Total: ' + questions.length + '. Generando Excel...';
        setStatus('Generando Excel...', 'info');

        await kcm.loadXlsx();
        exportExcel(questions, refMaps);

        document.getElementById('kcm-q-progress').style.display = 'none';
        setStatus('&#10003; Excel descargado. ' + questions.length + ' preguntas exportadas.', 'ok');

        var activas = questions.filter(function(q){ return q.isActive; }).length;
        var sumEl = document.getElementById('kcm-q-summary');
        sumEl.style.display = 'block';
        sumEl.innerHTML = '<strong>&#10003; Exportación completada</strong><br>Total: <strong>' + questions.length + '</strong> &nbsp;|&nbsp; Activas: <strong>' + activas + '</strong> &nbsp;|&nbsp; Inactivas: <strong>' + (questions.length - activas) + '</strong>';
        kcm.showToast('Excel descargado — ' + questions.length + ' preguntas', 'ok');

      } catch(e) {
        document.getElementById('kcm-q-progress').style.display = 'none';
        setStatus('&#10007; Error: ' + kcm.escHtml(e.message), 'err');
        kcm.showToast('Error: ' + e.message, 'err');
      }

      btn.disabled = false; btn.textContent = '▶ Descargar Excel de preguntas';
    };
  }

  // ── Registrar módulo ──────────────────────────────────────────────────────────

  KCM.registerModule({
    key:     'questions_listado',
    label:   'Listado de preguntas',
    group:   'preguntas',
    icon:    '&#10067;',
    order:   10,
    version: MOD_VERSION,
    render:  render
  });

})();
