(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  var LANG_NAMES = {
    'es-es': 'Español',
    'es-mx': 'Español (Latam)',
    'en-us': 'Inglés',
    'eu': 'Euskera',
    'pl': 'Polaco',
    'cat': 'Catalán',
    'pt-pt': 'Portugués (Portugal)',
    'pt-br': 'Portugués (Brasil)',
    'sv': 'Sueco',
    'fr': 'Francés',
    'it': 'Italiano',
    'de': 'Alemán'
  };

  var ALL_LANGS = [
    'es-es',
    'es-mx',
    'en-us',
    'eu',
    'pl',
    'cat',
    'pt-pt',
    'pt-br',
    'sv',
    'fr',
    'it',
    'de'
  ];

  function renderGui(container, tools) {
    var $ = tools.$;
    var escHtml = tools.escHtml;
    var setStatus = tools.setStatus;

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando idiomas...</div>';

    tools.loadCompanyData()
      .then(function (data) {
        var langs = (data.environment && data.environment.languages) || {};
        var list = langs.list || [];
        var def = langs.default || '';

        var html = '';
        html += '<div style="margin-bottom:10px"><span style="font-size:11px;font-weight:600;color:#64748b">IDIOMAS DISPONIBLES</span></div>';
        html += '<div id="kym-adm-langs-list" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">';

        ALL_LANGS.forEach(function (code) {
          var checked = list.indexOf(code) >= 0 ? 'checked' : '';
          html += '<label id="kym-lang-row-' + escHtml(code) + '" style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc">';
          html += '<input type="checkbox" class="kym-lang-check" id="kym-lang-' + escHtml(code) + '" value="' + escHtml(code) + '" ' + checked + ' style="width:15px;height:15px;accent-color:#1e293b;cursor:pointer">';
          html += '<span style="flex:1;font-size:13px">' + escHtml(LANG_NAMES[code] || code) + '</span>';
          html += '<span style="font-size:11px;color:#94a3b8;font-family:monospace">' + escHtml(code) + '</span>';
          html += '</label>';
        });

        html += '</div>';
        html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px">';
        html += '<div style="font-size:11px;font-weight:600;color:#1e40af;margin-bottom:6px">IDIOMA POR DEFECTO</div>';
        html += '<select id="kym-adm-lang-default" style="width:100%;padding:7px 10px;border:1px solid #bfdbfe;border-radius:6px;font-size:13px;background:white;color:#1a202c"></select>';
        html += '<div id="kym-adm-lang-default-err" style="display:none;color:#e53e3e;font-size:11px;margin-top:4px">&#9888; Debes tener al menos un idioma activo y seleccionar el idioma por defecto</div>';
        html += '</div>';
        html += '<button id="kym-adm-langs-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar idiomas</button>';
        html += '<div id="kym-adm-langs-status" style="display:none"></div>';

        container.innerHTML = html;

        function updateRowsAndDefault(keep) {
          var selected = [];
          ALL_LANGS.forEach(function (code) {
            var cb = $('kym-lang-' + code);
            var row = $('kym-lang-row-' + code);
            if (cb && cb.checked) selected.push(code);
            if (row && cb) {
              row.style.background = cb.checked ? '#f0fdf4' : '#f8fafc';
              row.style.borderColor = cb.checked ? '#bbf7d0' : '#e2e8f0';
            }
          });

          var sel = $('kym-adm-lang-default');
          sel.innerHTML = '';
          selected.forEach(function (code) {
            var opt = document.createElement('option');
            opt.value = code;
            opt.textContent = (LANG_NAMES[code] || code) + ' (' + code + ')';
            sel.appendChild(opt);
          });

          if (selected.indexOf(keep) >= 0) sel.value = keep;
          else if (selected.indexOf(def) >= 0) sel.value = def;
        }

        ALL_LANGS.forEach(function (code) {
          var cb = $('kym-lang-' + code);
          if (cb) {
            cb.addEventListener('change', function () {
              updateRowsAndDefault($('kym-adm-lang-default').value);
              $('kym-adm-lang-default-err').style.display = 'none';
            });
          }
        });

        updateRowsAndDefault(def);

        $('kym-adm-langs-save').onclick = async function () {
          var selected = [];
          ALL_LANGS.forEach(function (code) {
            var cb = $('kym-lang-' + code);
            if (cb && cb.checked) selected.push(code);
          });

          var defLang = $('kym-adm-lang-default').value;
          var errEl = $('kym-adm-lang-default-err');
          var status = $('kym-adm-langs-status');

          if (!selected.length || !defLang || selected.indexOf(defLang) < 0) {
            errEl.style.display = 'block';
            return;
          }

          errEl.style.display = 'none';

          if (!confirm('Se van a guardar los idiomas de ' + tools.state.companyName + '.\n\nIdiomas: ' + selected.join(', ') + '\nDefault: ' + defLang + '\n\n¿Quieres continuar?')) {
            return;
          }

          setStatus(status, '&#8987; Guardando...', 'info');

          try {
            await tools.putCompanyPayload({
              environment: {
                languages: {
                  list: selected,
                  default: defLang
                }
              }
            });
            setStatus(status, '&#10003; Idiomas guardados correctamente', 'ok');
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
    key: 'languages',
    label: 'Idiomas',
    icon: '&#127760;',
    order: 30,
    getJson: function (d) {
      return {
        environment: {
          languages: d.environment && d.environment.languages
        }
      };
    },
    renderGui: renderGui
  });
})();
