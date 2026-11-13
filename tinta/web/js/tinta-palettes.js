/* Paletas de Tinta: una capa de color para toda la pantalla (fondo, tarjetas y botones).
   Es una CAPA: no escribe estilos en cada bloque, así que se quita de un toque y alcanza también
   a los bloques que añadas después. Los estilos propios de un bloque (Diseño / Color) mandan sobre
   la paleta. Las claras dejan cabeceras y barras con su diseño original; las oscuras (dark: true) pasan todos los
   bloques de la pantalla a modo noche con la capa TintaDark. */
(function (root) {
  'use strict';
  const LIST = [
    { id: 'tinta', name: 'Tinta', mood: 'Papel cálido y coral', bg: '#f5f4ef', surface: '#ffffff', accent: '#ff704b', accent2: '#ffb08f', ink: '#242421', line: '#e4e0d5' },
    { id: 'cafe', name: 'Café tostado', mood: 'Marrones cálidos', bg: '#f4ece1', surface: '#fffaf3', accent: '#8a5a3c', accent2: '#d9a066', ink: '#2b1d14', line: '#e7d8c4' },
    { id: 'oceano', name: 'Océano', mood: 'Azules limpios', bg: '#eaf3f6', surface: '#ffffff', accent: '#0e7490', accent2: '#67c6d9', ink: '#0f2a33', line: '#cfe3ea' },
    { id: 'bosque', name: 'Bosque', mood: 'Verdes naturales', bg: '#eef3ec', surface: '#fbfdf9', accent: '#2f6b3f', accent2: '#9fd3a8', ink: '#14281a', line: '#d4e2d1' },
    { id: 'lavanda', name: 'Lavanda', mood: 'Violetas suaves', bg: '#f1eefa', surface: '#ffffff', accent: '#6d5bd0', accent2: '#b7a9f0', ink: '#231d46', line: '#dcd6f2' },
    { id: 'atardecer', name: 'Atardecer', mood: 'Naranjas vivos', bg: '#fdf1ea', surface: '#fffaf6', accent: '#e4572e', accent2: '#ffb347', ink: '#3a1d12', line: '#f1d9cb' },
    { id: 'rosa', name: 'Rosa', mood: 'Rosas con carácter', bg: '#fbeff3', surface: '#ffffff', accent: '#c2335f', accent2: '#f4a6bf', ink: '#3a1224', line: '#f1d2dd' },
    { id: 'grafito', name: 'Grafito', mood: 'Neutros serios', bg: '#e9eaec', surface: '#ffffff', accent: '#2b2f36', accent2: '#8b93a1', ink: '#15171b', line: '#d5d8dd' },
    { id: 'mostaza', name: 'Mostaza', mood: 'Dorados cálidos', bg: '#f8f0dc', surface: '#fffbee', accent: '#946200', accent2: '#f0c35a', ink: '#2b2008', line: '#ecdcae' },
    { id: 'menta', name: 'Menta', mood: 'Verdes frescos', bg: '#e9f5ef', surface: '#fbfefc', accent: '#1f7a5a', accent2: '#8fd6b8', ink: '#0f2b20', line: '#cfe6da' },
    { id: 'cielo', name: 'Cielo', mood: 'Azules claros', bg: '#eaf1fb', surface: '#ffffff', accent: '#1d5fb8', accent2: '#8fb8f0', ink: '#10233f', line: '#cfdcf0' },
    { id: 'terracota', name: 'Terracota', mood: 'Arcillas y barro', bg: '#f7ebe4', surface: '#fffaf6', accent: '#b8472a', accent2: '#e8a083', ink: '#34170d', line: '#ebd2c5' },
    { id: 'vino', name: 'Vino', mood: 'Burdeos elegante', bg: '#f5e9ec', surface: '#fffafb', accent: '#7a1f3d', accent2: '#d68aa2', ink: '#2e0d17', line: '#e8cdd5' },
    { id: 'arena', name: 'Arena', mood: 'Beige natural', bg: '#f2eee4', surface: '#fffdf8', accent: '#6b5b3a', accent2: '#cdb98a', ink: '#25201a', line: '#e1d9c6' },
    { id: 'pizarra', name: 'Pizarra', mood: 'Gris azulado', bg: '#e9edf1', surface: '#ffffff', accent: '#34495e', accent2: '#8da2b5', ink: '#131b23', line: '#d2dae2' },
    { id: 'lima', name: 'Lima', mood: 'Verde vivo', bg: '#f0f4df', surface: '#fdfef6', accent: '#4b6b12', accent2: '#b6d85f', ink: '#1a2406', line: '#dbe5b8' },
    /* De tus referencias: Pixel (Iris, Nostalgia, Higo, Martín pescador), Bruma, Coral y marino y la tabla CMYK. */
    { id: 'iris', name: 'Iris', mood: 'Violeta floral', bg: '#f5f0fd', surface: '#ffffff', accent: '#5a3a96', accent2: '#a68ad9', ink: '#2f1a5c', line: '#d8c6f4' },
    { id: 'nostalgia', name: 'Nostalgia azul', mood: 'Azul hortensia', bg: '#eef5fb', surface: '#ffffff', accent: '#4f7091', accent2: '#9ebfd9', ink: '#1f3a58', line: '#d6e6f7' },
    { id: 'higo', name: 'Higo', mood: 'Rosa y ciruela', bg: '#fbeff4', surface: '#ffffff', accent: '#8a3f6b', accent2: '#d49ab5', ink: '#4a1a38', line: '#f3d6e4' },
    { id: 'martin-pescador', name: 'Martín pescador', mood: 'Turquesa profundo', bg: '#eaf8fb', surface: '#ffffff', accent: '#0d5b73', accent2: '#3fb7c9', ink: '#0a3340', line: '#c8f0f6' },
    { id: 'bruma', name: 'Bruma', mood: 'Rosa y gris azulado', bg: '#f1f7f7', surface: '#ffffff', accent: '#5d6b6b', accent2: '#f7cbca', ink: '#1d2929', line: '#d5e5e5' },
    { id: 'coral-marino', name: 'Coral y marino', mood: 'Coral, durazno y azul', bg: '#fff6f0', surface: '#ffffff', accent: '#326280', accent2: '#ebaca2', ink: '#212e53', line: '#f3d5c8' },
    { id: 'royal-indigo', name: 'Índigo real', mood: 'Azules intensos', bg: '#eff0f9', surface: '#fbfbfd', accent: '#1b1f8f', accent2: '#7986cb', ink: '#1b1f8f', line: '#d9ddf1' },
    { id: 'armonia-turquesa', name: 'Armonía turquesa', mood: 'Verdes azulados', bg: '#e9f6f5', surface: '#fafdfc', accent: '#00695c', accent2: '#4db6ac', ink: '#004f45', line: '#cdeae8' },
    { id: 'coral-calido', name: 'Coral cálido', mood: 'Naranjas suaves', bg: '#fff6e9', surface: '#fffdfa', accent: '#e65100', accent2: '#ffcc80', ink: '#8a3100', line: '#ffebcd' },
    { id: 'esmeralda', name: 'Esmeralda', mood: 'Verdes profundos', bg: '#e6f4e6', surface: '#f9fcf9', accent: '#004d40', accent2: '#66bb6a', ink: '#004d40', line: '#c4e4c6' },
    { id: 'llama', name: 'Llama de atardecer', mood: 'Rojos y naranjas', bg: '#fff6e9', surface: '#fffdfa', accent: '#c4380f', accent2: '#ffb74d', ink: '#82280d', line: '#ffebcd' },
    { id: 'menta-oceano', name: 'Menta océano', mood: 'Turquesas frescos', bg: '#e9f9fb', surface: '#fafefe', accent: '#00838f', accent2: '#4dd0e1', ink: '#004f56', line: '#cdf2f7' },
    { id: 'flor-rosa', name: 'Flor rosa', mood: 'Rosas vivos', bg: '#fdecf2', surface: '#fffafc', accent: '#d81b60', accent2: '#f48fb1', ink: '#82103a', line: '#fad3e0' },
    { id: 'ambar-dorado', name: 'Ámbar dorado', mood: 'Dorados luminosos', bg: '#fffce4', surface: '#fffef8', accent: '#b58700', accent2: '#ffd54f', ink: '#513d00', line: '#fff8bf' },
    { id: 'violeta-ensueno', name: 'Ensueño violeta', mood: 'Violetas profundos', bg: '#f7edf8', surface: '#fdfafd', accent: '#6a1b9a', accent2: '#ce93d8', ink: '#6a1b9a', line: '#ecd5ef' },
    { id: 'lima-fresca', name: 'Lima fresca', mood: 'Verdes lima', bg: '#f5f8d8', surface: '#fdfdf5', accent: '#827717', accent2: '#aed581', ink: '#4e470e', line: '#e8efa5' },
    { id: 'moras', name: 'Moras', mood: 'Burdeos y rosas', bg: '#fdecf2', surface: '#fffafc', accent: '#880e4f', accent2: '#ec407a', ink: '#880e4f', line: '#fad3e0' },
    { id: 'cielo-claro', name: 'Cielo claro', mood: 'Azules cielo', bg: '#f7fcff', surface: '#fdfeff', accent: '#01579b', accent2: '#81d4fa', ink: '#014174', line: '#ecf8fe' },
    { id: 'terracota-suave', name: 'Terracota suave', mood: 'Arcillas y rosados', bg: '#fcfcfc', surface: '#fefefe', accent: '#bf360c', accent2: '#d7ccc8', ink: '#8f2809', line: '#f8f8f8' },
    { id: 'pizarra-gris', name: 'Pizarra gris', mood: 'Gris azulado frío', bg: '#f2f4f5', surface: '#fcfcfd', accent: '#263238', accent2: '#90a4ae', ink: '#263238', line: '#e0e6e8' },
    { id: 'violeta-intenso', name: 'Violeta intenso', mood: 'Índigos y lilas', bg: '#f2eef9', surface: '#fcfbfd', accent: '#4527a0', accent2: '#b39ddb', ink: '#4527a0', line: '#e1d9f1' },
    { id: 'menta-aqua', name: 'Menta aqua', mood: 'Verdes agua', bg: '#e9f9fb', surface: '#fafefe', accent: '#009688', accent2: '#80deea', ink: '#005a52', line: '#cdf2f7' },
    /* Oscuras: el fondo, las tarjetas, cabeceras y barras pasan a modo noche (capa TintaDark). */
    { id: 'noche', name: 'Noche', mood: 'Oscura · medianoche y coral', dark: true, bg: '#0f1220', surface: '#1a1e33', accent: '#ff7a59', accent2: '#ffb08f', ink: '#f2f3f8', line: '#2c3150' },
    { id: 'neon', name: 'Neón', mood: 'Oscura · cian y magenta', dark: true, bg: '#0a0b1e', surface: '#15173a', accent: '#2ee6ff', accent2: '#ff4fd8', ink: '#eef1ff', line: '#2a2d5e' },
    { id: 'galaxia', name: 'Galaxia', mood: 'Oscura · violeta profundo', dark: true, bg: '#120c24', surface: '#1f1638', accent: '#a78bfa', accent2: '#f472b6', ink: '#f3eefe', line: '#33285a' },
    { id: 'carbon', name: 'Carbón', mood: 'Oscura · negro y lima', dark: true, bg: '#0e0f0d', surface: '#1a1c18', accent: '#c6f432', accent2: '#7fae1c', ink: '#f1f3ec', line: '#2c2f28' },
    { id: 'abismo', name: 'Abismo', mood: 'Oscura · azul y turquesa', dark: true, bg: '#06161d', surface: '#0e2530', accent: '#2dd4bf', accent2: '#38bdf8', ink: '#e6f6f7', line: '#1d3a46' },
    { id: 'brasa', name: 'Brasa', mood: 'Oscura · negro y fuego', dark: true, bg: '#160d0a', surface: '#241510', accent: '#ff7a1a', accent2: '#ffd23f', ink: '#fbefe7', line: '#3a241b' },
    { id: 'musgo', name: 'Musgo', mood: 'Oscura · verde nocturno', dark: true, bg: '#0c1610', surface: '#15241a', accent: '#4ade80', accent2: '#a3e635', ink: '#ecf7ef', line: '#24392a' },
    { id: 'lujo', name: 'Lujo', mood: 'Oscura · negro y dorado', dark: true, bg: '#111111', surface: '#1c1c1c', accent: '#e0b354', accent2: '#f5d98b', ink: '#f5f1e8', line: '#2f2f2f' },
    { id: 'ted', name: 'Rojo escena', mood: 'Oscura · negro y rojo', dark: true, bg: '#0a0203', surface: '#3d0009', accent: '#d6001f', accent2: '#eb0028', ink: '#ffffff', line: '#660010' },
    { id: 'olivo', name: 'Olivo', mood: 'Oscura · verde oliva y arena', dark: true, bg: '#17251f', surface: '#344b3a', accent: '#d6c99a', accent2: '#a6a078', ink: '#f1ebdd', line: '#65745a' },
    /* De tus referencias (segunda tanda): paletas de seis tonos, claras y oscuras. */
    { id: 'malva', name: 'Malva', mood: 'Malva y beige cálido', bg: '#f7efe7', surface: '#fffaf6', accent: '#6b5560', accent2: '#c7a9a3', ink: '#3e3239', line: '#e8d2c4' },
    { id: 'humo-violeta', name: 'Humo violeta', mood: 'Oscura · violeta humo', dark: true, bg: '#17151c', surface: '#292531', accent: '#aaa2b3', accent2: '#716879', ink: '#e2dde7', line: '#45404f' },
    { id: 'niebla-pizarra', name: 'Niebla pizarra', mood: 'Gris azulado y lila', bg: '#dedcdc', surface: '#f3f2f2', accent: '#57707a', accent2: '#7b919c', ink: '#191d23', line: '#c5bac4' },
    { id: 'lavanda-cristal', name: 'Lavanda cristal', mood: 'Lavanda y violeta', bg: '#f7f8ff', surface: '#ffffff', accent: '#5b4bff', accent2: '#a78bfa', ink: '#0d0b2d', line: '#e6e0ff' },
    { id: 'amatista', name: 'Amatista', mood: 'Violetas luminosos', bg: '#faf9ff', surface: '#ffffff', accent: '#5b21b6', accent2: '#c7b3ff', ink: '#1b0f3a', line: '#ede9fe' },
    { id: 'azul-cobalto', name: 'Azul cobalto', mood: 'Azules vivos', bg: '#f0f7ff', surface: '#ffffff', accent: '#2563eb', accent2: '#60a5fa', ink: '#0b1f3b', line: '#dbeafe' },
    { id: 'mandarina', name: 'Mandarina', mood: 'Naranja y crema', bg: '#fff8ef', surface: '#ffffff', accent: '#ff7a00', accent2: '#ffa94d', ink: '#1f1d2b', line: '#ffe4c7' },
    { id: 'rosa-pop', name: 'Rosa pop', mood: 'Rosas vivos y ciruela', bg: '#fff9fb', surface: '#ffffff', accent: '#ec4899', accent2: '#f9a8d4', ink: '#6d0d3f', line: '#fce7f3' },
    { id: 'aqua', name: 'Aqua', mood: 'Turquesas frescos', bg: '#f8fffe', surface: '#ffffff', accent: '#14b8a6', accent2: '#99f6e4', ink: '#0b3d3b', line: '#e6fffb' },
    { id: 'ultravioleta', name: 'Ultravioleta', mood: 'Oscura · violeta intenso', dark: true, bg: '#0b0720', surface: '#25134d', accent: '#9d71e8', accent2: '#6a2fc8', ink: '#f2e9ff', line: '#3b2478' },
    { id: 'frambuesa', name: 'Frambuesa noche', mood: 'Oscura · rosa y granate', dark: true, bg: '#2a0414', surface: '#4d0c2a', accent: '#ff69b4', accent2: '#c24366', ink: '#ffe4d8', line: '#7a1a45' },
    { id: 'obsidiana', name: 'Obsidiana', mood: 'Oscura · negro y blanco', dark: true, bg: '#0b0b0b', surface: '#1a1a1a', accent: '#d9d9d9', accent2: '#6b6b6b', ink: '#ffffff', line: '#333333' },
    { id: 'cian-electrico', name: 'Cian eléctrico', mood: 'Oscura · turquesa y azul', dark: true, bg: '#05161a', surface: '#072e33', accent: '#0f969c', accent2: '#6da5c0', ink: '#e6f7f9', line: '#1b4a52' },
    { id: 'bosque-nocturno', name: 'Bosque nocturno', mood: 'Oscura · verde esmeralda', dark: true, bg: '#051f20', surface: '#0b2b26', accent: '#8eb69b', accent2: '#235347', ink: '#daf1de', line: '#1d4a3e' },
    { id: 'burdeos-noche', name: 'Burdeos noche', mood: 'Oscura · vino y rosa', dark: true, bg: '#1d1015', surface: '#421b29', accent: '#d28b96', accent2: '#a64c61', ink: '#f1dde0', line: '#702b40' },
    { id: 'azul-acero', name: 'Azul acero', mood: 'Oscura · azul grisáceo', dark: true, bg: '#06141b', surface: '#11212d', accent: '#9ba8ab', accent2: '#4a5c6a', ink: '#ccd0cf', line: '#253745' },
    { id: 'cafe-moka', name: 'Café moka', mood: 'Oscura · chocolate y crema', dark: true, bg: '#211713', surface: '#493126', accent: '#e0c58e', accent2: '#b18a62', ink: '#f6eedb', line: '#78533b' },
    { id: 'pastel-marino', name: 'Pastel marino', mood: 'Rosa y verde agua', bg: '#f1f7f7', surface: '#ffffff', accent: '#5d6b6b', accent2: '#f7cbca', ink: '#2c3535', line: '#d5e5e5' }
  ];
  const HEX = /^#[0-9a-f]{6}$/i;
  const get = id => LIST.find(p => p.id === id) || null;
  const lum = c => { const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return r * .2126 + g * .7152 + b * .0722; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  /* Texto sobre el acento: el que más contraste dé. */
  const onAccent = c => contrast(c, '#ffffff') >= contrast(c, '#111111') ? '#ffffff' : '#111111';
  const normalize = id => (typeof id === 'string' && get(id)) ? id : null;
  const valid = p => ['bg', 'surface', 'accent', 'accent2', 'ink', 'line'].every(k => HEX.test(p[k]));
  /* Paletas propias (sacadas de una foto o un logo): se guardan en el dispositivo y se suman a la lista al arrancar. */
  const MINE_KEY = 'estilos-tinta-paletas-v1', MAX_MINE = 12;
  const clean = p => {
    if (!p || typeof p !== 'object' || !/^mia-[a-z0-9]{3,12}$/.test(p.id) || !valid(p)) return null;
    const o = { id: p.id, name: String(p.name || 'Mi paleta').replace(/[<>]/g, '').trim().slice(0, 40) || 'Mi paleta', mood: p.dark ? 'De tu imagen · oscura' : 'De tu imagen · clara', mine: true };
    ['bg', 'surface', 'accent', 'accent2', 'ink', 'line'].forEach(k => { o[k] = p[k].toLowerCase(); });
    if (p.dark) o.dark = true;
    return o;
  };
  const mine = () => LIST.filter(p => p.mine);
  function saveMine() { try { localStorage.setItem(MINE_KEY, JSON.stringify(mine())); return true; } catch (e) { return false; } }
  function loadMine() {
    let raw; try { raw = JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); } catch (e) { raw = []; }
    if (!Array.isArray(raw)) return 0; let n = 0;
    raw.slice(0, MAX_MINE).forEach(r => { const c = clean(r); if (c && !get(c.id)) { LIST.push(c); n++; } });
    return n;
  }
  function addMine(p) {
    const c = clean(p); if (!c) return null;
    if (mine().length >= MAX_MINE) { const old = mine()[0]; LIST.splice(LIST.indexOf(old), 1); }
    LIST.push(c); saveMine(); return c;
  }
  function removeMine(id) { const p = get(id); if (!p || !p.mine) return false; LIST.splice(LIST.indexOf(p), 1); saveMine(); return true; }
  root.TintaPalettes = { LIST, get, contrast, onAccent, normalize, valid, mine, loadMine, addMine, removeMine, MAX_MINE };
  if (typeof module !== 'undefined') module.exports = root.TintaPalettes;
})(typeof window !== 'undefined' ? window : globalThis);
