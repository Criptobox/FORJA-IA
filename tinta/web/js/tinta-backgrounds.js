/* Estilos de fondo: una capa que cambia SOLO el fondo de la pantalla (degradados suaves, cristal con color,
   patrones y fondos oscuros con brillo). Como las paletas y los estilos visuales, es una capa: no toca los bloques,
   se quita de un toque y llega a la exportación.
   bg = valor CSS de «background»; dock = color liso aproximado (para medir contraste y para la barra);
   dark = el fondo es oscuro: la pantalla usa la capa oscura (con la paleta oscura elegida o «Carbón»).
   Solo gradientes y colores: sin imágenes ni recursos externos. */
(function (root) {
  'use strict';
  const HEX = /^#[0-9a-f]{6}$/i;
  const LIST = [
    { id: 'aurora', name: 'Aurora', tag: 'Tres brillos de color sobre blanco', group: 'degradados', dock: '#f3f5ff',
      bg: 'radial-gradient(60% 40% at 12% 8%,#9fe3ffb3,transparent 70%),radial-gradient(55% 40% at 92% 18%,#c9b2ffb3,transparent 70%),radial-gradient(70% 45% at 30% 96%,#ffc9e2b3,transparent 70%),#f3f5ff' },
    { id: 'atardecer', name: 'Atardecer', tag: 'Durazno, rosa y lila', group: 'degradados', dock: '#ffe3d9', bg: 'linear-gradient(180deg,#ffe3cf,#ffd0e0 55%,#e4d4ff)' },
    { id: 'oceano', name: 'Océano claro', tag: 'Azules de espuma', group: 'degradados', dock: '#dff1fb', bg: 'linear-gradient(180deg,#e1f6ff,#c9e8fb 60%,#d9e2ff)' },
    { id: 'menta', name: 'Menta fresca', tag: 'Verdes suaves', group: 'degradados', dock: '#e2f7ee', bg: 'linear-gradient(160deg,#e6fbf1,#d4f3ea 55%,#e5f5d9)' },
    { id: 'lavanda', name: 'Lavanda', tag: 'Violetas y rosa pálido', group: 'degradados', dock: '#efe8fd', bg: 'linear-gradient(170deg,#f1eaff,#e5dcfb 55%,#f9e6f6)' },
    { id: 'durazno', name: 'Durazno cálido', tag: 'Luz cálida desde una esquina', group: 'degradados', dock: '#fff0e4', bg: 'radial-gradient(70% 50% at 100% 0,#ffd9bd,transparent 70%),linear-gradient(180deg,#fff4ea,#ffe8dc)' },
    { id: 'cristal-rosa', name: 'Cristal rosa y cian', tag: 'Color detrás para que el vidrio brille', group: 'cristal', dock: '#efe9ff',
      bg: 'radial-gradient(50% 35% at 18% 10%,#ff9ec7,transparent 70%),radial-gradient(45% 30% at 88% 28%,#8fd8ff,transparent 70%),radial-gradient(60% 40% at 40% 92%,#c3a6ff,transparent 70%),#eee9ff' },
    { id: 'cristal-azul', name: 'Cristal azul', tag: 'Azul y turquesa difuminados', group: 'cristal', dock: '#e6efff',
      bg: 'radial-gradient(55% 38% at 15% 6%,#7fb2ff,transparent 70%),radial-gradient(50% 35% at 92% 30%,#7fe6d6,transparent 70%),radial-gradient(60% 40% at 35% 95%,#b9c6ff,transparent 70%),#e6efff' },
    { id: 'burbujas', name: 'Burbujas', tag: 'Círculos translúcidos', group: 'cristal', dock: '#eaf3ff',
      bg: 'radial-gradient(circle at 20% 15%,#ffffffcc 0 6%,transparent 6.5%),radial-gradient(circle at 80% 30%,#ffffff99 0 9%,transparent 9.5%),radial-gradient(circle at 35% 70%,#ffffff80 0 12%,transparent 12.5%),radial-gradient(circle at 85% 85%,#ffffffb3 0 7%,transparent 7.5%),linear-gradient(170deg,#d9ecff,#e9ddff 60%,#ffe0ee)' },
    { id: 'niebla', name: 'Niebla', tag: 'Gris lila con velo', group: 'cristal', dock: '#ececf3',
      bg: 'radial-gradient(70% 45% at 20% 0,#ffffffcc,transparent 70%),radial-gradient(60% 40% at 100% 60%,#d9d2ee,transparent 70%),linear-gradient(180deg,#f1f0f6,#e4e3ee)' },
    { id: 'puntos', name: 'Puntos', tag: 'Rejilla de puntos sutil', group: 'patrones', dock: '#f6f3ec', bg: 'radial-gradient(#1b1a1824 1.3px,transparent 1.4px) 0 0/18px 18px,#f6f3ec' },
    { id: 'cuadricula', name: 'Cuadrícula', tag: 'Líneas finas de cuaderno técnico', group: 'patrones', dock: '#f7f6f2',
      bg: 'linear-gradient(#1b1a1814 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,#1b1a1814 1px,transparent 1px) 0 0/22px 22px,#f7f6f2' },
    { id: 'diagonal', name: 'Diagonales', tag: 'Rayas finas a 45°', group: 'patrones', dock: '#f6f3ec', bg: 'repeating-linear-gradient(45deg,#1b1a180f 0 2px,transparent 2px 14px),#f6f3ec' },
    { id: 'papel', name: 'Papel crema', tag: 'Textura de papel cálido', group: 'patrones', dock: '#f7f1e3', bg: 'radial-gradient(#00000009 1px,transparent 1.2px) 0 0/6px 6px,linear-gradient(180deg,#fbf6ea,#f3ecdc)' },
    { id: 'rayas', name: 'Rayas suaves', tag: 'Bandas verticales casi invisibles', group: 'patrones', dock: '#f5f4f0', bg: 'repeating-linear-gradient(90deg,#0000000a 0 14px,transparent 14px 28px),#f5f4f0' },
    { id: 'noche', name: 'Noche violeta', tag: 'Violeta y magenta sobre negro', group: 'oscuros', dark: true, dock: '#0f0e1c',
      bg: 'radial-gradient(60% 40% at 20% 0,#4b3a9a77,transparent 70%),radial-gradient(50% 35% at 100% 40%,#c2418a55,transparent 70%),#0f0e1c' },
    { id: 'neon-oscuro', name: 'Neón oscuro', tag: 'Cian y violeta eléctrico', group: 'oscuros', dark: true, dock: '#070812',
      bg: 'radial-gradient(55% 35% at 10% 10%,#00e0ff44,transparent 70%),radial-gradient(55% 35% at 95% 55%,#9b5cff55,transparent 70%),#070812' },
    { id: 'carbon-liso', name: 'Carbón', tag: 'Gris casi negro, sin ruido', group: 'oscuros', dark: true, dock: '#1a1b1e', bg: 'linear-gradient(180deg,#1f2023,#141416)' },
    { id: 'aurora-oscura', name: 'Aurora oscura', tag: 'Verde y azul sobre noche', group: 'oscuros', dark: true, dock: '#0b1014',
      bg: 'radial-gradient(60% 40% at 80% 0,#2ee6a355,transparent 70%),radial-gradient(50% 40% at 0 60%,#6a5cff55,transparent 70%),#0b1014' },
    { id: 'brasa', name: 'Brasa', tag: 'Naranja y granate sobre negro cálido', group: 'oscuros', dark: true, dock: '#140d0c',
      bg: 'radial-gradient(60% 40% at 100% 0,#ff7a3a55,transparent 70%),radial-gradient(50% 40% at 0 80%,#a3226a44,transparent 70%),#140d0c' }
  ];
  const GROUPS = [{ id: 'degradados', name: 'Degradados suaves' }, { id: 'cristal', name: 'Cristal y burbujas' }, { id: 'patrones', name: 'Patrones y texturas' }, { id: 'oscuros', name: 'Oscuros con brillo' }];
  const get = id => LIST.find(b => b.id === id) || null;
  const normalize = id => (typeof id === 'string' && get(id)) ? id : null;
  const valid = b => !!b && typeof b.bg === 'string' && HEX.test(b.dock) && !/url\(|<|@import|;|\{|\}/.test(b.bg);
  root.TintaBackgrounds = { LIST, GROUPS, get, normalize, valid };
  if (typeof module !== 'undefined') module.exports = root.TintaBackgrounds;
})(typeof window !== 'undefined' ? window : globalThis);
