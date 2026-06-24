(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  function renderGui(container, tools) {
    var esc = tools.escHtml;
    var setStatus = tools.setStatus;
    var $ = tools.$;

    container.innerHTML = [
      '<div style="margin-bottom:14px">',
      '  <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:5px">EMAIL A BUSCAR</label>',
      '  <div style="display:flex;gap:8px">',
      '    <input id="kym-us-email" type="email" placeholder="usuario@empresa.com"',
      '      style="flex:1;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box">',
      '    <button id="kym-us-search" style="background:#1e293b;color:white;border:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Buscar</button>',
      '  </div>',
      '</div>',
      '<div id="kym-us-status" style="display:none;margin-bottom:10px"></div>',
      '<div id="kym-us-result" style="display:none"></div>',
      '<div id="kym-us-log" style="display:none;margin-top:12px;background:#0f172a;border-radius:8px;padding:12px;font-size:11px;font-family:Menlo,Consolas,monospace;color:#94a3b8;max-height:200px;overflow-y:auto"></div>'
    ].join('');

    var cancelled = false;

    function log(msg) {
      var logEl = document.getElementById('kym-us-log');
      if (!logEl) return;
      logEl.style.display = 'block';
      var line = document.createElement('div');
      line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    }

    function showResult(found, user, company) {
      var el = document.getElementById('kym-us-result');
      if (!el) return;
      el.style.display = 'block';
      if (found) {
        el.innerHTML = [
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px">',
          '  <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:10px">✓ Usuario encontrado</div>',
          '  <table style="width:100%;font-size:13px;border-collapse:collapse">',
          '    <tr><td style="color:#64748b;padding:3px 0;width:120px">Nombre</td><td style="font-weight:600">' + esc((user.name||'') + ' ' + (user.surname||'')) + '</td></tr>',
          '    <tr><td style="color:#64748b;padding:3px 0">Email</td><td>' + esc(user.email||'') + '</td></tr>',
          '    <tr><td style="color:#64748b;padding:3px 0">Login</td><td>' + esc(user.login||'') + '</td></tr>',
          '    <tr><td style="color:#64748b;padding:3px 0">Empresa</td><td style="font-weight:600;color:#1e40af">' + esc(company.name||'') + ' (ID: ' + company.stakeholderId + ')</td></tr>',
          '    <tr><td style="color:#64748b;padding:3px 0">Departamento</td><td>' + esc(user.stakeholderDepartmentName||'—') + '</td></tr>',
          '    <tr><td style="color:#64748b;padding:3px 0">Perfiles</td><td>' + esc(JSON.stringify(user.profiles||{})) + '</td></tr>',
          '  </table>',
          '</div>'
        ].join('');
      } else {
        el.innerHTML = '<div style="background:#fff5f5;border:1px solid #fed7d7;border-radius:10px;padding:16px;color:#c53030;font-size:13px;font-weight:600">✗ Usuario no encontrado en ninguna empresa</div>';
      }
    }

    async function doSearch() {
      var emailEl = document.getElementById('kym-us-email');
      var statusEl = document.getElementById('kym-us-status');
      var resultEl = document.getElementById('kym-us-result');
      var logEl = document.getElementById('kym-us-log');

      var email = (emailEl.value || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        setStatus(statusEl, '⚠ Introduce un email válido', 'err');
        return;
      }

      // Reset
      cancelled = false;
      if (resultEl) { resultEl.style.display = 'none'; resultEl.innerHTML = ''; }
      if (logEl) { logEl.style.display = 'none'; logEl.innerHTML = ''; }
      setStatus(statusEl, '⌛ Cargando empresas...', 'info');

      var searchBtn = document.getElementById('kym-us-search');
      if (searchBtn) {
        searchBtn.textContent = 'Cancelar';
        searchBtn.onclick = function() {
          cancelled = true;
          setStatus(statusEl, '⊘ Búsqueda cancelada', 'err');
          searchBtn.textContent = 'Buscar';
          searchBtn.onclick = doSearch;
        };
      }

      try {
        var axios = document.querySelector('#app').__vue_app__.config.globalProperties.$axios;

        // 1. Obtener todas las empresas
        var r = await axios.get('admin/stakeholders/people/48207/companies', {
          params: { stakeholderId: true, name: true }
        });
        var allCompanies = r.data.records || [];
        log('Empresas cargadas: ' + allCompanies.length);

        // 2. Estimar candidatos por dominio
        var domain = email.split('@')[1] || '';
        var domainBase = domain.split('.')[0].toLowerCase();
        var candidates = allCompanies.filter(function(c) {
          var n = (c.name || '').toLowerCase();
          var s = (c.subdomain || '').toLowerCase();
          return domainBase && (n.includes(domainBase) || s.includes(domainBase));
        });

        if (candidates.length) {
          log('Candidatos por dominio "' + domainBase + '": ' + candidates.map(function(c){ return c.name; }).join(', '));
        }

        // 3. Ordenar el resto por peopleCount asc (los pequeños primero)
        var rest = allCompanies.filter(function(c) {
          return !candidates.some(function(x){ return x.stakeholderId === c.stakeholderId; });
        }).sort(function(a, b) {
          return (a.peopleCount || 0) - (b.peopleCount || 0);
        });

        // 4. Buscar: primero candidatos, luego el resto en lotes de 10
        var queue = candidates.concat(rest);
        var checked = 0;
        var BATCH = 10;

        setStatus(statusEl, '⌛ Buscando en ' + queue.length + ' empresas...', 'info');

        for (var i = 0; i < queue.length; i += BATCH) {
          if (cancelled) break;

          var batch = queue.slice(i, i + BATCH);
          checked += batch.length;

          setStatus(statusEl,
            '⌛ Revisando ' + checked + ' / ' + queue.length + ' empresas' +
            (i < candidates.length ? ' (candidatos por dominio)' : '') + '...',
            'info'
          );

          var results = await Promise.all(batch.map(function(company) {
            return axios.get('admin/stakeholders/companies/' + company.stakeholderId + '/people', {
              params: { email: true, login: true }
            }).then(function(res) {
              var people = res.data.records || [];
              var found = people.find(function(p) {
                return (p.email || '').toLowerCase() === email ||
                       (p.login || '').toLowerCase() === email;
              });
              return { company: company, user: found || null };
            }).catch(function() {
              return { company: company, user: null };
            });
          }));

          var match = results.find(function(x){ return x.user; });
          if (match) {
            log('✓ Encontrado en: ' + match.company.name + ' tras revisar ' + checked + ' empresas');
            setStatus(statusEl, '✓ Usuario encontrado', 'ok');
            showResult(true, match.user, match.company);
            if (searchBtn) { searchBtn.textContent = 'Buscar'; searchBtn.onclick = doSearch; }
            return;
          }
        }

        if (!cancelled) {
          log('✗ No encontrado en ninguna de las ' + queue.length + ' empresas');
          setStatus(statusEl, '✗ Usuario no encontrado', 'err');
          showResult(false);
        }

      } catch(e) {
        setStatus(statusEl, '✗ Error: ' + esc(e.message), 'err');
      }

      if (searchBtn) { searchBtn.textContent = 'Buscar'; searchBtn.onclick = doSearch; }
    }

    document.getElementById('kym-us-search').onclick = doSearch;
    document.getElementById('kym-us-email').onkeydown = function(e) {
      if (e.key === 'Enter') doSearch();
    };
  }

  KAT.registerModule({
    key: 'user_search',
    label: 'Buscar usuario',
    icon: '&#128269;',
    group: 'bulk',
    order: 90,
    renderGui: renderGui,
    getJson: function() { return {}; }
  });

})();
