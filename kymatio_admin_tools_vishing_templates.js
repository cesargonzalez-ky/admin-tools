(function () {
  'use strict';

  var KAT = window.KymatioAdminTools;
  if (!KAT) return;

  var SURVEY_TYPE_ID = 10;
  var AGENT_ID = 151;

  var LANG_NAMES = { 'es-es':'Español','es-mx':'Español (Latam)','en-us':'Inglés','eu':'Euskera','pl':'Polaco','cat':'Catalán','pt-pt':'Portugués (Portugal)','pt-br':'Portugués (Brasil)','sv':'Sueco','fr':'Francés','it':'Italiano','de':'Alemán' };
  var CATEGORIES = [
    { id:1,label:'Corporate',token:'CORPORATE' },{ id:2,label:'Shopping',token:'SHOPPING' },{ id:3,label:'Banking',token:'BANKING' },{ id:4,label:'Public',token:'PUBLIC' },{ id:5,label:'Custom',token:'CUSTOM' },{ id:6,label:'Other',token:'OTHER' },{ id:8,label:'Bets&Gaming',token:'BETS_GAMING' },{ id:9,label:'Delivery',token:'DELIVERY' },{ id:10,label:'Media&online',token:'MEDIA_ONLINE' }
  ];
  var LEVELS = [ { id:1,label:'Básico',token:'BASIC' },{ id:2,label:'Medio',token:'MEDIUM' },{ id:3,label:'Avanzado',token:'ADVANCED' } ];
  var VOICES = [
    ['Benedita','Femenino','Portugués','Portuguesa'],['Lucy','Femenino','Inglés','Británica'],['Jules','Masculino','Francés','Francés'],['Brando','Masculino','Italiano','Italiano'],['Laura','Femenino','Español','Madrileña'],['Ana','Femenino','Español','Andaluz'],['Carmen','Femenino','Español','Extremeño'],['Fernanda','Femenino','Español','Chileno'],['Nicolás','Masculino','Español','Chileno'],['Mónica','Femenino','Español','Castellano'],['Juan','Masculino','Español','Mexicano'],['Daniela','Femenino','Español','Colombiana'],['João','Masculino','Portugués','Portugués'],['Sara','Femenino','Español','Madrileña'],['María','Femenino','Español','Valenciano'],['Antonio','Masculino','Español','Castellano'],['Lauren','Femenino','Inglés','Norteamericano'],['Arianna','Femenino','Italiano','Italiana'],['Mark','Masculino','Inglés','Norteamericano'],['Socorrinha','Femenino','Portugués','Portuguesa'],['Marlene','Femenino','Español','Mexicana'],['Laura (fast)','Femenino','Español','Madrileña'],['Amélie','Femenino','Francés','Canadiense'],['Marcèles','Masculino','Neerlandés','Holandés'],['Julia','Femenino','Español','Mexicana'],['Adam','Masculino','Inglés','Americano'],['Callie','Femenino','Inglés','Americana']
  ];
  var EVENTS = [
    ['USER_EMAIL','Correo electrónico'],['USER_DNI','DNI / documento de identidad'],['USER_LOCATION','Ubicación / dirección'],['USER_PASSWORD','Contraseña'],['USER_MANAGER','Responsable / manager'],['USER_BANK_ACCOUNT','Cuenta bancaria'],['USER_CREDIT_CARD','Tarjeta de crédito'],['USER_POSITION','Departamento / puesto']
  ];
  var DEF = {
    CALL_SENT:{level:2,condition:null,puntuation:1,icon:'sending.svg',color:'#1BC5BD'},
    USER_EMAIL:{level:4,condition:null,puntuation:0.3,icon:'write.svg',color:'#FFA500'},
    USER_DNI:{level:3,condition:null,puntuation:0.6,icon:'write.svg',color:'#FFA500'},
    USER_LOCATION:{level:3,condition:null,puntuation:0.6,icon:'write.svg',color:'#FFA500'},
    USER_PASSWORD:{level:5,condition:null,puntuation:0,icon:'write.svg',color:'#F64E60'},
    USER_MANAGER:{level:4,condition:null,puntuation:0.4,icon:'write.svg',color:'#FFA500'},
    USER_BANK_ACCOUNT:{level:5,condition:null,puntuation:0,icon:'write.svg',color:'#F64E60'},
    USER_CREDIT_CARD:{level:5,condition:null,puntuation:0,icon:'write.svg',color:'#F64E60'},
    USER_POSITION:{level:4,condition:null,puntuation:0.4,icon:'write.svg',color:'#FFA500'}
  };
  var DAYS = [['Monday','Lunes'],['Tuesday','Martes'],['Wednesday','Miércoles'],['Thursday','Jueves'],['Friday','Viernes'],['Saturday','Sábado'],['Sunday','Domingo']];

  function renderGui(container, tools) {
    var state = { langs:['es-es'], defLang:'es-es', list:[], page:0, dirty:false };
    var $ = tools.$;
    var esc = tools.escHtml;
    var status = tools.setStatus;

    function h(v){ return esc(v == null ? '' : v); }
    function css(extra){ return 'width:100%;padding:7px 9px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;box-sizing:border-box;background:white;color:#1a202c;' + (extra || ''); }
    function label(t, req){ return '<label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">' + h(t) + (req ? ' <span style="color:#e53e3e">*</span>' : '') + '</label>'; }
    function title(t){ return '<div style="font-size:12px;font-weight:800;color:#1e293b;margin:16px 0 8px;padding-top:10px;border-top:1px solid #e2e8f0">' + h(t) + '</div>'; }
    function val(id){ var e=$(id); return e ? String(e.value || '').trim() : ''; }
    function org(){ return (tools.state.companyName || 'Organización sin nombre') + ' (' + (tools.state.companyId || '?') + ')'; }
    function headers(){ return { 'Content-Type':'application/json', Authorization:'Bearer ' + tools.state.token }; }
    function opt(list, selected, valueKey, labelKey){
      var s='';
      list.forEach(function (x) { var v = valueKey ? x[valueKey] : x[0]; var l = labelKey ? x[labelKey] : x[1]; s += '<option value="' + h(v) + '" ' + (String(v) === String(selected) ? 'selected' : '') + '>' + h(l) + '</option>'; });
      return s;
    }
    function langOptions(sel){ var s=''; state.langs.forEach(function(code){ s+='<option value="'+h(code)+'" '+(code===sel?'selected':'')+'>'+h((LANG_NAMES[code]||code)+' ('+code+')')+'</option>'; }); return s; }
    function catOptions(sel){ return opt(CATEGORIES, sel, 'id', 'label'); }
    function lvlOptions(sel){ return opt(LEVELS, sel, 'id', 'label'); }
    function voiceOptions(sel){ var s='<option value="">Seleccionar voz...</option>'; VOICES.forEach(function(v){ var txt=v[0]+' - '+v[1]+' - '+v[2]+' - '+v[3]; s+='<option value="'+h(v[0])+'" '+(v[0]===sel?'selected':'')+'>'+h(txt)+'</option>'; }); return s; }
    function eventOptions(sel){ var s='<option value="">Sin evento</option>'; EVENTS.forEach(function(e){ s+='<option value="'+h(e[0])+'" '+(e[0]===sel?'selected':'')+'>'+h(e[1]+' ('+e[0]+')')+'</option>'; }); return s; }
    function iconOptions(sel){ return '<option value="sending.svg" '+(sel==='sending.svg'?'selected':'')+'>sending.svg - llamada enviada</option><option value="write.svg" '+(sel==='write.svg'?'selected':'')+'>write.svg - recogida de información</option>'; }
    function byId(list,id){ for(var i=0;i<list.length;i++){ if(String(list[i].id)===String(id)) return list[i]; } return list[0]; }
    function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_').toUpperCase() || 'TEMPLATE'; }
    function suggest(){ return byId(CATEGORIES,val('kat-vcat')).token + '_' + byId(LEVELS,val('kat-vlev')).token + '_VISHING_' + norm(val('kat-vname') || 'Plantilla'); }
    function syncCampaign(force){ var e=$('kat-vctype'); if(e && (force || !state.dirty)) e.value=suggest(); }
    function parseNum(v, name, dec){ var n=dec ? parseFloat(String(v).replace(',','.')) : parseInt(v,10); if(!isFinite(n)) throw new Error(name + ' debe ser numérico.'); return n; }
    function req(v, name){ if(!String(v||'').trim()) throw new Error('El campo "' + name + '" es obligatorio.'); }
    function cond(v){ var s=String(v||'').trim(); return (!s || s.toLowerCase()==='null') ? null : s; }
    function assertTime(a,b,name){ if(!/^\d{2}:\d{2}$/.test(a)||!/^\d{2}:\d{2}$/.test(b)) throw new Error(name + ' debe tener formato HH:MM.'); if(b<=a) throw new Error(name + ': la hora final debe ser posterior.'); }

    async function fetchJson(url, options){
      var res = await fetch(url, Object.assign({ headers:headers() }, options || {}));
      var json = null;
      try { json = await res.json(); } catch(e) {}
      if(!res.ok) throw new Error((json && json.records && json.records.devMessage) || (json && json.message) || ('Error HTTP ' + res.status));
      return json;
    }
    function findId(obj, keys){
      var found = null;
      function walk(x){
        if(found || !x || typeof x !== 'object') return;
        keys.forEach(function(k){ if(!found && x[k] != null && /^\d+$/.test(String(x[k]))) found = Number(x[k]); });
        Object.keys(x).forEach(function(k){ if(!found) walk(x[k]); });
      }
      walk(obj);
      return found;
    }
    function extractCampaignTypeId(json){ var id=findId(json,['campaignTypeId','typeId','id']); if(!id) throw new Error('No he podido detectar el campaignTypeId en la respuesta del armazón. Revisa consola.'); return id; }
    function nameOf(item){ var d=item && item.name && item.name.name && item.name.name.dictionary; return d ? (d['es-es'] || d[state.defLang] || d[Object.keys(d)[0]] || '') : (item && (item.name || item.templateName || item.campaignType) || '(sin nombre)'); }
    function typeIdOf(item){ return item && (item.common && item.common.campaignTypeId || item.campaignTypeId || item.typeId || '') || ''; }
    function templateIdOf(item){ return item && (item.templateId || item.campaignTemplateId || item.campaignTypeId || '') || ''; }
    function extractList(json){ var arrays=[]; function add(a){ if(Array.isArray(a)) arrays.push(a); } add(json); if(json){ add(json.records); add(json.records&&json.records.types); add(json.records&&json.records.content); add(json.records&&json.records.data); add(json.types); add(json.content); add(json.data); } var best=[]; arrays.forEach(function(a){ var f=a.filter(function(x){ return x && Number(x.surveyTypeId)===SURVEY_TYPE_ID; }); if(f.length>best.length) best=f; }); return best; }
    function detectCampaignListId(){ try{ var st=document.querySelector('#app').__vue_app__.config.globalProperties.$store.state; var c=(st.Admin&&st.Admin.companySelected)||(st.Controller&&st.Controller.companySelected); return findId(c,['controllerCampaignId','campaignId','campaign_id']) || tools.state.companyId || ''; }catch(e){ return tools.state.companyId || ''; } }

    function shell(){ return '<div style="background:#fff7ed;border:2px solid #fb923c;border-radius:10px;padding:12px 14px;margin-bottom:12px;color:#9a3412"><div style="font-size:22px;font-weight:900">BORRADOR</div><div style="font-size:12px">Módulo inicial en pruebas. No usar como definitivo hasta validación.</div></div>'; }

    function renderList(){
      var cid = detectCampaignListId();
      container.innerHTML = shell() +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:11px;font-weight:700;color:#64748b">PLANTILLAS DE VISHING</span><button id="kat-vnew" style="background:#1e293b;color:white;border:0;padding:7px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">+ Crear nueva</button></div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>' + label('Buscar',false) + '<input id="kat-vsearch" style="'+css()+'" placeholder="Nombre o campaignType"></div><div>' + label('ID campaña para listado (borrador)',false) + '<input id="kat-vlistid" value="'+h(cid)+'" style="'+css()+'"></div></div>' +
        '<button id="kat-vload" style="width:100%;background:#0369a1;color:white;border:0;padding:8px;border-radius:6px;font-weight:700;cursor:pointer;margin-bottom:10px">↻ Cargar listado</button>' +
        '<div id="kat-vrows"></div><div style="display:flex;gap:8px;align-items:center"><button id="kat-vprev" style="padding:5px 10px;border:1px solid #e2e8f0;background:white;border-radius:5px">Anterior</button><div id="kat-vpage" style="flex:1;text-align:center;font-size:11px;color:#64748b">Sin cargar</div><button id="kat-vnext" style="padding:5px 10px;border:1px solid #e2e8f0;background:white;border-radius:5px">Siguiente</button></div><div id="kat-vstatus" style="display:none"></div>';
      $('kat-vnew').onclick=function(){ renderForm('create'); };
      $('kat-vload').onclick=loadList;
      $('kat-vsearch').oninput=function(){ state.page=0; renderRows(); };
      $('kat-vprev').onclick=function(){ state.page--; renderRows(); };
      $('kat-vnext').onclick=function(){ state.page++; renderRows(); };
      renderRows();
    }
    async function loadList(){
      var st=$('kat-vstatus');
      try{
        status(st,'⌛ Cargando plantillas...','info');
        var cid = tools.state.companyId || tools.state.cid || val('kat-vlistid');
        state.cid = cid;
        // Nuevo endpoint: /campaigns/templates?companyId={cid}
        var json = await fetchJson(
          'https://api.kymatio.com/v2/campaigns/templates?companyId=' + encodeURIComponent(cid)
        );
        var all = Array.isArray(json.records) ? json.records : [];
        // Filtrar solo vishing (surveyTypeId=10)
        state.list = all.filter(function(r){ return r.common && Number(r.common.surveyTypeId) === SURVEY_TYPE_ID; });
        state.page = 0;
        status(st,'✓ Plantillas cargadas: '+state.list.length,'ok');
        renderRows();
      }catch(e){ status(st,'✗ '+h(e.message),'err'); }
    }
    function renderRows(){
      var box=$('kat-vrows'); if(!box) return;
      var q=String(val('kat-vsearch')).toLowerCase();
      var activeCidStr = String(state.cid||'');
      var data=state.list.filter(function(it){
        var matchSearch = !q || (nameOf(it)+' '+(it.campaignType||'')+' '+typeIdOf(it)).toLowerCase().indexOf(q)>=0;
        var matchCid = !activeCidStr || !it.stakeholderCompanyId || String(it.stakeholderCompanyId)===activeCidStr;
        return matchSearch && matchCid;
      });
      var max=Math.max(0,Math.ceil(data.length/5)-1); if(state.page<0) state.page=0; if(state.page>max) state.page=max;
      var rows=data.slice(state.page*5,state.page*5+5); box.innerHTML='';
      if(!rows.length) box.innerHTML='<div style="padding:16px;text-align:center;color:#94a3b8;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;margin-bottom:10px">No hay plantillas para mostrar.</div>';
      rows.forEach(function(it){ var row=document.createElement('div'); row.style.cssText='border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px'; var itName = it.name || (it.common && it.common.campaignTypeId) || '?';
        var itCtype = it.common && it.common.campaignTypeId ? 'campaignTypeId: '+it.common.campaignTypeId : '';
        row.innerHTML='<div style="display:flex;gap:8px;align-items:center"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h(itName)+'</div><div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h(itCtype)+'</div><div class="kym-langs" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px"></div></div><button class="edit" style="background:#0369a1;color:white;border:0;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Editar</button></div>'; var localesHtml = (it.locales||[]).map(function(l){ return '<span style="background:#eff6ff;color:#1e40af;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600">'+h(l)+'</span>'; }).join(' ');
        row.querySelector('.kym-langs').innerHTML = localesHtml;
        row.querySelector('.edit').onclick=function(){ renderForm('edit',it); }; box.appendChild(row); });
      if($('kat-vpage')) $('kat-vpage').textContent='Página '+(state.page+1)+' de '+(max+1)+' · '+data.length+' plantillas';
      if($('kat-vprev')) $('kat-vprev').disabled=state.page<=0; if($('kat-vnext')) $('kat-vnext').disabled=state.page>=max;
    }

    function paramsHtml(){ var d=[['target_name','{{PERSON_NAME}}'],['phone_number','{{PHONE_NUMBER}}'],['target_information','{{COMPANY_NAME}}'],['',''],['',''],['','']]; var s=''; for(var i=0;i<6;i++){ s+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px"><input id="kat-vpkey'+i+'" placeholder="clave" value="'+h(d[i][0])+'" style="'+css()+'"><input id="kat-vpval'+i+'" placeholder="valor" value="'+h(d[i][1])+'" style="'+css()+'"></div>'; } return s; }
    function daysHtml(){ var active=['Monday','Tuesday','Wednesday','Thursday','Friday']; var s='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'; DAYS.forEach(function(d){ s+='<label style="font-size:12px;color:#475569"><input id="kat-vday'+d[0]+'" type="checkbox" '+(active.indexOf(d[0])>=0?'checked':'')+'> '+h(d[1])+'</label>'; }); return s+'</div>'; }
    function eventBlock(i){ var d={level:4,condition:null,puntuation:0.4,icon:'write.svg',color:'#FFA500'}; return '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px">Evento '+i+'</div><div style="display:grid;grid-template-columns:1fr 70px 90px;gap:8px;margin-bottom:8px"><div>'+label('Evento',false)+'<select id="kat-vevent'+i+'" style="'+css()+'">'+eventOptions('')+'</select></div><div>'+label('Nivel',false)+'<input id="kat-vlvl'+i+'" type="number" value="'+d.level+'" style="'+css()+'"></div><div>'+label('Puntuación',false)+'<input id="kat-vpunt'+i+'" type="number" step="0.1" value="'+d.puntuation+'" style="'+css()+'"></div></div><div style="display:grid;grid-template-columns:1fr 1fr 90px;gap:8px;margin-bottom:8px"><div>'+label('Condición',false)+'<input id="kat-vcond'+i+'" value="null" style="'+css()+'"></div><div>'+label('Icono',false)+'<select id="kat-vicon'+i+'" style="'+css()+'">'+iconOptions(d.icon)+'</select></div><div>'+label('Color',false)+'<input id="kat-vcolor'+i+'" type="color" value="'+d.color+'" style="'+css('padding:2px;height:32px')+'"></div></div><div>'+label('Prompt de extracción',false)+'<textarea id="kat-vext'+i+'" rows="4" style="'+css('resize:vertical')+'"></textarea></div></div>'; }
    function setEventDefault(i){ var e=val('kat-vevent'+i); if(!e) return; var d=DEF[e]||DEF.USER_MANAGER; $('kat-vlvl'+i).value=d.level; $('kat-vcond'+i).value=d.condition==null?'null':d.condition; $('kat-vpunt'+i).value=d.puntuation; $('kat-vicon'+i).value=d.icon; $('kat-vcolor'+i).value=d.color; }

    async function loadFullTemplate(item) {
      // item viene de /campaigns/templates — tiene id, locales[], common.campaignTypeId
      var templateId = item.id || item.templateId;
      var cid = state.cid || tools.state.companyId;
      var locales = item.locales || ['es-es'];
      var campaignTypeId = item.common && item.common.campaignTypeId;
      var listId = cid; // listId = companyId para el endpoint controller

      if (!templateId || !campaignTypeId) throw new Error('No se pudo obtener templateId o campaignTypeId del item.');

      // Paso 1: obtener templateCampaignId desde el endpoint de detalle
      var detailJson = await fetchJson(
        'https://api.kymatio.com/v2/campaigns/templates/' + encodeURIComponent(templateId) + '?companyId=' + encodeURIComponent(cid)
      );
      var detail = detailJson.records || detailJson;
      var templateCampaignId = detail.templateCampaignId || detail.id || templateId;

      // Paso 2: cargar el contenido de cada idioma via controller
      var templates = await Promise.all(locales.map(function(locale) {
        return fetchJson(
          'https://api.kymatio.com/v2/controller/campaigns/' + encodeURIComponent(listId) +
          '/templates/' + encodeURIComponent(campaignTypeId) + '?locale=' + encodeURIComponent(locale)
        ).then(function(r) {
          var rec = r.records || {};
          return {
            locale: locale,
            templateCampaignId: templateCampaignId,
            rec: rec
          };
        }).catch(function() {
          return { locale: locale, templateCampaignId: templateCampaignId, rec: {} };
        });
      }));

      return templates; // array de { locale, templateCampaignId, rec }
    }

    function renderForm(mode,item){
      state.dirty = mode === 'edit';
      var initialTypeId=typeIdOf(item); var initialTplId=templateIdOf(item);
      var initialName=nameOf(item)||''; var initialCampaign=item&&item.campaignType||'';

      if (mode === 'edit') {
        container.innerHTML = shell() + '<div style="padding:20px;text-align:center;color:#64748b">&#8987; Cargando plantilla...</div>';
        loadFullTemplate(item).then(function(templates) {
          // templates = array de { locale, templateCampaignId, rec }
          state.editTemplates = templates; // guardar para save multiidioma
          state.activeLocale = templates[0] && templates[0].locale;
          renderMultiLangTabs(item, templates);
        }).catch(function(e) {
          container.innerHTML = shell() + '<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">&#10007; Error cargando plantilla: ' + h(e.message) + '</div>';
          document.getElementById('kat-vback') && (document.getElementById('kat-vback').onclick = renderList);
        });
        return;
      }

      renderFormHtml(mode, item, {
        name: initialName, campaign: initialCampaign,
        typeId: initialTypeId, tplId: initialTplId,
        templateCampaignId: null,
        greeting: '', locale: state.defLang,
        p1: {}, p2: null, timetable: {},
        calculus: [], extraction: {}, eventsStyle: {}, params: {}
      });
    }

    function renderFormHtml(mode, item, d, targetEl) {
      var initialName = d.name, initialCampaign = d.campaign;
      var initialTypeId = d.typeId, initialTplId = d.tplId;
      var initialTemplateCampaignId = d.templateCampaignId;
      if (targetEl) {
        targetEl.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:11px;font-weight:700;color:#64748b">'+(mode==='create'?'CREAR PLANTILLA':'EDITAR PLANTILLA')+'</span><button id="kat-vback" style="background:0;border:0;color:#64748b;text-decoration:underline;cursor:pointer">← Volver</button></div>' +
        '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#1e40af;font-size:12px"><b>Organización:</b><br>'+h(org())+'</div>' +
        title('1. Identificación') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>'+label('Nombre de la plantilla',true)+'<input id="kat-vname" value="'+h(initialName)+'" style="'+css()+'"></div><div>'+label('Idioma',true)+'<select id="kat-vlang" style="'+css()+'">'+langOptions(state.defLang)+'</select></div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>'+label('Categoría',true)+'<select id="kat-vcat" style="'+css()+'">'+catOptions(5)+'</select></div><div>'+label('Nivel',true)+'<select id="kat-vlev" style="'+css()+'">'+lvlOptions(3)+'</select></div></div>' +
        '<div style="margin-bottom:8px">'+label('Tipo de campaña',true)+'<input id="kat-vctype" value="'+h(initialCampaign)+'" style="'+css()+'"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>'+label('campaignTypeId',false)+'<input id="kat-vtypeid" value="'+h(initialTypeId)+'" readonly style="'+css('background:#f8fafc;color:#64748b')+'"></div><div>'+label('templateId',false)+'<input id="kat-vtplid" value="'+h(initialTplId)+'" readonly style="'+css('background:#f8fafc;color:#64748b')+'"></div></div>' +
        '<div>'+label('Agente',false)+'<input value="151" readonly style="'+css('background:#f8fafc;color:#64748b')+'"></div>' +
        title('2. Configuración del agente') + '<div>'+label('Saludo inicial',true)+'<textarea id="kat-vgreeting" rows="4" style="'+css('resize:vertical')+'"></textarea></div>' +
        title('3. Perfiles de voz') +
        '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Perfil 1 obligatorio</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>'+label('Nombre del personaje',true)+'<input id="kat-vpname1" style="'+css()+'"></div><div>'+label('Voz del personaje',true)+'<select id="kat-vvoice1" style="'+css()+'">'+voiceOptions('')+'</select></div></div></div>' +
        '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Perfil 2 opcional</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>'+label('Nombre del personaje',false)+'<input id="kat-vpname2" style="'+css()+'"></div><div>'+label('Voz del personaje',false)+'<select id="kat-vvoice2" style="'+css()+'">'+voiceOptions('')+'</select></div></div></div>' +
        title('4. Contexto de la llamada') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>'+label('Empresa ficticia',true)+'<input id="kat-vcompany" style="'+css()+'"></div><div>'+label('Departamento ficticio',true)+'<input id="kat-vdept" style="'+css()+'"></div></div><div style="margin-bottom:8px">'+label('Información del personaje',true)+'<input id="kat-vpersoninfo" style="'+css()+'"></div><div style="margin-bottom:8px">'+label('Información de la empresa',true)+'<textarea id="kat-vcompanyinfo" rows="3" style="'+css('resize:vertical')+'"></textarea></div><div>'+label('Información del departamento',true)+'<textarea id="kat-vdeptinfo" rows="3" style="'+css('resize:vertical')+'"></textarea></div>' +
        title('5. Programación de llamadas - configuración avanzada') + '<details open style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:#475569">Horario y límites</summary><div style="margin-top:10px">'+label('Días',true)+daysHtml()+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>'+label('Franja 1 inicio',true)+'<input id="kat-vt1s" type="time" value="09:00" style="'+css()+'"></div><div>'+label('Franja 1 fin',true)+'<input id="kat-vt1e" type="time" value="14:00" style="'+css()+'"></div><div>'+label('Franja 2 inicio',false)+'<input id="kat-vt2s" type="time" value="16:00" style="'+css()+'"></div><div>'+label('Franja 2 fin',false)+'<input id="kat-vt2e" type="time" value="18:00" style="'+css()+'"></div><div>'+label('Intervalo entre llamadas',true)+'<input id="kat-vinterval" type="number" value="2" min="1" style="'+css()+'"></div><div>'+label('Límite de llamadas',true)+'<input id="kat-vlimit" type="number" value="2" min="1" style="'+css()+'"></div></div></details>' +
        title('6. Parámetros de la llamada') + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px">'+paramsHtml()+'</div>' +
        title('7. Eventos de la campaña') + '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Evento 0 fijo</b><div style="display:grid;grid-template-columns:1fr 70px 90px;gap:8px;margin-top:8px"><input value="CALL_SENT" readonly style="'+css('background:#f8fafc;color:#64748b')+'"><input value="2" readonly style="'+css('background:#f8fafc;color:#64748b')+'"><input value="1" readonly style="'+css('background:#f8fafc;color:#64748b')+'"></div><div style="display:grid;grid-template-columns:1fr 1fr 90px;gap:8px;margin-top:8px"><input value="null" readonly style="'+css('background:#f8fafc;color:#64748b')+'"><select id="kat-vfixedicon" style="'+css()+'">'+iconOptions('sending.svg')+'</select><input id="kat-vfixedcolor" type="color" value="#1BC5BD" style="'+css('padding:2px;height:32px')+'"></div></div>' + eventBlock(1)+eventBlock(2)+eventBlock(3)+eventBlock(4) +
        '<div style="display:flex;gap:8px;margin-top:14px"><button id="kat-vjson" style="flex:1;background:white;border:1px solid #e2e8f0;color:#475569;padding:9px;border-radius:6px;font-weight:700;cursor:pointer">Ver JSON</button><button id="kat-vsave" style="flex:1;background:#1e293b;color:white;border:0;padding:9px;border-radius:6px;font-weight:700;cursor:pointer">✓ Guardar</button></div><div id="kat-vformstatus" style="display:none"></div><pre id="kat-vpreview" style="display:none;background:#0f172a;color:#cbd5e1;border-radius:8px;padding:12px;font-size:11px;white-space:pre-wrap;max-height:360px;overflow:auto;margin-top:10px"></pre>';
      } else {
        container.innerHTML = shell() + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:11px;font-weight:700;color:#64748b">'+(mode==='create'?'CREAR PLANTILLA':'EDITAR PLANTILLA')+'</span><button id="kat-vback" style="background:0;border:0;color:#64748b;text-decoration:underline;cursor:pointer">← Volver</button></div>' +
        '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#1e40af;font-size:12px"><b>Organización:</b><br>'+h(org())+'</div>' +
        title('1. Identificación') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>'+label('Nombre de la plantilla',true)+'<input id="kat-vname" value="'+h(initialName)+'" style="'+css()+'"></div><div>'+label('Idioma',true)+'<select id="kat-vlang" style="'+css()+'">'+langOptions(state.defLang)+'</select></div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>'+label('Categoría',true)+'<select id="kat-vcat" style="'+css()+'">'+catOptions(5)+'</select></div><div>'+label('Nivel',true)+'<select id="kat-vlev" style="'+css()+'">'+lvlOptions(3)+'</select></div></div>' +
        '<div style="margin-bottom:8px">'+label('Tipo de campaña',true)+'<input id="kat-vctype" value="'+h(initialCampaign)+'" style="'+css()+'"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>'+label('campaignTypeId',false)+'<input id="kat-vtypeid" value="'+h(initialTypeId)+'" readonly style="'+css('background:#f8fafc;color:#64748b')+'"></div><div>'+label('templateId',false)+'<input id="kat-vtplid" value="'+h(initialTplId)+'" readonly style="'+css('background:#f8fafc;color:#64748b')+'"></div></div>' +
        '<div>'+label('Agente',false)+'<input value="151" readonly style="'+css('background:#f8fafc;color:#64748b')+'"></div>' +
        title('2. Configuración del agente') + '<div>'+label('Saludo inicial',true)+'<textarea id="kat-vgreeting" rows="4" style="'+css('resize:vertical')+'"></textarea></div>' +
        title('3. Perfiles de voz') +
        '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Perfil 1 obligatorio</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>'+label('Nombre del personaje',true)+'<input id="kat-vpname1" style="'+css()+'"></div><div>'+label('Voz del personaje',true)+'<select id="kat-vvoice1" style="'+css()+'">'+voiceOptions('')+'</select></div></div></div>' +
        '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Perfil 2 opcional</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>'+label('Nombre del personaje',false)+'<input id="kat-vpname2" style="'+css()+'"></div><div>'+label('Voz del personaje',false)+'<select id="kat-vvoice2" style="'+css()+'">'+voiceOptions('')+'</select></div></div></div>' +
        title('4. Contexto de la llamada') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div>'+label('Empresa ficticia',true)+'<input id="kat-vcompany" style="'+css()+'"></div><div>'+label('Departamento ficticio',true)+'<input id="kat-vdept" style="'+css()+'"></div></div><div style="margin-bottom:8px">'+label('Información del personaje',true)+'<input id="kat-vpersoninfo" style="'+css()+'"></div><div style="margin-bottom:8px">'+label('Información de la empresa',true)+'<textarea id="kat-vcompanyinfo" rows="3" style="'+css('resize:vertical')+'"></textarea></div><div>'+label('Información del departamento',true)+'<textarea id="kat-vdeptinfo" rows="3" style="'+css('resize:vertical')+'"></textarea></div>' +
        title('5. Programación de llamadas - configuración avanzada') + '<details open style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:#475569">Horario y límites</summary><div style="margin-top:10px">'+label('Días',true)+daysHtml()+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div>'+label('Franja 1 inicio',true)+'<input id="kat-vt1s" type="time" value="09:00" style="'+css()+'"></div><div>'+label('Franja 1 fin',true)+'<input id="kat-vt1e" type="time" value="14:00" style="'+css()+'"></div><div>'+label('Franja 2 inicio',false)+'<input id="kat-vt2s" type="time" value="16:00" style="'+css()+'"></div><div>'+label('Franja 2 fin',false)+'<input id="kat-vt2e" type="time" value="18:00" style="'+css()+'"></div><div>'+label('Intervalo entre llamadas',true)+'<input id="kat-vinterval" type="number" value="2" min="1" style="'+css()+'"></div><div>'+label('Límite de llamadas',true)+'<input id="kat-vlimit" type="number" value="2" min="1" style="'+css()+'"></div></div></details>' +
        title('6. Parámetros de la llamada') + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px">'+paramsHtml()+'</div>' +
        title('7. Eventos de la campaña') + '<div style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px 12px;margin-bottom:8px"><b style="font-size:11px;color:#475569">Evento 0 fijo</b><div style="display:grid;grid-template-columns:1fr 70px 90px;gap:8px;margin-top:8px"><input value="CALL_SENT" readonly style="'+css('background:#f8fafc;color:#64748b')+'"><input value="2" readonly style="'+css('background:#f8fafc;color:#64748b')+'"><input value="1" readonly style="'+css('background:#f8fafc;color:#64748b')+'"></div><div style="display:grid;grid-template-columns:1fr 1fr 90px;gap:8px;margin-top:8px"><input value="null" readonly style="'+css('background:#f8fafc;color:#64748b')+'"><select id="kat-vfixedicon" style="'+css()+'">'+iconOptions('sending.svg')+'</select><input id="kat-vfixedcolor" type="color" value="#1BC5BD" style="'+css('padding:2px;height:32px')+'"></div></div>' + eventBlock(1)+eventBlock(2)+eventBlock(3)+eventBlock(4) +
        '<div style="display:flex;gap:8px;margin-top:14px"><button id="kat-vjson" style="flex:1;background:white;border:1px solid #e2e8f0;color:#475569;padding:9px;border-radius:6px;font-weight:700;cursor:pointer">Ver JSON</button><button id="kat-vsave" style="flex:1;background:#1e293b;color:white;border:0;padding:9px;border-radius:6px;font-weight:700;cursor:pointer">✓ Guardar</button></div><div id="kat-vformstatus" style="display:none"></div><pre id="kat-vpreview" style="display:none;background:#0f172a;color:#cbd5e1;border-radius:8px;padding:12px;font-size:11px;white-space:pre-wrap;max-height:360px;overflow:auto;margin-top:10px"></pre>';
      }
      // Guardar templateCampaignId en campo oculto
      if (initialTemplateCampaignId) {
        var hidEl = document.createElement('input');
        hidEl.type = 'hidden'; hidEl.id = 'kat-vtplcampaignid';
        hidEl.value = initialTemplateCampaignId;
        (targetEl || container).appendChild(hidEl);
      }

      // Rellenar campos si venimos de edición con datos completos
      if (mode === 'edit') {
        var grEl = $('kat-vgreeting'); if (grEl) grEl.value = d.greeting;
        // Idioma
        var lEl = $('kat-vlang'); if (lEl) lEl.value = d.locale;
        // Perfil 1
        if (d.p1) {
          var pn1=$('kat-vpname1'); if(pn1) pn1.value = d.p1.person_name||d.p1.personName||'';
          var pv1=$('kat-vvoice1'); if(pv1) pv1.value = d.p1.person_voice||d.p1.personVoice||'';
          var vc=$('kat-vcompany');  if(vc)  vc.value  = d.p1.company_name||d.p1.companyName||'';
          var vd=$('kat-vdept');     if(vd)  vd.value  = d.p1.department_name||d.p1.departmentName||'';
          var vpi=$('kat-vpersoninfo');    if(vpi)  vpi.value  = d.p1.person_information||d.p1.personInformation||'';
          var vci=$('kat-vcompanyinfo');   if(vci)  vci.value  = d.p1.company_information||d.p1.companyInformation||'';
          var vdi=$('kat-vdeptinfo');      if(vdi)  vdi.value  = d.p1.department_information||d.p1.departmentInformation||'';
        }
        // Perfil 2
        if (d.p2) {
          var pn2=$('kat-vpname2'); if(pn2) pn2.value = d.p2.person_name||d.p2.personName||'';
          var pv2=$('kat-vvoice2'); if(pv2) pv2.value = d.p2.person_voice||d.p2.personVoice||'';
        }
        // Timetable
        if (d.timetable.days) {
          DAYS.forEach(function(day) {
            var cb = $('kat-vday'+day[0]);
            if (cb) cb.checked = d.timetable.days.indexOf(day[0]) >= 0;
          });
        }
        if (d.timetable.timeRanges && d.timetable.timeRanges[0]) {
          var t1s=$('kat-vt1s'); var t1e=$('kat-vt1e');
          if(t1s) t1s.value = d.timetable.timeRanges[0].start||'';
          if(t1e) t1e.value = d.timetable.timeRanges[0].end||'';
        }
        if (d.timetable.timeRanges && d.timetable.timeRanges[1]) {
          var t2s=$('kat-vt2s'); var t2e=$('kat-vt2e');
          if(t2s) t2s.value = d.timetable.timeRanges[1].start||'';
          if(t2e) t2e.value = d.timetable.timeRanges[1].end||'';
        }
        if (d.timetable.callInterval) { var ci=$('kat-vinterval'); if(ci) ci.value=d.timetable.callInterval; }
        if (d.timetable.callLimit)    { var cl=$('kat-vlimit');    if(cl) cl.value=d.timetable.callLimit; }
        // Params
        var paramKeys = Object.keys(d.params); var pi=0;
        paramKeys.forEach(function(k) {
          var kEl=$('kat-vpkey'+pi); var vEl=$('kat-vpval'+pi);
          if(kEl) kEl.value=k; if(vEl) vEl.value=d.params[k]; pi++;
        });
        // Eventos (calculus sin CALL_SENT)
        var userEvents = d.calculus.filter(function(c){ return c.event !== 'CALL_SENT'; });
        userEvents.forEach(function(ev, i) {
          var n = i+1;
          var evEl=$('kat-vevent'+n); if(evEl) evEl.value=ev.event;
          var lvEl=$('kat-vlvl'+n);   if(lvEl) lvEl.value=ev.level||'';
          var puEl=$('kat-vpunt'+n);  if(puEl) puEl.value=ev.puntuation!=null?ev.puntuation:'';
          var cdEl=$('kat-vcond'+n);  if(cdEl) cdEl.value=ev.condition==null?'null':ev.condition;
          var exEl=$('kat-vext'+n);   if(exEl) exEl.value=(d.extraction&&d.extraction[ev.event])||'';
          var style = d.eventsStyle && d.eventsStyle[ev.event];
          if (style) {
            var icEl=$('kat-vicon'+n);  if(icEl)  icEl.value=style.icon||'write.svg';
            var coEl=$('kat-vcolor'+n); if(coEl) coEl.value=style.color||'#FFA500';
          }
        });
        // CALL_SENT fijo
        var fixedStyle = d.eventsStyle && d.eventsStyle['CALL_SENT'];
        if (fixedStyle) {
          var fi=$('kat-vfixedicon');  if(fi) fi.value=fixedStyle.icon||'sending.svg';
          var fc=$('kat-vfixedcolor'); if(fc) fc.value=fixedStyle.color||'#1BC5BD';
        }
      }

      $('kat-vback').onclick=renderList; ['kat-vname','kat-vcat','kat-vlev'].forEach(function(id){ $(id).oninput=function(){ syncCampaign(false); }; $(id).onchange=function(){ syncCampaign(false); }; }); $('kat-vctype').oninput=function(){ state.dirty=true; }; if(mode==='create') syncCampaign(true);
      [1,2,3,4].forEach(function(i){ $('kat-vevent'+i).onchange=function(){ setEventDefault(i); }; });
      $('kat-vjson').onclick=function(){ try{ var f=collect(); var prev={armazon:mode==='create'?skeleton(f):'(no se modifica el armazón en este borrador salvo creación)',contenido:template(Object.assign({},f,{campaignTypeId:f.campaignTypeId||0}))}; $('kat-vpreview').style.display='block'; $('kat-vpreview').textContent=JSON.stringify(prev,null,2); }catch(e){ status($('kat-vformstatus'),'✗ '+h(e.message),'err'); } };
      $('kat-vsave').onclick=function(){ save(mode).catch(function(e){ status($('kat-vformstatus'),'✗ '+h(e.message),'err'); }); };
    }

    function collect(){
      var f={ name:val('kat-vname'), locale:val('kat-vlang'), categoryId:parseInt(val('kat-vcat'),10), levelId:parseInt(val('kat-vlev'),10), campaignType:val('kat-vctype'), campaignTypeId:val('kat-vtypeid')?parseInt(val('kat-vtypeid'),10):null, greeting:val('kat-vgreeting') };
      req(f.name,'Nombre de la plantilla'); req(f.locale,'Idioma'); req(f.campaignType,'Tipo de campaña'); req(f.greeting,'Saludo inicial');
      var ctx={ company_name:val('kat-vcompany'), department_name:val('kat-vdept'), person_information:val('kat-vpersoninfo'), company_information:val('kat-vcompanyinfo'), department_information:val('kat-vdeptinfo') };
      req(ctx.company_name,'Empresa ficticia'); req(ctx.department_name,'Departamento ficticio'); req(ctx.person_information,'Información del personaje'); req(ctx.company_information,'Información de la empresa'); req(ctx.department_information,'Información del departamento');
      var n1=val('kat-vpname1'), v1=val('kat-vvoice1'), n2=val('kat-vpname2'), v2=val('kat-vvoice2'); req(n1,'Nombre del personaje 1'); req(v1,'Voz del personaje 1'); if((n2&&!v2)||(!n2&&v2)) throw new Error('El perfil 2 debe tener nombre y voz, o quedar vacío.');
      f.profiles=[Object.assign({person_name:n1,person_voice:v1},ctx)]; if(n2&&v2) f.profiles.push(Object.assign({person_name:n2,person_voice:v2},ctx));
      f.days=[]; DAYS.forEach(function(d){ if($('kat-vday'+d[0]).checked) f.days.push(d[0]); }); if(!f.days.length) throw new Error('Selecciona al menos un día.');
      var t1s=val('kat-vt1s'), t1e=val('kat-vt1e'), t2s=val('kat-vt2s'), t2e=val('kat-vt2e'); assertTime(t1s,t1e,'Franja 1'); f.timeRanges=[{start:t1s,end:t1e}]; if(t2s||t2e){ assertTime(t2s,t2e,'Franja 2'); f.timeRanges.push({start:t2s,end:t2e}); }
      f.callInterval=parseNum(val('kat-vinterval'),'Intervalo entre llamadas',false); f.callLimit=parseNum(val('kat-vlimit'),'Límite de llamadas',false); if(f.callInterval<1||f.callLimit<1) throw new Error('Intervalo y límite deben ser mayores que 0.');
      f.params=[]; for(var p=0;p<6;p++){ var k=val('kat-vpkey'+p), vv=val('kat-vpval'+p); if((k&&!vv)||(!k&&vv)) throw new Error('El parámetro '+(p+1)+' debe tener clave y valor, o estar vacío.'); if(k&&vv) f.params.push({key:k,value:vv}); }
      f.events=[]; var seen={}; for(var i=1;i<=4;i++){ var ev=val('kat-vevent'+i); if(!ev) continue; if(seen[ev]) throw new Error('Evento repetido: '+ev); seen[ev]=true; var ex=val('kat-vext'+i), ico=val('kat-vicon'+i), col=val('kat-vcolor'+i); req(ex,'Prompt de extracción evento '+i); if(!/^#[0-9A-Fa-f]{6}$/.test(col)) throw new Error('Color no válido en evento '+i); f.events.push({event:ev,level:parseNum(val('kat-vlvl'+i),'Nivel evento '+i,false),condition:cond(val('kat-vcond'+i)),puntuation:parseNum(val('kat-vpunt'+i),'Puntuación evento '+i,true),extraction:ex,icon:ico,color:col}); }
      f.fixedIcon=val('kat-vfixedicon')||'sending.svg'; f.fixedColor=val('kat-vfixedcolor')||'#1BC5BD';
      return f;
    }
    function skeleton(f){ var d={}; d[f.locale]=f.name; return { name:{name:{dictionary:d}}, categoryId:f.categoryId, levelId:f.levelId, surveyTypeId:SURVEY_TYPE_ID, campaignType:f.campaignType, stakeholderCompanyId:Number(tools.state.companyId) }; }
    function template(f){ var params={}, events=['CALL_SENT'], calculus=[{event:'CALL_SENT',level:2,condition:null,puntuation:1}], extraction={}, styles={CALL_SENT:{icon:f.fixedIcon,color:f.fixedColor}}; f.params.forEach(function(p){ params[p.key]=p.value; }); f.events.forEach(function(e){ events.push(e.event); calculus.push({event:e.event,level:e.level,condition:e.condition,puntuation:e.puntuation}); extraction[e.event]=e.extraction; styles[e.event]={icon:e.icon,color:e.color}; }); return { campaignType:f.campaignType, campaignTypeId:f.campaignTypeId, stakeholderCompanyId:Number(tools.state.companyId), surveyTypeId:SURVEY_TYPE_ID, templates:[{ name:f.name, params:{locale:f.locale}, configuration:{ agent:{agentId:AGENT_ID,greeting:f.greeting,profiles:f.profiles}, timetable:{days:f.days,timeRanges:f.timeRanges,callInterval:f.callInterval,callLimit:f.callLimit} }, mapping:{events:events,params:params,calculus:calculus,extraction:extraction,eventsStyle:styles} }] }; }
    async function save(mode){
      var st=$('kat-vformstatus'), f=collect();
      var tplid=val('kat-vtplid');
      var tplCampaignIdEl=$('kat-vtplcampaignid');
      var tplCampaignId = tplCampaignIdEl ? tplCampaignIdEl.value : '';
      if(mode==='create'){
        if(!confirm('Se va a crear una plantilla de Vishing en '+org()+'.\n\n¿Quieres continuar?')) return;
        status(st,'⌛ Creando armazón...','info');
        var r=await fetchJson('https://api.kymatio.com/v2/admin/mgm/campaigns/types',{method:'POST',body:JSON.stringify(skeleton(f))}); console.log('Vishing BORRADOR armazón',r); f.campaignTypeId=extractCampaignTypeId(r); $('kat-vtypeid').value=f.campaignTypeId;
        status(st,'⌛ Creando contenido...','info');
        var tr=await fetchJson('https://api.kymatio.com/v2/admin/mgm/campaigns/templates',{method:'POST',body:JSON.stringify(template(f))}); console.log('Vishing BORRADOR contenido',tr);
        status(st,'✓ Plantilla creada correctamente. campaignTypeId: '+h(f.campaignTypeId),'ok');
      } else {
        if(!f.campaignTypeId) throw new Error('No hay campaignTypeId.');
        if(!confirm('Se va a guardar la plantilla en todos los idiomas.\n\n¿Continuar?')) return;

        // Construir el payload del idioma activo con el formulario actual
        var currentPayload = template(f);
        var currentLocale = state.activeLocale || f.locale;

        // Combinar con los demás idiomas guardados en state.editTemplates
        var allTemplates = [];
        if (state.editTemplates && state.editTemplates.length > 0) {
          state.editTemplates.forEach(function(t) {
            if (t.locale === currentLocale) {
              // Usar el payload del formulario actual para este idioma
              if (currentPayload.templates && currentPayload.templates.length > 0) {
                allTemplates.push(currentPayload.templates[0]);
              }
            } else if (t.rec && t.rec.agent) {
              // Reconstruir payload para los otros idiomas desde rec
              var rec = t.rec;
              var agent = rec.agent || {};
              var profiles = agent.profiles || [];
              var evStyles = rec.eventsStyle || {};
              var events = (rec.events || []).filter(function(e){ return e !== 'CALL_SENT'; });
              var tplEntry = {
                name: '', params: { locale: t.locale },
                configuration: {
                  agent: {
                    agentId: agent.agentId || AGENT_ID,
                    greeting: agent.greeting || '',
                    profiles: profiles
                  },
                  timetable: rec.timetable || {},
                  mapping: rec.mapping || {
                    events: ['CALL_SENT'].concat(events),
                    params: {},
                    calculus: events.map(function(ev) {
                      return { event: ev, level: DEF[ev]&&DEF[ev].level||3, condition: null, puntuation: DEF[ev]&&DEF[ev].puntuation!=null?DEF[ev].puntuation:0 };
                    }),
                    extraction: {},
                    eventsStyle: evStyles
                  }
                }
              };
              allTemplates.push(tplEntry);
            }
          });
        } else if (currentPayload.templates) {
          allTemplates = currentPayload.templates;
        }

        var finalPayload = {
          campaignType: f.campaignType || '',
          campaignTypeId: f.campaignTypeId,
          stakeholderCompanyId: String(tools.state.companyId || ''),
          templates: allTemplates
        };

        var tcid = tplCampaignId || tplid;
        if (tcid) {
          status(st,'⌛ Actualizando plantilla (' + allTemplates.length + ' idiomas)...','info');
          await fetchJson('https://api.kymatio.com/v2/admin/mgm/campaigns/templates/'+encodeURIComponent(tcid),{method:'PUT',body:JSON.stringify(finalPayload)});
          status(st,'✓ Plantilla actualizada correctamente (' + allTemplates.length + ' idiomas).','ok');
        } else {
          status(st,'⌛ Creando plantilla (' + allTemplates.length + ' idiomas)...','info');
          await fetchJson('https://api.kymatio.com/v2/admin/mgm/campaigns/templates',{method:'POST',body:JSON.stringify(finalPayload)});
          status(st,'✓ Plantilla creada correctamente.','ok');
        }
      }
    }

    function renderMultiLangTabs(item, templates) {
      var activeLoc = state.activeLocale || (templates[0] && templates[0].locale);

      function buildTabs() {
        var bar = '<div style="display:flex;gap:4px;flex-wrap:wrap;border-bottom:2px solid #e2e8f0;padding-bottom:0;margin-bottom:16px">';
        templates.forEach(function(t) {
          var active = t.locale === activeLoc;
          bar += '<button class="kat-vtab" data-locale="' + h(t.locale) + '" style="padding:7px 14px;border-radius:6px 6px 0 0;border:1px solid ' + (active ? '#1e293b' : '#e2e8f0') + ';border-bottom:' + (active ? '2px solid white' : '1px solid #e2e8f0') + ';background:' + (active ? 'white' : '#f8fafc') + ';color:' + (active ? '#1e293b' : '#64748b') + ';font-size:12px;font-weight:' + (active ? '700' : '500') + ';cursor:pointer;margin-bottom:-2px">' + h(LANG_NAMES[t.locale] || t.locale) + '</button>';
        });
        // Botón añadir idioma
        var usedLocales = templates.map(function(t){ return t.locale; });
        var available = Object.keys(LANG_NAMES).filter(function(l){ return usedLocales.indexOf(l) < 0; });
        if (available.length) {
          bar += '<button id="kat-vadd-lang" style="padding:7px 12px;border-radius:6px 6px 0 0;border:1px dashed #94a3b8;background:white;color:#64748b;font-size:12px;cursor:pointer;margin-bottom:-2px">+ Idioma</button>';
        }
        bar += '</div>';
        return bar;
      }

      function renderActiveTab() {
        var tpl = templates.find(function(t){ return t.locale === activeLoc; }) || templates[0];
        var rec = tpl.rec || {};
        var agent = rec.agent || {};
        var profiles = agent.profiles || [{}];
        var timetable = rec.timetable || {};
        var mapping = rec.mapping || (rec.configuration && rec.configuration.mapping) || {};
        var eventsStyle = rec.eventsStyle || mapping.eventsStyle || {};
        var calculus = mapping.calculus || (rec.events ? rec.events.filter(function(e){ return e !== 'CALL_SENT'; }).map(function(ev) {
          return { event: ev, level: DEF[ev] && DEF[ev].level || 3, condition: null, puntuation: DEF[ev] && DEF[ev].puntuation != null ? DEF[ev].puntuation : 0 };
        }) : []);

        // Construir form data para este idioma
        var d = {
          name: item.name || '', campaign: item.common && item.common.campaignType || item.campaignType || '',
          typeId: item.common && item.common.campaignTypeId || '',
          tplId: item.id || item.templateId || '',
          templateCampaignId: tpl.templateCampaignId,
          greeting: agent.greeting || '',
          locale: tpl.locale,
          p1: profiles[0] || {}, p2: profiles[1] || null,
          timetable: timetable,
          calculus: calculus,
          extraction: mapping.extraction || {},
          eventsStyle: eventsStyle,
          params: mapping.params || {}
        };

        // Rebuild tabs + form
        container.innerHTML = shell() + buildTabs() + '<div id="kat-vtab-form"></div>';


        // Asignar click en tabs
        container.querySelectorAll('.kat-vtab').forEach(function(btn) {
          btn.onclick = function() {
            // Guardar cambios del tab actual antes de cambiar
            activeLoc = this.dataset.locale;
            state.activeLocale = activeLoc;
            renderActiveTab();
          };
        });

        // Botón añadir idioma
        var addBtn = document.getElementById('kat-vadd-lang');
        if (addBtn) addBtn.onclick = function() {
          var usedLocales = templates.map(function(t){ return t.locale; });
          var available = Object.keys(LANG_NAMES).filter(function(l){ return usedLocales.indexOf(l) < 0; });
          if (!available.length) return;
          var msg = 'Idiomas disponibles: ' + available.join(', ') + '. Escribe el c\u00f3digo del idioma:';
          var lang = prompt(msg);
          if (!lang || available.indexOf(lang.trim()) < 0) { if (lang) alert('Idioma no válido.'); return; }
          lang = lang.trim();
          // Clonar la estructura del primer template como base vacía
          templates.push({ locale: lang, templateCampaignId: tpl.templateCampaignId, rec: {} });
          activeLoc = lang;
          state.activeLocale = lang;
          renderActiveTab();
        };

        // Renderizar el formulario del idioma activo en el contenedor del tab
        renderFormHtml('edit', item, d, document.getElementById('kat-vtab-form'));
      }

      renderActiveTab();
    }

    container.innerHTML='<div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b">Cargando editor BORRADOR...</div>';
    tools.loadCompanyData().then(function(data){ var l=(data.environment&&data.environment.languages)||{}; state.langs=(Array.isArray(l.list)&&l.list.length)?l.list.slice():['es-es']; state.defLang=l.default||state.langs[0]||'es-es'; renderList(); }).catch(function(e){ container.innerHTML='<div style="padding:14px;border:1px solid #fed7d7;border-radius:8px;background:#fff5f5;color:#c53030">Error: '+h(e.message)+'</div>'; });
  }




  KAT.registerModule({ key:'vishing_templates_draft', label:'BORRADOR - Plantillas de Vishing', icon:'&#9742;', order:75, forceGuiOnly:true, hideModeSwitch:true, renderGui:renderGui });
})();
