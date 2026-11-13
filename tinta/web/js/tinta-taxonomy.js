/* Organización de la biblioteca: categorías y subcategorías por tipo de bloque.
   Cada bloque pertenece a una categoría (por su rol) y a una subcategoría (por su id). Las categorías «especiales»
   (plantillas, paletas, animaciones, guardados) no son listas de bloques: tienen su propia vista.
   Datos puros y sin DOM, para comprobarlos en pruebas. */
(function (root) {
  'use strict';
  const S = (id, name, ids) => ({ id, name, ids });
  const CATEGORIES = [
    { id: 'plantillas', name: 'Plantillas', desc: 'Apps completas listas para adaptar a tu idea.', special: 'templates', glyph: '▣', color: ['#c8421f', '#ca4a28'] },
    { id: 'paletas', name: 'Paletas de color', desc: 'Capas de color para toda la pantalla, claras y oscuras.', special: 'palettes', glyph: '◐', color: ['#5a48c2', '#7465cc'] },
    { id: 'fondos', name: 'Estilos de fondo', desc: 'Degradados suaves, cristal con color, patrones y fondos oscuros con brillo, solo para el fondo de la pantalla.', special: 'backgrounds', glyph: '▨', color: ['#3a6aa8', '#5c8fd0'] },
    { id: 'tipografias', name: 'Tipografías', desc: 'Doce letras para toda la pantalla: modernas, clásicas con serifa y de carácter. Usan las fuentes de tu dispositivo.', special: 'fonts', glyph: 'Aa', color: ['#2a6a5a', '#3f8a78'] },
    { id: 'estilos', name: 'Estilos visuales', desc: 'Minimalismo, suizo, bento, clay, cristal, neón, brutalismo, neumorfismo y tres acabados Pro (cristal, 3D y degradado) para toda la pantalla.', special: 'styles', glyph: '❖', color: ['#8a3f6b', '#9d5e83'] },
    { id: 'animaciones', name: 'Animaciones', desc: 'Entradas, efectos al tocar y microinteracciones.', special: 'motion', glyph: '✦', color: ['#0b6278', '#377e90'] },
    { id: 'barras', name: 'Barras inferiores', desc: 'Todas las barras de navegación de la app.', roles: ['nav'], glyph: '▭', color: ['#262624', '#747473'],
      subs: [S('esenciales', 'Esenciales y limpias', ['n-soft', 'lib-bar-2', 'lib-bar-10', 'lib-bar-11', 'lib-bar-12']), S('flotantes', 'Flotantes y en isla', ['n-dark', 'lib-bar-1', 'lib-bar-4']), S('central', 'Con botón central', ['n-float', 'lib-bar-3', 'lib-bar-5', 'lib-bar-7']), S('activo', 'Indicador de activo', ['lib-bar-6', 'lib-bar-8', 'lib-bar-9']), S('apps', 'De apps reales', ['n-pastilla-negra', 'n-cristal', 'n-pastilla-activa', 'n-tres-minima', 'n-isla-azul', 'n-blanca-naranja', 'n-ia-oscura', 'n-helado', 'n-pn-violeta', 'n-mu-cristal', 'n-te-tienda', 'n-bi-pildora', 'n-ma-circulos', 'n-be-negra', 'n-nu-negra', 'n-cu-cristal', 'n-se-claro'])] },
    { id: 'botones', name: 'Botones', desc: 'Principales, suaves, circulares, chips y estados.', roles: ['actions'], glyph: '◉', color: ['#a82a51', '#b85070'],
      subs: [S('principales', 'Principales', ['a-dark', 'a-coral', 'r-bi-boton', 'lib-bot-1', 'lib-bot-2', 'lib-bot-3']), S('suaves', 'Suaves, de borde y texto', ['a-soft', 'lib-bot-8', 'lib-bot-4']), S('circulares', 'Circulares y cantidad', ['lib-bot-5', 'lib-bot-7']), S('chips', 'Chips, acceso y estados', ['lib-bot-6', 'lib-bot-9', 'lib-bot-10'])] },
    { id: 'tarjetas', name: 'Tarjetas', desc: 'Tarjetas por tipo de app: tienda, viajes, finanzas, perfil…', roles: ['cards'], glyph: '▤', color: ['#8f4a12', '#a8642a'],
      subs: [S('tienda', 'Tienda y comida', ['c-coffee', 'c-shop', 'c-menu-item', 'lib-tar-1', 'lib-tar-4', 'lib-tar-6', 'r-comida-hero', 'r-comida-categorias', 'r-comida-plato', 'r-combo', 'r-tamanos']), S('viajes', 'Viajes y eventos', ['c-destino', 'lib-tar-2', 'lib-tar-16', 'lib-tar-20', 'r-viaje-hero', 'r-viaje-paquete', 'r-viaje-detalle']), S('salud', 'Música, fitness, salud y cursos', ['c-track', 'c-workout', 'c-course', 'c-cita', 'lib-tar-21', 'r-fit-hero', 'r-fit-banner', 'r-fit-chips', 'r-fit-clase']), S('finanzas', 'Finanzas y resúmenes', ['c-balance', 'c-summary', 'c-txn', 'lib-tar-3', 'lib-tar-5']), S('perfil', 'Perfil y social', ['lib-tar-7', 'lib-tar-8', 'lib-tar-9', 'lib-tar-15', 'lib-tar-19']), S('promo', 'Promociones y editoriales', ['c-coral', 'lib-tar-11', 'lib-tar-17', 'lib-tar-18']), S('utilidad', 'Tareas, subida y esqueletos', ['lib-tar-10', 'lib-tar-12', 'lib-tar-13', 'lib-tar-14']), S('comercio', 'Comercio y pedidos', ['r-banner', 'r-categorias', 'r-servicios', 'r-fila-producto', 'r-grid-producto', 'r-pedido', 'r-metodos-pago', 'r-ruta', 'r-resumen', 'r-mosaico-servicios', 'r-actividad', 'r-perfil-atajos']), S('paneles', 'Paneles de ventas y control', ['r-pn-ventas', 'r-pn-heatmap', 'r-pn-kpi', 'r-pn-actividad', 'r-pn-saldo-mono', 'r-pn-saldo-verde', 'r-pn-acciones', 'r-pn-resumen-dia', 'r-pn-barras']), S('muebles', 'Muebles y hogar', ['r-mu-titulo', 'r-mu-banner', 'r-mu-categorias', 'r-mu-producto', 'r-mu-detalle', 'r-mu-resumen']), S('tienda-online', 'Tienda online', ['r-te-oferta', 'r-te-cat-circulos', 'r-te-ofertas', 'r-te-lista', 'r-te-ficha', 'r-te-carrito', 'r-te-pago', 'r-te-compra', 'r-te-seguimiento', 'r-te-confirmado', 'r-te-menu']), S('bienestar', 'Bienestar y terapia', ['r-bi-saludo', 'r-bi-asistente', 'r-bi-animo', 'r-bi-ejercicios', 'r-bi-categorias', 'r-bi-progreso', 'r-bi-pruebas']), S('mascotas', 'Mascotas', ['r-ma-pestanas', 'r-ma-amigo', 'r-ma-datos']), S('belleza', 'Belleza y cosmética', ['r-be-inmersivo', 'r-be-producto']), S('nutricion', 'Nutrición con IA', ['r-nu-comida', 'r-nu-categorias', 'r-nu-receta']), S('cursos', 'Cursos en cristal', ['r-cu-agenda', 'r-cu-curso']), S('seguros', 'Seguros y salud', ['r-se-servicios', 'r-se-hospital', 'r-se-ecard', 'r-se-teleconsulta']), S('asistentes', 'Especialistas y asistentes', ['r-medico', 'r-agente', 'r-ia-prompt', 'r-ia-salud']), S('reparto', 'Comida y reparto', ['r-fd-oscuro-plato', 'r-fd-barra-comprar', 'r-fd-hero-pastel', 'r-fd-restaurantes', 'r-fd-detalle', 'r-fd-helado-hero', 'r-fd-sabores', 'r-fd-oferta', 'r-fd-valoracion', 'r-fd-combo2x1', 'r-fd-combo-lista', 'r-fd-total-combo']), S('ia', 'Asistentes de IA', ['r-ia-saludo', 'r-ia-voz', 'r-ia-atajos', 'r-ia-tokens', 'r-ia-encargo', 'r-ia-mochi', 'r-ia-acciones', 'r-ia-permisos', 'r-ia-estado'])] },
    { id: 'cabeceras', name: 'Cabeceras', desc: 'Encabezados con buscador, título, saludo y perfil.', roles: ['header'], glyph: '▀', color: ['#2f6b3f', '#4c805a'],
      subs: [S('buscador', 'Con buscador', ['h-search', 'lib-enc-3']), S('titulo', 'Título y navegación', ['h-minimal', 'lib-enc-2', 'lib-enc-4']), S('saludo', 'Saludo y perfil', ['lib-enc-1', 'lib-enc-5', 'h-degradado']), S('imagen', 'Con imagen grande', ['r-ma-hero', 'r-be-detalle', 'r-be-buscar', 'r-nu-arco', 'r-nu-bienvenida', 'r-cu-semana', 'r-cu-detalle', 'r-se-bienvenida'])] },
    { id: 'avatares', name: 'Avatares y mascotas', desc: 'Personas, robots, mascotas y orbes.', roles: ['avatars'], glyph: '◯', color: ['#6d5bd0', '#7362d2'],
      subs: [S('personas', 'Personas', ['av-perfil', 'av-fila', 'av-anillo', 'av-grupo', 'av-portada', 'av-iniciales', 'lib-ava-3', 'lib-ava-4', 'lib-ava-5']), S('mascotas', 'Robots y mascotas', ['av-robot', 'av-robot-estados', 'av-llama', 'lib-ava-1']), S('figuras', 'Figuras 3D', ['av-fig-halloween', 'av-fig-chibis', 'av-fig-perfil', 'av-fig-cubos', 'av-fig-elige']), S('efectos', 'Orbes y efectos', ['av-orbe', 'av-efectos', 'lib-ava-2'])] },
    { id: 'formularios', name: 'Formularios y entradas', desc: 'Campos, búsqueda, acceso, pago y controles.', roles: ['forms', 'inputs'], glyph: '▱', color: ['#0e7490', '#217f99'],
      subs: [S('busqueda', 'Entradas y búsqueda', ['w-filtros', 'w-etiquetas', 'lib-ent-1', 'lib-ent-2', 'lib-ent-4', 'lib-ent-5', 'lib-ent-6']), S('acceso', 'Acceso y pago', ['lib-for-1', 'lib-for-2', 'w-pago']), S('controles', 'Controles y selectores', ['lib-for-3', 'lib-for-4', 'lib-for-5', 'lib-ent-3']), S('contacto', 'Contacto y valoración', ['w-contacto', 'w-valoracion'])] },
    { id: 'datos', name: 'Datos y widgets', desc: 'Gráficos, cifras, progreso, calendario y widgets.', roles: ['data', 'widgets'], glyph: '◔', color: ['#1f7a5a', '#2c8264'],
      subs: [S('graficos', 'Gráficos', ['w-linea', 'w-donut', 'w-barras-h', 'w-gauge', 'lib-dat-3']), S('cifras', 'Cifras y métricas', ['r-stats3', 'w-tendencia', 'lib-dat-1', 'lib-dat-4', 'lib-dat-5', 'lib-widget-stat-01']), S('progreso', 'Progreso y pasos', ['lib-dat-2', 'w-pasos', 'lib-widget-progress-04']), S('tiempo', 'Calendario, clima y más', ['r-fechas', 'w-calendario', 'w-semana', 'lib-widget-weather-02', 'lib-widget-profile-03', 'lib-widget-player-05'])] },
    { id: 'listas', name: 'Listas y chat', desc: 'Listas de ajustes y tareas, y burbujas de conversación.', roles: ['list', 'chat'], glyph: '☰', color: ['#3b4a8a', '#6672a4'],
      subs: [S('listas', 'Listas', ['w-tareas', 'lib-lis-1', 'lib-lis-2', 'lib-lis-3', 'lib-lis-4']), S('chat', 'Chat y mensajes', ['lib-chat-1', 'lib-chat-2', 'lib-chat-3', 'lib-chat-4', 'lib-chat-5'])] },
    { id: 'avisos', name: 'Avisos, diálogos y hojas', desc: 'Banners, toasts, estados vacíos, diálogos y hojas inferiores.', roles: ['notices', 'sheets'], glyph: '!', color: ['#b8401f', '#bf5335'],
      subs: [S('avisos', 'Avisos y banners', ['w-avisos', 'lib-avi-1', 'lib-avi-2', 'lib-avi-4']), S('estados', 'Estados vacíos y de éxito', ['lib-avi-3', 'lib-hoj-4']), S('dialogos', 'Diálogos y hojas', ['w-dialogo', 'w-hoja', 'lib-hoj-1', 'lib-hoj-2', 'lib-hoj-3'])] },
    { id: 'pantallas', name: 'Pantallas', desc: 'Pantallas completas y de recorrido (bienvenida, acceso, carrito…).', roles: ['templates', 'flow'], glyph: '▯', color: ['#8a3f6b', '#9d5e83'],
      subs: [S('completas', 'Pantallas completas', ['lib-pla-1', 'lib-pla-2', 'lib-pla-3', 'lib-pla-4', 'lib-pla-5', 'lib-pla-6', 'lib-pla-7', 'lib-pla-8', 'lib-pla-9']), S('recorrido', 'De recorrido', ['f-bienvenida', 'f-acceso', 'f-detalle', 'f-carrito', 'f-listo', 'f-ajustes', 'f-chat'])] },
    { id: 'base', name: 'Tipografía, fondos e iconos', desc: 'Textos, muestras de color, fondos, superficies e iconos.', roles: ['type', 'palettes', 'background', 'icons'], glyph: 'Aa', color: ['#5d6b6b', '#6a7777'],
      subs: [S('tipografia', 'Tipografía', ['lib-tip-1', 'lib-tip-2', 'lib-tip-3', 'lib-tip-4', 'lib-tip-5', 'lib-font-pair-01', 'lib-font-pair-02']), S('colores', 'Colores y gradientes', ['lib-pal-1', 'lib-pal-2', 'lib-pal-3', 'lib-pal-4', 'lib-pal-5', 'lib-pal-6', 'lib-pal-7']), S('fondos', 'Fondos y superficies', ['lib-bg-mesh-01', 'lib-bg-noise-02', 'lib-bg-grid-03', 'lib-bg-sunset-04']), S('iconos', 'Iconos', ['lib-icon-set-01', 'lib-icon-set-02'])] },
    { id: 'guardados', name: 'Favoritos y recientes', desc: 'Lo que marcaste, lo último que viste, lo elegido y tus estilos.', special: 'saved', glyph: '★', color: ['#946200', '#9a6b0f'] }
  ];
  /* Animaciones: tres tipos de la capa de movimiento + los bloques de microinteracciones. */
  const MOTION_SUBS = [{ id: 'entrance', name: 'Entrada' }, { id: 'card', name: 'Tarjetas' }, { id: 'action', name: 'Botón principal' }, { id: 'micro', name: 'Microinteracciones' }];
  const BG_SUBS = [{ id: 'degradados', name: 'Degradados suaves' }, { id: 'cristal', name: 'Cristal y burbujas' }, { id: 'patrones', name: 'Patrones y texturas' }, { id: 'oscuros', name: 'Oscuros con brillo' }];
  const FONT_SUBS = [{ id: 'modernas', name: 'Modernas' }, { id: 'clasicas', name: 'Clásicas con serifa' }, { id: 'caracter', name: 'De carácter' }];
  const STYLE_SUBS = [{ id: 'limpios', name: 'Limpios y ordenados' }, { id: 'suaves', name: 'Suaves y táctiles' }, { id: 'cristal', name: 'Cristal y neón' }, { id: 'atrevidos', name: 'Atrevidos' }, { id: 'pro', name: 'Pro: cristal, 3D y degradados' }];
  const SAVED_SUBS = [{ id: 'favoritos', name: 'Favoritos' }, { id: 'recientes', name: 'Recientes' }, { id: 'elegidos', name: 'Elegidos' }, { id: 'mios', name: 'Mis estilos' }];
  const PALETTE_SUBS = [{ id: 'mias', name: 'Mis paletas' }, { id: 'claras', name: 'Claras' }, { id: 'oscuras', name: 'Oscuras' }, { id: 'rojos', name: 'Rojos, naranjas y dorados' }, { id: 'verdes', name: 'Verdes' }, { id: 'azules', name: 'Azules y turquesas' }, { id: 'violetas', name: 'Violetas y rosas' }, { id: 'neutros', name: 'Neutras' }];
  const MOTION_BLOCK_IDS = id => /^lib-anim-/.test(id);
  const get = id => CATEGORIES.find(c => c.id === id) || null;
  const blockCats = () => CATEGORIES.filter(c => c.roles);
  /* Categoría de un bloque: por su rol; las animaciones de la biblioteca (rol motion) van a «Animaciones». */
  function catOf(block) { if (block.role === 'motion') return get('animaciones'); return blockCats().find(c => c.roles.includes(block.role)) || null; }
  /* Subcategoría de un bloque dentro de su categoría. Mis estilos propios van a «mios»; lo desconocido, a «otros». */
  function subOf(block) {
    const cat = catOf(block); if (!cat) return null;
    if (cat.id === 'animaciones') return 'micro';
    if (block.mine) return 'mios';
    const s = cat.subs.find(x => x.ids.includes(block.id)); return s ? s.id : 'otros';
  }
  function subsFor(cat, blocks) {
    if (cat.id === 'animaciones') return MOTION_SUBS;
    if (cat.id === 'paletas') return PALETTE_SUBS;
    if (cat.id === 'estilos') return STYLE_SUBS;
    if (cat.id === 'fondos') return BG_SUBS;
    if (cat.id === 'tipografias') return FONT_SUBS;
    if (cat.id === 'guardados') return SAVED_SUBS;
    if (!cat.subs) return [];
    const extra = []; const used = new Set((blocks || []).map(b => catOf(b) === cat ? subOf(b) : null));
    if (used.has('mios')) extra.push({ id: 'mios', name: 'Mis estilos' }); if (used.has('otros')) extra.push({ id: 'otros', name: 'Otros' });
    return cat.subs.map(s => ({ id: s.id, name: s.name })).concat(extra);
  }
  function match(block, catId, subId) { const c = catOf(block); if (!c || c.id !== catId) return false; return !subId || subId === 'all' || subOf(block) === subId; }
  /* Familias de paletas por el matiz del acento. */
  function paletteFamily(p) {
    const h = p.accent.replace('#', ''), r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < .12 || (l > .1 && d / (1 - Math.abs(2 * l - 1)) < .2)) return 'neutros';
    let hue = d === 0 ? 0 : mx === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : mx === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
    if (hue < 50 || hue >= 335) return 'rojos'; if (hue < 170) return 'verdes'; if (hue < 245) return 'azules'; return 'violetas';
  }
  function paletteMatch(p, subId) { if (!subId || subId === 'all') return true; if (subId === 'mias') return !!p.mine; if (subId === 'claras') return !p.dark; if (subId === 'oscuras') return !!p.dark; return paletteFamily(p) === subId; }
  /* Rutas: «bloques», «bloques/todo», «bloques/<categoría>» y «bloques/<categoría>/<sub>». */
  function parseRoute(hash) {
    const [page, cat, sub] = String(hash || '').replace(/^#/, '').split('/');
    if (page !== 'bloques') return { page: ({ idea: 'home', pantalla: 'review' })[page] || 'home', view: 'hub' };
    if (!cat) return { page: 'explore', view: 'hub' };
    if (cat === 'todo') return { page: 'explore', view: 'todo' };
    const c = get(cat); if (!c) return { page: 'explore', view: 'hub' };
    return { page: 'explore', view: 'cat', cat: c.id, sub: sub || 'all' };
  }
  const routeHash = (cat, sub) => '#bloques' + (cat ? '/' + cat + (sub && sub !== 'all' ? '/' + sub : '') : '');
  root.TintaTaxonomy = { CATEGORIES, STYLE_SUBS, BG_SUBS, FONT_SUBS, MOTION_SUBS, SAVED_SUBS, PALETTE_SUBS, get, catOf, subOf, subsFor, match, paletteFamily, paletteMatch, parseRoute, routeHash, MOTION_BLOCK_IDS };
  if (typeof module !== 'undefined') module.exports = root.TintaTaxonomy;
})(typeof window !== 'undefined' ? window : globalThis);
