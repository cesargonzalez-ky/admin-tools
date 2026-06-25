(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  // IDs de tags de empresa/departamento a ignorar (family != "3" o ids específicos)
  var IGNORE_TAG_IDS = [9, 10]; // company-level tags
  var IGNORE_FAMILY = ['2']; // departamento

  function renderGui(container, tools) {
    var esc = tools.escHtml;
    var setStatus = tools.setStatus;
    var axios = document.querySelector('#app').__vue_app__.config.globalProperties.$axios;
    var store = document.querySelector('#app').__vue_app__.config.globalProperties.$store.state;
    var cid = store.Admin && store.Admin.companySelected && store.Admin.companySelected.stakeholderId;

    if (!cid) {
      container.innerHTML = '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">No hay empresa seleccionada. Pulsa ↻ Actualizar empresa.</div>';
      return;
    }

    container.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b">&#8987; Cargando tags y usuarios...</div>';

    var state = { tags: [], users: [], tagValues: {} };

    // ── Cargar tags y usuarios en paralelo ───────────────────────────────────
    Promise.all([
      axios.get('admin/stakeholders/tags/' + cid),
      axios.get('admin/stakeholders/companies/' + cid + '/people', { params: { email: true, login: true } })
    ]).then(function(results) {
      var allTags = results[0].data.records || [];
      var allUsers = results[1].data.records || [];

      // Filtrar solo tags de usuario
      state.tags = allTags.filter(function(t) {
        return IGNORE_FAMILY.indexOf(t.family) < 0 && IGNORE_TAG_IDS.indexOf(t.id) < 0;
      });
      state.users = allUsers;

      // Construir mapa tagId -> valores existentes
      state.tags.forEach(function(t) {
        state.tagValues[t.id] = (t.values || []).map(function(v) { return v.value; });
      });

      renderPanel();
    }).catch(function(e) {
      container.innerHTML = '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">&#10007; Error cargando datos: ' + esc(e.message) + '</div>';
    });

    function renderPanel() {
      var tagsForSelect = state.tags.map(function(t) {
        return '<option value="' + t.id + '">' + esc(t.name) + (t.attributes && t.attributes.multivalue ? ' (multivalor)' : '') + '</option>';
      }).join('');

      container.innerHTML = [
        // Sección descarga
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px">',
        '  <div style="display:flex;justify-content:space-between;align-items:center">',
        '    <div>',
        '      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Exportar TAGs actuales</div>',
        '      <div style="font-size:12px;color:#94a3b8;margin-top:2px">' + state.users.length + ' usuarios · ' + state.tags.length + ' tags de usuario</div>',
        '    </div>',
        '    <button id="kym-tag-download" style="background:#0369a1;color:white;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">&#11015; Descargar Excel</button>',
        '  </div>',
        '</div>',

        // Sección subir usuarios
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px">',
        '  <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Usuarios a modificar</div>',
        '  <div id="kym-tag-dropzone" style="border:2px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;cursor:pointer;background:white;transition:background .2s">',
        '    <div style="font-size:28px;margin-bottom:6px">&#128196;</div>',
        '    <div style="font-size:13px;color:#64748b"><span style="color:#0369a1;font-weight:600">Arrastra un fichero</span> o haz clic</div>',
        '    <div style="font-size:11px;color:#94a3b8;margin-top:4px">Excel/CSV/TXT con columna <strong>email</strong></div>',
        '    <input id="kym-tag-file" type="file" accept=".xlsx,.xls,.csv,.txt" style="display:none">',
        '  </div>',
        '  <div id="kym-tag-file-info" style="display:none;margin-top:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;font-size:12px;color:#1e40af"></div>',
        '</div>',

        // Sección operación
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px">',
        '  <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Operación</div>',

        // Switch añadir/eliminar
        '  <div style="display:flex;gap:8px;margin-bottom:14px">',
        '    <button id="kym-tag-op-add" style="flex:1;padding:9px;border-radius:8px;border:2px solid #1e293b;background:#1e293b;color:white;font-size:13px;font-weight:700;cursor:pointer">&#43; Añadir TAG</button>',
        '    <button id="kym-tag-op-del" style="flex:1;padding:9px;border-radius:8px;border:2px solid #e2e8f0;background:white;color:#64748b;font-size:13px;font-weight:600;cursor:pointer">&#8722; Eliminar TAG</button>',
        '  </div>',

        // Selección de TAG
        '  <div style="margin-bottom:12px">',
        '    <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px">TAG A MODIFICAR</label>',
        '    <select id="kym-tag-select" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;background:white">',
        '      <option value="">-- Selecciona un TAG --</option>',
        tagsForSelect,
        '    </select>',
        '  </div>',

        // Valor (solo visible para añadir)
        '  <div id="kym-tag-value-section" style="margin-bottom:12px">',
        '    <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:5px">VALOR DEL TAG</label>',
        '    <select id="kym-tag-value-select" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;background:white;margin-bottom:8px">',
        '      <option value="">-- Selecciona o escribe un valor --</option>',
        '    </select>',
        '    <input id="kym-tag-value-new" type="text" placeholder="Nuevo valor..." style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;display:none">',
        '  </div>',
        '</div>',

        // Confirmación y botón
        '<div id="kym-tag-status" style="display:none;margin-bottom:10px"></div>',
        '<button id="kym-tag-execute" style="width:100%;background:#1e293b;color:white;border:none;padding:10px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;display:none">MODIFICAR TAGS</button>',
        '<div id="kym-tag-log" style="display:none;margin-top:12px;background:#0f172a;border-radius:8px;padding:12px;font-size:11px;font-family:Menlo,Consolas,monospace;color:#94a3b8;max-height:200px;overflow-y:auto"></div>'
      ].join('');

      // ── Estado de la UI ──────────────────────────────────────────────────────
      var opMode = 'add'; // 'add' | 'del'
      var targetEmails = []; // emails subidos por el usuario

      function log(msg) {
        var el = document.getElementById('kym-tag-log');
        if (!el) return;
        el.style.display = 'block';
        var line = document.createElement('div');
        line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        el.appendChild(line);
        el.scrollTop = el.scrollHeight;
      }

      function updateConfirmBox() {
        var tagId = document.getElementById('kym-tag-select').value;
        var tagObj = state.tags.find(function(t) { return String(t.id) === String(tagId); });
        var tagName = tagObj ? tagObj.name : '';
        var valueEl = document.getElementById('kym-tag-value-new');
        var valueSelEl = document.getElementById('kym-tag-value-select');
        var value = (valueEl && valueEl.style.display !== 'none') ? valueEl.value.trim() : (valueSelEl ? valueSelEl.value : '');
        var count = targetEmails.length || state.users.length;
        var btn = document.getElementById('kym-tag-execute');

        if (!tagName || (opMode === 'add' && !value) || (opMode === 'del' && !value)) {
          if (btn) btn.style.display = 'none';
          return;
        }

        if (btn) btn.style.display = 'block';
      }

      // Switch añadir/eliminar
      document.getElementById('kym-tag-op-add').onclick = function() {
        opMode = 'add';
        this.style.background = '#1e293b'; this.style.color = 'white'; this.style.borderColor = '#1e293b';
        var del = document.getElementById('kym-tag-op-del');
        del.style.background = 'white'; del.style.color = '#64748b'; del.style.borderColor = '#e2e8f0';
        document.getElementById('kym-tag-value-section').style.display = 'block';
        updateConfirmBox();
      };
      document.getElementById('kym-tag-op-del').onclick = function() {
        opMode = 'del';
        this.style.background = '#1e293b'; this.style.color = 'white'; this.style.borderColor = '#1e293b';
        var add = document.getElementById('kym-tag-op-add');
        add.style.background = 'white'; add.style.color = '#64748b'; add.style.borderColor = '#e2e8f0';
        document.getElementById('kym-tag-value-section').style.display = 'block';
        // En eliminar ocultar el input de nuevo valor
        document.getElementById('kym-tag-value-new').style.display = 'none';
        updateConfirmBox();
      };

      // Cambio de TAG seleccionado → actualizar valores disponibles
      document.getElementById('kym-tag-select').onchange = function() {
        var tagId = this.value;
        var tagObj = state.tags.find(function(t) { return String(t.id) === String(tagId); });
        var valSel = document.getElementById('kym-tag-value-select');
        var valNew = document.getElementById('kym-tag-value-new');
        valSel.innerHTML = '<option value="">-- Selecciona un valor --</option>';
        if (tagObj) {
          (tagObj.values || []).forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v.value; opt.textContent = v.value;
            valSel.appendChild(opt);
          });
          if (opMode === 'add') {
            // Opción "Nuevo valor"
            var newOpt = document.createElement('option');
            newOpt.value = '__new__'; newOpt.textContent = '+ Nuevo valor...';
            valSel.appendChild(newOpt);
          }
        }
        valNew.style.display = 'none';
        valNew.value = '';
        updateConfirmBox();
      };

      // Cambio de valor seleccionado
      document.getElementById('kym-tag-value-select').onchange = function() {
        var valNew = document.getElementById('kym-tag-value-new');
        if (this.value === '__new__') {
          valNew.style.display = 'block';
          valNew.focus();
        } else {
          valNew.style.display = 'none';
        }
        updateConfirmBox();
      };
      document.getElementById('kym-tag-value-new').oninput = updateConfirmBox;

      // ── Dropzone / File picker ───────────────────────────────────────────────
      var dropzone = document.getElementById('kym-tag-dropzone');
      var fileInput = document.getElementById('kym-tag-file');

      dropzone.onclick = function() { fileInput.click(); };
      dropzone.ondragover = function(e) { e.preventDefault(); dropzone.style.background = '#eff6ff'; };
      dropzone.ondragleave = function() { dropzone.style.background = 'white'; };
      dropzone.ondrop = function(e) {
        e.preventDefault(); dropzone.style.background = 'white';
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = function() { if (this.files[0]) processFile(this.files[0]); };

      function parseEmails(rows, headers) {
        var emails = [];
        var emailIdx = -1;
        // Buscar columna email
        headers.forEach(function(h, i) {
          if ((h||'').toString().toLowerCase().trim() === 'email') emailIdx = i;
        });
        if (emailIdx < 0) emailIdx = 0;
        rows.forEach(function(row) {
          var val = (row[emailIdx] || row[headers[emailIdx]] || '').toString().trim().toLowerCase();
          if (val && val.includes('@')) emails.push(val);
        });
        return emails;
      }

      function applyEmailsResult(file, emails) {
        var matched = state.users.filter(function(u) {
          return emails.indexOf((u.email||'').toLowerCase()) >= 0 ||
                 emails.indexOf((u.login||'').toLowerCase()) >= 0;
        });
        targetEmails = matched.map(function(u){ return (u.email||'').toLowerCase(); });
        var info = document.getElementById('kym-tag-file-info');
        info.style.display = 'block';
        info.innerHTML = '&#10003; <strong>' + file.name + '</strong>: ' + emails.length + ' emails leídos &rarr; <strong>' + matched.length + '</strong> usuarios encontrados en esta empresa';
        updateConfirmBox();
      }

      function processFile(file) {
        var isXlsx = /\.xlsx?$/i.test(file.name);

        function doWithXLSX() {
          var reader = new FileReader();
          reader.onload = function(e) {
            try {
              var wb = window.XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
              var ws = wb.Sheets[wb.SheetNames[0]];
              var rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
              if (!rows.length) { applyEmailsResult(file, []); return; }
              var headers = rows[0];
              applyEmailsResult(file, parseEmails(rows.slice(1), headers));
            } catch(err) {
              var info = document.getElementById('kym-tag-file-info');
              info.style.display = 'block';
              info.textContent = '\u26a0 Error leyendo Excel: ' + err.message;
            }
          };
          reader.readAsArrayBuffer(file);
        }

        function doAsText() {
          var reader = new FileReader();
          reader.onload = function(e) {
            var lines = e.target.result.split(/\r?\n/).filter(function(l){ return l.trim(); });
            if (!lines.length) { applyEmailsResult(file, []); return; }
            var headers = lines[0].split(/[,;\t]/);
            var rows = lines.slice(1).map(function(l){ return l.split(/[,;\t]/).map(function(c){ return c.replace(/^["']|["']$/g,''); }); });
            applyEmailsResult(file, parseEmails(rows, headers));
          };
          reader.readAsText(file);
        }

        if (isXlsx) {
          if (window.XLSX) {
            doWithXLSX();
          } else {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            s.onload = doWithXLSX;
            s.onerror = function() {
              var info = document.getElementById('kym-tag-file-info');
              info.style.display = 'block';
              info.textContent = '\u26a0 No se pudo cargar SheetJS. Usa CSV/TXT.';
            };
            document.head.appendChild(s);
          }
        } else {
          doAsText();
        }
      }

      // ── Descarga Excel de tags actuales ──────────────────────────────────────
      document.getElementById('kym-tag-download').onclick = async function() {
        var btn = this;
        btn.textContent = '⌛ Generando...';
        btn.disabled = true;
        try {
          // Cargar tags de todos los usuarios en lotes de 10
          var users = state.users;
          var allUserTags = [];
          for (var i = 0; i < users.length; i += 10) {
            var batch = users.slice(i, i + 10);
            var results = await Promise.all(batch.map(function(u) {
              return axios.get('admin/stakeholders/people/' + u.stakeholderId, { params: { tags: true, email: true } })
                .then(function(r) { return { user: u, tags: r.data.records && r.data.records.tags || {} }; })
                .catch(function() { return { user: u, tags: {} }; });
            }));
            allUserTags = allUserTags.concat(results);
          }
          downloadTagsExcel(allUserTags);
          btn.textContent = '&#10003; Descargado';
          setTimeout(function(){ btn.textContent = '&#11015; Descargar Excel'; btn.disabled = false; }, 2000);
        } catch(e) {
          btn.textContent = '&#11015; Descargar Excel';
          btn.disabled = false;
          alert('Error: ' + e.message);
        }
      };

      function downloadTagsExcel(allUserTags) {
        var tagMap = {};
        state.tags.forEach(function(t) { tagMap[t.id] = t.name; });

        // Agrupar filas por tagId
        var sheets = {};
        allUserTags.forEach(function(item) {
          var email = item.user.email || item.user.login || '';
          var tags = item.tags || {};
          Object.keys(tags).forEach(function(tagId) {
            if (!tagMap[tagId]) return; // ignorar tags no conocidos
            var tagName = tagMap[tagId];
            if (!sheets[tagName]) sheets[tagName] = [['email', tagName]];
            var values = Array.isArray(tags[tagId]) ? tags[tagId] : [tags[tagId]];
            values.forEach(function(v) { sheets[tagName].push([email, v]); });
          });
        });

        if (Object.keys(sheets).length === 0) {
          alert('No hay datos de tags para exportar.');
          return;
        }

        function buildXlsx() {
          var wb = window.XLSX.utils.book_new();
          Object.keys(sheets).forEach(function(sheetName) {
            var ws = window.XLSX.utils.aoa_to_sheet(sheets[sheetName]);
            // Ajustar ancho de columnas
            ws['!cols'] = [{wch: 40}, {wch: 30}];
            window.XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
          });
          window.XLSX.writeFile(wb, 'kymatio_tags_' + new Date().toISOString().slice(0,10) + '.xlsx');
        }

        // Cargar SheetJS dinámicamente si no está disponible
        if (window.XLSX) {
          buildXlsx();
        } else {
          var script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          script.onload = function() { buildXlsx(); };
          script.onerror = function() { alert('No se pudo cargar SheetJS para generar el Excel.'); };
          document.head.appendChild(script);
        }
      }

      // ── Ejecutar modificación de tags ────────────────────────────────────────
      document.getElementById('kym-tag-execute').onclick = function() {
        var tagId = document.getElementById('kym-tag-select').value;
        var tagObj = state.tags.find(function(t) { return String(t.id) === String(tagId); });
        var valueSelEl = document.getElementById('kym-tag-value-select');
        var valueNewEl = document.getElementById('kym-tag-value-new');
        var value = (valueNewEl && valueNewEl.style.display !== 'none') ? valueNewEl.value.trim() : (valueSelEl ? valueSelEl.value : '');

        if (!tagId || !value || value === '__new__') return;

        var usersCount = (targetEmails.length > 0
          ? state.users.filter(function(u){ return targetEmails.indexOf((u.email||'').toLowerCase()) >= 0; })
          : state.users).length;

        // Modal de confirmación
        var action = opMode === 'add' ? '<strong>añadir</strong>' : '<strong>eliminar</strong>';
        var msg = 'Se va a ' + action + ' el TAG <strong>' + esc(tagObj ? tagObj.name : tagId) + '</strong> con valor <strong>' + esc(value) + '</strong> para <strong>' + usersCount + '</strong> usuarios. ¿Quieres proceder?';

        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center';
        var box = document.createElement('div');
        box.style.cssText = 'background:white;border-radius:12px;padding:28px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
        box.innerHTML = '<div style="font-size:15px;font-weight:700;color:#1a202c;margin-bottom:14px">Confirmar operación</div>' +
          '<div style="font-size:14px;color:#475569;line-height:1.6;margin-bottom:24px">' + msg + '</div>' +
          '<div style="display:flex;gap:10px">' +
          '<button id="kym-tag-modal-cancel" style="flex:1;padding:10px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>' +
          '<button id="kym-tag-modal-confirm" style="flex:1;padding:10px;background:#1e293b;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Proceder</button>' +
          '</div>';
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        document.getElementById('kym-tag-modal-cancel').onclick = function() { overlay.remove(); };
        document.getElementById('kym-tag-modal-confirm').onclick = function() {
          overlay.remove();
          doExecute(tagId, tagObj, value);
        };
      };

      async function doExecute(tagId, tagObj, value) {
        var usersToProcess = targetEmails.length > 0
          ? state.users.filter(function(u){ return targetEmails.indexOf((u.email||'').toLowerCase()) >= 0; })
          : state.users;

        var statusEl = document.getElementById('kym-tag-status');
        var logEl = document.getElementById('kym-tag-log');
        logEl.style.display = 'block'; logEl.innerHTML = '';

        var ok = 0, err = 0;
        var total = usersToProcess.length;
        var isMulti = tagObj && tagObj.attributes && tagObj.attributes.multivalue;

        setStatus(statusEl, '&#8987; Procesando 0 / ' + total + ' usuarios...', 'info');

        for (var i = 0; i < usersToProcess.length; i += 5) {
          var batch = usersToProcess.slice(i, i + 5);
          await Promise.all(batch.map(async function(user) {
            try {
              // 1. Obtener datos completos del usuario
              var r = await axios.get('admin/stakeholders/people/' + user.stakeholderId, {
                params: { tags: true, email: true, login: true, stakeholderDepartmentId: true,
                          profiles: true, environment: true, isBoss: true, authentication: true,
                          phoneNumber: true }
              });
              var u = r.data.records;
              var currentTags = u.tags || {};

              // 2. Modificar tags
              var newTags = JSON.parse(JSON.stringify(currentTags));
              if (opMode === 'add') {
                if (isMulti) {
                  // Multivalor: añadir si no existe
                  if (!newTags[tagId]) newTags[tagId] = [];
                  if (newTags[tagId].indexOf(value) < 0) newTags[tagId].push(value);
                } else {
                  // Monovalor: sustituir
                  newTags[tagId] = [value];
                }
              } else {
                // Eliminar valor específico
                if (newTags[tagId]) {
                  newTags[tagId] = newTags[tagId].filter(function(v){ return v !== value; });
                  // Si es el último valor, enviar [""] para que la API lo elimine
                  if (newTags[tagId].length === 0) newTags[tagId] = [''];
                }
              }

              // 3. Construir payload completo
              var payload = {
                name: u.name, surname: u.surname, isBoss: u.isBoss,
                email: u.email, login: u.login,
                stakeholderCompanyId: String(cid),
                environment: u.environment || {},
                authentication: u.authentication,
                tags: newTags,
                stakeholderDepartmentId: u.stakeholderDepartmentId,
                profiles: u.profiles || {}
              };
              if (u.phoneNumber) payload.phoneNumber = u.phoneNumber;

              // 4. PUT
              await axios.put('admin/stakeholders/people/' + user.stakeholderId, payload);
              ok++;
              log('✓ ' + (u.email || user.stakeholderId));
            } catch(e) {
              err++;
              log('✗ ' + (user.email || user.stakeholderId) + ': ' + e.message);
            }
          }));
          setStatus(statusEl, '&#8987; Procesando ' + Math.min(i + 5, total) + ' / ' + total + ' usuarios...', 'info');
        }

        setStatus(statusEl, '&#10003; Completado: ' + ok + ' OK · ' + err + ' errores', ok > 0 ? 'ok' : 'err');
        log('Fin: ' + ok + ' OK, ' + err + ' errores');
      };
    } // end renderPanel
  }

  KAT.registerModule({
    key: 'tag_manager',
    label: 'Gestión de TAGs',
    icon: '&#127991;',
    group: 'bulk',
    order: 95,
    renderGui: renderGui,
    getJson: function() { return {}; }
  });

})();
