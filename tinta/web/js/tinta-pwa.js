/* No registra SW en archivos descargados, en el visor de origen opaco ni dentro de un iframe (modo motor en FORJA). */
(()=>{try{if(!['http:','https:'].includes(location.protocol)||location.origin==='null'||!('serviceWorker' in navigator)||window.parent!==window)return;const hadController=!!navigator.serviceWorker.controller;let reloaded=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController&&!reloaded){reloaded=true;location.reload();}});window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{reg.update().catch(()=>{});document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{});});}).catch(()=>{});});}catch(e){/* El visor aislado puede bloquear esta API; Tinta sigue funcionando. */}})();

/* Instalar como app: guarda el aviso nativo (beforeinstallprompt) y lo ofrece desde el menú de Tinta.
   Si el navegador no lo ofrece (iOS, ya instalada, navegador dentro de otra app…), explica los pasos. */
(()=>{try{
  let evt=null;
  if(!['http:','https:'].includes(location.protocol))return; /* APK, archivo local o visor aislado: no aplica */
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();evt=e;sync();});
  addEventListener('appinstalled',()=>{evt=null;sync();});
  const help=()=>ios()
    ?'En Safari: botón Compartir → «Añadir a pantalla de inicio».'
    :'Abre el menú del navegador (⋮) y elige «Instalar app» o «Añadir a pantalla de inicio». Si no aparece, ábrela en Chrome o Edge (no dentro de otra aplicación) y recarga una vez.';
  function sync(){
    const menu=document.getElementById('siteMenu');if(!menu)return;
    let btn=document.getElementById('installApp'),note=document.getElementById('installHelp');
    if(standalone()){if(btn)btn.remove();if(note)note.remove();return;}
    if(!btn){
      btn=document.createElement('button');btn.id='installApp';btn.type='button';btn.textContent='Instalar la app';
      note=document.createElement('small');note.id='installHelp';note.hidden=true;note.setAttribute('role','status');
      menu.prepend(note);menu.prepend(btn);
      btn.addEventListener('click',async()=>{
        if(evt){const e=evt;evt=null;try{await e.prompt();await e.userChoice;}catch(_){}sync();return;}
        note.textContent=help();note.hidden=!note.hidden;
      });
    }
    btn.dataset.ready=evt?'1':'0';
  }
  sync();
}catch(e){/* sin instalación: Tinta sigue funcionando */}})();
