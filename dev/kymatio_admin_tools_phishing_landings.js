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

  function renderGui(container, tools) {
    var $ = tools.$;
    var escHtml = tools.escHtml;
    var setStatus = tools.setStatus;
    var safeJsonClone = tools.safeJsonClone;

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando post-landings...</div>';

    tools.loadCompanyData()
      .then(function (data) {
        var sc = data.servicesConfiguration || {};
        var ph = sc.phishing || {};
        var landData = safeJsonClone(ph.landingRedirect || []);
        var companyLangs = (data.environment && data.environment.languages && data.environment.languages.list) || ['es-es', 'en-us'];

        if (!Array.isArray(landData)) landData = [];

        function getItemTitle(item) {
          var names = item.landing || {};
          var keys = Object.keys(names);
          return names['es-es'] || names['es-mx'] || names['en-us'] || names[keys[0]] || '(sin nombre)';
        }

        function isLikelyUrl(value) {
          return /^https?:\/\//i.test(String(value || '').trim());
        }

        function renderList() {
          var list = $('kym-land-list');
          list.innerHTML = '';

          if (!landData.length) {
            list.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px">No hay post-landings configuradas</div>';
            return;
          }

          landData.forEach(function (item, idx) {
            var names = item.landing || {};
            var urls = item.url || {};
            var firstName = getItemTitle(item);

            var row = document.createElement('div');
            row.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;overflow:hidden';

            var header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer';

            var title = document.createElement('span');
            title.style.cssText = 'flex:1;font-size:13px;font-weight:500';
            title.textContent = firstName;

            var editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.style.cssText = 'background:#0369a1;color:white;border:none;padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer';

            var delBtn = document.createElement('button');
            delBtn.innerHTML = '&#10007;';
            delBtn.style.cssText = 'background:#fee2e2;color:#c53030;border:none;padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer';

            var arrow = document.createElement('span');
            arrow.innerHTML = '&#9660;';
            arrow.style.cssText = 'font-size:12px;color:#94a3b8';

            var detail = document.createElement('div');
            detail.style.cssText = 'display:none;padding:0 12px 10px;border-top:1px solid #e2e8f0;background:white';

            Object.keys(names).forEach(function (lang) {
              var block = document.createElement('div');
              block.style.cssText = 'margin-top:8px';
              block.innerHTML =
                '<div style="font-size:10px;font-weight:600;color:#64748b;margin-bottom:2px">' +
                escHtml((LANG_NAMES[lang] || lang).toUpperCase()) +
                '</div>' +
                '<div style="font-size:12px;color:#475569;word-break:break-all">&#128279; ' +
                escHtml(urls[lang] || '') +
                '</div>' +
                '<div style="font-size:12px;color:#475569">&#127760; ' +
                escHtml(names[lang] || '') +
                '</div>';
              detail.appendChild(block);
            });

            header.onclick = function () {
              detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            };

            editBtn.onclick = function (ev) {
              ev.stopPropagation();
              openLandingModal(idx);
            };

            delBtn.onclick = function (ev) {
              ev.stopPropagation();
              if (!confirm('¿Eliminar esta post-landing?')) return;
              landData.splice(idx, 1);
              renderList();
            };

            header.appendChild(title);
            header.appendChild(editBtn);
            header.appendChild(delBtn);
            header.appendChild(arrow);
            row.appendChild(header);
            row.appendChild(detail);
            list.appendChild(row);
          });
        }

        function buildModalLangBlock(lang, urlValue, nameValue) {
          var block = document.createElement('div');
          block.dataset.lang = lang;
          block.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#f8fafc';

          var top = document.createElement('div');
          top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';

          var label = document.createElement('span');
          label.style.cssText = 'font-size:11px;font-weight:600;color:#1e40af;text-transform:uppercase';
          label.textContent = (LANG_NAMES[lang] || lang) + ' (' + lang + ')';

          var removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&#10007;';
          removeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px';

          removeBtn.onclick = function () {
            block.remove();
            refreshLangSelect();
          };

          top.appendChild(label);
          top.appendChild(removeBtn);

          var urlLabel = document.createElement('label');
          urlLabel.textContent = 'URL de post-landing';
          urlLabel.style.cssText = 'font-size:11px;color:#64748b;display:block;margin-bottom:3px';

          var urlInput = document.createElement('input');
          urlInput.type = 'text';
          urlInput.dataset.field = 'url';
          urlInput.value = urlValue || '';
          urlInput.placeholder = 'https://...';
          urlInput.style.cssText = 'width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;margin-bottom:8px;box-sizing:border-box';

          var nameLabel = document.createElement('label');
          nameLabel.textContent = 'Nombre identificativo';
          nameLabel.style.cssText = 'font-size:11px;color:#64748b;display:block;margin-bottom:3px';

          var nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.dataset.field = 'name';
          nameInput.value = nameValue || '';
          nameInput.placeholder = 'Kymatio - página por defecto';
          nameInput.style.cssText = 'width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;box-sizing:border-box';

          block.appendChild(top);
          block.appendChild(urlLabel);
          block.appendChild(urlInput);
          block.appendChild(nameLabel);
          block.appendChild(nameInput);

          return block;
        }

        function refreshLangSelect() {
          var body = $('kym-land-modal-body');
          var sel = $('kym-land-modal-lang-add');
          if (!body || !sel) return;

          var existing = [];
          body.querySelectorAll('[data-lang]').forEach(function (el) {
            existing.push(el.dataset.lang);
          });

          sel.innerHTML = '';

          companyLangs.forEach(function (lang) {
            if (existing.indexOf(lang) < 0) {
              var opt = document.createElement('option');
              opt.value = lang;
              opt.textContent = LANG_NAMES[lang] || lang;
              sel.appendChild(opt);
            }
          });

          sel.parentElement.style.display = sel.options.length ? 'flex' : 'none';
        }

        function openLandingModal(idx) {
          var isNew = idx === -1;
          var item = isNew ? { url: {}, landing: {} } : safeJsonClone(landData[idx]);

          var overlay = document.createElement('div');
          overlay.id = 'kym-land-modal';
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center';

          var box = document.createElement('div');
          box.style.cssText = 'background:white;border-radius:12px;padding:24px;width:500px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';

          box.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
            '<div style="font-size:15px;font-weight:700;color:#1a202c">' +
            (isNew ? 'Nueva post-landing' : 'Editar post-landing') +
            '</div>' +
            '<button id="kym-land-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b;line-height:1">&#215;</button>' +
            '</div>' +
            '<div id="kym-land-modal-body" style="display:flex;flex-direction:column;gap:12px"></div>' +
            '<div style="display:flex;gap:8px;margin-top:16px">' +
            '<select id="kym-land-modal-lang-add" style="flex:1;padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px"></select>' +
            '<button id="kym-land-modal-add-lang" style="background:#0369a1;color:white;border:none;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">+ Idioma</button>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button id="kym-land-modal-cancel" style="flex:1;background:white;border:1px solid #e2e8f0;color:#475569;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">Cancelar</button>' +
            '<button id="kym-land-modal-save" style="flex:1;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Aplicar</button>' +
            '</div>';

          overlay.appendChild(box);
          document.body.appendChild(overlay);

          var body = $('kym-land-modal-body');
          var langs = Object.keys(item.landing || {});
          if (!langs.length) langs = companyLangs.slice(0, 2);

          langs.forEach(function (lang) {
            body.appendChild(
              buildModalLangBlock(
                lang,
                item.url && item.url[lang],
                item.landing && item.landing[lang]
              )
            );
          });

          refreshLangSelect();

          $('kym-land-modal-close').onclick = function () {
            overlay.remove();
          };

          $('kym-land-modal-cancel').onclick = function () {
            overlay.remove();
          };

          $('kym-land-modal-add-lang').onclick = function () {
            var sel = $('kym-land-modal-lang-add');
            var lang = sel.value;
            if (!lang) return;
            body.appendChild(buildModalLangBlock(lang, '', ''));
            refreshLangSelect();
          };

          $('kym-land-modal-save').onclick = function () {
            var newUrl = {};
            var newLanding = {};
            var valid = true;
            var invalidUrl = false;

            body.querySelectorAll('[data-lang]').forEach(function (block) {
              var lang = block.dataset.lang;
              var urlInput = block.querySelector('[data-field="url"]');
              var nameInput = block.querySelector('[data-field="name"]');

              var urlVal = urlInput.value.trim();
              var nameVal = nameInput.value.trim();

              if (!urlVal || !nameVal) valid = false;
              if (urlVal && !isLikelyUrl(urlVal)) invalidUrl = true;

              newUrl[lang] = urlVal;
              newLanding[lang] = nameVal;
            });

            if (!valid || !Object.keys(newUrl).length) {
              alert('Todos los campos son obligatorios.');
              return;
            }

            if (invalidUrl) {
              alert('Las URLs deben empezar por http:// o https://.');
              return;
            }

            var newItem = {
              url: newUrl,
              landing: newLanding
            };

            if (isNew) landData.push(newItem);
            else landData[idx] = newItem;

            overlay.remove();
            renderList();
          };
        }

        var html = '';
        html += '<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">';
        html += '<span style="font-size:11px;font-weight:600;color:#64748b">POST-LANDINGS DE PHISHING</span>';
        html += '<button id="kym-land-add" style="background:#0369a1;color:white;border:none;padding:5px 12px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">+ Añadir post-landing</button>';
        html += '</div>';
        html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#1e40af;font-size:12px;line-height:1.5">';
        html += 'Cada post-landing contiene una <strong>URL</strong> y un <strong>nombre identificativo</strong> por idioma.';
        html += '</div>';
        html += '<div id="kym-land-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px"></div>';
        html += '<button id="kym-land-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar post-landings</button>';
        html += '<div id="kym-land-status" style="display:none"></div>';

        container.innerHTML = html;

        $('kym-land-add').onclick = function () {
          openLandingModal(-1);
        };

        $('kym-land-save').onclick = async function () {
          var status = $('kym-land-status');

          if (!confirm('Se van a guardar las post-landings de ' + tools.state.companyName + '.\n\n¿Quieres continuar?')) return;

          setStatus(status, '&#8987; Guardando...', 'info');

          try {
            var currentData = await tools.loadCompanyData();
            var currentSc = currentData.servicesConfiguration || {};
            var currentPh = currentSc.phishing || {};

            var payload = {
              servicesConfiguration: Object.assign({}, currentSc, {
                phishing: Object.assign({}, currentPh, {
                  landingRedirect: landData
                })
              })
            };

            await tools.putCompanyPayload(payload);
            setStatus(status, '&#10003; Post-landings guardadas correctamente', 'ok');
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
    key: 'phish_land',
    label: 'Phishing: Post-landings',
    icon: '&#127760;',
    order: 60,
    getJson: function (d) {
      return {
        servicesConfiguration: {
          phishing: {
            landingRedirect:
              d.servicesConfiguration &&
              d.servicesConfiguration.phishing &&
              d.servicesConfiguration.phishing.landingRedirect
          }
        }
      };
    },
    renderGui: renderGui
  });
})();
