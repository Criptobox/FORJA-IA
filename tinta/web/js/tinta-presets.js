/* Estilos listos de un toque: tarjetas (12), colores de botón (+9) y formas de botón.
   Son datos tipados que pasan por las mismas validaciones del inspector (TintaCardStyle / TintaButtonStyle):
   nunca CSS libre. Se aplican al diálogo abierto y se pueden afinar a mano antes de confirmar. */
(function (root) {
  'use strict';
  const base = { format: 'solid', background: '#ffffff', secondary: '#ffac78', foreground: '#242421', textMode: 'original', borderColor: '#e4e0d5', borderWidth: 1, radius: 24, padding: 16, angle: 135, shadow: 'soft' };
  const card = (id, name, desc, v) => ({ id, name, desc, v: { ...base, ...v } });
  const CARD_PRESETS = [
    card('plana', 'Plana', 'Blanca, sin sombra, borde fino.', { radius: 20, shadow: 'none' }),
    card('elevada', 'Elevada', 'Blanca, esquinas amplias y sombra marcada.', { borderWidth: 0, radius: 28, padding: 18, shadow: 'raised' }),
    card('contorno', 'Contorno', 'Borde grueso en tinta, sin sombra.', { background: '#fbfaf6', borderColor: '#242421', borderWidth: 2, radius: 16, shadow: 'none' }),
    card('papel', 'Papel cálido', 'Crema suave con borde dorado.', { background: '#fbf5e9', borderColor: '#eadfc7', radius: 22 }),
    card('editorial', 'Editorial', 'Esquinas casi rectas y borde fino: revista.', { borderColor: '#242421', radius: 4, shadow: 'none' }),
    card('redonda', 'Redonda', 'Muy redondeada y con aire.', { background: '#fffdf8', borderColor: '#ecd9b8', radius: 44, padding: 22 }),
    card('menta', 'Menta', 'Verde muy claro, fresca.', { background: '#e3f3ea', borderColor: '#c9e6d6' }),
    card('lavanda', 'Lavanda', 'Violeta suave.', { background: '#ece7fa', borderColor: '#d7cff2' }),
    card('grafito', 'Grafito', 'Oscura con texto claro.', { background: '#2c2c28', borderColor: '#2c2c28', borderWidth: 0, radius: 26, shadow: 'raised', textMode: 'custom', foreground: '#f3f1ed' }),
    card('coral', 'Coral', 'Degradado cálido con texto oscuro.', { format: 'gradient', background: '#ff8a5c', secondary: '#ffb08f', angle: 140, borderWidth: 0, radius: 28, textMode: 'custom', foreground: '#2a1408' }),
    card('oceano', 'Océano', 'Degradado turquesa con texto blanco.', { format: 'gradient', background: '#0b5f78', secondary: '#0f7f99', angle: 135, borderWidth: 0, radius: 28, shadow: 'raised', textMode: 'custom', foreground: '#ffffff' }),
    card('noche', 'Noche', 'Degradado azul noche con texto claro.', { format: 'gradient', background: '#1f2433', secondary: '#3a4260', angle: 160, borderWidth: 0, radius: 26, shadow: 'raised', textMode: 'custom', foreground: '#eef0f8' })
  ];
  /* Colores de botón (el texto es blanco): todos con contraste ≥ 4.5:1 sobre blanco. */
  const BUTTON_COLORS = [
    ['Grafito', '#32352d'], ['Coral', '#c6492a'], ['Azul', '#2456c3'], ['Verde', '#25633c'],
    ['Océano', '#0e7490'], ['Lavanda', '#6d5bd0'], ['Rosa', '#c2335f'], ['Mostaza', '#946200'], ['Menta', '#247a70'], ['Vino', '#7a1f3d'], ['Cielo', '#1d6fb8'], ['Negro', '#111111'], ['Terracota', '#b8472a']
  ];
  const BUTTON_FORMATS = [['solid', 'Sólido'], ['outline', 'Contorno'], ['soft', 'Suave'], ['gradient', 'Degradado']];
  const getCard = id => CARD_PRESETS.find(p => p.id === id) || null;
  root.TintaPresets = { CARD_PRESETS, BUTTON_COLORS, BUTTON_FORMATS, getCard };
  if (typeof module !== 'undefined') module.exports = root.TintaPresets;
})(typeof window !== 'undefined' ? window : globalThis);
