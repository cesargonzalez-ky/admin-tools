(function () {
  'use strict';

  var MOD_VERSION = 'session-analysis-v2';

  if (!window.KymatioAdminTools) { console.error('KAT no cargado'); return; }
  var KAT = window.KymatioAdminTools;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function apiHeaders() {
    var token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  }

  async function apiCall(path) {
    var res = await fetch('https://api.kymatio.com/v2/' + path, { headers: apiHeaders() });
    var d = await res.json();
    if (!res.ok) throw new Error((d && d.message) || 'HTTP ' + res.status);
    return d.records || d;
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

  function decodeHtml(s) {
    return (s || '')
      .replace(/&oacute;/g,'ó').replace(/&aacute;/g,'á').replace(/&eacute;/g,'é')
      .replace(/&iacute;/g,'í').replace(/&uacute;/g,'ú').replace(/&ntilde;/g,'ñ')
      .replace(/&Aacute;/g,'Á').replace(/&Ntilde;/g,'Ñ').replace(/&Iacute;/g,'Í')
      .replace(/&Eacute;/g,'É').replace(/&Oacute;/g,'Ó').replace(/&Uacute;/g,'Ú')
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  }

  var STATUS_EMOJI = {
    'FINISH':      '✅ Completada',
    'PROGRESS':    '⏳ En curso',
    'AVAILABLE':   '⏳ Disponible',
    'UNAVAILABLE': '⏳ Programada'
  };

  function estadoLabel(session) {
    if (!session) return '❌ No asignada';
    return STATUS_EMOJI[session.surveyStatus] || session.surveyStatus;
  }

  function isCompletada(session) {
    return session && (session.surveyStatus === 'FINISH' || session.surveyStatus === 'PROGRESS');
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function renderGui(container, kat) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:11px;color:#94a3b8;">v: ' + kat.escHtml(MOD_VERSION) + '</span>' +
      '</div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:14px;font-size:13px;color:#0369a1;line-height:1.7">' +
        'Analiza el estado de sesiones para todos los usuarios de la <strong>empresa activa</strong>.<br>' +
        'El texto de cada sesión se usa como nombre de columna y como búsqueda parcial.' +
      '</div>' +
      '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">Sesiones a analizar <span style="font-weight:400;color:#94a3b8;">(una por fila)</span></label>' +
        '<div id="kat-sa-sessions-list"></div>' +
        '<button id="kat-sa-add-session" style="margin-top:6px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer;color:#475569;">+ Añadir sesión</button>' +
      '</div>' +
      '<button id="kat-sa-run" style="width:100%;background:#1e293b;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px;">&#9654; Analizar sesiones</button>' +
      '<div id="kat-sa-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>' +
      '<div id="kat-sa-progress" style="display:none;margin-bottom:8px;">' +
        '<div style="height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:6px;">' +
          '<div id="kat-sa-bar" style="height:100%;background:#1e293b;width:0%;transition:width .2s;"></div>' +
        '</div>' +
        '<div id="kat-sa-progress-text" style="font-size:12px;color:#64748b;text-align:center;margin-bottom:6px;"></div>' +
      '</div>' +
      '<div id="kat-sa-console" style="display:none;background:#0f172a;border-radius:8px;padding:12px;font-size:11px;font-family:Menlo,Consolas,monospace;height:180px;overflow-y:auto;margin-bottom:12px;"></div>';

    // ── Gestión de sesiones ───────────────────────────────────────────────────
    var sessionNames = ['Bienvenid@ a Kymatio', 'Sesión 1 - Ingeniería Social'];

    function renderSessions() {
      var list = document.getElementById('kat-sa-sessions-list');
      if (!list) return;
      list.innerHTML = '';
      sessionNames.forEach(function (name, idx) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
        var input = document.createElement('input');
        input.type = 'text'; input.value = name;
        input.style.cssText = 'flex:1;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;';
        input.oninput = function () { sessionNames[idx] = this.value; };
        var del = document.createElement('button');
        del.textContent = '✕';
        del.style.cssText = 'background:#fee2e2;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;color:#991b1b;font-size:12px;';
        del.onclick = function () { sessionNames.splice(idx, 1); renderSessions(); };
        row.appendChild(input); row.appendChild(del);
        list.appendChild(row);
      });
    }

    renderSessions();

    document.getElementById('kat-sa-add-session').onclick = function () {
      sessionNames.push('');
      renderSessions();
      var inputs = document.querySelectorAll('#kat-sa-sessions-list input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    };

    // ── Helpers UI ────────────────────────────────────────────────────────────
    function setStatus(msg, type) {
      var el = document.getElementById('kat-sa-status');
      if (!el) return;
      var s = { err:'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;', ok:'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;', info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;' };
      el.style.cssText = 'display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;' + (s[type]||s.info);
      el.innerHTML = msg;
    }

    function setProgress(pct, text) {
      var bar = document.getElementById('kat-sa-bar');
      var txt = document.getElementById('kat-sa-progress-text');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = text;
    }

    function addLog(msg, type) {
      var el = document.getElementById('kat-sa-console');
      if (!el) return;
      var line = document.createElement('div');
      line.style.cssText = 'padding:1px 0;' + (type==='ok'?'color:#4ade80;':type==='err'?'color:#f87171;':type==='warn'?'color:#fbbf24;':'color:#94a3b8;');
      line.textContent = (type==='ok'?'✓ ':type==='err'?'✗ ':type==='warn'?'⚠ ':'· ') + msg;
      el.appendChild(line);
      el.scrollTop = el.scrollHeight;
    }

    // ── Proceso principal ─────────────────────────────────────────────────────
    document.getElementById('kat-sa-run').onclick = async function () {
      var cid   = kat.state.companyId;
      var cname = kat.state.companyName || 'empresa activa';
      if (!cid) { setStatus('&#10007; No hay empresa activa. Pulsa ↻ Actualizar empresa.', 'err'); return; }

      var names = sessionNames.map(function(n){ return n.trim(); }).filter(Boolean);
      if (!names.length) { setStatus('&#10007; Añade al menos una sesión a analizar.', 'err'); return; }

      var btn = document.getElementById('kat-sa-run');
      btn.disabled = true; btn.textContent = '⏳ Analizando...';
      document.getElementById('kat-sa-progress').style.display = 'block';
      document.getElementById('kat-sa-console').style.display = 'block';
      document.getElementById('kat-sa-console').innerHTML = '';

      setStatus('Cargando datos de ' + kat.escHtml(cname) + '...', 'info');
      addLog('Empresa: ' + cname + ' (ID: ' + cid + ')', 'info');

      try {
        // 1. Cargar departamentos → mapa id → nombre
        addLog('Cargando departamentos...', 'info');
        var deptData = await apiCall('admin/stakeholders/companies/' + cid + '/departments');
        var depts = Array.isArray(deptData) ? deptData : (deptData.records || []);
        var deptMap = {};
        depts.forEach(function(d){ deptMap[d.stakeholderId] = d.name; });
        addLog(depts.length + ' departamentos cargados.', 'info');

        // 2. Cargar usuarios
        addLog('Cargando usuarios...', 'info');
        var usersData = await apiCall('admin/stakeholders/companies/' + cid + '/people?limit=5000&page=1');
        var users = Array.isArray(usersData) ? usersData : (usersData.records || usersData);
        if (!users || !users.length) throw new Error('No se encontraron usuarios en la empresa.');
        addLog(users.length + ' usuarios cargados.', 'info');

        // 3. Sondear al primer usuario para verificar nombres de sesión
        var sampleData = await apiCall('controller/traits/' + users[0].stakeholderId + '/interactions?dummies=false');
        var sampleSessions = Array.isArray(sampleData) ? sampleData : (sampleData.records || []);
        var sampleNames = sampleSessions.map(function(s){ return decodeHtml(s.surveyName); });
        names.forEach(function(name) {
          var found = sampleNames.find(function(sn){ return sn.includes(name); });
          if (found) addLog('Sesión "' + name + '" → encontrada como "' + found + '"', 'ok');
          else       addLog('Sesión "' + name + '" → no encontrada en el primer usuario', 'warn');
        });

        setStatus('Analizando ' + users.length + ' usuarios...', 'info');

        // 4. Procesar cada usuario
        var results = [];
        for (var i = 0; i < users.length; i++) {
          var user = users[i];
          setProgress(Math.round((i / users.length) * 100), (i+1) + ' / ' + users.length + ' — ' + (user.name || user.email || user.stakeholderId));

          // Resolver nombre de departamento
          var deptId   = user.stakeholderDepartmentId || user.departmentId || user.department;
          var deptName = (deptId && deptMap[deptId]) || '';

          try {
            var interData = await apiCall('controller/traits/' + user.stakeholderId + '/interactions?dummies=false');
            var interactions = Array.isArray(interData) ? interData : (interData.records || []);

            var row = {
              'Nombre':       (user.name || '').trim(),
              'Email':        user.email || '',
              'Departamento': deptName
            };

            names.forEach(function(name) {
              var session = interactions.find(function(s){ return decodeHtml(s.surveyName).includes(name); });
              row[name]             = estadoLabel(session);
              row['Fecha: ' + name] = (session && session.questionDate) ? session.questionDate.slice(0,10) : '';
            });

            results.push(row);

            if (isCompletada(interactions.find(function(s){ return decodeHtml(s.surveyName).includes(names[0]); }))) {
              addLog((user.name||user.email||user.stakeholderId), 'ok');
            }

          } catch (e) {
            addLog('Error usuario ' + (user.email||user.stakeholderId) + ': ' + e.message, 'err');
            var errRow = { 'Nombre': (user.name||'').trim(), 'Email': user.email||'', 'Departamento': deptName };
            names.forEach(function(name){ errRow[name] = 'Error'; errRow['Fecha: '+name] = ''; });
            results.push(errRow);
          }

          await new Promise(function(r){ setTimeout(r, 150); });
        }

        setProgress(100, 'Completado. Generando Excel...');

        // Log resumen
        names.forEach(function(name) {
          var completadas = results.filter(function(r){ return r[name] === '✅ Completada' || r[name] === '⏳ En curso'; }).length;
          addLog('"' + name + '": ' + completadas + '/' + results.length + ' completadas', completadas > 0 ? 'ok' : 'warn');
        });

        // 5. Generar Excel
        await loadXlsx();
        var wb = window.XLSX.utils.book_new();

        // Hoja "Todos" — ordenada alfabéticamente por nombre
        results.sort(function(a,b){ return (a['Nombre']||'').localeCompare(b['Nombre']||''); });
        var ws1 = window.XLSX.utils.json_to_sheet(results);
        var cols1 = Object.keys(results[0]||{});
        ws1['!cols'] = cols1.map(function(col){
          var max = col.length;
          results.forEach(function(r){ var v=String(r[col]||''); if(v.length>max) max=v.length; });
          return {wch: Math.min(max+2, 50)};
        });
        window.XLSX.utils.book_append_sheet(wb, ws1, 'Todos');

        // Hoja "Resumen"
        var today = new Date();
        var fechaStr = today.getDate().toString().padStart(2,'0') + '/' + (today.getMonth()+1).toString().padStart(2,'0') + '/' + today.getFullYear();
        var summaryRows = [
          ['RESUMEN — ' + cname, ''],
          ['Fecha extracción', fechaStr],
          ['', ''],
          ['Total usuarios', results.length]
        ];
        names.forEach(function(name) {
          var completadas = results.filter(function(r){ return r[name]==='✅ Completada'||r[name]==='⏳ En curso'; }).length;
          var label = name.length > 30 ? name.slice(0,30)+'…' : name;
          summaryRows.push([label + ' completada', completadas]);
        });
        var ws2 = window.XLSX.utils.aoa_to_sheet(summaryRows);
        ws2['!cols'] = [{wch:40},{wch:14}];
        window.XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

        var fname = 'kymatio_sesiones_' + cname.replace(/[^a-zA-Z0-9]/g,'_').slice(0,30) + '_' + today.toISOString().slice(0,10) + '.xlsx';
        window.XLSX.writeFile(wb, fname);

        document.getElementById('kat-sa-progress').style.display = 'none';
        setStatus('&#10003; Análisis completado. ' + results.length + ' usuarios · Excel descargado.', 'ok');
        kat.showToast('Análisis completado — ' + results.length + ' usuarios', 'ok');

      } catch (e) {
        document.getElementById('kat-sa-progress').style.display = 'none';
        setStatus('&#10007; Error: ' + kat.escHtml(e.message), 'err');
        addLog('Error fatal: ' + e.message, 'err');
        kat.showToast('Error: ' + e.message, 'err');
      }

      btn.disabled = false;
      btn.textContent = '▶ Analizar sesiones';
    };
  }

  KAT.registerModule({
    key:          'session_analysis',
    label:        'Análisis sesiones Ciberzaintza',
    group:        'bulk',
    icon:         '&#128202;',
    order:        60,
    version:      MOD_VERSION,
    renderGui:    renderGui,
    forceGuiOnly: true
  });

})();
