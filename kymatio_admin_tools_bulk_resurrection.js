(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  function loadXlsx(cb) {
    if (window.XLSX) {
      cb();
      return;
    }

    var existing = document.querySelector('script[data-kym-xlsx="1"]');
    if (existing) {
      existing.addEventListener('load', cb);
      return;
    }

    var s = document.createElement('script');
    s.dataset.kymXlsx = '1';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = cb;
    s.onerror = function () {
      alert('No se pudo cargar la librería XLSX. Revisa la consola o la conexión.');
    };
    document.head.appendChild(s);
  }

  function renderGui(container, tools) {
    var $ = tools.$;
    var escHtml = tools.escHtml;

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando herramienta...</div>';

    loadXlsx(function () {
      buildPanel(container, tools, $, escHtml);
    });
  }

  function buildPanel(container, tools, $, escHtml) {
    var token = tools.state.token || localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    var companyId = tools.state.companyId || '';

    var deletedUsers = {};  // email.toLowerCase() -> user object
    var allUsers = [];      // deleted users sorted/listed
    var deptMap = {};       // departmentName.toLowerCase() -> stakeholderId
    var deptList = [];      // [{name, id}]
    var dataLoaded = false;
    var isPaused = false;
    var results = [];
    var bulkRows = [];
    var selectedUser = null;
    var selectedDept = null;

    function getCurrentCompanyFromVue() {
      try {
        var store = document.querySelector('#app').__vue_app__.config.globalProperties.$store.state;
        var company = store.Admin.companySelected || store.Controller.companySelected;
        return {
          id: String(company.stakeholderId || ''),
          name: company.name || ''
        };
      } catch (e) {
        return {
          id: companyId,
          name: tools.state.companyName || ''
        };
      }
    }

    function apiHeaders() {
      return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      };
    }

    function sleep(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms);
      });
    }

    function addLog(msg, type) {
      var el = $('kym-res-log');
      if (!el) return;

      el.style.display = 'block';
      var colors = { ok: '#34d399', err: '#f87171', info: '#60a5fa', warn: '#fbbf24' };
      var line = document.createElement('div');
      line.style.color = colors[type] || '#94a3b8';
      line.textContent = '[' + new Date().toLocaleTimeString('es-ES') + '] ' + msg;
      el.appendChild(line);
      el.scrollTop = el.scrollHeight;
    }

    function showStatus(elId, msg, type) {
      var el = $(elId);
      if (!el) return;

      var styles = {
        ok: 'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;',
        err: 'background:#fff5f5;border:1px solid #fed7d7;color:#c53030;',
        info: 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;'
      };

      el.style.cssText = 'display:block;margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;' + (styles[type] || styles.info);
      el.innerHTML = msg;
    }

    function updateBulkBtn() {
      var btn = $('kym-res-btn-bulk');
      if (!btn) return;

      var ok = dataLoaded && bulkRows.length > 0;
      btn.style.opacity = ok ? '1' : '.45';
      btn.style.cursor = ok ? 'pointer' : 'default';
    }

    function clearSingleSelection() {
      selectedUser = null;
      selectedDept = null;
      if ($('kym-res-user-search')) $('kym-res-user-search').value = '';
      if ($('kym-res-dept-search')) $('kym-res-dept-search').value = '';
      if ($('kym-res-user-selected')) $('kym-res-user-selected').style.display = 'none';
      if ($('kym-res-dept-selected')) $('kym-res-dept-selected').style.display = 'none';
      if ($('kym-res-dept-block')) $('kym-res-dept-block').style.display = 'none';
      if ($('kym-res-btn-single')) {
        $('kym-res-btn-single').disabled = true;
        $('kym-res-btn-single').style.opacity = '.45';
        $('kym-res-btn-single').style.cursor = 'not-allowed';
      }
    }

    async function loadData() {
      var current = getCurrentCompanyFromVue();
      companyId = current.id || companyId;
      tools.state.companyId = companyId;
      tools.state.companyName = current.name || tools.state.companyName;
      token = localStorage.getItem('token') || localStorage.getItem('access_token') || token;
      if (typeof tools.updateCompanyBanner === 'function') tools.updateCompanyBanner();

      var status = $('kym-res-load-status');
      if (status) status.innerHTML = '&#8987; Cargando usuarios eliminados y departamentos...';

      dataLoaded = false;
      deletedUsers = {};
      allUsers = [];
      deptMap = {};
      deptList = [];
      clearSingleSelection();
      if ($('kym-res-btn-export-deleted')) $('kym-res-btn-export-deleted').style.display = 'none';

      if (!companyId) {
        if (status) status.innerHTML = '<span style="color:#d97706">&#9888; Selecciona una empresa y pulsa “Actualizar empresa y datos” arriba.</span>';
        updateBulkBtn();
        return;
      }

      if (!token) {
        if (status) status.innerHTML = '<span style="color:#e53e3e">&#10007; No se ha encontrado token en localStorage.</span>';
        updateBulkBtn();
        return;
      }

      try {
        var r1 = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId) + '/people?login=true&email=true&allstatus=2', { headers: apiHeaders() });
        var d1 = await r1.json();
        if (!r1.ok) throw new Error((d1 && (d1.message || (d1.records && d1.records.devMessage))) || 'Error HTTP ' + r1.status);

        (d1.records || []).forEach(function (u) {
          if (u.email) {
            deletedUsers[String(u.email).toLowerCase()] = u;
            allUsers.push(u);
          }
        });

        allUsers.sort(function (a, b) {
          return String(a.email || '').localeCompare(String(b.email || ''));
        });

        var r2 = await fetch('https://api.kymatio.com/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId) + '/departments', { headers: apiHeaders() });
        var d2 = await r2.json();
        if (!r2.ok) throw new Error((d2 && (d2.message || (d2.records && d2.records.devMessage))) || 'Error HTTP ' + r2.status);

        (d2.records || []).forEach(function (d) {
          if (d.name) {
            var name = String(d.name).trim();
            deptMap[name.toLowerCase()] = d.stakeholderId;
            deptList.push({ name: name, id: d.stakeholderId });
          }
        });
        deptList.sort(function (a, b) { return a.name.localeCompare(b.name); });

        dataLoaded = true;
        if (status) status.innerHTML = '<span style="color:#38a169">&#10003; ' + allUsers.length + ' usuarios eliminados cargados &nbsp;|&nbsp; ' + deptList.length + ' departamentos</span>';
        if ($('kym-res-btn-export-deleted')) $('kym-res-btn-export-deleted').style.display = allUsers.length ? 'block' : 'none';
        updateBulkBtn();
      } catch (e) {
        if (status) status.innerHTML = '<span style="color:#e53e3e">&#10007; Error al cargar: ' + escHtml(e.message) + '</span>';
        updateBulkBtn();
      }
    }

    function makeDropdown(inputId, dropdownId, getItems, onSelect) {
      var input = $(inputId);
      var dropdown = $(dropdownId);
      var ignoreBlur = false;

      if (!input || !dropdown) return;

      input.addEventListener('input', function () {
        var q = this.value.toLowerCase().trim();
        var items = getItems(q).slice(0, 30);
        dropdown.innerHTML = '';

        if (!items.length) {
          dropdown.style.display = 'none';
          return;
        }

        items.forEach(function (item) {
          var el = document.createElement('div');
          el.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:12.5px;';
          el.innerHTML = item.label;
          el.onmousedown = function () { ignoreBlur = true; };
          el.onclick = function () {
            onSelect(item);
            dropdown.style.display = 'none';
            ignoreBlur = false;
          };
          el.onmouseover = function () { this.style.background = '#f5f3ff'; };
          el.onmouseout = function () { this.style.background = ''; };
          dropdown.appendChild(el);
        });

        dropdown.style.display = 'block';
      });

      input.addEventListener('focus', function () {
        if (this.value) this.dispatchEvent(new Event('input'));
      });

      input.addEventListener('blur', function () {
        if (!ignoreBlur) dropdown.style.display = 'none';
      });
    }

    async function resurrectOne(email, deptId, deptName) {
      var user = deletedUsers[String(email || '').toLowerCase()];
      if (!user) return { ok: false, msg: 'No encontrado entre eliminados' };

      if (!deptId && (!deptName || !String(deptName).trim())) {
        return { ok: false, msg: 'No se proporcionó departamento destino' };
      }

      if (!deptId) {
        return { ok: false, msg: 'Departamento no encontrado en la plataforma: "' + deptName + '"' };
      }

      var res = await fetch('https://api.kymatio.com/v2/admin/stakeholders/people/' + encodeURIComponent(user.stakeholderId), {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ stakeholderDepartmentId: deptId })
      });

      var rdata = null;
      try { rdata = await res.json(); } catch (e) {}

      if (res.ok || res.status === 200 || res.status === 201) {
        delete deletedUsers[String(email || '').toLowerCase()];
        allUsers = allUsers.filter(function (u) {
          return String(u.email || '').toLowerCase() !== String(email || '').toLowerCase();
        });
        return { ok: true, msg: 'OK (dpto: ' + (deptName || deptId) + ')' };
      }

      var rawMsg = (rdata && rdata.records && rdata.records.devMessage) || (rdata && rdata.message) || '';
      var msg = res.status === 400 ? 'Error 400 — Posiblemente ya existe un usuario activo con este email o login' : (rawMsg || 'Error ' + res.status);
      return { ok: false, msg: String(msg) };
    }

    function parseTextRows(text) {
      var lines = String(text || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
      if (!lines.length) return [];

      var first = lines[0].toLowerCase();
      var sep = first.indexOf(';') >= 0 ? ';' : (first.indexOf('\t') >= 0 ? '\t' : ',');
      var headers = lines[0].split(sep).map(function (h) { return h.trim().toLowerCase(); });
      var hasHeader = headers.indexOf('email') >= 0 || headers.some(function (h) { return h.indexOf('depart') >= 0; });

      var emailIdx = 0;
      var deptIdx = 1;
      if (hasHeader) {
        headers.forEach(function (h, idx) {
          if (h === 'email' || h.indexOf('correo') >= 0) emailIdx = idx;
          if (h === 'department' || h.indexOf('depart') >= 0) deptIdx = idx;
        });
      }

      return lines.slice(hasHeader ? 1 : 0).map(function (line) {
        var p = line.split(sep);
        return {
          email: String(p[emailIdx] || '').trim(),
          department: String(p[deptIdx] || '').trim()
        };
      }).filter(function (r) { return r.email; });
    }

    function buildHtml() {
      var h = '';

      h += '<div id="kym-res-load-status" style="font-size:12px;color:#64748b;margin-bottom:12px;padding:10px 12px;background:#f8fafc;border-radius:6px;min-height:34px;display:flex;align-items:center">Cargando datos...</div>';

      h += '<button id="kym-res-btn-export-deleted" style="display:none;width:100%;background:white;border:1px solid #ddd6fe;color:#5b21b6;padding:8px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:14px">&#8595; Descargar listado de usuarios eliminados</button>';

      h += '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#5b21b6;font-size:12px;line-height:1.5">';
      h += 'Restaura usuarios eliminados, de forma individual o masiva. En carga masiva se aceptan columnas <strong>email</strong> y <strong>Department</strong>.';
      h += '</div>';

      h += '<div style="display:flex;gap:8px;margin-bottom:14px">';
      h += '<button id="kym-res-mode-single" style="flex:1;padding:9px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;background:#7c3aed;color:white;border:none">&#128100; Usuario único</button>';
      h += '<button id="kym-res-mode-bulk" style="flex:1;padding:9px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0">&#128101; Carga masiva</button>';
      h += '</div>';

      h += '<div id="kym-res-single" style="display:block">';
      h += '<label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">USUARIO ELIMINADO</label>';
      h += '<div style="position:relative;margin-bottom:10px">';
      h += '<input id="kym-res-user-search" type="text" placeholder="Buscar por email o nombre..." style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;box-sizing:border-box" />';
      h += '<div id="kym-res-user-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.1);max-height:200px;overflow-y:auto;z-index:10"></div>';
      h += '</div>';
      h += '<div id="kym-res-user-selected" style="display:none;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;padding:8px 12px;font-size:12px;color:#5b21b6;margin-bottom:10px"></div>';

      h += '<div id="kym-res-dept-block" style="display:none">';
      h += '<label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">DEPARTAMENTO DESTINO</label>';
      h += '<div style="position:relative;margin-bottom:12px">';
      h += '<input id="kym-res-dept-search" type="text" placeholder="Buscar departamento..." style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;box-sizing:border-box" />';
      h += '<div id="kym-res-dept-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.1);max-height:200px;overflow-y:auto;z-index:10"></div>';
      h += '</div>';
      h += '<div id="kym-res-dept-selected" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;font-size:12px;color:#166534;margin-bottom:12px"></div>';
      h += '</div>';

      h += '<button id="kym-res-btn-single" disabled style="width:100%;background:#7c3aed;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:not-allowed;font-size:13px;opacity:.45">&#128137; Resucitar usuario</button>';
      h += '<div id="kym-res-single-status" style="display:none"></div>';
      h += '</div>';

      h += '<div id="kym-res-bulk" style="display:none">';
      h += '<div style="border:2px dashed #ddd6fe;border-radius:8px;padding:20px;text-align:center;position:relative;margin-bottom:8px">';
      h += '<input id="kym-res-file" type="file" accept=".xlsx,.xls,.csv,.txt" style="position:absolute;inset:0;opacity:0;cursor:pointer" />';
      h += '<div style="font-size:26px;margin-bottom:6px">&#128202;</div>';
      h += '<div style="color:#64748b;font-size:12px"><b style="color:#7c3aed">Arrastra el archivo</b> o haz clic<br><span style="font-size:11px">Excel, CSV o TXT &mdash; columnas: <b>email</b> (obligatorio), <b>Department</b> (opcional)</span></div>';
      h += '</div>';
      h += '<div id="kym-res-file-info" style="font-size:12px;color:#64748b;margin-bottom:12px;min-height:16px"></div>';

      h += '<div id="kym-res-progress" style="display:none;margin-bottom:12px">';
      h += '<div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;margin-bottom:6px">';
      h += '<div id="kym-res-bar" style="background:#7c3aed;height:100%;width:0%;transition:width .3s;border-radius:99px"></div></div>';
      h += '<div style="display:flex;gap:12px;font-size:12px;color:#64748b;flex-wrap:wrap">';
      h += '<span>Total: <b id="kym-res-done">0</b>/<b id="kym-res-total">0</b></span>';
      h += '<span style="color:#38a169;font-weight:600">&#10003; <span id="kym-res-ok">0</span></span>';
      h += '<span style="color:#e53e3e;font-weight:600">&#10007; <span id="kym-res-err">0</span></span>';
      h += '</div></div>';

      h += '<div style="display:flex;gap:8px;margin-bottom:10px">';
      h += '<button id="kym-res-btn-bulk" style="flex:1;background:#7c3aed;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:default;font-size:13px;opacity:.45">&#128137; Iniciar resurrección</button>';
      h += '<button id="kym-res-btn-pause" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#9646;&#9646; Pausar</button>';
      h += '<button id="kym-res-btn-export-results" style="display:none;background:white;border:1px solid #e2e8f0;color:#1a202c;padding:9px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">&#8595; Exportar</button>';
      h += '</div>';
      h += '<div id="kym-res-log" style="display:none;background:#0f172a;border-radius:8px;padding:12px;max-height:220px;overflow-y:auto;font-family:Menlo,Consolas,monospace;font-size:11px;color:#94a3b8"></div>';
      h += '<div id="kym-res-btn-refresh-end" style="display:none;margin-top:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;text-align:center">';
      h += '<div style="font-size:12px;color:#166534;margin-bottom:8px">&#10003; Proceso completado. Para ver los cambios pulsa aquí.</div>';
      h += '<button id="kym-res-refresh-action" style="background:#7c3aed;color:white;border:none;padding:8px 18px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#8635; Cerrar y refrescar</button>';
      h += '</div>';
      h += '</div>';

      return h;
    }

    container.innerHTML = buildHtml();

    $('kym-res-btn-export-deleted').onclick = function () {
      var rows = allUsers.map(function (u) {
        return {
          Nombre: u.name || '',
          Apellidos: u.surname || '',
          Email: u.email || '',
          Login: u.login || '',
          Departamento: u.stakeholderDepartmentName || u.departmentName || ''
        };
      });
      var ws = XLSX.utils.json_to_sheet(rows);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Eliminados');
      XLSX.writeFile(wb, 'usuarios_eliminados_' + (companyId || 'empresa') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    };

    makeDropdown('kym-res-user-search', 'kym-res-user-dropdown',
      function (q) {
        return allUsers.filter(function (u) {
          var full = ((u.name || '') + ' ' + (u.surname || '')).toLowerCase();
          return !q || String(u.email || '').toLowerCase().indexOf(q) >= 0 || full.indexOf(q) >= 0;
        }).map(function (u) {
          return {
            label: '<b>' + escHtml((u.name || '') + ' ' + (u.surname || '')) + '</b> &nbsp;<span style="color:#64748b">' + escHtml(u.email || '') + '</span>',
            value: u
          };
        });
      },
      function (item) {
        selectedUser = item.value;
        selectedDept = null;
        $('kym-res-user-search').value = selectedUser.email || '';

        var userSel = $('kym-res-user-selected');
        userSel.style.display = 'block';
        userSel.innerHTML = '&#10003; <b>' + escHtml((selectedUser.name || '') + ' ' + (selectedUser.surname || '')) + '</b> &mdash; ' + escHtml(selectedUser.email || '');

        $('kym-res-dept-block').style.display = 'block';
        $('kym-res-dept-search').value = '';
        $('kym-res-dept-selected').style.display = 'none';

        var prevDeptName = selectedUser.stakeholderDepartmentName || selectedUser.departmentName || '';
        var prevDeptId = selectedUser.stakeholderDepartmentId;
        var foundDept = null;

        if (prevDeptId) {
          foundDept = deptList.find(function (d) { return String(d.id) === String(prevDeptId); });
        }
        if (!foundDept && prevDeptName) {
          foundDept = deptList.find(function (d) { return d.name.toLowerCase() === String(prevDeptName).toLowerCase(); });
        }

        var deptSel = $('kym-res-dept-selected');
        if (foundDept) {
          selectedDept = foundDept;
          $('kym-res-dept-search').value = foundDept.name;
          deptSel.style.cssText = 'display:block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;font-size:12px;color:#166534;margin-bottom:12px';
          deptSel.innerHTML = '&#10003; ' + escHtml(foundDept.name) + ' <span style="color:#64748b;font-size:11px">(departamento anterior)</span>';
          $('kym-res-btn-single').disabled = false;
          $('kym-res-btn-single').style.opacity = '1';
          $('kym-res-btn-single').style.cursor = 'pointer';
        } else {
          selectedDept = null;
          deptSel.style.cssText = 'display:block;background:#fff5f5;border:1px solid #fed7d7;border-radius:6px;padding:8px 12px;font-size:12px;color:#c53030;margin-bottom:12px';
          deptSel.innerHTML = '&#9888; El departamento anterior' + (prevDeptName ? ' (' + escHtml(prevDeptName) + ')' : '') + ' no existe. Selecciona uno.';
          $('kym-res-btn-single').disabled = true;
          $('kym-res-btn-single').style.opacity = '.45';
          $('kym-res-btn-single').style.cursor = 'not-allowed';
        }
      }
    );

    makeDropdown('kym-res-dept-search', 'kym-res-dept-dropdown',
      function (q) {
        return deptList.filter(function (d) {
          return !q || d.name.toLowerCase().indexOf(q) >= 0;
        }).map(function (d) {
          return { label: escHtml(d.name), value: d };
        });
      },
      function (item) {
        selectedDept = item.value;
        $('kym-res-dept-search').value = selectedDept.name;
        var deptSel = $('kym-res-dept-selected');
        deptSel.style.cssText = 'display:block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;font-size:12px;color:#166534;margin-bottom:12px';
        deptSel.innerHTML = '&#10003; ' + escHtml(selectedDept.name);

        if (selectedUser) {
          $('kym-res-btn-single').disabled = false;
          $('kym-res-btn-single').style.opacity = '1';
          $('kym-res-btn-single').style.cursor = 'pointer';
        }
      }
    );

    $('kym-res-btn-single').onclick = async function () {
      if (!dataLoaded) {
        showStatus('kym-res-single-status', 'Espera a que carguen los datos.', 'err');
        return;
      }
      if (!selectedUser) {
        showStatus('kym-res-single-status', 'Selecciona un usuario del desplegable.', 'err');
        return;
      }
      if (!selectedDept) {
        showStatus('kym-res-single-status', 'Selecciona un departamento destino.', 'err');
        return;
      }

      if (!confirm('Se va a resucitar a ' + selectedUser.email + '.\n\nDepartamento: ' + selectedDept.name + '\n\n¿Quieres continuar?')) return;

      showStatus('kym-res-single-status', '&#8987; Procesando...', 'info');
      try {
        var r = await resurrectOne(selectedUser.email, selectedDept.id, selectedDept.name);
        showStatus('kym-res-single-status', r.ok ? '&#128137; ' + escHtml(selectedUser.email) + ' resucitado &mdash; ' + escHtml(r.msg) : '&#10007; ' + escHtml(r.msg), r.ok ? 'ok' : 'err');
        if (r.ok) {
          clearSingleSelection();
          var status = $('kym-res-load-status');
          if (status) status.innerHTML = '<span style="color:#38a169">&#10003; ' + allUsers.length + ' usuarios eliminados cargados &nbsp;|&nbsp; ' + deptList.length + ' departamentos</span>';
        }
      } catch (e) {
        showStatus('kym-res-single-status', '&#10007; Error: ' + escHtml(e.message), 'err');
      }
    };

    $('kym-res-mode-single').onclick = function () {
      $('kym-res-single').style.display = 'block';
      $('kym-res-bulk').style.display = 'none';
      this.style.cssText = 'flex:1;padding:9px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;background:#7c3aed;color:white;border:none';
      $('kym-res-mode-bulk').style.cssText = 'flex:1;padding:9px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0';
    };

    $('kym-res-mode-bulk').onclick = function () {
      $('kym-res-single').style.display = 'none';
      $('kym-res-bulk').style.display = 'block';
      this.style.cssText = 'flex:1;padding:9px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;background:#7c3aed;color:white;border:none';
      $('kym-res-mode-single').style.cssText = 'flex:1;padding:9px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0';
    };

    $('kym-res-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;

      var ext = file.name.split('.').pop().toLowerCase();
      var reader = new FileReader();

      reader.onload = function (ev) {
        try {
          if (ext === 'txt' || ext === 'csv') {
            bulkRows = parseTextRows(ev.target.result);
          } else {
            var wb = XLSX.read(ev.target.result, { type: 'binary' });
            var ws = wb.Sheets[wb.SheetNames[0]];
            var data = XLSX.utils.sheet_to_json(ws, { defval: '' });
            var emailCol = null;
            var deptCol = null;

            if (data.length) {
              Object.keys(data[0]).forEach(function (k) {
                var kl = k.toLowerCase();
                if (!emailCol && (kl === 'email' || kl.indexOf('email') >= 0 || kl.indexOf('correo') >= 0)) emailCol = k;
                if (!deptCol && (kl === 'department' || kl.indexOf('depart') >= 0)) deptCol = k;
              });
            }

            if (!emailCol) {
              $('kym-res-file-info').textContent = 'Error: no se encontró columna email';
              bulkRows = [];
              updateBulkBtn();
              return;
            }

            bulkRows = data.map(function (row) {
              return {
                email: String(row[emailCol] || '').trim(),
                department: deptCol ? String(row[deptCol] || '').trim() : ''
              };
            }).filter(function (row) { return row.email; });
          }

          $('kym-res-file-info').textContent = bulkRows.length + ' filas: ' + file.name;
          updateBulkBtn();
        } catch (err) {
          $('kym-res-file-info').textContent = 'Error leyendo archivo: ' + err.message;
          bulkRows = [];
          updateBulkBtn();
        }
      };

      if (ext === 'txt' || ext === 'csv') reader.readAsText(file);
      else reader.readAsBinaryString(file);
    });

    $('kym-res-btn-pause').onclick = function () {
      isPaused = !isPaused;
      this.innerHTML = isPaused ? '&#9654; Reanudar' : '&#9646;&#9646; Pausar';
    };

    $('kym-res-refresh-action').onclick = function () {
      window.location.reload();
    };

    $('kym-res-btn-export-results').onclick = function () {
      if (!results.length) return;
      var ws = XLSX.utils.json_to_sheet(results);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
      XLSX.writeFile(wb, 'resurreccion_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    };

    $('kym-res-btn-bulk').onclick = async function () {
      var logEl = $('kym-res-log');
      if (logEl) {
        logEl.style.display = 'block';
        logEl.innerHTML = '';
      }

      if (!bulkRows.length) {
        addLog('Sube un archivo primero.', 'err');
        return;
      }

      if (!dataLoaded) {
        addLog('Datos no cargados, cargando ahora...', 'warn');
        await loadData();
        if (!dataLoaded) {
          addLog('No se pudieron cargar los datos.', 'err');
          return;
        }
      }

      if (!confirm('Se va a intentar resucitar a ' + bulkRows.length + ' usuarios.\n\n¿Quieres continuar?')) return;

      addLog('Iniciando resurrección de ' + bulkRows.length + ' usuarios...', 'info');

      results = [];
      isPaused = false;
      var okC = 0;
      var errC = 0;
      var BATCH = 3;

      $('kym-res-btn-bulk').style.opacity = '.45';
      $('kym-res-btn-pause').style.display = 'inline-block';
      $('kym-res-btn-export-results').style.display = 'none';
      $('kym-res-btn-refresh-end').style.display = 'none';
      $('kym-res-progress').style.display = 'block';
      $('kym-res-total').textContent = bulkRows.length;
      ['kym-res-done', 'kym-res-ok', 'kym-res-err'].forEach(function (id) { $(id).textContent = '0'; });
      $('kym-res-bar').style.width = '0%';

      for (var b = 0; b < bulkRows.length; b += BATCH) {
        while (isPaused) await sleep(500);

        var batch = bulkRows.slice(b, b + BATCH);
        var bRes = await Promise.all(batch.map(function (row, j) {
          var normalizedDept = String(row.department || '').trim().toLowerCase();
          var deptId = normalizedDept ? deptMap[normalizedDept] : null;

          return resurrectOne(row.email, deptId, row.department).then(function (r) {
            var lbl = '[' + (b + j + 1) + '/' + bulkRows.length + '] ';
            addLog(lbl + (r.ok ? 'OK' : 'ERR') + ' ' + row.email + ' — ' + r.msg, r.ok ? 'ok' : 'err');
            return Object.assign({}, row, {
              _status: r.ok ? 'OK' : 'ERROR',
              _message: r.msg
            });
          }).catch(function (err) {
            addLog('[' + (b + j + 1) + '/' + bulkRows.length + '] ERR ' + row.email + ' — ' + err.message, 'err');
            return Object.assign({}, row, {
              _status: 'ERROR',
              _message: err.message
            });
          });
        }));

        bRes.forEach(function (r) {
          results.push(r);
          if (r._status === 'OK') okC += 1;
          else errC += 1;
        });

        $('kym-res-ok').textContent = okC;
        $('kym-res-err').textContent = errC;
        $('kym-res-done').textContent = Math.min(b + BATCH, bulkRows.length);
        $('kym-res-bar').style.width = Math.round((Math.min(b + BATCH, bulkRows.length) / bulkRows.length) * 100) + '%';

        if (b + BATCH < bulkRows.length) await sleep(200);
      }

      addLog('Completado: ' + okC + ' resucitados, ' + errC + ' errores.', 'info');
      $('kym-res-btn-pause').style.display = 'none';
      $('kym-res-btn-bulk').style.opacity = '1';
      $('kym-res-btn-export-results').style.display = 'inline-block';
      $('kym-res-btn-refresh-end').style.display = 'block';
    };

    loadData();
  }

  KAT.registerModule({
    key: 'bulk_resurrection',
    label: 'Resurrección de usuarios',
    icon: '&#128137;',
    order: 130,
    group: 'bulk',
    forceGuiOnly: true,
    renderGui: renderGui
  });
})();
