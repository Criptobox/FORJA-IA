/* Historial de sesión de Tinta. Diferencias por campo, no copias completas de fotos. */
const TintaHistory=(()=>{
 function create({limit=50,maxBytes=16*1024*1024}={}){
  let current={},entries=[],cursor=0,trimmed=false;
  const encode=draft=>Object.fromEntries(Object.entries(draft).map(([k,v])=>[k,JSON.stringify(v)]));
  const decode=value=>Object.fromEntries(Object.entries(value).map(([k,v])=>[k,JSON.parse(v)]));
  function bytes(){const values=new Set();Object.values(current).forEach(v=>values.add(v));entries.forEach(e=>Object.values(e.changes).forEach(c=>{if(c.before!==undefined)values.add(c.before);if(c.after!==undefined)values.add(c.after);}));return [...values].reduce((n,v)=>n+v.length*2,0);}
  function trim(){while(entries.length>1&&(entries.length>limit||bytes()>maxBytes)){entries.shift();cursor--;trimmed=true;}}
  function reset(draft){current=encode(draft);entries=[];cursor=0;trimmed=false;}
  function record(draft,{label=null,group=null}={}){const next=encode(draft),changes={};for(const key of new Set([...Object.keys(current),...Object.keys(next)]))if(current[key]!==next[key])changes[key]={before:current[key],after:next[key]};for(const key of Object.keys(next))if(next[key]===current[key])next[key]=current[key];if(!Object.keys(changes).length)return false;entries=entries.slice(0,cursor);const previous=entries[cursor-1];if(group&&previous&&previous.group===group){for(const [key,c] of Object.entries(changes)){if(previous.changes[key])previous.changes[key].after=c.after;else previous.changes[key]=c;}for(const [key,c] of Object.entries(previous.changes))if(c.before===c.after)delete previous.changes[key];if(!Object.keys(previous.changes).length){entries.pop();cursor--;}}else{const labels={brief:'Editar idea',selected:'Selección / orden de bloques',choices:'Elegir alternativa',content:'Editar textos',assets:'Cambiar fotos / destinos',ui:'Cambiar variante / estado',buttonStyles:'Estilo de botón',cardStyles:'Diseño de tarjeta',repeat:'Copias de tarjeta',motion:'Animación',palette:'Paleta',visual:'Estilo visual',multi:'Todas las pantallas',flows:'Pantallas de recorrido'};entries.push({label:label||(Object.keys(changes).length===1?labels[Object.keys(changes)[0]]||'Cambio del diseño':'Cambiar pantalla'),group,changes});cursor++;}current=next;trim();return true;}
  function move(direction){const entry=direction<0?entries[cursor-1]:entries[cursor];if(!entry)return null;const next={...current};for(const [key,c] of Object.entries(entry.changes)){const value=direction<0?c.before:c.after;if(value===undefined)delete next[key];else next[key]=value;}cursor+=direction;current=next;return {draft:decode(current),label:entry.label};}
  function breakGroup(){if(cursor)entries[cursor-1].group=null;}
  function status(){return {canUndo:cursor>0,canRedo:cursor<entries.length,undoLabel:entries[cursor-1]?.label||'',redoLabel:entries[cursor]?.label||'',undoCount:cursor,redoCount:entries.length-cursor,trimmed};}
  return {reset,record,undo:()=>move(-1),redo:()=>move(1),breakGroup,status};
 }
 return {create};
})();
