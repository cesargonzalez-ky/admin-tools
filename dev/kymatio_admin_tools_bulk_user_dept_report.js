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
    var escHtml = tools.escHtml;

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando herramienta...</div>';

    loadXlsx(function () {
      buildPanel(container, tools, escHtml);
    });
  }

  function buildPanel(container, tools, escHtml) {
    var token = tools.state.token || localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    var companyId = tools.state.companyId || '';
    var companyName = tools.state.companyName || '';

    var users = [];
    var departments = [];
    var userRows = [];
    var deptRows = [];
    var summary = null;
    var dataLoaded = false;

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
          name: companyName
        };
      }
    }

    function apiHeaders() {
      return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      };
    }

    function setInlineStatus(id, html) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = html;
    }

    function updateCompanyFromVue() {
      var c = getCurrentCompanyFromVue();
      if (c.id) companyId = c.id;
      if (c.name) companyName = c.name;
      if (tools.state) {
        tools.state.companyId = companyId;
        tools.state.companyName = companyName;
      }
      var nameEl = document.getElementById('kym-udr-company-name');
      var idEl = document.getElementById('kym-udr-company-id');
      if (nameEl) nameEl.textContent = companyName || '— Sin empresa';
      if (idEl) idEl.textContent = companyId || '?';
    }

    function normalizeText(value) {
      return String(value == null ? '' : value).trim();
    }

    function getDeptId(d) {
      if (!d) return '';
      return String(d.stakeholderId || d.departmentId || d.id || d._id || '');
    }

    function getDeptName(d) {
      return normalizeText(d && (d.name || d.departmentName || d.stakeholderName));
    }

    function getParentId(d) {
      if (!d) return '';
      var parentObj = d.parent || d.parentDepartment || d.departmentParent || null;
      return String(
        d.parentStakeholderId ||
        d.stakeholderParentId ||
        d.parentDepartmentId ||
        d.departmentParentId ||
        d.parentId ||
        d.parent_id ||
        (parentObj && (parentObj.stakeholderId || parentObj.departmentId || parentObj.id)) ||
        ''
      );
    }

    function getParentName(d) {
      if (!d) return '';
      var parentObj = d.parent || d.parentDepartment || d.departmentParent || null;
      return normalizeText(
        d.stakeholderDepartmentParentName ||
        d.parentName ||
        d.parentDepartmentName ||
        d.stakeholderParentName ||
        d.departmentParentName ||
        (parentObj && (parentObj.name || parentObj.departmentName)) ||
        ''
      );
    }

    function getUserDeptId(u) {
      if (!u) return '';
      var deptObj = u.department || u.stakeholderDepartment || null;
      return String(
        u.stakeholderDepartmentId ||
        u.departmentId ||
        u.departmentStakeholderId ||
        (deptObj && (deptObj.stakeholderId || deptObj.departmentId || deptObj.id)) ||
        ''
      );
    }

    function getUserDeptName(u) {
      if (!u) return '';
      var deptObj = u.department || u.stakeholderDepartment || null;
      return normalizeText(
        u.stakeholderDepartmentName ||
        u.departmentName ||
        u.department ||
        (deptObj && (deptObj.name || deptObj.departmentName)) ||
        ''
      );
    }

    function sortByName(a, b) {
      return String(a.Nombre || '').localeCompare(String(b.Nombre || ''), 'es', { sensitivity: 'base' });
    }

    function buildReport() {
      var deptById = {};
      var deptIdByName = {};
      var childrenByParent = {};
      var ownUsersByDept = {};

      departments.forEach(function (d) {
        var id = getDeptId(d);
        var name = getDeptName(d);
        if (!id && name) id = 'name:' + name.toLowerCase();
        if (!id) return;

        d.__kymId = id;
        d.__kymName = name || id;
        d.__kymParentId = getParentId(d);
        d.__kymParentName = getParentName(d);

        deptById[id] = d;
        if (name) deptIdByName[name.toLowerCase()] = id;
      });

      departments.forEach(function (d) {
        if (!d.__kymId) return;

        if (!d.__kymParentId && d.__kymParentName) {
          d.__kymParentId = deptIdByName[d.__kymParentName.toLowerCase()] || '';
        }

        if (d.__kymParentId && !deptById[d.__kymParentId]) {
          d.__kymParentId = '';
        }

        if (d.__kymParentId) {
          if (!childrenByParent[d.__kymParentId]) childrenByParent[d.__kymParentId] = [];
          childrenByParent[d.__kymParentId].push(d.__kymId);
        }
      });

      userRows = users.map(function (u) {
        var deptName = getUserDeptName(u);
        return {
          Nombre: normalizeText(u.name),
          Apellidos: normalizeText(u.surname || u.lastname || u.lastName),
          Email: normalizeText(u.email),
          Departamento: deptName
        };
      }).sort(function (a, b) {
        var da = String(a.Departamento || '').localeCompare(String(b.Departamento || ''), 'es', { sensitivity: 'base' });
        if (da !== 0) return da;
        var na = String(a.Apellidos || '').localeCompare(String(b.Apellidos || ''), 'es', { sensitivity: 'base' });
        if (na !== 0) return na;
        return String(a.Nombre || '').localeCompare(String(b.Nombre || ''), 'es', { sensitivity: 'base' });
      });

      users.forEach(function (u) {
        var id = getUserDeptId(u);
        var name = getUserDeptName(u);
        if (!id && name) id = deptIdByName[name.toLowerCase()] || '';
        if (!id) return;
        ownUsersByDept[id] = (ownUsersByDept[id] || 0) + 1;
      });

      function countDescendantUsers(deptId, seen) {
        if (!deptId) return 0;
        seen = seen || {};
        if (seen[deptId]) return 0;
        seen[deptId] = true;

        var total = ownUsersByDept[deptId] || 0;
        (childrenByParent[deptId] || []).forEach(function (childId) {
          total += countDescendantUsers(childId, seen);
        });
        return total;
      }

      deptRows = Object.keys(deptById).map(function (id) {
        var d = deptById[id];
        var parentName = '';
        if (d.__kymParentId && deptById[d.__kymParentId]) parentName = deptById[d.__kymParentId].__kymName;
        else parentName = d.__kymParentName || '';

        return {
          Nombre: d.__kymName,
          'Departamento padre': parentName,
          'Nº usuarios propios': ownUsersByDept[id] || 0,
          'Nº departamentos directos': (childrenByParent[id] || []).length,
          'Nº usuarios totales dependientes': countDescendantUsers(id, {})
        };
      }).sort(sortByName);

      var usersWithoutDept = userRows.filter(function (r) { return !r.Departamento; }).length;
      var rootDepartments = deptRows.filter(function (r) { return !r['Departamento padre']; }).length;
      var maxUsersDept = deptRows.slice().sort(function (a, b) {
        return b['Nº usuarios totales dependientes'] - a['Nº usuarios totales dependientes'];
      })[0];

      summary = {
        totalUsers: userRows.length,
        totalDepartments: deptRows.length,
        usersWithoutDept: usersWithoutDept,
        rootDepartments: rootDepartments,
        maxUsersDeptName: maxUsersDept ? maxUsersDept.Nombre : '',
        maxUsersDeptCount: maxUsersDept ? maxUsersDept['Nº usuarios totales dependientes'] : 0
      };
    }

    function renderSummary() {
      var box = document.getElementById('kym-udr-summary');
      var btn = document.getElementById('kym-udr-download');
      if (!box || !summary) return;

      var html = '';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
      html += statCard('Usuarios', summary.totalUsers);
      html += statCard('Departamentos', summary.totalDepartments);
      html += statCard('Sin departamento', summary.usersWithoutDept);
      html += statCard('Raíz', summary.rootDepartments);
      html += '</div>';

      html += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:12px;color:#475569;line-height:1.5;margin-bottom:12px">';
      if (summary.maxUsersDeptName) {
        html += 'Departamento con más usuarios dependientes: <strong>' + escHtml(summary.maxUsersDeptName) + '</strong> (' + summary.maxUsersDeptCount + ').';
      } else {
        html += 'No se ha podido calcular un departamento con usuarios dependientes.';
      }
      html += '</div>';

      html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;color:#1e40af;font-size:12px;line-height:1.5">';
      html += 'El Excel tendrá dos pestañas: <strong>Usuarios</strong> y <strong>Departamentos</strong>.';
      html += '</div>';

      box.innerHTML = html;
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    }

    function statCard(label, value) {
      return '' +
        '<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center">' +
        '<div style="font-size:20px;font-weight:800;color:#0f766e;margin-bottom:3px">' + escHtml(value) + '</div>' +
        '<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.4px">' + escHtml(label) + '</div>' +
        '</div>';
    }

    async function loadData() {
      updateCompanyFromVue();
      dataLoaded = false;
      users = [];
      departments = [];
      userRows = [];
      deptRows = [];
      summary = null;

      var btn = document.getElementById('kym-udr-download');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '.45';
        btn.style.cursor = 'not-allowed';
      }

      setInlineStatus('kym-udr-load-status', '<span style="color:#64748b">&#8987; Cargando usuarios y departamentos...</span>');
      setInlineStatus('kym-udr-summary', '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc">El resumen aparecerá aquí cuando se carguen los datos.</div>');

      if (!companyId) {
        setInlineStatus('kym-udr-load-status', '<span style="color:#d97706">&#9888; Selecciona una empresa y pulsa Actualizar empresa y datos.</span>');
        return;
      }

      token = tools.state.token || localStorage.getItem('token') || localStorage.getItem('access_token') || token;
      if (!token) {
        setInlineStatus('kym-udr-load-status', '<span style="color:#e53e3e">&#10007; No se ha encontrado token. Asegúrate de estar logado en Kymatio.</span>');
        return;
      }

      try {
        var r1 = await fetch(
          'https://api-dev.kymatio.xyz/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId) + '/people?stakeholderDepartmentParentName=true&stakeholderDepartmentId=true&avatar=true&email=true&authentication=true&locale=true&timezone=true&phoneNumber=true&environment=true&login=true&tags=true',
          { headers: apiHeaders() }
        );
        var d1 = await r1.json();
        if (!r1.ok) throw new Error((d1 && (d1.message || (d1.records && d1.records.devMessage))) || 'Error cargando usuarios: HTTP ' + r1.status);

        users = d1.records || [];

        var r2 = await fetch(
          'https://api-dev.kymatio.xyz/v2/admin/stakeholders/companies/' + encodeURIComponent(companyId) + '/departments?stakeholderDepartmentParentName=true&tags=true',
          { headers: apiHeaders() }
        );
        var d2 = await r2.json();
        if (!r2.ok) throw new Error((d2 && (d2.message || (d2.records && d2.records.devMessage))) || 'Error cargando departamentos: HTTP ' + r2.status);

        departments = d2.records || [];
        buildReport();
        dataLoaded = true;

        setInlineStatus('kym-udr-load-status', '<span style="color:#16a34a">&#10003; Datos cargados: ' + userRows.length + ' usuarios | ' + deptRows.length + ' departamentos</span>');
        renderSummary();
      } catch (e) {
        setInlineStatus('kym-udr-load-status', '<span style="color:#e53e3e">&#10007; Error al cargar: ' + escHtml(e.message) + '</span>');
      }
    }

    function autoFitWorksheet(ws, rows) {
      var headers = rows.length ? Object.keys(rows[0]) : [];
      ws['!cols'] = headers.map(function (h) {
        var max = String(h).length;
        rows.forEach(function (row) {
          max = Math.max(max, String(row[h] == null ? '' : row[h]).length);
        });
        return { wch: Math.min(Math.max(max + 2, 12), 48) };
      });
    }

    function downloadExcel() {
      if (!dataLoaded) return;

      var wb = XLSX.utils.book_new();
      var wsUsers = XLSX.utils.json_to_sheet(userRows);
      var wsDepts = XLSX.utils.json_to_sheet(deptRows);

      autoFitWorksheet(wsUsers, userRows);
      autoFitWorksheet(wsDepts, deptRows);

      XLSX.utils.book_append_sheet(wb, wsUsers, 'Usuarios');
      XLSX.utils.book_append_sheet(wb, wsDepts, 'Departamentos');

      var cleanCompany = String(companyName || companyId || 'empresa')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 60);

      XLSX.writeFile(wb, 'informe_usuarios_departamentos_' + cleanCompany + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    }

    function buildHtml() {
      var h = '';

      h += '<div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:10px;padding:12px 16px;margin-bottom:14px">';
      h += '<div style="display:flex;align-items:center;gap:10px">';
      h += '<div style="font-size:22px">&#128202;</div>';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Empresa activa</div>';
      h += '<div id="kym-udr-company-name" style="font-size:16px;font-weight:700;color:#0f766e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(companyName || '— Sin empresa') + '</div>';
      h += '<div style="font-size:10px;color:#64748b">ID: <span id="kym-udr-company-id">' + escHtml(companyId || '?') + '</span></div>';
      h += '</div>';
      h += '<button id="kym-udr-refresh-company" style="background:#0f766e;color:white;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;white-space:nowrap">&#8635; Actualizar</button>';
      h += '</div>';
      h += '</div>';

      h += '<div id="kym-udr-load-status" style="font-size:12px;color:#64748b;margin-bottom:12px;padding:10px 12px;background:#f8fafc;border-radius:8px;min-height:38px;display:flex;align-items:center">Cargando datos...</div>';

      h += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:12px;color:#475569;font-size:12px;line-height:1.5">';
      h += 'Genera un Excel con dos pestañas: listado de usuarios y resumen jerárquico de departamentos.';
      h += '</div>';

      h += '<div id="kym-udr-summary" style="margin-bottom:14px"></div>';

      h += '<button id="kym-udr-download" disabled style="width:100%;background:#0f766e;color:white;border:none;padding:10px;border-radius:7px;font-weight:700;cursor:not-allowed;font-size:13px;opacity:.45">&#8595; Descargar Excel</button>';
      h += '<button id="kym-udr-reload" style="width:100%;margin-top:8px;background:white;color:#0f766e;border:1px solid #99f6e4;padding:9px;border-radius:7px;font-weight:700;cursor:pointer;font-size:12px">&#8635; Recargar datos</button>';

      return h;
    }

    container.innerHTML = buildHtml();

    document.getElementById('kym-udr-refresh-company').onclick = function () {
      loadData();
    };

    document.getElementById('kym-udr-reload').onclick = function () {
      loadData();
    };

    document.getElementById('kym-udr-download').onclick = function () {
      downloadExcel();
    };

    loadData();
  }

  KAT.registerModule({
    key: 'bulk_user_dept_report',
    label: 'Informe usuarios/departamentos',
    icon: '&#128202;',
    group: 'bulk',
    order: 65,
    renderGui: renderGui
  });
})();
