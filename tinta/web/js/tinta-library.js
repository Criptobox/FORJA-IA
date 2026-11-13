/* Adaptador de la biblioteca real al recorrido Tinta. No modifica sus datos.
   El mismo motor designParts produce vista, composición y exportación.
   Código personalizado: HTML/CSS visual saneado, nunca JavaScript ejecutable. */
const TINTA_LIBRARY = (() => {
  const roles = {Encabezados:'header',Tarjetas:'cards',Botones:'actions',Barras:'nav',Chat:'chat',Listas:'list',Avatares:'avatars',Plantillas:'templates',Formularios:'forms',Entradas:'inputs',Hojas:'sheets',Avisos:'notices',Datos:'data',Paletas:'palettes','Tipografía':'type',Animaciones:'motion',Fondos:'background',Widgets:'widgets',Iconos:'icons'};
  let user = {};
  try { const v=JSON.parse(localStorage.getItem('estilos-user-v2')||'{}');if(v&&typeof v==='object')user=v; } catch(e) { /* sandbox o sin preferencias */ }
  const deleted=new Set(Array.isArray(user.deleted)?user.deleted.filter(id=>typeof id==='string'):[]);
  const edits=user.edits&&typeof user.edits==='object'&&!Array.isArray(user.edits)?user.edits:{};
  const rows=SEED.filter(e=>!deleted.has(e.id)).map(e=>Object.assign({},e,edits[e.id]||{}, {id:e.id}));
  const known=new Set(rows.map(e=>e.id));
  if(Array.isArray(user.added))user.added.forEach(e=>{if(e&&typeof e.id==='string'&&!known.has(e.id)&&!deleted.has(e.id)){rows.push(e);known.add(e.id);}});
  function cleanCode(code){
    const doc=new DOMParser().parseFromString(String(code).slice(0,100000),'text/html');
    doc.querySelectorAll('script,iframe,object,embed,link,meta,base,template,svg foreignObject').forEach(n=>n.remove());
    let css='';doc.querySelectorAll('style').forEach(n=>{css+='\n'+n.textContent;n.remove();});
    doc.querySelectorAll('*').forEach(el=>{for(const a of [...el.attributes]){if(/^on/i.test(a.name)||['srcdoc','action','formaction','autofocus'].includes(a.name)||(['href','src','xlink:href'].includes(a.name)&&/^\s*(javascript:|vbscript:|data:text\/html)/i.test(a.value)))el.removeAttribute(a.name);}});
    // Las reglas body/html de las demos se aplican al host aislado.
    css=css.replace(/\b(?:body|html)(?=\s*[{,.#:\[])/g,':host').replace(/@import\s+[^;]+;/gi,'');
    return {html:doc.body.innerHTML,css};
  }
  const SEED_IDS=new Set(SEED.map(e=>e.id)),mineIds=new Set((Array.isArray(user.added)?user.added:[]).filter(e=>e&&typeof e.id==='string'&&!SEED_IDS.has(e.id)).map(e=>e.id));
  /* Una ficha (propia o de la biblioteca) → entrada normalizada + partes que se dibujan (HTML + CSS). */
  function build(raw){
    const entry={...raw,name:raw.name.slice(0,80),desc:String(raw.desc||'').slice(0,400),colors:(Array.isArray(raw.colors)?raw.colors:['#888888']).slice(0,6).map(c=>safeColor(c)),radius:/^\d{1,2}%?$/.test(String(raw.radius))?String(raw.radius):'16',mode:raw.mode==='dark'?'dark':'light',v:typeof raw.v==='string'&&D[raw.v]?raw.v:''};
    const custom=typeof raw.code==='string'&&raw.code.trim();
    const parts=custom?cleanCode(raw.code):designParts(entry);
    return {entry,custom,parts};
  }
  window.TintaLibraryTools={preview:raw=>build(raw).parts};
  return rows.filter(e=>e&&typeof e.name==='string'&&typeof e.tab==='string').map(raw=>{
    const {entry,custom,parts}=build(raw);
    return {id:'lib-'+safeId(raw.id),role:roles[entry.tab]||'widgets',source:'library',name:entry.name,desc:entry.desc,color:entry.colors[0]||'#e5e1d5',glyph:entry.tab==='Botones'?'→':entry.tab==='Tarjetas'?'▤':'▦',html:parts.html,css:parts.css,base:SHADOW_BASE,libraryId:raw.id,reference:entry.ref,properties:{colors:entry.colors,radius:entry.radius,mode:entry.mode},variant:custom?'custom':variantOf(entry),mine:mineIds.has(raw.id),raw};
  });
})();
