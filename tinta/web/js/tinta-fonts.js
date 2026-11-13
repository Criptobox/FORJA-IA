/* Tipografías: una capa que cambia la letra de TODA la pantalla de un toque (como las paletas y los fondos): no toca los
   bloques guardados, se quita igual y llega a la exportación. Son familias que ya trae cada dispositivo (la app no carga
   fuentes de internet), más «Jakarta», que va incluida en la app. Por eso el aspecto exacto varía algo según el móvil:
   cada familia lista alternativas parecidas para Android, iOS, Windows y Mac. Solo datos fijos: sin recursos externos. */
(function (root) {
  'use strict';
  const SANS = ',system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', SERIF = ',"Times New Roman",Times,serif', MONO = ',"Courier New",monospace';
  const LIST = [
    { id: 'sistema', name: 'Sistema', tag: 'La letra nativa de tu dispositivo', group: 'modernas', stack: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif', head: 'font-weight:700!important;letter-spacing:-.02em!important' },
    { id: 'jakarta', name: 'Jakarta', tag: 'Moderna y cálida (incluida en la app)', group: 'modernas', stack: 'Jakarta' + SANS, head: 'font-weight:700!important;letter-spacing:-.03em!important' },
    { id: 'geometrica', name: 'Geométrica', tag: 'Redonda y limpia, estilo Futura', group: 'modernas', stack: '"Futura","Century Gothic","Avenir Next","Avenir","Trebuchet MS"' + SANS, head: 'font-weight:700!important;letter-spacing:-.02em!important' },
    { id: 'humanista', name: 'Humanista', tag: 'Amable, con trazo de pluma', group: 'modernas', stack: '"Optima","Candara","Gill Sans","Segoe UI","Noto Sans"' + SANS, head: 'font-weight:700!important;letter-spacing:-.01em!important' },
    { id: 'redondeada', name: 'Redondeada', tag: 'Esquinas suaves y juguetonas', group: 'modernas', stack: 'ui-rounded,"SF Pro Rounded","Hiragino Maru Gothic ProN","Varela Round","Nunito","Quicksand","Trebuchet MS"' + SANS, head: 'font-weight:800!important;letter-spacing:-.01em!important' },
    { id: 'editorial', name: 'Editorial', tag: 'Serifa de revista', group: 'clasicas', stack: 'Georgia,"Iowan Old Style","Noto Serif","Cambria"' + SERIF, head: 'font-weight:700!important;letter-spacing:-.02em!important' },
    { id: 'clasica', name: 'Clásica', tag: 'Libro de siempre: Palatino y Baskerville', group: 'clasicas', stack: '"Palatino Linotype",Palatino,"Book Antiqua",Baskerville,"Noto Serif"' + SERIF, head: 'font-weight:600!important;letter-spacing:-.01em!important' },
    { id: 'elegante', name: 'Elegante', tag: 'Contraste alto, tipo moda', group: 'clasicas', stack: '"Didot","Bodoni 72","Bodoni MT","Playfair Display",Georgia' + SERIF, head: 'font-weight:500!important;letter-spacing:-.02em!important' },
    { id: 'tecnica', name: 'Técnica', tag: 'Monoespaciada, de terminal', group: 'caracter', stack: 'ui-monospace,"SF Mono","Cascadia Code","Roboto Mono",Menlo,Consolas' + MONO, head: 'font-weight:700!important;letter-spacing:-.04em!important' },
    { id: 'maquina', name: 'Máquina de escribir', tag: 'Cálida, con serifas rectas', group: 'caracter', stack: '"American Typewriter","Courier Prime","Courier New",Courier,monospace', head: 'font-weight:700!important;letter-spacing:0!important' },
    { id: 'condensada', name: 'Condensada', tag: 'Estrecha y de titular', group: 'caracter', stack: '"Arial Narrow","Roboto Condensed","Helvetica Neue Condensed","Oswald","Franklin Gothic Medium"' + SANS, head: 'font-weight:700!important;letter-spacing:.01em!important' },
    { id: 'manuscrita', name: 'Manuscrita', tag: 'A mano alzada (según el dispositivo)', group: 'caracter', stack: '"Bradley Hand","Segoe Print","Comic Sans MS","Marker Felt",cursive', head: 'font-weight:700!important;letter-spacing:0!important' }
  ];
  const GROUPS = [{ id: 'modernas', name: 'Modernas' }, { id: 'clasicas', name: 'Clásicas con serifa' }, { id: 'caracter', name: 'De carácter' }];
  const get = id => LIST.find(f => f.id === id) || null;
  const normalize = id => (typeof id === 'string' && get(id)) ? id : null;
  /* CSS que se añade al final de cada bloque: la familia en la raíz, heredada por todo, y el peso y espaciado de los títulos. */
  const css = f => ':host{font-family:' + f.stack + '!important}*,button,input,select,textarea{font-family:inherit!important}h1,h2,h3{' + f.head + '}';
  const valid = f => !!f && /^[\w\s",.\-]+$/.test(f.stack) && !/url\(|@import|[;{}<>]/.test(f.stack + f.head.replace(/![a-z]+;?/g, '').replace(/[a-z-]+:[^;!]+/g, ''));
  root.TintaFonts = { LIST, GROUPS, get, normalize, css, valid };
  if (typeof module !== 'undefined') module.exports = root.TintaFonts;
})(typeof window !== 'undefined' ? window : globalThis);
