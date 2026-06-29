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

    container.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando adjuntos...</div>';

    tools.loadCompanyData()
      .then(function (data) {
        var sc = data.servicesConfiguration || {};
        var ph = sc.phishing || {};
        var attData = safeJsonClone(ph.attachment || []);
        var companyLangs = (data.environment && data.environment.languages && data.environment.languages.list) || ['es-es', 'en-us'];

        function renderList() {
          var list = $('kym-att-list');
          list.innerHTML = '';

          if (!attData.length) {
            list.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px">No hay adjuntos configurados</div>';
            return;
          }

          attData.forEach(function (item, idx) {
            var names = item.attachment || {};
            var urls = item.url || {};
            var firstName = names['es-es'] || names['es-mx'] || names['en-us'] || names[Object.keys(names)[0]] || '(sin nombre)';

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
                '<div style="font-size:12px;color:#475569">&#128196; ' +
                escHtml(urls[lang] || '') +
                '</div>' +
                '<div style="font-size:12px;color:#475569">&#128065; ' +
                escHtml(names[lang] || '') +
                '</div>';
              detail.appendChild(block);
            });

            header.onclick = function () {
              detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            };

            editBtn.onclick = function (ev) {
              ev.stopPropagation();
              openAttachmentModal(idx);
            };

            delBtn.onclick = function (ev) {
              ev.stopPropagation();
              if (!confirm('¿Eliminar este adjunto?')) return;
              attData.splice(idx, 1);
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
          };

          top.appendChild(label);
          top.appendChild(removeBtn);

          var urlLabel = document.createElement('label');
          urlLabel.textContent = 'Archivo (URL)';
          urlLabel.style.cssText = 'font-size:11px;color:#64748b;display:block;margin-bottom:3px';

          var urlInput = document.createElement('input');
          urlInput.type = 'text';
          urlInput.dataset.field = 'url';
          urlInput.value = urlValue || '';
          urlInput.placeholder = 'archivo.docx';
          urlInput.style.cssText = 'width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;margin-bottom:8px;box-sizing:border-box';

          var nameLabel = document.createElement('label');
          nameLabel.textContent = 'Nombre a mostrar';
          nameLabel.style.cssText = 'font-size:11px;color:#64748b;display:block;margin-bottom:3px';

          var nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.dataset.field = 'name';
          nameInput.value = nameValue || '';
          nameInput.placeholder = 'Descripción del adjunto';
          nameInput.style.cssText = 'width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;box-sizing:border-box';

          block.appendChild(top);
          block.appendChild(urlLabel);
          block.appendChild(urlInput);
          block.appendChild(nameLabel);
          block.appendChild(nameInput);

          return block;
        }

        function openAttachmentModal(idx) {
          var isNew = idx === -1;
          var item = isNew ? { url: {}, attachment: {} } : safeJsonClone(attData[idx]);

          var overlay = document.createElement('div');
          overlay.id = 'kym-att-modal';
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center';

          var box = document.createElement('div');
          box.style.cssText = 'background:white;border-radius:12px;padding:24px;width:460px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';

          box.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
            '<div style="font-size:15px;font-weight:700;color:#1a202c">' +
            (isNew ? 'Nuevo adjunto' : 'Editar adjunto') +
            '</div>' +
            '<button id="kym-att-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b;line-height:1">&#215;</button>' +
            '</div>' +
            '<div id="kym-att-modal-body" style="display:flex;flex-direction:column;gap:12px"></div>' +
            '<div style="display:flex;gap:8px;margin-top:16px">' +
            '<select id="kym-att-modal-lang-add" style="flex:1;padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px"></select>' +
            '<button id="kym-att-modal-add-lang" style="background:#0369a1;color:white;border:none;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">+ Idioma</button>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button id="kym-att-modal-cancel" style="flex:1;background:white;border:1px solid #e2e8f0;color:#475569;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">Cancelar</button>' +
            '<button id="kym-att-modal-save" style="flex:1;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Aplicar</button>' +
            '</div>';

          overlay.appendChild(box);
          document.body.appendChild(overlay);

          var body = $('kym-att-modal-body');
          var langs = Object.keys(item.attachment || {});
          if (!langs.length) langs = companyLangs.slice(0, 2);

          langs.forEach(function (lang) {
            body.appendChild(
              buildModalLangBlock(
                lang,
                item.url && item.url[lang],
                item.attachment && item.attachment[lang]
              )
            );
          });

          function refreshLangSelect() {
            var existing = [];
            body.querySelectorAll('[data-lang]').forEach(function (el) {
              existing.push(el.dataset.lang);
            });

            var sel = $('kym-att-modal-lang-add');
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

          refreshLangSelect();

          $('kym-att-modal-close').onclick = function () {
            overlay.remove();
          };

          $('kym-att-modal-cancel').onclick = function () {
            overlay.remove();
          };

          $('kym-att-modal-add-lang').onclick = function () {
            var sel = $('kym-att-modal-lang-add');
            var lang = sel.value;
            if (!lang) return;
            body.appendChild(buildModalLangBlock(lang, '', ''));
            refreshLangSelect();
          };

          $('kym-att-modal-save').onclick = function () {
            var newUrl = {};
            var newAttachment = {};
            var valid = true;

            body.querySelectorAll('[data-lang]').forEach(function (block) {
              var lang = block.dataset.lang;
              var urlInput = block.querySelector('[data-field="url"]');
              var nameInput = block.querySelector('[data-field="name"]');

              var urlVal = urlInput.value.trim();
              var nameVal = nameInput.value.trim();

              if (!urlVal || !nameVal) valid = false;

              newUrl[lang] = urlVal;
              newAttachment[lang] = nameVal;
            });

            if (!valid || !Object.keys(newUrl).length) {
              alert('Todos los campos son obligatorios.');
              return;
            }

            var newItem = {
              url: newUrl,
              attachment: newAttachment
            };

            if (isNew) attData.push(newItem);
            else attData[idx] = newItem;

            overlay.remove();
            renderList();
          };
        }

        var html = '';
        html += '<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">';
        html += '<span style="font-size:11px;font-weight:600;color:#64748b">ADJUNTOS DE PHISHING</span>';
        html += '<button id="kym-att-add" style="background:#0369a1;color:white;border:none;padding:5px 12px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">+ Añadir adjunto</button>';
        html += '</div>';
        html += '<div id="kym-att-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px"></div>';
        html += '<button id="kym-att-save" style="width:100%;background:#1e293b;color:white;border:none;padding:9px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">&#10003; Guardar adjuntos</button>';
        html += '<div id="kym-att-status" style="display:none"></div>';

        container.innerHTML = html;

        $('kym-att-add').onclick = function () {
          openAttachmentModal(-1);
        };

        $('kym-att-save').onclick = async function () {
          var status = $('kym-att-status');

          if (!confirm('Se van a guardar los adjuntos de ' + tools.state.companyName + '.\n\n¿Quieres continuar?')) return;

          setStatus(status, '&#8987; Guardando...', 'info');

          try {
            var currentData = await tools.loadCompanyData();
            var currentSc = currentData.servicesConfiguration || {};
            var currentPh = currentSc.phishing || {};

            var payload = {
              servicesConfiguration: Object.assign({}, currentSc, {
                phishing: Object.assign({}, currentPh, {
                  attachment: attData
                })
              })
            };

            await tools.putCompanyPayload(payload);
            setStatus(status, '&#10003; Adjuntos guardados correctamente', 'ok');
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
    key: 'phish_att',
    label: 'Phishing: Adjuntos',
    icon: '&#128206;',
    order: 50,
    getJson: function (d) {
      return {
        servicesConfiguration: {
          phishing: {
            attachment:
              d.servicesConfiguration &&
              d.servicesConfiguration.phishing &&
              d.servicesConfiguration.phishing.attachment
          }
        }
      };
    },
    renderGui: renderGui
  });
})();
