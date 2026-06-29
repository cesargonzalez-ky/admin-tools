(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  function renderGui(container, tools) {
    var $ = tools.$;
    var escHtml = tools.escHtml;
    var setStatus = tools.setStatus;
    var safeJsonClone = tools.safeJsonClone;

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando dominios...</div>';

    tools.loadCompanyData()
      .then(function (data) {
        var sc = data.servicesConfiguration || {};
        var ph = sc.phishing || {};
        var domainsData = safeJsonClone(ph.domains || []);

        if (!Array.isArray(domainsData)) {
          domainsData = [];
        }

        function normalizeDomain(value) {
          return String(value || '')
            .trim()
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .replace(/\/.*$/, '')
            .toLowerCase();
        }

        function isValidDomain(value) {
          var d = normalizeDomain(value);

          if (!d) return false;
          if (d.indexOf(' ') >= 0) return false;
          if (d.indexOf('/') >= 0) return false;
          if (d.indexOf(':') >= 0) return false;
          if (d.indexOf('.') < 0) return false;

          return /^[a-z0-9.-]+$/.test(d);
        }

        function getDomainsFromInputs() {
          var values = [];
          var seen = {};

          document.querySelectorAll('#kym-dom-list input[data-domain-input="1"]').forEach(function (input) {
            var d = normalizeDomain(input.value);

            if (!d) return;

            if (!seen[d]) {
              seen[d] = true;
              values.push(d);
            }
          });

          return values;
        }

        function updateRowValidation() {
          document.querySelectorAll('#kym-dom-list .kym-dom-row').forEach(function (row) {
            var input = row.querySelector('input[data-domain-input="1"]');
            var error = row.querySelector('.kym-dom-error');
            var value = input.value.trim();

            if (!value || isValidDomain(value)) {
              input.style.borderColor = '#e2e8f0';
              error.style.display = 'none';
            } else {
              input.style.borderColor = '#fed7d7';
              error.style.display = 'block';
            }
          });
        }

        function renderList() {
          var list = $('kym-dom-list');
          list.innerHTML = '';

          if (!domainsData.length) {
            list.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc">No hay dominios configurados</div>';
            return;
          }

          domainsData.forEach(function (domain, idx) {
            var row = document.createElement('div');
            row.className = 'kym-dom-row';
            row.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px';

            var top = document.createElement('div');
            top.style.cssText = 'display:flex;align-items:center;gap:8px';

            var input = document.createElement('input');
            input.type = 'text';
            input.value = domain || '';
            input.dataset.domainInput = '1';
            input.placeholder = 'ejemplo.com';
            input.style.cssText = 'flex:1;padding:7px 9px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;background:white;color:#1a202c;box-sizing:border-box';

            var delBtn = document.createElement('button');
            delBtn.innerHTML = '&#10007;';
            delBtn.title = 'Eliminar dominio';
            delBtn.style.cssText = 'background:#fee2e2;color:#c53030;border:none;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer';

            var error = document.createElement('div');
            error.className = 'kym-dom-error';
            error.style.cssText = 'display:none;color:#c53030;font-size:11px;margin-top:6px';
            error.textContent = 'Dominio no válido. Usa formato tipo verified-access.com, sin http:// ni rutas.';

            input.addEventListener('input', function () {
              domainsData[idx] = input.value;
              updateRowValidation();
            });

            input.addEventListener('blur', function () {
              input.value = normalizeDomain(input.value);
              domainsData[idx] = input.value;
              updateRowValidation();
            });

            delBtn.onclick = function () {
              domainsData.splice(idx, 1);
              renderList();
            };

            top.appendChild(input);
            top.appendChild(delBtn);

            row.appendChild(top);
            row.appendChild(error);

            list.appendChild(row);
          });

          updateRowValidation();
        }

        var html = '';
        html += '<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">';
        html += '<span style="font-size:11px;font-weight:600;color:#64748b">DOMINIOS DE PHISHING</span>';
        html += '<button id="kym-dom-add" style="background:#0369a1;color:white;border:none;padding:5px 12px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">+ Añadir dominio</button>';
        html += '</div>';

        html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#1e40af;font-size:12px;line-height:1.5">';
        html += 'Introduce solo el dominio, por ejemplo <strong>verified-access.com</strong>. Si pegas una URL completa, se normalizará quitando <strong>https://</strong>, <strong>www.</strong> y rutas.';
        html += '</div>';

        html += '<div id="kym-dom-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px"></div>';

        html += '<button id="kym-dom-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar dominios</button>';
        html += '<div id="kym-dom-status" style="display:none"></div>';

        container.innerHTML = html;

        $('kym-dom-add').onclick = function () {
          domainsData = getDomainsFromInputs();
          domainsData.push('');
          renderList();

          setTimeout(function () {
            var inputs = document.querySelectorAll('#kym-dom-list input[data-domain-input="1"]');
            if (inputs.length) inputs[inputs.length - 1].focus();
          }, 0);
        };

        $('kym-dom-save').onclick = async function () {
          var status = $('kym-dom-status');
          var values = getDomainsFromInputs();

          var invalid = false;
          document.querySelectorAll('#kym-dom-list input[data-domain-input="1"]').forEach(function (input) {
            var raw = input.value.trim();
            if (raw && !isValidDomain(raw)) {
              invalid = true;
            }
          });

          updateRowValidation();

          if (invalid) {
            setStatus(status, '&#10007; Hay dominios con formato no válido. Corrígelos antes de guardar.', 'err');
            return;
          }

          if (!confirm('Se van a guardar los dominios de phishing de ' + tools.state.companyName + '.\n\nDominios: ' + values.join(', ') + '\n\n¿Quieres continuar?')) {
            return;
          }

          setStatus(status, '&#8987; Guardando...', 'info');

          try {
            var currentData = await tools.loadCompanyData();
            var currentSc = currentData.servicesConfiguration || {};
            var currentPh = currentSc.phishing || {};

            var payload = {
              servicesConfiguration: Object.assign({}, currentSc, {
                phishing: Object.assign({}, currentPh, {
                  domains: values
                })
              })
            };

            await tools.putCompanyPayload(payload);
            domainsData = values;
            renderList();
            setStatus(status, '&#10003; Dominios guardados correctamente', 'ok');
          } catch (e) {
            setStatus(status, '&#10007; Error: ' + escHtml(e.message), 'err');
          }
        };

        renderList();
      })
      .catch(function (e) {
        container.innerHTML = '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">Error: ' + escHtml(e.message) + '</div>';
      });
  }

  KAT.registerModule({
    key: 'phish_dom',
    label: 'Phishing: Dominios',
    icon: '&#128279;',
    order: 40,
    getJson: function (d) {
      return {
        servicesConfiguration: {
          phishing: {
            domains:
              d.servicesConfiguration &&
              d.servicesConfiguration.phishing &&
              d.servicesConfiguration.phishing.domains
          }
        }
      };
    },
    renderGui: renderGui
  });
})();
