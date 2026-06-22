(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  var SERVICES = [
    { id: 1, label: 'Concienciación' },
    { id: 2, label: 'Bienestar' },
    { id: 3, label: 'GRI' },
    { id: 4, label: 'Phishing' },
    { id: 5, label: 'ABS' },
    { id: 6, label: 'Federación (SAML)' },
    { id: 7, label: 'Neurophishing' },
    { id: 8, label: 'Burnout' },
    { id: 9, label: 'SCIM' },
    { id: 10, label: 'Smishing' },
    { id: 11, label: 'Neurosmishing', disabled: true },
    { id: 12, label: 'Impacto' },
    { id: 13, label: 'Ingeniería Social' },
    { id: 14, label: 'Arquetipo' },
    { id: 15, label: 'Ranking' },
    { id: 16, label: 'Personalización de sesiones' },
    { id: 17, label: 'Logros' },
    { id: 18, label: 'Gamificación', disabled: true },
    { id: 19, label: 'HRM (Human Risk Management)' },
    { id: 20, label: 'MFA (Múltiple Factor de Autenticación)' },
    { id: 21, label: 'Vishing' },
    { id: 22, label: 'Neurovishing', disabled: true },
    { id: 23, label: 'Formación (NIS...)' }
  ];

  function renderGui(container, tools) {
    var $ = tools.$;
    var escHtml = tools.escHtml;
    var setStatus = tools.setStatus;

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando servicios...</div>';

    tools.loadCompanyData()
      .then(function (data) {
        var dist = (data.servicesRaw && data.servicesRaw.distribution) || {};
        var userSvcs = dist.USER || [];
        var adminSvcs = dist.ADMIN || [];
        var ctrlSvcs = dist.CONTROLLER || [];

        function isActive(id) {
          return userSvcs.indexOf(id) >= 0 || adminSvcs.indexOf(id) >= 0 || ctrlSvcs.indexOf(id) >= 0;
        }

        var html = '';
        html += '<div style="margin-bottom:10px"><span style="font-size:11px;font-weight:600;color:#64748b">SERVICIOS</span></div>';
        html += '<div id="kym-adm-services-list" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">';

        SERVICES.forEach(function (svc) {
          var checked = isActive(svc.id) ? 'checked' : '';
          var disabled = svc.disabled ? 'disabled' : '';
          var opacity = svc.disabled ? 'opacity:.5;cursor:not-allowed;' : 'cursor:pointer;';
          html += '<label id="kym-svc-row-' + svc.id + '" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;' + opacity + (svc.id === 5 ? 'grid-column:1/-1;' : '') + '">';
          html += '<input type="checkbox" id="kym-svc-' + svc.id + '" value="' + svc.id + '" ' + checked + ' ' + disabled + ' style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
          html += '<span style="flex:1;font-size:12px">' + svc.id + ' — ' + escHtml(svc.label) + '</span>';

          if (svc.id === 5) {
            html += '</label>';
            html += '<div id="kym-abs-mode-wrapper" style="grid-column:1/-1;display:none;margin-top:-4px;margin-bottom:6px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc">';
            html += '<div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:5px">Modo ABS</div>';
            html += '<select id="kym-abs-mode" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;background:white">';
            html += '<option value="informativo">Informativo</option>';
            html += '<option value="silencioso">Silencioso</option>';
            html += '<option value="analisis">Análisis</option>';
            html += '</select>';
            html += '</div>';
          } else {
            html += '</label>';
          }
        });

        html += '</div>';
        html += '<button id="kym-adm-services-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar servicios</button>';
        html += '<div id="kym-adm-services-status" style="display:none"></div>';

        container.innerHTML = html;

        function updateSvcRow(id) {
          var cb = $('kym-svc-' + id);
          var row = $('kym-svc-row-' + id);
          if (!cb || !row) return;
          row.style.background = cb.checked ? '#f0fdf4' : '#f8fafc';
          row.style.borderColor = cb.checked ? '#bbf7d0' : '#e2e8f0';

          var absWrap = $('kym-abs-mode-wrapper');
          if (absWrap && id === 5) {
            absWrap.style.display = cb.checked ? 'block' : 'none';
          }
        }

        SERVICES.forEach(function (svc) {
          updateSvcRow(svc.id);
          var cb = $('kym-svc-' + svc.id);
          if (!cb || svc.disabled) return;

          cb.addEventListener('change', function () {
            if (svc.id === 7 && cb.checked) {
              var social = $('kym-svc-13');
              if (social && !social.checked) {
                cb.checked = false;
                alert('Neurophishing requiere tener activa Ingeniería Social.');
              }
            }

            if (svc.id === 13 && !cb.checked) {
              var neuro = $('kym-svc-7');
              if (neuro) neuro.checked = false;
              updateSvcRow(7);
            }

            updateSvcRow(svc.id);
          });
        });

        var absCb = $('kym-svc-5');
        var absMode = $('kym-abs-mode');

        if (absCb && absCb.checked && absMode) {
          var inUser = userSvcs.indexOf(5) >= 0;
          var inCtrl = ctrlSvcs.indexOf(5) >= 0;
          var inAdmin = adminSvcs.indexOf(5) >= 0;

          if (inUser && inCtrl && inAdmin) absMode.value = 'informativo';
          else if (!inUser && inCtrl && inAdmin) absMode.value = 'silencioso';
          else if (!inUser && !inCtrl && inAdmin) absMode.value = 'analisis';
          else absMode.value = 'informativo';
        }

        $('kym-adm-services-save').onclick = async function () {
          var status = $('kym-adm-services-status');
          var active = [];

          SERVICES.forEach(function (svc) {
            if (svc.id === 5) return;
            var cb = $('kym-svc-' + svc.id);
            if (cb && cb.checked) active.push(svc.id);
          });

          var dataNow = await tools.loadCompanyData();
          var distNow = (dataNow.servicesRaw && dataNow.servicesRaw.distribution) || {};
          var reseller = distNow.RESELLER || [];

          var userList = active.slice();
          var ctrlList = active.slice();
          var adminList = active.slice();

          var absChecked = $('kym-svc-5') && $('kym-svc-5').checked;
          if (absChecked) {
            var mode = $('kym-abs-mode').value;
            if (mode === 'informativo') {
              userList.push(5);
              ctrlList.push(5);
              adminList.push(5);
            } else if (mode === 'silencioso') {
              ctrlList.push(5);
              adminList.push(5);
            } else if (mode === 'analisis') {
              adminList.push(5);
            }
          }

          userList.sort(function (a, b) { return a - b; });
          ctrlList.sort(function (a, b) { return a - b; });
          adminList.sort(function (a, b) { return a - b; });

          if (!confirm('Se van a guardar los servicios de ' + tools.state.companyName + '.\n\n¿Quieres continuar?')) return;

          setStatus(status, '&#8987; Guardando...', 'info');

          try {
            await tools.putCompanyPayload({
              services: {
                USER: userList,
                CONTROLLER: ctrlList,
                ADMIN: adminList,
                RESELLER: reseller
              }
            });
            setStatus(status, '&#10003; Servicios guardados correctamente', 'ok');
          } catch (e) {
            setStatus(status, '&#10007; Error: ' + escHtml(e.message), 'err');
          }
        };
      })
      .catch(function (e) {
        container.innerHTML = '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">Error: ' + escHtml(e.message) + '</div>';
      });
  }

  KAT.registerModule({
    key: 'services',
    label: 'Servicios',
    icon: '&#9881;',
    order: 10,
    getJson: function (d) {
      return {
        services: d.servicesRaw && d.servicesRaw.distribution
      };
    },
    renderGui: renderGui
  });
})();
