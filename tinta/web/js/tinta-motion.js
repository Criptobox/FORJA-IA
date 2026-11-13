/* Animaciones de Tinta: entrada de los bloques, efecto al tocar tarjetas y pulso del botón principal.
   El mismo CSS sirve para la vista previa y para el HTML exportado. Siempre respeta
   prefers-reduced-motion. Datos puros: crear.js decide dónde aplicarlas. */
(function (root) {
  'use strict';
  const KINDS = { entrance: 'Entrada', card: 'Tarjetas', action: 'Botón principal' };
  const LIST = [
    { id: 'fade-up', kind: 'entrance', name: 'Aparecer subiendo', desc: 'Cada bloque entra desde abajo con un fundido suave, uno tras otro.' },
    { id: 'fade', kind: 'entrance', name: 'Aparecer', desc: 'Fundido limpio, sin movimiento: lo más discreto.' },
    { id: 'scale', kind: 'entrance', name: 'Zoom suave', desc: 'Los bloques crecen un poco al aparecer.' },
    { id: 'slide', kind: 'entrance', name: 'Deslizar desde la izquierda', desc: 'Entran desde la izquierda, en cascada.' },
    { id: 'slide-right', kind: 'entrance', name: 'Deslizar desde la derecha', desc: 'Entran desde la derecha, como pasar de página.' },
    { id: 'blur', kind: 'entrance', name: 'De borroso a nítido', desc: 'Se enfocan al aparecer. Elegante en pantallas con fotos.' },
    { id: 'pop', kind: 'entrance', name: 'Rebote', desc: 'Entran con un pequeño rebote. Divertido y juvenil.' },
    { id: 'rise', kind: 'entrance', name: 'Elevarse', desc: 'Suben con un recorrido largo y un ligero zoom: sensación de profundidad.' },
    { id: 'drop', kind: 'entrance', name: 'Caer desde arriba', desc: 'Bajan desde arriba y se asientan con un pequeño rebote.' },
    { id: 'flip', kind: 'entrance', name: 'Girar', desc: 'Se abren como una solapa. Llamativo para pantallas de catálogo.' },
    { id: 'reveal', kind: 'entrance', name: 'Descubrir', desc: 'Se descubren de abajo hacia arriba, como una cortina.' },
    { id: 'zoom-out', kind: 'entrance', name: 'Acercarse', desc: 'Llegan desde un poco más grandes y se ajustan a su sitio.' },
    { id: 'lift', kind: 'card', name: 'Elevar al tocar', desc: 'La tarjeta sube un poco cuando la tocas o pasas el cursor.' },
    { id: 'tilt', kind: 'card', name: 'Inclinar al tocar', desc: 'La tarjeta se inclina y crece un poco: tacto de objeto físico.' },
    { id: 'glow', kind: 'card', name: 'Resplandor al tocar', desc: 'Una sombra de color la rodea al tocarla.' },
    { id: 'press', kind: 'card', name: 'Pulsar', desc: 'Se hunde un poco al pulsarla, como un botón de verdad.' },
    { id: 'float', kind: 'card', name: 'Flotar', desc: 'Las tarjetas flotan despacio, en bucle, cada una a su ritmo.' },
    { id: 'pulse', kind: 'action', name: 'Pulso', desc: 'El botón principal late despacio para invitar a pulsarlo.' },
    { id: 'bounce', kind: 'action', name: 'Salto', desc: 'El botón principal da un saltito de vez en cuando.' },
    { id: 'wiggle', kind: 'action', name: 'Sacudida', desc: 'Un pequeño temblor de vez en cuando para llamar la atención.' },
    { id: 'shine', kind: 'action', name: 'Destello', desc: 'Un brillo cruza el botón principal de lado a lado.' }
  ];
  const get = id => LIST.find(m => m.id === id) || null;
  const CSS = '@keyframes tm-fade{from{opacity:0}to{opacity:1}}@keyframes tm-fade-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes tm-scale{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}@keyframes tm-slide{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}@keyframes tm-slide-right{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}@keyframes tm-blur{from{opacity:0;filter:blur(8px)}to{opacity:1;filter:none}}@keyframes tm-pop{0%{opacity:0;transform:scale(.8)}60%{transform:scale(1.04)}100%{opacity:1;transform:none}}'
    + '@keyframes tm-rise{from{opacity:0;transform:translateY(42px) scale(.94)}to{opacity:1;transform:none}}@keyframes tm-drop{0%{opacity:0;transform:translateY(-34px)}65%{opacity:1;transform:translateY(5px)}100%{transform:none}}@keyframes tm-flip{from{opacity:0;transform:perspective(700px) rotateX(-68deg)}to{opacity:1;transform:none}}@keyframes tm-reveal{from{clip-path:inset(100% 0 0 0);opacity:.2}to{clip-path:inset(0 0 0 0);opacity:1}}@keyframes tm-zoom-out{from{opacity:0;transform:scale(1.14)}to{opacity:1;transform:none}}'
    + '@keyframes tm-pulse{0%,100%{transform:none}50%{transform:scale(1.035)}}@keyframes tm-bounce{0%,72%,100%{transform:none}80%{transform:translateY(-9px)}88%{transform:translateY(0)}94%{transform:translateY(-3px)}}@keyframes tm-wiggle{0%,78%,100%{transform:none}82%{transform:rotate(-2.2deg)}86%{transform:rotate(2.2deg)}90%{transform:rotate(-1.4deg)}94%{transform:rotate(1.4deg)}}@keyframes tm-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes tm-shine{0%{transform:translateX(-130%) skewX(-18deg)}55%,100%{transform:translateX(230%) skewX(-18deg)}}'
    + '[data-m-entrance]{animation:var(--tm-in) .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*90ms)}'
    + '[data-m-entrance=fade-up]{--tm-in:tm-fade-up}[data-m-entrance=fade]{--tm-in:tm-fade}[data-m-entrance=scale]{--tm-in:tm-scale}[data-m-entrance=slide]{--tm-in:tm-slide}[data-m-entrance=slide-right]{--tm-in:tm-slide-right}[data-m-entrance=blur]{--tm-in:tm-blur}[data-m-entrance=pop]{--tm-in:tm-pop}[data-m-entrance=rise]{--tm-in:tm-rise}[data-m-entrance=drop]{--tm-in:tm-drop}[data-m-entrance=flip]{--tm-in:tm-flip;transform-origin:50% 0}[data-m-entrance=reveal]{--tm-in:tm-reveal}[data-m-entrance=zoom-out]{--tm-in:tm-zoom-out}'
    + '[data-m-card=lift],[data-m-card=tilt],[data-m-card=glow],[data-m-card=press]{transition:transform .22s ease,filter .22s ease}[data-m-card=lift]:hover,[data-m-card=lift]:active{transform:translateY(-4px)}[data-m-card=tilt]:hover,[data-m-card=tilt]:active{transform:perspective(600px) rotate(-1.4deg) scale(1.02)}[data-m-card=glow]:hover,[data-m-card=glow]:active{filter:drop-shadow(0 10px 18px rgba(255,112,75,.45))}[data-m-card=press]:hover{transform:scale(1.01)}[data-m-card=press]:active{transform:scale(.965)}'
    + '[data-m-card=float]{animation:var(--tm-in,none) .55s cubic-bezier(.2,.8,.2,1) both,tm-float 4.2s ease-in-out 1s infinite}[data-m-card=float]:nth-of-type(2n){animation-duration:.55s,5s}'
    + '[data-m-action=pulse]{animation:var(--tm-in,none) .55s cubic-bezier(.2,.8,.2,1) both,tm-pulse 2.4s ease-in-out 1s infinite}[data-m-action=bounce]{animation:var(--tm-in,none) .55s cubic-bezier(.2,.8,.2,1) both,tm-bounce 3s ease-in-out 1s infinite}[data-m-action=wiggle]{animation:var(--tm-in,none) .55s cubic-bezier(.2,.8,.2,1) both,tm-wiggle 3.2s ease-in-out 1s infinite}'
    + '[data-m-action=shine]{position:relative;overflow:hidden}[data-m-action=shine]::after{content:"";position:absolute;top:0;bottom:0;left:0;width:38%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-130%) skewX(-18deg);animation:tm-shine 3.4s ease-in-out 1s infinite;pointer-events:none}'
    + '@media(prefers-reduced-motion:reduce){[data-m-entrance],[data-m-card],[data-m-action],[data-m-action]::after{animation:none!important;transition:none!important}}';
  /* Limpia un objeto {entrance,card,action} dejando solo ids válidos de su tipo. */
  function normalize(raw) {
    const out = {}; if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(KINDS).forEach(k => { const m = get(raw[k]); if (m && m.kind === k) out[k] = m.id; });
    return out;
  }
  /* Atributos para un bloque según su rol, la animación elegida y su posición (para la cascada). */
  function attrs(motion, role, index) {
    const m = normalize(motion), a = {};
    if (m.entrance) { a['data-m-entrance'] = m.entrance; a.style = '--i:' + Math.min(index, 12); }
    if (m.card && role === 'cards') a['data-m-card'] = m.card;
    if (m.action && role === 'actions') a['data-m-action'] = m.action;
    return a;
  }
  const attrString = a => Object.keys(a).map(k => ' ' + k + '="' + String(a[k]).replace(/[^\w:;.\-\s]/g, '') + '"').join('');
  root.TintaMotion = { KINDS, LIST, CSS, get, normalize, attrs, attrString };
  if (typeof module !== 'undefined') module.exports = root.TintaMotion;
})(typeof window !== 'undefined' ? window : globalThis);
