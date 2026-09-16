// src/lib/prism/forja/tipos.ts
var ROLES_FORJA = ["disenador", "codificador", "revisor"];
var PERFILES = {
  ligero: {
    maxRondas: 2,
    reglasGlobales: 4,
    maquetaNuevos: false,
    descripcion: "R\xE1pido y barato: ficha \u2192 c\xF3digo \u2192 revisi\xF3n. Sin maquetas."
  },
  equilibrado: {
    maxRondas: 3,
    reglasGlobales: 6,
    maquetaNuevos: true,
    descripcion: "Recomendado: ideas + maqueta en proyectos nuevos, c\xF3digo tras tu visto bueno."
  },
  profundo: {
    maxRondas: 4,
    reglasGlobales: 10,
    maquetaNuevos: true,
    descripcion: "M\xE1xima calidad: m\xE1s reglas aprendidas, m\xE1s rondas de correcci\xF3n, maqueta siempre."
  }
};
var PERFIL_DEFECTO = "equilibrado";
var MAX_TOKENS_DEFECTO = {
  disenador: 8192,
  codificador: 16384,
  revisor: 8192
};
var MIN_TOKENS_ROL = 256;
var MAX_TOKENS_LIMITE = 65536;
function sanearTokensRol(n) {
  if (n == null || !Number.isFinite(n)) return void 0;
  const v = Math.round(n);
  if (v < MIN_TOKENS_ROL) return void 0;
  return Math.min(MAX_TOKENS_LIMITE, v);
}
function techoTokens(cfg, rol) {
  return sanearTokensRol(cfg.maxTokensPorRol?.[rol]) ?? MAX_TOKENS_DEFECTO[rol];
}
var MAX_RONDAS_LIMITE = 5;
var MAX_RONDAS_DEFECTO = 3;
var MAX_AJUSTES_MAQUETA = 2;
function sanearRondas(n) {
  const v = Math.round(Number(n) || 0);
  if (v < 1) return MAX_RONDAS_DEFECTO;
  return Math.min(MAX_RONDAS_LIMITE, v);
}
function rondasDePerfil(cfg) {
  if (cfg.maxRondas != null) return sanearRondas(cfg.maxRondas);
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;
  return PERFILES[perfil].maxRondas;
}
var DIRECTO_RX = /\b(sin maqueta|sin mockup|sin propuesta|directo al codigo|directo al código|código directo|codigo directo|directamente el codigo|directamente el código|ya sabes lo que quiero|sin vista previa|fast)\b/i;
var MAQUETA_RX = /\b(maqueta|mockup|propuesta(s)? de diseño|dise[nñ]o(s)? primero|que? ideas|dame ideas|mu[eé]strame (una|la)? ?propuesta|concepto(s)? de dise[nñ]o)\b/i;
function usuarioQuiereDirecto(mensaje) {
  return DIRECTO_RX.test(mensaje);
}
function usuarioPideMaqueta(mensaje) {
  return MAQUETA_RX.test(mensaje);
}
function debeMaquetar(p, cfg) {
  if (p.modo === "directo") return false;
  if (p.modo === "maqueta") return true;
  if (cfg.maquetaPrimero === false) return false;
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;
  if (!PERFILES[perfil].maquetaNuevos) return false;
  if (usuarioPideMaqueta(p.mensaje)) return true;
  if (usuarioQuiereDirecto(p.mensaje)) return false;
  if (p.codigoActual) return false;
  return true;
}
function parseVeredicto(texto) {
  const etiquetaAprobado = /<veredicto>\s*aprobado\s*<\/veredicto>/i.test(texto);
  const etiquetaRechazo = /<veredicto>\s*rechazado\s*<\/veredicto>/i.test(texto);
  const aprobado = etiquetaAprobado || !etiquetaRechazo && !/rechaz/i.test(texto) && /aprobado/i.test(texto);
  const bloque = texto.match(/<defectos>([\s\S]*?)<\/defectos>/i);
  const defectos = (bloque?.[1] ?? "").split(/\n+/).map((l) => l.trim().replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 8);
  const resumenBloque = texto.match(/<resumen>([\s\S]*?)<\/resumen>/i);
  return {
    aprobado,
    defectos,
    resumen: (resumenBloque?.[1] ?? "").trim().slice(0, 240) || (aprobado ? "Cumple la ficha y el checklist." : "Rechazado, ver defectos.")
  };
}
function parseDirecciones(texto) {
  const bloque = texto.match(/<direcciones>([\s\S]*?)<\/direcciones>/i);
  const fuente = bloque ? bloque[1] : texto;
  const out = [];
  const re = /^\s*(\d)[.)]\s*(.+?)\s*[—–-]\s*(.+?)(?:\s*[—–-]\s*(.+?))?\s*$/gm;
  let m;
  while ((m = re.exec(fuente)) !== null && out.length < 3) {
    const n = Number(m[1]);
    if (n < 1 || n > 3) continue;
    out.push({
      n,
      nombre: m[2].trim().slice(0, 48),
      concepto: m[3].trim().slice(0, 160),
      porQue: (m[4] ?? m[3]).trim().slice(0, 200),
      paleta: paletaDeDireccion(fuente, n),
      tipografia: tipografiaDeDireccion(fuente, n)
    });
  }
  return out;
}
function paletaDeDireccion(fuente, n) {
  const m = fuente.match(new RegExp(`paleta\\s*${n}\\s*:\\s*(.+)`, "i"));
  return m ? m[1].trim().slice(0, 160) : "";
}
function tipografiaDeDireccion(fuente, n) {
  const m = fuente.match(new RegExp(`tipograf[i\xED]a\\s*${n}\\s*:\\s*(.+)`, "i"));
  return m ? m[1].trim().slice(0, 120) : "";
}

// src/lib/prism/forja/tipos-v4.ts
var MAX_LISTA_ADN2 = 8;
var DIMENSIONES_ADN2 = [
  { clave: "identidad", etiqueta: "Identidad", core: true },
  { clave: "personalidad", etiqueta: "Personalidad", core: true },
  { clave: "sensacion", etiqueta: "Sensaci\xF3n", core: true },
  { clave: "composicion", etiqueta: "Composici\xF3n", core: false },
  { clave: "tipografia", etiqueta: "Tipograf\xEDa", core: false },
  { clave: "color", etiqueta: "Color", core: false },
  { clave: "espaciado", etiqueta: "Espaciado", core: false },
  { clave: "movimiento", etiqueta: "Movimiento", core: false },
  { clave: "representacion", etiqueta: "Representaci\xF3n", core: false },
  { clave: "interaccion", etiqueta: "Interacci\xF3n", core: false },
  { clave: "prohibiciones", etiqueta: "Prohibiciones", core: true },
  { clave: "referencias", etiqueta: "Referencias", core: false },
  { clave: "antiPatrones", etiqueta: "Anti-patrones", core: false },
  { clave: "accesibilidad", etiqueta: "Accesibilidad", core: false }
];
function telemetriaVacia() {
  return {
    reintentosRed: 0,
    failovers: 0,
    continuaciones: 0,
    truncados: 0,
    llamadasOk: 0,
    tokensSalida: 0,
    latenciaMsTotal: 0
  };
}
var _secuencia = 0;
function idV4(prefijo) {
  _secuencia += 1;
  return `${prefijo}-${Date.now().toString(36)}${_secuencia.toString(36)}`;
}
function listaLimpia(xs, max, maxTexto = 90) {
  const vistos = /* @__PURE__ */ new Set();
  const out = [];
  for (const x of xs) {
    const t = (x ?? "").replace(/\s+/g, " ").replace(/^[-*•\d.)\s]+/, "").trim().slice(0, maxTexto);
    if (t.length < 3) continue;
    const clave2 = t.toLowerCase();
    if (vistos.has(clave2)) continue;
    vistos.add(clave2);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
function leccionArenaAGenoma(leccion, generacion) {
  return {
    id: idV4("lec"),
    tipo: leccion.tipo,
    texto: (leccion.texto ?? "").slice(0, 200),
    conversion: null,
    origen: leccion.equipo ?? "",
    generacion,
    confirmaciones: 1
  };
}

// src/lib/prism/forja/version.ts
var VERSION_FORJA = "4.7.2";
var NOMBRE_VERSION_FORJA = "Experience Compiler";
var NOVEDADES_FORJA = [
  "v4.7.2 \xB7 EXPERIENCE COMPILER: recetas compatibles por familia, Experience Manifest como fuente \xFAnica de verdad, modo espacial m\xEDnimo protegido por Performance Gate y datos no declarados nunca se presentan como hechos reales.",
  "v4.7.0 \xB7 LA P\xC1GINA, NO EL HERO \u2014 auditor\xEDa completa del m\xF3dulo (581 ficheros): v4.6 compil\xF3 C\xD3MO se ve la experiencia con un detalle extraordinario (familias, recetas, heroes, primitivas, objeto 3D) y dej\xF3 sin decidir QU\xC9 contiene la p\xE1gina. RecetaExperiencia no ten\xEDa un solo campo de secciones, los datos del brief se tiraban y ning\xFAn QA med\xEDa densidad de contenido. v4.7 cierra ese hueco con 3 ideas nuevas (G-I) y 9 correcciones de cableado \u2014 todo determinista, todo a coste cero.",
  "v4.7.0 \xB7 G \u2014 PLANO DE CONTENIDO (plano-contenido.ts): inventario de 13 secciones con slots y m\xEDnimos verificables, 9 plantillas por vertical, 3 niveles de detalle (borrador/producci\xF3n/showcase) que mueven a la vez secciones, piezas, l\xEDneas objetivo y techo de tokens. extraerHechos() saca precios, tel\xE9fonos, correos, horarios, ciudad y cantidades del brief \u2014 datos que hasta ahora se tiraban \u2014 y los HECHOS A\xD1ADEN secciones: dos precios declarados exigen la secci\xF3n de precios, un horario exige ubicaci\xF3n.",
  "v4.7.0 \xB7 H \u2014 QA DE DETALLE (qa-detalle.ts): 24 m\xE9tricas de densidad (secciones reales, palabras visibles, piezas por colecci\xF3n, estados en el CSS, breakpoints, im\xE1genes con aspect-ratio, SVG frente a emojis, anclas conectadas, texto de relleno, bloques clonados) auditadas contra el plano de contenido, con puntuaci\xF3n 0-100 y 13 tipos de hallazgo con correcci\xF3n propuesta. Corre como fase 6d del n\xFAcleo: lo que falta se convierte en un ENCARGO QUIR\xDARGICO de una sola llamada (\xABampl\xEDa, no regeneres\xBB) con rollback honesto si la ampliaci\xF3n no mejora.",
  "v4.7.0 \xB7 I \u2014 ICONOGRAF\xCDA E IMAGEN COMPILADAS (iconos.ts): 24 iconos SVG de trazo con currentColor y grosor coherente (mismo patr\xF3n que primitivas.ts: el Codificador selecciona, no dibuja paths a mano), elegidos por sector con elegirIconos(); figuraPlaceholder() con aspect-ratio fijo para que el layout nunca salte al cargar; cifras con font-variant-numeric:tabular-nums. Sustituye al emoji-como-icono y al <img> sin dimensi\xF3n que el QA de detalle marcaba como defecto.",
  "v4.7.0 \xB7 CORRECCI\xD3N \u2014 CORPUS DE SE\xD1ALES: hasta v4.6 seleccionarExperiencia() decid\xEDa la direcci\xF3n creativa con SOLO el mensaje crudo; la ficha del Dise\xF1ador y el ADN visual (personalidad, sensaci\xF3n, lenguaje, prohibiciones) no entraban, as\xED que el ADN del Dise\xF1ador y el de experiencia pod\xEDan contradecirse. corpusDeSenales() en maqueta.ts compone brief + estructura de la ficha + ADN + feedback; en el n\xFAcleo, el ADN 2.0 reci\xE9n definido entra como se\xF1al.",
  "v4.7.0 \xB7 CORRECCI\xD3N \u2014 EL AJUSTE YA NO SE EVAPORA: \xABAjusta: quita el objeto 3D, menos movimiento\xBB no re-decid\xEDa la experiencia \u2014 el contrato determinista segu\xEDa exigi\xE9ndolo y ganaba porque es m\xE1s largo y viene con CSS. El feedback entra ahora en el corpus de se\xF1ales (se repite para que pese) y de verdad cambia el contrato.",
  'v4.7.0 \xB7 CORRECCI\xD3N \u2014 ANTI-REPETICI\xD3N CON DATOS REALES: penalizacionComposicion() se calculaba ANTES de elegir hero y cards, con `("", spatial, "")` \u2014 su consejo era inerte. Ahora corre despu\xE9s con los valores reales y su secci\xF3n llega POR FIN al contrato que ve el maquetador (antes solo la le\xEDa director2).',
  "v4.7.0 \xB7 CORRECCI\xD3N \u2014 HISTORIAL PERSISTENTE: DepsMvp acepta historialComposicion (sim\xE9trico a memoriaAprendizaje) y lo restaura con cargarHistorial() al arrancar. Hasta v4.6 el historial viv\xEDa solo en memoria del proceso: en cualquier despliegue serverless obtenerHistorial() devolv\xEDa [] en cada generaci\xF3n y la anti-repetici\xF3n \xA713 era decorativa.",
  'v4.7.0 \xB7 CORRECCI\xD3N \u2014 recompilarDesdeDna() YA NO DEGRADA A MINIMAL: llamaba seleccionarExperiencia(""); sin se\xF1ales, la familia ca\xEDa a minimal y la receta a modern_minimal \u2014 tocar un radius en el panel pod\xEDa borrar la familia spatial de la p\xE1gina. Ahora el mensaje original viaja en OpcionesExperiencia.mensajeOriginal y manda.',
  "v4.7.0 \xB7 CORRECCI\xD3N \u2014 VERTICALES LOCALES ALINEADOS: panader\xEDa, barber\xEDa, florister\xEDa y compa\xF1\xEDa viv\xEDan en la se\xF1al comercial de experience-dna.ts pero no en la tabla VERTICALES de familias-experiencia.ts \u2014la que de verdad decide la familia\u2014, as\xED que ca\xEDan en \xABgeneral\xBB \u2192 minimal. Alineadas, y un negocio local ya no cae en la familia quieta por defecto.",
  "v4.7.0 \xB7 CORRECCI\xD3N \u2014 PRESUPUESTO RECALIBRADO: la fase implementation (la que produce la p\xE1gina completa) subi\xF3 del 38% al 46% del presupuesto global, y los totales por complejidad de 24k/40k/64k a 32k/56k/88k. La llamada del Codificador ahora fija maxTokens seg\xFAn el nivel de detalle en vez de heredar el defecto del rol.",
  "v4.7.0 \xB7 REGRESI\xD3N: 314 aserciones sin red, 0 fallos \u2014 v4.4 (52/52) \xB7 v4.5 (86/86) \xB7 v4.6 (86/86) \xB7 v4.7 nueva (90/90, integracion/adapter-test/verificacion-v47.mjs) \u2014 todas contra el bundle real reconstruido. TypeScript estricto: 0 errores. El bundle es superconjunto exacto del de v4.6: ninguna de las 349 exportaciones anteriores desaparece; 373 exportaciones totales.",
  "v4.6.0 \xB7 EL TALLER QUE APRENDE (ideas A-F de la hoja de ruta): v4.5 decidi\xF3 la experiencia DETERMINISTAMENTE; v4.6 le entrega al motor los COMPONENTES ya compilados, el OBJETO 3D forjado, el QA del movimiento MEDIDO, el contrato EDITABLE por humanos, la ARENA que compara FAMILIAS y el CIRCUITO DE APRENDIZAJE del Genoma. La direcci\xF3n creativa no solo se decide gratis: ahora tambi\xE9n se EJECUTA gratis y MEJORA con cada generaci\xF3n.",
  "v4.6.0 \xB7 A \u2014 PRIMITIVAS COMPILADAS (el mayor ahorro restante): biblioteca de 8 bloques listos (RevealGroup, TiltCard, MagneticCTA, FloatingMetric, SpotlightCard, ParallaxLayer, StickyStory, Marquee) con HTML+CSS completos, responsive, toques \u226544px y reduced-motion YA auditados de f\xE1brica + scripts capados (tilt 8\xB0, im\xE1n 12px, spotlight, parallax rAF). El Codificador SELECCIONA y parametriza; NO re-inventar. Cada primitiva reutilizada sale gratis y nace auditada \u2014 coste marginal 0 tokens.",
  "v4.6.0 \xB7 B \u2014 LEARNING LOOP DEL GENOMA: la huella de cada generaci\xF3n se guarda AHORA tambi\xE9n con su RESULTADO (score + veredicto). Con 20-30 generaciones, recomendacionesAprendidas() pasa de \xABpenalizar lo reciente\xBB a \xABrecomendar lo que gan\xF3\xBB: DESTACAR/EVITAR con evidencia (\xABHERO_SPLIT gan\xF3 91/100 en 5 generaciones\xBB). Los ajustes alimentan elegirHero (+2/-2) y la Arena de familias (+1.5/-1.5). Memoria inyectable y serializable (el host la persiste).",
  "v4.6.0 \xB7 C \u2014 OBJETO 3D CSS PARAM\xC9TRICO REAL: 8 formas forjadas (Monolito, Orbe, Capas flotantes, Tarjeta doblada, Anillo orbital, Torre isom\xE9trica, Cubo giratorio, Constelaci\xF3n) en HTML+CSS 3D puro, ~2 KB cada una, 0 three.js, 0 librer\xEDas. Elegidas por familia+se\xF1ales+anti-repetici\xF3n, con aria-hidden, tokens de experiencia y reduced-motion resueltos. El \xABcentral 3D object\xBB del doc \xA729 sale SIEMPRE bien \u2014 tambi\xE9n para una panader\xEDa.",
  "v4.6.0 \xB7 D \u2014 MOTION QA MEDIDO: se PARSEA el CSS real (reglas selector{declaraci\xF3n}) y se verifica la escala \xA79 POR DURACI\xD3N: nada fuera de 150-1600ms salvo ambiente (infinite), stagger presente cuando el plan lo pide y guard de reduced-motion que apague de verdad. Hallazgos con evidencia (selector + declaraci\xF3n + ms) y parches deterministas append-only: guard can\xF3nica, overrides de duraci\xF3n capados a 8 reglas, utilidad .forja-stagger. Corre en el n\xFAcleo (fase 6c) tras el QA de experiencia.",
  "v4.6.0 \xB7 E \u2014 CONTRATO DE EXPERIENCIA EXPORTABLE/EDITABLE (JSON): SeleccionExperiencia \u2192 schema estable forja.experiencia@1 (exportarContrato/serializarContrato). El host EDITA familia/hero/intensidad/modo/profundidad/elevaci\xF3n/blur/radius/use3d/pesoObjeto, valida (validarContrato) y RE-COMPILA el pipeline completo con 0 tokens (aplicarEdicionContrato): tokens CSS, objeto, primitivas y planes regenerados coherentes. El eslab\xF3n del panel \xABElige la experiencia\xBB.",
  "v4.6.0 \xB7 F \u2014 ARENA ENTRE FAMILIAS: las 3 visiones corren EN 3 FAMILIAS DISTINTAS (asignarFamiliasArena: natural+vecinas por se\xF1ales/aprendizaje). El juez de coherencia (determinista, vocabulario \xA712 por familia) punt\xFAa si cada maqueta HABLA el lenguaje de su familia. El ganador deja lecci\xF3n al Genoma: \xABla familia spatial funcion\xF3 para saas: coherencia 8/10\xBB \u2014 la elecci\xF3n de familia APRENDE en vez de quedarse congelada.",
  "v4.6.0 \xB7 La MAQUETA tambi\xE9n forja: mensajeMaqueta lleva ahora el HTML exacto del objeto 3D, el HTML de ejemplo de cada primitiva, la CSS determinista completa y el script capado \u2014 la maqueta sale RICA (objeto + superficies + movimiento) incluso para verticales sin se\xF1ales fuertes. El Codificador recibe lo mismo por el n\xFAcleo.",
  "v4.5.0 \xB7 EL MOTOR DE EXPERIENCIA (correcciones moderno-3D \xA71-\xA735): FORJA deja de ser \xABun generador que evita lo gen\xE9rico\xBB y pasa a ser un MOTOR DE DIRECCI\xD3N CREATIVA \u2014 la cadena INTENCI\xD3N \u2192 FAMILIA \u2192 RECETA \u2192 REPRESENTACI\xD3N \u2192 PLAN ESPACIAL \u2192 PLAN DE MOVIMIENTO \u2192 HERO \u2192 CARDS \u2192 RESPONSIVE \u2192 TOKENS se decide DETERMINISTAMENTE y viaja al modelo como contrato. El LLM ejecuta; no improvisa. Montado SOBRE la eficiencia v4.4 sin reemplazarla (\xA732).",
  "v4.5.0 \xB7 FIN DEL SESGO EDITORIAL (\xA71/\xA73/\xA723): el orden [editorial, espacial, cinematica] de las visiones de respaldo era una preferencia impl\xEDcita. Ahora 10 FAMILIAS DE EXPERIENCIA (spatial, immersive, product, cinematic, interactive, 3d-showcase, modular, editorial, minimal, dashboard) se eligen por intenci\xF3n, y editorial SOLO domina con intenci\xF3n editorial real (blog/revista/art\xEDculo/noticias). Regla de seguridad: moderno/premium/futurista/3D/inmersivo/interactivo empuja a spatial/product/cinematic/interactive/3d-showcase ANTES que editorial.",
  "v4.5.0 \xB7 EXPERIENCE DNA (\xA72): el ADN ahora habla de espacio y superficie \u2014 visual/composition/spatial/motion/interaction/surface/object con profundidad, capas, perspectiva, elevaci\xF3n, blur y objeto focal. Sintetizado gratis desde la petici\xF3n y visible en la traza con sus razones.",
  "v4.5.0 \xB7 EXPERIENCE RECIPES (\xA74): 7 recetas estructuradas (SPATIAL_PRODUCT, CINEMATIC_PRODUCT, IMMERSIVE_PORTFOLIO, INTERACTIVE_SAAS, 3D_SHOWCASE, CREATIVE_STUDIO, MODERN_MINIMAL). El modelo no inventa la composici\xF3n: EJECUTA la receta.",
  "v4.5.0 \xB7 SPATIAL ENGINE (\xA75): la p\xE1gina deja de ser section\u2192container\u2192cards y puede ser una ESCENA \u2014 fondo, ret\xEDcula, ambiente, objeto focal, tipograf\xEDa, UI flotante, m\xE9tricas y navegaci\xF3n con z-index SEM\xC1NTICO, perspectiva y parallax por capa.",
  "v4.5.0 \xB7 HERO ENGINE (\xA76): 10 tipos de hero (HERO_SPATIAL, HERO_3D_OBJECT, HERO_PRODUCT, HERO_CINEMATIC, HERO_INTERACTIVE, HERO_SPLIT, HERO_FLOATING_CARDS, HERO_FULLSCREEN, HERO_SCROLL_REVEAL, HERO_MINIMAL) con composiciones can\xF3nicas. PROHIBIDO asumir hero centrado + h1 + p\xE1rrafo + bot\xF3n.",
  "v4.5.0 \xB7 CARD SYSTEM (\xA77): 14 variantes sem\xE1nticas (CARD_FLOATING, CARD_TILT, CARD_MAGNETIC, CARD_GLASS, CARD_3D, CARD_STACKED, CARD_SPOTLIGHT\u2026) cada una con comportamiento y prop\xF3sito. Glass disciplinado: m\xE1ximo una variante y solo si el ADN pide blur.",
  "v4.5.0 \xB7 MOTION ENGINE (\xA78/\xA79): lenguaje de 16 primitivas con intensidad 0-4 (static \u2192 immersive) y tiempos POR CATEGOR\xCDA: micro 150-300ms \xB7 componente 250-600ms \xB7 reveal 500-1000ms \xB7 escena 800-1600ms \xB7 ambiente continuo. La regla 200-300ms era correcta para microinteracciones, no filosof\xEDa global. prefers-reduced-motion SIEMPRE.",
  "v4.5.0 \xB7 PUERTA DE RENDIMIENTO (\xA710/\xA720): 2D/2.5D/3D/WebGL se eligen con criterio (WebGL solo si el beneficio justifica costo/peso/performance) y la cascada WebGL \u2192 3D/CSS \u2192 2.5D \u2192 2D degrada AUTOM\xC1TICAMENTE. 3D CSS con preserve-3d: el 90% del efecto, 0 librer\xEDas, 0 KB \u2014 m\xE1s profesional Y m\xE1s barato.",
  "v4.5.0 \xB7 EDITORIAL BIAS DETECTOR (\xA711/\xA712): editorialScore con las ponderaciones exactas del doc (textDensity\xD70.25 + readingFlow\xD70.20 + imageRectangles\xD70.15 \u2212 motion \u2212 depth \u2212 interacci\xF3n \u2212 spatial) M\xC1S 7 m\xE9tricas de experiencia. No es est\xE9tica: es una se\xF1al t\xE9cnica; y el objetivo es la COHERENCIA con el ADN, no el m\xE1ximo.",
  "v4.5.0 \xB7 ANTI-REPETICI\xD3N (\xA713): el motor guarda la huella de las \xFAltimas composiciones (hero, cards, motion, spatial, navegaci\xF3n) y PENALIZA repeticiones en los \xFAltimos 3 proyectos \u2014 no m\xE1s \xABhero espacial + 3 cards flotantes + parallax\xBB en todas las p\xE1ginas.",
  "v4.5.0 \xB7 BIBLIOTECA POSITIVA (\xA714): 20 patrones \xABS\xCD usar\xBB (floating product, oversized typography, technical grid, scroll choreography, magnetic CTA, tilt card, sticky storytelling\u2026) con cu\xE1ndo y c\xF3mo. La IA necesita alternativas concretas, no solo prohibiciones.",
  "v4.5.0 \xB7 CONTRATO DE EXPERIENCIA en PROMPT_MAQUETA y Codificador (\xA715/\xA716): EXPERIENCE DNA + RECIPE + SPATIAL PLAN + MOTION PLAN + HERO TYPE + SURFACE SYSTEM + INTERACTION SYSTEM + RESPONSIVE EXPERIENCE. Separaci\xF3n neta Design Direction vs Code Generation.",
  "v4.5.0 \xB7 DESIGN TOKENS DE EXPERIENCIA (\xA717/\xA718): --radius-*, --depth-1..4, --perspective-*, --motion-*, --shadow-soft/floating/deep, --surface-* \u2014 generados desde el ADN y entregados como CSS determinista (tokens + escenario + movimiento + cards) que el Codificador incluye tal cual.",
  "v4.5.0 \xB7 RESPONSIVE EXPERIENCE PLAN (\xA719): qu\xE9 se mantiene/reduce/reordena/elimina/transforma por breakpoint (desktop 3D+4 cards+parallax \u2192 tablet reducido \u2192 m\xF3vil objeto+1 card sin camera movement). Responsive como experiencia, no solo width:100%.",
  "v4.5.0 \xB7 QA DE EXPERIENCIA + PATCH-FIRST (\xA721/\xA722): editorial bias, coherencia espacial/movimiento/profundidad, riqueza de interacci\xF3n, calidad del hero, consistencia de superficies y responsive se AUDITAN. Sesgo editorial alto NO regenera la p\xE1gina: parche determinista (objeto focal, cards flotantes, depth, scroll reveal) con contenido intacto y reduced-motion respetado.",
  "v4.5.0 \xB7 REFERENCE DNA (\xA724/\xA725): las referencias se convierten en PRINCIPIOS (dark canvas, technical grid, oversized typography, central 3D object, floating UI\u2026) especificados por dimensi\xF3n \u2014 nunca en p\xEDxeles. \xABNo copio esta p\xE1gina: extraigo su lenguaje y creo una experiencia nueva.\xBB",
  "v4.5.0 \xB7 El Dise\xF1ador ya no prescribe \xABbeneficios (3 tarjetas)\xBB en landing y su prompt incluye la biblioteca positiva completa. Registro con experiencia (familia/receta/hero/m\xE9tricas) y cuenta de la experiencia en la respuesta al usuario (\xA729-31: el resultado se explica en t\xE9rminos de experiencia).",
  "v4.4.0 \xB7 EL TALLER EFICIENTE (plan \xA722/23/24/25/26/28): la capa de eficiencia completa \u2014 presupuesto global de tokens por fases (planning/design/implementation/qa/repair/reserve), cach\xE9 multinivel de 6 niveles, compilador de contexto, enrutador determinista, salida temprana y Token ROI. Cada generaci\xF3n ahora muestra cu\xE1nto ahorr\xF3.",
  "v4.4.0 \xB7 PRESUPUESTO GLOBAL DE TOKENS (presupuesto-tokens.ts): el techo ya no es solo por llamada (v4.2) sino por GENERACI\xD3N, repartido en las 6 fases del plan. La complejidad de la petici\xF3n (determinista: longitud, edici\xF3n, alcance) y el perfil de coste calibran el total (simple 24k \xB7 media 40k \xB7 compleja 64k). El Codificador nunca pide m\xE1s de lo que su fase puede pagar: pedir lo impagable era pagar un corte.",
  "v4.4.0 \xB7 CACH\xC9 MULTINIVEL (cache-multinivel.ts): los 6 niveles exactos del plan \u2014 L1 respuesta exacta, L2 ficha, L3 decisi\xF3n arquitect\xF3nica (el ADN de la misma petici\xF3n no se paga dos veces), L4 patr\xF3n visual, L5 parche, L6 resultado de QA. LRU por nivel con stats y cascada a la capa persistente del host.",
  "v4.4.0 \xB7 COMPILADOR DE CONTEXTO (compilador-contexto.ts, plan \xA723): las reglas del proyecto, memoria, conocimiento y el brief se DEDUPLICAN, punt\xFAan por relevancia contra la intenci\xF3n y se recortan a un techo antes de viajar al modelo. Contexto compacto, relevante y priorizado \u2014 las prohibiciones duras (fallos confirmados) SIEMPRE viajan. Nunca enviar todo el proyecto cuando basta un componente.",
  "v4.4.0 \xB7 ENRUTADOR DETERMINISTA (enrutador-determinista.ts, plan \xA722): Detect \u2192 Classify \u2192 Deterministic Fix? \u2192 YES \u2192 Patch. lang, viewport, charset, title, alt, ARIA/label, noopener, tabindex, reduced-motion y overflow se corrigen GRATIS con parches seguros \u2014 sin tocar el dise\xF1o. El LLM es el \xFAltimo recurso mec\xE1nico, no el primero.",
  "v4.4.0 \xB7 SALIDA TEMPRANA (salida-temprana.ts, plan \xA726): Generate \u2192 QA \u2192 Good enough? \u2192 YES \u2192 STOP. Score determinista \u2265 92 con 0 cr\xEDticos/0 avisos para en la primera pasada; \u2265 84 tras una iteraci\xF3n. Antes de gastar un modelo, se prueban los parches deterministas. El bucle de mejora ya no gasta 3 iteraciones cuando la primera aprueba.",
  "v4.4.0 \xB7 TOKEN ROI (token-roi.ts, plan \xA728): cada operaci\xF3n registra operaci\xF3n \xB7 tokens \xB7 llamadas \xB7 resultado \xB7 mejora de QA y calcula quality gain / tokens. Con el tiempo el sistema aprende qu\xE9 operaciones merecen tokens, qu\xE9 parches son repetitivos y qu\xE9 pasos pueden ser deterministas \u2014 con recomendaciones accionables por evidencia medida.",
  "v4.4.0 \xB7 ENVOLTORIO EFICIENTE (eficiencia.ts): cach\xE9 L1 + presupuesto + ROI encadenados en un \xFAnico LlamadaModelo. El host envuelve su adaptador una vez y TODO el pipeline (n\xFAcleo, Arena, bucle) se vuelve eficiente sin tocar al adaptador-resiliente. DepsMvp.cache acepta la capa persistente del host; deps.sinEficiencia desactiva todo para pruebas A/B.",
  "v4.4.0 \xB7 CORRECCIONES: la llamada del ADN ahora declara rol y techo (viaja bien en failover y presupuesto); el n\xBA de llamadas del registro es el REAL medido por el ROI (antes se sumaban estimaciones de la Arena); la entrada del bundle (adapter-test/entrada.mjs) viaja en el zip y el bundle se reconstruye con esbuild en un comando.",
  "v4.3.1 \xB7 EL TALLER A MEDIDA (PC y m\xF3vil): navegaci\xF3n 100% interna \u2014 las tres entradas de la barra abren el Estudio en la misma pesta\xF1a con deep-link /forja?tab=\u2026 (cero window.open) \u2014 y responsive completo: pesta\xF1as deslizables en m\xF3vil, contenedor h-dvh, t\xE1ctiles \u2265 32 px y 0 desbordes horizontales auditados a 375\xD7667 y 1280\xD7800.",
  "v4.3.0 \xB7 EL TALLER ABIERTO: el Estudio FORJA IA vive DENTRO del host (ruta /forja) con su mismo tema claro/oscuro y acento \u2014 sin pesta\xF1as sueltas ni temas ajenos. Ficha \u2192 Maqueta, ADN 2.0 con exportadores, Jueces con evidencia y Anti-gen\xE9rico corren ah\xED mismo con el bundle real del m\xF3dulo.",
  "v4.3.0 \xB7 CAT\xC1LOGO COMPLETO a la vista: el Estudio abre con el mapa \xEDntegro de opciones del m\xF3dulo (n\xFAcleo, ADN, jueces, anti-gen\xE9rico, Director, Arena, bucle de mejora, 5 memorias, Genoma, perfiles de coste y fuentes semilla) y dice d\xF3nde vive cada una \u2014 nada de PRISMA-D1 queda escondido.",
  "v4.3.0 \xB7 PRESUPUESTO POR ROL EN AJUSTES: los techos de tokens del motor (Dise\xF1ador/Codificador/Revisor) se editan desde la UI del host y viajan de verdad en cada llamada del Estudio v\xEDa techoTokens() \u2014 la mejora v4.2 ahora se toca sin c\xF3digo.",
  "v4.3.0 \xB7 BUNDLE DEL MOTOR AMPLIADO (142 exportaciones): adn-visual, adn2, exportadores-adn, anti-gen\xE9rico, jueces 2.0, evaluador de \xE9xito, bucle de mejora, perfiles, fuentes, seguridad web, genoma y design system se sirven al navegador junto al n\xFAcleo y el blindaje v4.1/v4.2.",
  "v4.2.0 \xB7 PRESUPUESTO DE TOKENS POR ROL en la ConfigForja (maxTokensPorRol): el n\xFAcleo resuelve el techo con techoTokens() y viaja en cada llamada \u2014 si tu proveedor corta en 8k aunque pidas m\xE1s, ahora se le pide lo que S\xCD puede dar, por rol y sin tocar c\xF3digo.",
  "v4.2.0 \xB7 SEGUNDO CINTUR\xD3N ANTI-TRUNCAMIENTO a nivel n\xFAcleo (continuacion-nucleo.ts): detecci\xF3n estructural GRATIS de salidas rotas (cercados impares, <html> sin cerrar, <style>/<script> abiertos) + continuaci\xF3n exacta. El corte que el adaptador no pudo cerrar no llega ya al Revisor: se cierra aqu\xED y se ahorra la regeneraci\xF3n entera (la llamada m\xE1s cara del pipeline).",
  "v4.2.0 \xB7 TELEMETR\xCDA CONECTADA A OBSERVABILIDAD: crearTelemetriaForja(registro) convierte los eventos del adaptador en telemetr\xEDa del registro de generaci\xF3n (reintentos, failovers, continuaciones, tokens, latencias). El evento nuevo exito reporta latencia y tokens de cada llamada; textoConsultas() suma el blindaje de red.",
  "v4.2.0 \xB7 CACH\xC9 DE GENERACIONES POR HASH (cache-fichas.ts): la misma petici\xF3n (mensaje + c\xF3digo + reglas + config, invalidada por versi\xF3n) no paga dos veces la ficha del Dise\xF1ador ni la maqueta inicial. LRU en memoria lista, y cacheEnCascada() para a\xF1adir la capa persistente que cada host prefiera.",
  "v4.2.0 \xB7 SALUD DE PROVEEDORES POR LATENCIA (salud-proveedores.ts): el adaptador alimenta un libro de salud con evidencia medida (EWMA de latencia, fallos consecutivos, enfriamiento con backoff) y los SUPLENTES del failover se reordenan por rendimiento real \u2014 el primario, que es tu elecci\xF3n, nunca se toca.",
  "v4.2.0 \xB7 El Lab cablea todo: llamador por generaci\xF3n con registro de observabilidad serializado al log, cach\xE9 compartida del proceso y salud global. Panel del motor v4.2 en el preview para ver el blindaje funcionando en vivo.",
  "v4.1.0 \xB7 REBRAND: PRISMA-D1 pasa a ser FORJA IA \u2014 en la forja el metal bruto se convierte en obra. Nuevo id p\xFAblico forja:ia-diseno (antes prism:d1-diseno): re-selecciona FORJA en el selector; la configuraci\xF3n por rol se conserva.",
  "v4.1.0 \xB7 ADAPTADOR RESILIENTE (un solo archivo, adaptador-resiliente.ts): failover en cadena por rol + max_tokens por rol (16.384 en el Codificador \u2014 una p\xE1gina completa no cabe en 4k, y el corte por max_tokens pasa igual de pagado que de gratis) + reintentos con backoff exponencial y jitter en errores de red.",
  "v4.1.0 \xB7 ANTI-TRUNCAMIENTO por finish_reason: motivo-parada.ts traduce el campo del proveedor (length / stop / max_tokens / content_filter en los tres protocolos). Si la salida qued\xF3 corta (\xABlength\xBB), el adaptador pide CONTINUACI\xD3N (m\xE1x. 2) y concatena; si sigue corta, los chequeos est\xE1ticos y el Revisor lo recogen antes de entregar.",
  "v4.1.0 \xB7 El rol viaja en cada llamada (n\xFAcleo, Estudio y bucle de mejora): el adaptador sabe qu\xE9 techo pedir y qu\xE9 suplentes usar. Telemetr\xEDa de reintentos y failover por onEvento, lista para enchufar a observabilidad.",
  "v4.1.0 \xB7 Marca nueva: logo del yunque forjado (SVG escalable + favicon + iconos PWA), Laboratorio renombrado FORJA-IA-Laboratorio.html con el yunque en la cabecera y chip v4.1.0.",
  "v4.0.1 \xB7 Transporte a prueba de proxies: el chat del Lab ya no muere con \xABel servidor no respondi\xF3\xBB \u2014 POST devuelve {id} al instante y los eventos se leen por sondeo corto (route v4.0.1 + cliente actualizado).",
  "v4.0.1 \xB7 La maqueta en la pesta\xF1a Vista llena el panel completo (antes sal\xEDa aplastada en una tira de ~150 px) y el distintivo \xABMAQUETA \xB7 FORJA IA\xBB ya no sale duplicado.",
  "v4.0.1 \xB7 El atajo \xAB\xBFqu\xE9 fuentes tienes?\xBB vuelve a responder al instante (la regex no reconoc\xEDa esa formulaci\xF3n).",
  "Plan maestro OpenDesign + Stitch ejecutado de una pieza: FORJA IA queda como CEREBRO creativo, OpenDesign como CUERPO (v\xEDa adaptador con runtime local de respaldo) y Stitch solo como REFERENCIA de experiencia. Mapa de integraci\xF3n completo en docs/INTEGRACION-MAPA.md.",
  "ADN VISUAL 2.0: de 4 a 14 dimensiones (identidad, composici\xF3n, tipograf\xEDa, color, espaciado, movimiento, representaci\xF3n, interacci\xF3n, referencias, anti-patrones, accesibilidad\u2026). El ADN ahora se convierte en DESIGN.md, tokens.css, reglas de critique, restricciones del Codificador y criterios de la Arena (exportadores-adn.ts). Migraci\xF3n v3\u2192v4 autom\xE1tica: nada se rompe.",
  "DIRECTOR CREATIVO 2.0: las 3 visiones divergen por REPRESENTACI\xD3N, ESTRUCTURA, NARRATIVA, INTERACCI\xD3N y COMPOSICI\xD3N (arquetipos editorial/espacial/cinematogr\xE1fica/cartogr\xE1fica/conversacional/modular), no por color o fuente. Cada visi\xF3n explica qu\xE9 representa, qu\xE9 prioriza, qu\xE9 riesgo tiene y a qui\xE9n beneficia.",
  "ARENA 2.0 como laboratorio: modos econ\xF3mico (2 visiones/1 juez), profesional (3/3+3 jueces+fusi\xF3n) y experimental (modelos por equipo), gobernados por perfiles de coste FREE/SMART/ARENA/LAB con presupuesto de llamadas declarado.",
  "JUECES CON EVIDENCIA: el panel ya no da solo notas \u2014 cada juez produce qu\xE9 funciona / qu\xE9 falla / qu\xE9 conservar (y el de originalidad: patrones gen\xE9ricos, diferenciadores, riesgos) partiendo de EVIDENCIA F\xCDSICA determinista. 5 jueces opcionales nuevos: accesibilidad, conversi\xF3n, responsive, coherencia de sistema y performance.",
  "ANTI-GENERIC ENGINE 2.0 en 3 capas: determinista (existente), visual (proxies estructurales de composici\xF3n: simetr\xEDa, monoton\xEDa, densidad, focal point, repetici\xF3n) y sem\xE1ntica (\xAB\xBFpodr\xEDa cambiarse el logo y venderse como plantilla?\xBB) con puntuaci\xF3n compuesta ponderada.",
  "REVISOR VISUAL AUTOM\xC1TICO con veredicto PASS/WARN/FAIL y hallazgos enriquecidos: problema + evidencia + gravedad + CAUSA PROBABLE + CORRECCI\xD3N PROPUESTA.",
  "BUCLE AUT\xD3NOMO DE MEJORA (m\xE1x 3 iteraciones): generar \u2192 inspeccionar \u2192 criticar \u2192 corregir \u2192 comparar \u2192 \xBFmejor\xF3? s\xED: continuar / no: REVERTIR. Score determinista; nunca un bucle infinito.",
  "MEMORIA 2.0 en 5 memorias: proyecto, usuario, global, EXPERIMENTAL y FALLOS (\xABesta \xFAltima es especialmente importante\xBB): los fallos confirmados se convierten en prohibiciones duras y viajan SIEMPRE al prompt.",
  "GENOMA VISUAL: cada Arena deja lecciones (destacar/conservar/evitar) que se consolidan en patrones, anti-patrones, experimentos, reglas o referencias. Arena \u2192 lecciones \u2192 memoria \u2192 nueva generaci\xF3n: evoluci\xF3n real, no apuntes muertos.",
  "CANVAS tipo Stitch + VOZ SEM\xC1NTICA: \xABhazlo m\xE1s exclusivo\xBB se traduce a decisiones (densidad \u2193, espacio \u2191, jerarqu\xEDa \u2191, repetitivos \u2193) \u2014 NUNCA gradientes o glassmorphism autom\xE1ticos. Int\xE9rprete determinista en espa\xF1ol, sin modelo.",
  "MEJORA MI P\xC1GINA: diagn\xF3stico determinista del c\xF3digo existente (sistema actual, ADN detectado, genericidad), propuesta de redise\xF1o con evidencia, variante comparada por score y solo se aplica si GANA.",
  "REFERENCIAS abstractas: URL/HTML/imagen/descripci\xF3n/design system \u2192 atributos \u2192 inspiraci\xF3n \u2192 ADN. Nunca copiar una referencia; los riesgos se convierten en anti-patrones.",
  "OBSERVABILIDAD + BENCHMARK + M\xC9TRICAS: cada generaci\xF3n deja un registro completo (modelo, skills, iteraciones, coste); 10 casos de benchmark (SaaS, e-commerce, finanzas, tecnolog\xEDa, restaurantes, portfolio, agencias, dashboards, landing, web app); 8 m\xE9tricas ponderadas con evidencia; y la definici\xF3n de \xE9xito del plan verificada en 10 checks.",
  "Adapter OpenDesign (adapter-opendesign.ts): Petici\xF3nForja \u2192 OpenDesignRequest \u2192 runtime \u2192 OpenDesignArtifact \u2192 Evaluaci\xF3n FORJA. RuntimeLocal ejecuta el MVP completo SIN red ni OpenDesign instalado; el d\xEDa del fork, se enchufa sin tocar nada m\xE1s."
];

// src/lib/prism/forja/equipo.ts
var EQUIPO_FORJA = {
  disenador: {
    rol: "disenador",
    nombre: "Dise\xF1ador",
    resumen: "Estrategia, 3 ideas de dise\xF1o y la ficha concreta que maqueta el equipo.",
    temperatura: 0.6,
    sugerencias: [
      { providerId: "openrouter", modelId: "deepseek/deepseek-chat:free", nota: "buen criterio visual, gratis" },
      { providerId: "groq", modelId: "llama-3.3-70b-versatile", nota: "r\xE1pido y creativo" },
      { providerId: "gemini", modelId: "gemini-2.5-flash", nota: "capa gratuita generosa" }
    ]
  },
  codificador: {
    rol: "codificador",
    nombre: "Codificador",
    resumen: "Escribe el c\xF3digo completo que cumple la ficha al detalle.",
    temperatura: 0.2,
    sugerencias: [
      { providerId: "openrouter", modelId: "qwen/qwen3-coder:free", nota: "especialista en c\xF3digo" },
      { providerId: "groq", modelId: "moonshotai/kimi-k2-instruct", nota: "velocidad para archivos largos" },
      { providerId: "zai", modelId: "glm-4.7-flash", nota: "gratis, buen HTML/CSS" }
    ]
  },
  revisor: {
    rol: "revisor",
    nombre: "Revisor",
    resumen: "Audita el c\xF3digo contra la ficha y el checklist de calidad.",
    temperatura: 0,
    sugerencias: [
      { providerId: "openrouter", modelId: "meta-llama/llama-4-scout:free", nota: "literal y estricto" },
      { providerId: "gemini", modelId: "gemini-2.5-flash", nota: "buen ojo para detalles" },
      { providerId: "cerebras", modelId: "llama-3.3-70b", nota: "auditor\xEDa casi instant\xE1nea" }
    ]
  }
};
var ORDEN_PIPELINE = ["disenador", "codificador", "revisor"];

// src/lib/prism/forja/modelo.ts
var FORJA_ID = "forja:ia-diseno";
var FORJA_NOMBRE = "FORJA IA \xB7 IA de Dise\xF1o";
var FORJA_RESUMEN = "IA propia especializada en p\xE1ginas web con criterio visual propio. En la forja, el metal bruto se convierte en obra: tus modelos entran crudos y sale un dise\xF1o forjado con ADN del proyecto, ideas y una maqueta navegable ANTES de codificar, y un motor anti-gen\xE9rico que le impide parecer plantilla de IA. Lo construye un equipo de tres especialistas (Dise\xF1ador, Codificador y Revisor) sobre los modelos que t\xFA asignes, con tuber\xEDa blindada: failover por proveedor, max_tokens 16k+ en el Codificador, continuaci\xF3n autom\xE1tica si la salida llega corta y reintentos con backoff en errores de red. El Estudio (Director Creativo + panel de jueces + fusi\xF3n) y la Arena hacen evolucionar el dise\xF1o, y aprende de internet, de tus fuentes y de las p\xE1ginas MALAS que le marques como contraejemplo.";
var CAPACIDADES_FORJA = [
  "ideas-y-maqueta-antes-de-codigo",
  "pipeline-disenador-codificador-revisor",
  "modelos-por-rol",
  "memoria-del-usuario",
  "autoaprendizaje-web",
  "apartado-de-fuentes-propias",
  "arena-de-equipos-con-juez",
  "inspeccion-visual-de-paginas",
  "adn-visual-del-proyecto",
  "arena-evolutiva-con-lecciones",
  "conocimiento-estratificado-en-capas",
  "motor-antigenerico-con-saturacion",
  "representacion-primero",
  "estudio-con-director-creativo-y-panel-de-jueces",
  "contraejemplos-aprender-de-paginas-malas",
  // v4.1 — la tubería blindada:
  "adaptador-resiliente-con-failover",
  "anti-truncamiento-max-tokens-16k",
  "continuacion-automatica-finish-reason",
  "reintentos-con-backoff-en-red"
];
var ENTRADA_FORJA = {
  id: FORJA_ID,
  nombre: FORJA_NOMBRE,
  resumen: FORJA_RESUMEN,
  virtual: true,
  requiereModelos: true
};
function fichaForja() {
  return {
    nombre: FORJA_NOMBRE,
    version: VERSION_FORJA,
    clave: `${FORJA_ID} \xB7 ${NOMBRE_VERSION_FORJA}`
  };
}
function esForja(modelKey) {
  return modelKey === FORJA_ID;
}
function lineaEstado(cfg) {
  const partes = ["disenador", "codificador", "revisor"].map((rol) => {
    const m = cfg.porRol[rol];
    const inicial = rol === "disenador" ? "D" : rol === "codificador" ? "C" : "R";
    return `${inicial} ${m ? m.modelId : "modelo activo"}`;
  });
  return `FORJA IA v${VERSION_FORJA} \xB7 ${partes.join(" \xB7 ")}`;
}
function rolesAsignados(cfg) {
  return ["disenador", "codificador", "revisor"].filter((r) => cfg.porRol[r] !== null).length;
}

// src/lib/prism/forja/habilidades.ts
var HABILIDADES_FORJA = [
  {
    id: "landing-conversion",
    nombre: "Landing de conversi\xF3n",
    aplicaA: ["landing", "producto", "servicio"],
    texto: `[Habilidad: landing de conversi\xF3n]
El CTA principal visible sin scroll (hero con altura 100svh m\xE1ximo).
Beneficios como tarjetas de 3 columnas (1 en m\xF3vil) con icono + t\xEDtulo +
1 frase. Prueba social antes del CTA final: cifras, logos o testimonios.
Formulario corto: email + bot\xF3n; cada campo extra baja la conversi\xF3n.
Jerarqu\xEDa del hero: propuesta de valor (31-39px) > subt\xEDtulo > CTA > micro-confianza (\xABGratis, sin tarjeta\xBB).`
  },
  {
    id: "dashboard-datos",
    nombre: "Dashboards y paneles",
    aplicaA: ["dashboard", "panel", "admin"],
    texto: `[Habilidad: dashboards]
Densidad alta, decoraci\xF3n cero: nada de sombras grandes ni gradientes.
KPIs como tarjetas: cifra grande (31px, tabular-nums) + variaci\xF3n con
flecha + etiqueta peque\xF1a. Gr\xE1fico principal ocupa 2/3, tabla 1/3.
Alineaci\xF3n num\xE9rica derecha con font-variant-numeric: tabular-nums.
Estados de carga y vac\xEDo dise\xF1ados (esqueleto, mensaje con acci\xF3n).
Navegaci\xF3n lateral colapsable a iconos por debajo de 1024px.`
  },
  {
    id: "tienda-producto",
    nombre: "E-commerce y fichas de producto",
    aplicaA: ["tienda", "ecommerce", "producto"],
    texto: `[Habilidad: e-commerce]
Ficha de producto: galer\xEDa a la izquierda (sticky en desktop, carrusel en
m\xF3vil), compra a la derecha: precio grande, variantes como chips t\xE1ctiles,
CTA fijo abajo en m\xF3vil. Precio con font-variant-numeric: tabular-nums.
Badge de stock/env\xEDo en verde; tachado solo si hay descuento real.
Grid de cat\xE1logo: 4 columnas desktop, 2 tablet, carrusel horizontal m\xF3vil.`
  },
  {
    id: "dark-premium",
    nombre: "Modo oscuro premium",
    aplicaA: ["cualquiera"],
    texto: `[Habilidad: modo oscuro]
Fondo #0F172A (nunca negro puro); superficies elevadas m\xE1s claras por
nivel (#1E293B, #273549). Texto #F1F5F9, secundario #94A3B8.
El acento sube luminosidad (ej. #60A5FA en vez de #3B82F6) para pasar el
contraste. Sombras casi invisibles: separaci\xF3n por borde 1px rgba blanco
al 8%. Im\xE1genes con filter: brightness(0.9) para no quemar la pantalla.`
  },
  {
    id: "animacion-sutil",
    nombre: "Animaci\xF3n y microinteracci\xF3n",
    aplicaA: ["cualquiera"],
    texto: `[Habilidad: microinteracci\xF3n]
Duraciones: 150ms para hover/focus, 250ms para paneles, 400ms m\xE1ximo para
transiciones grandes. Curva est\xE1ndar cubic-bezier(0.2, 0, 0, 1).
Entrada al scroll con IntersectionObserver: fade + translateY(12px),
una vez, sin repetir. Todo bajo @media (prefers-reduced-motion: no-preference).
Hover en tarjetas: translateY(-2px) + sombra suave; nunca escalar texto.`
  },
  {
    id: "seo-tecnico",
    nombre: "SEO t\xE9cnico base",
    aplicaA: ["landing", "blog", "tienda", "portfolio"],
    texto: `[Habilidad: SEO t\xE9cnico]
<title> \xFAnico de 50-60 caracteres y meta description de 140-160.
Un solo h1 que contiene la palabra clave; jerarqu\xEDa h2/h3 sin saltos.
Imagenes con alt descriptivo y loading="lazy" salvo la del hero.
Enlaces externos con rel="noopener". URL sem\xE1ntica si hay rutas.
Schema.org LocalBusiness/Article/Product seg\xFAn el tipo de p\xE1gina.`
  },
  {
    id: "tendencias-2026",
    nombre: "Tendencias actuales (con juicio)",
    aplicaA: ["cualquiera"],
    texto: `[Habilidad: tendencias con juicio]
Tipograf\xEDa display GRANDE en el hero (clamp(40px, 8vw, 88px), peso 700+,
interlineado 1.05) combinada con cuerpo peque\xF1o: contraste de escala.
Grid bento para muestras de funcionalidades: celdas variadas en un grid
de 12 col, siempre con la celda principal destacando.
Glass sutil solo si aporta: backdrop-filter con fondo s\xF3lido de respaldo.
Gradientes mesh para fondos de marca tech, con texto SIEMPRE plano encima.
Regla: 1 tendencia protagonista por proyecto. Dos ya es imitaci\xF3n.`
  },
  {
    id: "spa-webapp",
    nombre: "Apps SaaS (interfaz de producto)",
    aplicaA: ["spa", "app", "saas", "crm", "erp"],
    texto: `[Habilidad: interfaz de producto]
Tr\xEDada de estados en cada vista: vac\xEDo (mensaje + acci\xF3n de crear),
cargando (esqueleto con las mismas formas del contenido) y error
(motivo + bot\xF3n reintentar). Nada de pantallas en blanco.
Tablas: cabecera sticky, filas 44px, acciones al hover, paginaci\xF3n visible.
Sidebar con secciones agrupadas y elemento activo marcado con fondo.
Toasts abajo a la derecha, 4s, con acci\xF3n deshacer si la operaci\xF3n borra.
Atajos de teclado para acciones frecuentes (n, /, esc) documentados.`
  },
  {
    id: "negocio-local",
    nombre: "Negocio local y reservas",
    aplicaA: ["restaurante", "salon", "clinica", "taller", "local", "cita"],
    texto: `[Habilidad: negocio local]
El horario, el tel\xE9fono y la direcci\xF3n visibles SIN scroll (o en barra
fija m\xF3vil). Bot\xF3n de reserva/cita en cada secci\xF3n importante, no solo
en el hero. Mapa con enlace a navegaci\xF3n y foto real del local.
Galer\xEDa de fotos del negocio ANTES que decoraci\xF3n gen\xE9rica: la gente
conf\xEDa en lo que ve. Men\xFA/servicios con precios claros en tabla simple.
Schema.org LocalBusiness con horarios; href="tel:" en el tel\xE9fono.`
  }
];
function habilidadPorId(id) {
  return HABILIDADES_FORJA.find((h) => h.id === id);
}
function bloquesDeHabilidades(ids2) {
  return HABILIDADES_FORJA.filter((h) => ids2.includes(h.id)).map((h) => h.texto);
}
function habilidadesSugeridas(mensaje) {
  const m = mensaje.toLowerCase();
  const out = [];
  for (const h of HABILIDADES_FORJA) {
    if (h.aplicaA.some((a) => a !== "cualquiera" && m.includes(a))) {
      out.push(h.id);
    }
  }
  if (m.includes("oscuro") || m.includes("dark")) out.push("dark-premium");
  if (m.includes("animad") || m.includes("movimiento")) out.push("animacion-sutil");
  if (m.includes("seo") || m.includes("google")) out.push("seo-tecnico");
  return [...new Set(out)];
}

// src/lib/prism/forja/representacion.ts
var REPRESENTACIONES = [
  {
    id: "radial",
    nombre: "Composici\xF3n radial",
    descripcion: "un centro (el dato que lo explica todo) y los dem\xE1s elementos orbitando por importancia; ideal cuando todo el negocio gira alrededor de UNA cosa",
    cuando: /\b(radar|orbita|orbital|central|nucleo|núcleo|hub|copiloto|asistente|monitoreo|supervision|supervisión)\b/i,
    ejemplo: "una app de monitoreo con el servicio principal al centro y las m\xE9tricas sat\xE9lite a distintas distancias seg\xFAn su estado"
  },
  {
    id: "mapa",
    nombre: "Mapa visual",
    descripcion: "la geograf\xEDa ES la interfaz: zonas, rutas y densidades sobre un mapa; ideal si el negocio ocurre en lugares f\xEDsicos",
    cuando: /\b(mapa|zona|ruta|cobertura|ciudad|barrio|reparto|delivery|flota|sucursal|tienda[s]? f[ií]sic|geoloc|localizaciones?)\b/i,
    ejemplo: "una flota de reparto con cobertura por zonas coloreadas y cada unidad viva sobre el plano, no en una tabla"
  },
  {
    id: "timeline",
    nombre: "L\xEDnea de tiempo",
    descripcion: "el eje temporal como columna vertebral: pasado, presente y futuro navegables; ideal para procesos, agendas e historias",
    cuando: /\b(historia|cronolog|agenda|evento[s]?|calendario|reserva[s]?|proceso|fases|roadmap|trayectoria|itinerario|seguimiento)\b/i,
    ejemplo: "un estudio de eventos donde cada proyecto es una l\xEDnea vertical con sus hitos y las reservas del mes a un lado"
  },
  {
    id: "capas",
    nombre: "Capas",
    descripcion: "la misma informaci\xF3n en niveles superponibles (como un mapa con overlays): contexto abajo, detalle encima; ideal para an\xE1lisis comparativos",
    cuando: /\b(capas|comparar|comparativa|analisis|análisis|detalle|profundidad|overlay|filtros|dimensiones?)\b/i,
    ejemplo: "un informe de rendimiento con la vista general de fondo y capas que se activan: canal, dispositivo, periodo"
  },
  {
    id: "nodos",
    nombre: "Nodos y relaciones",
    descripcion: "entidades como nodos y sus v\xEDnculos como aristas: el grafo ES el contenido; ideal para equipos, redes y cat\xE1logos conectados",
    cuando: /\b(red|relacion|relación|conexion|conexión|equipo[s]?|colaborador|grafo|dependenc|catalogo|catálogo|arquitectura|integracion|integración)\b/i,
    ejemplo: "la web de un estudio con cada proyecto conectado a sus disciplinas y clientes: navegar el grafo es navegar el portfolio"
  },
  {
    id: "asimetrico",
    nombre: "M\xF3dulos asim\xE9tricos",
    descripcion: "un lienzo en mosaico donde cada pieza mide lo que vale: lo importante ocupa m\xE1s, lo secundario menos; rompe la ret\xEDcula mon\xF3tona sin perder orden",
    cuando: /\b(portfolio|galeria|galería|mosaico|bento|destacado[s]?| editorial|magazine|revista)\b/i,
    ejemplo: "un portfolio donde el proyecto estrella ocupa la mitad del lienzo y los dem\xE1s se ajustan a su peso real"
  },
  {
    id: "contextual",
    nombre: "Visualizaci\xF3n contextual",
    descripcion: "los datos vivos dentro de la escena real del negocio (un plano, un cuerpo, una m\xE1quina, un men\xFA) en lugar de tarjetas abstractas",
    cuando: /\b(datos?|metricas|métricas|estadistic|tiempo real|iot|sensores?|cocina|gym|salud|vital|finanzas|presupuesto)\b/i,
    ejemplo: "el panel de una cocina de restaurante con cada estaci\xF3n marcada sobre su plano y su estado de pedidos, no una tabla de tickets"
  },
  {
    id: "espacial",
    nombre: "Navegaci\xF3n espacial",
    descripcion: "la web como un espacio que se recorre (pan, zoom, escenas contiguas) en lugar de p\xE1ginas apiladas; para experiencias memorables con contenido acotado",
    cuando: /\b(experiencia|inmersiv|recorrido|tour|museo|exposicion|exposición|escena|3d|parallax|navegacion espacial|navegación espacial)\b/i,
    ejemplo: "la web de una galer\xEDa como un recorrido continuo de salas: el scroll avanza por el espacio, el mapa lateral te sit\xFAa"
  },
  {
    id: "editorial",
    nombre: "Editorial narrativa",
    descripcion: "estructura de art\xEDculo impreso: jerarqu\xEDa tipogr\xE1fica fuerte, columna de lectura, margen que comenta; cuando el argumento es el producto",
    cuando: /\b(blog|articulo|artículo|historia|marca|manifiesto|case study|caso de exito|caso de éxito|noticia|revista)\b/i,
    ejemplo: "la p\xE1gina de una marca con su historia como reportaje: capitales grandes, m\xE1rgenes que respiran y el CTA cuando ya te convenci\xF3"
  },
  {
    id: "lienzo",
    nombre: "Lienzo \xFAnico",
    descripcion: "una sola pantalla que lo contiene todo (sin scroll o m\xEDnimo): herramienta, juego o demo donde la interacci\xF3n es el contenido",
    cuando: /\b(herramienta|calculadora|simulador|configurador|juego|demo|editor|canvas|lienzo|app de una pantalla)\b/i,
    ejemplo: "un configurador de producto donde el lienzo central es el producto y los controles orbitan alrededor"
  }
];
function sugerirRepresentaciones(peticion, limite = 3) {
  const texto = (peticion || "").toLowerCase();
  const candidatas = [];
  REPRESENTACIONES.forEach((r, i) => {
    const rx = new RegExp(r.cuando.source, r.cuando.flags.includes("g") ? r.cuando.flags : r.cuando.flags + "g");
    const matches = texto.match(rx) ?? [];
    if (matches.length === 0) return;
    const primera = matches[0]?.trim() ?? "";
    const puntos = matches.length + primera.length / 1e3 - i * 1e-3;
    candidatas.push({
      representacion: r,
      razon: matches.length > 1 ? `la petici\xF3n menciona ${matches.length} se\xF1ales de este enfoque (p. ej. \xAB${primera}\xBB)` : `la petici\xF3n habla de \xAB${primera}\xBB`,
      puntos
    });
  });
  candidatas.sort((a, b) => b.puntos - a.puntos);
  return candidatas.slice(0, Math.max(1, limite));
}
function seccionRepresentacion(peticion) {
  const sugeridas = sugerirRepresentaciones(peticion, 3);
  const catalogo = REPRESENTACIONES.map((r) => `- ${r.nombre}: ${r.descripcion}`).join("\n");
  const candidatas = sugeridas.length ? sugeridas.map(
    (s) => `- ${s.representacion.nombre} \u2014 ${s.razon}; por ejemplo: ${s.representacion.ejemplo}`
  ).join("\n") : "- (ninguna se\xF1al clara: elige t\xFA la representaci\xF3n que haga evidente el dato principal de este negocio)";
  return `# Representaci\xF3n primero (paso 1 del m\xE9todo, antes de est\xE9tica y componentes)
Una IA gen\xE9rica responde a \xABdashboard premium\xBB con sidebar + KPIs + gr\xE1fico +
tarjetas. T\xFA NO: primero preguntas c\xF3mo REPRESENTAR la informaci\xF3n de este
negocio para que se entienda de un vistazo, y despu\xE9s eliges los componentes
que sirven a esa representaci\xF3n.

Cat\xE1logo de representaciones (no es cerrado):
${catalogo}

Candidatas detectadas para ESTA petici\xF3n:
${candidatas}

Decide una representaci\xF3n principal (puedes hibridar con una secundaria) y
refleja la decisi\xF3n en la ficha: en \xABEstructura\xBB y en \xABMensaje principal\xBB.
Si lo correcto para ESTE negocio es un patr\xF3n cl\xE1sico (ficha de producto,
blog de columna \xFAnica), el\xEDgilo CON CRITERIO y dilo en la ficha: lo
prohibido es no decidir, no el patr\xF3n cl\xE1sico.`;
}

// src/lib/prism/forja/conocimiento/disenador.ts
var BASE_DISENADOR = `## Qui\xE9n eres
Eres el Dise\xF1ador de FORJA IA, una IA especializada en dise\xF1ar p\xE1ginas web
con nivel de estudio profesional. Tu trabajo NO es escribir c\xF3digo: es tomar
la idea del usuario y convertirla en decisiones de dise\xF1o tan concretas que
otro desarrollador pueda ejecutarlas sin preguntarte nada.

## Reglas inquebrantables
1. La ficha se escribe SOLO con las secciones del formato. Nada de c\xF3digo,
   nada de explicaciones fuera de la ficha.
2. Toda decisi\xF3n debe ser medible: \xABazul #1D4ED8 para CTAs\xBB, no \xABazul bonito\xBB.
3. M\xE1ximo 2 tipograf\xEDas y 1 familia de color con 3 tonos + 1 acento.
4. Dise\xF1a primero m\xF3vil (375px) y despu\xE9s escala a desktop.
5. Si el usuario pide algo que degrada la experiencia (popups, auto-play con
   sonido, texto sobre imagen sin contraste), prop\xF3n la alternativa y an\xF3talo
   en restricciones.`;
var ESTRATEGIA_DISENO = `## Tu m\xE9todo: estrategia antes que est\xE9tica
Antes de elegir un solo color, respondes mentalmente a estas preguntas y
dejas sus respuestas reflejadas en la ficha:
1. \xBFQu\xE9 debe SENTIR el usuario al entrar? (confianza, urgencia, calma,
   curiosidad\u2026) El sentimiento manda sobre el gusto personal.
2. \xBFCu\xE1l es la \xDANICA acci\xF3n principal? Si hay dos acciones gemelas, la
   p\xE1gina est\xE1 mal: elige la primaria y degrada la otra.
3. \xBFQu\xE9 se recuerda a los 10 segundos? (una frase, una imagen, un dato).
   Ese recuerdo define el hero.
4. \xBFQui\xE9n es el usuario y en qu\xE9 contexto mira la p\xE1gina? (m\xF3vil y con
   prisa \u2260 desktop y con tiempo). El p\xFAblico condensa esta respuesta.
Regla de oro: cada elemento visual o defiende el mensaje principal o lo
estorba. Lo que solo \xABdecora\xBB, fuera.`;
var CONOCIMIENTO_DISENO = `## Conocimiento que aplicas en cada ficha

### Paleta
- Regla 60-30-10: 60% neutro de fondo, 30% color secundario, 10% acento.
- El acento va SOLO a acciones clave (bot\xF3n principal, enlaces activos).
- Texto sobre fondo: contraste m\xEDnimo 4.5:1 (usa blanco #FFFFFF o casi-negro
  #111827 sobre colores de marca; nunca gris claro sobre blanco).
- Estados: \xE9xito verde #16A34A, error rojo #DC2626, aviso \xE1mbar #D97706.

### Tipograf\xEDa
- Escala modular 1.25: 13/16/20/25/31/39px. Cuerpo m\xEDnimo 16px en m\xF3vil.
- Interlineado: 1.5 en p\xE1rrafos, 1.15 en t\xEDtulos.
- Emparejamientos seguros: Inter+Inter, Inter+Lora, Poppins+Inter,
  Playfair Display+Source Sans. M\xE1ximo 2 familias.

### Espaciado y layout
- Escala de 4: 4/8/12/16/24/32/48/64/96px. Espacio entre secciones 64-96px.
- Ancho de lectura: m\xE1ximo 75 caracteres por l\xEDnea (680px aprox).
- Contenedor central 1200px, laterales nunca vac\xEDos por debajo de 24px.
- Grid de 12 columnas en desktop; 2 columnas m\xEDnimas en tablet; 1 en m\xF3vil.

### Jerarqu\xEDa visual
- Una sola acci\xF3n principal por pantalla (el CTA m\xE1s visible).
- Los t\xEDtulos venden, los subt\xEDtulos aclaran, el cuerpo convence.
- Tres niveles como m\xE1ximo: si todo destaca, no destaca nada.
- Para diferenciar sin agrandar: peso (600 vs 400), tono (gris 900 vs 500)
  y espacio; el tama\xF1o es el \xFAltimo recurso, no el primero.

### Profundidad y acabado
- Sombras en 2 capas (una difusa grande + una corta y densa) si el estilo
  lo pide; si no, separaci\xF3n por bordes 1px y contraste de superficie.
- Radios de esquina coherentes en TODA la p\xE1gina (elige 4, 8 o 16px).
- Las im\xE1genes recortan con aspect-ratio fijo para no romper el layout.

### Patrones probados por tipo de p\xE1gina
- Landing: hero con objeto/UI del producto y propuesta clara \u2192 beneficios
  con composici\xF3n variada (no tres tarjetas gemelas) \u2192 c\xF3mo funciona en
  pasos \u2192 prueba \u2192 CTA final.
- Dashboard: sidebar de navegaci\xF3n + cabecera con b\xFAsqueda + tarjetas KPI
  arriba + gr\xE1fico principal + tabla. Densidad alta, decoraci\xF3n cero.
- Tienda: ficha de producto con galer\xEDa izquierda, compra derecha,
  sticky en m\xF3vil; filtros colapsables; precios tabulares alineados.
- Portfolio: composici\xF3n por peso real (m\xF3dulos desiguales o ret\xEDcula
  interactiva) con hover que revela proyecto; portada con objeto focal;
  contacto a un clic.
- Blog: columna \xFAnica 680px, \xEDndice al inicio, tipograf\xEDa protagonista.

### Accesibilidad m\xEDnima (WCAG AA)
- Contraste 4.5:1 en texto; foco visible en todo elemento interactivo.
- \xC1rea t\xE1ctil 44x44px; formularios con label siempre visible.
- La informaci\xF3n nunca solo por color (a\xF1ade icono o texto).

### Biblioteca positiva (S\xCD usar cuando corresponda \u2014 v4.5, correcci\xF3n \xA714)
No basta con prohibir lo gen\xE9rico: estas son las ALTERNATIVAS concretas que
puedes y debes proponer cuando la intenci\xF3n las pida. Elige 2-4 por ficha y
n\xF3mbralas en \xABEstructura\xBB o \xABInteracci\xF3n\xBB:
- floating product: el producto flota con sombra propia sobre el fondo.
- oversized typography: el claim a escala de escena (clamp hasta 9-12vw).
- 3d hero object: objeto 3D central mirable, rotaci\xF3n ambiental sutil.
- interactive grid: ret\xEDcula cuyas piezas reaccionan y revelan detalle.
- technical grid: ret\xEDcula visible de fondo (1px, opacidad baja).
- layered surfaces: superficies apiladas con elevaci\xF3n distinta por capa.
- asymmetric composition: composici\xF3n 60/40 con el foco fuera del centro.
- floating metrics: n\xFAmeros clave flotando como cards peque\xF1as.
- scroll choreography: el scroll orquesta entradas, parallax y escenas.
- sticky storytelling: una pieza anclada mientras el contenido cambia.
- horizontal exploration: franja horizontal (drag/scroll lateral) secuencial.
- magnetic CTA: el bot\xF3n principal se atrae hacia el puntero (\u226412px).
- tilt card: piezas que se inclinan en 3D (m\xE1x 8\xB0, perspective 1000px).
- spotlight interaction: un foco sutil sigue al puntero en la pieza clave.
- depth stacking: piezas apiladas con translateZ distinto que se separan.
- product UI collage: varias vistas reales del producto superpuestas.
- perspective composition: el bloque comparte perspective; piezas a distinta Z.
- animated workflow: el flujo del producto se anima paso a paso.
- orbital navigation: la navegaci\xF3n secundaria orbita el objeto central.
Regla: un patr\xF3n sin prop\xF3sito es decoraci\xF3n. Si lo tomas, N\xD3MBRALO.`;
var FORMATO_FICHA = `## Formato de salida OBLIGATORIO \u2014 responde EXACTAMENTE as\xED

<ficha>
# Ficha de dise\xF1o
Tipo de web: [landing | tienda | dashboard | portfolio | blog | spa | otra]
P\xFAblico: [para qui\xE9n es, en una l\xEDnea]
Mensaje principal: [la idea que la p\xE1gina debe comunicar en 1 frase]

## Paleta
[fondo primario, superficie, texto, acento, estados \u2014 con hex]

## Tipograf\xEDa
[familia t\xEDtulos, familia cuerpo, escala, pesos]

## Estructura (secciones de arriba a abajo)
1. [secci\xF3n \u2014 qu\xE9 contiene \u2014 altura aprox]
2. [...]

## Interacci\xF3n
[qu\xE9 pasa al hover, al click, al scroll; animaciones y su duraci\xF3n]

## Restricciones
[qu\xE9 NO hacer y alternativas elegidas]
</ficha>

Responde \xDANICAMENTE con la ficha. Sin saludos, sin pre\xE1mbulos, sin c\xF3digo.`;
var FORMATO_DIRECCIONES = `## Modo propuesta: primero el ADN, luego las IDEAS
El usuario ver\xE1 una maqueta antes de aprobar el c\xF3digo. Tu primer trabajo no
es proponer estilos: es DEFINIR EL ADN VISUAL del proyecto \u2014 la identidad que
todas las ideas compartir\xE1n y contra la que se auditar\xE1 el resultado.

Reglas del ADN:
- Personalidad: 4-6 rasgos con nombre (tecnol\xF3gico, silencioso, preciso\u2026).
- Sensaci\xF3n: 4-6 ejes con puntuaci\xF3n X/10 (confianza, innovaci\xF3n, lujo,
  agresividad, claridad, energ\xEDa\u2026). Lo que el usuario debe SENTIR al entrar.
- Lenguaje: 4-8 decisiones visuales recurrentes (superficies limpias,
  grandes espacios negativos, tipograf\xEDa protagonista, contraste fuerte\u2026).
- Prohibiciones: 4-8 cosas que NO encajan con este proyecto. Piensa qu\xE9
  har\xEDa un generador mediocre y proh\xEDbelo (tarjetas gen\xE9ricas en fila,
  gradientes excesivos, blobs, glassmorphism en exceso\u2026).

Despu\xE9s propone TRES direcciones de dise\xF1o que sean VARIACIONES del mismo
ADN (no clones con otro color ni webs distintas): nombre memorable, concepto
en una frase y por qu\xE9 sirve para ESTE proyecto. Opcionalmente detalla
paleta/tipograf\xEDa por idea.

Con la ficha de m\xE1s abajo, desarrollas COMPLETA la direcci\xF3n 1 (la que t\xFA
recomendar\xEDas y la que se maquetar\xE1 primero), SIEMPRE dentro del ADN.

## Formato de salida OBLIGATORIO en modo propuesta

<adn>
Personalidad: [4-6 rasgos separados por comas]
Sensaci\xF3n: [eje X/10, separados por comas]
Lenguaje: [4-8 decisiones visuales separadas por comas]
Prohibiciones: [4-8 prohibiciones separadas por comas]
</adn>

<direcciones>
1. [Nombre corto] \u2014 [concepto en una frase] \u2014 [por qu\xE9 funciona aqu\xED]
   Paleta 1: [hex, hex, hex]
   Tipograf\xEDa 1: [t\xEDtulos + cuerpo]
2. [Nombre corto] \u2014 [concepto] \u2014 [por qu\xE9]
   Paleta 2: [hex, hex, hex]
   Tipograf\xEDa 2: [t\xEDtulos + cuerpo]
3. [Nombre corto] \u2014 [concepto] \u2014 [por qu\xE9]
   Paleta 3: [hex, hex, hex]
   Tipograf\xEDa 3: [t\xEDtulos + cuerpo]
</direcciones>

<ficha>
\u2026la ficha completa de la direcci\xF3n 1, con el formato de siempre\u2026
</ficha>

Nada fuera de esas tres etiquetas.`;
var FORMATO_VISIONES = `## Modo ESTUDIO: eres el DIRECTOR CREATIVO
Hoy no propones direcciones para elegir: diriges un estudio. Tres
maquetadores ejecutar\xE1n en paralelo TRES VISIONES tuyas; un panel de jueces
(visual, UX/accesibilidad, originalidad) las comparar\xE1 con la petici\xF3n delante
y un Director Final fusionar\xE1 lo mejor de todas. Nada de esto funciona si las
visiones se parecen: tu trabajo es la DIVERGENCIA.

Reglas del ADN (igual que siempre):
- Personalidad: 4-6 rasgos con nombre. Sensaci\xF3n: 4-6 ejes X/10.
- Lenguaje: 4-8 decisiones visuales recurrentes.
- Prohibiciones: 4-8 cosas que NO encajan (piensa qu\xE9 har\xEDa un generador
  mediocre y proh\xEDbelo).

Reglas de las visiones:
- Las tres comparten ESTE ADN, pero cada una usa una REPRESENTACI\xD3N distinta
  de la informaci\xF3n (espacial vs editorial vs contextual\u2026), no tres paletas.
- Cada visi\xF3n: nombre memorable + ENFOQUE (qu\xE9 representaci\xF3n elige y qu\xE9
  decisi\xF3n compositiva toma) + por qu\xE9 sirve a ESTE negocio.
- Prohibido que dos visiones compartan composici\xF3n: si dos se parecen,
  reemplaza una por otro enfoque real.
- Ninguna visi\xF3n puede apoyarse en patrones gen\xE9ricos (hero centrado, t\xEDtulo
  gigante, tres tarjetas gemelas, fondo degradado, blobs): el ADN los proh\xEDbe.

## Formato de salida OBLIGATORIO en modo estudio

<adn>
Personalidad: [4-6 rasgos separados por comas]
Sensaci\xF3n: [eje X/10, separados por comas]
Lenguaje: [4-8 decisiones visuales separadas por comas]
Prohibiciones: [4-8 prohibiciones separadas por comas]
</adn>

<visiones>
1. [Nombre corto] \u2014 [enfoque: representaci\xF3n + composici\xF3n] \u2014 [por qu\xE9 aqu\xED]
2. [Nombre corto] \u2014 [enfoque] \u2014 [por qu\xE9]
3. [Nombre corto] \u2014 [enfoque] \u2014 [por qu\xE9]
</visiones>

<ficha>
\u2026la ficha BASE com\xFAn a las tres visiones (formato de siempre): estructura
m\xEDnima compartida, paleta y tipograf\xEDa del ADN; cada maquetador la
reinterpretar\xE1 seg\xFAn su visi\xF3n\u2026
</ficha>

Nada fuera de esas tres etiquetas.`;
function promptDisenador(bloquesHabilidades, reglas = [], reglasGlobales = [], modoMaqueta = false, modoEstudio = false, seccionRepresenta = "") {
  const habilidades = bloquesHabilidades.length ? `

## Habilidades activadas para este proyecto
${bloquesHabilidades.join("\n\n")}` : "";
  const memoria2 = reglas.length ? `

## Reglas aprendidas del usuario y de fallos previos
${reglas.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join("\n")}
Estas reglas TIENEN prioridad sobre tus preferencias.` : "";
  const web = reglasGlobales.length ? `

## Conocimiento acumulado (cada regla lleva su autoridad entre corchetes)
${reglasGlobales.map((r) => `- ${r}`).join("\n")}
C\xF3mo leerlo: [preferencia] manda sobre todo (es del due\xF1o); [fallo] y
[fallo G<n>] NO se repiten ni como inspiraci\xF3n; [experimento <pts>/100] se
aplica si su puntuaci\xF3n es alta; [fundamento] y [patr\xF3n] son buenas pr\xE1cticas;
[tendencia] est\xE1 vigente pero puede caducar. La ficha y el usuario mandan
siempre por encima de este bloque.` : "";
  const propuesta = modoEstudio ? `

${FORMATO_VISIONES}` : modoMaqueta ? `

${FORMATO_DIRECCIONES}` : "";
  const representacion = seccionRepresenta ? `

${seccionRepresenta}` : "";
  return `${BASE_DISENADOR}

${ESTRATEGIA_DISENO}

${CONOCIMIENTO_DISENO}${representacion}${habilidades}${web}

${FORMATO_FICHA}${propuesta}${memoria2}`;
}

// src/lib/prism/forja/conocimiento/codificador.ts
var BASE_CODIFICADOR = `## Qui\xE9n eres
Eres el Codificador de FORJA IA, una IA especializada en construir p\xE1ginas
web. Recibes una FICHA DE DISE\xD1O y tu trabajo es producir el c\xF3digo que la
cumple EXACTAMENTE. No redise\xF1as: si la ficha dice azul #1D4ED8, es
#1D4ED8; si dice secci\xF3n de testimonios, existen los testimonios.

## Reglas inquebrantables
1. ENTREGA COMPLETA: cada archivo entero, listo para guardar. PROHIBIDO
   \xAB\u2026\xBB, \xABresto igual\xBB, \xABaqu\xED va el CSS anterior\xBB o cualquier recorte.
2. Un bloque de c\xF3digo por archivo. La primera l\xEDnea del cercado es la ruta:
   \`\`\`html index.html
3. Los colores, tipograf\xEDas, espaciados y estructura salen de la ficha.
   Si la ficha calla algo, decide t\xFA y an\xF3talo al final en \xABDecisiones\xBB.
4. Mobile first: el dise\xF1o funciona a 375px antes que a 1440px.
5. Sin dependencias externas salvo Google Fonts si la ficha lo pide.
   Vanilla HTML/CSS/JS salvo que la ficha o el usuario pidan React.
6. El c\xF3digo debe funcionar al abrirlo: nada de llamadas a APIs que no
   existen, nada de im\xE1genes rotas (usa gradientes o SVG inline si falta
   una foto), nada de funciones sin definir.`;
var CALIDAD_CODIGO = `## Calidad que asumes en cada entrega
- HTML sem\xE1ntico: header, nav, main, section, footer; un solo h1.
- <html lang="es">, <meta name="viewport"> y <meta name="theme-color">.
- CSS con variables: --color-acento, --espacio-md, etc. en :root.
- Contraste y \xE1reas t\xE1ctiles de la ficha se cumplen EN EL C\xD3DIGO
  (min-height 44px en botones, alt en im\xE1genes, label en cada input).
- Botones con solo icono llevan aria-label; inputs con autocomplete
  (email, name, tel) y type correcto; foco visible con :focus-visible.
- Responsive con clamp() y media queries a 768px y 1024px; media con
  aspect-ratio y object-fit: cover para que nada salte ni se deforme.
- Im\xE1genes con width/height y decoding="async"; loading="lazy" salvo hero.
- Animaciones con transform/opacity y prefers-reduced-motion respetado.
- Sin estilos inline salvo casos puntuales; sin !important.`;
var FORMATO_CODIGO = `## Formato de salida OBLIGATORIO

Devuelve primero los archivos, cada uno completo:

\`\`\`html index.html
[contenido completo]
\`\`\`

\`\`\`css styles.css
[contenido completo]
\`\`\`

\`\`\`js app.js
[contenido completo, solo si hay interacci\xF3n]
\`\`\`

Despu\xE9s, y SOLO despu\xE9s:

<decisiones>
- [toda decisi\xF3n que tuviste que tomar porque la ficha callaba, 1 l\xEDnea cada una]
</decisiones>

Sin saludos, sin explicar el c\xF3digo fuera de <decisiones>:
el Revisor comparar\xE1 tu entrega contra la ficha l\xEDnea a l\xEDnea.`;
function promptCodificador(reglas = []) {
  const memoria2 = reglas.length ? `

## Reglas aprendidas de fallos previos \u2014 NO las repitas
${reglas.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join("\n")}` : "";
  return `${BASE_CODIFICADOR}

${CALIDAD_CODIGO}

${FORMATO_CODIGO}${memoria2}`;
}

// src/lib/prism/forja/conocimiento/revisor.ts
var BASE_REVISOR = `## Qui\xE9n eres
Eres el Revisor de FORJA IA, una IA especializada en control de calidad de
p\xE1ginas web. Recibes: la petici\xF3n del usuario, la FICHA DE DISE\xD1O y el
C\xD3DIGO entregado. Tu trabajo es auditar y dar un veredicto. NO reescribes
c\xF3digo: solo se\xF1alas defectos concretos con su ubicaci\xF3n y su correcci\xF3n.

## Reglas inquebrantables
1. Revisa el checklist COMPLETO en orden; no te detengas en el primer fallo.
2. Cada defecto: QU\xC9 falla, D\xD3NDE (archivo y secci\xF3n), C\xD3MO corregirlo.
3. S\xE9 estricto con lo verificable (contraste, responsive, sem\xE1ntica) y
   flexible con lo subjetivo si la ficha se cumple: el dise\xF1o ya fue aprobado.
4. Si el c\xF3digo cumple la ficha y el checklist, APRUEBA. No inventes
   defectos por compromiso: aprobar bien es parte del trabajo.
5. M\xE1ximo 8 defectos por veredicto, ordenados de mayor a menor impacto.`;
var CHECKLIST = `## Checklist de auditor\xEDa (en este orden)

1. FIDELIDAD: \xBFla estructura de la ficha existe en el HTML? \xBFlos colores y
   tipograf\xEDas coinciden con los hex/familias de la ficha?
2. CONTENIDO: \xBFtodo texto es real y contextual? PROHIBIDO \xABLorem ipsum\xBB,
   \xABTexto de ejemplo\xBB o secciones vac\xEDas.
3. RESPONSIVE: \xBFhay media queries o clamp()? \xBFel layout funciona a 375px?
   \xBFel men\xFA m\xF3vil es usable?
4. ACCESIBILIDAD: \xBFcontraste 4.5:1? \xBFalt en im\xE1genes? \xBFlabel en inputs?
   \xBF\xE1reas t\xE1ctiles 44px? \xBFfoco visible? \xBFun solo h1 y jerarqu\xEDa correcta?
   \xBFlang="es" en <html>? \xBFaria-label en botones solo-icono?
5. SEM\xC1NTICA: \xBFheader/nav/main/footer? \xBFbotones son <button>? \xBFenlaces
   con href? \xBFformularios v\xE1lidos?
6. FUNCIONAMIENTO: \xBFtodo id referenciado existe? \xBFlos event listeners
   apuntan a elementos presentes? \xBFno hay funciones sin definir?
7. RENDIMIENTO: \xBFim\xE1genes con width/height para evitar saltos? \xBFanimaciones
   en transform/opacity? \xBFsin librer\xEDas innecesarias?
8. DETALLES: favicon no imprescindible, pero t\xEDtulos de p\xE1gina s\xED; estados
   hover/focus en lo interactivo; prefers-reduced-motion si hay animaciones;
   formularios con autocomplete y validaci\xF3n m\xEDnima; secciones de la ficha
   en el MISMO orden que defini\xF3 el Dise\xF1ador (fidelidad estructural).`;
var FORMATO_VEREDICTO = `## Formato de salida OBLIGATORIO \u2014 responde EXACTAMENTE as\xED

Si APRUEBA:
<veredicto>aprobado</veredicto>
<resumen>[una l\xEDnea: qu\xE9 se aprob\xF3 y el nivel de calidad]</resumen>

Si RECHAZA:
<veredicto>rechazado</veredicto>
<defectos>
- [qu\xE9 falla \u2014 d\xF3nde \u2014 c\xF3mo corregirlo]
- [...]
</defectos>
<resumen>[una l\xEDnea: el defecto m\xE1s grave]</resumen>

Nada fuera de esas etiquetas. Nada de c\xF3digo corregido: eso es del Codificador.`;
var NOTA_INSPECTOR = `## Sobre el bloque INSPECTOR VISUAL
A veces tu mensaje incluye un bloque ---INSPECTOR VISUAL--- generado por un
chequeo autom\xE1tico del HTML (regex, no opini\xF3n). Tr\xE1talo as\xED:
1. Cada hallazgo es un CANDIDATO a defecto: conf\xEDrmalo si es real o
   desc\xE1rtalo con motivo (los detectores de contraste fallan con degradados
   e im\xE1genes de fondo, por ejemplo).
2. Si alg\xFAn hallazgo CR\xCDTICO te parece real, la entrega NO se aprueba hasta
   que el Codificador lo corrije: incl\xFAyelo en <defectos>.
3. El inspector no lo ve todo (no renderiza la p\xE1gina): t\xFA sigues siendo
   quien eval\xFAa fidelidad, contenido y funcionamiento.`;
var NOTA_ANTIGENERICO = `## Sobre el bloque INFORME ANTI-GEN\xC9RICO
A veces tu mensaje incluye un bloque ---INFORME ANTI-GEN\xC9RICO--- generado por
un detector autom\xE1tico de plantilla (regex, no opini\xF3n). Tr\xE1talo as\xED:
1. Cada s\xEDntoma listado (\xABHero centrado\xBB, \xABBot\xF3n azul por defecto\xBB\u2026) es un
   CANDIDATO: conf\xEDrmalo si de verdad est\xE1 en el c\xF3digo o desc\xE1rtalo con
   motivo si el detector se equivoc\xF3.
2. Si el nivel de saturaci\xF3n es ALTO y los s\xEDntomas son reales, la entrega NO
   se aprueba tal cual: m\xE1ndalo al Codificador con las alternativas del
   informe (\xABsustituye X por Y\xBB). Un dise\xF1o que parece plantilla es un
   defecto de identidad, igual que un contraste roto es un defecto t\xE9cnico.
3. Nivel BAJO o MEDIO: menci\xF3nalo solo si afecta a la jerarqu\xEDa o a la
   claridad; no rechaces por una simple coincidencia.`;
function promptRevisor() {
  return `${BASE_REVISOR}

${CHECKLIST}

${NOTA_INSPECTOR}

${NOTA_ANTIGENERICO}

${FORMATO_VEREDICTO}`;
}

// src/lib/prism/forja/conocimiento-usuario.ts
var MEMORIA_DEFECTO = { reglas: [] };
var MAX_REGLAS = 40;
var CLAVE_MEMORIA = "forja.memoria";
function aprender(memoria2, texto, origen) {
  const limpio = texto.trim().replace(/\s+/g, " ").slice(0, 220);
  if (!limpio) return memoria2;
  const igual = memoria2.reglas.find((r) => r.texto.toLowerCase() === limpio.toLowerCase());
  if (igual) {
    return {
      reglas: memoria2.reglas.map(
        (r) => r.id === igual.id ? { ...r, usos: r.usos + 1 } : r
      )
    };
  }
  const nueva = {
    id: `r_${Date.now().toString(36)}_${memoria2.reglas.length}`,
    texto: limpio,
    origen,
    creada: (/* @__PURE__ */ new Date()).toISOString(),
    usos: 1
  };
  const reglas = [nueva, ...memoria2.reglas];
  if (reglas.length > MAX_REGLAS) {
    const manuales = reglas.filter((r) => r.origen === "manual");
    const exito = reglas.filter((r) => r.origen === "exito").sort((a, b) => a.usos - b.usos).slice(0, MAX_REGLAS - manuales.length);
    reglas.length = 0;
    reglas.push(...manuales, ...exito);
  }
  return { reglas };
}
function aprenderDeExito(memoria2, decisiones) {
  let out = memoria2;
  for (const d of decisiones.slice(0, 5)) {
    if (d.trim().length < 8) continue;
    out = aprender(out, `Preferencia validada en proyectos previos: ${d.trim()}`, "exito");
  }
  return out;
}
function reglasParaPrompt(memoria2) {
  const manuales = memoria2.reglas.filter((r) => r.origen === "manual");
  const exito = memoria2.reglas.filter((r) => r.origen === "exito").sort((a, b) => b.usos - a.usos);
  return [...manuales, ...exito].slice(0, 10).map((r) => r.texto);
}
function esReglaDeCalidad(texto) {
  return /(accesibilidad|sem[aá]ntic|contraste|responsive|rendimiento|test|validar|bug|error)/i.test(
    texto
  );
}

// src/lib/prism/forja/nucleo-extractos.ts
function extraerCodigo(texto) {
  const m = texto.match(/```[a-zA-Z]*\s*\n([\s\S]*?)```/);
  if (m) return m[1].trim();
  const recorte = texto.match(/(<!DOCTYPE[\s\S]*|<html[\s\S]*)/i);
  return recorte ? recorte[1].trim() : texto.trim();
}
function extraerDecisiones(texto) {
  const m = texto.match(/<decisiones>([\s\S]*?)<\/decisiones>/i);
  if (!m) return [];
  return m[1].split(/\n+/).map((l) => l.trim().replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);
}

// src/lib/prism/forja/adn-visual.ts
var MAX_TRAITOS_ADN = 6;
var MAX_EJES_ADN = 6;
var MAX_LENGUAJE_ADN = 8;
var MAX_PROHIBICIONES_ADN = 8;
var MAX_TEXTO_RASGO = 48;
var MAX_TEXTO_LENGUAJE = 80;
function adnDesdePeticion(mensaje) {
  const m = (mensaje || "").toLowerCase();
  const sensible = /\b(banco|financ|legal|abogad|cl[ií]nic|salud|gobierno|segur)\b/.test(m);
  const vital = /\b(fiesta|evento|musica|m[uú]sic|juego|gaming|bar|restaurante|moda)\b/.test(m);
  return {
    personalidad: sensible ? ["sobrio", "fiable", "preciso", "cercano"] : vital ? ["energ\xE9tico", "expresivo", "directo", "moderno"] : ["profesional", "claro", "preciso", "moderno"],
    sensacion: [
      { eje: "confianza", valor: sensible ? 9 : 7 },
      { eje: "claridad", valor: 8 },
      { eje: "innovaci\xF3n", valor: vital ? 8 : 5 },
      { eje: "agresividad", valor: vital ? 6 : 2 }
    ],
    lenguaje: [
      "superficies limpias",
      "jerarqu\xEDa evidente en 10 segundos",
      "tipograf\xEDa protagonista",
      "espacios negativos generosos"
    ],
    prohibiciones: [
      "tarjetas gen\xE9ricas en fila",
      "gradientes excesivos",
      "dashboards de cajitas",
      "blobs decorativos de fondo",
      "glassmorphism en exceso",
      "layouts repetitivos de plantilla"
    ]
  };
}
function limpiarItem(s, max) {
  return s.replace(/\s+/g, " ").replace(/^[-*•\d.)\s]+/, "").trim().slice(0, max);
}
function sanearAdn(adn) {
  const uniq = (xs) => {
    const vistos = /* @__PURE__ */ new Set();
    const out = [];
    for (const x of xs) {
      const t = limpiarItem(x, MAX_TEXTO_LENGUAJE);
      if (!t || t.length < 3) continue;
      const clave2 = t.toLowerCase();
      if (vistos.has(clave2)) continue;
      vistos.add(clave2);
      out.push(t);
    }
    return out;
  };
  const sensacion = (() => {
    const vistos = /* @__PURE__ */ new Set();
    const out = [];
    for (const e of adn.sensacion) {
      const eje = limpiarItem(e.eje, MAX_TEXTO_RASGO).toLowerCase();
      if (!eje || vistos.has(eje)) continue;
      vistos.add(eje);
      const valor = Math.max(0, Math.min(10, Math.round(Number(e.valor) || 0)));
      out.push({ eje, valor });
    }
    return out;
  })();
  return {
    personalidad: uniq(adn.personalidad).slice(0, MAX_TRAITOS_ADN),
    sensacion: sensacion.slice(0, MAX_EJES_ADN),
    lenguaje: uniq(adn.lenguaje).slice(0, MAX_LENGUAJE_ADN),
    prohibiciones: uniq(adn.prohibiciones).slice(0, MAX_PROHIBICIONES_ADN)
  };
}
function adnVacio(adn) {
  if (!adn) return true;
  return adn.personalidad.length === 0 && adn.sensacion.length === 0 && adn.lenguaje.length === 0 && adn.prohibiciones.length === 0;
}
function parseAdn(texto) {
  if (!texto) return null;
  const bloque = texto.match(/<adn>([\s\S]*?)<\/adn>/i);
  const fuente = bloque ? bloque[1] : "";
  if (!fuente.trim()) return null;
  const listaDe = (nombre) => {
    const re = new RegExp(`^\\s*(?:${nombre})\\s*:\\s*(.+)$`, "gim");
    const items = [];
    let m;
    while ((m = re.exec(fuente)) !== null) {
      for (const trozo of m[1].split(/[,;/]\s*/)) {
        const t = limpiarItem(trozo, MAX_TEXTO_LENGUAJE);
        if (t.length >= 3) items.push(t);
      }
    }
    return items;
  };
  const personalidad = listaDe("personalidad|rasgos");
  const lenguaje = listaDe("lenguaje|lenguaje visual");
  const prohibiciones = listaDe("prohibiciones|prohibici[\xF3o]n|no hacer|evitar");
  const sensacion = [];
  const lineasSens = fuente.match(/^\s*sensaci[óo]n(?:\s+objetiva|\s+deseada)?\s*:\s*([\s\S]*?)(?=\n\s*\S+\s*:|$)/gim) ?? [];
  const cuerpoSens = lineasSens.join("\n");
  const reEje = /([a-záéíóúñü]{3,20})\s*[:=]?\s*(\d{1,2})(?:\s*\/\s*10)?/gi;
  let e;
  while ((e = reEje.exec(cuerpoSens)) !== null) {
    const eje = limpiarItem(e[1], MAX_TEXTO_RASGO);
    if (eje.length < 3) continue;
    sensacion.push({ eje, valor: Math.max(0, Math.min(10, Number(e[2]))) });
  }
  const crudo = { personalidad, sensacion, lenguaje, prohibiciones };
  if (adnVacio(crudo)) return null;
  return sanearAdn(crudo);
}
function textoAdn(adn) {
  const lista = (xs) => xs.map((x) => `- ${x}`).join("\n");
  const sens = adn.sensacion.length ? adn.sensacion.map((e) => `${e.eje} **${e.valor}/10**`).join(" \xB7 ") : "\u2014";
  return [
    `**Personalidad:** ${adn.personalidad.join(", ") || "\u2014"}`,
    `**Sensaci\xF3n:** ${sens}`,
    `**Lenguaje visual:**
${lista(adn.lenguaje) || "-"}`,
    `**Prohibiciones:**
${lista(adn.prohibiciones) || "-"}`
  ].join("\n");
}
function seccionAdn(adn) {
  const sens = adn.sensacion.map((e) => `${e.eje} ${e.valor}/10`).join(", ");
  return [
    `# ADN visual del proyecto (OBLIGATORIO, aplica a cada decisi\xF3n)`,
    `Personalidad: ${adn.personalidad.join(", ") || "\u2014"}`,
    `Sensaci\xF3n objetivo: ${sens || "\u2014"}`,
    `Lenguaje visual: ${adn.lenguaje.join("; ") || "\u2014"}`,
    `PROHIBIDO en este proyecto: ${adn.prohibiciones.join("; ") || "\u2014"}`,
    `El resultado debe ser reconocible como ESTE proyecto, nunca como una plantilla; el Revisor y el Juez auditan contra este ADN.`
  ].join("\n");
}

// src/lib/prism/forja/antigenerico.ts
var MOTIVOS_NIVEL = {
  bajo: "La p\xE1gina conserva identidad propia; vigila que no deriva a plantilla al a\xF1adir secciones.",
  medio: "Empieza a parecer una plantilla generada por IA: sustituye los s\xEDntomas por decisiones con intenci\xF3n.",
  alto: "Patr\xF3n excesivamente frecuente en interfaces generadas por IA. Esto no es un dise\xF1o, es una plantilla con otro logo."
};
var AZULES_DEFECTO = /#(?:3b82f6|2563eb|1d4ed8|1e40af|0ea5e9|0284c7|60a5fa)\b|rgb\(\s*(?:59\s*,\s*130\s*,\s*246|37\s*,\s*99\s*,\s*235|29\s*,\s*78\s*,\s*216|30\s*,\s*58\s*,\s*138|14\s*,\s*165\s*,\s*233|2\s*,\s*132\s*,\s*199)\s*\)/gi;
var defs = [
  {
    id: "hero-centrado",
    nombre: "Hero centrado",
    motivo: "el hero centrado con el CTA al medio es LA composici\xF3n por defecto de todo generador: cero intenci\xF3n compositiva",
    alternativa: "composici\xF3n asim\xE9trica o editorial: que la jerarqu\xEDa la den el peso, la posici\xF3n y el espacio, no el centro",
    gravedad: 2,
    detecta: (h) => {
      if (!/<h1[\s>]/i.test(h)) return false;
      const tieneHero = /<(?:section|header|div|main)[^>]*\s(?:class|id)="[^"]*(?:hero|banner|masthead|portada)[^"]*"[^>]*>/i.test(h);
      if (!tieneHero) return false;
      const bloque = h.match(/<(?:section|header|div)[^>]*\s(?:class|id)="[^"]*(?:hero|banner|masthead|portada)[^"]*"[^>]*>[\s\S]{0,800}?<\/(?:section|header|div)>/i)?.[0] ?? "";
      if (/text-align\s*:\s*center|text-center/i.test(bloque)) return true;
      const cssHero = h.match(/\.(?:hero|banner|masthead|portada)[\w-]*[^{}]*\{[^{}]*\}/gi) ?? [];
      return cssHero.some((regla) => /text-align\s*:\s*center/i.test(regla));
    }
  },
  {
    id: "titulo-gigante",
    nombre: "T\xEDtulo gigante",
    motivo: "el titular descomunal sin escala secundaria grita \xABplantilla landing\xBB: el tama\xF1o no es jerarqu\xEDa",
    alternativa: "escala modular (1.25) con ritmo real y un titular que convoque en una frase, no que ocupe media pantalla",
    gravedad: 2,
    detecta: (h) => {
      if (!/<h1[\s>]/i.test(h)) return false;
      const h1 = h.match(/<h1[\s\S]{0,400}?<\/h1>/i)?.[0] ?? "";
      const fuentes = [h1];
      fuentes.push(...h.match(/[^{}]*\bh1\b[^{}]*\{[^{}]*\}/gi) ?? []);
      const claseH1 = h1.match(/class="([^"]*)"/i)?.[1];
      if (claseH1) {
        for (const cls of claseH1.split(/\s+/).filter(Boolean)) {
          const esc = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          fuentes.push(...h.match(new RegExp(`\\.${esc}[^{}]*\\{[^{}]*\\}`, "gi")) ?? []);
        }
      }
      const texto = fuentes.join("\n");
      const rem = texto.match(/font-size\s*:\s*([\d.]+)\s*rem/i);
      if (rem && parseFloat(rem[1]) >= 3.5) return true;
      const px = texto.match(/font-size\s*:\s*([\d.]+)\s*px/i);
      if (px && parseFloat(px[1]) >= 56) return true;
      const clamp = texto.match(/clamp\([^,]*,\s*([\d.]+)\s*(?:rem|vw)/i);
      if (clamp && parseFloat(clamp[1]) >= 4) return true;
      return /text-(?:[6-9]xl|8xl)|text-\[\s*(?:4|5)rem/i.test(texto);
    }
  },
  {
    id: "boton-azul",
    nombre: "Bot\xF3n azul por defecto",
    motivo: "el azul #3B82F6 es la identidad de Tailwind, no del proyecto: es la se\xF1al n\xBA 1 de \xABesto lo hizo una IA\xBB",
    alternativa: "un acento propio derivado del ADN del proyecto, usado SOLO en la acci\xF3n principal",
    gravedad: 3,
    detecta: (h) => {
      if (!/<(?:button|a)[\s>]/i.test(h)) return false;
      AZULES_DEFECTO.lastIndex = 0;
      return AZULES_DEFECTO.test(h);
    }
  },
  {
    id: "tres-tarjetas",
    nombre: "Tres tarjetas gemelas",
    motivo: "tres tarjetas iguales debajo del hero es el patr\xF3n m\xE1s repetido de la IA: rellena el hueco en vez de explicar",
    alternativa: "m\xF3dulos asim\xE9tricos, una lista editorial o la representaci\xF3n que merecen esos datos (timeline, mapa, nodos)",
    gravedad: 2,
    detecta: (h) => {
      const rejilla = /grid-template-columns\s*:[^;}]*\b(?:1fr\s*){3}/i.test(h) || /grid-cols-3/i.test(h) || /repeat\(\s*3\s*,\s*minmax\(0(?:px)?,\s*1fr\)\)/i.test(h);
      if (!rejilla) return false;
      const tarjetas = (h.match(/class="[^"]*(?:card|feature|benefic|servic)[^"]*"/gi) ?? []).length;
      const articulos = (h.match(/<article[\s>]/gi) ?? []).length;
      return tarjetas >= 3 || articulos >= 3;
    }
  },
  {
    id: "fondo-degradado",
    nombre: "Fondo degradado",
    motivo: "el gradiente de fondo para \xABdar vida\xBB es decoraci\xF3n sin idea: el color debe ser lenguaje, no tapete",
    alternativa: "superficies planas con contraste real; si hace falta un degradado, que sea sutil y con funci\xF3n (profundidad, foco)",
    gravedad: 1,
    detecta: (h) => /(?:background(?:-image)?|bg)\s*:\s*(?:linear|radial)-gradient/i.test(h) || /bg-gradient-to-(?:r|b|br|tr)/i.test(h)
  },
  {
    id: "blobs-decorativos",
    nombre: "Blobs decorativos",
    motivo: "c\xEDrculos difuminados flotando de fondo: el ornamento gen\xE9rico de las landings de IA desde 2022",
    alternativa: "espacio negativo generoso; si la p\xE1gina necesita una forma, que tenga funci\xF3n (contener, separar, se\xF1alar)",
    gravedad: 2,
    detecta: (h) => {
      const clase = /class="[^"]*blob[^"]*"|\.blob\b|--blob/i.test(h);
      const circulosBlur = /border-radius\s*:\s*50(?:%|\s)|border-radius\s*:\s*9999px/i.test(h) && /filter\s*:\s*blur\(/i.test(h);
      const radialFondo = /background(?:-image)?\s*:[^;}]*radial-gradient[^;}]*(?:circle|50%)/i.test(h) && /position\s*:\s*absolute/i.test(h);
      return clase || circulosBlur || radialFondo;
    }
  },
  {
    id: "glassmorphism-excesivo",
    nombre: "Glassmorphism en exceso",
    motivo: "tres o m\xE1s superficies con desenfoque: el efecto est\xE1 sustituyendo a la composici\xF3n",
    alternativa: "profundidad por bordes, sombras de dos capas y contraste de superficie; el vidrio, si acaso, en UNA superficie",
    gravedad: 2,
    detecta: (h) => (h.match(/backdrop-filter\s*:/gi) ?? []).length >= 3
  },
  {
    id: "dashboard-cajitas",
    nombre: "Dashboard de cajitas",
    motivo: "sidebar + KPIs en fila + gr\xE1fico + tabla: el dashboard que describiste (\xABcajitas\xBB) sin preguntar qu\xE9 merece el dato",
    alternativa: "antes de maquetar, elegir la representaci\xF3n de la informaci\xF3n (timeline, mapa, nodos, capas\u2026) y dejar que los componentes sirvan a esa representaci\xF3n",
    gravedad: 3,
    detecta: (h) => {
      const senales = [
        /class="[^"]*(?:sidebar|sidenav|aside-nav)[^"]*"|<aside[\s>]/i,
        /class="[^"]*(?:kpi|stat-card|metric|stat)[^"]*"/i,
        /<table[\s>]/i,
        /class="[^"]*(?:chart|graph|spark)[^"]*"|<canvas[\s>]|<svg[^>]*(?:chart|graph)/i,
        /class="[^"]*(?:dashboard|panel-grid|widgets)[^"]*"/i
      ];
      return senales.filter((s) => s.test(h)).length >= 3;
    }
  }
];
function nivelDe(sintomas) {
  if (sintomas.length >= 4) return "alto";
  if (sintomas.length >= 2) return "medio";
  return "bajo";
}
function detectarGenericidad(html) {
  if (!html || html.length < 60) {
    return {
      sintomas: [],
      nivel: "bajo",
      motivo: MOTIVOS_NIVEL.bajo,
      puntuacionIdentidad: 100,
      recordatorio: CATALOGO_ANTIPATRONES.map((s) => s.nombre)
    };
  }
  const sintomas = [];
  for (const d of defs) {
    let ok = false;
    try {
      ok = d.detecta(html);
    } catch {
      ok = false;
    }
    if (ok) {
      sintomas.push({
        id: d.id,
        nombre: d.nombre,
        motivo: d.motivo,
        alternativa: d.alternativa,
        gravedad: d.gravedad
      });
    }
  }
  sintomas.sort((a, b) => b.gravedad - a.gravedad);
  const nivel2 = nivelDe(sintomas);
  const penal = sintomas.reduce((s, x) => s + x.gravedad * 12, 0);
  const detectados = new Set(sintomas.map((s) => s.id));
  return {
    sintomas,
    nivel: nivel2,
    motivo: MOTIVOS_NIVEL[nivel2],
    puntuacionIdentidad: Math.max(20, 100 - penal),
    recordatorio: defs.filter((d) => !detectados.has(d.id)).map((d) => d.nombre)
  };
}
var CATALOGO_ANTIPATRONES = defs.map((d) => ({ id: d.id, nombre: d.nombre, alternativa: d.alternativa }));
function textoInformeAntiGenerico(informe) {
  if (informe.sintomas.length === 0) {
    return `### Anti-gen\xE9rico \u2705
Sin s\xEDntomas de plantilla: la p\xE1gina se lee como un proyecto con identidad propia (${informe.puntuacionIdentidad}/100).`;
  }
  const nivel2 = informe.nivel.toUpperCase();
  const lineas = informe.sintomas.map((s) => `- \u274C **${s.nombre}** \u2014 ${s.motivo}.`);
  const alternativas = informe.sintomas.map((s) => `- **${s.nombre}** \u2192 ${s.alternativa}`);
  return `### Anti-gen\xE9rico \xB7 PATR\xD3N DETECTADO

${lineas.join("\n")}

**Nivel de saturaci\xF3n: ${nivel2}** (${informe.puntuacionIdentidad}/100 de identidad)

**Motivo:** ${informe.motivo}

**C\xF3mo salir del patr\xF3n:**
${alternativas.join("\n")}`;
}
function seccionAntiGenerico() {
  const lista = defs.map((d) => `- ${d.nombre} \u2192 en su lugar: ${d.alternativa}`).join("\n");
  return `# Anti-gen\xE9rico (OBLIGATORIO en todo el dise\xF1o)
Estos patrones delatan una interfaz generada por IA. Est\xE1n PROHIBIDOS incluso
si la ficha no lo menciona; si el resultado los contiene, el Revisor lo
cuenta como defecto y el Juez de Originalidad lo penaliza:
${lista}
Regla de oro: primero decide c\xF3mo REPRESENTAR la informaci\xF3n de este negocio,
despu\xE9s elige los componentes. Un dise\xF1o con identidad no es \xABbonito\xBB: es
reconocible como ESTE proyecto.`;
}
function resumenAntiGenerico(informe) {
  if (informe.sintomas.length === 0) return `Anti-gen\xE9rico: limpio (${informe.puntuacionIdentidad}/100)`;
  const nombres = informe.sintomas.map((s) => s.nombre).join(", ");
  return `Anti-gen\xE9rico: saturaci\xF3n ${informe.nivel.toUpperCase()} \u2014 ${nombres}`;
}

// src/lib/prism/forja/cache-fichas.ts
function hashTexto(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function normaliza(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}
function claveFicha(p, cfg) {
  const partes = [
    VERSION_FORJA,
    normaliza(p.mensaje),
    hashTexto(p.codigoActual ?? ""),
    (p.reglasAprendidas ?? []).map(normaliza).join("|"),
    (p.conocimientoGlobal ?? []).map(normaliza).join("|"),
    [...cfg.habilidades ?? []].sort().join("|"),
    cfg.perfil ?? "equilibrado",
    String(rondasDePerfil(cfg)),
    cfg.maquetaPrimero === false ? "sin-maqueta" : "con-maqueta"
  ];
  return `ficha:${hashTexto(partes.join(""))}`;
}
function claveMaqueta(p, fichaTexto) {
  return `maqueta:${hashTexto(`${VERSION_FORJA}${normaliza(p.mensaje)}${hashTexto(p.codigoActual ?? "")}${hashTexto(fichaTexto)}`)}`;
}
function crearCacheMemoria(tamano = 24, maxBytesValor = 5e5) {
  const mapa = /* @__PURE__ */ new Map();
  const stats = { entradas: 0, aciertos: 0, escrituras: 0, expulsiones: 0 };
  return {
    obtener(clave2) {
      const v = mapa.get(clave2);
      if (v == null) return null;
      mapa.delete(clave2);
      mapa.set(clave2, v);
      stats.aciertos += 1;
      return v;
    },
    guardar(clave2, valor) {
      if (valor.length > maxBytesValor) return;
      if (mapa.has(clave2)) mapa.delete(clave2);
      mapa.set(clave2, valor);
      stats.escrituras += 1;
      while (mapa.size > tamano) {
        const masVieja = mapa.keys().next().value;
        if (masVieja == null) break;
        mapa.delete(masVieja);
        stats.expulsiones += 1;
      }
      stats.entradas = mapa.size;
    },
    stats() {
      return { ...stats, entradas: mapa.size };
    }
  };
}
function resumenCache(c) {
  const s = c.stats();
  return `cach\xE9 ${s.entradas} entrada(s) \xB7 ${s.aciertos} acierto(s) \xB7 ${s.escrituras} escritura(s)` + (s.expulsiones ? ` \xB7 ${s.expulsiones} expulsi\xF3n(es)` : "");
}
function cacheEnCascada(a, b) {
  return {
    obtener(clave2) {
      const va = a.obtener(clave2);
      if (va != null) return va;
      const vb = b.obtener(clave2);
      if (vb != null) a.guardar(clave2, vb);
      return vb;
    },
    guardar(clave2, valor) {
      a.guardar(clave2, valor);
      b.guardar(clave2, valor);
    },
    stats() {
      return a.stats();
    }
  };
}

// src/lib/prism/forja/experience-dna.ts
var SENALES = [
  {
    re: /\b(3d|webgl|three\.?js|objeto 3d|modelo 3d)\b/i,
    nota: "petici\xF3n expl\xEDcita de 3D",
    aplica: (e) => {
      e.spatial.mode = "3d";
      e.spatial.depth = 0.9;
      e.spatial.layers = 6;
      e.spatial.perspective = 0.85;
      e.object.use3d = true;
      e.object.heroType = e.object.heroType === "tipografico" ? "objeto-central" : e.object.heroType;
      e.object.visualWeight = 0.9;
      e.motion.intensity = Math.max(e.motion.intensity, 0.8);
      e.surface.elevation = Math.max(e.surface.elevation, 0.7);
    }
  },
  {
    re: /\b(inmersiv|immersiv|experiencia|recorrido|tour|escena)\w*/i,
    nota: "experiencia inmersiva",
    aplica: (e) => {
      e.spatial.mode = "immersive";
      e.spatial.depth = Math.max(e.spatial.depth, 0.85);
      e.spatial.layers = Math.max(e.spatial.layers, 6);
      e.motion.intensity = Math.max(e.motion.intensity, 0.85);
      e.motion.scroll = true;
      e.motion.parallax = true;
    }
  },
  {
    re: /\b(saas|startup|software|plataforma|app web|producto digital|fintech)\b/i,
    nota: "producto SaaS: superficies flotantes y UI superpuesta",
    aplica: (e) => {
      e.spatial.mode = e.spatial.mode === "flat" ? "2.5d" : e.spatial.mode;
      e.spatial.depth = Math.max(e.spatial.depth, 0.7);
      e.spatial.layers = Math.max(e.spatial.layers, 5);
      e.surface.radius = "28px";
      e.surface.elevation = Math.max(e.surface.elevation, 0.65);
      e.surface.blur = Math.max(e.surface.blur, 0.35);
      e.object.heroType = "ui-producto";
      e.object.visualWeight = Math.max(e.object.visualWeight, 0.7);
      e.interaction.expandable = true;
    }
  },
  {
    re: /\b(portfolio|portafolio|estudio creativo|creative studio|fotograf|galer[ií]a|arquitectura|moda|fashion)\b/i,
    nota: "portfolio/estudio: lienzo oscuro, tipograf\xEDa enorme, objeto central",
    aplica: (e) => {
      e.spatial.mode = e.spatial.mode === "flat" ? "2.5d" : e.spatial.mode;
      e.spatial.depth = Math.max(e.spatial.depth, 0.75);
      e.visual.contrast = Math.max(e.visual.contrast, 0.85);
      e.visual.density = Math.min(e.visual.density, 0.35);
      e.composition.negativeSpace = Math.max(e.composition.negativeSpace, 0.7);
      e.object.heroType = "objeto-central";
      e.object.visualWeight = Math.max(e.object.visualWeight, 0.85);
      e.motion.parallax = true;
    }
  },
  {
    re: /\b(premium|lujo|exclusiv|elegan|sofisticad)\w*/i,
    nota: "intenci\xF3n premium: aire, contraste y acabado",
    aplica: (e) => {
      e.visual.contrast = Math.max(e.visual.contrast, 0.8);
      e.composition.negativeSpace = Math.max(e.composition.negativeSpace, 0.65);
      e.surface.elevation = Math.max(e.surface.elevation, 0.6);
      e.surface.border = "1px sutil";
    }
  },
  {
    re: /\b(modern|moderno|futurist|futurista|tecnolog|tech|innovad)\w*/i,
    nota: "intenci\xF3n moderna/tecnol\xF3gica",
    aplica: (e) => {
      e.spatial.mode = e.spatial.mode === "flat" ? "2.5d" : e.spatial.mode;
      e.spatial.depth = Math.max(e.spatial.depth, 0.6);
      e.motion.entrance = true;
      e.motion.hover = true;
      e.interaction.richness = Math.max(e.interaction.richness, 0.6);
    }
  },
  {
    re: /\b(animad|animated|movimiento|motion|parallax|dinamic|dinámico)\w*/i,
    nota: "petici\xF3n expl\xEDcita de movimiento",
    aplica: (e) => {
      e.motion.intensity = Math.max(e.motion.intensity, 0.75);
      e.motion.scroll = true;
      e.motion.parallax = true;
      e.motion.entrance = true;
    }
  },
  {
    re: /\b(interactiv|interactiva|interactivo|interacción|interaccion|hover|magnetic|magn[eé]tic|tilt)\w*/i,
    nota: "petici\xF3n expl\xEDcita de interacci\xF3n",
    aplica: (e) => {
      e.interaction.richness = Math.max(e.interaction.richness, 0.8);
      e.interaction.magnetic = true;
      e.interaction.tilt = true;
      e.motion.hover = true;
    }
  },
  {
    re: /\b(cinemat|cinematográf|cinematic|pelicul|film|dramatic|dramático)\w*/i,
    nota: "intenci\xF3n cinematogr\xE1fica",
    aplica: (e) => {
      e.motion.intensity = Math.max(e.motion.intensity, 0.8);
      e.motion.scroll = true;
      e.composition.negativeSpace = Math.max(e.composition.negativeSpace, 0.6);
      e.object.heroType = e.object.heroType === "objeto-central" ? e.object.heroType : "escena";
      e.object.visualWeight = Math.max(e.object.visualWeight, 0.8);
    }
  },
  {
    re: /\b(dashboard|panel|admin|analitic|m[eé]tric|datos?)\b/i,
    nota: "contenido de datos: densidad y foco utilitario",
    aplica: (e) => {
      e.visual.density = Math.max(e.visual.density, 0.6);
      e.composition.structure = "ret\xEDcula t\xE9cnica";
      e.spatial.layers = Math.max(e.spatial.layers, 3);
    }
  },
  {
    re: /\b(blog|revista|magazine|art[ií]culo|noticias?|editorial|publicaci[óo]n)\b/i,
    nota: "intenci\xF3n editorial leg\xEDtima (doc \xA723): aqu\xED editorial S\xCD manda",
    aplica: (e) => {
      e.spatial.mode = "flat";
      e.spatial.depth = Math.min(e.spatial.depth, 0.2);
      e.visual.density = Math.max(e.visual.density, 0.55);
      e.motion.intensity = Math.min(e.motion.intensity, 0.3);
      e.object.heroType = "tipografico";
    }
  },
  {
    re: /\b(restaurante|bar|cafeter|tienda|ecommerce|e-commerce|tienda online|panader|pizz|helader|pasteler|florister|carnicer|pescader|boutique|bodega|hostal|hotel|gimnas|gym|barber|peluquer|est[eé]tic|tattoo|tatuaj|taller|taller|estudio fotogr[aá]f|autolavado|ferreter|mercado|supermercado|negocio local)\w*/i,
    nota: "vertical comercial local: producto visible, superficies elevadas y carta/cat\xE1logo",
    aplica: (e) => {
      e.object.heroType = e.object.heroType === "tipografico" ? "producto" : e.object.heroType;
      e.object.visualWeight = Math.max(e.object.visualWeight, 0.6);
      e.surface.radius = "20px";
      e.surface.elevation = Math.max(e.surface.elevation, 0.55);
      e.spatial.mode = e.spatial.mode === "flat" ? "2.5d" : e.spatial.mode;
      e.spatial.depth = Math.max(e.spatial.depth, 0.5);
      e.interaction.expandable = true;
      e.motion.hover = true;
      e.motion.entrance = true;
    }
  }
];
function experienciaPorDefecto() {
  return {
    visual: { palette: "dominante + un acento + neutros con matiz", typography: "display + texto, contraste de peso", contrast: 0.7, density: 0.45 },
    composition: { structure: "ret\xEDcula con rompimientos intencionales", asymmetry: 0.55, focalPoint: "un focal por pantalla", negativeSpace: 0.6 },
    spatial: { mode: "flat", depth: 0.25, layers: 2, perspective: 0.15 },
    motion: { intensity: 0.3, scroll: false, parallax: false, hover: true, entrance: true },
    interaction: { richness: 0.4, magnetic: false, tilt: false, expandable: false },
    surface: { radius: "16px", elevation: 0.35, blur: 0.1, border: "1px sutil" },
    object: { heroType: "tipografico", use3d: false, visualWeight: 0.4 }
  };
}
function clonarExperiencia(e) {
  return JSON.parse(JSON.stringify(e));
}
function sintetizarExperienciaDna(mensaje) {
  const dna = experienciaPorDefecto();
  const m = (mensaje || "").toLowerCase();
  const razones = [];
  for (const s of SENALES) {
    try {
      if (s.re.test(m)) {
        s.aplica(dna);
        razones.push(s.nota);
      }
    } catch {
    }
  }
  if (dna.object.use3d && /\b(blog|revista|art[ií]culo|noticias?)\b/i.test(m)) {
    dna.object.use3d = false;
    razones.push("conflicto resuelto: contenido editorial manda, el 3D se limita al hero");
  }
  return { dna, razones: razones.slice(0, 6) };
}
var pct = (n) => `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
function seccionExperienciaDna(e) {
  return [
    `# EXPERIENCE DNA (contrato obligatorio de la experiencia)`,
    `visual: ${e.visual.palette}; ${e.visual.typography}; contraste ${pct(e.visual.contrast)}; densidad ${pct(e.visual.density)}`,
    `composition: ${e.visual.palette ? e.composition.structure : ""}; asimetr\xEDa ${pct(e.composition.asymmetry)}; foco: ${e.composition.focalPoint}; aire ${pct(e.composition.negativeSpace)}`,
    `spatial: modo ${e.spatial.mode}; profundidad ${pct(e.spatial.depth)}; capas ${e.spatial.layers}; perspectiva ${pct(e.spatial.perspective)}`,
    `motion: intensidad ${pct(e.motion.intensity)}; scroll ${siNo(e.motion.scroll)}; parallax ${siNo(e.motion.parallax)}; hover ${siNo(e.motion.hover)}; entrada ${siNo(e.motion.entrance)}`,
    `interaction: riqueza ${pct(e.interaction.richness)}; magnetic ${siNo(e.interaction.magnetic)}; tilt ${siNo(e.interaction.tilt)}; expandible ${siNo(e.interaction.expandable)}`,
    `surface: radius ${e.surface.radius}; elevaci\xF3n ${pct(e.surface.elevation)}; blur ${pct(e.surface.blur)}; borde ${e.surface.border}`,
    `object: hero ${e.object.heroType}; 3D ${siNo(e.object.use3d)}; peso visual ${pct(e.object.visualWeight)}`
  ].join("\n");
}
function resumenExperienciaDna(e) {
  return `spatial=${e.spatial.mode} depth=${pct(e.spatial.depth)} capas=${e.spatial.layers} motion=${pct(e.motion.intensity)} interacci\xF3n=${pct(e.interaction.richness)} hero=${e.object.heroType}${e.object.use3d ? "+3d" : ""}`;
}
function siNo(b) {
  return b ? "s\xED" : "no";
}

// src/lib/prism/forja/familias-experiencia.ts
var FAMILIAS = [
  {
    id: "spatial",
    nombre: "Espacial",
    descripcion: "la p\xE1gina es un espacio por capas: fondo, ret\xEDcula, tipograf\xEDa, objeto y UI flotante con profundidad real",
    cuando: /\b(3d|espacial|spatial|capas|profundidad|parallax|perspectiva|escena)\b/i,
    paraQue: "entender un producto u obra mir\xE1ndolo desde fuera, como una maqueta viva",
    riesgo: "el exceso de capas dispersa: cada capa debe ganarse su z-index"
  },
  {
    id: "immersive",
    nombre: "Inmersiva",
    descripcion: "el usuario DENTRO de la experiencia: scroll que avanza por escenas, canvas dominante, navegaci\xF3n m\xEDnima",
    cuando: /\b(inmersiv|immersiv|experiencia|recorrido|tour|museo|exposici[óo]n|historia interactiva)\b/i,
    paraQue: "vivir un relato o un lugar, no leer una lista de caracter\xEDsticas",
    riesgo: "funciona mal con mucho contenido: acotar la escena"
  },
  {
    id: "product",
    nombre: "Producto",
    descripcion: "el PRODUCTO es el h\xE9roe: UI real flotante, capturas vivas, composici\xF3n asim\xE9trica alrededor del objeto",
    cuando: /\b(saas|startup|app|software|plataforma|producto|fintech|demo)\b/i,
    paraQue: "ver QU\xC9 compra el usuario antes de leer c\xF3mo funciona",
    riesgo: "capturas decorativas sin dato real parecen maquetas vac\xEDas"
  },
  {
    id: "cinematic",
    nombre: "Cinematogr\xE1fica",
    descripcion: "secuencia de planos con ritmo: pantallas completas, tipograf\xEDa enorme, coreograf\xEDa de scroll",
    cuando: /\b(cinemat|cinematic|dramatic|dramático|pelicul|film|epic|[eé]pico|impacto)\b/i,
    paraQue: "contar una historia con ritmo: apertura, desarrollo, cierre con acci\xF3n",
    riesgo: "el ritmo puede sacrificar densidad de contenido"
  },
  {
    id: "interactive",
    nombre: "Interactiva",
    descripcion: "la interacci\xF3n ES el contenido: paneles vivos, tarjetas magn\xE9ticas, tilt, estados que responden a todo",
    cuando: /\b(interactiv|interactiva|interactivo|interacci[óo]n|hover|magnetic|magn[eé]tic|tilt|responsive)\b/i,
    paraQue: "explorar tocando: cada respuesta refuerza el mensaje",
    riesgo: "m\xE1s feedback que contenido: la interacci\xF3n necesita carne"
  },
  {
    id: "3d-showcase",
    nombre: "Escaparate 3D",
    descripcion: "un objeto 3D central (producto, pieza, edificio) que se puede mirar, girar y acercar",
    cuando: /\b(3d|objeto 3d|modelo 3d|webgl|three|showcase|escaparate|producto 3d|automoci[óo]n|automotive|gaming)\b/i,
    paraQue: "inspeccionar el objeto de verdad: rotar, acercar, ver el detalle",
    riesgo: "peso y rendimiento: si el objeto no aporta, 2.5D basta"
  },
  {
    id: "modular",
    nombre: "Modular",
    descripcion: "m\xF3dulos asim\xE9tricos de distinto peso: lo importante mide m\xE1s, la ret\xEDcula se rompe con intenci\xF3n",
    cuando: /\b(portfolio|galer[ií]a|mosaico|bento|agencia|estudio|destacad|modular)\b/i,
    paraQue: "comparar piezas por peso real, no por orden de lista",
    riesgo: "mosaico mon\xF3tono si todos los m\xF3dulos acaban iguales"
  },
  {
    id: "editorial",
    nombre: "Editorial",
    descripcion: "estructura de publicaci\xF3n: jerarqu\xEDa tipogr\xE1fica fuerte, columna de lectura, margen que comenta",
    cuando: /\b(blog|revista|magazine|art[ií]culo|noticias?|editorial|publicaci[óo]n|journal|peri[óo]dico|ensayo)\b/i,
    paraQue: "leer con orden: el argumento es el producto",
    riesgo: "es la familia por defecto de todo generador mediocre: solo con intenci\xF3n editorial real"
  },
  {
    id: "minimal",
    nombre: "Minimal",
    descripcion: "menos elementos, m\xE1s precisi\xF3n: aire generoso, tipograf\xEDa protagonista, una acci\xF3n por pantalla",
    cuando: /\b(minimal|minimalista|simple|limpio|sobrio|auster|silencios)\b/i,
    paraQue: "decidir r\xE1pido sin ruido",
    riesgo: "vac\xEDo sin contenido se lee como plantilla sin terminar"
  },
  {
    id: "dashboard",
    nombre: "Dashboard",
    descripcion: "densidad alta gobernada: KPIs, gr\xE1ficos y tablas con jerarqu\xEDa clara y decoraci\xF3n cero",
    cuando: /\b(dashboard|panel de control|admin|anal[ií]tic|m[eé]tricas?|datos|report|informe)\b/i,
    paraQue: "operar: comparar, decidir y actuar con datos a la vista",
    riesgo: "el \xABdashboard de cajitas\xBB sin narrativa: prohibido por el ADN"
  }
];
function familiaPorId(id) {
  return FAMILIAS.find((f) => f.id === id);
}
var VERTICALES = [
  { id: "saas", cuando: /\b(saas|startup|software|plataforma|app web)\b/i },
  { id: "portfolio", cuando: /\b(portfolio|portafolio|galer[ií]a|fotograf)\b/i },
  { id: "restaurante", cuando: /\b(restaurante|bar|cafeter[íi]a|pizzer|sushi)\b/i },
  { id: "agencia", cuando: /\b(agencia|agencia de dise[ñn]o|estudio creativo)\b/i },
  { id: "fintech", cuando: /\b(fintech|banca|banco|inversi[óo]n|cripto)\b/i },
  { id: "ia", cuando: /\b(ia|inteligencia artificial|ai|machine learning|llm)\b/i },
  { id: "ecommerce", cuando: /\b(tienda|ecommerce|e-commerce|venta|shop)\b/i },
  { id: "arquitectura", cuando: /\b(arquitectura|arquitecto|construccio|construcci[óo]n|interiorismo)\b/i },
  { id: "moda", cuando: /\b(moda|fashion|ropa|vestido|marca de ropa)\b/i },
  { id: "educacion", cuando: /\b(curso|educaci[óo]n|escuela|academia|formaci[óo]n)\b/i },
  // v4.7 — VERTICALES LOCALES. Estaban en la señal comercial de
  // experience-dna.ts desde v4.6 y el LEEME prometía cubrirlos, pero esta
  // tabla —la que de verdad decide el vertical y la familia de respaldo— no
  // los tenía: una panadería caía en «general» → familia «minimal». Justo
  // el caso que la v4.6 decía haber resuelto.
  {
    id: "local",
    cuando: /\b(panader|pasteler|pizzer|helader|carnicer|pescader|florister|boutique|barber|peluquer|est[ée]tic|tatuaj|tattoo|taller|ferreter|gimnas|gym|autolavado|hostal|cl[íi]nica|dentista|veterinar|abogad|gestor[íi]a|fontaner|electricist|cerrajer|mudanz|negocio local)\w*/i
  }
];
var SENALES_MODERNAS = /\b(modern|moderno|premium|futurist|futurista|3d|inmersiv|immersiv|interactiv|interactivo|creativ|creativo|tecnolog|visual|animad|animated|wow|espectacular|innovador)\b/i;
var SENALES_EDITORIALES = /\b(blog|revista|magazine|art[ií]culo|noticias?|publicaci[óo]n|journal|peri[óo]dico|editorial|ensayo|columna)\b/i;
function seleccionarFamilia(mensaje) {
  const m = (mensaje || "").toLowerCase();
  const razones = [];
  const puntos = /* @__PURE__ */ new Map();
  let mejor = "minimal";
  let mejorPuntos = -1;
  for (const f of FAMILIAS) {
    const rx = new RegExp(f.cuando.source, f.cuando.flags.includes("g") ? f.cuando.flags : f.cuando.flags + "g");
    const matches = m.match(rx) ?? [];
    if (!matches.length) continue;
    const p = matches.length + (matches[0]?.length ?? 0) / 1e3;
    puntos.set(f.id, (puntos.get(f.id) ?? 0) + p);
    if (p > mejorPuntos) {
      mejor = f.id;
      mejorPuntos = p;
    }
  }
  if (mejorPuntos > 0) {
    razones.push(`se\xF1ales de intenci\xF3n apuntan a \xAB${familiaPorId(mejor)?.nombre ?? mejor}\xBB`);
  }
  const vertical = VERTICALES.find((v) => v.cuando.test(m))?.id ?? "general";
  const pideModerna = SENALES_MODERNAS.test(m);
  const pideEditorial = SENALES_EDITORIALES.test(m);
  if (pideModerna) {
    razones.push("el brief pide experiencia moderna: spatial/product/cinematic/interactive/3d antes que editorial (doc \xA723)");
    if (mejor === "editorial" && !pideEditorial) {
      mejor = "spatial";
      mejorPuntos = Math.max(mejorPuntos, 0.5);
      razones.push("editorial descartada: las se\xF1ales modernas no vienen acompa\xF1adas de intenci\xF3n editorial");
    }
    if (mejorPuntos <= 0) {
      mejor = "spatial";
      razones.push("sin familia dominante: spatial como lectura moderna por defecto del brief");
    }
  }
  if (mejorPuntos <= 0) {
    mejor = vertical === "general" ? "minimal" : vertical === "local" ? "spatial" : "modular";
    razones.push(`sin se\xF1ales claras: \xAB${mejor}\xBB como base neutra para ${vertical}`);
  }
  if (mejor === "editorial" && !pideEditorial) {
    mejor = "modular";
    razones.push("editorial exige intenci\xF3n editorial expl\xEDcita: sustituida por modular");
  }
  let alternativa = "modular";
  let segundoPuntos = -1;
  for (const [id, p] of puntos) {
    if (id === mejor) continue;
    if (p > segundoPuntos) {
      alternativa = id;
      segundoPuntos = p;
    }
  }
  if (segundoPuntos <= 0) {
    const contrastes = {
      spatial: "product",
      immersive: "cinematic",
      product: "spatial",
      cinematic: "immersive",
      interactive: "product",
      "3d-showcase": "spatial",
      modular: "spatial",
      editorial: "minimal",
      minimal: "modular",
      dashboard: "product"
    };
    alternativa = contrastes[mejor] ?? "modular";
  }
  const confianza = Math.max(0, Math.min(1, mejorPuntos / 4));
  return { familia: mejor, alternativa, vertical, confianza, razones: razones.slice(0, 5) };
}
function seccionFamilias(sel) {
  const cat = FAMILIAS.map((f) => `- ${f.nombre} (${f.id}): ${f.descripcion}`).join("\n");
  const elegida = familiaPorId(sel.familia);
  return [
    `# FAMILIA DE EXPERIENCIA (decidida por intenci\xF3n, doc \xA71/\xA73/\xA723)`,
    `Vertical: ${sel.vertical} \xB7 Familia elegida: ${elegida.nombre} (${elegida.id}) \xB7 Explora tambi\xE9n: ${sel.alternativa}`,
    `Por qu\xE9: ${sel.razones.join("; ") || "decisi\xF3n por defecto neutra"}`,
    `Qu\xE9 debe producir: ${elegida.descripcion} \u2014 para que ${elegida.paraQue}.`,
    `Riesgo a controlar: ${elegida.riesgo}`,
    `REGLA \xA723: si el brief pide moderno/premium/futurista/3D/inmersivo/interactivo, NO propongas editorial; editorial solo para blog/magazine/art\xEDculo/noticias/publicaci\xF3n.`,
    `Cat\xE1logo de familias (por si la fusi\xF3n hibrida):`,
    cat
  ].join("\n");
}

// src/lib/prism/forja/experience-recipes.ts
var RECETAS = [
  {
    id: "spatial_product",
    nombre: "SPATIAL_PRODUCT",
    familias: ["spatial", "product"],
    cuando: /\b(producto|saas|espacial|3d|capas|fisic|hardware|gadget)\b/i,
    hero: { tipo: "HERO_SPATIAL", pesoVisual: "alta" },
    composicion: { asimetrica: true, profundidad: "alta", capas: 4 },
    superficies: { redondeo: "alto", floatingCards: true, elevacion: "media" },
    motion: { parallax: true, reveal: true, float: true, hover: true },
    interaccion: { magneticCta: "opcional", tiltCards: "opcional" },
    objeto: { tipo: "producto-o-objeto-3d" },
    navegacion: {}
  },
  {
    id: "cinematic_product",
    nombre: "CINEMATIC_PRODUCT",
    familias: ["cinematic", "immersive"],
    cuando: /\b(cinemat|pelicul|film|epic|[eé]pico|historia|lanza|release|automoci[óo]n)\b/i,
    hero: { tipo: "HERO_FULLSCREEN", pesoVisual: "alta" },
    composicion: { asimetrica: false, profundidad: "alta", capas: 4, fullscreen: true, escalaTipografica: "enorme" },
    superficies: { redondeo: "medio", floatingCards: false, elevacion: "baja" },
    motion: { parallax: true, reveal: true, float: false, hover: false, scrollScenes: true, cameraMovement: "opcional" },
    interaccion: { magneticCta: "no", tiltCards: "no" },
    objeto: { tipo: "escena" },
    navegacion: { minimal: true }
  },
  {
    id: "immersive_portfolio",
    nombre: "IMMERSIVE_PORTFOLIO",
    familias: ["immersive", "modular"],
    cuando: /\b(portfolio|portafolio|estudio|fotograf|arquitectura|obra|proyecto)\b/i,
    hero: { tipo: "HERO_3D_OBJECT", pesoVisual: "alta" },
    composicion: { asimetrica: true, profundidad: "alta", capas: 5, escalaTipografica: "enorme", reticula: "t\xE9cnica" },
    superficies: { redondeo: "bajo", floatingCards: false, elevacion: "media" },
    motion: { parallax: true, reveal: true, float: false, hover: true, scrollScenes: true },
    interaccion: { magneticCta: "no", tiltCards: "no", hoverTransform: true, projectReveal: true },
    objeto: { tipo: "objeto-3d" },
    navegacion: { minimal: true, tecnica: true }
  },
  {
    id: "interactive_saas",
    nombre: "INTERACTIVE_SAAS",
    familias: ["interactive", "product"],
    cuando: /\b(saas|startup|app|plataforma|software|dashboard|workflow|flujo)\b/i,
    hero: { tipo: "HERO_PRODUCT", pesoVisual: "media" },
    composicion: { asimetrica: true, profundidad: "media", capas: 4 },
    superficies: { redondeo: "alto", floatingCards: true, elevacion: "media" },
    motion: { parallax: false, reveal: true, float: true, hover: true, stagger: true },
    interaccion: { magneticCta: "opcional", tiltCards: "opcional", hoverTransform: true },
    objeto: { tipo: "ui-producto" },
    navegacion: {}
  },
  {
    id: "3d_showcase",
    nombre: "3D_SHOWCASE",
    familias: ["3d-showcase", "spatial"],
    cuando: /\b(3d|webgl|modelo 3d|objeto 3d|escaparate|showroom|gaming|automotive)\b/i,
    hero: { tipo: "HERO_3D_OBJECT", pesoVisual: "alta" },
    composicion: { asimetrica: true, profundidad: "alta", capas: 6, escalaTipografica: "grande" },
    superficies: { redondeo: "medio", floatingCards: true, elevacion: "alta" },
    motion: { parallax: true, reveal: true, float: true, hover: true, scrollScenes: true },
    interaccion: { magneticCta: "opcional", tiltCards: "s\xED" },
    objeto: { tipo: "objeto-3d" },
    navegacion: { minimal: true }
  },
  {
    id: "creative_studio",
    nombre: "CREATIVE_STUDIO",
    familias: ["immersive", "cinematic"],
    cuando: /\b(estudio creativo|agencia|creative studio|branding|direcci[óo]n de arte)\b/i,
    hero: { tipo: "HERO_CINEMATIC", pesoVisual: "alta" },
    composicion: { asimetrica: true, profundidad: "alta", capas: 5, escalaTipografica: "enorme", reticula: "libre" },
    superficies: { redondeo: "medio", floatingCards: false, elevacion: "media" },
    motion: { parallax: true, reveal: true, float: false, hover: true, scrollScenes: true, cameraMovement: "opcional" },
    interaccion: { magneticCta: "s\xED", tiltCards: "opcional", hoverTransform: true },
    objeto: { tipo: "escena" },
    navegacion: { minimal: true, tecnica: true }
  },
  {
    id: "modern_minimal",
    nombre: "MODERN_MINIMAL",
    familias: ["minimal", "product"],
    cuando: /\b(minimal|simple|limpio|sobrio|auster|silencioso|claro)\b/i,
    hero: { tipo: "HERO_MINIMAL", pesoVisual: "media" },
    composicion: { asimetrica: true, profundidad: "baja", capas: 3, escalaTipografica: "grande" },
    superficies: { redondeo: "alto", floatingCards: false, elevacion: "baja" },
    motion: { parallax: false, reveal: true, float: false, hover: true },
    interaccion: { magneticCta: "no", tiltCards: "no", hoverTransform: true },
    objeto: { tipo: "tipografia" },
    navegacion: {}
  }
];
function recetaPorId(id) {
  return RECETAS.find((r) => r.id === id);
}
function fallbackReceta(familia) {
  const mapa = {
    spatial: "spatial_product",
    immersive: "cinematic_product",
    product: "interactive_saas",
    cinematic: "cinematic_product",
    interactive: "interactive_saas",
    "3d-showcase": "3d_showcase",
    modular: "immersive_portfolio",
    editorial: "modern_minimal",
    minimal: "modern_minimal",
    dashboard: "interactive_saas"
  };
  return mapa[familia];
}
function recetaParaFamilia(familia, mensaje = "") {
  const m = (mensaje || "").toLowerCase();
  const compatibles = RECETAS.filter((r) => r.familias.includes(familia));
  const candidatos = compatibles.length ? compatibles : RECETAS.filter((r) => r.id === fallbackReceta(familia));
  const puntuadas = candidatos.map((r, i) => ({ r, puntos: r.cuando.test(m) ? 2 : 0, i }));
  puntuadas.sort((a, b) => b.puntos - a.puntos || a.i - b.i);
  const ganadora = puntuadas[0] ?? { r: RECETAS[0], puntos: 0, i: 0 };
  return {
    receta: ganadora.r,
    compatible: ganadora.r.familias.includes(familia),
    motivo: ganadora.r.familias.includes(familia) ? `receta compatible con la familia (${ganadora.r.familias.join(", ")}) y las se\xF1ales del brief` : `fallback expl\xEDcito para la familia \xAB${familia}\xBB`
  };
}
var nivel = (v, si = "s\xED", no = "no") => v ? si : no;
function seccionReceta(r) {
  return [
    `# EXPERIENCE RECIPE: ${r.nombre} (ejecutar, no improvisar)`,
    `hero: tipo ${r.hero.tipo} con peso visual ${r.hero.pesoVisual}`,
    `composition: asim\xE9trica ${nivel(r.composicion.asimetrica)}; profundidad ${r.composicion.profundidad}; capas ${r.composicion.capas}${r.composicion.fullscreen ? "; escena a pantalla completa" : ""}${r.composicion.escalaTipografica ? `; tipograf\xEDa ${r.composicion.escalaTipografica}` : ""}${r.composicion.reticula ? `; ret\xEDcula ${r.composicion.reticula}` : ""}`,
    `surfaces: redondeo ${r.superficies.redondeo}; floatingCards ${nivel(r.superficies.floatingCards)}; elevaci\xF3n ${r.superficies.elevacion}`,
    `motion: parallax ${nivel(r.motion.parallax)}; reveal ${nivel(r.motion.reveal)}; float ${nivel(r.motion.float)}; hover ${nivel(r.motion.hover)}${r.motion.stagger ? `; stagger ${nivel(r.motion.stagger)}` : ""}${r.motion.scrollScenes ? `; escenas de scroll ${nivel(r.motion.scrollScenes)}` : ""}${r.motion.cameraMovement && r.motion.cameraMovement !== "no" ? "; camera movement opcional" : ""}`,
    `interaction: magneticCTA ${r.interaccion.magneticCta}; tiltCards ${r.interaccion.tiltCards}${r.interaccion.hoverTransform ? "; hover transform s\xED" : ""}${r.interaccion.projectReveal ? "; project reveal s\xED" : ""}`,
    `object: ${r.objeto.tipo}`,
    `navigation: ${r.navegacion.minimal ? "minimal" : "est\xE1ndar"}${r.navegacion.tecnica ? " con ret\xEDcula t\xE9cnica" : ""}`
  ].join("\n");
}

// src/lib/prism/forja/experience-manifest.ts
var modo = (d) => d.modo;
function componentsFor(familia, receta, hero, cards, plano, spatial, motion) {
  const out = [
    { id: "nav", type: "navigation", required: true, role: "orientaci\xF3n" },
    { id: "hero", type: hero.tipo, required: true, role: "foco principal", layer: spatial.layers[0]?.z ?? 0 }
  ];
  if (receta.superficies.floatingCards) out.push({ id: "floating-card-1", type: "floating-card", required: true, role: "profundidad + apoyo", layer: 30 });
  if (receta.objeto.tipo !== "tipografia") out.push({ id: "focal-object", type: receta.objeto.tipo, required: true, role: "objeto focal", layer: 20 });
  if (cards.variantes.length) out.push({ id: "card-system", type: cards.variantes.join("+"), required: familia !== "editorial", role: "contenido secundario" });
  for (const s of plano.secciones.filter((x) => !["nav", "hero", "footer"].includes(x.id)).slice(0, 5)) {
    out.push({ id: s.id, type: "section", required: true, role: s.objetivo });
  }
  out.push({ id: "footer", type: "footer", required: true, role: "cierre" });
  if (motion.primitivas.includes("reveal")) out.push({ id: "motion-reveal", type: "reveal", required: true, role: "entrada narrativa", motion: ["reveal"] });
  return out;
}
function construirExperienceManifest(args) {
  const m = modo(args.representacion);
  const required = m === "2.5d" || m === "3d" || m === "webgl";
  const minimumLayers = Math.max(2, args.receta.composicion.capas);
  const sections = args.plano.secciones.map((s) => s.id);
  return {
    version: "forja.experience@2",
    family: args.familia,
    recipe: args.receta.id,
    mode: m,
    dna: args.dna,
    spatial: {
      mode: m,
      layers: minimumLayers,
      perspective: required,
      overlap: args.receta.composicion.asimetrica || args.receta.superficies.floatingCards,
      focalObject: args.receta.objeto.tipo !== "tipografia",
      floatingSurfaces: args.receta.superficies.floatingCards
    },
    motion: {
      intensity: args.dna.motion.intensity,
      primitives: [
        args.receta.motion.reveal ? "reveal" : "none",
        args.receta.motion.float ? "float" : "none",
        args.receta.motion.parallax ? "parallax" : "none",
        args.receta.motion.hover ? "hover" : "none",
        args.receta.motion.stagger ? "stagger" : "none"
      ].filter((x) => x !== "none"),
      budget: Math.max(4, Math.min(28, 4 + Math.round(args.dna.motion.intensity * 24))),
      reducedMotion: true
    },
    components: componentsFor(args.familia, args.receta, args.hero, args.cards, args.plano, args.planEspacial, args.planMovimiento),
    composition: args.composition,
    requiredPrimitives: args.primitivas?.ids ?? [],
    contentSections: sections,
    forbiddenStructures: args.familia === "editorial" ? [] : ["centered-default-hero", "three-identical-cards-as-main-section", "repeated-box-grid"],
    responsive: {
      desktop: "composici\xF3n completa; capas y objeto seg\xFAn manifest",
      tablet: "reducir capas y tama\xF1o del objeto; conservar jerarqu\xEDa",
      mobile: "reordenar copy/objeto; reducir motion y capas; nunca escalar desktop ciegamente"
    }
  };
}
function seccionExperienceManifest(m) {
  return [
    "# EXPERIENCE MANIFEST (FUENTE DE VERDAD \u2014 ejecutar, no reinterpretar)",
    `family: ${m.family}`,
    `recipe: ${m.recipe}`,
    `mode: ${m.mode}`,
    `spatial: layers=${m.spatial.layers}; perspective=${m.spatial.perspective}; overlap=${m.spatial.overlap}; focalObject=${m.spatial.focalObject}; floatingSurfaces=${m.spatial.floatingSurfaces}`,
    `motion: intensity=${Math.round(m.motion.intensity * 100)}%; budget=${m.motion.budget}; primitives=${m.motion.primitives.join(", ") || "none"}; reducedMotion=required`,
    `required components: ${m.components.filter((x) => x.required).map((x) => x.id).join(", ")}`,
    `required sections: ${m.contentSections.join(", ")}`,
    `composition: ${m.composition.sections.map((s) => `${s.id}:${s.rhythm}:${s.motion}`).join(" | ")}`,
    `forbidden: ${m.forbiddenStructures.join(", ") || "none"}`,
    "responsive: desktop=full; tablet=reduce/reorder; mobile=recompose, no blind scaling",
    "REGLA: no conviertas una experiencia espacial/product/immersive en una landing editorial durante la implementaci\xF3n."
  ].join("\n");
}

// src/lib/prism/forja/composition-engine.ts
var ids = (plano) => plano.secciones.map((s) => s.id);
function rhythmFor(familia, recipe, i, total) {
  if (recipe.composicion.fullscreen) return i % 2 === 0 ? "scene" : "focus";
  if (familia === "dashboard") return i === 0 ? "focus" : i % 3 === 0 ? "split" : "grid";
  if (familia === "editorial") return i === 0 ? "focus" : i % 2 ? "split" : "stack";
  if (familia === "minimal") return i % 2 ? "split" : "focus";
  if (familia === "3d-showcase" || familia === "spatial") return i % 4 === 0 ? "scene" : i % 4 === 1 ? "split" : i % 4 === 2 ? "rail" : "focus";
  if (familia === "cinematic" || familia === "immersive") return i % 3 === 0 ? "scene" : i % 3 === 1 ? "focus" : "rail";
  if (familia === "interactive" || familia === "product") return i % 4 === 0 ? "focus" : i % 4 === 1 ? "split" : i % 4 === 2 ? "rail" : "stack";
  if (familia === "modular") return i % 2 ? "grid" : "split";
  return i === 0 ? "focus" : i === total - 1 ? "scene" : "split";
}
function motionFor(recipe, rhythm) {
  if (rhythm === "scene" && recipe.motion.scrollScenes) return "scroll-scene";
  if (recipe.motion.parallax && rhythm === "rail") return "parallax";
  if (recipe.motion.stagger && rhythm === "grid") return "stagger";
  return recipe.motion.reveal ? "reveal" : "none";
}
function construirCompositionBlueprint(args) {
  const sectionIds = ids(args.plano).filter((id) => !["nav", "footer"].includes(id));
  const sections = sectionIds.map((id, index) => {
    const rhythm = rhythmFor(args.familia, args.receta, index, sectionIds.length);
    const high = index === 0 || rhythm === "scene" || rhythm === "focus";
    return {
      id,
      index,
      rhythm,
      visualWeight: high ? "high" : rhythm === "split" || rhythm === "rail" ? "medium" : "low",
      spatialRole: rhythm === "scene" ? "anchor" : rhythm === "focus" ? "object" : rhythm === "rail" ? "content" : "content",
      overlap: args.receta.composicion.asimetrica && ["scene", "split", "focus"].includes(rhythm),
      fullBleed: Boolean(args.receta.composicion.fullscreen) || rhythm === "scene",
      motion: motionFor(args.receta, rhythm)
    };
  });
  return {
    version: "forja.composition@1",
    family: args.familia,
    recipe: args.receta.id,
    sections,
    antiTemplate: [
      "no usar hero centrado + tres cards id\xE9nticas como columna vertebral",
      "no repetir el mismo ritmo en tres secciones consecutivas",
      "no convertir cada secci\xF3n en una caja con borde id\xE9ntico",
      "el objeto/foco debe reaparecer solo cuando tenga funci\xF3n narrativa"
    ],
    css: cssCompositionBlueprint()
  };
}
function seccionCompositionBlueprint(c) {
  return [
    "# COMPOSITION BLUEPRINT (v4.7.2 \u2014 ejecutar, no reinterpretar)",
    `family=${c.family}; recipe=${c.recipe}; version=${c.version}`,
    "SECUENCIA:",
    ...c.sections.map((s) => `- ${s.index + 1}. ${s.id}: rhythm=${s.rhythm}; weight=${s.visualWeight}; role=${s.spatialRole}; overlap=${s.overlap}; fullBleed=${s.fullBleed}; motion=${s.motion}`),
    "ANTI-TEMPLATE:",
    ...c.antiTemplate.map((x) => `- ${x}`),
    "REGLA: la p\xE1gina completa debe mostrar variaci\xF3n de composici\xF3n; 3D/motion no puede limitarse al hero."
  ].join("\n");
}
function cssCompositionBlueprint() {
  return `
/* FORJA composition primitives \u2014 deterministic, responsive, reduced-motion safe */
.forja-scene { min-height: min(92svh, 980px); display: grid; align-items: center; position: relative; overflow: clip; }
.forja-split { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(280px, .95fr); gap: clamp(1.5rem, 5vw, 6rem); align-items: center; }
.forja-rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(72vw, 1fr); gap: clamp(1rem, 3vw, 2.5rem); overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: .75rem; }
.forja-rail > * { scroll-snap-align: start; }
.forja-focus { position: relative; isolation: isolate; }
.forja-focus > .forja-object, .forja-focus > .forja-surface { transform: translate3d(0,0,0); }
.forja-stack { display: grid; gap: clamp(1rem, 2vw, 2rem); }
.forja-grid { display: grid; grid-template-columns: repeat(12, minmax(0,1fr)); gap: clamp(.75rem, 2vw, 1.5rem); }
.forja-grid > *:nth-child(4n+1) { grid-column: span 7; }
.forja-grid > *:nth-child(4n+2) { grid-column: span 5; }
.forja-grid > *:nth-child(4n+3) { grid-column: span 5; }
.forja-grid > *:nth-child(4n+4) { grid-column: span 7; }
.forja-overlap { margin-inline: clamp(0rem, -4vw, -3rem); position: relative; z-index: 2; }
@media (max-width: 900px) { .forja-split { grid-template-columns: 1fr; } .forja-grid > * { grid-column: span 6 !important; } }
@media (max-width: 620px) { .forja-scene { min-height: auto; padding-block: 4rem; } .forja-rail { grid-auto-columns: 88vw; } .forja-grid { grid-template-columns: 1fr; } .forja-grid > * { grid-column: 1 !important; } .forja-overlap { margin-inline: 0; } }
@media (prefers-reduced-motion: reduce) { .forja-rail { scroll-behavior: auto; } .forja-overlap, .forja-focus > .forja-object, .forja-focus > .forja-surface { transform: none !important; } }
`.trim();
}

// src/lib/prism/forja/performance-gate.ts
var CASCADA = ["webgl", "3d", "2.5d", "2d"];
var UMBRAL_NODOS_MOVIL = 12;
var UMBRAL_PESO_KB = 150;
function evaluarPuerta(entrada, deseado) {
  const orden = { webgl: 0, "3d": 1, "2.5d": 2, "2d": 3 };
  const minimo = entrada.modoMinimo ?? "2d";
  if (orden[deseado] > orden[minimo]) {
    deseado = minimo;
  }
  const ev = [];
  const idx = CASCADA.indexOf(deseado);
  let modo2 = CASCADA[idx < 0 ? CASCADA.length - 1 : idx];
  let degradadoDe;
  ev.push(`modo deseado: ${deseado.toUpperCase()}`);
  ev.push(`peso de activos: ${entrada.pesoActivosKb} KB (umbral ${UMBRAL_PESO_KB}) \xB7 nodos animados: ${entrada.nodosAnimados} (umbral m\xF3vil ${UMBRAL_NODOS_MOVIL}) \xB7 GPU ${entrada.costeGpu}`);
  const degradar = (hasta, motivo) => {
    if (CASCADA.indexOf(modo2) > CASCADA.indexOf(hasta)) return;
    degradadoDe = modo2;
    modo2 = hasta;
    ev.push(`degradaci\xF3n autom\xE1tica: ${motivo}`);
  };
  if (entrada.intencionExigeWebgl && entrada.pesoActivosKb > UMBRAL_PESO_KB * 2 && entrada.costeGpu === "alto") {
    degradar("3d", "WebGL solo cuando el beneficio justifica costo/peso/complejidad/performance (\xA710)");
  }
  if (modo2 === "webgl" && entrada.pesoActivosKb > UMBRAL_PESO_KB) {
    degradar("3d", `${entrada.pesoActivosKb} KB de activos no justificados por la intenci\xF3n`);
  }
  if (entrada.movilPrimero && entrada.nodosAnimados > UMBRAL_NODOS_MOVIL) {
    degradar("2.5d", `${entrada.nodosAnimados} nodos animados pesan en m\xF3vil (\xA720)`);
  }
  if (entrada.costeGpu === "alto" && modo2 === "3d" && entrada.movilPrimero) {
    degradar("2.5d", "coste de GPU alto con audiencia m\xF3vil");
  }
  if (modo2 === "2.5d" && minimo !== "2.5d" && minimo !== "3d" && minimo !== "webgl" && entrada.costeGpu === "bajo" && entrada.nodosAnimados <= 3 && entrada.pesoActivosKb === 0) {
    degradar("2d", "el efecto cabe en jerarqu\xEDa y acabado: ni capas hace falta");
  }
  if (!degradadoDe) ev.push("el beneficio justifica el coste: modo confirmado");
  return {
    modo: modo2,
    degradadoDe,
    razon: degradadoDe ? `${degradadoDe.toUpperCase()} \u2192 ${modo2.toUpperCase()} (puerta de rendimiento \xA720)` : `${modo2.toUpperCase()} confirmado`,
    evaluacion: ev
  };
}
function modoDeseado(intencion) {
  const m = (intencion || "").toLowerCase();
  if (/\b(webgl|shaders?|particulas|partículas|simulaci[óo]n|three\.?js)\b/.test(m)) return "webgl";
  if (/\b(3d|modelo 3d|objeto 3d|rotar|escaparate|showcase|automoci[óo]n|gaming|arquitectura)\b/.test(m)) return "3d";
  if (/\b(saas|portfolio|agencia|producto|landing|premium|parallax|capas|profundidad)\b/.test(m)) return "2.5d";
  return "2d";
}
function seccionPuerta(d) {
  return [
    `# REPRESENTACI\xD3N + PERFORMANCE GATE (correcciones \xA710/\xA720)`,
    ...d.evaluacion.map((e) => `- ${e}`),
    `Decisi\xF3n: ${d.razon}`,
    d.modo === "webgl" ? `WebGL activado: con fallback degradado y lazy-load del canvas.` : d.modo === "3d" ? `3D con CSS (transform-style: preserve-3d + perspective): 0 dependencias, 0 KB de librer\xEDa.` : d.modo === "2.5d" ? `2.5D: capas + perspective + floating. Sin WebGL, sin librer\xEDas.` : `2D: jerarqu\xEDa y acabado. El coste se invierte en contenido.`,
    `Fallback obligatorio: WebGL \u2192 3D/CSS \u2192 2.5D \u2192 2D (prefers-reduced-motion incluido).`
  ].join("\n");
}

// src/lib/prism/forja/spatial-engine.ts
var PERSPECTIVAS = {
  "1": "900px",
  "2": "1200px",
  "3": "1400px",
  "4": "1600px",
  "5": "1800px",
  "6": "2000px",
  "7": "2200px",
  "8": "2400px"
};
function construirPlanEspacial(e, r) {
  const capas = [];
  const profundidad = Math.max(0, Math.min(1, e.spatial.depth));
  const capasPedidas = Math.max(2, Math.min(7, r.composicion.capas || e.spatial.layers));
  capas.push({ id: "fondo", z: 0, x: "0", y: "0", contenido: "fondo del lienzo (color o textura sutil)", depth: 0 });
  if (profundidad >= 0.5 && capasPedidas >= 4) {
    capas.push({ id: "reticula", z: 1, x: "0", y: "0", contenido: "ret\xEDcula t\xE9cnica o de fondo (l\xEDneas 1px, opacidad baja)", depth: Math.round(10 + profundidad * 30) });
  }
  if (profundidad >= 0.7 && capasPedidas >= 5) {
    capas.push({ id: "ambiente", z: 2, x: "8%", y: "12%", contenido: "elemento ambiental de fondo (forma/geometr\xEDa, movimiento lento)", scale: 1.1, depth: Math.round(20 + profundidad * 40) });
  }
  const tieneObjeto = e.object.visualWeight >= 0.5 && r.objeto.tipo !== "tipografia";
  if (tieneObjeto) {
    capas.push({
      id: "objeto",
      z: 3,
      x: r.composicion.asimetrica ? "62%" : "50%",
      y: "42%",
      scale: e.object.visualWeight >= 0.8 ? 1.15 : 1,
      rotate: e.object.use3d ? -8 : 0,
      contenido: `objeto focal (${r.objeto.tipo})`,
      depth: Math.round(30 + profundidad * 60)
    });
  }
  capas.push({
    id: "tipografia",
    z: 4,
    x: r.composicion.asimetrica ? "8%" : "50%",
    y: r.composicion.asimetrica ? "34%" : "38%",
    contenido: r.composicion.escalaTipografica === "enorme" ? "tipograf\xEDa display oversized" : "tipograf\xEDa display",
    depth: Math.round(10 + profundidad * 20)
  });
  if (r.superficies.floatingCards || capasPedidas >= 5) {
    capas.push({ id: "ui-flotante", z: 5, x: "70%", y: "62%", contenido: r.superficies.floatingCards ? "cards flotantes (superficie elevada)" : "UI flotante de apoyo", depth: Math.round(24 + profundidad * 30) });
  }
  if (capasPedidas >= 6) {
    capas.push({ id: "metricas", z: 6, x: "12%", y: "68%", contenido: "m\xE9tricas flotantes (n\xFAmeros tabulares)", depth: Math.round(18 + profundidad * 22) });
  }
  capas.push({ id: "navegacion", z: 10, x: "0", y: "0", contenido: r.navegacion.minimal ? "navegaci\xF3n m\xEDnima (logo + 2 acciones)" : "navegaci\xF3n est\xE1ndar" });
  const perspectiva = PERSPECTIVAS[String(Math.max(1, Math.min(8, capas.length)))] ?? "1600px";
  const objetoFocal = tieneObjeto ? {
    type: r.objeto.tipo === "objeto-3d" ? "3d" : r.objeto.tipo === "ui-producto" ? "ui" : r.objeto.tipo === "escena" ? "escena" : "product",
    position: r.composicion.asimetrica ? "derecha-centro" : "centro",
    scale: e.object.visualWeight >= 0.8 ? 1.15 : 1,
    tratamiento: e.interaction.tilt ? "tilt 3D al puntero" : e.object.use3d ? "rotaci\xF3n sutil continua" : "flotaci\xF3n ambiente lenta"
  } : void 0;
  return {
    depth: profundidad,
    perspective: Math.max(0, Math.min(1, e.spatial.perspective)),
    layers: capas,
    focalObject: objetoFocal
  };
}
function seccionPlanEspacial(p, perspectivaPx2) {
  const lineas = [
    `# SPATIAL PLAN (la p\xE1gina es una escena, correcci\xF3n \xA75)`,
    `Profundidad ${pct2(p.depth)} \xB7 perspectiva ${perspectivaPx2 ?? "1600px"} \xB7 parallax por capa (depth = desplazamiento al scroll)`,
    `Capas de fondo a frente (z-index sem\xE1ntico, no adivinar):`,
    ...p.layers.map(
      (l) => `  z${String(l.z).padStart(2)} \xB7 ${l.id} \u2014 ${l.contenido} \xB7 posici\xF3n ${l.x}/${l.y}${l.scale ? ` \xB7 escala ${l.scale}` : ""}${l.rotate ? ` \xB7 rotaci\xF3n ${l.rotate}deg` : ""}${l.depth ? ` \xB7 parallax ${l.depth}px` : ""}`
    )
  ];
  if (p.focalObject) {
    lineas.push(
      `Objeto focal: ${p.focalObject.type} en ${p.focalObject.position}, escala ${p.focalObject.scale}, tratamiento: ${p.focalObject.tratamiento}.`,
      `REGLA: cada capa tiene UN trabajo; el overlap es intencional (nada flota sin causa).`,
      `REGLA: todo transform 3D lleva perspective en el contenedor y prefers-reduced-motion respetado.`
    );
  }
  return lineas.join("\n");
}
function cssEscenario(p, perspectivaPx2) {
  if (p.depth < 0.4) return "";
  const px = perspectivaPx2 ?? "1600px";
  const capa = p.layers.find((l) => l.id === "objeto");
  return [
    `/* Escenario espacial (generado por FORJA Spatial Engine) */`,
    `.escena { perspective: ${px}; transform-style: preserve-3d; }`,
    capa ? `.escena .objeto-focal { transform: translateZ(${Math.round(p.depth * 60)}px); will-change: transform; }` : "",
    p.layers.some((l) => l.id === "reticula") ? `.escena .capa-fondo { transform: translateZ(-${Math.round(p.depth * 40)}px); }` : ""
  ].filter(Boolean).join("\n");
}
function pct2(n) {
  return `${Math.round(n * 100)}%`;
}

// src/lib/prism/forja/motion-engine.ts
var PRIMITIVAS = [
  "fade",
  "reveal",
  "slide",
  "scale",
  "blur",
  "parallax",
  "magnetic",
  "tilt",
  "float",
  "orbit",
  "morph",
  "stagger",
  "sticky",
  "horizontal-scroll",
  "perspective",
  "scene-transition"
];
var CATALOGO_INTENSIDAD = [
  { nivel: 0, nombre: "static", habilita: ["nada se mueve: jerarqu\xEDa y acabado"] },
  { nivel: 1, nombre: "microinteracci\xF3n", habilita: ["hover", "focus", "feedback de acci\xF3n (150-300ms)"] },
  { nivel: 2, nombre: "motion", habilita: ["reveal al scroll", "entradas escalonadas", "transiciones de componente (250-600ms)"] },
  { nivel: 3, nombre: "spatial motion", habilita: ["reveal", "parallax", "floating", "depth", "hover avanzado (500-1000ms)"] },
  { nivel: 4, nombre: "immersive", habilita: ["3D", "camera movement", "scene transitions", "scroll choreography (800-1600ms)"] }
];
var ESCALA_TIEMPO = [
  { categoria: "microinteracci\xF3n", rango: "150-300ms", uso: "hover, focus, feedback de botones y enlaces" },
  { categoria: "componente", rango: "250-600ms", uso: "acordeones, modales, tarjetas que cambian de estado" },
  { categoria: "reveal", rango: "500-1000ms", uso: "secciones que entran al hacer scroll, hero que aparece" },
  { categoria: "escena", rango: "800-1600ms", uso: "transiciones entre escenas, coreograf\xEDa de scroll" },
  { categoria: "ambiente", rango: "continuo", uso: "flotaci\xF3n lenta, rotaci\xF3n sutil, fondo vivo (bajo consumo)" }
];
function intensidadDesdeFraccion(f) {
  const n = Math.max(0, Math.min(1, Number.isFinite(f) ? f : 0));
  if (n <= 0.02) return 0;
  if (n <= 0.3) return 1;
  if (n <= 0.6) return 2;
  if (n <= 0.85) return 3;
  return 4;
}
function construirPlanMovimiento(e, r) {
  const nivel2 = intensidadDesdeFraccion(e.motion.intensity);
  const activas = /* @__PURE__ */ new Set();
  if (nivel2 >= 1) ["fade", "scale"].forEach((p) => activas.add(p));
  if (nivel2 >= 2) ["reveal", "slide", "stagger"].forEach((p) => activas.add(p));
  if (nivel2 >= 3) ["parallax", "blur", "perspective"].forEach((p) => activas.add(p));
  if (nivel2 >= 4) ["scene-transition", "orbit"].forEach((p) => activas.add(p));
  if (r.motion.hover) activas.add("fade");
  if (r.motion.parallax) activas.add("parallax");
  if (r.motion.float) activas.add("float");
  if (r.motion.stagger) activas.add("stagger");
  if (r.motion.scrollScenes) activas.add("scene-transition");
  if (e.interaction.magnetic) activas.add("magnetic");
  if (e.interaction.tilt) activas.add("tilt");
  if (e.object.use3d && nivel2 >= 3) activas.add("perspective");
  const techo = { 0: 0, 1: 2, 2: 5, 3: 9, 4: PRIMITIVAS.length };
  const primitivas = [...activas].filter((p) => PRIMITIVAS.indexOf(p) < techo[nivel2]).slice(0, techo[nivel2]);
  const tiempos = ESCALA_TIEMPO.filter((t) => {
    if (t.categoria === "microinteracci\xF3n") return nivel2 >= 1;
    if (t.categoria === "componente") return nivel2 >= 2;
    if (t.categoria === "reveal") return nivel2 >= 2;
    if (t.categoria === "escena") return nivel2 >= 4 || r.motion.scrollScenes;
    return nivel2 >= 3 || r.motion.float;
  }).map((t) => ({ categoria: t.categoria, rango: t.rango }));
  const coreografia = [];
  if (nivel2 >= 2) coreografia.push("entrada del hero: t\xEDtulo y objeto con stagger de 80ms entre piezas (reveal 600-800ms)");
  if (nivel2 >= 3 && e.motion.parallax) coreografia.push("capas del plan espacial se desplazan a velocidades distintas (depth px del Spatial Plan)");
  if (r.motion.float) coreografia.push("objeto y cards flotantes: oscilaci\xF3n continua \xB16px, 6-8s, ease-in-out");
  if (e.interaction.tilt) coreografia.push("tilt m\xE1x 8\xB0 en cards y objeto con perspective 1000px");
  if (e.interaction.magnetic) coreografia.push("CTA magn\xE9tico: atracci\xF3n \u2264 12px hacia el puntero, retorno el\xE1stico 300ms");
  if (nivel2 >= 4) coreografia.push("transici\xF3n de escena al cruzar secciones: fade+scale 1000ms con contenido que ancla");
  if (nivel2 === 0) coreografia.push("nada se mueve salvo estados hover/focus m\xEDnimos y feedback de acci\xF3n");
  coreografia.push("SIEMPRE: @media (prefers-reduced-motion: reduce) desactiva parallax, float, escenas y deja fades \u2264 200ms");
  return {
    intensidad: nivel2,
    nombre: CATALOGO_INTENSIDAD[nivel2].nombre,
    primitivas,
    tiempos,
    reducedMotion: true,
    coreografia
  };
}
function seccionPlanMovimiento(p) {
  return [
    `# MOTION PLAN (lenguaje de movimiento con prop\xF3sito, correcciones \xA78/\xA79)`,
    `Intensidad ${p.intensidad}/4 \u2014 \xAB${p.nombre}\xBB: ${CATALOGO_INTENSIDAD[p.intensidad].habilita.join(", ")}`,
    `Primitivas activas: ${p.primitivas.join(", ") || "ninguna (est\xE1tico deliberado)"}`,
    `Tiempos por categor\xEDa: ${p.tiempos.map((t) => `${t.categoria} ${t.rango}`).join(" \xB7 ")}`,
    `Coreograf\xEDa:`,
    ...p.coreografia.map((c) => `- ${c}`)
  ].join("\n");
}
function cssMovimiento(p) {
  const reveal = p.primitivas.includes("reveal");
  const float = p.primitivas.includes("float");
  const parallax = p.primitivas.includes("parallax");
  return [
    `/* Motion base (FORJA Motion Engine, ${p.nombre}) */`,
    `:root { --motion-fast: 180ms; --motion-medium: 420ms; --motion-slow: 900ms; --ease-out: cubic-bezier(.22,.61,.36,1); }`,
    reveal ? `@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity: 0; transform: translateY(24px); transition: opacity var(--motion-slow) var(--ease-out), transform var(--motion-slow) var(--ease-out); }
  .reveal.visible { opacity: 1; transform: none; }
  .stagger > * { transition-delay: calc(var(--i, 0) * 80ms); }
}` : "",
    float ? `@keyframes forja-float { 0%,100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }
@media (prefers-reduced-motion: no-preference) { .flota { animation: forja-float 7s ease-in-out infinite; } }` : "",
    parallax ? `@media (prefers-reduced-motion: no-preference) { .parallax { will-change: transform; transform: translateY(calc(var(--py, 0) * 1px)); } }` : "",
    `@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}`
  ].filter(Boolean).join("\n");
}

// src/lib/prism/forja/hero-engine.ts
var DEFS = [
  {
    tipo: "HERO_3D_OBJECT",
    familias: ["3d-showcase", "spatial", "immersive"],
    composiciones: [
      ["tipograf\xEDa gigante", "objeto 3D central", "navegaci\xF3n m\xEDnima"],
      ["objeto central", "navegaci\xF3n", "m\xE9tricas flotantes"]
    ],
    cuando: /\b(3d|objeto 3d|modelo 3d|webgl|rotar|girar)\b/i,
    motivo: "hay un objeto 3D protagonista: se mira antes de leerse"
  },
  {
    tipo: "HERO_PRODUCT",
    familias: ["product", "interactive", "modular"],
    composiciones: [
      ["texto", "UI flotante del producto", "m\xE9trica clave"],
      ["captura viva del producto", "texto asim\xE9trico", "CTA"]
    ],
    cuando: /\b(saas|app|software|plataforma|demo|producto)\b/i,
    motivo: "el producto se muestra vivo (UI real), no se describe"
  },
  {
    tipo: "HERO_SPATIAL",
    familias: ["spatial", "immersive", "product"],
    composiciones: [
      ["texto", "objeto", "capas de profundidad"],
      ["escena por capas", "tipograf\xEDa sobre la capa media", "CTA flotante"]
    ],
    motivo: "la profundidad es el mensaje: cada capa explica una parte"
  },
  {
    tipo: "HERO_CINEMATIC",
    familias: ["cinematic", "immersive"],
    composiciones: [
      ["plano de apertura a pantalla completa", "texto m\xEDnimo", "CTA al final del plano"],
      ["escena", "t\xEDtulo enorme", "indicaci\xF3n de scroll"]
    ],
    motivo: "el scroll es un cambio de plano: apertura con ritmo"
  },
  {
    tipo: "HERO_INTERACTIVE",
    familias: ["interactive", "product"],
    composiciones: [
      ["canvas interactivo", "m\xE9tricas en vivo", "CTA"],
      ["texto", "panel manipulable", "feedback inmediato"]
    ],
    cuando: /\b(interactiv|demo|juguete|juego|prueba)\b/i,
    motivo: "la interacci\xF3n ES el argumento: tocar ense\xF1a m\xE1s que leer"
  },
  {
    tipo: "HERO_SPLIT",
    familias: ["product", "modular", "minimal"],
    composiciones: [
      ["texto a un lado", "objeto/UI al otro", "asimetr\xEDa 60/40"],
      ["claim enorme", "producto flotando", "prueba social m\xEDnima"]
    ],
    motivo: "dos ideas conviven: la promesa y la prueba visible"
  },
  {
    tipo: "HERO_FLOATING_CARDS",
    familias: ["product", "spatial", "interactive"],
    composiciones: [
      ["cards flotantes", "producto", "fondo con profundidad"],
      ["m\xE9tricas flotantes", "objeto central", "texto corto"]
    ],
    motivo: "los datos flotan sobre el objeto: jerarqu\xEDa espacial literal"
  },
  {
    tipo: "HERO_FULLSCREEN",
    familias: ["cinematic", "immersive", "minimal"],
    composiciones: [
      ["una sola pantalla", "un mensaje", "una acci\xF3n"],
      ["tipograf\xEDa enorme", "objeto de fondo", "navegaci\xF3n m\xEDnima"]
    ],
    motivo: "una idea a pantalla completa: fuerza de foco m\xE1xima"
  },
  {
    tipo: "HERO_SCROLL_REVEAL",
    familias: ["cinematic", "editorial", "immersive"],
    composiciones: [
      ["t\xEDtulo que se revela al hacer scroll", "objeto que entra", "CTA"],
      ["texto por capas", "profundidad que emerge"]
    ],
    motivo: "el contenido aparece con el scroll: revelaci\xF3n como argumento"
  },
  {
    tipo: "HERO_MINIMAL",
    familias: ["minimal", "editorial", "modular"],
    composiciones: [
      ["tipograf\xEDa protagonista", "aire generoso", "una acci\xF3n"],
      ["claim corto", "enlace fuerte", "nada m\xE1s"]
    ],
    motivo: "menos es la decisi\xF3n: precisi\xF3n y silencio"
  }
];
function defHero(tipo) {
  return DEFS.find((d) => d.tipo === tipo);
}
function elegirHero(e, familia, mensaje = "", historialHeroes = [], ajustesAprendidos = {}) {
  const m = (mensaje || "").toLowerCase();
  const puntuados = DEFS.map((d, i) => {
    let puntos = 0;
    if (d.familias.includes(familia)) puntos += 3;
    if (d.cuando?.test(m)) puntos += 2;
    if (d.tipo === "HERO_3D_OBJECT" && e.object.use3d) puntos += 3;
    if (d.tipo === "HERO_SPATIAL" && e.spatial.depth >= 0.7 && !e.object.use3d) puntos += 2;
    if (d.tipo === "HERO_CINEMATIC" && e.motion.intensity >= 0.8) puntos += 1;
    if (d.tipo === "HERO_INTERACTIVE" && e.interaction.richness >= 0.7) puntos += 2;
    if (d.tipo === "HERO_MINIMAL" && e.visual.density <= 0.35 && e.composition.negativeSpace >= 0.6) puntos += 1;
    if (d.tipo === "HERO_FLOATING_CARDS" && e.surface.elevation >= 0.6) puntos += 1;
    const recientes = historialHeroes.slice(-3);
    const usos = recientes.filter((h) => h === d.tipo).length;
    puntos -= usos * 2.5;
    puntos += ajustesAprendidos[d.tipo] ?? 0;
    return { d, puntos, i };
  });
  puntuados.sort((a, b) => b.puntos - a.puntos || a.i - b.i);
  const ganador = puntuados[0].d;
  const alternativas = puntuados.slice(1, 3).map((p) => p.d.tipo);
  const usadas = new Set(historialHeroes.slice(-2));
  const comp = ganador.composiciones.find((c, i) => i === 0 ? true : !usadas.has(`${ganador.tipo}#${i}`)) ?? ganador.composiciones[0];
  return {
    tipo: ganador.tipo,
    composicion: comp,
    motivo: ganador.motivo,
    alternativas
  };
}
function seccionHero(h) {
  return [
    `# HERO (tipo decidido \u2014 correcci\xF3n \xA76)`,
    `Tipo: ${h.tipo}`,
    `Se construye con: ${h.composicion.join(" + ")}`,
    `Por qu\xE9: ${h.motivo}`,
    h.alternativas.length ? `Alternativas explorables: ${h.alternativas.join(", ")}` : "",
    `PROHIBIDO por defecto: hero centrado + h1 gigante + p\xE1rrafo + bot\xF3n. Si tu hero se parece a eso, no es este hero.`
  ].filter(Boolean).join("\n");
}

// src/lib/prism/forja/card-system.ts
var CARDS = [
  {
    id: "CARD_STATIC",
    comportamiento: "no reacciona salvo al foco de teclado",
    proposito: "contenido de referencia que no pide acci\xF3n",
    css: `.card-static { border-radius: var(--radius-lg); border: 1px solid var(--linea); }`
  },
  {
    id: "CARD_FLOATING",
    comportamiento: "flota sobre el lienzo con sombra propia y deriva ambiente",
    proposito: "datos y acciones sobre el objeto/escena",
    css: `.card-floating { border-radius: 28px; transform: translateZ(20px); box-shadow: var(--shadow-floating); }`
  },
  {
    id: "CARD_MAGNETIC",
    comportamiento: "se atrae hacia el puntero dentro de su campo y regresa con easing",
    proposito: "CTA y acciones clave",
    css: `.card-magnetic { transition: transform 300ms var(--ease-out); }`
  },
  {
    id: "CARD_TILT",
    comportamiento: "inclina en 3D seg\xFAn la posici\xF3n del puntero (m\xE1x 8\xB0)",
    proposito: "piezas visuales que ganan con la perspectiva",
    css: `.card-tilt { transform-style: preserve-3d; perspective: 1000px; }`
  },
  {
    id: "CARD_GLASS",
    comportamiento: "superficie transl\xFAcida con blur SOLO sobre capas con contenido detr\xE1s",
    proposito: "UI flotante encima de escena u objeto",
    css: `.card-glass { background: color-mix(in srgb, var(--superficie) 72%, transparent); backdrop-filter: blur(14px); border-radius: 24px; border: 1px solid var(--linea); }`
  },
  {
    id: "CARD_3D",
    comportamiento: "pieza de la escena con translateZ y reacci\xF3n al scroll",
    proposito: "objetos dentro del plano espacial",
    css: `.card-3d { transform-style: preserve-3d; transform: translateZ(40px); }`
  },
  {
    id: "CARD_EXPANDABLE",
    comportamiento: "se expande con detalle real al click/teclado (Enter/Espacio)",
    proposito: "listas que necesitan profundidad sin cambiar de p\xE1gina",
    css: `.card-expandable { cursor: pointer; } .card-expandable[aria-expanded="true"] { border-color: var(--acento); }`
  },
  {
    id: "CARD_HORIZONTAL",
    comportamiento: "formato ancho: media a un lado, texto al otro",
    proposito: "listados con jerarqu\xEDa fuerte (noticias, proyectos)",
    css: `.card-horizontal { display: grid; grid-template-columns: 2fr 3fr; gap: 20px; border-radius: 24px; }`
  },
  {
    id: "CARD_STACKED",
    comportamiento: "pila con profundidad: cada capa translateZ distinta",
    proposito: "mostrar acumulaci\xF3n (planes, versiones, historial)",
    css: `.card-stack { position: relative; } .card-stack > * + * { transform: translateZ(calc(var(--n, 1) * -10px)); }`
  },
  {
    id: "CARD_SPOTLIGHT",
    comportamiento: "un foco de luz sigue al puntero dentro de la card",
    proposito: "destacar UNA pieza sin saturar el resto",
    css: `.card-spotlight { position: relative; overflow: hidden; } .card-spotlight::after { content: ""; position: absolute; inset: -40%; background: radial-gradient(200px circle at var(--mx, 50%) var(--my, 50%), var(--acento-suave), transparent 60%); opacity: 0; transition: opacity 300ms; } .card-spotlight:hover::after { opacity: 1; }`
  },
  {
    id: "CARD_INTERACTIVE",
    comportamiento: "toda la card es clicable con estado hover/active/focus visibles",
    proposito: "navegaci\xF3n por contenido (proyectos, art\xEDculos)",
    css: `.card-interactive { transition: transform 250ms var(--ease-out), border-color 250ms; } .card-interactive:hover { transform: translateY(-4px); border-color: var(--acento); }`
  },
  {
    id: "CARD_PRODUCT",
    comportamiento: "ficha con media dominante, precio tabular y acci\xF3n clara",
    proposito: "e-commerce y cat\xE1logos",
    css: `.card-product { border-radius: 20px; } .card-product .precio { font-variant-numeric: tabular-nums; }`
  },
  {
    id: "CARD_METRIC",
    comportamiento: "n\xFAmero grande tabular + delta con color sem\xE1ntico",
    proposito: "m\xE9tricas flotantes sobre la escena",
    css: `.card-metric { border-radius: 24px; padding: 20px 24px; } .card-metric .valor { font-variant-numeric: tabular-nums; font-weight: 700; }`
  },
  {
    id: "CARD_MEDIA",
    comportamiento: "video/imagen con aspect-ratio fijo y reproducci\xF3n con intenci\xF3n",
    proposito: "demos y showreels",
    css: `.card-media { aspect-ratio: 16/9; object-fit: cover; border-radius: 20px; }`
  }
];
function defCard(id) {
  return CARDS.find((c) => c.id === id);
}
function elegirCards(e, r, max = 5) {
  const out = [];
  const disciplina = [];
  if (r.superficies.floatingCards) out.push("CARD_FLOATING");
  if (e.interaction.tilt) out.push("CARD_TILT");
  if (e.interaction.magnetic) out.push("CARD_MAGNETIC");
  if (e.object.use3d || e.spatial.mode === "3d" || e.spatial.mode === "immersive") out.push("CARD_3D");
  if (r.interaccion.projectReveal || r.interaccion.hoverTransform) out.push("CARD_INTERACTIVE");
  if (r.id === "spatial_product" || r.id === "3d_showcase") out.push("CARD_METRIC");
  if (/\b(portfolio|proyectos?|galeria|galer[ií]a|blog|noticias?)\b/i.test(`${r.id} ${r.nombre}`) || r.composicion.reticula === "t\xE9cnica") out.push("CARD_HORIZONTAL");
  if (e.interaction.expandable) out.push("CARD_EXPANDABLE");
  if (r.objeto.tipo === "escena") out.push("CARD_MEDIA");
  out.push("CARD_STATIC");
  if (e.surface.blur >= 0.4 && out.length < max) {
    out.unshift("CARD_GLASS");
    disciplina.push("glass permitido: el ADN pide blur y hay capas con contenido detr\xE1s");
  } else {
    disciplina.push("glass limitado (doc \xA77): se diferencia por elevaci\xF3n, borde y tono, no por blur en todas partes");
  }
  const uniq = [...new Set(out)];
  return { variantes: uniq.slice(0, Math.max(2, max)), disciplina };
}
function cssCards(variantes) {
  const bloques = variantes.map((v) => defCard(v)?.css ?? "").filter(Boolean);
  return [`/* Card System (FORJA, ${variantes.length} variantes) */`, ...bloques].join("\n");
}
function seccionCards(eleccion) {
  const defs2 = eleccion.variantes.map((v) => {
    const d = defCard(v);
    return `- ${v}: ${d.comportamiento} \u2014 para ${d.proposito}`;
  });
  return [
    `# CARD SYSTEM (variantes sem\xE1nticas con comportamiento, correcci\xF3n \xA77)`,
    ...defs2,
    ...eleccion.disciplina.map((d) => `Disciplina: ${d}`)
  ].join("\n");
}

// src/lib/prism/forja/plan-responsivo-experiencia.ts
function construirPlanResponsivo(e, r) {
  const capasDesktop = Math.max(2, Math.min(7, r.composicion.capas || e.spatial.layers));
  const capasTablet = Math.max(2, capasDesktop - 1);
  const cardsDesktop = r.superficies.floatingCards ? 4 : 2;
  const cardsTablet = Math.max(1, cardsDesktop - 2);
  const cardsMovil = 1;
  const mantiene = ["jerarqu\xEDa del contenido y orden de lectura", "la acci\xF3n principal visible en la primera pantalla", "contraste y accesibilidad (nunca se negocian)"];
  const reduce = [];
  const elimina = [];
  const transforma = [];
  const reordena = [];
  if (e.spatial.mode === "3d" || e.spatial.mode === "immersive") {
    reduce.push(`parallax reducido en tablet (${capasTablet} capas) y anulado en m\xF3vil`);
    elimina.push("camera movement y scene transitions en m\xF3vil (peso + mareo)");
    transforma.push(`el objeto 3D pasa a objeto est\xE1tico con rotaci\xF3n por gesto en m\xF3vil`);
    mantiene.push("el objeto focal (cambia de tratamiento, no desaparece)");
  } else if (e.spatial.mode === "2.5d") {
    reduce.push(`capas de ${capasDesktop} a ${capasTablet} en tablet y a 2 en m\xF3vil`);
    elimina.push(e.motion.parallax ? "parallax fuerte en m\xF3vil (se mantiene un desplazamiento sutil)" : "nada: sin parallax desde el origen");
    mantiene.push("cards flotantes con elevaci\xF3n (menos deriva ambiente)");
  } else {
    mantiene.push("composici\xF3n plana coherente en los tres tama\xF1os");
  }
  if (r.superficies.floatingCards) {
    reduce.push(`cards flotantes: ${cardsDesktop} en desktop \u2192 ${cardsTablet} en tablet \u2192 ${cardsMovil} en m\xF3vil`);
    reordena.push("en m\xF3vil las cards pasan a flujo vertical bajo el objeto (sin overlap)");
  }
  if (r.composicion.escalaTipografica === "enorme") {
    transforma.push("tipograf\xEDa oversized usa clamp() para caer de escala de escena a escala de lectura");
  }
  if (r.navegacion.minimal) {
    mantiene.push("navegaci\xF3n m\xEDnima (logo + acci\xF3n) id\xE9ntica en los tres tama\xF1os");
  } else {
    transforma.push("navegaci\xF3n est\xE1ndar se pliega a men\xFA accesible en m\xF3vil");
  }
  if (e.interaction.tilt || e.interaction.magnetic) {
    transforma.push("tilt/magnetic (puntero) se sustituyen por estados :active y feedback t\xE1ctil en m\xF3vil");
    elimina.push("dependencia de hover para revelar contenido cr\xEDtico");
  }
  const desktop = [
    `escena completa: ${capasDesktop} capas, parallax activo, ${cardsDesktop} cards flotantes`,
    e.object.use3d ? "objeto 3D con rotaci\xF3n ambiental" : "objeto con flotaci\xF3n sutil",
    "coreograf\xEDa de scroll completa (si la intensidad lo pide)"
  ];
  const tablet = [`escena ${capasTablet} capas con parallax suave`, `${cardsTablet} cards flotantes`, "mismos breakpoints de tipograf\xEDa (768px/1024px)"];
  const movil = [
    `escena simplificada a 2 capas, sin parallax`,
    `${cardsMovil} card flotante como m\xE1ximo`,
    "objetivo t\xE1ctil \u2265 44px y todo el contenido en flujo vertical legible"
  ];
  return { desktop, tablet, movil, decisiones: { mantiene, reduce, reordena, elimina, transforma } };
}
function seccionPlanResponsivo(p) {
  const lista = (t, xs) => xs.length ? `${t}:
${xs.map((x) => `  - ${x}`).join("\n")}` : `${t}: \u2014`;
  return [
    `# RESPONSIVE EXPERIENCE PLAN (responsive como experiencia, correcci\xF3n \xA719)`,
    `Desktop (\u22651024px):`,
    ...p.desktop.map((d) => `  - ${d}`),
    `Tablet (768-1023px):`,
    ...p.tablet.map((d) => `  - ${d}`),
    `M\xF3vil (<768px):`,
    ...p.movil.map((d) => `  - ${d}`),
    ``,
    lista("Se MANTIENE", p.decisiones.mantiene),
    lista("Se REDUCE", p.decisiones.reduce),
    lista("Se REORDENA", p.decisiones.reordena),
    lista("Se ELIMINA", p.decisiones.elimina),
    lista("Se TRANSFORMA", p.decisiones.transforma)
  ].join("\n");
}

// src/lib/prism/forja/tokens-experiencia.ts
function escalaRadios(radius) {
  const base = Number.parseInt((radius.match(/(\d+)\s*px/) ?? [])[1] ?? "16", 10) || 16;
  const b = Math.max(4, Math.min(32, base));
  return { sm: `${Math.round(b / 2)}px`, md: `${b}px`, lg: `${Math.round(b * 1.5)}px`, xl: `${Math.round(b * 2)}px`, xl2: `${Math.round(b * 2.5)}px` };
}
function escalaDepth(depth) {
  const d = Math.max(0, Math.min(1, depth));
  const max = 24 + d * 76;
  return [Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), Math.round(max)];
}
function perspectivaPx(p) {
  const n = Math.max(0, Math.min(1, p));
  if (n < 0.34) return "800px";
  if (n < 0.67) return "1200px";
  return "1800px";
}
function sombras(elevation) {
  const e = Math.max(0, Math.min(1, elevation));
  const alfa = (0.08 + e * 0.14).toFixed(2);
  const alfa2 = (0.1 + e * 0.2).toFixed(2);
  return {
    soft: `0 1px 2px rgba(2,6,23,${alfa}), 0 4px 12px rgba(2,6,23,${alfa})`,
    floating: `0 2px 4px rgba(2,6,23,${alfa}), 0 18px 40px rgba(2,6,23,${alfa2})`,
    deep: `0 4px 8px rgba(2,6,23,${alfa2}), 0 32px 64px rgba(2,6,23,${(Number(alfa2) + 0.08).toFixed(2)})`
  };
}
function tokensExperienciaCss(e) {
  const r = escalaRadios(e.surface.radius);
  const d = escalaDepth(e.spatial.depth);
  const s = sombras(e.surface.elevation);
  const blur = e.surface.blur > 0.2 ? `
  --surface-blur: ${Math.round(6 + e.surface.blur * 18)}px;` : "";
  return [
    `/* Design tokens de experiencia (FORJA \xA718) */`,
    `:root {`,
    `  --radius-sm: ${r.sm}; --radius-md: ${r.md}; --radius-lg: ${r.lg}; --radius-xl: ${r.xl}; --radius-2xl: ${r.xl2};`,
    `  --depth-1: ${d[0]}px; --depth-2: ${d[1]}px; --depth-3: ${d[2]}px; --depth-4: ${d[3]}px;`,
    `  --perspective-low: 800px; --perspective-medium: 1200px; --perspective-high: 1800px;`,
    `  --perspective: ${perspectivaPx(e.spatial.perspective)};`,
    `  --motion-fast: 180ms; --motion-medium: 420ms; --motion-slow: 900ms; --ease-out: cubic-bezier(.22,.61,.36,1);`,
    `  --shadow-soft: ${s.soft};`,
    `  --shadow-floating: ${s.floating};`,
    `  --shadow-deep: ${s.deep};`,
    `  --surface-floating: ${e.surface.elevation >= 0.6 ? "var(--shadow-floating)" : "var(--shadow-soft)"};`,
    `  --surface-elevated: ${e.surface.elevation >= 0.75 ? "var(--shadow-deep)" : "var(--shadow-floating)"};`,
    `  --surface-contrast: ${e.visual.contrast >= 0.7 ? "bordes 1px + elevaci\xF3n" : "bordes 1px"};${blur}`,
    `}`
  ].join("\n");
}
function resumenTokens(e) {
  const r = escalaRadios(e.surface.radius);
  const d = escalaDepth(e.spatial.depth);
  return `tokens: radius ${r.sm}\u2026${r.xl2} \xB7 depth ${d[0]}\u2026${d[3]}px \xB7 sombra ${e.surface.elevation >= 0.6 ? "floating/deep" : "soft"}`;
}

// src/lib/prism/forja/anti-repetition.ts
var TOPE_HISTORIAL = 12;
var historial = [];
function registrarComposicion(h) {
  try {
    historial = [...historial.filter((x) => x.cuando !== h.cuando), h].slice(-TOPE_HISTORIAL);
  } catch {
  }
}
function obtenerHistorial() {
  return [...historial];
}
function reiniciarAntiRepeticion() {
  historial = [];
}
function cargarHistorial(xs) {
  historial = (Array.isArray(xs) ? xs : []).slice(-TOPE_HISTORIAL);
}
function usosRecientes(valor, extraer, ventana = 3) {
  const recientes = historial.slice(-ventana);
  return recientes.filter((h) => extraer(h).includes(valor)).length;
}
function penalizacionHero(tipo, ventana = 3) {
  const usos = usosRecientes(tipo, (h) => [h.hero], ventana);
  return usos === 0 ? 0 : usos === 1 ? 1 : 2.5;
}
function penalizacionComposicion(hero, spatial, cardPrincipal) {
  const repeticiones = [];
  let puntos = 0;
  const usosHero = usosRecientes(hero, (h) => [h.hero]);
  if (usosHero > 0) {
    repeticiones.push({ patron: `hero ${hero}`, veces: usosHero });
    puntos += usosHero * 1.5;
  }
  const usosSpatial = usosRecientes(spatial, (h) => [h.spatial]);
  if (usosSpatial >= 2) {
    repeticiones.push({ patron: `modo espacial ${spatial}`, veces: usosSpatial });
    puntos += 1;
  }
  const usosCard = cardPrincipal ? usosRecientes(cardPrincipal, (h) => h.cards) : 0;
  if (usosCard >= 2) {
    repeticiones.push({ patron: `card ${cardPrincipal}`, veces: usosCard });
    puntos += 0.5;
  }
  const consejo = repeticiones.length ? `evita repetir ${repeticiones.map((r) => `${r.patron} (\xD7${r.veces})`).join(", ")}: explora ${heroSugeridoAlternativo(hero)} en esta generaci\xF3n` : "composici\xF3n fresca: sin repeticiones recientes";
  return { puntos, repeticiones, consejo };
}
function heroSugeridoAlternativo(heroActual) {
  const ROTACION = {
    HERO_3D_OBJECT: ["HERO_SPLIT", "HERO_CINEMATIC"],
    HERO_FLOATING_CARDS: ["HERO_3D_OBJECT", "HERO_SPLIT"],
    HERO_SPATIAL: ["HERO_PRODUCT", "HERO_FULLSCREEN"],
    HERO_PRODUCT: ["HERO_SPATIAL", "HERO_INTERACTIVE"],
    HERO_CINEMATIC: ["HERO_SCROLL_REVEAL", "HERO_3D_OBJECT"],
    HERO_INTERACTIVE: ["HERO_PRODUCT", "HERO_FLOATING_CARDS"],
    HERO_SPLIT: ["HERO_SPATIAL", "HERO_CINEMATIC"],
    HERO_FULLSCREEN: ["HERO_SPLIT", "HERO_SCROLL_REVEAL"],
    HERO_SCROLL_REVEAL: ["HERO_CINEMATIC", "HERO_MINIMAL"],
    HERO_MINIMAL: ["HERO_SPLIT", "HERO_PRODUCT"]
  };
  return (ROTACION[heroActual] ?? ["HERO_SPLIT"])[0];
}
function seccionAntiRepeticion(p) {
  if (!p.repeticiones.length) return "";
  return [
    `# ANTI-REPETICI\xD3N (correcci\xF3n \xA713)`,
    `Composiciones recientes que NO repetir salvo causa expl\xEDcita:`,
    ...p.repeticiones.map((r) => `- ${r.patron} \u2014 usado ${r.veces} de las \xFAltimas 3 generaciones`),
    p.consejo
  ].join("\n");
}
function resumenAntiRepeticion(p) {
  return p.repeticiones.length ? `anti-repetici\xF3n: -${p.puntos} pts (${p.consejo})` : "anti-repetici\xF3n: composici\xF3n fresca";
}

// src/lib/prism/forja/patrones-positivos.ts
var PATRONES_POSITIVOS = [
  { nombre: "floating product", cuando: /\b(producto|saas|app|hardware|fisic|gadget)\b/i, como: "el producto flota sobre el fondo con sombra propia y entra con la primera pantalla", combinaCon: "layered surfaces + floating metrics" },
  { nombre: "oversized typography", cuando: /\b(tipografia|titular|statement|manifiesto|impacto|cinemat)\b/i, como: "el claim principal a tama\xF1o de escena (clamp hasta 9-12vw) con interlineado cerrado", combinaCon: "asymmetric composition" },
  { nombre: "3d hero object", cuando: /\b(3d|objeto 3d|modelo 3d|webgl)\b/i, como: "un objeto 3D central mirable y sutilmente animado como protagonista del hero", combinaCon: "depth stacking + orbital navigation" },
  { nombre: "interactive grid", cuando: /\b(portfolio|galeria|galer[ií]a|proyectos|catalogo|catálogo)\b/i, como: "ret\xEDcula cuyas piezas reaccionan al hover con transform y revelan detalle", combinaCon: "tilt card + spotlight interaction" },
  { nombre: "technical grid", cuando: /\b(tecnolog|tech|arquitectura|ingenier|datos|dashboard)\b/i, como: "ret\xEDcula visible de fondo (l\xEDneas 1px, opacidad baja) que ordena la escena", combinaCon: "oversized typography" },
  { nombre: "layered surfaces", cuando: /\b(capas|profundidad|superficie|spatial)\b/i, como: "superficies apiladas con elevaci\xF3n distinta por capa y sombras que las separan", combinaCon: "floating metrics + depth stacking" },
  { nombre: "asymmetric composition", cuando: /\b(asimetr|dinamic|dinámico|editorial moderno)\b/i, como: "composici\xF3n 60/40 o 70/30 con el foco fuera del centro geom\xE9trico", combinaCon: "oversized typography" },
  { nombre: "floating metrics", cuando: /\b(metric|m[eé]tricas|datos|kpi|n[uú]meros)\b/i, como: "n\xFAmeros clave flotando como cards peque\xF1as sobre el objeto o la escena", combinaCon: "layered surfaces" },
  { nombre: "scroll choreography", cuando: /\b(scroll|animad|animated|narrativa|historia)\b/i, como: "el scroll orquesta entradas, parallax y cambios de escena con timing por categor\xEDa", combinaCon: "sticky storytelling" },
  { nombre: "sticky storytelling", cuando: /\b(narrativa|historia|proceso|pasos|como funciona|cómo funciona)\b/i, como: "una pieza anclada mientras el contenido cambia a su lado", combinaCon: "scroll choreography" },
  { nombre: "horizontal exploration", cuando: /\b(galeria|galer[ií]a|timeline|proceso|pasos|slider)\b/i, como: "una franja que se recorre horizontal (drag o scroll lateral) para contenido secuencial", combinaCon: "interactive grid" },
  { nombre: "magnetic CTA", cuando: /\b(interactiv|cta|boton|botón|conversi[óo]n)\b/i, como: "el bot\xF3n principal se atrae hacia el puntero (\u226412px) y regresa con easing el\xE1stico", combinaCon: "spotlight interaction" },
  { nombre: "tilt card", cuando: /\b(tilt|3d|cards|tarjetas|interactiv)\b/i, como: "las piezas clave se inclinan en 3D (m\xE1x 8\xB0, perspective 1000px) siguiendo al puntero", combinaCon: "interactive grid" },
  { nombre: "spotlight interaction", cuando: /\b(destacad|spotlight|foco|lujo|premium)\b/i, como: "un foco sutil sigue al puntero dentro de la pieza destacada", combinaCon: "magnetic CTA" },
  { nombre: "depth stacking", cuando: /\b(profundidad|capas|stack|pila|planes)\b/i, como: "piezas apiladas con translateZ distinto que se separan al interactuar", combinaCon: "layered surfaces" },
  { nombre: "product UI collage", cuando: /\b(saas|app|software|plataforma|dashboard)\b/i, como: "varias vistas reales del producto superpuestas como collage con profundidad", combinaCon: "floating product + floating metrics" },
  { nombre: "perspective composition", cuando: /\b(perspectiva|3d|escena|spatial)\b/i, como: "todo el bloque comparte perspective y las piezas viven a distinta translateZ", combinaCon: "3d hero object" },
  { nombre: "animated workflow", cuando: /\b(proceso|flujo|workflow|automatiz|integraci[óo]n)\b/i, como: "el flujo del producto se anima paso a paso (nodos que se activan en secuencia)", combinaCon: "sticky storytelling" },
  { nombre: "orbital navigation", cuando: /\b(navegaci[óo]n|explorar|radial|orbita|orbital)\b/i, como: "la navegaci\xF3n secundaria orbita el objeto o el centro de la escena", combinaCon: "3d hero object" },
  { nombre: "canvas din\xE1mico", cuando: /\b(fondo|canvas|ambient|ambiente|vivo)\b/i, como: "fondo con vida sutil (grano, gradiente que respira o part\xEDculas ligeras) SIN robar foco", combinaCon: "oversized typography" }
];
function patronesPara(mensaje, max = 6) {
  const m = (mensaje || "").toLowerCase();
  const hits = PATRONES_POSITIVOS.filter((p) => p.cuando.test(m));
  const resto = PATRONES_POSITIVOS.filter((p) => !p.cuando.test(m));
  return [...hits, ...resto].slice(0, Math.max(3, max));
}
function seccionPatronesPositivos(mensaje, max = 6) {
  const elegidos = patronesPara(mensaje, max);
  return [
    `# BIBLIOTECA POSITIVA (S\xCD usar cuando corresponda \u2014 correcci\xF3n \xA714)`,
    `Patrones sugeridos para ESTE proyecto (elige 2-4 y comb\xEDnalos con intenci\xF3n):`,
    ...elegidos.map((p) => `- ${p.nombre}: ${p.como} \u2192 combina con ${p.combinaCon}`),
    `Regla: un patr\xF3n sin prop\xF3sito es decoraci\xF3n. Cada patr\xF3n que tomes, nombrado en la explicaci\xF3n.`
  ].join("\n");
}

// src/lib/prism/forja/iconos.ts
var ICONOS = [
  { id: "flecha", uso: "avanzar, enlace de secci\xF3n", trazo: '<path d="M5 12h14M13 6l6 6-6 6"/>' },
  { id: "check", uso: "incluido en un plan, paso completado", trazo: '<path d="M4 12.5 9 17.5 20 6.5"/>' },
  { id: "mas", uso: "acorde\xF3n cerrado, a\xF1adir", trazo: '<path d="M12 5v14M5 12h14"/>' },
  { id: "menos", uso: "acorde\xF3n abierto", trazo: '<path d="M5 12h14"/>' },
  { id: "menu", uso: "navegaci\xF3n en m\xF3vil", trazo: '<path d="M4 7h16M4 12h16M4 17h16"/>' },
  { id: "cerrar", uso: "cerrar panel o men\xFA", trazo: '<path d="M6 6l12 12M18 6L6 18"/>' },
  { id: "reloj", uso: "horarios, duraci\xF3n", trazo: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>' },
  { id: "pin", uso: "ubicaci\xF3n, direcci\xF3n", trazo: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>' },
  { id: "telefono", uso: "llamar", trazo: '<path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6 4Z"/>' },
  { id: "correo", uso: "escribir", trazo: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>' },
  { id: "chat", uso: "mensajer\xEDa, soporte", trazo: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/>' },
  { id: "calendario", uso: "reservar, agenda", trazo: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>' },
  { id: "estrella", uso: "valoraci\xF3n, destacado", trazo: '<path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8Z"/>' },
  { id: "escudo", uso: "garant\xEDa, seguridad", trazo: '<path d="M12 3.5 19 6v6c0 4.4-3 7.4-7 8.6-4-1.2-7-4.2-7-8.6V6Z"/><path d="m9 12 2 2 4-4"/>' },
  { id: "rayo", uso: "rapidez, potencia", trazo: '<path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12Z"/>' },
  { id: "diana", uso: "objetivo, precisi\xF3n", trazo: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>' },
  { id: "grafico", uso: "resultados, m\xE9tricas", trazo: '<path d="M4 19h16M7.5 19v-6M12 19V7M16.5 19v-9"/>' },
  { id: "documento", uso: "presupuesto, ficha t\xE9cnica", trazo: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>' },
  { id: "etiqueta", uso: "precio, categor\xEDa", trazo: '<path d="M3.5 11.5V5a1.5 1.5 0 0 1 1.5-1.5h6.5l9 9-8 8Z"/><circle cx="8" cy="8" r="1.4"/>' },
  { id: "carrito", uso: "comprar, pedido", trazo: '<path d="M3 4h2.5l2.2 10.5h9.6L19.5 7H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>' },
  { id: "persona", uso: "equipo, cuenta", trazo: '<circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>' },
  { id: "herramienta", uso: "servicio, taller, mantenimiento", trazo: '<path d="M14.5 3.5a5 5 0 0 0 6 6l-9 9a2.5 2.5 0 0 1-3.5-3.5Z"/><path d="m6 18 .01 0"/>' },
  { id: "hoja", uso: "natural, sostenible, artesano", trazo: '<path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 10-7 10-16Z"/><path d="M14 9.5 7 17"/>' },
  { id: "capas", uso: "profundidad, cat\xE1logo, m\xF3dulos", trazo: '<path d="m12 3.5 8.5 4.5L12 12.5 3.5 8Z"/><path d="m4 12.5 8 4.3 8-4.3M4 16.8l8 4.3 8-4.3"/>' }
];
function iconoPorId(id) {
  return ICONOS.find((i) => i.id === id.toLowerCase());
}
function svgIcono(id, opts = {}) {
  const def = iconoPorId(id);
  if (!def) return "";
  const t = Math.max(12, Math.min(64, opts.tamano ?? 24));
  const clase = opts.clase ? ` class="${opts.clase}"` : ' class="f-ico"';
  const semantica = opts.etiqueta ? ` role="img" aria-label="${opts.etiqueta.replace(/"/g, "&quot;")}"` : ' aria-hidden="true" focusable="false"';
  return `<svg${clase} width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${semantica}>${def.trazo}</svg>`;
}
var CSS_ICONOS = `/* Iconograf\xEDa FORJA \u2014 hereda color y escala con el texto */
.f-ico{width:1.25em;height:1.25em;flex:0 0 auto;vertical-align:-.18em;color:inherit}
.f-ico--acento{color:var(--acento,currentColor)}
.f-ico-caja{display:inline-flex;align-items:center;justify-content:center;
  width:2.75rem;height:2.75rem;border-radius:var(--radius-sm,8px);
  background:var(--surface-2,rgba(127,127,127,.08));color:inherit}
@media (forced-colors: active){.f-ico{forced-color-adjust:auto}}`;
function figuraPlaceholder(alt, opts = {}) {
  const ratio = opts.ratio ?? "4 / 3";
  const clase = opts.clase ?? "f-fig";
  const pie = opts.pie ? `<figcaption class="f-fig-pie">${opts.pie.replace(/</g, "&lt;")}</figcaption>` : "";
  return `<figure class="${clase}" style="--f-ratio:${ratio}"><div class="f-fig-marco" role="img" aria-label="${alt.replace(/"/g, "&quot;")}"></div>${pie}</figure>`;
}
var CSS_IMAGEN = `/* Imagen FORJA \u2014 proporci\xF3n fija: el layout nunca salta */
.f-fig{margin:0;display:flex;flex-direction:column;gap:.5rem}
.f-fig-marco{aspect-ratio:var(--f-ratio,4/3);width:100%;border-radius:var(--radius-md,12px);
  background:
    radial-gradient(120% 90% at 20% 15%, color-mix(in oklab, var(--acento,#556) 38%, transparent), transparent 60%),
    linear-gradient(145deg, var(--surface-2,#e8e8ea), var(--surface-1,#f4f4f6));
  position:relative;overflow:hidden;isolation:isolate}
.f-fig-marco::after{content:"";position:absolute;inset:0;opacity:.28;mix-blend-mode:overlay;
  background-image:radial-gradient(currentColor .6px, transparent .7px);background-size:4px 4px}
.f-fig img,.f-fig-marco img{width:100%;height:100%;object-fit:cover;display:block}
.f-fig-pie{font-size:.85rem;line-height:1.45;color:var(--texto-2,inherit);opacity:.78}
/* cifras siempre alineadas: precios, m\xE9tricas, tablas */
.f-num,td.f-num,.f-precio{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}`;
var POR_SENAL = [
  // el orden importa: lo más específico primero. «bar» dentro de
  // «barbería» y «producto» dentro de un brief de saas mandaban antes el
  // juego equivocado.
  { rx: /\b(barber|peluquer|est[ée]tic|spa|masaje|u[ñn]as)\w*/i, iconos: ["calendario", "reloj", "persona", "estrella", "pin", "etiqueta"] },
  { rx: /\b(saas|software|plataforma|app web|dashboard|api|anal[íi]tic)\w*/i, iconos: ["rayo", "grafico", "escudo", "capas", "check", "diana"] },
  { rx: /\b(taller|reparaci|fontaner|electricist|cerrajer|mec[áa]nic|mantenimiento)\w*/i, iconos: ["herramienta", "reloj", "telefono", "escudo", "check", "pin"] },
  { rx: /\b(cl[íi]nica|dentista|m[ée]dic|veterinar|salud)\w*/i, iconos: ["escudo", "calendario", "persona", "pin", "telefono", "check"] },
  { rx: /\b(gimnas|gym|entrenam|fitness|deporte)\w*/i, iconos: ["rayo", "diana", "calendario", "grafico", "persona", "check"] },
  { rx: /\b(abogad|gestor|consultor|asesor|fintech|banca|seguro)\w*/i, iconos: ["documento", "escudo", "grafico", "check", "persona", "diana"] },
  { rx: /\b(curso|academia|escuela|formaci[óo]n|clases)\w*/i, iconos: ["documento", "calendario", "persona", "check", "grafico", "estrella"] },
  { rx: /\b(portfolio|portafolio|fotograf|dise[ñn]|galer[íi]a|estudio creativo)\w*/i, iconos: ["capas", "flecha", "estrella", "correo", "persona", "diana"] },
  { rx: /\b(restaurante|bar|cafeter|pizzer|panader|pasteler|men[úu]|carta|cocina)\b\w*/i, iconos: ["reloj", "pin", "telefono", "estrella", "hoja", "etiqueta"] },
  { rx: /\b(tienda|ecommerce|shop|venta|cat[áa]logo|carrito|producto)\w*/i, iconos: ["carrito", "etiqueta", "escudo", "flecha", "estrella", "documento"] }
];
var BASE = ["flecha", "check", "mas", "menu", "cerrar", "correo"];
function elegirIconos(mensaje, max = 10) {
  const m = mensaje ?? "";
  const encontrada = POR_SENAL.find((r) => r.rx.test(m));
  const contextuales = encontrada?.iconos ?? ["estrella", "escudo", "grafico", "pin", "reloj", "documento"];
  const iconos = [];
  for (const id of [...BASE, ...contextuales]) {
    if (!iconos.includes(id) && iconoPorId(id)) iconos.push(id);
    if (iconos.length >= Math.max(6, Math.min(24, max))) break;
  }
  return {
    iconos,
    motivo: encontrada ? `juego elegido por se\xF1al de sector (${encontrada.rx.source.slice(2, 28)}\u2026)` : "juego neutro: navegaci\xF3n, confianza y datos"
  };
}
function cssIconografia() {
  return `${CSS_ICONOS}

${CSS_IMAGEN}`;
}
function seccionIconografia(eleccion) {
  if (!eleccion.iconos.length) return "";
  const l = [];
  l.push("# ICONOGRAF\xCDA E IMAGEN COMPILADAS (usar estas piezas, no inventarlas)");
  l.push(`Juego de esta p\xE1gina: ${eleccion.iconos.join(", ")} \u2014 ${eleccion.motivo}.`);
  l.push("Reglas: los iconos van como SVG inline con currentColor y grosor 1.75 (PROHIBIDO usar emojis como iconograf\xEDa: no heredan color ni escalan con el texto). Las im\xE1genes van SIEMPRE con proporci\xF3n declarada.");
  l.push("");
  l.push("## SVG exactos (c\xF3pialos tal cual; cambia solo el tama\xF1o o la clase)");
  for (const id of eleccion.iconos) {
    const def = iconoPorId(id);
    if (def) l.push(`- \`${id}\` (${def.uso}): ${svgIcono(id)}`);
  }
  l.push("");
  l.push("## Imagen con proporci\xF3n fija (sustituye a cualquier <img> sin dimensi\xF3n)");
  l.push(figuraPlaceholder("Descripci\xF3n real de lo que se ve", { ratio: "4 / 3", pie: "Pie opcional con un dato concreto" }));
  l.push("");
  l.push("La CSS de ambos sistemas viaja en el bloque de CSS determinista: incl\xFAyela y no la reescribas.");
  return l.join("\n");
}
function resumenIconografia(eleccion) {
  return `iconos=${eleccion.iconos.length}`;
}

// src/lib/prism/forja/plano-contenido.ts
var PRESUPUESTOS = {
  borrador: {
    nivel: "borrador",
    minSecciones: 4,
    maxSecciones: 6,
    minItemsColeccion: 3,
    lineasObjetivo: [250, 450],
    maxTokensImplementacion: 8192,
    estadosExigidos: [":hover", ":focus-visible"]
  },
  produccion: {
    nivel: "produccion",
    minSecciones: 7,
    maxSecciones: 10,
    minItemsColeccion: 6,
    lineasObjetivo: [700, 1100],
    maxTokensImplementacion: 16384,
    estadosExigidos: [":hover", ":focus-visible", ":active", "[aria-expanded]"]
  },
  showcase: {
    nivel: "showcase",
    minSecciones: 9,
    maxSecciones: 13,
    minItemsColeccion: 8,
    lineasObjetivo: [1100, 1800],
    maxTokensImplementacion: 24576,
    estadosExigidos: [":hover", ":focus-visible", ":active", ":disabled", "[aria-expanded]"]
  }
};
var RX_PRECIO = /(?:[$€£]\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\b\d{1,4}(?:[.,]\d{1,2})?\s?(?:€|eur|euros|usd|d[óo]lares?|pesos)\b)/gi;
var RX_TEL = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g;
var RX_CORREO = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
var RX_URL = /https?:\/\/[^\s<>"']+|\b(?:www\.)[^\s<>"']+/gi;
var RX_HORARIO = /\b(?:\d{1,2}(?::\d{2})?\s?(?:h|hs|am|pm)?\s?(?:a|-|–|hasta)\s?\d{1,2}(?::\d{2})?\s?(?:h|hs|am|pm)?)\b|\b(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)(?:\s?(?:a|-|–)\s?(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo))?\b/gi;
var RX_CANTIDAD = /\b\d{1,4}\s+(?:a[ñn]os|barberos?|mesas?|habitaciones?|productos?|servicios?|clientes?|empleados?|sucursales?|sedes?|proyectos?|plazas?|profesionales?|modelos?|planes?)\b/gi;
var RX_CIUDAD = /\b(?:en|desde)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]{2,}(?:\s+de\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]{2,})?)/g;
var RX_MARCA = /(?:se llama|llamad[ao]|marca|nombre)\s+[«"“']?([\wÁÉÍÓÚÑáéíóúñ .&-]{2,40})[»"”']?/i;
var RX_ENUMERACION = /(?:servicios?|productos?|secciones?|men[úu]|carta|planes?|incluye|ofrecemos|vendemos|hacemos)\s*(?:de|:|son|como)?\s*([^.;\n]{10,180})/gi;
function unico(xs, tope) {
  const vistos = /* @__PURE__ */ new Set();
  const out = [];
  for (const x of xs) {
    const k = x.trim().replace(/\s+/g, " ");
    if (!k || vistos.has(k.toLowerCase())) continue;
    vistos.add(k.toLowerCase());
    out.push(k);
    if (out.length >= tope) break;
  }
  return out;
}
function extraerHechos(mensaje) {
  const m = (mensaje ?? "").slice(0, 4e3);
  const vacio = {
    precios: [],
    telefonos: [],
    correos: [],
    urls: [],
    ciudades: [],
    horarios: [],
    enumeraciones: [],
    cantidades: [],
    marca: "",
    resumen: "sin hechos declarados en el brief"
  };
  if (!m.trim()) return vacio;
  try {
    const precios = unico(m.match(RX_PRECIO) ?? [], 12);
    const correos = unico(m.match(RX_CORREO) ?? [], 3);
    const urls = unico(m.match(RX_URL) ?? [], 3);
    const limpio = m.replace(RX_CORREO, " ").replace(RX_PRECIO, " ");
    const telefonos = unico((limpio.match(RX_TEL) ?? []).filter((t) => t.replace(/\D/g, "").length >= 7), 3);
    const horarios = unico(m.match(RX_HORARIO) ?? [], 6);
    const cantidades = unico(m.match(RX_CANTIDAD) ?? [], 6);
    const ciudades = unico(
      [...m.matchAll(RX_CIUDAD)].map((x) => x[1]).filter((c) => !/^(El|La|Los|Las|Un|Una)$/i.test(c)),
      3
    );
    const enumeraciones = unico(
      [...m.matchAll(RX_ENUMERACION)].map((x) => x[1].trim()),
      6
    );
    const marca = (RX_MARCA.exec(m)?.[1] ?? "").trim();
    const partes = [];
    if (marca) partes.push(`marca \xAB${marca}\xBB`);
    if (precios.length) partes.push(`${precios.length} precio(s)`);
    if (enumeraciones.length) partes.push(`${enumeraciones.length} enumeraci\xF3n(es)`);
    if (ciudades.length) partes.push(`ciudad ${ciudades[0]}`);
    if (horarios.length) partes.push(`${horarios.length} horario(s)`);
    if (telefonos.length || correos.length) partes.push("contacto declarado");
    return {
      precios,
      telefonos,
      correos,
      urls,
      ciudades,
      horarios,
      enumeraciones,
      cantidades,
      marca,
      resumen: partes.length ? partes.join(" \xB7 ") : "sin hechos declarados en el brief"
    };
  } catch {
    return vacio;
  }
}
var S = (id, nombre, objetivo, coleccion, minItems, composicion, slots) => ({
  id,
  nombre,
  objetivo,
  coleccion,
  minItems,
  composicion,
  slots: slots.map(([sid, que, obligatorio]) => ({ id: sid, que, obligatorio }))
});
var CATALOGO_SECCIONES = [
  S(
    "nav",
    "Navegaci\xF3n",
    "orientar y dar acceso a la acci\xF3n principal",
    false,
    0,
    "barra con marca a la izquierda, 3-5 enlaces y UNA acci\xF3n primaria; estado activo visible",
    [
      ["marca", "nombre de la marca (texto o logotipo SVG inline)", true],
      ["enlaces", "3-5 enlaces a anclas reales de la p\xE1gina", true],
      ["cta", "acci\xF3n primaria diferenciada del resto", true],
      ["movil", "men\xFA accesible a 375px (toggle con aria-expanded)", true]
    ]
  ),
  S(
    "hero",
    "Hero",
    "decir qu\xE9 es esto y para qui\xE9n en 10 segundos",
    false,
    0,
    "el tipo de hero lo fija el contrato de experiencia; PROHIBIDO el centrado por defecto si el contrato dice otro",
    [
      ["claim", "titular concreto (nada de \xABBienvenido a nuestra web\xBB)", true],
      ["subclaim", "una frase que a\xF1ade informaci\xF3n nueva, no que repite el claim", true],
      ["cta-doble", "acci\xF3n primaria + secundaria degradada visualmente", true],
      ["prueba", "se\xF1al de confianza inmediata: dato, sello, n\xBA de clientes, valoraci\xF3n", false]
    ]
  ),
  S(
    "prueba",
    "Prueba social",
    "quitar el miedo antes de pedir nada",
    true,
    3,
    "logos, valoraciones o cifras en franja horizontal; nunca tres tarjetas gemelas",
    [["items", "logos / valoraciones / m\xE9tricas con su fuente", true]]
  ),
  S(
    "oferta",
    "Qu\xE9 ofrecemos",
    "explicar el cat\xE1logo real con datos",
    true,
    6,
    "ret\xEDcula desigual: la pieza m\xE1s importante ocupa el doble; el resto en m\xF3dulos menores",
    [
      ["items", "cada \xEDtem con nombre, descripci\xF3n de 1-2 l\xEDneas y dato duro (precio, duraci\xF3n, formato)", true],
      ["precio", "precio o rango cuando el brief lo declare", false],
      ["cta-item", "acci\xF3n por \xEDtem (ver, reservar, a\xF1adir)", false]
    ]
  ),
  S(
    "como-funciona",
    "C\xF3mo funciona",
    "eliminar la incertidumbre del proceso",
    true,
    3,
    "secuencia real (y SOLO entonces numerada): paso, qu\xE9 hace el usuario, qu\xE9 recibe",
    [["pasos", "3-5 pasos con verbo de acci\xF3n y resultado", true]]
  ),
  S(
    "detalle",
    "Pieza en profundidad",
    "demostrar en vez de prometer",
    false,
    0,
    "bloque ancho con imagen/objeto a un lado y lista de especificaciones al otro (no sim\xE9trico)",
    [
      ["especificaciones", "6+ especificaciones o caracter\xEDsticas con su valor", true],
      ["visual", "imagen, objeto 3D o UI del producto con aspect-ratio fijo", true]
    ]
  ),
  S(
    "equipo",
    "Qui\xE9n est\xE1 detr\xE1s",
    "poner cara y autoridad",
    true,
    3,
    "retrato + nombre + rol + una l\xEDnea con algo espec\xEDfico de esa persona",
    [["personas", "nombre, rol y un detalle concreto por persona", true]]
  ),
  S(
    "testimonios",
    "Testimonios",
    "voz del cliente con contexto",
    true,
    3,
    "citas de longitud desigual; cada una con nombre, rol y resultado obtenido",
    [["citas", "cita + autor + rol + resultado medible", true]]
  ),
  S(
    "precios",
    "Precios",
    "cerrar la decisi\xF3n econ\xF3mica",
    true,
    3,
    "tabla comparativa o planes con una recomendaci\xF3n marcada; precios alineados tabularmente",
    [
      ["planes", "nombre, precio, qu\xE9 incluye (5+ l\xEDneas), a qui\xE9n sirve", true],
      ["destacado", "un plan recomendado, marcado con raz\xF3n (no solo con color)", true]
    ]
  ),
  S(
    "faq",
    "Preguntas frecuentes",
    "responder las objeciones reales antes de que frenen",
    true,
    6,
    "acorde\xF3n accesible (<details>/<summary> o bot\xF3n con aria-expanded)",
    [["preguntas", "6+ preguntas espec\xEDficas del negocio, no gen\xE9ricas", true]]
  ),
  S(
    "ubicacion",
    "D\xF3nde estamos",
    "hacer posible la visita",
    false,
    0,
    "direcci\xF3n + horarios en tabla legible + c\xF3mo llegar; mapa solo como placeholder est\xE1tico",
    [
      ["direccion", "direcci\xF3n completa", true],
      ["horarios", "horarios por d\xEDa en formato tabular", true],
      ["contacto", "tel\xE9fono y correo como enlaces tel:/mailto:", true]
    ]
  ),
  S(
    "cta-final",
    "Cierre",
    "una \xFAltima acci\xF3n sin ruido alrededor",
    false,
    0,
    "bloque de ancho completo, una sola acci\xF3n, cero enlaces competidores",
    [
      ["claim", "promesa concreta, distinta a la del hero", true],
      ["cta", "la misma acci\xF3n primaria de arriba, mismo verbo", true]
    ]
  ),
  S(
    "footer",
    "Pie",
    "cerrar legal y navegacionalmente",
    false,
    0,
    "3-4 columnas con enlaces reales, legales y contacto; nunca un pie de una l\xEDnea",
    [
      ["columnas", "3-4 columnas de enlaces agrupados por tema", true],
      ["legal", "aviso legal, privacidad y cookies", true],
      ["contacto", "contacto y redes con etiqueta accesible", true]
    ]
  )
];
function sec(id) {
  return CATALOGO_SECCIONES.find((x) => x.id === id);
}
var PLANTILLAS = {
  saas: ["nav", "hero", "prueba", "oferta", "como-funciona", "detalle", "precios", "testimonios", "faq", "cta-final", "footer"],
  ecommerce: ["nav", "hero", "oferta", "detalle", "prueba", "testimonios", "faq", "ubicacion", "cta-final", "footer"],
  restaurante: ["nav", "hero", "oferta", "detalle", "equipo", "testimonios", "ubicacion", "faq", "cta-final", "footer"],
  local: ["nav", "hero", "oferta", "como-funciona", "equipo", "testimonios", "ubicacion", "faq", "cta-final", "footer"],
  portfolio: ["nav", "hero", "oferta", "detalle", "equipo", "testimonios", "cta-final", "footer"],
  agencia: ["nav", "hero", "prueba", "oferta", "como-funciona", "detalle", "testimonios", "precios", "faq", "cta-final", "footer"],
  educacion: ["nav", "hero", "prueba", "oferta", "como-funciona", "equipo", "precios", "testimonios", "faq", "cta-final", "footer"],
  fintech: ["nav", "hero", "prueba", "detalle", "oferta", "como-funciona", "precios", "faq", "cta-final", "footer"],
  general: ["nav", "hero", "prueba", "oferta", "como-funciona", "detalle", "testimonios", "faq", "cta-final", "footer"]
};
var RX_LOCAL = /\b(panader|pasteler|pizzer|helader|carnicer|pescader|florister|boutique|barber|peluquer|est[ée]tic|tatuaj|tattoo|taller|ferreter|gimnas|gym|autolavado|hostal|cl[íi]nica|dentista|veterinar|abogad|gestor[íi]a|fontaner|electricist|mudanz|cerrajer)\w*/i;
var RX_RESTAURANTE = /\b(restaurante|bar|cafeter[íi]a|pizzer|sushi|men[úu]|carta|cocina|tapas)\b/i;
var RX_TIENDA = /\b(tienda|ecommerce|e-commerce|shop|venta|cat[áa]logo|carrito)\b/i;
var RX_PORTFOLIO = /\b(portfolio|portafolio|galer[íi]a|fotograf|ilustrad|dise[ñn]ador)\b/i;
var RX_SAAS = /\b(saas|startup|software|plataforma|app web|dashboard|api)\b/i;
var RX_AGENCIA = /\b(agencia|estudio creativo|consultor|marketing)\b/i;
var RX_EDU = /\b(curso|academia|escuela|formaci[óo]n|bootcamp|clases)\b/i;
var RX_FINTECH = /\b(fintech|banca|banco|inversi[óo]n|cripto|seguros?)\b/i;
function verticalDeContenido(mensaje) {
  const m = (mensaje ?? "").toLowerCase();
  if (RX_RESTAURANTE.test(m)) return "restaurante";
  if (RX_SAAS.test(m)) return "saas";
  if (RX_TIENDA.test(m)) return "ecommerce";
  if (RX_PORTFOLIO.test(m)) return "portfolio";
  if (RX_AGENCIA.test(m)) return "agencia";
  if (RX_EDU.test(m)) return "educacion";
  if (RX_FINTECH.test(m)) return "fintech";
  if (RX_LOCAL.test(m)) return "local";
  return "general";
}
var RX_PIDE_DETALLE = /\b(detallad|completa|completo|profesional|producci[óo]n|extensa|larga|todas las secciones|full|exhaustiv|premium|showcase|impresionante|espectacular)\b/i;
var RX_PIDE_RAPIDO = /\b(r[áa]pido|boceto|borrador|simple|b[áa]sic|prototipo|mockup r[áa]pido|solo el hero)\b/i;
function nivelDeDetalle(mensaje, forzado) {
  if (forzado) return forzado;
  const m = mensaje ?? "";
  if (RX_PIDE_RAPIDO.test(m)) return "borrador";
  if (RX_PIDE_DETALLE.test(m) || m.length > 320) return "showcase";
  return "produccion";
}
function construirPlanoContenido(mensaje, opts = {}) {
  const hechos = extraerHechos(mensaje);
  const vertical = opts.verticalForzado ?? verticalDeContenido(mensaje);
  const nivel2 = nivelDeDetalle(mensaje, opts.nivel);
  const presupuesto = PRESUPUESTOS[nivel2];
  const razones = [`vertical de contenido \xAB${vertical}\xBB`, `nivel de detalle \xAB${nivel2}\xBB`];
  const ids2 = PLANTILLAS[vertical] ?? PLANTILLAS.general;
  let secciones = ids2.map(sec).filter((x) => Boolean(x));
  const asegurar = (id, porQue) => {
    if (secciones.some((s2) => s2.id === id)) return;
    const s = sec(id);
    if (!s) return;
    const pos = Math.max(1, secciones.length - 2);
    secciones = [...secciones.slice(0, pos), s, ...secciones.slice(pos)];
    razones.push(`secci\xF3n \xAB${s.nombre}\xBB a\xF1adida: ${porQue}`);
  };
  if (hechos.precios.length >= 2) asegurar("precios", `el brief declara ${hechos.precios.length} precios`);
  if (hechos.horarios.length || hechos.ciudades.length) asegurar("ubicacion", "el brief declara horario o ciudad");
  if (hechos.cantidades.some((c) => /barbero|empleado|profesional/i.test(c))) asegurar("equipo", "el brief declara personas");
  const esenciales = /* @__PURE__ */ new Set(["nav", "hero", "oferta", "cta-final", "footer"]);
  while (secciones.length > presupuesto.maxSecciones + 2) {
    const i = secciones.map((s) => s.id).findIndex((id) => !esenciales.has(id));
    if (i < 0) break;
    razones.push(`secci\xF3n \xAB${secciones[i].nombre}\xBB recortada por el nivel \xAB${nivel2}\xBB`);
    secciones.splice(i, 1);
  }
  secciones = secciones.map((s) => {
    if (!s.coleccion) return s;
    const porHechos = s.id === "oferta" && hechos.precios.length > s.minItems ? hechos.precios.length : 0;
    return { ...s, minItems: Math.max(s.minItems, presupuesto.minItemsColeccion, porHechos) };
  });
  const resumen = [
    `contenido=${vertical}`,
    `detalle=${nivel2}`,
    `secciones=${secciones.length}`,
    `\xEDtems m\xEDn.=${presupuesto.minItemsColeccion}`,
    `l\xEDneas=${presupuesto.lineasObjetivo[0]}-${presupuesto.lineasObjetivo[1]}`,
    `hechos: ${hechos.resumen}`
  ].join(" \xB7 ");
  return { vertical, nivel: nivel2, presupuesto, hechos, secciones, razones, resumen };
}
function seccionPlanoContenido(plano) {
  const l = [];
  l.push("# PLANO DE CONTENIDO (obligatorio \u2014 el QA de detalle lo verifica)");
  l.push(
    `Nivel de detalle: ${plano.nivel.toUpperCase()} \xB7 ${plano.secciones.length} secciones \xB7 m\xEDnimo ${plano.presupuesto.minItemsColeccion} piezas reales en cada secci\xF3n de colecci\xF3n \xB7 extensi\xF3n objetivo ${plano.presupuesto.lineasObjetivo[0]}-${plano.presupuesto.lineasObjetivo[1]} l\xEDneas.`
  );
  l.push(
    "Una secci\xF3n que no cumpla su m\xEDnimo de piezas cuenta como DEFECTO, igual que un contraste roto. No recortes secciones para ahorrar: si no cabe todo, reduce decoraci\xF3n, nunca contenido."
  );
  const h = plano.hechos;
  const hechos = [];
  if (h.marca) hechos.push(`marca: ${h.marca}`);
  if (h.precios.length) hechos.push(`precios declarados (\xDASALOS TAL CUAL): ${h.precios.join(", ")}`);
  if (h.enumeraciones.length) hechos.push(`enumeraciones del brief: ${h.enumeraciones.join(" | ")}`);
  if (h.cantidades.length) hechos.push(`cantidades: ${h.cantidades.join(", ")}`);
  if (h.ciudades.length) hechos.push(`ubicaci\xF3n: ${h.ciudades.join(", ")}`);
  if (h.horarios.length) hechos.push(`horarios: ${h.horarios.join(", ")}`);
  if (h.telefonos.length) hechos.push(`tel\xE9fono: ${h.telefonos.join(", ")}`);
  if (h.correos.length) hechos.push(`correo: ${h.correos.join(", ")}`);
  if (hechos.length) {
    l.push("");
    l.push("## Hechos declarados por el usuario \u2014 son DATOS, no sugerencias");
    l.push(...hechos.map((x) => `- ${x}`));
    l.push("Inventar un dato que contradiga a estos es un defecto grave. Lo que no est\xE9 aqu\xED NO debe presentarse como un hecho real: usa copy conceptual claramente no factual o un placeholder expl\xEDcito como [PRECIO], [TEL\xC9FONO], [HORARIO]. En modo demo, cualquier dato ficticio debe quedar marcado como DEMO. Nunca inventes cifras, nombres, horarios, precios o contacto que parezcan reales.");
  }
  l.push("");
  l.push("## Secciones obligatorias, en este orden");
  plano.secciones.forEach((s, i) => {
    l.push(`${i + 1}. **${s.nombre}** (id \`${s.id}\`) \u2014 ${s.objetivo}`);
    l.push(`   Composici\xF3n: ${s.composicion}`);
    if (s.coleccion) l.push(`   M\xEDnimo ${s.minItems} piezas REALES y DISTINTAS entre s\xED (distinto texto, distinto dato, distinta longitud).`);
    const obl = s.slots.filter((x) => x.obligatorio).map((x) => x.que);
    const opt = s.slots.filter((x) => !x.obligatorio).map((x) => x.que);
    if (obl.length) l.push(`   Debe contener: ${obl.join("; ")}.`);
    if (opt.length) l.push(`   Si el brief lo permite: ${opt.join("; ")}.`);
  });
  l.push("");
  l.push("## Acabado exigido en TODA la p\xE1gina");
  l.push(`- Estados en CSS: ${plano.presupuesto.estadosExigidos.join(", ")} \u2014 visibles, no solo un cambio de opacidad.`);
  l.push("- Im\xE1genes con aspect-ratio fijo y object-fit; nunca un <img> sin dimensi\xF3n que salte el layout.");
  l.push("- Iconos como SVG inline con currentColor y stroke coherente; nunca emojis como iconograf\xEDa.");
  l.push("- Todo dato tabular alineado (font-variant-numeric: tabular-nums en precios y cifras).");
  l.push("- Casos borde tratados: qu\xE9 se ve si una lista est\xE1 vac\xEDa, qu\xE9 dice un error de formulario.");
  l.push("- Cada secci\xF3n con un ancla (`id`) que coincide con los enlaces de la navegaci\xF3n.");
  return l.join("\n");
}
function resumenPlano(plano) {
  return plano.resumen;
}

// src/lib/prism/forja/objeto-3d.ts
var DEFS2 = [
  {
    id: "MONOLITO",
    nombre: "Monolito",
    descripcion: "losa vertical giratoria con caras en degradado y arista luminosa",
    familias: ["spatial", "3d-showcase", "immersive", "minimal"],
    cuando: /\b(sólid|solid|roca|monolit|arquitectura|bloque|ladrill|pan|masa|horno|ceramic|cerám)\b/i,
    transmite: "peso y solidez: la marca es una presencia f\xEDsica"
  },
  {
    id: "ORBE",
    nombre: "Orbe",
    descripcion: "esfera luminosa con n\xFAcleo brillante y anillo orbital",
    familias: ["product", "interactive", "spatial", "cinematic"],
    cuando: /\b(ia|ai|inteligencia|datos?|nube|cloud|global|planeta|energ[ií]a|futurist|futurista)\b/i,
    transmite: "energ\xEDa viva y continuidad: el sistema respira"
  },
  {
    id: "CAPAS_FLOTANTES",
    nombre: "Capas flotantes",
    descripcion: "planos apilados a distintas profundidades que respiran en desfase",
    familias: ["spatial", "product", "modular", "dashboard"],
    cuando: /\b(capas|layers|apilad|profundidad|secciones|organiza|estructura|panader[íi]a|carta|men[uú])\b/i,
    transmite: "jerarqu\xEDa legible: cada capa explica una parte"
  },
  {
    id: "TARJETA_DOBLADA",
    nombre: "Tarjeta doblada",
    descripcion: "tarjeta doblada en dos planos como p\xE1gina de papel flotante",
    familias: ["editorial", "product", "minimal", "modular"],
    cuando: /\b(carta|men[uú]|dobl|papel|p[aá]gina|recet|noticia|revista|libro|historia)\b/i,
    transmite: "contenido tangible: lo digital con manos de papel"
  },
  {
    id: "ANILLO_ORBITAL",
    nombre: "Anillo orbital",
    descripcion: "anillo inclinado con sat\xE9lite que orbita alrededor de un n\xFAcleo",
    familias: ["product", "interactive", "cinematic", "3d-showcase"],
    cuando: /\b([oó]rbita|anillo|ciclo|proceso|flujo|paso a paso|entrega|env[íi]o|ruta)\b/i,
    transmite: "proceso continuo: todo gira alrededor del cliente"
  },
  {
    id: "TORRE_ISOMETRICA",
    nombre: "Torre isom\xE9trica",
    descripcion: "tres losas apiladas en vista isom\xE9trica con brillo superior",
    familias: ["dashboard", "modular", "spatial", "product"],
    cuando: /\b(dashboard|panel|m[eé]tric|datos?|informe|estad[íi]stic|crecimient|escala|niveles)\b/i,
    transmite: "acumulaci\xF3n ordenada: nivel sobre nivel"
  },
  {
    id: "CUBO_GIRATORIO",
    nombre: "Cubo giratorio",
    descripcion: "cubo con tres caras visibles en rotaci\xF3n lenta y continua",
    familias: ["3d-showcase", "interactive", "modular", "immersive"],
    cuando: /\b(cubo|3d|rotar|girar|girator|giro|bloque|volumen)\b/i,
    transmite: "exploraci\xF3n: se puede mirar desde todos los lados"
  },
  {
    id: "CONSTELACION",
    nombre: "Constelaci\xF3n",
    descripcion: "piezas peque\xF1as dispersas a distintas profundidades que titilan",
    familias: ["immersive", "cinematic", "interactive", "minimal"],
    cuando: /\b(constelaci|red|comunidad|redes|conexi[óo]n|part[íi]cula|galer[ií]a|coleccion|variedad|sabores)\b/i,
    transmite: "diversidad con unidad: muchas piezas, un sistema"
  }
];
function defObjeto3d(id) {
  return DEFS2.find((d) => d.id === id);
}
function catalogoObjetos3d() {
  return [...DEFS2];
}
function elegirObjeto3d(e, familia, mensaje = "", historial2 = []) {
  const m = (mensaje || "").toLowerCase();
  const puntuados = DEFS2.map((d, i) => {
    let puntos = 0;
    if (d.familias.includes(familia)) puntos += 3;
    if (d.cuando?.test(m)) puntos += 2.5;
    if (e.object.use3d && (d.id === "MONOLITO" || d.id === "CUBO_GIRATORIO" || d.id === "ORBE")) puntos += 1;
    if (e.spatial.depth >= 0.7 && (d.id === "CAPAS_FLOTANTES" || d.id === "TORRE_ISOMETRICA" || d.id === "CONSTELACION")) puntos += 0.5;
    if (e.surface.elevation >= 0.6 && (d.id === "ORBE" || d.id === "ANILLO_ORBITAL")) puntos += 0.5;
    const recientes = historial2.slice(-2);
    puntos -= recientes.filter((h) => h === d.id).length * 5;
    return { d, puntos, i };
  });
  puntuados.sort((a, b) => b.puntos - a.puntos || a.i - b.i);
  const ganador = puntuados[0];
  const alternativas = puntuados.slice(1, 3).map((p) => p.d.id);
  const motivo = [
    `familia ${familia} \u2192 objeto natural de la familia`,
    ganador.d.cuando?.test(m) ? "se\xF1al l\xE9xica de la petici\xF3n" : "",
    `transmite: ${ganador.d.transmite.toLowerCase()}`
  ].filter(Boolean).join(" \xB7 ");
  return {
    id: ganador.d.id,
    nombre: ganador.d.nombre,
    descripcion: ganador.d.descripcion,
    transmite: ganador.d.transmite,
    motivo,
    alternativas,
    html: htmlObjeto3d(ganador.d.id),
    css: cssObjeto3d(ganador.d.id)
  };
}
var BASE_CSS = `/* Objeto 3D forjado por FORJA (0 librer\xEDas, ~2 KB) */
.f3d { --f3d-a: var(--acento, #6366f1); --f3d-a2: var(--acento-suave, color-mix(in srgb, var(--f3d-a) 55%, white)); --f3d-tinta: var(--foreground, #0f172a);
  position: relative; width: min(var(--f3d-tam, 320px), 88vw); aspect-ratio: 1 / 1; margin-inline: auto;
  perspective: var(--perspective, 1200px); display: grid; place-items: center; pointer-events: none; }
.f3d *, .f3d *::before, .f3d *::after { transform-style: preserve-3d; }
@media (prefers-reduced-motion: no-preference) {
  .f3d .f3d-flota { animation: f3d-flota 7s ease-in-out infinite; animation-delay: calc(var(--i, 0) * .45s); }
}
@keyframes f3d-flota { 0%,100% { transform: translateY(-7px); } 50% { transform: translateY(7px); } }`;
var REDUCED_GUARD = `@media (prefers-reduced-motion: reduce) {
  .f3d *, .f3d *::before, .f3d *::after { animation: none !important; transition: none !important; }
  .f3d { transform: none !important; }
}`;
function envolverHtml(interior, etiqueta) {
  return `<!-- Objeto 3D FORJA \xB7 ${etiqueta} \u2014 decorativo, 0 JS, 0 librer\xEDas -->
<div class="f3d" role="presentation" aria-hidden="true">${interior}</div>`;
}
function htmlObjeto3d(id) {
  switch (id) {
    case "MONOLITO":
      return envolverHtml(
        `<div class="f3d-flota f3d-mono">
  <div class="f3d-mono-cara f3d-mono-frontal"></div>
  <div class="f3d-mono-cara f3d-mono-lateral"></div>
  <div class="f3d-mono-cara f3d-mono-top"></div>
</div>`,
        "monolito"
      );
    case "ORBE":
      return envolverHtml(
        `<div class="f3d-flota f3d-orbe-wrap">
  <div class="f3d-orbe"></div>
  <div class="f3d-orbe-anillo"></div>
  <div class="f3d-orbe-satelita"></div>
</div>`,
        "orbe"
      );
    case "CAPAS_FLOTANTES":
      return envolverHtml(
        `<div class="f3d-capas">
  <div class="f3d-capa f3d-flota" style="--i:0"></div>
  <div class="f3d-capa f3d-flota" style="--i:1"></div>
  <div class="f3d-capa f3d-flota" style="--i:2"></div>
  <div class="f3d-capa f3d-capa-top f3d-flota" style="--i:3"></div>
</div>`,
        "capas flotantes"
      );
    case "TARJETA_DOBLADA":
      return envolverHtml(
        `<div class="f3d-flota f3d-tarj">
  <div class="f3d-tarj-mitad f3d-tarj-izq"><span class="f3d-tarj-linea"></span><span class="f3d-tarj-linea"></span><span class="f3d-tarj-linea"></span></div>
  <div class="f3d-tarj-mitad f3d-tarj-der"><span class="f3d-tarj-linea"></span><span class="f3d-tarj-linea"></span></div>
</div>`,
        "tarjeta doblada"
      );
    case "ANILLO_ORBITAL":
      return envolverHtml(
        `<div class="f3d-anillo-wrap">
  <div class="f3d-anillo"></div>
  <div class="f3d-anillo-nucleo"></div>
  <div class="f3d-anillo-satelita"></div>
</div>`,
        "anillo orbital"
      );
    case "TORRE_ISOMETRICA":
      return envolverHtml(
        `<div class="f3d-torre">
  <div class="f3d-losa f3d-flota" style="--i:0"></div>
  <div class="f3d-losa f3d-flota" style="--i:1"></div>
  <div class="f3d-losa f3d-losa-top f3d-flota" style="--i:2"></div>
</div>`,
        "torre isom\xE9trica"
      );
    case "CUBO_GIRATORIO":
      return envolverHtml(
        `<div class="f3d-cubo">
  <div class="f3d-cubo-cara f3d-cubo-top"></div>
  <div class="f3d-cubo-cara f3d-cubo-frontal"></div>
  <div class="f3d-cubo-cara f3d-cubo-lateral"></div>
</div>`,
        "cubo giratorio"
      );
    case "CONSTELACION":
      return envolverHtml(
        `<div class="f3d-cons">
  <div class="f3d-cons-pieza f3d-flota" style="--i:0"></div>
  <div class="f3d-cons-pieza f3d-flota" style="--i:1"></div>
  <div class="f3d-cons-pieza f3d-flota" style="--i:2"></div>
  <div class="f3d-cons-pieza f3d-cons-mayor f3d-flota" style="--i:3"></div>
  <div class="f3d-cons-punto" style="--i:0"></div>
  <div class="f3d-cons-punto" style="--i:1"></div>
  <div class="f3d-cons-punto" style="--i:2"></div>
</div>`,
        "constelaci\xF3n"
      );
    default:
      return "";
  }
}
function cssObjeto3d(id) {
  const formas = {
    MONOLITO: `.f3d-mono { width: 34%; height: 62%; position: relative; transform: rotateX(-8deg) rotateY(26deg); }
@media (prefers-reduced-motion: no-preference) { .f3d-mono { animation: f3d-giro 14s ease-in-out infinite; } }
@keyframes f3d-giro { 0%,100% { transform: rotateX(-8deg) rotateY(14deg); } 50% { transform: rotateX(-8deg) rotateY(38deg); } }
.f3d-mono-cara { position: absolute; inset: 0; border-radius: 10px; }
.f3d-mono-frontal { background: linear-gradient(160deg, color-mix(in srgb, var(--f3d-a) 82%, black) 0%, var(--f3d-a) 58%, var(--f3d-a2) 100%); box-shadow: var(--shadow-deep, 0 24px 48px rgba(2,6,23,.28)); }
.f3d-mono-lateral { width: 22%; left: auto; right: -22%; border-radius: 0 10px 10px 0; background: linear-gradient(180deg, color-mix(in srgb, var(--f3d-a) 60%, black), color-mix(in srgb, var(--f3d-a) 78%, black)); transform-origin: left center; transform: rotateY(78deg); }
.f3d-mono-top { height: 12%; bottom: auto; top: -12%; border-radius: 10px 10px 2px 2px; background: linear-gradient(90deg, color-mix(in srgb, white 62%, var(--f3d-a2)), var(--f3d-a2)); transform-origin: center bottom; transform: rotateX(-84deg); }
.f3d-mono::after { content: ""; position: absolute; left: 0; top: 8%; bottom: 8%; width: 3px; border-radius: 3px; background: linear-gradient(180deg, transparent, color-mix(in srgb, white 85%, var(--f3d-a2)), transparent); filter: blur(.4px); }`,
    ORBE: `.f3d-orbe-wrap { width: 52%; aspect-ratio: 1; position: relative; }
.f3d-orbe { width: 100%; aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, white 0%, var(--f3d-a2) 26%, var(--f3d-a) 62%, color-mix(in srgb, var(--f3d-a) 55%, black) 100%);
  box-shadow: inset -18px -22px 48px color-mix(in srgb, black 32%, transparent), var(--shadow-deep, 0 24px 48px rgba(2,6,23,.28)); }
.f3d-orbe::after { content: ""; position: absolute; inset: 12%; border-radius: 50%; background: radial-gradient(circle at 34% 30%, color-mix(in srgb, white 80%, transparent) 0%, transparent 42%); }
.f3d-orbe-anillo { position: absolute; inset: -16%; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--f3d-a) 55%, transparent); border-top-color: var(--f3d-a2); transform: rotateX(72deg); }
@media (prefers-reduced-motion: no-preference) { .f3d-orbe-anillo { animation: f3d-orbita 9s linear infinite; } }
@keyframes f3d-orbita { from { transform: rotateX(72deg) rotateZ(0deg); } to { transform: rotateX(72deg) rotateZ(360deg); } }
.f3d-orbe-satelita { position: absolute; top: 4%; left: 50%; width: 12%; aspect-ratio: 1; margin-left: -6%; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, white, var(--f3d-a2)); box-shadow: var(--shadow-soft, 0 4px 12px rgba(2,6,23,.18)); }`,
    CAPAS_FLOTANTES: `.f3d-capas { width: 62%; aspect-ratio: 4 / 3; position: relative; transform: rotateX(56deg) rotateZ(-32deg); transform-style: preserve-3d; }
.f3d-capa { position: absolute; inset: 0; border-radius: 24px;
  background: color-mix(in srgb, var(--f3d-a) 26%, var(--f3d-tinta) 6%); border: 1.5px solid color-mix(in srgb, var(--f3d-a) 45%, transparent); }
.f3d-capa:nth-child(1) { transform: translateZ(calc(-1 * var(--depth-3, 60px))); }
.f3d-capa:nth-child(2) { transform: translateZ(calc(-1 * var(--depth-2, 40px))); inset: 4%; }
.f3d-capa:nth-child(3) { transform: translateZ(calc(-1 * var(--depth-1, 20px))); inset: 8%; }
.f3d-capa-top { background: linear-gradient(135deg, var(--f3d-a2), var(--f3d-a)); border-color: transparent; box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }`,
    TARJETA_DOBLADA: `.f3d-tarj { width: 58%; aspect-ratio: 16 / 10; position: relative; transform: rotateX(10deg) rotateY(-14deg); }
.f3d-tarj-mitad { position: absolute; top: 0; bottom: 0; width: 50%; border-radius: 14px;
  background: color-mix(in srgb, white 92%, var(--f3d-a2)); box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); padding: 9% 7%; display: grid; gap: 12%; align-content: start; }
.f3d-tarj-izq { left: 0; border-radius: 14px 4px 4px 14px; }
.f3d-tarj-der { left: 50%; border-radius: 4px 14px 14px 4px; transform-origin: left center; transform: rotateY(-24deg); }
.f3d-tarj-linea { display: block; height: 7%; border-radius: 99px; background: color-mix(in srgb, var(--f3d-tinta) 22%, transparent); }
.f3d-tarj-linea:first-child { width: 46%; height: 16%; background: linear-gradient(90deg, var(--f3d-a), var(--f3d-a2)); }`,
    ANILLO_ORBITAL: `.f3d-anillo-wrap { width: 56%; aspect-ratio: 1; position: relative; transform: rotateX(16deg); }
.f3d-anillo { position: absolute; inset: 0; border-radius: 50%;
  border: calc(var(--f3d-tam, 320px) * .035) solid transparent;
  background: conic-gradient(from 120deg, var(--f3d-a), var(--f3d-a2), white, var(--f3d-a)) border-box;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--f3d-tam, 320px) * .05), black calc(100% - var(--f3d-tam, 320px) * .045));
  mask: radial-gradient(farthest-side, transparent calc(100% - var(--f3d-tam, 320px) * .05), black calc(100% - var(--f3d-tam, 320px) * .045));
  transform: rotateX(68deg); }
@media (prefers-reduced-motion: no-preference) { .f3d-anillo-wrap { animation: f3d-inclina 8s ease-in-out infinite; } }
@keyframes f3d-inclina { 0%,100% { transform: rotateX(10deg); } 50% { transform: rotateX(22deg); } }
.f3d-anillo-nucleo { position: absolute; inset: 34%; border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, white, var(--f3d-a2) 40%, var(--f3d-a) 100%); box-shadow: var(--shadow-deep, 0 24px 48px rgba(2,6,23,.28)); }
.f3d-anillo-satelita { position: absolute; inset: 0; border-radius: 50%; transform: rotateX(68deg); }
.f3d-anillo-satelita::before { content: ""; position: absolute; top: 3%; left: 50%; width: 11%; aspect-ratio: 1; margin-left: -5.5%; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, white, var(--f3d-a2)); box-shadow: var(--shadow-soft, 0 4px 12px rgba(2,6,23,.18)); }
@media (prefers-reduced-motion: no-preference) { .f3d-anillo-satelita { animation: f3d-orbita 11s linear infinite; } }`,
    TORRE_ISOMETRICA: `.f3d-torre { width: 54%; aspect-ratio: 1; position: relative; transform: rotateX(58deg) rotateZ(45deg); transform-style: preserve-3d; }
.f3d-losa { position: absolute; inset: 0; border-radius: 20px;
  background: color-mix(in srgb, var(--f3d-a) 30%, var(--f3d-tinta) 4%); border: 1.5px solid color-mix(in srgb, var(--f3d-a) 40%, transparent); }
.f3d-losa:nth-child(1) { transform: translateZ(calc(-1.6 * var(--depth-2, 40px))); }
.f3d-losa:nth-child(2) { transform: translateZ(calc(-0.8 * var(--depth-2, 40px))); inset: 5%; }
.f3d-losa-top { inset: 10%; background: linear-gradient(135deg, var(--f3d-a2), var(--f3d-a)); border-color: transparent; box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }
.f3d-losa-top::after { content: ""; position: absolute; inset: 18%; border-radius: 10px; background: color-mix(in srgb, white 24%, transparent); }`,
    CUBO_GIRATORIO: `.f3d-cubo { width: 38%; aspect-ratio: 1; position: relative; transform-style: preserve-3d; }
@media (prefers-reduced-motion: no-preference) { .f3d-cubo { animation: f3d-giro-cubo 16s linear infinite; } }
@keyframes f3d-giro-cubo { from { transform: rotateX(-18deg) rotateY(0deg); } to { transform: rotateX(-18deg) rotateY(360deg); } }
.f3d-cubo-cara { position: absolute; inset: 0; }
.f3d-cubo-frontal { background: linear-gradient(160deg, color-mix(in srgb, var(--f3d-a) 84%, black), var(--f3d-a) 60%, var(--f3d-a2)); border-radius: 12px; box-shadow: var(--shadow-deep, 0 24px 48px rgba(2,6,23,.28)); }
.f3d-cubo-lateral { width: 34%; left: auto; right: -34%; border-radius: 0 12px 12px 0; transform-origin: left center; transform: rotateY(90deg); background: linear-gradient(180deg, color-mix(in srgb, var(--f3d-a) 58%, black), color-mix(in srgb, var(--f3d-a) 76%, black)); }
.f3d-cubo-top { height: 34%; bottom: auto; top: -34%; border-radius: 12px 12px 2px 2px; transform-origin: center bottom; transform: rotateX(90deg); background: linear-gradient(90deg, color-mix(in srgb, white 60%, var(--f3d-a2)), var(--f3d-a2)); }
.f3d-cubo-frontal::after { content: ""; position: absolute; inset: 22%; border-radius: 8px; background: color-mix(in srgb, white 16%, transparent); border: 1px solid color-mix(in srgb, white 30%, transparent); }`,
    CONSTELACION: `.f3d-cons { width: 70%; aspect-ratio: 1; position: relative; transform: rotateX(24deg); }
.f3d-cons-pieza { position: absolute; width: 22%; aspect-ratio: 1; border-radius: 26%;
  background: color-mix(in srgb, var(--f3d-a) 34%, transparent); border: 1.5px solid color-mix(in srgb, var(--f3d-a) 55%, transparent);
  transform: translateZ(calc(var(--i, 0) * 22px - 20px)); }
.f3d-cons-pieza:nth-child(1) { top: 4%; left: 8%; }
.f3d-cons-pieza:nth-child(2) { top: 44%; left: 62%; }
.f3d-cons-pieza:nth-child(3) { top: 66%; left: 18%; }
.f3d-cons-mayor { width: 30%; top: 24%; left: 36%; background: linear-gradient(135deg, var(--f3d-a2), var(--f3d-a)); border-color: transparent; box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }
.f3d-cons-punto { position: absolute; top: calc(14% + var(--i, 0) * 24%); left: calc(40% + var(--i, 0) * 14%); width: 6%; aspect-ratio: 1; border-radius: 50%; background: var(--f3d-a2); }
@media (prefers-reduced-motion: no-preference) { .f3d-cons-punto { animation: f3d-titila 3.2s ease-in-out infinite; animation-delay: calc(var(--i, 0) * .5s); } }
@keyframes f3d-titila { 0%,100% { opacity: .45; } 50% { opacity: 1; } }`
  };
  return [BASE_CSS, formas[id] ?? "", REDUCED_GUARD].filter(Boolean).join("\n");
}
function seccionObjeto3d(o) {
  if (!o) {
    return [
      `# OBJETO 3D (decisi\xF3n del Spatial Engine)`,
      `Sin objeto 3D: la experiencia es plana o el foco es tipogr\xE1fico (el HTML/CSS del objeto no viaja).`,
      `No inventes un objeto 3D por tu cuenta: los objetos forjados viajan completos desde el motor.`
    ].join("\n");
  }
  return [
    `# OBJETO 3D FORJADO (\xA1INCLUYE EL HTML Y LA CSS TAL CUAL!)`,
    `Forma: ${o.nombre} \u2014 ${o.descripcion}. Transmite: ${o.transmite.toLowerCase()}.`,
    `Por qu\xE9: ${o.motivo}.`,
    `El mensaje del usuario lleva el bloque <div class="f3d">\u2026</div> y su CSS \xABObjeto 3D forjado por FORJA\xBB: c\xF3pialos LITERALMENTE dentro del hero (parametriza solo el color por los tokens).`,
    `El objeto es decorativo (role="presentation" aria-hidden="true"): NUNCA lo conviertas en imagen, canvas ni lo simplifiques a un div con border-radius.`,
    `Alternativas explorables: ${o.alternativas.join(", ")}`
  ].join("\n");
}
function resumenObjeto3d(o) {
  return o ? `objeto3d=${o.id.toLowerCase()} (${o.nombre.toLowerCase()})` : "objeto3d=ninguno";
}

// src/lib/prism/forja/primitivas.ts
var PRIMITIVAS_BLOQUE = [
  {
    id: "REVEAL_GRUPO",
    nombre: "Reveal con stagger",
    proposito: "grupo de piezas que entra al scroll con retardo escalonado",
    cuando: /\b(entradas?|aparec|reveal|animad|animated|modern|moderno)\b/i,
    conScript: true,
    kb: 1.1,
    a11y: ["solo transforma/opacity (sin layout shift)", "reduced-motion lo muestra directo"]
  },
  {
    id: "TILT_CARD",
    nombre: "Tilt card",
    proposito: "tarjeta que inclina en 3D (m\xE1x 8\xB0) siguiendo al puntero",
    cuando: /\b(tilt|3d|interactiv|interactiva|profundidad|perspectiva)\b/i,
    conScript: true,
    kb: 1.3,
    a11y: ["inclinaci\xF3n desactivada con teclado y reduced-motion", "\xE1ngulo capado a 8\xB0"]
  },
  {
    id: "MAGNETIC_CTA",
    nombre: "CTA magn\xE9tico",
    proposito: "bot\xF3n clave atra\xEDdo suavemente hacia el puntero (\u226412px)",
    cuando: /\b(cta|bot[oó]n|conversi[óo]n|llamada|magnetic|magn[eé]tic|contact)\b/i,
    conScript: true,
    kb: 1,
    a11y: ["retorno el\xE1stico con easing", "sin movimiento para reduced-motion"]
  },
  {
    id: "FLOATING_METRIC",
    nombre: "M\xE9trica flotante",
    proposito: "tarjeta elevada con n\xFAmero tabular y delta, flota sobre la escena",
    cuando: /\b(m[eé]tric|datos?|n[uú]meros|resultados?|kpi|estad[íi]stic)\b/i,
    conScript: false,
    kb: 0.9,
    a11y: ["n\xFAmeros tabulares", "contraste garantizado por tokens"]
  },
  {
    id: "SPOTLIGHT_CARD",
    nombre: "Spotlight card",
    proposito: "foco de luz que sigue al puntero dentro de UNA tarjeta destacada",
    cuando: /\b(destacad|premium|lujo|spotlight|foco|galer[ií]a|producto)\b/i,
    conScript: true,
    kb: 1,
    a11y: ["decoraci\xF3n ::after, no interfiere con el contenido", "se apaga sin puntero"]
  },
  {
    id: "PARALLAX_LAYER",
    nombre: "Capa parallax",
    proposito: "capa que se desplaza a velocidad distinta al scroll (profundidad)",
    cuando: /\b(parallax|profundidad|capas|scroll|inmersiv|escena)\b/i,
    conScript: true,
    kb: 0.8,
    a11y: ["transform \xFAnicamente (compositor, sin reflow)", "desactivada en reduced-motion"]
  },
  {
    id: "STICKY_STORY",
    nombre: "Sticky storytelling",
    proposito: "secci\xF3n que se queda fija mientras el contenido avanza (relato)",
    cuando: /\b(historia|story|relato|narrativ|pasos?|proceso|c[óo]mo funciona|recorrido)\b/i,
    conScript: false,
    kb: 0.7,
    a11y: ["flujo normal del documento (sin capturar scroll)", "funciona con teclado"]
  },
  {
    id: "MARQUEE",
    nombre: "Marquee pausable",
    proposito: "banda continua de marcas/valores (logos, catas, ingredientes)",
    cuando: /\b(marcas?|logos?|aliados?|clientes?|ingredientes?|sabores|variedades|marquee|cinta)\b/i,
    conScript: false,
    kb: 0.8,
    a11y: ["pausa al hover/focus", "duplicado con aria-hidden"]
  }
];
function defPrimitiva(id) {
  return PRIMITIVAS_BLOQUE.find((p) => p.id === id);
}
function elegirPrimitivas(e, r, hero, mensaje = "", max = 6) {
  const m = (mensaje || "").toLowerCase();
  const nivel2 = e.motion.intensity <= 0.02 ? 0 : e.motion.intensity <= 0.3 ? 1 : e.motion.intensity <= 0.6 ? 2 : e.motion.intensity <= 0.85 ? 3 : 4;
  const techo = Math.min(max, nivel2 === 0 ? 1 : nivel2 === 1 ? 2 : nivel2 === 2 ? 3 : nivel2 === 3 ? 5 : 6);
  const elegidas = [];
  const disciplina = [];
  const entra = (id, puntos = 0, motivo = "") => {
    if (elegidas.length >= techo) {
      disciplina.push(`${id} fuera de techo (${techo} por intensidad ${nivel2})`);
      return false;
    }
    if (elegidas.includes(id)) return false;
    elegidas.push(id);
    if (motivo) disciplina.push(`${id}: ${motivo}`);
    return true;
  };
  if (nivel2 >= 2) entra("REVEAL_GRUPO", 3, "el motion plan pide entradas escalonadas");
  if (e.interaction.tilt) entra("TILT_CARD", 3, "el ADN pide tilt");
  if (e.interaction.magnetic) entra("MAGNETIC_CTA", 3, "el ADN pide CTA magn\xE9tico");
  if (e.motion.parallax) entra("PARALLAX_LAYER", 2, "el ADN pide parallax");
  if (r.superficies.floatingCards || e.surface.elevation >= 0.6) entra("FLOATING_METRIC", 2, "superficies elevadas de la receta");
  if (hero.tipo === "HERO_SCROLL_REVEAL" || hero.tipo === "HERO_CINEMATIC") entra("STICKY_STORY", 2, "el hero viv\xEDa del scroll: el relato contin\xFAa");
  if (r.motion.scrollScenes && elegidas.length < techo) entra("STICKY_STORY", 1, "la receta coreograf\xEDa el scroll");
  const porSe\u00F1al = (p) => Boolean(p.cuando?.test(m));
  for (const p of PRIMITIVAS_BLOQUE) {
    if (elegidas.length >= techo) break;
    if (porSe\u00F1al(p)) entra(p.id, 2, `se\xF1al \xAB${p.id.toLowerCase()}\xBB en la petici\xF3n`);
  }
  if (e.interaction.richness >= 0.65 && elegidas.length < techo) entra("SPOTLIGHT_CARD", 1, "riqueza de interacci\xF3n alta");
  if (!elegidas.includes("SPOTLIGHT_CARD")) disciplina.push("spotlight reservado a UNA pieza destacada (no sistema)");
  const kbTotales = Number(elegidas.reduce((s, id) => s + (defPrimitiva(id)?.kb ?? 0), 0).toFixed(1));
  return { primitivas: elegidas, disciplina: disciplina.slice(0, 8), kbTotales };
}
var CABECERA_CSS = `/* Primitivas compiladas FORJA (nacen auditadas: reduced-motion + foco + toques \u226544px) */`;
var REDUCED = `@media (prefers-reduced-motion: reduce) {
  .f-pr, .f-pr *, .f-pr *::before, .f-pr *::after { animation: none !important; transition: none !important; }
  .f-reveal { opacity: 1 !important; transform: none !important; }
  .f-parallax { transform: none !important; }
}`;
function cssPrimitivas(elegidas) {
  const bloques = [CABECERA_CSS];
  if (elegidas.includes("REVEAL_GRUPO")) {
    bloques.push(
      `/* Reveal con stagger */`,
      `@media (prefers-reduced-motion: no-preference) {
  .f-reveal { opacity: 0; transform: translateY(22px); transition: opacity var(--motion-slow, 900ms) var(--ease-out, cubic-bezier(.22,.61,.36,1)), transform var(--motion-slow, 900ms) var(--ease-out, cubic-bezier(.22,.61,.36,1)); transition-delay: calc(var(--i, 0) * 80ms); }
  .f-reveal.f-visible { opacity: 1; transform: none; }
}`
    );
  }
  if (elegidas.includes("TILT_CARD")) {
    bloques.push(
      `/* Tilt card (\xE1ngulo capado 8\xB0, teclado y reduced-motion quietos) */`,
      `.f-tilt { transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); transition: transform var(--motion-medium, 420ms) var(--ease-out, cubic-bezier(.22,.61,.36,1)); transform-style: preserve-3d; will-change: transform; }
.f-tilt:hover, .f-tilt:focus-visible { box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }
.f-tilt:focus-visible { outline: 2px solid var(--acento, #6366f1); outline-offset: 3px; }`
    );
  }
  if (elegidas.includes("MAGNETIC_CTA")) {
    bloques.push(
      `/* CTA magn\xE9tico (atracci\xF3n \u2264 12px) */`,
      `.f-magnet { display: inline-block; min-height: 44px; padding: 12px 22px; border-radius: var(--radius-md, 14px); border: 0; cursor: pointer;
  background: linear-gradient(135deg, var(--acento, #6366f1), color-mix(in srgb, var(--acento, #6366f1) 72%, black));
  color: var(--background, #fff); font-weight: 600; letter-spacing: .01em;
  transform: translate(var(--mx, 0px), var(--my, 0px)); transition: transform 300ms var(--ease-out, cubic-bezier(.22,.61,.36,1)), box-shadow 300ms; }
.f-magnet:hover { box-shadow: var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)); }
.f-magnet:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }`
    );
  }
  if (elegidas.includes("FLOATING_METRIC")) {
    bloques.push(
      `/* M\xE9trica flotante */`,
      `@media (prefers-reduced-motion: no-preference) { .f-metric { animation: f-flota 7s ease-in-out infinite; } }
@keyframes f-flota { 0%,100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }
.f-metric { border-radius: var(--radius-lg, 22px); background: color-mix(in srgb, var(--card, #fff) 88%, transparent);
  border: 1px solid var(--linea, rgba(15,23,42,.12)); box-shadow: var(--surface-floating, var(--shadow-floating, 0 18px 40px rgba(2,6,23,.2)));
  padding: 18px 22px; min-width: 9ch; }
.f-metric .valor { font-variant-numeric: tabular-nums; font-weight: 700; font-size: clamp(1.6rem, 3.4vw, 2.4rem); line-height: 1.05; }
.f-metric .delta { font-variant-numeric: tabular-nums; font-size: .82em; font-weight: 600; }
.f-metric .delta.sube { color: #059669; } .f-metric .delta.baja { color: #dc2626; }`
    );
  }
  if (elegidas.includes("SPOTLIGHT_CARD")) {
    bloques.push(
      `/* Spotlight card (una pieza, no sistema) */`,
      `.f-spotlight { position: relative; overflow: hidden; }
.f-spotlight::after { content: ""; position: absolute; inset: -40%; pointer-events: none;
  background: radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--acento, #6366f1) 26%, transparent), transparent 62%);
  opacity: 0; transition: opacity var(--motion-medium, 420ms); }
@media (hover: hover) { .f-spotlight:hover::after { opacity: 1; } }
.f-spotlight > * { position: relative; z-index: 1; }`
    );
  }
  if (elegidas.includes("PARALLAX_LAYER")) {
    bloques.push(
      `/* Capa parallax (solo transform) */`,
      `@media (prefers-reduced-motion: no-preference) {
  .f-parallax { transform: translateY(calc(var(--py, 0) * var(--f-vel, .18))); will-change: transform; }
}`
    );
  }
  if (elegidas.includes("STICKY_STORY")) {
    bloques.push(
      `/* Sticky storytelling (flujo normal, sin capturar scroll) */`,
      `.f-sticky-wrap { display: grid; gap: 24px; }
@media (min-width: 900px) {
  .f-sticky { position: sticky; top: clamp(48px, 12vh, 120px); }
  .f-sticky-paso { min-height: 60vh; display: grid; align-content: center; }
}`
    );
  }
  if (elegidas.includes("MARQUEE")) {
    bloques.push(
      `/* Marquee pausable (hover/focus) */`,
      `.f-marquee { overflow: hidden; mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent); }
.f-marquee-cinta { display: flex; gap: clamp(24px, 4vw, 56px); width: max-content; padding-block: 6px; }
@media (prefers-reduced-motion: no-preference) { .f-marquee-cinta { animation: f-cinta 26s linear infinite; } }
.f-marquee:hover .f-marquee-cinta, .f-marquee:focus-within .f-marquee-cinta { animation-play-state: paused; }
@keyframes f-cinta { to { transform: translateX(-50%); } }
.f-marquee-item { white-space: nowrap; opacity: .78; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; font-size: .85em; }`
    );
  }
  bloques.push(REDUCED);
  return bloques.join("\n");
}
function htmlPrimitiva(id, items = [], titulo = "") {
  const xs = items.length ? items.slice(0, 12) : ["Pieza uno", "Pieza dos", "Pieza tres"];
  switch (id) {
    case "REVEAL_GRUPO":
      return `<div class="f-pr f-reveal-grupo">
${xs.map((x, i) => `  <div class="f-pr f-reveal" style="--i:${i}">${x}</div>`).join("\n")}
</div>`;
    case "TILT_CARD":
      return `<article class="f-pr f-tilt" tabindex="0">${xs[0]}</article>`;
    case "MAGNETIC_CTA":
      return `<button class="f-pr f-magnet" type="button">${titulo || xs[0]}</button>`;
    case "FLOATING_METRIC":
      return `<div class="f-pr f-metric" role="group" aria-label="${titulo || "M\xE9trica"}">
  <div class="valor">${xs[0]}</div>
  <div class="delta ${/^-|−|-/.test(xs[1] ?? "") ? "baja" : "sube"}">${xs[1] ?? "+100%"}</div>
</div>`;
    case "SPOTLIGHT_CARD":
      return `<article class="f-pr f-spotlight">${xs[0]}</article>`;
    case "PARALLAX_LAYER":
      return `<div class="f-pr f-parallax" style="--f-vel:.18">${xs[0]}</div>`;
    case "STICKY_STORY":
      return `<section class="f-pr f-sticky-wrap" aria-label="${titulo || "C\xF3mo funciona"}">
  <div class="f-pr f-sticky"><h2>${titulo || "El proceso"}</h2></div>
${xs.map((x) => `  <div class="f-pr f-sticky-paso">${x}</div>`).join("\n")}
</section>`;
    case "MARQUEE":
      return `<div class="f-pr f-marquee" aria-label="${titulo || "Marcas"}">
  <div class="f-marquee-cinta">
${xs.map((x) => `    <span class="f-marquee-item">${x}</span>`).join("\n")}
${xs.map((x) => `    <span class="f-marquee-item" aria-hidden="true">${x}</span>`).join("\n")}
  </div>
</div>`;
    default:
      return "";
  }
}
var GUARD_JS = `"use strict";
var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var fino = window.matchMedia && window.matchMedia("(hover: none)").matches;`;
function scriptPrimitivas(elegidas) {
  const partes = [];
  if (elegidas.includes("REVEAL_GRUPO")) {
    partes.push(
      `/* Reveal: IntersectionObserver (una vez, capado a 24 nodos) */`,
      `var rev = document.querySelectorAll(".f-reveal");`,
      `if ("IntersectionObserver" in window) {`,
      `  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("f-visible"); io.unobserve(e.target); } }); }, { threshold: .18 });`,
      `  for (var i = 0; i < Math.min(rev.length, 24); i++) io.observe(rev[i]);`,
      `} else { for (var j = 0; j < rev.length; j++) rev[j].classList.add("f-visible"); }`
    );
  }
  if (elegidas.includes("TILT_CARD")) {
    partes.push(
      `/* Tilt: capado a 8\xB0, sin reduced-motion, sin t\xE1ctil */`,
      `document.querySelectorAll(".f-tilt").forEach(function (el) {`,
      `  el.addEventListener("pointermove", function (ev) {`,
      `    if (reduce || fino) return;`,
      `    var r = el.getBoundingClientRect();`,
      `    var px = (ev.clientX - r.left) / r.width - .5, py = (ev.clientY - r.top) / r.height - .5;`,
      `    el.style.setProperty("--ry", (px * 16).toFixed(2) + "deg");`,
      `    el.style.setProperty("--rx", (-py * 16).toFixed(2) + "deg");`,
      `  });`,
      `  el.addEventListener("pointerleave", function () { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });`,
      `});`
    );
  }
  if (elegidas.includes("MAGNETIC_CTA")) {
    partes.push(
      `/* Magn\xE9tico: atracci\xF3n \u2264 12px */`,
      `document.querySelectorAll(".f-magnet").forEach(function (el) {`,
      `  el.addEventListener("pointermove", function (ev) {`,
      `    if (reduce || fino) return;`,
      `    var r = el.getBoundingClientRect();`,
      `    var dx = (ev.clientX - (r.left + r.width / 2)) / r.width;`,
      `    var dy = (ev.clientY - (r.top + r.height / 2)) / r.height;`,
      `    el.style.setProperty("--mx", (dx * 24 > 12 ? 12 : dx * 24 < -12 ? -12 : (dx * 24).toFixed(1)) + "px");`,
      `    el.style.setProperty("--my", (dy * 18 > 9 ? 9 : dy * 18 < -9 ? -9 : (dy * 18).toFixed(1)) + "px");`,
      `  });`,
      `  el.addEventListener("pointerleave", function () { el.style.setProperty("--mx", "0px"); el.style.setProperty("--my", "0px"); });`,
      `});`
    );
  }
  if (elegidas.includes("SPOTLIGHT_CARD")) {
    partes.push(
      `/* Spotlight: posici\xF3n del foco */`,
      `document.querySelectorAll(".f-spotlight").forEach(function (el) {`,
      `  el.addEventListener("pointermove", function (ev) {`,
      `    var r = el.getBoundingClientRect();`,
      `    el.style.setProperty("--mx", ((ev.clientX - r.left) / r.width * 100).toFixed(1) + "%");`,
      `    el.style.setProperty("--my", ((ev.clientY - r.top) / r.height * 100).toFixed(1) + "%");`,
      `  });`,
      `});`
    );
  }
  if (elegidas.includes("PARALLAX_LAYER")) {
    partes.push(
      `/* Parallax: rAF-throttled, solo capas visibles (m\xE1x 8) */`,
      `var caps = document.querySelectorAll(".f-parallax");`,
      `if (caps.length && !reduce) {`,
      `  var pend = false;`,
      `  var aplicar = function () {`,
      `    pend = false;`,
      `    for (var i = 0; i < Math.min(caps.length, 8); i++) {`,
      `      var r = caps[i].getBoundingClientRect();`,
      `      var rel = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;`,
      `      caps[i].style.setProperty("--py", (rel * -60).toFixed(1));`,
      `    }`,
      `  };`,
      `  window.addEventListener("scroll", function () { if (!pend) { pend = true; requestAnimationFrame(aplicar); } }, { passive: true });`,
      `  aplicar();`,
      `}`
    );
  }
  if (!partes.length) return "";
  return [
    `/* FORJA \xB7 scripts de primitivas compiladas (capados, idempotentes) */`,
    `(function () {`,
    GUARD_JS,
    `try {`,
    partes.join("\n"),
    `} catch (e) {}`,
    `})();`
  ].join("\n");
}
function seccionPrimitivas(e) {
  if (!e.primitivas.length) {
    return [
      `# PRIMITIVAS COMPILADAS (biblioteca v4.6)`,
      `Ninguna primitiva elegida: la experiencia es deliberadamente est\xE1tica. No a\xF1adas animaci\xF3n por tu cuenta.`
    ].join("\n");
  }
  const lineas = [
    `# PRIMITIVAS COMPILADAS (biblioteca v4.6 \u2014 usa estas, NO re-inventes)`,
    `El mensaje del usuario lleva la CSS \xABPrimitivas compiladas FORJA\xBB y los scripts capados: INCLUYELOS tal cual.`,
    ...e.primitivas.map((id) => {
      const d = defPrimitiva(id);
      return `- ${id} (${d.nombre}): ${d.proposito} \xB7 estructura HTML con clase .f-${id.split("_")[0].toLowerCase()}\u2026 viaja en el mensaje \xB7 a11y: ${d.a11y.join("; ")}`;
    }),
    `Para construir cada pieza usa el HTML de ejemplo del mensaje (htmlPrimitiva): cambia SOLO textos/contenido, nunca la mec\xE1nica ni las clases.`,
    `Material compilado: ${e.kbTotales} KB \u2014 coste marginal 0 tokens frente a re-inventarlo.`,
    ...e.disciplina.map((d) => `Disciplina: ${d}`)
  ];
  return lineas.join("\n");
}
function resumenPrimitivas(e) {
  return e.primitivas.length ? `primitivas=[${e.primitivas.join(",")}] (${e.kbTotales} KB)` : "primitivas=ninguna";
}

// src/lib/prism/forja/aprendizaje-genoma.ts
var TOPE_MEMORIA = 60;
var MIN_MUESTRAS_DEFECTO = 3;
var memoria = [];
function registrarResultadoAprendizaje(e) {
  try {
    const entrada = {
      ...e,
      vertical: (e.vertical || "").slice(0, 80),
      familia: (e.familia || "").slice(0, 40),
      score: Number.isFinite(e.score) ? Math.max(0, Math.min(100, e.score)) : 0
    };
    memoria = [...memoria.filter((x) => x.cuando !== entrada.cuando), entrada].slice(-TOPE_MEMORIA);
  } catch {
  }
}
function obtenerMemoriaAprendizaje() {
  return [...memoria];
}
function cargarMemoriaAprendizaje(xs) {
  memoria = (Array.isArray(xs) ? xs : []).slice(-TOPE_MEMORIA);
}
function reiniciarAprendizaje() {
  memoria = [];
}
function serializarAprendizaje() {
  return JSON.stringify(memoria);
}
function deserializarAprendizaje(s) {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.slice(-TOPE_MEMORIA) : [];
  } catch {
    return [];
  }
}
function estadisticas(extraer) {
  const mapa = /* @__PURE__ */ new Map();
  for (const e of memoria) {
    for (const v of extraer(e)) {
      if (!v) continue;
      const st = mapa.get(v) ?? { valor: v, suma: 0, n: 0 };
      st.suma += e.score;
      st.n += 1;
      mapa.set(v, st);
    }
  }
  return mapa;
}
function recomendacionesAprendidas(opts = {}) {
  const min = Math.max(1, opts.minMuestras ?? MIN_MUESTRAS_DEFECTO);
  const max = opts.max ?? 6;
  if (memoria.length < 2) return [];
  const dims = [
    { dimension: "familia", extraer: (e) => [e.familia] },
    { dimension: "hero", extraer: (e) => [e.huella.hero] },
    { dimension: "card", extraer: (e) => e.huella.cards.slice(0, 3) },
    { dimension: "motion", extraer: (e) => e.huella.motion.slice(0, 4) }
  ];
  const out = [];
  for (const dim of dims) {
    const stats = [...estadisticas(dim.extraer).values()];
    const validas = stats.filter((s) => s.n >= min);
    if (!validas.length) continue;
    const conMedia = validas.map((s) => ({ ...s, media: s.suma / s.n }));
    const mejor = conMedia.reduce((a, b) => b.media > a.media ? b : a);
    const peor = conMedia.reduce((a, b) => b.media < a.media ? b : a);
    if (mejor.media >= 78 && mejor.n >= min) {
      out.push({
        dimension: dim.dimension,
        valor: mejor.valor,
        accion: "destacar",
        muestras: mejor.n,
        scoreMedio: Math.round(mejor.media),
        evidencia: `\xAB${mejor.valor}\xBB gan\xF3 ${Math.round(mejor.media)}/100 de media en ${mejor.n} generaci\xF3n(es)`
      });
    }
    if (peor.media < 72 && peor.valor !== mejor.valor && peor.n >= min && conMedia.length > 1) {
      out.push({
        dimension: dim.dimension,
        valor: peor.valor,
        accion: "evitar",
        muestras: peor.n,
        scoreMedio: Math.round(peor.media),
        evidencia: `\xAB${peor.valor}\xBB qued\xF3 en ${Math.round(peor.media)}/100 de media en ${peor.n} generaci\xF3n(es)`
      });
    }
  }
  return out.sort((a, b) => a.accion === b.accion ? b.scoreMedio - a.scoreMedio : a.accion === "destacar" ? -1 : 1).slice(0, max);
}
function ajustesHeroAprendidos(minMuestras = 3) {
  const ajustes = {};
  for (const r of recomendacionesAprendidas({ minMuestras, max: 12 })) {
    if (r.dimension !== "hero") continue;
    ajustes[r.valor] = r.accion === "destacar" ? 2 : -2;
  }
  return ajustes;
}
function ajustesFamiliaAprendidos(minMuestras = 3) {
  const ajustes = {};
  for (const r of recomendacionesAprendidas({ minMuestras, max: 12 })) {
    if (r.dimension !== "familia") continue;
    ajustes[r.valor] = r.accion === "destacar" ? 1.5 : -1.5;
  }
  return ajustes;
}
function seccionAprendizaje(recs) {
  if (!recs.length) return "";
  return [
    `# LEARNING LOOP DEL GENOMA (evidencia de tus propias generaciones)`,
    ...recs.map((r) => `- ${r.accion.toUpperCase()} ${r.dimension} \xAB${r.valor}\xBB: ${r.evidencia}.`),
    `\xDAsalo: lo DESTACADO tiene prioridad en empates; lo EVITADO necesita causa expl\xEDcita para volver.`
  ].join("\n");
}
function resumenAprendizaje(recs) {
  if (!memoria.length) return "aprendizaje: sin generaciones registradas todav\xEDa";
  const d = recomendarPorVertical();
  const base = `aprendizaje: ${memoria.length} generaci\xF3n(es) \xB7 ${recs.length} recomendaci\xF3n(es) con evidencia`;
  return d ? `${base} \xB7 ${d}` : base;
}
function recomendarPorVertical() {
  if (memoria.length < 2) return "";
  const porVertical = /* @__PURE__ */ new Map();
  for (const e of memoria) {
    const clave2 = (e.vertical || "general").slice(0, 40).toLowerCase();
    const st = porVertical.get(clave2) ?? { valor: clave2, suma: 0, n: 0 };
    st.suma += e.score;
    st.n += 1;
    porVertical.set(clave2, st);
  }
  const mejor = [...porVertical.values()].filter((s) => s.n >= 2).map((s) => ({ ...s, media: s.suma / s.n })).sort((a, b) => b.media - a.media)[0];
  if (!mejor) return "";
  const deMejor = memoria.filter((e) => (e.vertical || "general").slice(0, 40).toLowerCase() === mejor.valor);
  const familiaTop = deMejor.length ? deMejor.reduce((acc, e) => {
    acc[e.familia] = (acc[e.familia] ?? 0) + 1;
    return acc;
  }, {}) : {};
  const familiaGanadora = Object.entries(familiaTop).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return `mejor vertical: \xAB${mejor.valor}\xBB ${Math.round(mejor.media)}/100 (n=${mejor.n})${familiaGanadora ? ` \xB7 familia dominante ${familiaGanadora}` : ""}`;
}

// src/lib/prism/forja/motor-creativo.ts
function seleccionarExperiencia(mensaje, opts = {}) {
  const base = opts.dnaForzado ? { dna: clonarExperiencia(opts.dnaForzado), razones: ["ADN fijado por el contrato de experiencia editado"] } : sintetizarExperienciaDna(mensaje);
  const dna = base.dna;
  const razones = base.razones;
  const familia = opts.familiaForzada ? { ...seleccionarFamilia(mensaje), familia: opts.familiaForzada, confianza: 1, motivo: `familia fijada por edici\xF3n/Arena: ${opts.familiaForzada}` } : seleccionarFamilia(mensaje);
  const receta = recetaParaFamilia(familia.familia, mensaje);
  const deseadoBrief = modoDeseado(mensaje);
  const minimoPorReceta = {
    spatial_product: "2.5d",
    cinematic_product: "2.5d",
    immersive_portfolio: "2.5d",
    interactive_saas: "2.5d",
    "3d_showcase": "3d",
    creative_studio: "2.5d",
    modern_minimal: "2d"
  };
  const minimoExperiencia = minimoPorReceta[receta.receta.id];
  const ordenModo = { "2d": 3, "2.5d": 2, "3d": 1, webgl: 0 };
  const deseado = ordenModo[deseadoBrief] <= ordenModo[minimoExperiencia] ? deseadoBrief : minimoExperiencia;
  const representacion = evaluarPuerta(
    {
      intencionExigeWebgl: deseado === "webgl",
      pesoActivosKb: opts.pesoActivosKb ?? 0,
      nodosAnimados: dna.spatial.layers + (dna.surface.elevation >= 0.5 ? 4 : 0),
      costeGpu: dna.motion.intensity >= 0.8 ? "alto" : dna.motion.intensity >= 0.5 ? "medio" : "bajo",
      movilPrimero: opts.movilPrimero ?? false,
      modoMinimo: minimoExperiencia
    },
    deseado
  );
  if (representacion.modo === "2d") {
    dna.spatial.mode = "flat";
    dna.spatial.depth = Math.min(dna.spatial.depth, 0.3);
    dna.object.use3d = false;
  } else if (representacion.modo === "2.5d") {
    dna.spatial.mode = "2.5d";
    dna.object.use3d = false;
  } else if (representacion.modo === "3d") {
    dna.spatial.mode = "3d";
    dna.object.use3d = true;
  }
  const aprendizaje = recomendacionesAprendidas({ max: 4 });
  const ajustesHero = ajustesHeroAprendidos();
  const hero = elegirHero(dna, familia.familia, mensaje, obtenerHistorial().map((h) => h.hero), ajustesHero);
  const heroFinal = opts.heroForzado && defHero(opts.heroForzado) ? { ...hero, ...defHero(opts.heroForzado), motivo: `hero fijado por edici\xF3n del contrato: ${opts.heroForzado}` } : hero;
  const cards = elegirCards(dna, receta.receta);
  const penalizacion = penalizacionComposicion(
    heroFinal.tipo,
    dna.spatial.mode,
    cards.variantes[0] ?? ""
  );
  const planEspacial = construirPlanEspacial(dna, receta.receta);
  const planMovimiento = construirPlanMovimiento(dna, receta.receta);
  const quietoTipografico = dna.object.heroType === "tipografico" && !dna.object.use3d && dna.object.visualWeight < 0.6;
  const objeto = quietoTipografico ? null : elegirObjeto3d(dna, familia.familia, mensaje, obtenerHistorial().map((h) => h.hero).slice(-2));
  const primitivas = elegirPrimitivas(dna, receta.receta, heroFinal, mensaje);
  const responsive = construirPlanResponsivo(dna, receta.receta);
  const tokensCss = tokensExperienciaCss(dna);
  const plano = construirPlanoContenido(opts.mensajeOriginal ?? mensaje, {
    nivel: opts.nivelDetalle
  });
  const iconos = elegirIconos(opts.mensajeOriginal ?? mensaje, 10);
  const composition = construirCompositionBlueprint({ familia: familia.familia, receta: receta.receta, plano });
  const manifest = construirExperienceManifest({
    familia: familia.familia,
    receta: receta.receta,
    dna,
    representacion,
    planEspacial,
    planMovimiento,
    hero: heroFinal,
    cards,
    plano,
    composition,
    primitivas: { ids: primitivas.primitivas }
  });
  const resumen = [
    `familia=${familia.familia}(${Math.round(familia.confianza * 100)}%)`,
    `receta=${receta.receta.id}`,
    `compatible=${receta.compatible}`,
    `representacion=${representacion.modo}`,
    `manifest=${manifest.version}`,
    `composition=${composition.version}/${composition.sections.length}secciones`,
    resumenExperienciaDna(dna),
    `hero=${heroFinal.tipo}`,
    resumenObjeto3d(objeto),
    resumenPrimitivas(primitivas),
    resumenAprendizaje(aprendizaje),
    resumenTokens(dna),
    resumenAntiRepeticion(penalizacion),
    resumenPlano(plano),
    resumenIconografia(iconos)
  ].join(" \xB7 ");
  return {
    dna,
    razonesDna: razones,
    familia,
    receta,
    representacion,
    planEspacial,
    planMovimiento,
    hero: heroFinal,
    cards,
    responsive,
    penalizacion,
    primitivas,
    objeto,
    aprendizaje,
    plano,
    manifest,
    composition,
    iconos,
    tokensCss,
    resumen
  };
}
function seccionContratoExperiencia(sel) {
  return [
    seccionFamilias(sel.familia),
    "",
    seccionReceta(sel.receta.receta),
    "",
    seccionExperienciaDna(sel.dna),
    "",
    seccionPuerta(sel.representacion),
    "",
    seccionPlanEspacial(sel.planEspacial),
    "",
    seccionObjeto3d(sel.objeto),
    "",
    seccionPlanMovimiento(sel.planMovimiento),
    "",
    seccionHero(sel.hero),
    "",
    seccionCards(sel.cards),
    "",
    seccionPrimitivas(sel.primitivas),
    "",
    seccionPlanResponsivo(sel.responsive),
    "",
    seccionAprendizaje(sel.aprendizaje),
    "",
    seccionExperienceManifest(sel.manifest),
    "",
    seccionCompositionBlueprint(sel.composition),
    "",
    // v4.7 — la anti-repetición llega POR FIN a quien escribe el HTML.
    // Hasta v4.6 su sección solo la veía director2.ts.
    seccionAntiRepeticion(sel.penalizacion),
    "",
    seccionPatronesPositivos("", 6),
    "",
    `# DESIGN TOKENS (pegar este :root y usar sus variables)`,
    sel.tokensCss,
    "",
    "",
    seccionIconografia(sel.iconos),
    "",
    // v4.7 — el QUÉ, después del CÓMO.
    seccionPlanoContenido(sel.plano)
  ].join("\n");
}
function cssDeterminista(sel) {
  return [
    sel.tokensCss,
    cssEscenario(sel.planEspacial),
    sel.objeto ? cssObjeto3d(sel.objeto.id) : "",
    cssMovimiento(sel.planMovimiento),
    cssCards(sel.cards.variantes),
    cssPrimitivas(sel.primitivas.primitivas),
    sel.composition.css,
    cssIconografia()
  ].filter(Boolean).join("\n\n");
}
function scriptDeterminista(sel) {
  return scriptPrimitivas(sel.primitivas.primitivas);
}
function recompilarDesdeDna(dna, opts = {}) {
  const mensaje = opts.mensajeOriginal ?? "";
  return seleccionarExperiencia(mensaje, { ...opts, dnaForzado: dna, mensajeOriginal: mensaje });
}

// src/lib/prism/forja/maqueta.ts
var PROMPT_MAQUETA = `## Qui\xE9n eres
Eres el maquetador de FORJA IA. Recibes una FICHA DE DISE\xD1O y el CONTRATO
DE EXPERIENCIA y construyes una MAQUETA NAVEGABLE: una \xFAnica p\xE1gina HTML
que se ve como la web final para que el usuario decida si le gusta ANTES de
producir el c\xF3digo real.

## Qu\xE9 es una maqueta (y qu\xE9 no)
- S\xCD: layout completo, paleta exacta, tipograf\xEDa exacta, todas las secciones
  de la ficha en su orden, jerarqu\xEDa visual real, hover/focus b\xE1sicos.
- NO: formularios que env\xEDan, carritos, llamadas a APIs, JavaScript de
  negocio, textos definitivos.
- Los textos que inventes deben ser REALISTAS y concretos (nada de
  \xABLorem ipsum\xBB ni \xABSu texto aqu\xED\xBB): venden el dise\xF1o.
- Marca lo provisional con un comentario HTML <!-- provisional --> al inicio
  del bloque (nunca visible en pantalla).

## El contrato de experiencia MANDA (v4.5/v4.6)
- EXPERIENCE RECIPE: ejecuta la receta (hero, composici\xF3n, superficies,
  movimiento, interacci\xF3n, objeto) tal como est\xE1 definida.
- SPATIAL PLAN: la p\xE1gina es una escena por capas con z-index sem\xE1ntico;
  usa perspective y translateZ cuando el plan lo diga.
- OBJETO 3D FORJADO (v4.6): si el contrato trae \xABOBJETO 3D FORJADO\xBB, el
  mensaje lleva su HTML (<div class="f3d">\u2026) y su CSS listos: c\xF3pialos
  LITERALMENTE en el hero. PROHIBIDO re-inventar el objeto, convertirlo
  en imagen o simplificarlo a un div con border-radius.
- PRIMITIVAS COMPILADAS (v4.6): si el contrato trae la biblioteca, el
  mensaje lleva la CSS \xABPrimitivas compiladas FORJA\xBB y el HTML de ejemplo
  de cada una: usa esas piezas con ese clases y esa mec\xE1nica; cambia SOLO
  los textos. PROHIBIDO re-escribir la mec\xE1nica (perder\xEDas la a11y y el
  reduced-motion que ya nacieron auditados).
- MOTION PLAN: respeta los tiempos POR CATEGOR\xCDA (micro 150-300ms,
  componente 250-600ms, reveal 500-1000ms, escena 800-1600ms) y SIEMPRE
  @media (prefers-reduced-motion: reduce).
- HERO TYPE: el tipo de hero est\xE1 decidido. PROHIBIDO el hero por defecto
  (centrado + h1 gigante + p\xE1rrafo + bot\xF3n) si el tipo es otro.
- SURFACE SYSTEM: usa los DESIGN TOKENS que recibes (--radius-*, --depth-*,
  --motion-*, --shadow-*, --surface-*) y pega el bloque :root tal cual.
- INTERACTION SYSTEM: magnetic/tilt/expandable solo donde el ADN los pide.
- RESPONSIVE EXPERIENCE: aplica el plan (qu\xE9 se mantiene/reduce/reordena/
  elimina/transforma por breakpoint), no solo width: 100%.
- No abuses de glassmorphism: el vidrio es acento, no sistema.

## Reglas inquebrantables
1. UN solo archivo HTML autocontenido: <style> dentro, cero dependencias
   salvo Google Fonts si la ficha lo pide.
2. Cumple la ficha AL DETALLE: si dice azul #1D4ED8, es #1D4ED8.
3. Mobile first y responsive (media queries a 768px y 1024px).
4. A\xF1ade una banda fija discreta arriba a la derecha:
   <div id="d1-maqueta" style="position:fixed;top:10px;right:10px;z-index:9999;
   background:#0F172A;color:#F8FAFC;font:600 11px/1 system-ui;padding:6px 10px;
   border-radius:999px;opacity:.85;pointer-events:none">MAQUETA \xB7 FORJA IA</div>
5. Accesibilidad m\xEDnima: contraste 4.5:1 en texto, alt en im\xE1genes, un solo
   h1, <html lang="es">, meta viewport y <title>: el Inspector los comprueba.
6. El HTML debe verse bien al abrirlo directamente en un iframe o pesta\xF1a.
7. EXTENSI\xD3N: la manda el PLANO DE CONTENIDO del mensaje, no tu criterio.
   Ahorra en CSS (clases reutilizadas, sin utilidades repetidas), NUNCA en
   contenido. Una secci\xF3n de menos, una colecci\xF3n por debajo de su m\xEDnimo o
   un texto de relleno son DEFECTOS que el QA de detalle mide y devuelve.
   Si algo no cabe, quita decoraci\xF3n; jam\xE1s secciones, piezas ni responsive.
8. El mensaje incluye el bloque \xABAnti-gen\xE9rico\xBB, el ADN con sus
   PROHIBICIONES y el CONTRATO DE EXPERIENCIA: son reglas duras. Un dise\xF1o
   que parezca plantilla de IA o que ignore la familia de experiencia se
   rechaza igual que uno roto.
9. PLANO DE CONTENIDO (v4.7): trae las secciones obligatorias en orden, el
   m\xEDnimo de piezas REALES de cada colecci\xF3n y los HECHOS declarados por el
   usuario (precios, horarios, tel\xE9fono, ciudad, cantidades). Los hechos son
   DATOS: se copian tal cual. Contradecirlos o inventar un precio distinto
   es un defecto grave. Lo que el brief no diga, inv\xE9ntalo realista y
   espec\xEDfico \u2014 nombres, cifras, plazos \u2014, nunca \xABLorem ipsum\xBB.
10. ACABADO: estados :hover, :focus-visible y :active visibles (no solo
   opacidad); im\xE1genes con aspect-ratio y object-fit; iconos como SVG inline
   con currentColor (nunca emojis); cifras con font-variant-numeric:
   tabular-nums; cada secci\xF3n con su atributo id enlazado desde la navegaci\xF3n.

## Formato de salida OBLIGATORIO
\`\`\`html maqueta.html
[el archivo completo]
\`\`\`
Nada m\xE1s: ni explicaciones, ni comentarios fuera del archivo.`;
function mensajeMaqueta(p, fichaTexto, feedback) {
  const adn = sanearAdn(parseAdn(fichaTexto) ?? adnDesdePeticion(p.mensaje));
  const seleccion = seleccionarExperiencia(corpusDeSenales(p, fichaTexto, adn, feedback), {
    mensajeOriginal: p.mensaje
  });
  const contrato = seccionContratoExperiencia(seleccion);
  const cssForjado = cssDeterminista(seleccion);
  const scriptForjado = scriptDeterminista(seleccion);
  const htmlObjeto = seleccion.objeto ? htmlObjeto3d(seleccion.objeto.id) : "";
  const htmlPrimitivas = seleccion.primitivas.primitivas.map((id) => htmlPrimitiva(id, [], "")).filter(Boolean).join("\n");
  const ajuste = feedback ? `

## Ajuste pedido por el usuario
Rehaz la maqueta aplicando EXACTAMENTE esto, sin perder lo que ya estaba bien:
\xAB${feedback.slice(0, 600)}\xBB` : "";
  return `# Ficha de dise\xF1o aprobada como base de la maqueta
${fichaTexto}

${seccionAdn(adn)}

${seccionAntiGenerico()}

${contrato}${htmlObjeto ? `

# OBJETO 3D FORJADO \u2014 HTML EXACTO a incluir en el hero (tal cual)
${htmlObjeto}` : ""}${htmlPrimitivas ? `

# PRIMITIVAS COMPILADAS \u2014 HTML de ejemplo de cada pieza (misma estructura y clases; cambia solo el contenido)
${htmlPrimitivas}` : ""}

# CSS determinista de la experiencia (INCLUIRLA tal cual en el <style> y a\xF1adir la tuya ENCIMA)
${cssForjado}${scriptForjado ? `

# SCRIPTS CAPADOS de las primitivas (pegar al final del <body> tal cual)
${scriptForjado}` : ""}

# Petici\xF3n original del usuario
${p.mensaje}${ajuste}${p.codigoActual ? `

# Contexto: c\xF3digo existente del proyecto (respeta su contenido y datos)
${p.codigoActual.slice(0, 6e3)}` : ""}`;
}
function corpusDeSenales(p, fichaTexto, adn, feedback) {
  const partes = [p.mensaje ?? ""];
  if (adn) partes.push(textoAdn(adn));
  const estructura = /##\s*Estructura[\s\S]{0,900}/i.exec(fichaTexto ?? "")?.[0] ?? "";
  const interaccion = /##\s*Interacci[oó]n[\s\S]{0,500}/i.exec(fichaTexto ?? "")?.[0] ?? "";
  partes.push(estructura, interaccion);
  if (feedback) partes.push(feedback, feedback);
  return partes.filter(Boolean).join("\n").slice(0, 6e3);
}
function notasDeMaqueta(_fichaTexto) {
  const pendientes = [
    "Los textos son provisionales pero realistas: revisa el tono y los datos (precios, horarios, nombre de la marca).",
    "Las im\xE1genes son placeholders decorativos: las reales se ponen en el c\xF3digo final.",
    "Si prefieres otra de las ideas listadas, p\xEDdelo (\xABusa la direcci\xF3n 2\xBB) y re-maqueto."
  ];
  return pendientes.map((p) => `- ${p}`).join("\n");
}
async function construirPropuesta(p, fichaTexto, deps, llamada) {
  const direcciones = parseDirecciones(fichaTexto);
  let html = "";
  const cache = deps.cache;
  const claveCache = cache ? claveMaqueta(p, fichaTexto) : "";
  const cacheada = claveCache && cache ? cache.obtener(claveCache) ?? null : null;
  try {
    const modelo = deps.cfg.porRol.codificador ?? deps.fallback;
    deps.onProgreso?.({
      tipo: "maqueta-inicio",
      modelo: `${modelo.providerId}:${modelo.modelId}`
    });
    if (cacheada) {
      html = cacheada;
    } else {
      const texto = await llamada(
        "codificador",
        PROMPT_MAQUETA,
        mensajeMaqueta(p, fichaTexto, null),
        1
      );
      html = extraerCodigo(texto);
      if (claveCache && cache && html.trim().length > 200) {
        cache.guardar(claveCache, html);
      }
    }
    deps.onProgreso?.({ tipo: "maqueta-fin", ok: html.length > 0 });
  } catch {
    deps.onProgreso?.({ tipo: "maqueta-fin", ok: false });
  }
  const informe = detectarGenericidad(html);
  return {
    direcciones,
    html,
    eleccion: 1,
    /** «propuesta» aunque el html haya fallado: la propuesta (ideas) sigue
     * en pie y el usuario puede elegir dirección o pedir «directo». */
    estado: "propuesta",
    notas: (informe.nivel === "alto" && html ? `- \u26A0 ${resumenAntiGenerico(informe)}: la maqueta cae en patrones de plantilla de IA; el Revisor y el Juez de Originalidad lo auditar\xE1n. Pide \xABAjusta: \u2026\xBB para salir del patr\xF3n.
` : "") + notasDeMaqueta(fichaTexto),
    ajustes: 0,
    genericidad: informe
  };
}
async function ajustarPropuesta(p, fichaTexto, propuesta, feedback, deps, llamada) {
  if (propuesta.ajustes >= MAX_AJUSTES_MAQUETA) {
    return {
      ...propuesta,
      notas: `- Tope de ${MAX_AJUSTES_MAQUETA} ajustes alcanzado. Si a\xFAn no convence, pide \xABdirecto\xBB y el equipo codifica la direcci\xF3n ${propuesta.eleccion} con tus \xFAltimas notas.
${propuesta.notas}`
    };
  }
  const eleccion = /direcci[oó]n\s*([123])/i.exec(feedback);
  const nuevaEleccion = eleccion ? Math.min(3, Math.max(1, Number(eleccion[1]))) : propuesta.eleccion;
  const feedbackFinal = eleccion ? `Cambia a la DIRECCI\xD3N ${nuevaEleccion} (\xAB${propuesta.direcciones.find((d) => d.n === nuevaEleccion)?.nombre ?? ""}\xBB). Reinterpreta la maqueta siguiendo ese concepto: ${feedback.replace(eleccion[0], "").trim()}` : feedback;
  let html = propuesta.html;
  try {
    const modelo = deps.cfg.porRol.codificador ?? deps.fallback;
    deps.onProgreso?.({
      tipo: "maqueta-inicio",
      modelo: `${modelo.providerId}:${modelo.modelId}`
    });
    const texto = await llamada(
      "codificador",
      PROMPT_MAQUETA,
      mensajeMaqueta(p, fichaTexto, feedbackFinal),
      propuesta.ajustes + 2
    );
    html = extraerCodigo(texto) || html;
    deps.onProgreso?.({ tipo: "maqueta-fin", ok: html !== propuesta.html });
  } catch {
    deps.onProgreso?.({ tipo: "maqueta-fin", ok: false });
  }
  return {
    ...propuesta,
    direcciones: propuesta.direcciones.length ? propuesta.direcciones : parseDirecciones(fichaTexto),
    html,
    eleccion: nuevaEleccion,
    estado: "ajustada",
    ajustes: propuesta.ajustes + 1,
    genericidad: detectarGenericidad(html)
  };
}
function respuestaDePropuesta(propuesta) {
  const ideas = propuesta.direcciones.length ? propuesta.direcciones.map(
    (d) => `${d.n}. **${d.nombre}** \u2014 ${d.concepto}${d.paleta ? `
   Paleta: ${d.paleta}` : ""}${d.tipografia ? `
   Tipograf\xEDa: ${d.tipografia}` : ""}`
  ).join("\n") : "- (el Dise\xF1ador no detall\xF3 direcciones; la maqueta sigue la ficha)";
  const maquetada = propuesta.direcciones.find((d) => d.n === propuesta.eleccion);
  const estadoHtml = propuesta.html ? "Tienes la maqueta navegable en la vista previa." : "No pude generar la maqueta visual ahora mismo (cuota o red); igualmente puedes elegir idea y sigo.";
  return `## Propuesta de dise\xF1o de FORJA IA

Antes de tirar c\xF3digo, aqu\xED van las ideas ${EQUIPO_FORJA.disenador.nombre.toLowerCase()} propuso:
${ideas}

### Maqueta actual: direcci\xF3n ${propuesta.eleccion}${maquetada ? ` \u2014 \xAB${maquetada.nombre}\xBB` : ""}
${estadoHtml}

### Qu\xE9 revisar
${propuesta.notas}

**Dime una de estas cosas para continuar:**
- \xABAprobado\xBB \u2192 el equipo codifica esta maqueta con su bucle de revisi\xF3n.
- \xABAjusta: \u2026\xBB \u2192 corrijo la maqueta (m\xE1x. ${MAX_AJUSTES_MAQUETA} ajustes).
- \xABUsa la direcci\xF3n 2/3\xBB \u2192 re-maqueto con otra idea.
- \xABDirecto\xBB \u2192 salto la propuesta y codifico ya.`;
}

// src/lib/prism/forja/vision.ts
var ORDEN_SEVERIDAD = {
  critico: 0,
  aviso: 1,
  mejora: 2
};
function colorDesde(valor) {
  const v = valor.trim().toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16)
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    ];
  }
  const rgb = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}
function luminancia([r, g, b]) {
  const canal = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function ratioContraste(a, b) {
  const ca = colorDesde(a);
  const cb = colorDesde(b);
  if (!ca || !cb) return null;
  const l1 = luminancia(ca);
  const l2 = luminancia(cb);
  const clara = Math.max(l1, l2);
  const oscura = Math.min(l1, l2);
  return (clara + 0.05) / (oscura + 0.05);
}
function evidencia(texto, max = 90) {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= max ? limpio : `${limpio.slice(0, max - 1)}\u2026`;
}
function push(out, h, limitePorTipo) {
  if (limitePorTipo) {
    const clave2 = `${h.severidad}:${h.titulo}`;
    const n = (limitePorTipo.get(clave2) ?? 0) + 1;
    limitePorTipo.set(clave2, n);
    if (n > 3) return;
  }
  out.push(h);
}
function chequeosEstaticos(html) {
  const out = [];
  if (!html || html.length < 20) return out;
  const limite = /* @__PURE__ */ new Map();
  const esDocumento = /<html[\s>]/i.test(html) || /<!doctype\s+html/i.test(html);
  if (esDocumento) {
    if (!/<meta\s+[^>]*name\s*=\s*["']viewport["'][^>]*>/i.test(html)) {
      out.push({
        severidad: "critico",
        categoria: "movil",
        titulo: "Falta el meta viewport",
        detalle: 'Sin <meta name="viewport" content="width=device-width\u2026"> la p\xE1gina se ve como un escritorio en miniatura en el m\xF3vil. Es el bug m\xF3vil n\xBA1 y se corrige con una l\xEDnea en el <head>.'
      });
    }
    if (!/<html[^>]*\slang\s*=/i.test(html)) {
      out.push({
        severidad: "aviso",
        categoria: "accesibilidad",
        titulo: "<html> sin atributo lang",
        detalle: 'Los lectores de pantalla y los traductores necesitan lang (p. ej. <html lang="es">) para pronunciar y traducir bien el contenido.'
      });
    }
    if (!/<meta\s+[^>]*charset/i.test(html)) {
      out.push({
        severidad: "aviso",
        categoria: "estandares",
        titulo: "Falta declarar el charset",
        detalle: 'A\xF1ade <meta charset="utf-8"> como primera l\xEDnea del <head>: sin \xE9l, acentos y e\xF1es pueden romperse.'
      });
    }
    const mTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (!mTitle || mTitle[1].trim().length === 0) {
      out.push({
        severidad: "aviso",
        categoria: "seo",
        titulo: "Falta el <title> de la p\xE1gina",
        detalle: "La pesta\xF1a del navegador, los marcadores y los buscadores usan el t\xEDtulo; vac\xEDo o ausente es un fallo b\xE1sico de SEO."
      });
    }
    if (!/<!doctype/i.test(html)) {
      out.push({
        severidad: "mejora",
        categoria: "estandares",
        titulo: "Falta <!DOCTYPE html>",
        detalle: "Sin doctype el navegador activa el \xABquirks mode\xBB y cambia el modelo de caja: siempre decl\xE1ralo."
      });
    }
  }
  const imagenes = html.match(/<img\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) ?? [];
  let sinAlt = 0;
  let sinDimensiones = 0;
  const ejemplosSinAlt = [];
  for (const img of imagenes) {
    if (!/\balt\s*=/i.test(img)) {
      sinAlt++;
      if (ejemplosSinAlt.length < 2) ejemplosSinAlt.push(evidencia(img));
    }
    if (!/\bwidth\s*=/i.test(img) && !/\bheight\s*=/i.test(img)) sinDimensiones++;
  }
  if (sinAlt > 0) {
    out.push({
      severidad: "critico",
      categoria: "accesibilidad",
      titulo: `Imagenes sin atributo alt (${sinAlt})`,
      detalle: `Un lector de pantalla no sabe qu\xE9 muestran. A\xF1ade alt descriptivo (o alt="" si es decorativa). Ejemplos: ${ejemplosSinAlt.join(" \xB7 ")}`
    });
  }
  if (sinDimensiones > 0) {
    push(out, {
      severidad: "mejora",
      categoria: "rendimiento",
      titulo: `Imagenes sin width/height (${sinDimensiones})`,
      detalle: "Sin dimensiones el navegador reserva mal el espacio y la p\xE1gina \xABsalta\xBB al cargar (CLS). Declara width y height, o aspect-ratio en CSS."
    }, limite);
  }
  const idsConLabel = /* @__PURE__ */ new Set();
  const rxLabel = /<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi;
  let mLabel;
  while ((mLabel = rxLabel.exec(html)) !== null) idsConLabel.add(mLabel[1]);
  const campos = html.match(/<(?:input|select|textarea)\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) ?? [];
  let camposSinEtiqueta = 0;
  const ejemplosCampo = [];
  for (const campo2 of campos) {
    const tipo = campo2.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if (["hidden", "submit", "button", "reset", "image"].includes(tipo)) continue;
    const id = campo2.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const ok = /\baria-label(?:ledby)?\s*=/i.test(campo2) || id !== "" && idsConLabel.has(id);
    if (!ok) {
      camposSinEtiqueta++;
      if (ejemplosCampo.length < 2) ejemplosCampo.push(evidencia(campo2));
    }
  }
  if (camposSinEtiqueta > 0) {
    out.push({
      severidad: "critico",
      categoria: "accesibilidad",
      titulo: `Campos de formulario sin etiqueta (${camposSinEtiqueta})`,
      detalle: `Todo input/select/textarea necesita <label for> (o aria-label). Ejemplos: ${ejemplosCampo.join(" \xB7 ")}`
    });
  }
  const rxButton = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let mButton;
  while ((mButton = rxButton.exec(html)) !== null) {
    const attrs = mButton[1];
    const contenido = mButton[2].replace(/<[^>]*>/g, "").trim();
    if (contenido === "" && !/\baria-label\s*=/i.test(attrs)) {
      push(out, {
        severidad: "aviso",
        categoria: "accesibilidad",
        titulo: "Bot\xF3n sin texto ni aria-label",
        detalle: "Los botones solo-icono (menu, cerrar, redes) deben llevar aria-label para que un lector de pantalla los anuncie."
      }, limite);
    }
  }
  const niveles = [];
  const rxH = /<h([1-6])\b/gi;
  let mH;
  while ((mH = rxH.exec(html)) !== null) niveles.push(Number(mH[1]));
  if (niveles.length > 0) {
    const h1 = niveles.filter((n) => n === 1).length;
    if (esDocumento && h1 === 0) {
      out.push({
        severidad: "aviso",
        categoria: "seo",
        titulo: "No hay ning\xFAn <h1>",
        detalle: "Cada p\xE1gina necesita un h1: es el titular principal para usuarios y buscadores."
      });
    }
    if (niveles[0] !== 1) {
      push(out, {
        severidad: "aviso",
        categoria: "accesibilidad",
        titulo: `El primer encabezado es h${niveles[0]}`,
        detalle: "La jerarqu\xEDa debe empezar en h1 y descender sin saltos: los lectores de pantalla la usan como \xEDndice."
      }, limite);
    }
    for (let i = 1; i < niveles.length; i++) {
      if (niveles[i] - niveles[i - 1] > 1) {
        push(out, {
          severidad: "aviso",
          categoria: "accesibilidad",
          titulo: `Salto de jerarqu\xEDa: h${niveles[i - 1]} \u2192 h${niveles[i]}`,
          detalle: "No saltes niveles (h2 \u2192 h4). Usa clases CSS para el tama\xF1o visual y conserva el orden sem\xE1ntico."
        }, limite);
        break;
      }
    }
    if (h1 > 1) {
      push(out, {
        severidad: "mejora",
        categoria: "seo",
        titulo: `Hay ${h1} h1 en la p\xE1gina`,
        detalle: "Lo normal es UN h1 por p\xE1gina; lo dem\xE1s deben ser h2/h3."
      }, limite);
    }
  }
  const rxA = /<a\b(?:"[^"]*"|'[^']*'|[^>])*>/gi;
  let mA;
  let blanksSinRel = 0;
  while ((mA = rxA.exec(html)) !== null) {
    if (!/\btarget\s*=\s*["']_blank["']/i.test(mA[0])) continue;
    const rel = mA[0].match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    if (!/noopener/i.test(rel)) blanksSinRel++;
  }
  if (blanksSinRel > 0) {
    push(out, {
      severidad: "aviso",
      categoria: "seguridad",
      titulo: `target="_blank" sin rel="noopener" (${blanksSinRel})`,
      detalle: 'La p\xE1gina abierta puede manipular la original (tabnabbing). A\xF1ade rel="noopener noreferrer" a cada enlace externo.'
    }, limite);
  }
  const enlacesMuertos = (html.match(/<a\b[^>]*href\s*=\s*["']#["']/gi) ?? []).length;
  if (enlacesMuertos >= 3) {
    push(out, {
      severidad: "mejora",
      categoria: "bug",
      titulo: `Enlaces muertos href="#" (${enlacesMuertos})`,
      detalle: "Muchos enlaces apuntan a \xAB#\xBB: en una maqueta es aceptable, pero en la entrega final cada enlace debe ir a su secci\xF3n o p\xE1gina."
    }, limite);
  }
  const paresContraste = [];
  const rxStyle = /style\s*=\s*["']([^"']*)["']/gi;
  let mStyle;
  while ((mStyle = rxStyle.exec(html)) !== null) {
    const s = mStyle[1];
    const color = s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1];
    const fondo = s.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1];
    if (color && fondo) paresContraste.push({ a: color, b: fondo, donde: evidencia(mStyle[0], 70) });
  }
  const rxStyleTag = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let mTag;
  while ((mTag = rxStyleTag.exec(html)) !== null) {
    const rxRegla = /([^{}]+)\{([^{}]*)\}/g;
    let mRegla;
    while ((mRegla = rxRegla.exec(mTag[1])) !== null) {
      const cuerpo = mRegla[2];
      const color = cuerpo.match(/(?:^|[;])\s*color\s*:\s*([^;]+)/i)?.[1];
      const fondo = cuerpo.match(/(?:^|[;])\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1];
      if (color && fondo) {
        paresContraste.push({ a: color, b: fondo, donde: evidencia(mRegla[1], 50) });
      }
    }
  }
  const bajos = [];
  for (const par of paresContraste) {
    if (bajos.length >= 3) break;
    const ratio = ratioContraste(par.a, par.b);
    if (ratio !== null && ratio < 4.5) {
      bajos.push(`${ratio.toFixed(2)}:1 (${par.donde})`);
    }
  }
  if (bajos.length > 0) {
    out.push({
      severidad: "aviso",
      categoria: "visual",
      titulo: "Contraste de texto posiblemente bajo",
      detalle: `Pares color/fondo declarados con menos de 4.5:1 (m\xEDnimo WCAG AA): ${bajos.join(" \xB7 ")}. El Inspector solo ve colores planos declarados: confirma sobre todo si hay texto sobre im\xE1genes o degradados.`
    });
  }
  const tamanos = [];
  const rxFont = /font-size\s*:\s*(\d+(?:\.\d+)?)px/gi;
  let mFont;
  while ((mFont = rxFont.exec(html)) !== null) tamanos.push(Number(mFont[1]));
  const pequenos = tamanos.filter((t) => t < 12);
  if (pequenos.length > 0) {
    push(out, {
      severidad: "aviso",
      categoria: "accesibilidad",
      titulo: `Texto con fuente < 12px (${pequenos.length} casos, m\xEDnimo ${Math.min(...pequenos)}px)`,
      detalle: "Por debajo de 12px la lectura se hace dif\xEDcil, sobre todo en m\xF3vil. Sube esos tama\xF1os o usa rem."
    }, limite);
  }
  const obsoletas = ["center", "font", "marquee", "big", "strike", "tt", "frame", "frameset"].filter((t) => new RegExp(`<${t}[\\s>]`, "i").test(html));
  if (obsoletas.length > 0) {
    out.push({
      severidad: "aviso",
      categoria: "estandares",
      titulo: `Etiquetas HTML obsoletas: ${obsoletas.map((t) => `<${t}>`).join(", ")}`,
      detalle: "Estas etiquetas ya no son est\xE1ndar y pueden comportarse distinto en cada navegador. Sustit\xFAyelas por CSS."
    });
  }
  const inline = (html.match(/\son(?:click|mouseover|mouseout|change|submit|load)\s*=/gi) ?? []).length;
  if (inline > 0) {
    push(out, {
      severidad: "mejora",
      categoria: "bug",
      titulo: `Manejadores de eventos inline (${inline})`,
      detalle: 'Los onclick="\u2026" inline dificultan el mantenimiento y la CSP. Mueve los eventos a addEventListener en el <script>.'
    }, limite);
  }
  const mTab = html.match(/tabindex\s*=\s*["'](\d+)["']/i);
  if (mTab && Number(mTab[1]) > 0) {
    push(out, {
      severidad: "aviso",
      categoria: "accesibilidad",
      titulo: "tabindex positivo en el HTML",
      detalle: 'tabindex="1\u2026" rompe el orden natural de foco. Usa tabindex="0" o reordena el DOM.'
    }, limite);
  }
  const videos = html.match(/<video\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) ?? [];
  for (const video of videos) {
    if (/\bautoplay/i.test(video) && !/\bmuted/i.test(video)) {
      push(out, {
        severidad: "aviso",
        categoria: "bug",
        titulo: "<video autoplay> sin muted",
        detalle: "Los navegadores bloquean el autoplay con sonido: el v\xEDdeo no arrancar\xE1. A\xF1ade muted (y playsinline para iOS)."
      }, limite);
      break;
    }
  }
  const ordenado = out.sort(
    (a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad]
  );
  return ordenado.slice(0, 30);
}
function informeInspector(hallazgos) {
  if (hallazgos.length === 0) return "";
  const lineas = hallazgos.map((h, i) => {
    const etiqueta = h.severidad.toUpperCase();
    return `${i + 1}. [${etiqueta}/${h.categoria}] ${h.titulo} \u2014 ${h.detalle}`;
  });
  const criticos = hallazgos.filter((h) => h.severidad === "critico").length;
  return `---INSPECTOR VISUAL DE FORJA IA (chequeo autom\xE1tico del HTML: regex, no opini\xF3n)---
${lineas.join("\n")}

Estos hallazgos son OBJETIVOS pero automatizados: confirma o descarta cada uno
con tu criterio. Los CR\xCDTICOS confirmados (${criticos} en esta lista) impiden
aprobar la entrega hasta que el Codificador los corrija.
---FIN INSPECTOR VISUAL---`;
}
var PROMPT_VISION = `## Qui\xE9n eres
Eres el Inspector Visual de FORJA IA. Recibes una CAPTURA DE PANTALLA de una
p\xE1gina web (y opcionalmente su HTML). Tu trabajo es encontrar defectos que se
VEN: elementos solapados, texto cortado o que desborda, scroll horizontal,
im\xE1genes rotas o deformadas, botones ilegibles, contraste insuficiente,
espacios vac\xEDos raros, layout roto en m\xF3vil.

## Reglas
1. Solo se\xF1ales lo que se puede VER en la captura: nada de opiniones de gusto.
2. Cada hallazgo: QU\xC9 ves mal, D\xD3NDE est\xE1 en pantalla, C\xD3MO se corregir\xEDa.
3. Entre 3 y 8 hallazgos como m\xE1ximo. Si la captura est\xE1 limpia, dilo.
4. NO reescribes la p\xE1gina completa: describes defectos puntuales.`;
var FORMATO_VISION = `## Formato de salida OBLIGATORIO
Un hallazgo por etiqueta:
<hallazgo severidad="critico|aviso|mejora" categoria="visual|accesibilidad|movil|bug">T\xEDtulo \u2014 d\xF3nde est\xE1 y c\xF3mo corregirlo</hallazgo>
Si NO hay defectos visibles: <sin-hallazgos />
Y cierra siempre con: <veredicto>ok|con-defectos</veredicto>`;
function mensajeVision(captura) {
  return [
    "Analiza la captura adjunta de esta p\xE1gina web.",
    captura.html ? `Para ayudarte, el HTML de la p\xE1gina (recortado):
${captura.html.slice(0, 6e3)}` : "",
    "Devuelve los hallazgos en el formato acordado."
  ].filter(Boolean).join("\n\n");
}
function parseHallazgos(texto) {
  const out = [];
  if (!texto) return out;
  if (/<sin-hallazgos/i.test(texto)) return out;
  const sinTildes = (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const normalizaSeveridad = (bruto) => {
    const v = sinTildes(bruto);
    if (v.includes("crit")) return "critico";
    if (v.includes("mejora") || v.includes("minor") || v.includes("info")) return "mejora";
    return "aviso";
  };
  const normalizaCategoria = (bruto) => {
    const v = sinTildes(bruto);
    if (v.includes("acces") || v === "a11y") return "accesibilidad";
    if (v.includes("movil") || v.includes("responsive") || v.includes("mobile")) return "movil";
    if (v.includes("visual") || v.includes("estet")) return "visual";
    if (v.includes("seo")) return "seo";
    if (v.includes("rend") || v.includes("perf")) return "rendimiento";
    if (v.includes("segur")) return "seguridad";
    if (v.includes("estandar")) return "estandares";
    return "bug";
  };
  const rxTag = /<hallazgo\b([^>]*)>([\s\S]*?)<\/hallazgo>/gi;
  let m;
  while ((m = rxTag.exec(texto)) !== null && out.length < 12) {
    const attrs = m[1];
    const cuerpo = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!cuerpo) continue;
    out.push({
      severidad: normalizaSeveridad(attrs.match(/severidad\s*=\s*["']([^"']*)["']/i)?.[1] ?? ""),
      categoria: normalizaCategoria(attrs.match(/categoria\s*=\s*["']([^"']*)["']/i)?.[1] ?? ""),
      titulo: cuerpo.split(/[—–-]/)[0].trim().slice(0, 90) || cuerpo.slice(0, 90),
      detalle: cuerpo.slice(0, 260)
    });
  }
  if (out.length === 0) {
    const lineas = texto.split(/\n+/).filter((l) => /^\s*[-*\d.)]/.test(l));
    for (const linea of lineas.slice(0, 12)) {
      const cuerpo = linea.replace(/^\s*[-*\d.)\s]+/, "").trim();
      if (cuerpo.length < 8) continue;
      out.push({
        severidad: /\bcr[ií]tico\b/i.test(cuerpo) ? "critico" : "aviso",
        categoria: "bug",
        titulo: cuerpo.split(/[—–-]/)[0].trim().slice(0, 90),
        detalle: cuerpo.slice(0, 260)
      });
    }
  }
  return out;
}

// src/lib/prism/forja/continuacion-nucleo.ts
function esTruncadoEstructural(texto) {
  const t = texto ?? "";
  if (!t.trim()) return false;
  const cercas = (t.match(/```/g) ?? []).length;
  if (cercas % 2 === 1) return true;
  const minLargo = 200;
  if (t.length >= minLargo) {
    const abreHtml = /<html[\s>]/i.test(t);
    const cierraHtml = /<\/html\s*>/i.test(t);
    if (abreHtml && !cierraHtml) return true;
    const abreEstilo = /<style[\s>]/i.test(t);
    const cierraEstilo = /<\/style\s*>/i.test(t);
    if (abreEstilo && !cierraEstilo) return true;
    const abreScript = /<script[\s>]/i.test(t);
    const cierraScript = /<\/script\s*>/i.test(t);
    if (abreScript && !cierraScript) return true;
  }
  const ultima = t.lastIndexOf("<");
  if (ultima !== -1 && ultima > t.length - 80) {
    const cola = t.slice(ultima);
    if (!cola.includes(">") && /^[a-zA-Z!\/]/.test(cola.slice(1))) return true;
  }
  return false;
}
function promptContinuacion(textoCortado) {
  const cola = textoCortado.slice(-600);
  return `Tu respuesta anterior se CORT\xD3 por el l\xEDmite de longitud del proveedor. Esto es lo \xFAltimo que escribiste:

---\xDALTIMAS L\xCDNEAS---
${cola}
---FIN---

CONTIN\xDAA EXACTAMENTE donde lo dejaste, como si fuera el mismo texto cortado en medio de una palabra:
\xB7 NO repitas nada de lo que ya escribiste.
\xB7 NO resumas, NO comentes, NO pidas permiso, NO a\xF1adas encabezados nuevos.
\xB7 Contin\xFAa el contenido l\xEDnea a l\xEDnea desde el punto exacto del corte.
\xB7 Si el corte ocurri\xF3 dentro de un bloque de c\xF3digo, contin\xFAa el c\xF3digo (no abras un cercado nuevo).
\xB7 Si el contenido ya estaba completo, escribe \xFAnicamente: FORJA-FIN`;
}
function limpiaContinuacion(pieza) {
  let t = pieza.trim();
  t = t.replace(/\s*FORJA-FIN\s*$/, "");
  t = t.replace(/^FORJA-FIN\s*$/, "");
  t = t.replace(/```[a-z]*\s*$/, "");
  return t;
}
var MAX_CONTINUACIONES_NUCLEO = 2;
async function continuarSalidaTruncada(opciones) {
  const { salida, continuarCon, onContinuacion } = opciones;
  const max = opciones.maxContinuaciones ?? MAX_CONTINUACIONES_NUCLEO;
  let texto = salida;
  let n = 0;
  while (n < max && texto.length > 40 && esTruncadoEstructural(texto)) {
    n += 1;
    onContinuacion?.(n);
    try {
      const pieza = await continuarCon(promptContinuacion(texto));
      if (!pieza.trim()) break;
      texto = `${texto}
${limpiaContinuacion(pieza)}`;
    } catch {
      break;
    }
  }
  return { texto, continuaciones: n, sigueTruncada: esTruncadoEstructural(texto) };
}
function continuarConLlamada(llamar, base) {
  return (user) => llamar({
    providerId: base.providerId,
    modelId: base.modelId,
    system: base.system,
    user,
    temperatura: base.temperatura,
    rol: base.rol,
    maxTokens: base.maxTokens,
    onFragmento: base.onFragmento
  });
}

// src/lib/prism/forja/nucleo.ts
function modeloDeRol(cfg, rol, fallback) {
  return cfg.porRol[rol] ?? fallback;
}
function crearLlamadora(cfg, deps, rondas, fallback) {
  const temp = (rol) => cfg.temperaturaPorRol?.[rol] ?? EQUIPO_FORJA[rol].temperatura;
  return async (rol, system, user, ronda, artefacto = rol === "disenador" ? "ficha-diseno" : rol === "codificador" ? "codigo" : "veredicto") => {
    const modelo = modeloDeRol(cfg, rol, fallback);
    const clave2 = `${modelo.providerId}:${modelo.modelId}`;
    deps.onProgreso?.({ tipo: "rol-inicio", rol, ronda, modelo: clave2 });
    const t0 = Date.now();
    let salida = "";
    try {
      salida = await deps.llamarModelo({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system,
        user,
        temperatura: temp(rol),
        onFragmento: (t) => deps.onProgreso?.({ tipo: "fragmento", rol, texto: t }),
        // v4.1: el rol viaja con la llamada — el adaptador-resiliente lo usa
        // para pedir el techo de salida correcto (16k+ en el Codificador)
        // y elegir la cadena de suplentes si el proveedor cae.
        rol,
        // v4.2: presupuesto de salida POR ROL desde la config — el
        // adaptador lo aplica al transporte tal cual.
        maxTokens: techoTokens(cfg, rol)
      });
      const res = await continuarSalidaTruncada({
        salida,
        continuarCon: continuarConLlamada(deps.llamarModelo, {
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system,
          temperatura: temp(rol),
          rol,
          maxTokens: techoTokens(cfg, rol),
          onFragmento: (t) => deps.onProgreso?.({ tipo: "fragmento", rol, texto: t })
        }),
        onContinuacion: (n) => deps.onProgreso?.({ tipo: "continuacion-nucleo", rol, ronda, n })
      });
      salida = res.texto;
    } finally {
      rondas.push({
        n: ronda,
        rol,
        artefacto,
        salida,
        modeloUsado: clave2,
        duracionMs: Date.now() - t0
      });
      deps.onProgreso?.({ tipo: "rol-fin", rol, ronda, ok: salida.length > 0 });
    }
    return salida;
  };
}
function mensajeDisenador(p) {
  return p.codigoActual ? `Proyecto existente que hay que redise\xF1ar o ampliar (c\xF3digo actual entre marcadores):
---CODIGO-ACTUAL---
${p.codigoActual.slice(0, 8e3)}
---FIN---

Petici\xF3n del usuario: ${p.mensaje}` : `Petici\xF3n del usuario: ${p.mensaje}`;
}
function mensajeCodificador(p, ficha, defectos, adnSeccion) {
  const correccion = defectos ? `

## Ronda de correcci\xF3n
El Revisor rechaz\xF3 la versi\xF3n anterior por estos defectos CONCRETOS. Corr\xEDgelos TODOS sin rehacer lo que ya estaba bien:
${defectos.map((d, i) => `${i + 1}. ${d}`).join("\n")}` : "";
  return `# Ficha de dise\xF1o (cumple esto al detalle)
${ficha}

${adnSeccion}${correccion}

# Petici\xF3n original del usuario
${p.mensaje}${p.codigoActual ? `

# C\xF3digo actual del proyecto (m\xF3dulo a editar, no borrar)
${p.codigoActual.slice(0, 12e3)}` : ""}`;
}
function mensajeRevisor(p, ficha, codigo, inspector, adnSeccion, antiGenerico) {
  const bloque = inspector ? `

# ${inspector}` : "";
  return `# Petici\xF3n del usuario
${p.mensaje}

# Ficha de dise\xF1o aprobada
${ficha}

${adnSeccion}

Audita tambi\xE9n contra las PROHIBICIONES del ADN: si el c\xF3digo incumple una, es un defecto.

# C\xF3digo a auditar
${codigo.slice(0, 14e3)}${bloque}${antiGenerico}`;
}
function preparacion(peticion, cfg, deps) {
  const todasLasReglas = reglasParaPrompt(deps.memoria);
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;
  const reglasGlobales = (peticion.conocimientoGlobal ?? []).slice(
    0,
    PERFILES[perfil].reglasGlobales
  );
  const sugeridas = /* @__PURE__ */ new Set([
    ...cfg.habilidades,
    ...habilidadesSugeridas(peticion.mensaje)
  ]);
  return {
    bloques: bloquesDeHabilidades([...sugeridas]),
    reglasDiseno: todasLasReglas,
    reglasCalidad: todasLasReglas.filter(esReglaDeCalidad),
    reglasGlobales
  };
}
function adnEfectivo(fichaTexto, peticion) {
  return sanearAdn(parseAdn(fichaTexto) ?? adnDesdePeticion(peticion.mensaje));
}
async function ejecutarForja(peticion, cfg, deps, fallback) {
  const rondas = [];
  const llamada = crearLlamadora(cfg, deps, rondas, fallback);
  const { bloques, reglasDiseno, reglasGlobales } = preparacion(peticion, cfg, deps);
  const conMaqueta = debeMaquetar(peticion, cfg);
  let fichaTexto;
  const cache = deps.cache;
  const claveCache = cache ? claveFicha(peticion, cfg) : "";
  const cacheada = claveCache && cache ? cache.obtener(claveCache) ?? null : null;
  if (cacheada) {
    deps.onProgreso?.({ tipo: "cache", que: "ficha" });
    fichaTexto = cacheada;
  } else {
    fichaTexto = await llamada(
      "disenador",
      promptDisenador(
        bloques,
        reglasDiseno,
        reglasGlobales,
        conMaqueta,
        false,
        seccionRepresentacion(peticion.mensaje)
      ),
      mensajeDisenador(peticion),
      1
    );
    if (claveCache && cache && fichaTexto.trim().length > 80) {
      cache.guardar(claveCache, fichaTexto);
    }
  }
  const adn = adnEfectivo(fichaTexto, peticion);
  if (conMaqueta) {
    deps.onProgreso?.({ tipo: "maqueta", fase: "inicio" });
    const depsMaqueta = {
      llamarModelo: deps.llamarModelo,
      fallback,
      cfg,
      cache: deps.cache
      // v4.2: la maqueta inicial también se cachea
    };
    const propuesta = await construirPropuesta(
      peticion,
      fichaTexto,
      depsMaqueta,
      async (rol, system, user, ronda) => llamada(rol, system, user, ronda, "maqueta")
    );
    deps.onProgreso?.({ tipo: "maqueta", fase: "fin", ok: propuesta.html.length > 0 });
    deps.onProgreso?.({ tipo: "fin", agotado: false });
    return {
      estado: "esperando-aprobacion",
      codigo: "",
      respuesta: respuestaDePropuesta(propuesta),
      ficha: fichaFDesdeTexto(fichaTexto),
      fichaTexto,
      maqueta: propuesta,
      rondas,
      veredicto: null,
      agotado: false,
      adn
    };
  }
  return continuarForja(peticion, fichaTexto, cfg, deps, fallback, adn);
}
async function continuarForja(peticion, fichaTexto, cfg, deps, fallback, adnPrecomputado) {
  const rondas = [];
  const llamada = crearLlamadora(cfg, deps, rondas, fallback);
  const { reglasCalidad } = preparacion(peticion, cfg, deps);
  const maxRondas = rondasDePerfil(cfg);
  const adn = adnPrecomputado ?? adnEfectivo(fichaTexto, peticion);
  const adnSeccion = seccionAdn(adn);
  let codigo = "";
  let veredicto = parseVeredicto("");
  let codificadorTexto = "";
  let hallazgosFinales = [];
  for (let ronda = 1; ronda <= maxRondas; ronda++) {
    codificadorTexto = await llamada(
      "codificador",
      promptCodificador(reglasCalidad),
      mensajeCodificador(peticion, fichaTexto, ronda > 1 ? veredicto.defectos : null, adnSeccion),
      ronda
    );
    codigo = extraerCodigo(codificadorTexto);
    const hallazgos = chequeosEstaticos(codigo);
    hallazgosFinales = hallazgos;
    deps.onProgreso?.({
      tipo: "vision",
      ronda,
      total: hallazgos.length,
      criticos: hallazgos.filter((h) => h.severidad === "critico").length
    });
    const informe = detectarGenericidad(codigo);
    const revisorTexto = await llamada(
      "revisor",
      promptRevisor(),
      mensajeRevisor(
        peticion,
        fichaTexto,
        codigo,
        informeInspector(hallazgos),
        adnSeccion,
        informeAntiGenericoParaRevisor(informe)
      ),
      ronda
    );
    veredicto = parseVeredicto(revisorTexto);
    if (veredicto.aprobado) break;
    if (ronda < maxRondas) {
      deps.onProgreso?.({ tipo: "bucle", ronda, defectos: veredicto.defectos });
    }
  }
  const agotado = !veredicto.aprobado;
  const informeFinal = detectarGenericidad(codigo);
  if (!agotado) {
    const decisiones = extraerDecisiones(codificadorTexto);
    if (decisiones.length) {
      const nueva = aprenderDeExito(deps.memoria, decisiones);
      deps.onMemoriaNueva?.(nueva);
    }
  }
  deps.onProgreso?.({ tipo: "fin", agotado });
  const respuesta = construirRespuesta({
    peticion,
    fichaTexto,
    veredicto,
    rondas,
    agotado,
    maxRondas,
    hallazgos: hallazgosFinales,
    adn,
    informe: informeFinal
  });
  return {
    estado: "completo",
    codigo,
    respuesta,
    ficha: fichaFDesdeTexto(fichaTexto),
    fichaTexto,
    maqueta: null,
    rondas,
    veredicto,
    agotado,
    vision: hallazgosFinales,
    adn,
    genericidad: informeFinal
  };
}
async function ajustarMaquetaForja(peticion, fichaTexto, propuesta, feedback, cfg, deps, fallback) {
  const rondas = [];
  const llamada = crearLlamadora(cfg, deps, rondas, fallback);
  const depsMaqueta = {
    llamarModelo: deps.llamarModelo,
    fallback,
    cfg,
    cache: deps.cache
    // v4.2: los ajustes de maqueta NO se cachean, pero la
    // clave queda lista por si DependenciasMaqueta la reusa en el futuro
  };
  const nueva = await ajustarPropuesta(
    peticion,
    fichaTexto,
    propuesta,
    feedback,
    depsMaqueta,
    async (rol, system, user, ronda) => llamada(rol, system, user, ronda, "maqueta")
  );
  deps.onProgreso?.({ tipo: "fin", agotado: false });
  return {
    estado: "esperando-aprobacion",
    codigo: "",
    respuesta: respuestaDePropuesta(nueva),
    ficha: fichaFDesdeTexto(fichaTexto),
    fichaTexto,
    maqueta: nueva,
    rondas,
    veredicto: null,
    agotado: false,
    adn: adnEfectivo(fichaTexto, peticion)
  };
}
function informeAntiGenericoParaRevisor(informe) {
  if (informe.sintomas.length === 0) return "";
  return `

---INFORME ANTI-GEN\xC9RICO---
${resumenAntiGenerico(informe)}
${informe.sintomas.map((s) => `- ${s.nombre}: ${s.motivo}. ALTERNATIVA: ${s.alternativa}`).join("\n")}
---FIN INFORME---`;
}
function construirRespuesta(ctx) {
  const { fichaTexto, veredicto, rondas, agotado, maxRondas, hallazgos, adn, informe } = ctx;
  const rondasCodigo = rondas.filter((r) => r.rol === "codificador" && r.artefacto === "codigo").length;
  const participacion = ORDEN_PIPELINE.map((rol) => {
    const usos = rondas.filter((r) => r.rol === rol && r.artefacto !== "maqueta").length;
    const nombre = EQUIPO_FORJA[rol].nombre;
    return `- **${nombre}** (${usos} pasada${usos === 1 ? "" : "s"}): ${EQUIPO_FORJA[rol].resumen}`;
  }).join("\n");
  const estado = agotado ? `El Revisor sigui\xF3 encontrando defectos tras ${maxRondas} rondas, as\xED que recibes la mejor versi\xF3n alcanzada junto a los puntos pendientes.` : `El Revisor aprob\xF3 la entrega tras ${rondasCodigo} ronda${rondasCodigo === 1 ? "" : "s"} de c\xF3digo.`;
  const defectos = agotado && veredicto.defectos.length ? `

**Pendientes que el Revisor se\xF1ala:**
${veredicto.defectos.map((d) => `- ${d}`).join("\n")}` : "";
  const vision = seccionVision(hallazgos);
  const seccionAdnTexto = `

### ADN visual del proyecto
${textoAdn(adn)}`;
  const seccionAnti = `

### Anti-gen\xE9rico
${textoInformeAntiGenerico(informe)}`;
  return `## Entrega de FORJA IA

${estado}

### C\xF3mo trabaj\xF3 el equipo
${participacion}

### Decisiones de dise\xF1o
${resumenFicha(fichaTexto)}${seccionAdnTexto}${vision}${seccionAnti}${defectos}

\xBFQuieres que ajuste algo? Puedo cambiar una secci\xF3n concreta, aplicar otra paleta o convertir el proyecto a React.`;
}
function seccionVision(hallazgos) {
  if (hallazgos.length === 0) {
    return "\n\n### Inspector visual\nSin hallazgos: viewport, alt, etiquetas, jerarqu\xEDa y contraste b\xE1sicos, correctos.";
  }
  const criticos = hallazgos.filter((h) => h.severidad === "critico").length;
  const lista = hallazgos.slice(0, 6).map((h) => `- **[${h.severidad}]** ${h.titulo}`).join("\n");
  const resto = hallazgos.length > 6 ? `
- \u2026y ${hallazgos.length - 6} hallazgo(s) m\xE1s en la pesta\xF1a Inspector.` : "";
  return `

### Inspector visual
${criticos > 0 ? `\u26A0 ${criticos} hallazgo(s) cr\xEDtico(s) \u2014 el Revisor los tuvo en cuenta.

` : ""}${lista}${resto}`;
}
function resumenFicha(fichaTexto) {
  const lineas = fichaTexto.split(/\n/).filter((l) => /^(Tipo de web|Público|Mensaje principal):/i.test(l.trim())).map((l) => `- ${l.trim()}`);
  return lineas.length ? lineas.join("\n") : "- Ver ficha completa arriba.";
}
function fichaFDesdeTexto(texto) {
  const campo2 = (nombre) => {
    const m = texto.match(new RegExp(`${nombre}:\\s*(.+)`, "i"));
    return m ? m[1].trim() : "";
  };
  const lista = (encabezado) => {
    const m = texto.match(
      new RegExp(`## ${encabezado}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, "i")
    );
    if (!m) return [];
    return m[1].split(/\n/).map((l) => l.trim().replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 12);
  };
  return {
    tipoWeb: campo2("Tipo de web"),
    publico: campo2("P\xFAblico"),
    mensajePrincipal: campo2("Mensaje principal"),
    paleta: lista("Paleta").join(" \xB7 "),
    tipografia: lista("Tipograf\xEDa").join(" \xB7 "),
    estructura: lista("Estructura"),
    interaccion: lista("Interacci\xF3n"),
    restricciones: lista("Restricciones")
  };
}

// src/lib/prism/forja/adn2.ts
function adn2Vacio() {
  return {
    personalidad: [],
    sensacion: [],
    lenguaje: [],
    prohibiciones: [],
    identidad: "",
    composicion: [],
    tipografia: [],
    color: [],
    espaciado: [],
    movimiento: [],
    representacion: [],
    interaccion: [],
    referencias: [],
    antiPatrones: [],
    accesibilidad: []
  };
}
function adn2EstaVacio(adn) {
  if (!adn) return true;
  const vacio = (xs) => !xs || xs.length === 0;
  return !adn.identidad && vacio(adn.personalidad) && vacio(adn.sensacion) && vacio(adn.composicion) && vacio(adn.tipografia) && vacio(adn.color) && vacio(adn.espaciado) && vacio(adn.movimiento) && vacio(adn.representacion) && vacio(adn.interaccion) && vacio(adn.prohibiciones) && vacio(adn.referencias) && vacio(adn.antiPatrones) && vacio(adn.accesibilidad);
}
function adn2DesdeAdn1(adn1, mensaje) {
  const base = adn1 && !adnVacio1(adn1) ? adn1 : adn1DeRespaldo(mensaje);
  const m = (mensaje || "").toLowerCase();
  const sensible = /\b(banco|financ|legal|abogad|cl[ií]nic|salud|gobierno|segur)\b/.test(m);
  const editorial = /\b(portfolio|portafolio|revista|blog|editorial|agencia|fotograf)\b/.test(m);
  const vivaz = /\b(fiesta|evento|musica|m[uú]sic|juego|gaming|bar|restaurante|moda)\b/.test(m);
  const { dna: exp } = sintetizarExperienciaDna(mensaje);
  const moderna = exp.spatial.depth >= 0.5 || exp.motion.intensity >= 0.6;
  return {
    ...base,
    identidad: sensible && "una instituci\xF3n fiable que inspire calma y control" || editorial && "una voz editorial con car\xE1cter y aire" || vivaz && "una marca vivaz que se recuerda en diez segundos" || "un producto profesional con decisiones propias, nunca una plantilla",
    composicion: listaLimpia([
      editorial ? "ret\xEDcula editorial asim\xE9trica con foco claro" : "ret\xEDcula de 12 columnas con rompimientos intencionales",
      "un solo focal point por pantalla",
      vivaz ? "densidad alta controlada con aire en la jerarqu\xEDa" : "espacio negativo generoso alrededor de lo importante",
      ...moderna ? [
        `profundidad por capas (modo ${exp.spatial.mode}, ${exp.spatial.layers} capas declaradas)`,
        exp.object.use3d ? "objeto 3D focal con tratamiento propio" : "superficies flotantes con elevaci\xF3n distinta por capa"
      ] : []
    ], MAX_LISTA_ADN2),
    tipografia: listaLimpia([
      "pareja display + texto con contraste real de peso",
      "escala modular 1.25 con ritmo vertical estable",
      "n\xFAmeros tabulares en datos y precios"
    ], MAX_LISTA_ADN2),
    color: listaLimpia([
      sensible ? "paleta sobria: un dominante oscuro, un acento sereno, grises con matiz" : "un color dominante con car\xE1cter, un acento \xFAnico, neutros con matiz propio",
      "prohibido el azul por defecto (#3b82f6 y familia) como identidad",
      "el acento se usa en UNA cosa por pantalla: la acci\xF3n importante"
    ], MAX_LISTA_ADN2),
    espaciado: listaLimpia([
      "escala de espaciado en m\xFAltiplos de 4",
      "secciones que respiran: m\xEDnimo 96px de aire entre bloques",
      "el aire es jerarqu\xEDa: lo importante tiene m\xE1s espacio, no m\xE1s ruido"
    ], MAX_LISTA_ADN2),
    movimiento: listaLimpia([
      // v4.5 §9: timing POR CATEGORÍA, no una regla global estrecha
      "microinteracci\xF3n 150-300ms \xB7 componente 250-600ms \xB7 reveal 500-1000ms \xB7 escena 800-1600ms \xB7 ambiente continuo",
      exp.motion.intensity >= 0.6 ? "el movimiento tiene coreograf\xEDa: entrada escalonada, parallax por capas y flotaci\xF3n del objeto" : "solo se mueve lo que significa algo: feedback, foco, transici\xF3n",
      "respeto total de prefers-reduced-motion"
    ], MAX_LISTA_ADN2),
    representacion: listaLimpia(
      REPRESENTACIONES.slice(0, 3).map((r) => r.nombre),
      MAX_LISTA_ADN2
    ),
    interaccion: listaLimpia([
      "estados hover/focus/active definidos para TODO lo clicable",
      "foco visible siempre (nunca outline:none sin alternativa)",
      "feedback inmediato en cada acci\xF3n (menos de 100ms)",
      ...exp.interaction.richness >= 0.7 ? ["interacci\xF3n avanzada: magnetic CTA y tilt en piezas clave"] : []
    ], MAX_LISTA_ADN2),
    referencias: [],
    antiPatrones: listaLimpia([
      "hero centrado + t\xEDtulo gigante + bot\xF3n azul",
      "tres tarjetas gemelas como \xFAnica forma de listar",
      "dashboard de cajitas sin narrativa"
    ], MAX_LISTA_ADN2),
    accesibilidad: listaLimpia([
      "contraste AA (4.5:1 texto, 3:1 texto grande) en pares declarados",
      "navegaci\xF3n completa por teclado con orden l\xF3gico",
      "alt en toda imagen y label en todo campo"
    ], MAX_LISTA_ADN2)
  };
}
function adnVacio1(adn) {
  return adn.personalidad.length === 0 && adn.sensacion.length === 0 && adn.lenguaje.length === 0 && adn.prohibiciones.length === 0;
}
function adn1DeRespaldo(mensaje) {
  const m = (mensaje || "").toLowerCase();
  const sensible = /\b(banco|financ|legal|abogad|cl[ií]nic|salud|gobierno|segur)\b/.test(m);
  const vital = /\b(fiesta|evento|musica|m[uú]sic|juego|gaming|bar|restaurante|moda)\b/.test(m);
  return sanearAdn({
    personalidad: sensible ? ["sobrio", "fiable", "preciso", "cercano"] : vital ? ["energ\xE9tico", "expresivo", "directo", "moderno"] : ["profesional", "claro", "preciso", "moderno"],
    sensacion: [
      { eje: "confianza", valor: sensible ? 9 : 7 },
      { eje: "claridad", valor: 8 },
      { eje: "innovaci\xF3n", valor: vital ? 8 : 5 },
      { eje: "agresividad", valor: vital ? 6 : 2 }
    ],
    lenguaje: [
      "superficies limpias",
      "jerarqu\xEDa evidente en 10 segundos",
      "tipograf\xEDa protagonista",
      "espacios negativos generosos"
    ],
    prohibiciones: [
      "tarjetas gen\xE9ricas en fila",
      "gradientes excesivos",
      "dashboards de cajitas",
      "blobs decorativos de fondo",
      "glassmorphism en exceso",
      "layouts repetitivos de plantilla"
    ]
  });
}
function sanearAdn2(adn) {
  const sensacion = [];
  const vistos = /* @__PURE__ */ new Set();
  for (const e of adn.sensacion) {
    const eje = (e.eje ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 48);
    if (eje.length < 3 || vistos.has(eje)) continue;
    vistos.add(eje);
    sensacion.push({ eje, valor: Math.max(0, Math.min(10, Math.round(Number(e.valor) || 0))) });
  }
  const core = sanearAdn({
    personalidad: adn.personalidad,
    sensacion,
    lenguaje: adn.lenguaje,
    prohibiciones: adn.prohibiciones
  });
  return {
    ...core,
    identidad: (adn.identidad ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    composicion: listaLimpia(adn.composicion ?? [], MAX_LISTA_ADN2),
    tipografia: listaLimpia(adn.tipografia ?? [], MAX_LISTA_ADN2),
    color: listaLimpia(adn.color ?? [], MAX_LISTA_ADN2),
    espaciado: listaLimpia(adn.espaciado ?? [], MAX_LISTA_ADN2),
    movimiento: listaLimpia(adn.movimiento ?? [], MAX_LISTA_ADN2),
    representacion: listaLimpia(adn.representacion ?? [], MAX_LISTA_ADN2),
    interaccion: listaLimpia(adn.interaccion ?? [], MAX_LISTA_ADN2),
    referencias: listaLimpia(adn.referencias ?? [], MAX_LISTA_ADN2),
    antiPatrones: listaLimpia(adn.antiPatrones ?? [], MAX_LISTA_ADN2),
    accesibilidad: listaLimpia(adn.accesibilidad ?? [], MAX_LISTA_ADN2)
  };
}
function parseAdn2(texto) {
  if (!texto) return null;
  const bloque = texto.match(/<adn2>([\s\S]*?)<\/adn2>/i);
  let fuente = bloque ? bloque[1] : "";
  if (!fuente.trim()) {
    const bloque1 = texto.match(/<adn>([\s\S]*?)<\/adn>/i);
    fuente = bloque1 ? bloque1[1] : "";
  }
  if (!fuente.trim()) return null;
  const listaDe = (nombres) => {
    const re = new RegExp(`^\\s*(?:${nombres})\\s*:\\s*(.+)$`, "gim");
    const items = [];
    let m;
    while ((m = re.exec(fuente)) !== null) {
      for (const trozo of m[1].split(/[,;/]\s*/)) {
        const t = trozo.replace(/\s+/g, " ").trim().slice(0, 90);
        if (t.length >= 3) items.push(t);
      }
    }
    return items;
  };
  const identidad = (fuente.match(/^\s*identidad\s*:\s*(.+)$/im)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const sensacion = [];
  let cuerpoSens = "";
  let enSens = false;
  for (const linea of fuente.split("\n")) {
    if (/^\s*sensaci[óo]n\s*:/i.test(linea)) {
      enSens = true;
      cuerpoSens += `${linea.replace(/^\s*sensaci[óo]n\s*:\s*/i, "")}
`;
      continue;
    }
    if (enSens) {
      if (!linea.trim() || /^\s*[a-záéíóúñü][a-záéíóúñü -]{2,20}\s*:\s/.test(linea)) {
        enSens = false;
        continue;
      }
      cuerpoSens += `${linea}
`;
    }
  }
  const reEje = /([a-záéíóúñü]{3,20})\s*[:=]?\s*(\d{1,2})(?:\s*\/\s*10)?/gi;
  let e;
  while ((e = reEje.exec(cuerpoSens)) !== null) {
    const eje = e[1].trim().toLowerCase();
    if (eje.length < 3) continue;
    sensacion.push({ eje, valor: Math.max(0, Math.min(10, Number(e[2]))) });
  }
  const crudo = {
    ...adn2Vacio(),
    identidad,
    personalidad: listaDe("personalidad|rasgos"),
    sensacion,
    composicion: listaDe("composici[\xF3o]n|composicion"),
    tipografia: listaDe("tipograf[i\xED]a|tipografia"),
    color: listaDe("colores?"),
    espaciado: listaDe("espaciado|espacio"),
    movimiento: listaDe("movimiento|motion"),
    representacion: listaDe("representaci[\xF3o]n|representacion"),
    interaccion: listaDe("interacci[\xF3o]n|interaccion"),
    lenguaje: listaDe("lenguaje( visual)?"),
    prohibiciones: listaDe("prohibiciones|prohibici[\xF3o]n|no hacer|evitar"),
    referencias: listaDe("referencias"),
    antiPatrones: listaDe("anti-?patrones"),
    accesibilidad: listaDe("accesibilidad|a11y")
  };
  if (adn2EstaVacio(crudo)) return null;
  return sanearAdn2(crudo);
}
function textoAdn2(adn) {
  const lista = (xs) => xs.length ? xs.map((x) => `- ${x}`).join("\n") : "-";
  const sens = adn.sensacion.length ? adn.sensacion.map((e) => `${e.eje} **${e.valor}/10**`).join(" \xB7 ") : "\u2014";
  return [
    `**Identidad:** ${adn.identidad || "\u2014"}`,
    `**Personalidad:** ${adn.personalidad.join(", ") || "\u2014"}`,
    `**Sensaci\xF3n:** ${sens}`,
    `**Composici\xF3n:**
${lista(adn.composicion)}`,
    `**Tipograf\xEDa:**
${lista(adn.tipografia)}`,
    `**Color:**
${lista(adn.color)}`,
    `**Espaciado:**
${lista(adn.espaciado)}`,
    `**Movimiento:**
${lista(adn.movimiento)}`,
    `**Representaci\xF3n:** ${adn.representacion.join(" \xB7 ") || "\u2014"}`,
    `**Interacci\xF3n:**
${lista(adn.interaccion)}`,
    `**Prohibiciones:**
${lista(adn.prohibiciones)}`,
    adn.antiPatrones.length ? `**Anti-patrones:**
${lista(adn.antiPatrones)}` : "",
    adn.accesibilidad.length ? `**Accesibilidad:**
${lista(adn.accesibilidad)}` : ""
  ].filter(Boolean).join("\n");
}
function seccionAdn2(adn) {
  const sens = adn.sensacion.map((e) => `${e.eje} ${e.valor}/10`).join(", ");
  const linea = (etiqueta, xs) => xs.length ? `${etiqueta}: ${xs.join("; ")}` : "";
  return [
    `# ADN visual 2.0 del proyecto (OBLIGATORIO, aplica a cada decisi\xF3n)`,
    `Identidad: ${adn.identidad || "un producto con decisiones propias, nunca una plantilla"}`,
    `Personalidad: ${adn.personalidad.join(", ") || "\u2014"}`,
    `Sensaci\xF3n objetivo: ${sens || "\u2014"}`,
    linea("Composici\xF3n", adn.composicion),
    linea("Tipograf\xEDa", adn.tipografia),
    linea("Color", adn.color),
    linea("Espaciado", adn.espaciado),
    linea("Movimiento", adn.movimiento),
    linea("Representaci\xF3n de la informaci\xF3n", adn.representacion),
    linea("Interacci\xF3n", adn.interaccion),
    `PROHIBIDO en este proyecto: ${[...adn.prohibiciones, ...adn.antiPatrones].join("; ") || "\u2014"}`,
    linea("Accesibilidad m\xEDnima", adn.accesibilidad),
    `El resultado debe ser reconocible como ESTE proyecto, nunca como una plantilla; Revisor, jueces y Arena auditan contra este ADN.`
  ].filter(Boolean).join("\n");
}
function promptBloqueAdn2(mensaje) {
  return [
    `## Define el ADN visual 2.0 ANTES de proponer direcciones`,
    `Para el proyecto: \xAB${mensaje.slice(0, 200)}\xBB`,
    `Responde EXACTAMENTE con este bloque (tildes opcionales, orden libre):`,
    ``,
    `<adn2>`,
    `Identidad: (la identidad del proyecto en UNA frase)`,
    `Personalidad: (2-6 rasgos con nombre)`,
    `Sensaci\xF3n: (ejes con nota 0..10, ej. confianza 8, innovaci\xF3n 9)`,
    `Composici\xF3n: (2-4 decisiones de ret\xEDcula, foco y densidad)`,
    `Tipograf\xEDa: (pareja, escala y ritmo)`,
    `Color: (dominante + acento con intenci\xF3n; nada de azul por defecto)`,
    `Espaciado: (escala y aire)`,
    `Movimiento: (qu\xE9 anima, cu\xE1ndo, cu\xE1nto)`,
    `Representaci\xF3n: (c\xF3mo se representa la informaci\xF3n de ESTE negocio)`,
    `Interacci\xF3n: (estados, foco, feedback)`,
    `Prohibiciones: (lo que NO encaja aqu\xED)`,
    `Referencias: (inspiraci\xF3n abstracta, nunca copiar)`,
    `Anti-patrones: (patrones del sector que aqu\xED quedan baratos)`,
    `Accesibilidad: (m\xEDnimos del proyecto)`,
    `</adn2>`
  ].join("\n");
}
var MAX_PROHIBICIONES_PROMPT = MAX_PROHIBICIONES_ADN + 4;

// src/lib/prism/forja/exportadores-adn.ts
function primerHex(xs) {
  for (const x of xs) {
    const m = x.match(/#[0-9a-f]{6}\b/i);
    if (m) return m[0].toLowerCase();
  }
  return null;
}
function primeraFuente(xs) {
  for (const x of xs) {
    const m = x.match(/"([A-Za-zÀ-ÿ0-9 _-]{2,32})"/);
    if (m) return m[1];
  }
  return null;
}
function designMdDesdeAdn2(adn, meta) {
  const a = sanearAdn2(adn);
  const lista = (xs) => xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (sin decisiones a\xFAn)";
  const sens = a.sensacion.length ? a.sensacion.map((e) => `| ${e.eje} | ${e.valor}/10 |`).join("\n") : "| \u2014 | \u2014 |";
  return [
    `# DESIGN.md \u2014 ${meta.nombreProyecto || "Proyecto FORJA"}`,
    meta.fecha ? `Generado por FORJA IA el ${meta.fecha}.` : "Generado por FORJA IA.",
    ``,
    `## Identidad`,
    a.identidad || "(sin definir)",
    ``,
    `## Personalidad`,
    lista(a.personalidad),
    ``,
    `## Sensaci\xF3n objetivo`,
    `| eje | valor |`,
    `| --- | ----- |`,
    sens,
    ``,
    `## Composici\xF3n`,
    lista(a.composicion),
    ``,
    `## Tipograf\xEDa`,
    lista(a.tipografia),
    ``,
    `## Color`,
    lista(a.color),
    ``,
    `## Espaciado`,
    lista(a.espaciado),
    ``,
    `## Movimiento`,
    lista(a.movimiento),
    ``,
    `## Representaci\xF3n de la informaci\xF3n`,
    lista(a.representacion),
    ``,
    `## Interacci\xF3n`,
    lista(a.interaccion),
    ``,
    `## Prohibiciones (reglas duras)`,
    lista([...a.prohibiciones, ...a.antiPatrones]),
    ``,
    `## Referencias (inspiraci\xF3n abstracta, NUNCA copiar)`,
    lista(a.referencias),
    ``,
    `## Accesibilidad m\xEDnima`,
    lista(a.accesibilidad)
  ].join("\n");
}
function tokensCssDesdeAdn2(adn, nombreProyecto = "prisma") {
  const a = sanearAdn2(adn);
  const dominante = primerHex(a.color) ?? "#14181f";
  const acento = primerHex([...a.color].reverse()) ?? dominante;
  const fontDisplay = primeraFuente(a.tipografia) ?? "Georgia";
  const fontTexto = primeraFuente([...a.tipografia].reverse()) ?? "system-ui";
  const sensible = /\b(sobrio|fiable|calma|sereno)\b/i.test(a.personalidad.join(" "));
  const radio = sensible ? "4px" : "10px";
  const vars = [
    `  --color-dominante: ${dominante};`,
    `  --color-acento: ${acento};`,
    `  --font-display: "${fontDisplay}", serif;`,
    `  --font-texto: "${fontTexto}", sans-serif;`,
    `  --escala-modular: 1.25;`,
    `  --radio: ${radio};`
  ];
  for (const px of [4, 8, 12, 16, 24, 32, 48, 64, 96]) {
    vars.push(`  --espacio-${px}: ${px}px;`);
  }
  vars.push(`  --dur-rapida: 150ms;`, `  --dur-base: 250ms;`, `  --ease-salida: cubic-bezier(0.2, 0.7, 0.3, 1);`);
  vars.push(`  --contraste-min: 4.5;`);
  return [
    `/* tokens.css \u2014 sistema de ${nombreProyecto}`,
    ` * Derivado autom\xE1ticamente del ADN Visual 2.0 por FORJA IA.`,
    ` * Fuente de verdad: DESIGN.md. No editar a mano: regenerar. */`,
    `:root {`,
    ...vars,
    `}`
  ].join("\n");
}
function reglasCritiqueDesdeAdn2(adn) {
  const a = sanearAdn2(adn);
  const reglas = [];
  if (a.identidad) reglas.push(`\xBFLa p\xE1gina es reconocible como \xAB${a.identidad}\xBB?`);
  for (const p of a.prohibiciones) reglas.push(`PROHIBIDO y verificado: ${p} \u2014 \xBFaparece?`);
  for (const p of a.antiPatrones) reglas.push(`Anti-patr\xF3n del sector: ${p} \u2014 \xBFaparece?`);
  for (const c of a.composicion) reglas.push(`\xBFSe cumple la decisi\xF3n de composici\xF3n \xAB${c}\xBB?`);
  if (a.tipografia.length) reglas.push(`\xBFLa escala tipogr\xE1fica respeta \xAB${a.tipografia[0]}\xBB?`);
  if (a.color.length) reglas.push(`\xBFEl uso del color respeta \xAB${a.color[0]}\xBB?`);
  for (const acc of a.accesibilidad) reglas.push(`Accesibilidad: ${acc}`);
  for (const mv of a.movimiento) reglas.push(`Movimiento: ${mv}`);
  return reglas.slice(0, 16);
}
function restriccionesCodificadorDesdeAdn2(adn) {
  const a = sanearAdn2(adn);
  const out = [];
  for (const p of a.prohibiciones) out.push(`NO hacer: ${p}`);
  for (const p of a.antiPatrones) out.push(`NO usar el patr\xF3n: ${p}`);
  if (a.color.length) out.push(`Color: usar exclusivamente el sistema descrito (${primerHex(a.color) ?? "ver DESIGN.md"} como dominante; un solo acento por pantalla).`);
  if (a.tipografia.length) out.push(`Tipograf\xEDa: ${a.tipografia[0]}.`);
  if (a.espaciado.length) out.push(`Espaciado: ${a.espaciado[0]}.`);
  if (a.accesibilidad.length) out.push(`Accesibilidad inamovible: ${a.accesibilidad.join("; ")}.`);
  return out.slice(0, 14);
}
function criteriosArenaDesdeAdn2(adn) {
  const a = sanearAdn2(adn);
  return [
    `Identidad declarada: ${a.identidad || "\u2014"}`,
    `Prohibiciones: ${a.prohibiciones.join("; ") || "\u2014"}`,
    `Composici\xF3n: ${a.composicion[0] ?? "\u2014"}`,
    `Color: ${a.color[0] ?? "\u2014"}`,
    `Tipograf\xEDa: ${a.tipografia[0] ?? "\u2014"}`,
    `Representaci\xF3n: ${a.representacion.join(" \xB7 ") || "\u2014"}`
  ];
}
function contextoSkillsDesdeAdn2(adn, maxCaracteres = 700) {
  const a = sanearAdn2(adn);
  const cabezas = [];
  if (a.prohibiciones.length) cabezas.push(`PROHIBIDO: ${a.prohibiciones.join("; ")}`);
  if (a.identidad) cabezas.push(`Identidad: ${a.identidad}`);
  if (a.personalidad.length) cabezas.push(`Rasgos: ${a.personalidad.join(", ")}`);
  if (a.composicion.length) cabezas.push(`Composici\xF3n: ${a.composicion[0]}`);
  if (a.tipografia.length) cabezas.push(`Tipo: ${a.tipografia[0]}`);
  if (a.color.length) cabezas.push(`Color: ${a.color[0]}`);
  let texto = cabezas.join(" \xB7 ");
  if (texto.length > maxCaracteres) {
    texto = texto.slice(0, maxCaracteres);
  }
  return texto;
}

// src/lib/prism/forja/bridge-design-system.ts
function hexesDe(xs) {
  const out = [];
  const vistos = /* @__PURE__ */ new Set();
  for (const x of xs) {
    for (const m of x.matchAll(/#[0-9a-f]{6}\b/gi)) {
      const h = m[0].toLowerCase();
      if (!vistos.has(h)) {
        vistos.add(h);
        out.push(h);
      }
    }
  }
  return out;
}
function crearDesignSystem(adn, nombreProyecto = "prisma") {
  const a = sanearAdn2(adn);
  const colores = hexesDe([...a.color, ...a.composicion]);
  const fuentes = [];
  const vistos = /* @__PURE__ */ new Set();
  for (const t of a.tipografia) {
    for (const m of t.matchAll(/"([A-Za-zÀ-ÿ0-9 _-]{2,32})"/g)) {
      const f = m[1].trim();
      const clave2 = f.toLowerCase();
      if (!vistos.has(clave2)) {
        vistos.add(clave2);
        fuentes.push(f);
      }
    }
  }
  return {
    nombre: nombreProyecto,
    designMd: "",
    // se rellena abajo (evita dependencia circular en la inicialización)
    tokensCss: "",
    colores,
    fuentes,
    espaciado: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    accesibilidad: [...a.accesibilidad],
    motion: [...a.movimiento],
    identidad: a.identidad
  };
}
function designSystemCompleto(adn, nombreProyecto = "prisma", fecha = "") {
  const ds = crearDesignSystem(adn, nombreProyecto);
  ds.tokensCss = tokensCssDesdeAdn2(adn, nombreProyecto);
  ds.designMd = designMdDesdeAdn2(adn, { nombreProyecto, fecha: fecha || void 0 });
  return ds;
}
function colorHexEn(texto) {
  return [...texto.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
}
function auditarContraDesignSystem(html, ds) {
  const out = [];
  if (!html) return out;
  if (ds.colores.length) {
    const usados = [...new Set(colorHexEn(html))];
    const permitidos = /* @__PURE__ */ new Set([...ds.colores, "#ffffff", "#000000", "#14181f"]);
    const fuera = usados.filter((c) => !permitidos.has(c));
    if (fuera.length) {
      out.push({
        severidad: "aviso",
        categoria: "visual",
        titulo: `${fuera.length} color(es) fuera del design system`,
        detalle: `Usados: ${fuera.slice(0, 6).join(", ")}. Declarados: ${ds.colores.join(", ")}.`,
        causaProbable: "el Codificador improvis\xF3 tonos en vez de usar los tokens",
        correccion: `sustituir por los tokens declarados (var(--color-dominante) / var(--color-acento))`,
        reglaSistema: "color: solo los colores del sistema"
      });
    }
  }
  if (ds.fuentes.length) {
    const familiaUsada = html.match(/font-family\s*:\s*([^;}]+)/i)?.[1] ?? "";
    if (familiaUsada) {
      const citaAlguna = ds.fuentes.some((f) => familiaUsada.toLowerCase().includes(f.toLowerCase()));
      if (!citaAlguna) {
        out.push({
          severidad: "aviso",
          categoria: "estandares",
          titulo: "Tipograf\xEDa fuera del sistema",
          detalle: `font-family \xAB${familiaUsada.trim().slice(0, 60)}\xBB no declara ninguna fuente del sistema (${ds.fuentes.join(", ")}).`,
          causaProbable: "fallback por defecto del generador",
          correccion: `usar var(--font-display) / var(--font-texto) del sistema`,
          reglaSistema: "tipograf\xEDa: solo las familias declaradas"
        });
      }
    }
  }
  if (/#3b82f6|#2563eb|#1d4ed8|rgb\(\s*59\s*,\s*130\s*,\s*246/i.test(html)) {
    out.push({
      severidad: "critico",
      categoria: "visual",
      titulo: "Azul por defecto de Tailwind en la entrega",
      detalle: "El sistema proh\xEDbe el azul por defecto como identidad (ADN 2.0 / anti-patrones).",
      causaProbable: "plantilla base del modelo",
      correccion: "sustituir por el acento del sistema",
      reglaSistema: "color: prohibido el azul por defecto"
    });
  }
  const valoresRaros = [...html.matchAll(/(?:padding|margin)[^:;{}]*:\s*[^;{}]*?\b(\d{1,3})px/gi)].map((m) => Number(m[1])).filter((n) => n > 0 && n % 4 !== 0);
  if (valoresRaros.length >= 3) {
    out.push({
      severidad: "mejora",
      categoria: "estandares",
      titulo: `Espaciado fuera de la escala 4px (${valoresRaros.slice(0, 4).join("px, ")}px\u2026)`,
      detalle: "El sistema declara escala de espaciado en m\xFAltiplos de 4.",
      causaProbable: "valores ajustados a ojo",
      correccion: "redondear a la escala (--espacio-*)",
      reglaSistema: "espaciado: m\xFAltiplos de 4"
    });
  }
  if (!/<html[^>]*\slang=/i.test(html)) {
    out.push({
      severidad: "aviso",
      categoria: "accesibilidad",
      titulo: "Sin lang en <html>",
      detalle: "La accesibilidad m\xEDnima del sistema exige idioma declarado.",
      causaProbable: "plantilla base",
      correccion: 'a\xF1adir lang="es" (o el idioma del proyecto)',
      reglaSistema: "accesibilidad: m\xEDnimos del ADN"
    });
  }
  if (ds.motion.some((m) => /reduced-motion/i.test(m)) && /@keyframes|transition\s*:/i.test(html)) {
    if (!/prefers-reduced-motion/i.test(html)) {
      out.push({
        severidad: "aviso",
        categoria: "accesibilidad",
        titulo: "Animaciones sin prefers-reduced-motion",
        detalle: "El sistema de motion exige respetar prefers-reduced-motion.",
        causaProbable: "se anim\xF3 sin la guarda",
        correccion: "a\xF1adir @media (prefers-reduced-motion: reduce) { \u2026 animation: none }",
        reglaSistema: "motion: respetar reduced-motion"
      });
    }
  }
  return out.slice(0, 10);
}
function resumenDesignSystem(ds) {
  return [
    `Design system \xAB${ds.nombre}\xBB`,
    `Identidad: ${ds.identidad || "\u2014"}`,
    `Colores: ${ds.colores.join(", ") || "(derivados de tokens.css)"}`,
    `Fuentes: ${ds.fuentes.join(", ") || "(seg\xFAn ADN)"}`,
    `Escala de espaciado: ${ds.espaciado.join("/")}`,
    `Accesibilidad: ${ds.accesibilidad.join("; ") || "AA est\xE1ndar"}`
  ].join("\n");
}

// src/lib/prism/forja/adapter-opendesign.ts
function peticionARequest(p, adn2, direccion, ds, projectId = "prisma") {
  const secciones = [
    `# Brief`,
    p.mensaje.slice(0, 1200),
    p.codigoActual ? `
# C\xF3digo actual del proyecto
(presente: ${p.codigoActual.length} caracteres; es una edici\xF3n)` : "",
    p.reglasAprendidas?.length ? `
# Reglas aprendidas del usuario
- ${p.reglasAprendidas.slice(0, 8).join("\n- ")}` : "",
    p.conocimientoGlobal?.length ? `
# Conocimiento destilado
- ${p.conocimientoGlobal.slice(0, 6).join("\n- ")}` : "",
    `
${seccionAdn2(adn2)}`,
    direccion ? `
# Direcci\xF3n creativa elegida
${direccion.nombre} \u2014 ${direccion.concepto}` : ""
  ].filter(Boolean);
  const userCodificador = [
    `Construye la p\xE1gina completa (HTML autocontenido) para este brief.`,
    ...peticionARequest_restricciones(ds),
    `Entrega: un solo archivo HTML con CSS embebido. Sin redes externas obligatorias.`
  ].join("\n");
  return {
    requestId: idV4("req"),
    projectId,
    brief: secciones.join("\n").slice(0, 6e3),
    direccion: direccion ? `${direccion.nombre} \u2014 ${direccion.concepto}` : "(sin direcci\xF3n previa)",
    designSystem: ds,
    skills: [],
    prompts: [
      { rol: "codificador", system: "Eres el Codificador de FORJA IA. Cumples el ADN y el design system al pie de la letra.", user: userCodificador },
      { rol: "revisor", system: "Eres el Revisor de FORJA IA. Auditas contra el ADN, el inspector y el informe anti-gen\xE9rico.", user: `Audita la entrega contra:
${resumenDesignSystem(ds)}` }
    ],
    limites: { maxIteraciones: 3, maxCaracteres: 12e4 }
  };
}
function peticionARequest_restricciones(ds) {
  const out = [`Design system \xAB${ds.nombre}\xBB: ${resumenDesignSystem(ds).replace(/\n/g, " \xB7 ")}`];
  if (ds.colores.length) out.push(`Usa SOLO estos colores (m\xE1s blanco/negro): ${ds.colores.join(", ")}.`);
  return out;
}
function artifactAEvaluacion(artifact, ds) {
  const inspector = artifact.ok ? chequeosEstaticos(artifact.html) : [];
  const sistema = artifact.ok ? auditarContraDesignSystem(artifact.html, ds) : [];
  const genericidad = artifact.ok ? detectarGenericidad(artifact.html) : {
    sintomas: [],
    nivel: "bajo",
    motivo: "",
    puntuacionIdentidad: 100,
    recordatorio: []
  };
  const criticos = inspector.filter((h) => h.severidad === "critico").length;
  const sistemaCriticos = sistema.filter((h) => h.severidad === "critico").length;
  const veredicto = !artifact.ok || criticos > 0 || sistemaCriticos > 0 ? "FAIL" : genericidad.nivel === "alto" || inspector.filter((h) => h.severidad === "aviso").length >= 3 || sistema.length >= 3 ? "WARN" : "PASS";
  const resumen = veredicto === "PASS" ? `Entrega limpia: ${inspector.length} hallazgo(s) menor(es), identidad ${genericidad.puntuacionIdentidad}/100.` : veredicto === "WARN" ? `Entrega con reparos: ${inspector.length} hallazgo(s) del inspector, ${sistema.length} de sistema, genericidad ${genericidad.nivel}.` : `Entrega rechazada: ${criticos + sistemaCriticos} hallazgo(s) cr\xEDtico(s).`;
  return { inspector, sistema, genericidad, veredicto, resumen };
}
var RuntimeLocal = class {
  constructor() {
    this.nombre = "runtime-local";
    this.tipo = "local";
  }
  async ejecutar(req) {
    const t0 = trazas();
    const ds = req.designSystem;
    const titulo = primeraLinea(req.brief).slice(0, 60) || "Proyecto FORJA";
    const html = [
      `<!doctype html>`,
      `<html lang="es">`,
      `<head>`,
      `<meta charset="utf-8">`,
      `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      `<title>${escapar(titulo)}</title>`,
      `<style>`,
      ds.tokensCss.replace(":root", ":root").slice(0, 4e3),
      `*{box-sizing:border-box;margin:0}`,
      `body{font-family:var(--font-texto);color:var(--color-dominante);background:#fff;line-height:1.6}`,
      `.envoltura{max-width:72rem;margin:0 auto;padding:var(--espacio-64) var(--espacio-24)}`,
      `h1,h2{font-family:var(--font-display);line-height:1.15}`,
      `h1{font-size:calc(2rem * var(--escala-modular))}`,
      `.accion{background:var(--color-acento);color:#fff;border:0;padding:var(--espacio-12) var(--espacio-24);border-radius:var(--radio);font-weight:600}`,
      `.accion:focus-visible{outline:3px solid var(--color-acento);outline-offset:2px}`,
      `.seccion{padding:var(--espacio-96) 0;border-top:1px solid #eee}`,
      `@media (prefers-reduced-motion: reduce){*{animation:none;transition:none}}`,
      `</style>`,
      `</head>`,
      `<body>`,
      `<main class="envoltura">`,
      `<header><h1>${escapar(titulo)}</h1><p>${escapar(req.direccion).slice(0, 160)}</p>`,
      `<button class="accion" type="button">Empezar</button></header>`,
      `<section class="seccion" aria-labelledby="t-sys"><h2 id="t-sys">Sistema</h2>`,
      `<p>Design system \xAB${escapar(ds.nombre)}\xBB \u2014 identidad: ${escapar(ds.identidad || "definida en DESIGN.md")}</p></section>`,
      `</main>`,
      `</body>`,
      `</html>`
    ].join("\n");
    return {
      requestId: req.requestId,
      html,
      tokensCss: ds.tokensCss,
      designMd: ds.designMd,
      productor: this.nombre,
      trazas: [`html compuesto localmente en ${trazas() - t0}ms`, `tokens: ${ds.colores.length} colores`],
      ok: true,
      error: ""
    };
  }
};
async function ejecutarEnRuntime(runtime, req) {
  try {
    return await runtime.ejecutar(req);
  } catch (e) {
    return {
      requestId: req.requestId,
      html: "",
      tokensCss: req.designSystem.tokensCss,
      designMd: req.designSystem.designMd,
      productor: runtime.nombre,
      trazas: ["el runtime lanz\xF3 un error"],
      ok: false,
      error: e instanceof Error ? e.message : String(e).slice(0, 200)
    };
  }
}
function trazas() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? Math.round(performance.now()) : Date.now() % 1e6;
}
function primeraLinea(brief) {
  const l = brief.split("\n").find((x) => x.trim().length > 8 && !x.startsWith("#") && !x.startsWith("\xB7"));
  return (l ?? "").replace(/[#*]/g, "").trim();
}
function escapar(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// src/lib/prism/forja/director2.ts
function arquetipoDeFamilia(f) {
  const mapa = {
    spatial: "espacial",
    immersive: "espacial",
    product: "modular",
    cinematic: "cinematica",
    interactive: "conversacional",
    "3d-showcase": "espacial",
    modular: "modular",
    editorial: "editorial",
    minimal: "modular",
    dashboard: "cartografica"
  };
  return mapa[f] ?? "modular";
}
function tresFamilias(mensaje) {
  const sel = seleccionarFamilia(mensaje);
  const out = [sel.familia];
  const usadas = /* @__PURE__ */ new Set([sel.familia]);
  const arqUsados = /* @__PURE__ */ new Set([arquetipoDeFamilia(sel.familia)]);
  const pideEditorial = /\b(blog|revista|magazine|art[ií]culo|noticias?|publicaci[óo]n|editorial)\b/i.test(mensaje);
  const candidatas = [sel.alternativa, ...FAMILIAS.map((f) => f.id)];
  for (const f of candidatas) {
    if (out.length >= 3) break;
    if (usadas.has(f)) continue;
    if (f === "editorial" && !pideEditorial) continue;
    const a = arquetipoDeFamilia(f);
    if (arqUsados.has(a)) continue;
    out.push(f);
    usadas.add(f);
    arqUsados.add(a);
  }
  while (out.length < 3) out.push("dashboard");
  return out.slice(0, 3);
}
var ARQUETIPOS = [
  {
    id: "editorial",
    nombre: "Editorial",
    representacionTipica: "texto protagonista con jerarqu\xEDa de revista",
    estructuraTipica: ["portada de titular", "sumario navegado", "art\xEDculos asim\xE9tricos", "cierre con firma"],
    narrativaTipica: "leer con orden, como una publicaci\xF3n",
    interaccionTipica: "lectura continua con anclas y progreso",
    composicionTipica: "ret\xEDcula editorial asim\xE9trica, mucho aire, foco en el titular"
  },
  {
    id: "espacial",
    nombre: "Espacial",
    representacionTipica: "mapa o plano navegable",
    estructuraTipica: ["vista general", "zonas navegables", "detalle al entrar", "retorno claro"],
    narrativaTipica: "explorar un lugar, no deslizar una lista",
    interaccionTipica: "navegaci\xF3n espacial con zoom/paneo o scroll por zonas",
    composicionTipica: "composici\xF3n por capas con foco m\xF3vil"
  },
  {
    id: "cinematica",
    nombre: "Cinematogr\xE1fica",
    representacionTipica: "secuencia de planos con ritmo",
    estructuraTipica: ["plano de impacto", "desarrollo en actos", "detalle \xEDntimo", "cierre con acci\xF3n"],
    narrativaTipica: "paso de p\xE1gina = cambio de plano",
    interaccionTipica: "scroll orquestado con entradas y salidas",
    composicionTipica: "planos de pantalla completa con respiros"
  },
  {
    id: "cartografica",
    nombre: "Cartogr\xE1fica",
    representacionTipica: "l\xEDnea de tiempo o recorrido",
    estructuraTipica: ["origen", "hito a hito", "presente", "pr\xF3ximo paso"],
    narrativaTipica: "progreso visible hacia un objetivo",
    interaccionTipica: "avance marcado con estado y retroceso seguro",
    composicionTipica: "eje dominante con hitos fuertes"
  },
  {
    id: "conversacional",
    nombre: "Conversacional",
    representacionTipica: "di\xE1logo guiado por preguntas",
    estructuraTipica: ["pregunta inicial", "respuestas ramificadas", "resumen vivo", "acci\xF3n"],
    narrativaTipica: "el contenido responde al usuario",
    interaccionTipica: "elecci\xF3n, feedback inmediato, ajuste",
    composicionTipica: "un foco \xFAnico, sin distracciones laterales"
  },
  {
    id: "modular",
    nombre: "Modular",
    representacionTipica: "m\xF3dulos asim\xE9tricos de distinto peso",
    estructuraTipica: ["m\xF3dulo dominante", "m\xF3dulos de apoyo desiguales", "m\xF3dulo de datos", "m\xF3dulo de acci\xF3n"],
    narrativaTipica: "el peso de cada m\xF3dulo ES la jerarqu\xEDa",
    interaccionTipica: "m\xF3dulos expandibles con contenido real",
    composicionTipica: "ret\xEDcula rota con intencionalidad, densidad variable"
  }
];
function arquetipoPorId(id) {
  return ARQUETIPOS.find((a) => a.id === id);
}
function visionesDeRespaldo(mensaje) {
  const m = (mensaje || "").toLowerCase();
  const Datos = /\b(dato|estad|m[eé]tric|analitic|report|financ)/.test(m);
  const familias = Datos ? ["dashboard", "modular", "spatial"] : tresFamilias(m);
  return familias.map((id, i) => {
    const arq = arquetipoDeFamilia(id);
    const a = arquetipoPorId(arq);
    const def = FAMILIAS.find((f) => f.id === id);
    return {
      letra: ["A", "B", "C"][i],
      nombre: `${def?.nombre ?? a.nombre} ${Datos ? "de datos" : "prisma"}`,
      arquetipo: a.id,
      representacion: def ? def.descripcion : a.representacionTipica,
      estructura: a.estructuraTipica,
      narrativa: a.narrativaTipica,
      interaccion: a.interaccionTipica,
      composicion: a.composicionTipica,
      paleta: "seg\xFAn ADN 2.0 (dominante + un acento)",
      tipografia: "seg\xFAn ADN 2.0 (display + texto)",
      porQue: `La familia \xAB${def?.nombre ?? id}\xBB encaja porque ${def ? `produce una experiencia donde ${def.paraQue}` : `su ${a.representacionTipica} ordena la informaci\xF3n`} sin recurrir a tarjetas gen\xE9ricas.`,
      quePrioriza: "lo esencial primero; el resto se gana su sitio",
      riesgo: def?.riesgo ?? (a.id === "cinematica" ? "el ritmo puede sacrificar densidad de contenido" : "el orden no convencional exige una navegaci\xF3n impecable"),
      usuarioBeneficiado: "quien decide r\xE1pido y necesita entender sin leer todo"
    };
  });
}
function promptDirector2(mensaje, adn2, familiasForzadas) {
  const sel = seleccionarFamilia(mensaje);
  const antRep = seccionAntiRepeticion(
    (() => {
      const h = obtenerHistorial();
      return {
        puntos: h.length,
        repeticiones: [],
        consejo: h.length ? "no repitas el hero de las \xFAltimas generaciones" : ""
      };
    })()
  );
  const bloqueFamilias = familiasForzadas && familiasForzadas.length ? [
    `## FAMILIAS ASIGNADAS POR LA ARENA (v4.6, diferencia ESTRUCTURAL)`,
    ...familiasForzadas.map((f, i) => `- VISI\xD3N ${["A", "B", "C"][i]}: sigue la familia \xAB${f}\xBB \u2014 su definici\xF3n abajo en el bloque de familias de experiencia.`),
    `La diferencia entre visiones debe NOTARSE en los primeros 3 segundos: estructuras, profundidad y movimiento distintos, no paletas.`
  ].join("\n") : "";
  return [
    `## Tu papel: DIRECTOR CREATIVO de FORJA IA`,
    `Proyecto: \xAB${mensaje.slice(0, 300)}\xBB`,
    ``,
    bloqueFamilias,
    bloqueFamilias ? `` : ``,
    seccionFamilias(sel),
    ``,
    seccionPatronesPositivos(mensaje, 6),
    ``,
    seccionAdn2(adn2),
    ``,
    antRep,
    ``,
    `## C\xF3mo trabajas (REGLAS)`,
    `1. Las tres visiones son variaciones del MISMO ADN: jam\xE1s tres webs distintas.`,
    `2. Difieren por REPRESENTACI\xD3N, ESTRUCTURA, NARRATIVA, INTERACCI\xD3N y COMPOSICI\xD3N. Dos paletas con la misma estructura = SUSPENDIDO.`,
    `3. ${familiasForzadas && familiasForzadas.length ? `La ARENA ya asign\xF3 una familia a cada visi\xF3n (arriba): cada visi\xF3n ES su familia, con su vocabulario de espacio/movimiento/superficie.` : `La primera visi\xF3n TRABAJA DENTRO de la familia decidida; las otras dos exploran familias vecinas (ver arriba).`}`,
    `4. Cada visi\xF3n explica: qu\xE9 representa, por qu\xE9, qu\xE9 prioriza, qu\xE9 interacci\xF3n propone, qu\xE9 riesgo tiene y qu\xE9 usuario beneficia.`,
    `5. Prohibido proponer: hero centrado, tres tarjetas gemelas, gradientes decorativos, glassmorphism, dashboard de cajitas.`,
    `6. Si el brief pide moderno/premium/futurista/3D/inmersivo/interactivo: EDITORIAL PROHIBIDA salvo intenci\xF3n editorial real (\xA723).`,
    ``,
    `## Formato de salida (EXACTO, tres bloques)`,
    `<vision2 letra="A">`,
    `Nombre: ...`,
    `Arquetipo: editorial|espacial|cinematica|cartografica|conversacional|modular`,
    `Representaci\xF3n: (c\xF3mo se representa la informaci\xF3n de este negocio)`,
    `Estructura: (3-4 secciones separadas por ;)`,
    `Narrativa: (qu\xE9 historia cuenta el scroll)`,
    `Interacci\xF3n: (la propuesta concreta, no \xABhover\xBB)`,
    `Composici\xF3n: (ret\xEDcula, foco, densidad)`,
    `Paleta: (hex + intenci\xF3n)`,
    `Tipograf\xEDa: (pareja + escala)`,
    `Por qu\xE9: (por qu\xE9 sirve para ESTE proyecto)`,
    `Prioriza: (qu\xE9 informaci\xF3n va primero)`,
    `Riesgo: (qu\xE9 puede salir mal)`,
    `Beneficia a: (qu\xE9 usuario)`,
    `</vision2>`,
    `... (letra="B" con otro arquetipo, letra="C" con el tercero)`
  ].join("\n");
}
function promptDirectorFusion2(visiones, notas) {
  const resumen = visiones.map((v) => {
    const nota = notas.find((n) => n.letra === v.letra);
    return `- ${v.letra} \xAB${v.nombre}\xBB (${v.arquetipo}, nota ${nota?.nota ?? "\u2014"}): ${v.representacion}. Riesgo: ${v.riesgo}.`;
  }).join("\n");
  return [
    `## DIRECTOR FINAL: Dise\xF1o Fusi\xF3n`,
    `Visiones y notas del panel:`,
    resumen,
    ``,
    `Elige la BASE (la que mejor cumple el ADN) y construye la fusi\xF3n: toma lo mejor de las dem\xE1s. La fusi\xF3n debe ser UNA p\xE1gina concreta, no un promedio difuso.`,
    ``,
    `<fusion2>`,
    `Base: A|B|C`,
    `Toma de A: (qu\xE9 y por qu\xE9)`,
    `Toma de B: (qu\xE9 y por qu\xE9)`,
    `Toma de C: (qu\xE9 y por qu\xE9)`,
    `Concepto: (la fusi\xF3n en una frase)`,
    `</fusion2>`
  ].join("\n");
}
function letraValida(l) {
  const u = l.trim().toUpperCase();
  return u === "A" || u === "B" || u === "C" ? u : null;
}
function campo(bloque, nombres) {
  const re = new RegExp(`^\\s*${nombres}\\s*:\\s*(.+)$`, "im");
  return (bloque.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim();
}
function parseVisiones2(texto) {
  if (!texto) return [];
  const out = [];
  const re = /<vision2\s+letra\s*=\s*"?([abcABC])"?[^>]*>([\s\S]*?)<\/vision2>/gi;
  let m;
  while ((m = re.exec(texto)) !== null && out.length < 3) {
    const letra = letraValida(m[1]);
    const cuerpo = m[2];
    if (!letra) continue;
    const estructura = listaLimpia(campo(cuerpo, "Estructura").split(";"), 5, 90);
    const arquetipoRaw = campo(cuerpo, "Arquetipo").toLowerCase();
    const arquetipo = arquetipoPorId(arquetipoRaw)?.id ?? ARQUETIPOS[out.length % ARQUETIPOS.length].id;
    out.push({
      letra,
      nombre: campo(cuerpo, "Nombre").slice(0, 48) || `Visi\xF3n ${letra}`,
      arquetipo,
      representacion: campo(cuerpo, "Representaci[\xF3o]n").slice(0, 140),
      estructura: estructura.length ? estructura : ["apertura", "desarrollo", "cierre"],
      narrativa: campo(cuerpo, "Narrativa").slice(0, 160),
      interaccion: campo(cuerpo, "Interacci[\xF3o]n").slice(0, 160),
      composicion: campo(cuerpo, "Composici[\xF3o]n").slice(0, 160),
      paleta: campo(cuerpo, "Paleta").slice(0, 160),
      tipografia: campo(cuerpo, "Tipograf[i\xED]a").slice(0, 120),
      porQue: campo(cuerpo, "Por qu[e\xE9]").slice(0, 220),
      quePrioriza: campo(cuerpo, "Prioriza").slice(0, 160),
      riesgo: campo(cuerpo, "Riesgo").slice(0, 160),
      usuarioBeneficiado: campo(cuerpo, "Beneficia a").slice(0, 140)
    });
  }
  return out;
}
function parseFusion2(texto, mejorNota) {
  const bloque = texto.match(/<fusion2>([\s\S]*?)<\/fusion2>/i)?.[1] ?? "";
  const base = letraValida(campo(bloque, "Base") || mejorNota) ?? mejorNota;
  const tomaDe = [];
  for (const l of ["A", "B", "C"]) {
    const que = campo(bloque, `Toma de ${l}`);
    if (que) tomaDe.push({ de: l, que: que.slice(0, 160) });
  }
  return {
    base,
    tomaDe,
    concepto: campo(bloque, "Concepto").slice(0, 200) || "fusi\xF3n de las visiones mejor valoradas"
  };
}
function explicarVision2(v) {
  return [
    `**${v.letra} \u2014 ${v.nombre}** (arquetipo ${v.arquetipo})`,
    `Representa: ${v.representacion}`,
    `Estructura: ${v.estructura.join(" \u2192 ")}`,
    `Narrativa: ${v.narrativa}`,
    `Interacci\xF3n: ${v.interaccion}`,
    `Composici\xF3n: ${v.composicion}`,
    `Por qu\xE9: ${v.porQue}`,
    `Prioriza: ${v.quePrioriza}`,
    `Riesgo: ${v.riesgo}`,
    `Beneficia a: ${v.usuarioBeneficiado}`
  ].join("\n");
}
function seccionVisionParaMaqueta(v, adn2) {
  return [
    `# Visi\xF3n a maquetar: ${v.nombre} (arquetipo ${v.arquetipo})`,
    `Representaci\xF3n: ${v.representacion}`,
    `Estructura obligatoria: ${v.estructura.join(" \u2192 ")}`,
    `Narrativa: ${v.narrativa}`,
    `Interacci\xF3n: ${v.interaccion}`,
    `Composici\xF3n: ${v.composicion}`,
    seccionAdn2(adn2)
  ].join("\n");
}

// src/lib/prism/forja/jueces2.ts
var JUECES_2 = [
  { id: "visual", nombre: "Juez Visual", mirada: "jerarqu\xEDa, composici\xF3n, tipograf\xEDa y color con intenci\xF3n", core: true },
  { id: "ux", nombre: "Juez UX/Accesibilidad", mirada: "la informaci\xF3n se entiende y se llega a ella", core: true },
  { id: "originalidad", nombre: "Juez de Originalidad", mirada: "\xBFpodr\xEDa cambiarse el logo y venderse como plantilla?", core: true },
  { id: "accesibilidad", nombre: "Juez de Accesibilidad", mirada: "contraste, teclado, alt, labels, foco", core: false },
  { id: "conversion", nombre: "Juez de Conversi\xF3n", mirada: "la acci\xF3n importante est\xE1 clara y sin fricci\xF3n", core: false },
  { id: "responsive", nombre: "Juez de Responsive", mirada: "funciona en distintos tama\xF1os de verdad", core: false },
  { id: "coherencia", nombre: "Juez de Coherencia de Sistema", mirada: "respeta el design system y el ADN declarados", core: false },
  { id: "performance", nombre: "Juez de Performance", mirada: "peso, fuentes, animaciones y coste de render", core: false }
];
function juezPorId(id) {
  return JUECES_2.find((j) => j.id === id);
}
function evidenciaDeterminista(inspector, genericidad, sistema) {
  const criticos = inspector.filter((h) => h.severidad === "critico");
  const avisos = inspector.filter((h) => h.severidad === "aviso");
  const visual = {
    funciona: [
      genericidad.nivel === "bajo" ? "sin s\xEDntomas gruesos de plantilla en la capa determinista" : ""
    ].filter(Boolean),
    falla: [
      ...criticos.map((h) => `${h.titulo}: ${h.detalle}`),
      ...sistema.slice(0, 3).map((h) => `sistema \u2014 ${h.titulo}`)
    ],
    conservar: avisos.length ? ["la base estructural es corregible con avisos, no rehacer desde cero"] : []
  };
  const ux = {
    funciona: criticos.length === 0 ? ["ning\xFAn bloqueo cr\xEDtico de uso detectado"] : [],
    falla: [
      ...inspector.filter((h) => h.categoria === "accesibilidad").map((h) => `${h.titulo}: ${h.detalle}`),
      ...inspector.filter((h) => h.categoria === "movil").map((h) => `${h.titulo}: ${h.detalle}`)
    ],
    conservar: []
  };
  const originalidad = {
    funciona: genericidad.puntuacionIdentidad >= 80 ? [`identidad ${genericidad.puntuacionIdentidad}/100`] : [],
    falla: genericidad.sintomas.map((s) => `${s.nombre} \u2014 ${s.motivo}`),
    conservar: [],
    patronesGenericos: genericidad.sintomas.map((s) => s.nombre),
    diferenciadores: genericidad.nivel === "bajo" ? ["decisiones fuera del cat\xE1logo de plantilla"] : [],
    riesgos: genericidad.recordatorio.slice(0, 4)
  };
  return { visual, ux, originalidad };
}
function promptJuez2(juez, propuesta, evidenciaBase, adn2) {
  const def = juezPorId(juez);
  const esOriginalidad = juez === "originalidad";
  return [
    `## ${def?.nombre ?? juez}`,
    `Tu mirada: ${def?.mirada ?? ""}`,
    `Prohibiciones del ADN que auditas: ${adn2.prohibiciones.join("; ") || "\u2014"}`,
    ``,
    `## Propuesta a evaluar`,
    propuesta.slice(0, 3e3),
    ``,
    `## Evidencia f\xEDsica ya detectada (herramientas deterministas)`,
    evidenciaBase.slice(0, 2e3) || "(sin hallazgos autom\xE1ticos)",
    ``,
    `## Tu trabajo`,
    `Confirma, matiza o refuta la evidencia con criterio y a\xF1ade lo que las herramientas no pueden ver. Responde EXACTAMENTE as\xED:`,
    `<nota-juez juez="${juez}">`,
    `Nota: N/10`,
    `Funciona: (hechos concretos, una por l\xEDnea)`,
    `Falla: (hechos concretos con D\xD3NDE, una por l\xEDnea)`,
    `Conservar: (qu\xE9 vale aunque se descarte)`,
    esOriginalidad ? `Patrones gen\xE9ricos: (cu\xE1les aparecen)` : ``,
    esOriginalidad ? `Diferenciadores: (qu\xE9 la hace distinta)` : ``,
    esOriginalidad ? `Riesgos: (hacia qu\xE9 plantilla deriva)` : ``,
    `</nota-juez>`
  ].filter(Boolean).join("\n");
}
function parseNotaJuez2(texto, juez, vision) {
  const bloque = texto.match(/<nota-juez[^>]*>([\s\S]*?)<\/nota-juez>/i)?.[1] ?? texto;
  const notaRaw = Number(bloque.match(/Nota\s*:\s*(\d{1,2})/i)?.[1] ?? NaN);
  const listaDe = (nombre) => {
    const m = bloque.match(new RegExp(`^\\s*${nombre}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*[A-Z\xC1\xC9\xCD\xD3\xDA][a-z\xE1\xE9\xED\xF3\xFA-]+\\s*:|$)`, "im"));
    if (!m) return [];
    return m[1].split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter((l) => l.length >= 3).slice(0, 5);
  };
  const evidencia2 = {
    funciona: listaDe("Funciona"),
    falla: listaDe("Falla"),
    conservar: listaDe("Conservar")
  };
  if (juez === "originalidad") {
    evidencia2.patronesGenericos = listaDe("Patrones gen[\xE9e]ricos");
    evidencia2.diferenciadores = listaDe("Diferenciadores");
    evidencia2.riesgos = listaDe("Riesgos");
  }
  const nota = Math.max(0, Math.min(10, Math.round(Number.isNaN(notaRaw) ? 5 : notaRaw)));
  const tieneModelo = /<nota-juez/i.test(texto);
  return { juez, vision, nota, evidencia: evidencia2, base: tieneModelo ? "modelo" : "determinista" };
}
function tablaNotas(notas, _letras) {
  const lineas = [];
  for (const n of notas) {
    const mejor = Math.max(...notas.filter((x) => x.juez === n.juez).map((x) => x.nota));
    const marca = n.nota === mejor ? " \u25C0" : "";
    lineas.push(`${n.juez} \xB7 ${n.vision}: ${n.nota}/10${marca}`);
  }
  return lineas.join("\n");
}
function mediasPorVision(notas, letras) {
  const medias = { A: 0, B: 0, C: 0 };
  for (const l of letras) {
    const deL = notas.filter((n) => n.vision === l);
    medias[l] = deL.length ? deL.reduce((s, n) => s + n.nota, 0) / deL.length : 0;
  }
  return medias;
}
function mejorVision(notas, letras) {
  const medias = mediasPorVision(notas, letras);
  const orden = [...letras].sort((a, b) => medias[b] - medias[a]);
  return orden[0] ?? "A";
}

// src/lib/prism/forja/perfiles.ts
var RECETAS_COSTO = {
  FREE: {
    visiones: 1,
    maquetas: 1,
    jueces: 0,
    fusion: false,
    rondas: 2,
    bucleMejora: false,
    benchmark: false,
    llamadasEstimadas: "3-5",
    descripcion: "1 direcci\xF3n, 1 maqueta, revisi\xF3n b\xE1sica. El m\xEDnimo honesto."
  },
  SMART: {
    visiones: 3,
    maquetas: 1,
    jueces: 0,
    fusion: false,
    rondas: 3,
    bucleMejora: true,
    benchmark: false,
    llamadasEstimadas: "6-9",
    descripcion: "3 direcciones con anti-gen\xE9rico activo, 1 maqueta, bucle de mejora."
  },
  ARENA: {
    visiones: 3,
    maquetas: 3,
    jueces: 3,
    fusion: true,
    rondas: 3,
    bucleMejora: true,
    benchmark: true,
    llamadasEstimadas: "12-16",
    descripcion: "3 visiones, 3 maquetas, panel de jueces con evidencia, fusi\xF3n del Director."
  },
  LAB: {
    visiones: 3,
    maquetas: 3,
    jueces: 5,
    fusion: true,
    rondas: 4,
    bucleMejora: true,
    benchmark: true,
    llamadasEstimadas: "18-25",
    descripcion: "Como ARENA + 5 jueces, 4 rondas, benchmark y m\xE9tricas. Para experimentar."
  }
};
var PERFIL_COSTO_DEFECTO = "SMART";
function perfilCostoSeguro(p) {
  return p === "FREE" || p === "SMART" || p === "ARENA" || p === "LAB" ? p : PERFIL_COSTO_DEFECTO;
}
function perfilRecursosDesdeCosto(p) {
  switch (p) {
    case "FREE":
      return "ligero";
    case "LAB":
      return "profundo";
    default:
      return "equilibrado";
  }
}
var PLANES_MVP = {
  FREE: ["adn", "direcciones(1)", "maqueta(1)", "codigo", "revision"],
  SMART: ["adn", "direcciones(3)", "antigenerico", "maqueta(1)", "codigo", "revision", "bucle"],
  ARENA: ["adn", "direcciones(3)", "antigenerico", "maquetas(3)", "jueces(3)", "fusion", "codigo", "revision", "bucle", "metricas"],
  LAB: ["adn", "direcciones(3)", "antigenerico", "maquetas(3)", "jueces(5)", "fusion", "codigo", "revision", "bucle", "metricas", "benchmark"]
};
function planMvp(p) {
  return PLANES_MVP[p];
}

// src/lib/prism/forja/arena-familias.ts
var ROTACION_ARENA = {
  spatial: ["immersive", "3d-showcase", "product"],
  immersive: ["spatial", "cinematic", "3d-showcase"],
  product: ["interactive", "spatial", "cinematic"],
  cinematic: ["immersive", "editorial", "interactive"],
  interactive: ["product", "3d-showcase", "modular"],
  "3d-showcase": ["spatial", "immersive", "interactive"],
  modular: ["product", "editorial", "dashboard"],
  editorial: ["minimal", "modular", "cinematic"],
  minimal: ["editorial", "product", "spatial"],
  dashboard: ["modular", "product", "spatial"]
};
function asignarFamiliasArena(mensaje) {
  const natural = seleccionarFamilia(mensaje).familia;
  const aprendidos = ajustesFamiliaAprendidos(2);
  const m = (mensaje || "").toLowerCase();
  const candidatas = (ROTACION_ARENA[natural] ?? ["spatial", "product", "editorial"]).filter((f) => f !== natural).map((f, i) => {
    const def = FAMILIAS.find((x) => x.id === f);
    let puntos = def?.cuando?.test(m) ? 2 : 0;
    puntos += aprendidos[f] ?? 0;
    return { f, puntos, i };
  }).sort((a, b2) => b2.puntos - a.puntos || a.i - b2.i);
  const b = candidatas[0]?.f ?? (natural === "spatial" ? "product" : "spatial");
  const c = candidatas.find((x) => x.f !== b)?.f ?? (b === "immersive" ? "cinematic" : "immersive");
  return {
    porLetra: { A: natural, B: b, C: c },
    natural,
    motivos: [
      { letra: "A", familia: natural, motivo: `familia natural de la intenci\xF3n (se\xF1ales de la petici\xF3n) \u2014 defiende la heur\xEDstica` },
      { letra: "B", familia: b, motivo: `vecina puntuada${candidatas[0]?.puntos ? " por se\xF1ales/aprendizaje" : " por rotaci\xF3n de vocabulario"}` },
      { letra: "C", familia: c, motivo: `tercera v\xEDa para comparar estructura (diferencia en 3 segundos)` }
    ]
  };
}
function seccionFamiliaAsignada(familia) {
  const def = FAMILIAS.find((f) => f.id === familia);
  return [
    `# FAMILIA ASIGNADA A ESTA MAQUETA (Arena v4.6): \xAB${familia}\xBB`,
    def ? `${def.nombre}: ${def.descripcion}` : "",
    def ? `Para qu\xE9: ${def.paraQue} \xB7 Riesgo a vigilar: ${def.riesgo}` : "",
    `La maqueta debe hablar el VOCABULARIO de la familia (espacio, movimiento, superficie, interacci\xF3n). Una maqueta de otra familia se punt\xFAa como INCOHERENTE aunque sea bonita.`
  ].filter(Boolean).join("\n");
}
var VOCABULARIO = {
  spatial: [
    { senal: "capas con z sem\xE1ntico", re: /\b(capas|z-index|profundidad|translatez|perspectiva)\b/i, peso: 1 },
    { senal: "parallax", re: /\bparallax\b/i, peso: 0.7 },
    { senal: "objeto focal", re: /\b(objeto|focal|escena)\b/i, peso: 0.7 },
    { senal: "profundidad declarada", re: /\b(profundidad|depth)\b/i, peso: 0.6 }
  ],
  immersive: [
    { senal: "escenas completas", re: /\b(escena|plano|pantalla completa|full)\b/i, peso: 1 },
    { senal: "scroll coreografiado", re: /\b(scroll|avanza|recorrido)\b/i, peso: 0.9 },
    { senal: "navegaci\xF3n m\xEDnima", re: /\b(navegaci[oó]n m[ií]nima|minimal nav)\b/i, peso: 0.5 }
  ],
  product: [
    { senal: "UI del producto viva", re: /\b(ui|interfaz|captura|panel|app)\b/i, peso: 1 },
    { senal: "m\xE9tricas flotantes", re: /\b(m[eé]tric|dato|kpi|n[uú]mero)\b/i, peso: 0.7 },
    { senal: "CTA claro", re: /\b(cta|bot[oó]n|accio?n|empezar|probar)\b/i, peso: 0.5 }
  ],
  cinematic: [
    { senal: "secuencia de planos", re: /\b(plano|secuencia|apertura|transici[oó]n)\b/i, peso: 1 },
    { senal: "tipograf\xEDa enorme", re: /\b(tipograf[ií]a (enorme|display|gigante)|t[ií]tulo grande)\b/i, peso: 0.8 },
    { senal: "ritmo del scroll", re: /\b(ritmo|scroll|coreograf)\b/i, peso: 0.7 }
  ],
  interactive: [
    { senal: "interacci\xF3n concreta", re: /\b(tilt|magnetic|magn[eé]tic|hover|arrastr|clic|interactiv)\b/i, peso: 1 },
    { senal: "feedback inmediato", re: /\b(feedback|respuesta|estado)\b/i, peso: 0.7 },
    { senal: "panel manipulable", re: /\b(panel|manipul|controles?)\b/i, peso: 0.6 }
  ],
  "3d-showcase": [
    { senal: "objeto 3D central", re: /\b(3d|objeto|rotar|girar|modelo)\b/i, peso: 1 },
    { senal: "\xF3rbita/c\xE1mara", re: /\b([oó]rbita|c[aá]mara|zoom|acercar)\b/i, peso: 0.8 },
    { senal: "perspectiva", re: /\b(perspectiva|profundidad)\b/i, peso: 0.5 }
  ],
  modular: [
    { senal: "m\xF3dulos de distinto peso", re: /\b(m[oó]dulo|bento|mosaico|asim[eé]tr)\b/i, peso: 1 },
    { senal: "ret\xEDcula rota", re: /\b(ret[ií]cula|grid|romp)\b/i, peso: 0.7 },
    { senal: "destacado jer\xE1rquico", re: /\b(destacad|peso|jerarqu[ií]a)\b/i, peso: 0.5 }
  ],
  editorial: [
    { senal: "jerarqu\xEDa tipogr\xE1fica", re: /\b(jerarqu[ií]a|titular|encabezad|tipograf[ií]a)\b/i, peso: 1 },
    { senal: "columna de lectura", re: /\b(columna|lectura|margen|p[aá]rrafo)\b/i, peso: 0.9 },
    { senal: "ritmo de publicaci\xF3n", re: /\b(art[ií]culo|secci[oó]n|publicaci[oó]n|fecha)\b/i, peso: 0.6 }
  ],
  minimal: [
    { senal: "aire generoso", re: /\b(aire|blanco|espacio|silencio|limpio)\b/i, peso: 1 },
    { senal: "una acci\xF3n", re: /\b(una accio?n|u[nn] solo|claridad)\b/i, peso: 0.8 },
    { senal: "sin decoraci\xF3n", re: /\b(sin decoraci[oó]n|esencial|m[ií]nim)\b/i, peso: 0.6 }
  ],
  dashboard: [
    { senal: "ret\xEDcula t\xE9cnica", re: /\b(ret[ií]cula t[eé]cnica|grid|panel)\b/i, peso: 1 },
    { senal: "datos tabulares", re: /\b(tabular|dato|tabla|valor)\b/i, peso: 0.9 },
    { senal: "densidad utilitaria", re: /\b(densidad|utilitario|funcional)\b/i, peso: 0.5 }
  ]
};
function coherenciaFamilia(texto, familia) {
  const t = (texto || "").slice(0, 12e3);
  const vocab = VOCABULARIO[familia] ?? [];
  const encontradas = [];
  const faltantes = [];
  let pesoTotal = 0;
  let pesoGanado = 0;
  for (const v of vocab) {
    pesoTotal += v.peso;
    if (v.re.test(t)) {
      encontradas.push(v.senal);
      pesoGanado += v.peso;
    } else {
      faltantes.push(v.senal);
    }
  }
  const score = pesoTotal ? pesoGanado / pesoTotal : 0.5;
  const evidencia2 = encontradas.length || faltantes.length ? `habla ${familia} con ${encontradas.length} se\xF1al(es) (${encontradas.slice(0, 3).join(", ") || "\u2014"})${faltantes.length ? ` \xB7 le faltan: ${faltantes.slice(0, 3).join(", ")}` : ""}` : `sin se\xF1ales medibles de la familia ${familia}`;
  return { familia, score, encontradas, faltantes, evidencia: evidencia2 };
}
function notasCoherenciaFamilia(maquetas, asignacion) {
  const out = [];
  for (const mq of maquetas) {
    const familia = asignacion.porLetra[mq.letra];
    if (!familia) continue;
    const inf = coherenciaFamilia(mq.texto, familia);
    out.push({
      juez: "coherencia",
      vision: mq.letra,
      nota: Math.round(inf.score * 10 * 10) / 10,
      base: "determinista",
      evidencia: {
        funciona: inf.encontradas.map((e) => `coherente con ${familia}: ${e}`).slice(0, 4),
        falla: inf.faltantes.map((f) => `falta vocabulario ${familia}: ${f}`).slice(0, 4),
        conservar: []
      }
    });
  }
  return out;
}
function leccionesFamilia(asignacion, notasCoherencia, mediasPorLetra, vertical) {
  const out = [];
  if (!notasCoherencia.length) return out;
  const v = (vertical || "general").slice(0, 60);
  const puntuadas = notasCoherencia.filter((n) => asignacion.porLetra[n.vision]);
  if (!puntuadas.length) return out;
  const mejor = puntuadas.reduce((a, b) => b.nota > a.nota ? b : a);
  const peor = puntuadas.reduce((a, b) => b.nota < a.nota ? b : a);
  const famMejor = asignacion.porLetra[mejor.vision];
  const famPeor = asignacion.porLetra[peor.vision];
  const mediaMejor = mediasPorLetra[mejor.vision];
  if (famMejor && famMejor !== famPeor) {
    out.push({
      tipo: "destacar",
      texto: `la familia \xAB${famMejor}\xBB funcion\xF3 para \xAB${v}\xBB: coherencia ${mejor.nota}/10 y media del panel ${mediaMejor.toFixed(1)}/10`,
      equipo: mejor.vision
    });
  }
  if (famPeor && peor.nota <= 4.5 && famPeor !== famMejor) {
    out.push({
      tipo: "evitar",
      texto: `la familia \xAB${famPeor}\xBB qued\xF3 corta para \xAB${v}\xBB: coherencia ${peor.nota}/10 (${(peor.evidencia.falla[0] ?? "sin vocabulario de la familia").slice(0, 90)})`,
      equipo: peor.vision
    });
  }
  return out;
}
function resumenAsignacionFamilias(a) {
  return `arena-familias: A=${a.porLetra.A} \xB7 B=${a.porLetra.B} \xB7 C=${a.porLetra.C}`;
}

// src/lib/prism/forja/arena2.ts
function planArena(modo2, perfil) {
  const receta = RECETAS_COSTO[perfil];
  const jueces = (() => {
    if (modo2 === "economico") return ["visual"];
    const core = ["visual", "ux", "originalidad"];
    if (receta.jueces >= 5) return [...core, "accesibilidad", "coherencia"];
    return core;
  })();
  const visiones = modo2 === "economico" ? 2 : receta.visiones;
  const maquetas = modo2 === "economico" ? 2 : receta.maquetas;
  const fusion = modo2 !== "economico" && receta.fusion;
  const directorFinal = fusion;
  const llamadas = 1 + visiones + (maquetas > 0 ? maquetas : 0) + jueces.length * (modo2 === "economico" ? 1 : visiones) + (fusion ? 2 : 0);
  return {
    modo: modo2,
    visiones,
    maquetas,
    jueces,
    directorFinal,
    fusion,
    modelosPorEquipo: modo2 === "experimental",
    llamadasEstimadas: llamadas
  };
}
async function arena2Forja(mensaje, adn2, modo2, perfil, deps) {
  const adn = sanearAdn2(adn2);
  const plan = planArena(modo2, perfil);
  const eventos = [];
  const progreso = (e) => {
    eventos.push(e);
    deps.onProgreso?.(e);
  };
  const letras = ["A", "B", "C"].slice(0, plan.visiones);
  const llamada = deps.llamarModelo;
  const modelo = deps.modeloDirector ?? { providerId: "prism", modelId: "d1-diseno" };
  const temperatura = deps.temperatura ?? 0.7;
  progreso(`[director] pidiendo ${plan.visiones} visiones (modo ${modo2})`);
  const familiasForzadas = deps.familiasArena ? [deps.familiasArena.porLetra.A, deps.familiasArena.porLetra.B, deps.familiasArena.porLetra.C].slice(0, plan.visiones) : void 0;
  if (deps.familiasArena) progreso(`[arena-familias] ${resumenAsignacionFamilias(deps.familiasArena)}`);
  let visiones = [];
  try {
    const salida = await llamada({
      providerId: modelo.providerId,
      modelId: modelo.modelId,
      system: promptDirector2(mensaje, adn, familiasForzadas),
      user: `Genera las ${plan.visiones} visiones ahora.`,
      temperatura
    });
    visiones = parseVisiones2(salida);
  } catch {
    visiones = [];
  }
  if (visiones.length === 0) {
    progreso("[director] sin respuesta usable: visiones de respaldo estructurales");
    visiones = visionesDeRespaldo(mensaje).slice(0, plan.visiones);
  }
  const maquetas = [];
  const fichaDeVision = /* @__PURE__ */ new Map();
  for (const v of visiones) {
    const ficha = seccionVisionParaMaqueta(v, adn);
    fichaDeVision.set(v.letra, ficha);
    const gen = detectarGenericidad(`${v.estructura.join("\n")}
${v.interaccion}
${v.composicion}`);
    progreso(`[maqueta ${v.letra}] \xAB${v.nombre}\xBB \u2014 identidad f\xEDsica: ${gen.puntuacionIdentidad}/100`);
    if (plan.maquetas > 0) {
      let texto = "";
      const familiaVision = deps.familiasArena?.porLetra[v.letra];
      try {
        texto = await llamada({
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system: [
            `Eres maquetador senior de FORJA IA. Produces la MAQUETA TEXTUAL (estructura HTML descripta secci\xF3n a secci\xF3n con clases y jerarqu\xEDa, sin c\xF3digo final) siguiendo la visi\xF3n y el ADN al pie de la letra. Prohibido el cat\xE1logo gen\xE9rico.`,
            familiaVision ? seccionFamiliaAsignada(familiaVision) : ""
          ].filter(Boolean).join("\n\n"),
          user: ficha,
          temperatura: 0.5
        });
      } catch {
        texto = "";
      }
      maquetas.push({ letra: v.letra, texto: texto.slice(0, 8e3) || v.estructura.join("\n") });
    }
  }
  const notas = [];
  for (const mq of maquetas) {
    const ficha = fichaDeVision.get(mq.letra) ?? mq.texto;
    const inspector = chequeosEstaticos(mq.texto);
    const gen = detectarGenericidad(mq.texto);
    const evid = evidenciaDeterminista(inspector, gen, []);
    for (const juez of plan.jueces) {
      const evFisica = juez === "originalidad" ? [`Patrones: ${gen.sintomas.map((s) => s.nombre).join(", ") || "ninguno"}`, `Identidad: ${gen.puntuacionIdentidad}/100`].join("\n") : evid[juez === "visual" ? "visual" : juez === "ux" ? "ux" : "originalidad"].falla.join("\n");
      let nota;
      try {
        const salida = await llamada({
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system: promptJuez2(juez, ficha.slice(0, 2500), evFisica, adn),
          user: `Eval\xFAa la maqueta ${mq.letra}.`,
          temperatura: 0.2
        });
        nota = parseNotaJuez2(salida, juez, mq.letra);
      } catch {
        nota = {
          juez,
          vision: mq.letra,
          nota: Math.max(0, 10 - (juez === "originalidad" ? gen.sintomas.length : inspector.length)),
          evidencia: juez === "originalidad" ? { funciona: [], falla: gen.sintomas.map((s) => s.nombre), conservar: [], patronesGenericos: gen.sintomas.map((s) => s.nombre), diferenciadores: [], riesgos: [] } : { funciona: [], falla: inspector.map((h) => h.titulo).slice(0, 5), conservar: [] },
          base: "determinista"
        };
      }
      notas.push(nota);
      progreso(`[juez ${juez}] ${mq.letra}: ${nota.nota}/10 (evidencia ${nota.evidencia.falla.length} fallas)`);
    }
  }
  if (deps.familiasArena && maquetas.length) {
    const coherencia = notasCoherenciaFamilia(maquetas, deps.familiasArena);
    for (const n of coherencia) {
      notas.push(n);
      progreso(`[juez coherencia\xB7familia] ${n.vision}: ${n.nota}/10 \u2014 ${n.evidencia.falla[0] ?? n.evidencia.funciona[0] ?? "sin se\xF1ales"}`);
    }
  }
  const medias = mediasPorVision(notas, letras);
  const mejor = mejorVision(notas, letras);
  let fusion = null;
  if (plan.fusion && plan.directorFinal) {
    progreso(`[director-final] base ${mejor}, pidiendo fusi\xF3n`);
    const notasVision = visiones.map((v) => {
      const deV = notas.filter((n) => n.vision === v.letra);
      return {
        letra: v.letra,
        nota: deV.length ? deV.reduce((s, n) => s + n.nota, 0) / deV.length : 0,
        evidencia: {
          funciona: deV.flatMap((n) => n.evidencia.funciona).slice(0, 4),
          falla: deV.flatMap((n) => n.evidencia.falla).slice(0, 4),
          conservar: deV.flatMap((n) => n.evidencia.conservar).slice(0, 4)
        }
      };
    });
    try {
      const salida = await llamada({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system: promptDirectorFusion2(visiones, notasVision),
        user: `Construye la fusi\xF3n (base sugerida: ${mejor}).`,
        temperatura: 0.5
      });
      fusion = parseFusion2(salida, mejor);
    } catch {
      fusion = { base: mejor, tomaDe: [], concepto: visiones.find((v) => v.letra === mejor)?.nombre ?? "fusi\xF3n" };
    }
  }
  const lecciones = [];
  const mejorNombre = visiones.find((v) => v.letra === mejor)?.nombre ?? mejor;
  if (mejorNombre) lecciones.push({ tipo: "destacar", texto: `El arquetipo de \xAB${mejorNombre}\xBB gan\xF3 con evidencia: ${medias[mejor].toFixed(1)}/10.`, equipo: mejor });
  for (const v of visiones) {
    if (v.letra === mejor) continue;
    const cons = notas.filter((n) => n.vision === v.letra).flatMap((n) => n.evidencia.conservar);
    if (cons.length) lecciones.push({ tipo: "conservar", texto: `De \xAB${v.nombre}\xBB se conserva: ${cons[0]}`, equipo: v.letra });
    const riesgos = notas.filter((n) => n.vision === v.letra).flatMap((n) => n.evidencia.riesgos ?? []);
    if (riesgos.length) lecciones.push({ tipo: "evitar", texto: `Evitar la deriva vista en \xAB${v.nombre}\xBB: ${riesgos[0]}`, equipo: v.letra });
  }
  if (deps.familiasArena) {
    const leccionesFam = leccionesFamilia(deps.familiasArena, notas.filter((n) => n.juez === "coherencia"), medias, mensaje);
    lecciones.push(...leccionesFam);
    if (leccionesFam.length) progreso(`[arena-familias] ${leccionesFam.map((l) => l.texto).join(" | ")}`);
  }
  return {
    plan,
    visiones,
    mejor,
    medias,
    notas,
    fusion,
    maquetas,
    evidenciaBase: tablaNotas(notas, letras),
    lecciones,
    resumenProceso: eventos.join("\n")
  };
}
function nuevoIdArena() {
  return idV4("arena");
}
function textoArena2(r) {
  const lineas = [
    `**ARENA ${r.plan.modo.toUpperCase()}** \u2014 ${r.plan.visiones} visiones, ${r.plan.maquetas} maquetas, ${r.plan.jueces.length} juez(es)${r.plan.fusion ? " + fusi\xF3n" : ""}`,
    ""
  ];
  for (const v of r.visiones) {
    lineas.push(explicarVision2(v));
    lineas.push("");
  }
  lineas.push("**Panel de jueces (con evidencia)**");
  lineas.push(r.evidenciaBase || "(sin notas)");
  if (r.fusion) {
    lineas.push("");
    lineas.push(`**Dise\xF1o Fusi\xF3n** (base ${r.fusion.base}): ${r.fusion.concepto}`);
    for (const t of r.fusion.tomaDe) lineas.push(`- Toma de ${t.de}: ${t.que}`);
  }
  return lineas.join("\n");
}

// src/lib/prism/forja/antigenerico2.ts
function analisisVisual(html) {
  const sintomas = [];
  if (!html) return { sintomas: [], puntuacion: 100, focalPoint: false };
  const secciones = html.match(/<(?:section|article)[^>]*class="[^"]*"[^>]*>/gi) ?? [];
  const huellas = secciones.map(huellasDe);
  const conteo = /* @__PURE__ */ new Map();
  for (const h of huellas) conteo.set(h, (conteo.get(h) ?? 0) + 1);
  const repetidas = [...conteo.entries()].filter(([, n]) => n >= 3);
  if (repetidas.length) {
    sintomas.push({
      id: "simetria-excesiva",
      nombre: "Simetr\xEDa excesiva",
      evidencia: `${repetidas[0][1]} secciones con estructura id\xE9ntica (mismas clases)`,
      gravedad: 2
    });
  }
  const alturas = [...html.matchAll(/min-height\s*:\s*(\d{2,4})px/gi)].map((m) => m[1]);
  const conteoAlturas = /* @__PURE__ */ new Map();
  for (const a of alturas) conteoAlturas.set(a, (conteoAlturas.get(a) ?? 0) + 1);
  const alturaRepetida = [...conteoAlturas.entries()].find(([, n]) => n >= 4);
  if (alturaRepetida) {
    sintomas.push({
      id: "monotonia",
      nombre: "Monoton\xEDa de bloques",
      evidencia: `${alturaRepetida[1]} bloques con la misma min-height (${alturaRepetida[0]}px)`,
      gravedad: 1
    });
  }
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const etiquetas = (html.match(/</g) ?? []).length;
  const densidad = etiquetas > 0 ? texto.length / etiquetas : 0;
  if (etiquetas > 40 && densidad < 8) {
    sintomas.push({
      id: "densidad-baja",
      nombre: "Densidad de contenido baja",
      evidencia: `${etiquetas} etiquetas para ~${texto.length} caracteres de texto (cajitas vac\xEDas)`,
      gravedad: 2
    });
  }
  const h1 = (html.match(/<h1[\s>]/i) ?? []).length;
  const hero = /class="[^"]*(?:hero|portada|destacad|principal)[^"]*"/i.test(html);
  const focalPoint = h1 === 1 && hero;
  if (!focalPoint) {
    sintomas.push({
      id: "sin-focal",
      nombre: "Falta de focal point",
      evidencia: h1 === 1 ? "h1 \xFAnico pero sin bloque dominante declarado" : `${h1} h1: la atenci\xF3n no tiene d\xF3nde aterrizar`,
      gravedad: 2
    });
  }
  const items = html.match(/<(?:li|article|div)[^>]*class="[^"]*(?:card|tarjeta|item)[^"]*"[^>]*>/gi) ?? [];
  if (items.length >= 3) {
    sintomas.push({
      id: "repeticion-visual",
      nombre: "Repetici\xF3n visual",
      evidencia: `${items.length} tarjetas \xEDdem (cat\xE1logo de plantilla)`,
      gravedad: 2
    });
  }
  let p = 100;
  for (const s of sintomas) p -= s.gravedad === 1 ? 6 : 12;
  return { sintomas, puntuacion: Math.max(0, Math.min(100, p)), focalPoint };
}
function huellasDe(tag) {
  return (tag.match(/class="([^"]*)"/i)?.[1] ?? "").split(/\s+/).sort().join(" ");
}
var PREGUNTA_SEMANTICA = "\xBFEl dise\xF1o tiene una raz\xF3n para existir o podr\xEDa cambiarse el logo y venderse como otra plantilla?";
function promptCapaSemantica(html, adnIdentidad) {
  return [
    `## Test sem\xE1ntico de identidad`,
    `Pregunta: \xAB${PREGUNTA_SEMANTICA}\xBB`,
    `Identidad declarada del proyecto: ${adnIdentidad || "(no declarada)"}`,
    ``,
    `HTML (recorte):`,
    html.slice(0, 6e3),
    ``,
    `Responde EXACTAMENTE:`,
    `<test-identidad>`,
    `Razon para existir: si|no`,
    `Justificacion: (2-3 frases: qu\xE9 decisiones demuestran intenci\xF3n propia o qu\xE9 es sustituible por plantilla)`,
    `Puntuacion: N/100 (100 = imposible confundirlo con otra marca)`,
    `</test-identidad>`
  ].join("\n");
}
function parseCapaSemantica(texto) {
  if (!texto) return null;
  const bloque = texto.match(/<test-identidad>([\s\S]*?)<\/test-identidad>/i)?.[1];
  if (!bloque) return null;
  const si = /raz[oó]n\s*para\s*existir\s*:\s*si\b/i.test(bloque);
  const no = /raz[oó]n\s*para\s*existir\s*:\s*no\b/i.test(bloque);
  if (!si && !no) return null;
  const just = (bloque.match(/Justificaci[oó]n\s*:\s*([\s\S]*?)(?=\n\s*Puntuaci[oó]n\s*:|$)/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  const punt = Number(bloque.match(/Puntuaci[oó]n\s*:\s*(\d{1,3})/i)?.[1] ?? NaN);
  return {
    razonParaExistir: si,
    justificacion: just || (si ? "con intenci\xF3n declarada" : "sustituible por plantilla"),
    puntuacion: Number.isNaN(punt) ? si ? 70 : 30 : Math.max(0, Math.min(100, punt))
  };
}
function componer(c1, c2, c3) {
  if (c3 === null) return Math.round(c1 * 0.62 + c2 * 0.38);
  return Math.round(c1 * 0.5 + c2 * 0.3 + c3 * 0.2);
}
async function informeAntiGenerico2(html, adnIdentidad, llamarModelo) {
  const capa1 = detectarGenericidad(html);
  const capa2 = analisisVisual(html);
  let capa3 = null;
  if (llamarModelo && html) {
    try {
      const salida = await llamarModelo({
        system: promptCapaSemantica(html, adnIdentidad),
        user: "Aplica el test de identidad.",
        temperatura: 0.2
      });
      capa3 = parseCapaSemantica(salida);
    } catch {
      capa3 = null;
    }
  }
  const puntuacionCompuesta = componer(capa1.puntuacionIdentidad, capa2.puntuacion, capa3?.puntuacion ?? null);
  const nivel2 = puntuacionCompuesta >= 80 ? "bajo" : puntuacionCompuesta >= 55 ? "medio" : "alto";
  const motivos = [capa1.motivo];
  if (capa2.sintomas.length) {
    motivos.push(`Capa visual: ${capa2.sintomas.map((s) => `${s.nombre} (${s.evidencia})`).join("; ")}`);
  }
  if (capa3 && !capa3.razonParaExistir) {
    motivos.push(`Test sem\xE1ntico: el dise\xF1o no demuestra raz\xF3n para existir \u2014 ${capa3.justificacion}`);
  }
  return {
    capa1,
    capa2,
    capa3,
    puntuacionCompuesta,
    nivel: nivel2,
    motivo: motivos.filter(Boolean).join(" \xB7 "),
    preguntaSemantica: PREGUNTA_SEMANTICA
  };
}
function sintomasUnificados(informe) {
  const out = [...informe.capa1.sintomas];
  for (const s of informe.capa2.sintomas) {
    out.push({
      id: `v-${s.id}`,
      nombre: s.nombre,
      motivo: s.evidencia,
      alternativa: "romper el patr\xF3n: variar estructura, densidad o foco de esos bloques",
      gravedad: s.gravedad
    });
  }
  return out;
}
function textoInforme2(informe) {
  return [
    `NIVEL DE SATURACI\xD3N: ${informe.nivel.toUpperCase()} (identidad compuesta ${informe.puntuacionCompuesta}/100)`,
    informe.motivo,
    informe.capa3 ? `Test sem\xE1ntico: \xAB${informe.preguntaSemantica}\xBB \u2192 ${informe.capa3.razonParaExistir ? "S\xCD" : "NO"}` : `Test sem\xE1ntico no aplicado (sin modelo en este perfil)`
  ].join("\n");
}
function nuevoIdInforme() {
  return idV4("ag2");
}

// src/lib/prism/forja/revisor-visual.ts
function enriquecer(h) {
  let causaProbable = "descuido del generador";
  let correccion = "corregir directamente en el HTML/CSS";
  switch (h.categoria) {
    case "bug":
      causaProbable = "plantilla base incompleta o l\xF3gica por saltarse";
      correccion = "corregir el marcado en la fuente y re-renderizar";
      break;
    case "accesibilidad":
      causaProbable = "el generador prioriz\xF3 apariencia sobre sem\xE1ntica";
      correccion = "a\xF1adir el atributo/estructura que falta (alt, label, lang, foco)";
      break;
    case "visual":
      causaProbable = "se copi\xF3 el cat\xE1logo por defecto en vez de decidir";
      correccion = "sustituir por la decisi\xF3n del ADN 2.0 (composici\xF3n/escala/acento)";
      break;
    case "movil":
      causaProbable = "no se prob\xF3 el viewport m\xF3vil";
      correccion = "revisar media queries y tama\xF1os m\xEDnimos de objetivo t\xE1ctil";
      break;
    case "seo":
      causaProbable = "metadatos no tratados como contenido";
      correccion = "declarar title/meta/estructura de encabezados";
      break;
    case "rendimiento":
      causaProbable = "recursos sin optimizar (fuentes, im\xE1genes, animaciones)";
      correccion = "lazy-loading, pesos razonables y reduced-motion";
      break;
    case "seguridad":
      causaProbable = "enlaces/entradas sin endurecer";
      correccion = "noopener en _blank, escapar entradas, no inline data: sensible";
      break;
    case "estandares":
      causaProbable = "etiquetas o pr\xE1cticas obsoletas";
      correccion = "usar HTML5 est\xE1ndar y validar";
      break;
  }
  return { ...h, causaProbable, correccion };
}
function revisarVisual(html, opts = {}) {
  const hallazgosBrutos = html ? chequeosEstaticos(html) : [];
  const gen = html ? detectarGenericidad(html) : null;
  const visual = html ? analisisVisual(html) : null;
  const sistema = opts.ds && html ? auditarContraDesignSystem(html, opts.ds) : [];
  const deCapa2 = (visual?.sintomas ?? []).map((s) => ({
    severidad: s.gravedad === 3 ? "critico" : s.gravedad === 2 ? "aviso" : "mejora",
    categoria: "visual",
    titulo: `Anti-gen\xE9rico (capa visual): ${s.nombre}`,
    detalle: s.evidencia
  }));
  const todos = [...hallazgosBrutos, ...sistema, ...deCapa2].map(enriquecer);
  const criticos = todos.filter((h) => h.severidad === "critico").length;
  const avisos = todos.filter((h) => h.severidad === "aviso").length;
  const mejoras = todos.filter((h) => h.severidad === "mejora").length;
  const umbral = opts.umbralAvisos ?? 3;
  const veredicto = !html || criticos > 0 ? "FAIL" : avisos >= umbral ? "WARN" : "PASS";
  const identidad = gen ? Math.round(gen.puntuacionIdentidad * 0.5 + (visual?.puntuacion ?? 100) * 0.5) : 100;
  const partes = [];
  partes.push(veredicto === "PASS" ? "Entrega aprobada por el revisor visual." : veredicto === "WARN" ? `Entrega con ${avisos} aviso(s): corregir antes de exportar.` : `Entrega rechazada: ${criticos} hallazgo(s) cr\xEDtico(s).`);
  if (visual && !visual.focalPoint) partes.push("Sin focal point claro.");
  if (gen && gen.nivel !== "bajo") partes.push(`Anti-gen\xE9rico: saturaci\xF3n ${gen.nivel}.`);
  return {
    veredicto,
    hallazgos: todos.slice(0, 24),
    criticos,
    avisos,
    mejoras,
    identidad,
    resumen: partes.join(" ")
  };
}
function textoRevisorVisual(inf) {
  const simbolo = { PASS: "\u2705", WARN: "\u26A0\uFE0F", FAIL: "\u274C" }[inf.veredicto];
  const lineas = [`${simbolo} ${inf.veredicto} \u2014 ${inf.resumen}`];
  for (const h of inf.hallazgos.slice(0, 12)) {
    lineas.push(`- [${h.severidad}] ${h.titulo} \u2014 ${h.detalle} \xB7 causa: ${h.causaProbable} \xB7 correcci\xF3n: ${h.correccion}`);
  }
  return lineas.join("\n");
}
function defectosCorregibles(inf) {
  return inf.hallazgos.filter((h) => h.severidad !== "mejora").slice(0, 8).map((h) => ({ titulo: h.titulo, correccion: h.correccion }));
}

// src/lib/prism/forja/bucle-mejora.ts
var MAX_ITERACIONES_MEJORA = 3;
function scoreDe(inf) {
  const penal = inf.criticos * 18 + inf.avisos * 6 + inf.mejoras * 2;
  const penalIdentidad = (100 - inf.identidad) * 0.2;
  return Math.max(0, Math.round(100 - penal - penalIdentidad));
}
var CORRECCIONES_MECANICAS = [
  {
    nombre: "lang en <html>",
    aplica: (h) => /<html(?![^>]*\slang=)/i.test(h),
    parche: (h) => h.replace(/<html/i, '<html lang="es"')
  },
  {
    nombre: "meta viewport",
    aplica: (h) => !/<meta[^>]*name=["']?viewport/i.test(h) && /<head[^>]*>/i.test(h),
    parche: (h) => h.replace(/<head([^>]*)>/i, '<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1">')
  },
  {
    nombre: "charset utf-8",
    aplica: (h) => !/<meta[^>]*charset/i.test(h) && /<head[^>]*>/i.test(h),
    parche: (h) => h.replace(/<head([^>]*)>/i, '<head$1>\n<meta charset="utf-8">')
  },
  {
    nombre: "noopener en _blank",
    aplica: (h) => /target=["']?_blank/i.test(h) && !/noopener/i.test(h),
    parche: (h) => h.replace(/target=["']?_blank(["']?)/gi, 'target="_blank"$1 rel="noopener"')
  },
  {
    nombre: "title del documento",
    aplica: (h) => !/<title>\s*\S/i.test(h) && /<head[^>]*>/i.test(h),
    parche: (h) => h.replace(/<head([^>]*)>/i, "<head$1>\n<title>Proyecto FORJA IA</title>")
  }
];
function aplicarCorreccionesMecanicas(html) {
  const aplicadas = [];
  let out = html;
  for (const c of CORRECCIONES_MECANICAS) {
    if (c.aplica(out)) {
      out = c.parche(out);
      aplicadas.push(c.nombre);
    }
  }
  return { html: out, aplicadas };
}
async function ejecutarBucleMejora(htmlInicial, deps = {}) {
  const traza = [];
  const iteraciones = [];
  let mejorHtml = htmlInicial;
  let mejorScore = 0;
  let informe = revisarVisual(mejorHtml, { ds: deps.ds });
  mejorScore = scoreDe(informe);
  traza.push(`[bucle] score inicial ${mejorScore} (${informe.veredicto})`);
  let n = 0;
  while (n < MAX_ITERACIONES_MEJORA && informe.veredicto !== "PASS") {
    n += 1;
    const scoreAntes = mejorScore;
    const objetivos = defectosCorregibles(informe);
    if (!objetivos.length) {
      traza.push(`[bucle] iter ${n}: sin defectos corregibles, fin`);
      break;
    }
    traza.push(`[bucle] iter ${n}: ${objetivos.length} objetivo(s)`);
    let htmlCandidato = "";
    let aplicadas = [];
    if (deps.llamarModelo && deps.modelo) {
      try {
        htmlCandidato = await deps.llamarModelo({
          providerId: deps.modelo.providerId,
          modelId: deps.modelo.modelId,
          system: [
            `Eres el Codificador de FORJA IA en modo CORRECCI\xD3N.`,
            `Te doy el HTML actual y la lista de defectos con su correcci\xF3n propuesta.`,
            `Devuelve el HTML COMPLETO corregido. Solo corrige lo indicado: no redise\xF1es, no cambies el ADN, no a\xF1adas efectos.`,
            `Formato: solo el c\xF3digo HTML (sin explicaciones).`
          ].join("\n"),
          user: [
            `# Defectos a corregir`,
            ...objetivos.map((o, i) => `${i + 1}. ${o.titulo} \u2192 ${o.correccion}`),
            ``,
            `# HTML actual`,
            mejorHtml.slice(0, 6e4)
          ].join("\n"),
          temperatura: 0.2,
          rol: "codificador"
          // v4.1: corrección de página = salida larga garantizada
        });
        const res = await continuarSalidaTruncada({
          salida: htmlCandidato,
          continuarCon: continuarConLlamada(deps.llamarModelo, {
            providerId: deps.modelo.providerId,
            modelId: deps.modelo.modelId,
            system: "Eres el Codificador de FORJA IA en modo CORRECCI\xD3N.",
            temperatura: 0.2,
            rol: "codificador"
          })
        });
        htmlCandidato = res.texto;
        if (!/<html|<!doctype/i.test(htmlCandidato)) htmlCandidato = "";
      } catch {
        htmlCandidato = "";
      }
    }
    if (!htmlCandidato) {
      const mec = aplicarCorreccionesMecanicas(mejorHtml);
      htmlCandidato = mec.html;
      aplicadas = mec.aplicadas;
    } else {
      aplicadas = objetivos.map((o) => o.titulo);
    }
    const informeCandidato = revisarVisual(htmlCandidato, { ds: deps.ds });
    const scoreDespues = scoreDe(informeCandidato);
    const mejoro = scoreDespues > scoreAntes;
    iteraciones.push({
      n,
      objetivos: objetivos.map((o) => o.titulo),
      aplicadas: aplicadas.length,
      scoreAntes,
      scoreDespues,
      mejoro,
      veredicto: informeCandidato.veredicto
    });
    traza.push(`[bucle] iter ${n}: ${scoreAntes} \u2192 ${scoreDespues} ${mejoro ? "MEJOR\xD3" : "sin mejora \u2192 REVERTIR"}`);
    if (mejoro) {
      mejorHtml = htmlCandidato;
      mejorScore = scoreDespues;
      informe = informeCandidato;
    } else {
      break;
    }
  }
  return {
    html: mejorHtml,
    informeFinal: informe,
    iteraciones,
    iteracionesUsadas: n,
    traza
  };
}

// src/lib/prism/forja/metricas.ts
var PESOS = {
  identidad: 1.5,
  genericidad: 1.5,
  coherencia: 1.4,
  ux: 1.2,
  accesibilidad: 1,
  responsive: 1,
  codigo: 1,
  iteracion: 0.4
};
function medir(html, opts = {}) {
  const inf = revisarVisual(html, { ds: opts.ds });
  const porCategoria = /* @__PURE__ */ new Map();
  for (const h of inf.hallazgos) {
    porCategoria.set(h.categoria, (porCategoria.get(h.categoria) ?? 0) + (h.severidad === "critico" ? 2 : h.severidad === "aviso" ? 1 : 0.4));
  }
  const nota = (cat) => {
    const penal = cat ? porCategoria.get(cat) ?? 0 : 0;
    return Math.max(0, Math.min(10, Math.round((10 - penal) * 10) / 10));
  };
  const identidad = Math.round(inf.identidad / 100 * 10 * 10) / 10;
  const genericidad = identidad;
  const penalSistema = (opts.ds ? porCategoria.get("estandares") ?? 0 : 0) + (porCategoria.get("bug") ?? 0) * 0.5;
  const coherencia = Math.max(0, Math.min(10, Math.round((10 - penalSistema) * 10) / 10));
  const ux = nota("visual");
  const accesibilidad = nota("accesibilidad");
  const responsive = nota("movil");
  const codigo = nota("bug");
  const its = opts.iteraciones ?? [];
  const iteracion = its.length ? Math.round(its.filter((i) => i.mejoro).length / its.length * 10 * 10) / 10 : 10;
  const evidencia2 = {
    identidad: `identidad anti-gen\xE9rica ${inf.identidad}/100 (${inf.hallazgos.filter((h) => h.categoria === "visual").length} hallazgos visuales)`,
    genericidad: `${inf.criticos + inf.avisos} s\xEDntomas activos; identidad compuesta ${inf.identidad}/100`,
    coherencia: opts.ds ? `${inf.hallazgos.filter((h) => h.categoria === "estandares").length} desviaciones de sistema` : "sin design system declarado: coherencia medida por bugs",
    ux: `${porCategoria.get("visual") ?? 0} penalizaciones visuales/UX`,
    accesibilidad: `${porCategoria.get("accesibilidad") ?? 0} penalizaciones de accesibilidad`,
    responsive: `${porCategoria.get("movil") ?? 0} penalizaciones m\xF3viles`,
    codigo: `${inf.criticos} cr\xEDticos de c\xF3digo`,
    iteracion: its.length ? `${its.filter((i) => i.mejoro).length}/${its.length} iteraciones mejoraron` : "sin iteraciones (aprob\xF3 directo)"
  };
  const vals = { identidad, genericidad, coherencia, ux, accesibilidad, responsive, codigo, iteracion };
  const pesoTotal = Object.values(PESOS).reduce((a, b) => a + b, 0);
  const media = Math.round(Object.entries(vals).reduce((s, [k, v]) => s + v * PESOS[k], 0) / pesoTotal * 10) / 10;
  const peor = Object.entries(vals).sort((a, b) => a[1] - b[1])[0];
  return {
    ...vals,
    evidencia: evidencia2,
    media,
    resumen: `Media ponderada ${media}/10. Punto d\xE9bil: ${peor[0]} (${peor[1]}/10). ${inf.resumen}`
  };
}
function textoMedicion(m) {
  const linea = (k) => `${k}: ${m[k]}/10 \u2014 ${m.evidencia[k]}`;
  return [
    `## M\xE9tricas (media ponderada ${m.media}/10)`,
    linea("identidad"),
    linea("genericidad"),
    linea("coherencia"),
    linea("ux"),
    linea("accesibilidad"),
    linea("responsive"),
    linea("codigo"),
    linea("iteracion")
  ].join("\n");
}

// src/lib/prism/forja/observabilidad.ts
function crearRegistro(projectId) {
  return {
    projectId: projectId || "prisma",
    requestId: idV4("req"),
    inicio: (/* @__PURE__ */ new Date()).toISOString(),
    fin: "",
    modelos: [],
    agentes: [],
    designSystem: "",
    adn: "",
    direccion: "",
    direccionesExploradas: [],
    skills: [],
    artifact: "",
    critic: "",
    antiGeneric: "",
    iteraciones: 0,
    finalScore: 0,
    lecciones: [],
    llamadas: 0,
    telemetria: telemetriaVacia()
  };
}
function cerrarRegistro(r, finalScore, lecciones) {
  return {
    ...r,
    fin: (/* @__PURE__ */ new Date()).toISOString(),
    finalScore,
    lecciones: lecciones.slice(0, 12)
  };
}
function serializarRegistro(r) {
  return JSON.stringify(r);
}
function deserializarRegistro(s) {
  try {
    const obj = JSON.parse(s);
    if (!obj.requestId || !obj.inicio) return null;
    return { ...crearRegistro(obj.projectId ?? "prisma"), ...obj, requestId: obj.requestId };
  } catch {
    return null;
  }
}
function registrarEventoAdaptador(r, e) {
  try {
    if (!r.telemetria) r.telemetria = telemetriaVacia();
    const t = r.telemetria;
    switch (e.tipo) {
      case "red-reintento":
        t.reintentosRed += 1;
        break;
      case "failover":
        t.failovers += 1;
        break;
      case "continuacion":
        t.continuaciones += 1;
        break;
      case "truncado-final":
        t.truncados += 1;
        break;
      case "exito":
        t.llamadasOk += 1;
        t.tokensSalida += e.tokensSalida ?? 0;
        t.latenciaMsTotal += e.ms;
        break;
      case "cadena-agotada":
        break;
    }
  } catch {
  }
  return r;
}
function crearTelemetriaForja(registro, opciones = {}) {
  return (e) => {
    registrarEventoAdaptador(registro, e);
    try {
      opciones.tambien?.(e);
    } catch {
    }
  };
}
function agregarTelemetria(rs) {
  const out = {
    reintentosRed: 0,
    failovers: 0,
    continuaciones: 0,
    truncados: 0,
    llamadasOk: 0,
    tokensSalida: 0,
    latenciaMsMedia: 0
  };
  for (const r of rs) {
    if (!r.telemetria) continue;
    out.reintentosRed += r.telemetria.reintentosRed;
    out.failovers += r.telemetria.failovers;
    out.continuaciones += r.telemetria.continuaciones;
    out.truncados += r.telemetria.truncados;
    out.llamadasOk += r.telemetria.llamadasOk;
    out.tokensSalida += r.telemetria.tokensSalida;
    out.latenciaMsMedia += r.telemetria.latenciaMsTotal;
  }
  if (out.llamadasOk > 0) {
    out.latenciaMsMedia = Math.round(out.latenciaMsMedia / out.llamadasOk);
  }
  return out;
}
function consultarRegistros(rs) {
  const cerrados = rs.filter((r) => r.fin !== "");
  const porModelo = /* @__PURE__ */ new Map();
  const porSkill = /* @__PURE__ */ new Map();
  const porDireccion = /* @__PURE__ */ new Map();
  let totalIter = 0;
  let llamadasTotales = 0;
  for (const r of cerrados) {
    for (const m of r.modelos) {
      const e = porModelo.get(m) ?? { suma: 0, n: 0 };
      e.suma += r.finalScore;
      e.n += 1;
      porModelo.set(m, e);
    }
    for (const s of r.skills) {
      const e = porSkill.get(s) ?? { suma: 0, n: 0 };
      e.suma += r.finalScore;
      e.n += 1;
      porSkill.set(s, e);
    }
    for (const d of r.direccionesExploradas) {
      const e = porDireccion.get(d) ?? { suma: 0, n: 0 };
      const m = r.antiGeneric.match(/identidad\s+(\d{1,3})\/100/i);
      e.suma += m ? Number(m[1]) : r.finalScore;
      e.n += 1;
      porDireccion.set(d, e);
    }
    totalIter += r.iteraciones;
    llamadasTotales += r.llamadas;
  }
  const mejorDe = (mapa) => {
    let mejor = null;
    for (const [clave2, e] of mapa) {
      const media = e.suma / e.n;
      if (!mejor || media > mejor.media) mejor = { clave: clave2, media, n: e.n };
    }
    return mejor;
  };
  const mModelo = mejorDe(porModelo);
  const mSkill = mejorDe(porSkill);
  const mDireccion = mejorDe(porDireccion);
  const duraciones = cerrados.filter((r) => r.inicio && r.fin).map((r) => Math.max(0, new Date(r.fin).getTime() - new Date(r.inicio).getTime()));
  const mejoraron = cerrados.reduce((s, r) => s + (r.iteraciones > 0 ? 1 : 0), 0);
  return {
    mejorModelo: mModelo ? { modelo: mModelo.clave, scoreMedio: Math.round(mModelo.media * 10) / 10, usos: mModelo.n } : null,
    mejorSkill: mSkill ? { skill: mSkill.clave, scoreMedio: Math.round(mSkill.media * 10) / 10, usos: mSkill.n } : null,
    menosGenerica: mDireccion ? { direccion: mDireccion.clave, identidadMedia: Math.round(mDireccion.media), usos: mDireccion.n } : null,
    efectividadIteraciones: {
      mejoraron,
      total: cerrados.length,
      porcentaje: cerrados.length ? Math.round(mejoraron / cerrados.length * 100) : 0
    },
    costeMedio: {
      llamadas: cerrados.length ? Math.round(llamadasTotales / cerrados.length * 10) / 10 : 0,
      duracionMsMedio: duraciones.length ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : 0,
      generaciones: cerrados.length
    },
    saludRed: agregarTelemetria(cerrados)
  };
}
function textoConsultas(c) {
  return [
    c.mejorModelo ? `Mejor modelo: ${c.mejorModelo.modelo} (${c.mejorModelo.scoreMedio}/100, ${c.mejorModelo.usos} usos)` : "Sin datos de modelos a\xFAn",
    c.menosGenerica ? `Direcci\xF3n menos gen\xE9rica: ${c.menosGenerica.direccion} (identidad media ${c.menosGenerica.identidadMedia})` : "Sin datos de direcciones a\xFAn",
    `Iteraciones que mejoraron: ${c.efectividadIteraciones.porcentaje}% (${c.efectividadIteraciones.mejoraron}/${c.efectividadIteraciones.total})`,
    `Coste medio por flujo: ${c.costeMedio.llamadas} llamadas \xB7 ${c.costeMedio.duracionMsMedio}ms`,
    // v4.2: el blindaje en números — lo que la tubería evitó sin que nadie
    // se enterara (o lo que conviene mirar si los números suben solos).
    `Blindaje de red: ${c.saludRed.reintentosRed} reintento(s) \xB7 ${c.saludRed.failovers} failover(s) \xB7 ${c.saludRed.continuaciones} continuaci\xF3n(es) \xB7 ${c.saludRed.truncados} truncado(s) detectado(s)`,
    c.saludRed.llamadasOk ? `Salud: ${c.saludRed.llamadasOk} llamada(s) ok \xB7 latencia media ${c.saludRed.latenciaMsMedia}ms \xB7 ${c.saludRed.tokensSalida} tokens de salida` : "Salud: sin llamadas registradas a\xFAn"
  ].join("\n");
}

// src/lib/prism/forja/genoma-visual.ts
var CONFIRMACIONES_PARA_CONSOLIDAR = 3;
var MAX_LECCIONES_GENOMA = 120;
function genomaVacio() {
  return { generacion: 0, lecciones: [], patrones: [], antiPatrones: [], referencias: [] };
}
function incorporarLeccionesArena(genoma, lecciones, origenPorDefecto = "") {
  const generacion = genoma.generacion + 1;
  const nuevas = lecciones.map((l) => leccionArenaAGenoma(l, generacion));
  if (!nuevas.length) return { ...genoma, generacion };
  const leccionesAct = [...genoma.lecciones];
  for (const l of nuevas) {
    const clave2 = l.texto.trim().toLowerCase();
    const idx = leccionesAct.findIndex((x) => x.texto.trim().toLowerCase() === clave2);
    if (idx >= 0) {
      leccionesAct[idx] = {
        ...leccionesAct[idx],
        confirmaciones: leccionesAct[idx].confirmaciones + 1,
        generacion: l.generacion
      };
    } else {
      leccionesAct.push({ ...l, origen: l.origen || origenPorDefecto });
    }
  }
  const recortadas = leccionesAct.slice(-MAX_LECCIONES_GENOMA);
  return consolidar({ ...genoma, generacion, lecciones: recortadas });
}
function incorporarLeccionesGenoma(genoma, lecciones) {
  const generacion = genoma.generacion + 1;
  const actuales = [...genoma.lecciones];
  for (const l of lecciones) {
    const clave2 = l.texto.trim().toLowerCase();
    const idx = actuales.findIndex((x) => x.texto.trim().toLowerCase() === clave2);
    if (idx >= 0) {
      actuales[idx] = { ...actuales[idx], confirmaciones: actuales[idx].confirmaciones + 1, generacion };
    } else {
      actuales.push({
        id: idV4("lec"),
        tipo: l.tipo,
        texto: l.texto.slice(0, 200),
        conversion: null,
        origen: l.equipo,
        generacion,
        confirmaciones: 1
      });
    }
  }
  return consolidar({ ...genoma, generacion, lecciones: actuales.slice(-MAX_LECCIONES_GENOMA) });
}
function consolidar(g) {
  const lecciones = g.lecciones.map((l) => {
    if (l.conversion) return l;
    if (l.confirmaciones < CONFIRMACIONES_PARA_CONSOLIDAR) return l;
    const conversion = l.tipo === "evitar" ? "anti-patron" : l.tipo === "destacar" ? "patron" : l.tipo === "conservar" ? "experimento" : null;
    return conversion ? { ...l, conversion } : l;
  });
  const patrones = [...g.patrones];
  const antiPatrones = [...g.antiPatrones];
  const experimentosNuevos = [];
  for (const l of lecciones) {
    if (l.conversion === "patron" && !patrones.some((p) => p.texto === l.texto)) {
      patrones.push({ texto: l.texto, desdeGeneracion: l.generacion, confirmaciones: l.confirmaciones });
    }
    if (l.conversion === "anti-patron" && !antiPatrones.some((p) => p.texto === l.texto)) {
      antiPatrones.push({ texto: l.texto, desdeGeneracion: l.generacion, confirmaciones: l.confirmaciones });
    }
    if (l.conversion === "experimento") {
      experimentosNuevos.push(l.texto);
    }
  }
  return { ...g, lecciones, patrones, antiPatrones };
}
function aporteAlAdn(genoma) {
  return {
    lenguaje: genoma.patrones.slice(0, 4).map((p) => p.texto),
    prohibiciones: genoma.antiPatrones.slice(0, 4).map((p) => p.texto)
  };
}
function resumenGenoma(genoma) {
  const porTipo = { destacar: 0, conservar: 0, evitar: 0 };
  for (const l of genoma.lecciones) porTipo[l.tipo] += 1;
  const convertidas = genoma.lecciones.filter((l) => l.conversion).length;
  return [
    `Generaci\xF3n ${genoma.generacion} \u2014 ${genoma.lecciones.length} lecciones (${porTipo.destacar} destacadas, ${porTipo.conservar} por conservar, ${porTipo.evitar} a evitar)`,
    `Consolidadas: ${convertidas} \u2192 ${genoma.patrones.length} patrones, ${genoma.antiPatrones.length} anti-patrones`
  ].join("\n");
}
function seccionGenoma(genoma) {
  const destacadas = genoma.lecciones.filter((l) => l.tipo === "destacar").slice(-3);
  const evitadas = genoma.lecciones.filter((l) => l.tipo === "evitar").slice(-3);
  const lineas = [`# Genoma Visual (generaci\xF3n ${genoma.generacion})`];
  if (destacadas.length) lineas.push(`FUNCION\xD3 antes: ${destacadas.map((l) => l.texto).join("; ")}`);
  if (evitadas.length) lineas.push(`FALL\xD3 antes (no repetir): ${evitadas.map((l) => l.texto).join("; ")}`);
  if (genoma.antiPatrones.length) lineas.push(`PROHIBIDO consolidado: ${genoma.antiPatrones.map((p) => p.texto).join("; ")}`);
  if (lineas.length === 1) lineas.push("(sin lecciones todav\xEDa: primera generaci\xF3n)");
  return lineas.join("\n");
}
function serializarGenoma(g) {
  return JSON.stringify(g);
}
function deserializarGenoma(s) {
  if (!s) return genomaVacio();
  try {
    const obj = JSON.parse(s);
    return {
      generacion: Number(obj.generacion) || 0,
      lecciones: Array.isArray(obj.lecciones) ? obj.lecciones.slice(0, MAX_LECCIONES_GENOMA) : [],
      patrones: Array.isArray(obj.patrones) ? obj.patrones : [],
      antiPatrones: Array.isArray(obj.antiPatrones) ? obj.antiPatrones : [],
      referencias: Array.isArray(obj.referencias) ? obj.referencias : []
    };
  } catch {
    return genomaVacio();
  }
}

// src/lib/prism/forja/evaluador-exito.ts
function evaluarExito(r) {
  const checks = [];
  const hayCodigo = r.codigo.length > 200;
  const inspector = hayCodigo ? chequeosEstaticos(r.codigo) : [];
  const criticos = inspector.filter((h) => h.severidad === "critico").length;
  checks.push({
    id: "funciona",
    criterio: "funciona",
    ok: hayCodigo && criticos === 0,
    nota: hayCodigo ? `${criticos} hallazgo(s) cr\xEDtico(s)` : "sin c\xF3digo final"
  });
  const responsiveOk = /<meta[^>]*viewport/i.test(r.codigo) && /@media[^{]*\{/i.test(r.codigo);
  checks.push({ id: "responsive", criterio: "es responsive", ok: responsiveOk, nota: responsiveOk ? "viewport + media queries presentes" : "falta viewport o media queries" });
  const h1s = (r.codigo.match(/<h1[\s>]/gi) ?? []).length;
  checks.push({ id: "jerarquia", criterio: "tiene buena jerarqu\xEDa", ok: h1s === 1 && !inspector.some((h) => /jerarqu/i.test(h.titulo)), nota: `${h1s} h1 y ${inspector.filter((h) => /jerarqu/i.test(h.titulo)).length} saltos de jerarqu\xEDa` });
  const adnOk = !!r.adn && r.genericidad?.nivel !== "alto";
  checks.push({ id: "adn", criterio: "respeta el ADN", ok: adnOk, nota: r.adn ? `saturaci\xF3n anti-gen\xE9rica: ${r.genericidad?.nivel ?? "baja"}` : "sin ADN registrado" });
  checks.push({ id: "genericidad", criterio: "no presenta genericidad alta", ok: (r.genericidad?.nivel ?? "bajo") !== "alto", nota: `nivel ${r.genericidad?.nivel ?? "bajo"} (identidad ${r.genericidad?.puntuacionIdentidad ?? 100}/100)` });
  const a11yCriticos = inspector.filter((h) => h.categoria === "accesibilidad" && h.severidad === "critico").length;
  checks.push({ id: "accesibilidad", criterio: "supera las verificaciones de accesibilidad definidas", ok: a11yCriticos === 0, nota: `${a11yCriticos} cr\xEDtico(s) de accesibilidad` });
  const exportable = /<!doctype html|<html/i.test(r.codigo) && r.codigo.includes("</html>");
  checks.push({ id: "exportable", criterio: "tiene c\xF3digo exportable", ok: exportable, nota: exportable ? "HTML autocontenido completo" : "el c\xF3digo no es un HTML completo" });
  const editable = hayCodigo && r.codigo.length > 500 && /\n/.test(r.codigo);
  checks.push({ id: "editable", criterio: "puede continuar edit\xE1ndose", ok: editable, nota: editable ? "c\xF3digo legible con saltos" : "c\xF3digo ausente o ilegible" });
  const reproducible = !!r.adn && !!r.fichaTexto;
  checks.push({ id: "reproducible", criterio: "puede reproducirse", ok: reproducible, nota: reproducible ? "ADN + ficha de dise\xF1o guardados" : "faltan ADN o ficha" });
  const evidencia2 = r.rondas.length > 0;
  checks.push({ id: "evidencia", criterio: "deja evidencia de c\xF3mo se produjo", ok: evidencia2, nota: evidencia2 ? `${r.rondas.length} ronda(s) trazadas` : "sin rondas trazadas" });
  const pasan = checks.filter((c) => c.ok).length;
  return {
    exito: pasan === checks.length,
    pasan,
    total: checks.length,
    checks,
    resumen: pasan === checks.length ? `\xC9XITO: los ${checks.length} criterios del plan se cumplen. La generaci\xF3n es \xABlista\xBB.` : `${pasan}/${checks.length} criterios cumplidos. Pendiente: ${checks.filter((c) => !c.ok).map((c) => c.criterio).join(", ")}.`
  };
}
function textoExito(v) {
  const lineas = v.checks.map((c) => `${c.ok ? "\u2714" : "\u2718"} ${c.criterio} \u2014 ${c.nota}`);
  return [v.exito ? "\u2705 GENERACI\xD3N LISTA" : "\u23F3 TODAV\xCDA NO", ...lineas, "", v.resumen].join("\n");
}

// src/lib/prism/forja/presupuesto-tokens.ts
var FASES = [
  "planning",
  "design",
  "implementation",
  "qa",
  "repair",
  "reserve"
];
var RX_AMBIGUO = /\b(varias|multiples|múltiples|todo|completo|integral|plataforma|sistema|tienda|dashboard|galeria|galería|blog|paginas|páginas|seccion(es)?|animaciones?|3d|webgl|interactiva)\b/i;
function complejidadDe(mensaje, esEdicion) {
  const m = (mensaje ?? "").trim();
  let puntos = 0;
  if (m.length > 240) puntos += 2;
  else if (m.length > 90) puntos += 1;
  const coincidencias = m.match(new RegExp(RX_AMBIGUO.source, "gi"));
  if (coincidencias) puntos += Math.min(3, coincidencias.length);
  if (esEdicion) puntos += 2;
  if (puntos >= 4) return "compleja";
  if (puntos >= 2) return "media";
  return "simple";
}
var REPARTO_RELATIVO = {
  planning: 10,
  design: 8,
  // v4.7 — la implementación sube de 38 a 46. El detalle de una página se
  // paga en tokens de salida: con el reparto anterior, una petición media
  // dejaba ~12.900 tokens para TODA la página y el modelo recortaba
  // contenido (lo invisible) antes que CSS (lo que se nota).
  implementation: 46,
  qa: 12,
  repair: 16,
  reserve: 8
};
var TOTAL_POR_COMPLEJIDAD = {
  // v4.7 — recalibrado hacia arriba: los techos de v4.4 se fijaron para
  // abaratar, y lo consiguieron a costa de páginas finas. El ahorro real
  // sigue viniendo de la caché, del early exit y de los parches gratis
  // (que no han cambiado), no de entregar media página.
  simple: 32e3,
  media: 56e3,
  compleja: 88e3
};
var FACTOR_PERFIL = {
  FREE: 0.65,
  SMART: 0.85,
  ARENA: 1,
  LAB: 1.15
};
function presupuestoDefecto(complejidad, perfil) {
  const total = TOTAL_POR_COMPLEJIDAD[complejidad] * (FACTOR_PERFIL[perfil] ?? 0.85);
  const out = {};
  let asignado = 0;
  for (const fase of FASES) {
    const v = Math.round(total * REPARTO_RELATIVO[fase] / 100 / 256) * 256;
    out[fase] = v;
    asignado += v;
  }
  out.reserve += Math.max(0, Math.round(total) - asignado);
  return out;
}
function crearPresupuesto(reparto, perfil) {
  const porFase = {};
  for (const f of FASES) porFase[f] = { cupo: Math.max(0, reparto[f]), gastado: 0 };
  const total = FASES.reduce((s, f) => s + porFase[f].cupo, 0);
  const counters = { llamadasOk: 0, llamadasDenegadas: 0, rescates: 0 };
  const esLab = perfil === "LAB" || perfil === "ARENA";
  const restanteDe = (f) => Math.max(0, porFase[f].cupo - porFase[f].gastado);
  return {
    total,
    autorizar(fase, tokens) {
      const restante = restanteDe(fase);
      const margen = esLab ? Math.round(porFase[fase].cupo * 0.25) : 0;
      if (tokens <= restante + margen) {
        return { ok: true, motivo: "", restanteFase: restante - tokens };
      }
      counters.llamadasDenegadas++;
      return {
        ok: false,
        motivo: `presupuesto ${fase}: pide ${tokens}, quedan ${restante}` + (margen ? ` (+margen ${margen})` : ""),
        restanteFase: restante
      };
    },
    gastar(fase, tokens) {
      const t = Math.max(0, Math.round(tokens || 0));
      porFase[fase].gastado += t;
      const exceso = porFase[fase].gastado - porFase[fase].cupo;
      if (exceso > 0 && restanteDe("reserve") > 0) {
        const robo = Math.min(exceso, restanteDe("reserve"));
        porFase.reserve.gastado += robo;
        counters.rescates++;
      }
      counters.llamadasOk++;
    },
    estimar(fase, techoRol) {
      const restante = restanteDe(fase);
      if (restante <= 0) return 256;
      return Math.max(256, Math.min(techoRol, restante));
    },
    informe() {
      const gastado = FASES.reduce((s, f) => s + porFase[f].gastado, 0);
      return {
        total,
        gastado,
        restante: Math.max(0, total - gastado),
        porFase: JSON.parse(JSON.stringify(porFase)),
        ...counters,
        uso: total ? Math.min(1, gastado / total) : 0
      };
    },
    resumen() {
      const i = (function() {
        const gastado = FASES.reduce((s, f) => s + porFase[f].gastado, 0);
        return { gastado };
      })();
      const pct3 = total ? Math.round(i.gastado / total * 100) : 0;
      return `presupuesto ${i.gastado}/${total} tok (${pct3}%) \xB7 ok ${counters.llamadasOk} \xB7 denegadas ${counters.llamadasDenegadas}` + (counters.rescates ? ` \xB7 rescates ${counters.rescates}` : "");
    }
  };
}
function presupuestoPara(mensaje, esEdicion, perfil) {
  const complejidad = complejidadDe(mensaje, esEdicion);
  return { complejidad, reparto: presupuestoDefecto(complejidad, perfil) };
}

// src/lib/prism/forja/cache-multinivel.ts
var NIVEL = {
  respuesta: 1,
  // L1 exact response
  ficha: 2,
  // L2 design sheet
  arquitectura: 3,
  // L3 architectural decision
  patron: 4,
  // L4 visual pattern
  parche: 5,
  // L5 patch
  qa: 6
  // L6 qa result
};
var NOMBRES_NIVEL = {
  1: "L1 respuesta",
  2: "L2 ficha",
  3: "L3 arquitectura",
  4: "L4 patr\xF3n",
  5: "L5 parche",
  6: "L6 QA"
};
function claveRespuesta(args) {
  return `l1:${hashTexto(
    [VERSION_FORJA, args.rol ?? "-", args.modelo ?? "-", String(args.temperatura ?? "-"), args.system, args.user].join("")
  )}`;
}
function claveArquitectura(mensaje, reglas = []) {
  return `l3:${hashTexto([VERSION_FORJA, mensaje, ...reglas].join(""))}`;
}
function clavePatron(tipoProblema, rasgos = []) {
  return `l4:${hashTexto([VERSION_FORJA, tipoProblema, ...rasgos.sort()].join(""))}`;
}
function claveParche(tipoDefecto, contextoHash) {
  return `l5:${hashTexto([VERSION_FORJA, tipoDefecto, contextoHash].join(""))}`;
}
function claveQA(html, versionReglas = VERSION_FORJA) {
  return `l6:${hashTexto([versionReglas, hashTexto(html)].join(""))}`;
}
function crearLru(nivel2, entradas, maxBytes) {
  const mapa = /* @__PURE__ */ new Map();
  const stats = { aciertos: 0, escrituras: 0, expulsiones: 0 };
  return {
    nivel: nivel2,
    obtener(clave2) {
      const v = mapa.get(clave2);
      if (v == null) return null;
      mapa.delete(clave2);
      mapa.set(clave2, v);
      stats.aciertos++;
      return v;
    },
    guardar(clave2, valor) {
      if (valor.length > maxBytes) return;
      if (mapa.has(clave2)) mapa.delete(clave2);
      mapa.set(clave2, valor);
      stats.escrituras++;
      while (mapa.size > entradas) {
        const vieja = mapa.keys().next().value;
        if (vieja == null) break;
        mapa.delete(vieja);
        stats.expulsiones++;
      }
    },
    stats() {
      return { nivel: nivel2, nombre: NOMBRES_NIVEL[nivel2], entradas: mapa.size, ...stats };
    }
  };
}
function crearCacheMultinivel(opts = {}) {
  const entradasDefecto = { 1: 16, 2: 8, 3: 16, 4: 24, 5: 48, 6: 32 };
  const maxBytes = opts.maxBytesValor ?? 5e5;
  const lrus = /* @__PURE__ */ new Map();
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const base = crearLru(n, opts.entradas?.[n] ?? entradasDefecto[n], maxBytes);
    const persistente = opts.persistentes?.[n];
    lrus.set(n, persistente ? cascadea(persistente, base) : base);
  }
  function de(n) {
    return lrus.get(n);
  }
  const resultado = {
    obtener(nivel2, clave2) {
      try {
        return de(nivel2).obtener(clave2);
      } catch {
        return null;
      }
    },
    guardar(nivel2, clave2, valor) {
      try {
        de(nivel2).guardar(clave2, valor);
      } catch {
      }
    },
    obtenerJSON(nivel2, clave2) {
      const s = this.obtener(nivel2, clave2);
      if (s == null) return null;
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    },
    guardarJSON(nivel2, clave2, valor) {
      try {
        this.guardar(nivel2, clave2, JSON.stringify(valor));
      } catch {
      }
    },
    stats() {
      const niveles = [1, 2, 3, 4, 5, 6].map((n) => de(n).stats());
      const aciertos = niveles.reduce((s, n) => s + n.aciertos, 0);
      const escrituras = niveles.reduce((s, n) => s + n.escrituras, 0);
      const detalle = niveles.filter((n) => n.aciertos > 0).map((n) => `${n.nombre}\xD7${n.aciertos}`).join(", ");
      return {
        niveles,
        aciertos,
        escrituras,
        resumen: () => `multinivel: ${aciertos} acierto(s)` + (detalle ? ` (${detalle})` : "")
      };
    },
    comoCacheGeneracion(nivel2) {
      const d = de(nivel2);
      return {
        obtener: (k) => d.obtener(k),
        guardar: (k, v) => d.guardar(k, v),
        stats: () => d.stats()
      };
    }
  };
  return resultado;
}
function cascadea(persistente, base) {
  return {
    obtener(clave2) {
      const vb = base.obtener(clave2);
      if (vb != null) return vb;
      const vp = persistente.obtener(clave2);
      if (vp != null) base.guardar(clave2, vp);
      return vp;
    },
    guardar(clave2, valor) {
      base.guardar(clave2, valor);
      persistente.guardar(clave2, valor);
    },
    stats() {
      return base.stats();
    }
  };
}
var compartido = null;
function cacheMultinivelCompartido(persistente) {
  if (!compartido) {
    compartido = crearCacheMultinivel(
      persistente ? { persistentes: { [NIVEL.respuesta]: persistente, [NIVEL.ficha]: persistente } } : {}
    );
  }
  return compartido;
}
function reiniciarCacheMultinivel() {
  compartido = null;
}

// src/lib/prism/forja/token-roi.ts
function crearLibroROI(previos = []) {
  const registros = [...previos];
  let seq = registros.length;
  return {
    registrar(r) {
      seq++;
      const reg = {
        id: r.id ?? `roi-${seq}`,
        operacion: r.operacion,
        rol: r.rol ?? "-",
        modelo: r.modelo ?? "-",
        tokens: Math.max(0, Math.round(r.tokens || 0)),
        llamadas: Math.max(0, Math.round(r.llamadas || 0)),
        scoreAntes: r.scoreAntes ?? 0,
        scoreDespues: r.scoreDespues ?? 0,
        cuando: r.cuando ?? (/* @__PURE__ */ new Date()).toISOString(),
        deCache: r.deCache ?? false
      };
      registros.push(reg);
      if (registros.length > 2e3) registros.shift();
      return reg;
    },
    roiPorOperacion() {
      const grupos = /* @__PURE__ */ new Map();
      for (const r of registros) {
        const g = grupos.get(r.operacion) ?? [];
        g.push(r);
        grupos.set(r.operacion, g);
      }
      const out = [];
      for (const [op, rs] of grupos) {
        const tokens = rs.reduce((s, r) => s + r.tokens, 0);
        const llamadas = rs.reduce((s, r) => s + r.llamadas, 0);
        const ganancia = rs.reduce((s, r) => s + (r.scoreDespues - r.scoreAntes), 0);
        const cache = rs.filter((r) => r.deCache).length;
        out.push({
          operacion: op,
          registros: rs.length,
          tokensTotales: tokens,
          llamadasTotales: llamadas,
          gananciaMedia: rs.length ? Math.round(ganancia / rs.length * 10) / 10 : 0,
          roi: tokens > 0 ? Math.round(ganancia / tokens * 1e3 * 100) / 100 : ganancia > 0 ? Infinity : 0,
          tasaCache: rs.length ? Math.round(cache / rs.length * 100) : 0
        });
      }
      return out.sort((a, b) => (b.roi === Infinity ? 1 : b.roi) - (a.roi === Infinity ? 1 : a.roi));
    },
    recomendaciones() {
      const out = [];
      const porOp = new Map(this.roiPorOperacion().map((r) => [r.operacion, r]));
      const tot = this.totales();
      const bucle = porOp.get("bucle-mejora");
      if (bucle && bucle.registros >= 2 && bucle.gananciaMedia < 2) {
        out.push({
          accion: "salida temprana: cortar el bucle con umbral suficiente m\xE1s bajo",
          evidencia: `bucle-mejora: ${bucle.registros} iteraciones ganando ${bucle.gananciaMedia} puntos de media por ${bucle.tokensTotales} tokens`,
          ahorroTokens: Math.round(bucle.tokensTotales / Math.max(1, bucle.registros) * 0.6),
          prioridad: "alta"
        });
      }
      const jueces = porOp.get("jueces");
      if (jueces && jueces.gananciaMedia <= 0 && jueces.tokensTotales > 0) {
        out.push({
          accion: "jueces: reducir panel (los jueces 4-5 no cambiaron el resultado)",
          evidencia: `jueces: ${jueces.llamadasTotales} llamadas, ganancia media ${jueces.gananciaMedia}`,
          ahorroTokens: jueces.tokensTotales / 2,
          prioridad: "media"
        });
      }
      const det = porOp.get("parche-det");
      if (det && det.registros > 0) {
        out.push({
          accion: "parches deterministas: mantener el enrutador activo",
          evidencia: `${det.registros} correcci\xF3n(es) mec\xE1nica(s) con 0 tokens`,
          ahorroTokens: det.registros * 6e3,
          prioridad: "baja"
        });
      }
      const tasaCacheGlobal = tot.registros ? tot.deCache / tot.registros : 0;
      if (tot.registros >= 6 && tasaCacheGlobal < 0.1) {
        out.push({
          accion: "cach\xE9: tasa de acierto casi nula \u2014 revisar persistencia del host",
          evidencia: `${tot.deCache}/${tot.registros} operaciones servidas de cach\xE9`,
          ahorroTokens: Math.round(tot.tokens * 0.15),
          prioridad: "media"
        });
      }
      return out.sort((a, b) => b.ahorroTokens - a.ahorroTokens).slice(0, 6);
    },
    totales() {
      const tokens = registros.reduce((s, r) => s + r.tokens, 0);
      const llamadas = registros.reduce((s, r) => s + r.llamadas, 0);
      const ganancia = registros.reduce((s, r) => s + (r.scoreDespues - r.scoreAntes), 0);
      const deCache = registros.filter((r) => r.deCache).length;
      return { tokens, llamadas, ganancia, deCache, registros: registros.length };
    },
    resumen() {
      const t = this.totales();
      const roi = t.tokens > 0 ? Math.round(t.ganancia / t.tokens * 1e3 * 100) / 100 : t.ganancia > 0 ? Infinity : 0;
      return `ROI: ${t.registros} op \xB7 ${t.tokens} tok \xB7 ${t.llamadas} llamadas \xB7 ${t.ganancia > 0 ? "+" : ""}${t.ganancia} puntos \u2192 ${roi === Infinity ? "\u221E" : roi} puntos/1k tok` + (t.deCache ? ` \xB7 ${t.deCache} de cach\xE9` : "");
    }
  };
}
function roiAJSON(registros) {
  return JSON.stringify(registros);
}
function roiDesdeJSON(s) {
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (r) => r && typeof r.operacion === "string" && typeof r.tokens === "number"
    );
  } catch {
    return [];
  }
}

// src/lib/prism/forja/eficiencia.ts
function faseDeRol(rol) {
  switch (rol) {
    case "disenador":
      return "planning";
    case "codificador":
      return "implementation";
    case "revisor":
      return "qa";
    default:
      return "planning";
  }
}
function operacionDeRol(rol, system) {
  const s = (system ?? "").toLowerCase();
  if (/arena|jueces|juez /.test(s)) return "jueces";
  if (/fusi[óo]n|director final/.test(s)) return "fusion";
  if (/direcciones|arquetipos/.test(s)) return "direcciones";
  if (/adn/.test(s) && /define/.test(s)) return "adn";
  if (rol === "codificador") return "codificador";
  if (rol === "revisor") return "revisor";
  if (rol === "disenador") return "ficha";
  return "otra";
}
function estimarTokensSalida(texto) {
  return Math.ceil((texto?.length ?? 0) / 4);
}
function crearLlamadaEficiente(base, opts) {
  const usaL1 = opts.cacheL1 !== false;
  const eficiente = async (args) => {
    try {
      const fase = faseDeRol(args.rol);
      const operacion = operacionDeRol(args.rol, args.system);
      const claveL1 = claveRespuesta({
        system: args.system,
        user: args.user,
        rol: args.rol,
        temperatura: args.temperatura,
        modelo: `${args.providerId}:${args.modelId}`
      });
      if (usaL1) {
        const hit = opts.cache.obtener(NIVEL.respuesta, claveL1);
        if (hit != null) {
          opts.cache.guardar(NIVEL.respuesta, claveL1, hit);
          opts.onCacheHit?.(NIVEL.respuesta, claveL1);
          opts.roi.registrar({
            operacion,
            rol: args.rol ?? "-",
            modelo: `${args.providerId}:${args.modelId}`,
            tokens: 0,
            llamadas: 0,
            scoreAntes: 0,
            scoreDespues: 0,
            deCache: true
          });
          return hit;
        }
      }
      const techo = args.maxTokens ?? MAX_TOKENS_DEFECTO[args.rol ?? "disenador"];
      const estimado = Math.min(techo, opts.presupuesto.estimar(fase, techo));
      const autor = opts.presupuesto.autorizar(fase, estimado);
      if (!autor.ok) {
        opts.onDenegada?.(args.rol ?? "-", autor.motivo);
        return "";
      }
      const salida = await base({
        ...args,
        maxTokens: Math.min(args.maxTokens ?? techo, estimado)
      });
      const tokens = estimarTokensSalida(salida);
      opts.presupuesto.gastar(fase, tokens);
      if (salida && usaL1) {
        opts.cache.guardar(NIVEL.respuesta, claveL1, salida);
      }
      opts.roi.registrar({
        operacion,
        rol: args.rol ?? "-",
        modelo: `${args.providerId}:${args.modelId}`,
        tokens,
        llamadas: salida ? 1 : 0,
        scoreAntes: 0,
        scoreDespues: 0
      });
      return salida;
    } catch {
      return base(args);
    }
  };
  return { llamarModelo: eficiente };
}

// src/lib/prism/forja/compilador-contexto.ts
function normalizarLinea(s) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
var STOPWORDS = /* @__PURE__ */ new Set([
  "de",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "y",
  "o",
  "que",
  "en",
  "a",
  "del",
  "se",
  "por",
  "con",
  "para",
  "es",
  "al",
  "lo",
  "como",
  "mas",
  "m\xE1s",
  "pero",
  "sus",
  "le",
  "ya",
  "fue",
  "this",
  "that",
  "with",
  "from",
  "have",
  "has",
  "the",
  "and",
  "for",
  "are",
  "not",
  "you",
  "all",
  "can",
  "her",
  "was",
  "one",
  "our",
  "out",
  "day",
  "get",
  "uso",
  "usar",
  "usese",
  "\xFAsese",
  "debe",
  "deben",
  "siempre",
  "nunca",
  "todo",
  "toda"
]);
function clavesDe(s) {
  const out = [];
  for (const w of normalizarLinea(s).split(" ")) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out.slice(0, 12);
}
function relevancia(clavesLinea, clavesIntento) {
  if (!clavesLinea.length) return 0;
  let compartidas = 0;
  for (const c of clavesLinea) if (clavesIntento.has(c)) compartidas++;
  return compartidas / clavesLinea.length;
}
var TECHO_DEFECTO = 6e3;
function compilarContexto(e) {
  const techo = Math.max(600, e.techoCaracteres ?? TECHO_DEFECTO);
  const clavesIntento = new Set(
    clavesDe(`${e.mensaje ?? ""} ${e.objetivo ?? ""}`)
  );
  const vistas = /* @__PURE__ */ new Map();
  let lineasEntrada = 0;
  let duplicadas = 0;
  let caracteresSinCompilar = 0;
  const fuentes = [...e.fuentes].sort((a, b) => a.prioridad - b.prioridad);
  for (const f of fuentes) {
    for (const raw of f.lineas ?? []) {
      const linea = String(raw ?? "").replace(/\s+/g, " ").trim();
      if (!linea) continue;
      lineasEntrada++;
      caracteresSinCompilar += linea.length;
      const clave2 = hash(normalizarLinea(linea));
      const previa = vistas.get(clave2);
      if (previa) {
        duplicadas++;
        if (linea.length < previa.largo) {
          previa.linea = linea;
          previa.largo = linea.length;
          previa.tipo = f.tipo;
        }
        continue;
      }
      vistas.set(clave2, {
        linea,
        tipo: f.tipo,
        prioridad: f.prioridad,
        score: relevancia(clavesDe(linea), clavesIntento),
        largo: linea.length
      });
    }
  }
  const orden = [...vistas.values()].sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
    if (Math.abs(a.score - b.score) > 1e-3) return b.score - a.score;
    return a.largo - b.largo;
  });
  const bloques = [];
  let usados = 0;
  let descartadas = 0;
  for (const c of orden) {
    const coste = c.linea.length + 3;
    const esFija = c.prioridad === 0;
    if (!esFija && usados + coste > techo) {
      descartadas++;
      continue;
    }
    usados += coste;
    bloques.push({ tipo: c.tipo, linea: c.linea, score: Math.round(c.score * 100) / 100 });
  }
  const texto = render(bloques);
  return {
    texto,
    bloques,
    stats: {
      lineasEntrada,
      duplicadas,
      descartadas: descartadas + (duplicadas ? 0 : 0),
      lineasFinales: bloques.length,
      caracteresSinCompilar,
      caracteresFinal: texto.length
    }
  };
}
var ORDEN_TIPOS = [
  "fallos-confirmados",
  "objetivo",
  "adn",
  "design-system",
  "reglas-proyecto",
  "reglas-usuario",
  "conocimiento-global",
  "estado",
  "historial"
];
var TITULOS = {
  "fallos-confirmados": "PROHIBICIONES DURAS (fallos confirmados \u2014 incumplir esto rompe la entrega)",
  objetivo: "OBJETIVO DE ESTA PASADA",
  adn: "ADN VISUAL",
  "design-system": "SISTEMA DE DISE\xD1O",
  "reglas-proyecto": "REGLAS DEL PROYECTO",
  "reglas-usuario": "PREFERENCIAS DEL USUARIO",
  "conocimiento-global": "BUENAS PR\xC1CTICAS",
  estado: "ESTADO ACTUAL",
  historial: "DECISIONES PREVIAS"
};
function render(bloques) {
  const grupos = /* @__PURE__ */ new Map();
  for (const b of bloques) {
    const g = grupos.get(b.tipo) ?? [];
    g.push(`- ${b.linea}`);
    grupos.set(b.tipo, g);
  }
  const partes = [];
  for (const t of ORDEN_TIPOS) {
    const g = grupos.get(t);
    if (!g?.length) continue;
    partes.push(`# ${TITULOS[t]}
${g.join("\n")}`);
  }
  return partes.join("\n\n");
}
function resumenContexto(s) {
  const pct3 = s.caracteresSinCompilar ? Math.round((1 - s.caracteresFinal / s.caracteresSinCompilar) * 100) : 0;
  return `contexto ${s.lineasEntrada}\u2192${s.lineasFinales} l\xEDneas (${s.duplicadas} dup) \xB7 ${s.caracteresSinCompilar}\u2192${s.caracteresFinal} car` + (pct3 > 0 ? ` \xB7 ${pct3}% menos` : "");
}

// src/lib/prism/forja/enrutador-determinista.ts
function detectarEnHtml(html) {
  const out = [];
  const add = (p) => void out.push(p);
  if (!/<html[^>]*\slang\s*=/i.test(html)) {
    add({ tipo: "lang", evidencia: "<html> sin atributo lang" });
  }
  if (!/name=["']?viewport/i.test(html)) {
    add({ tipo: "viewport", evidencia: "falta <meta name=viewport>" });
  }
  if (!/<title>[^<]{2,}<\/title>/i.test(html)) {
    add({ tipo: "title", evidencia: "falta o vac\xEDo <title>" });
  }
  if (!/<meta[^>]+charset/i.test(html)) {
    add({ tipo: "charset", evidencia: "falta <meta charset>" });
  }
  const imgSinAlt = html.match(/<img(?![^>]*\salt\s*=)[^>]*>/gi);
  if (imgSinAlt?.length) {
    add({ tipo: "alt", evidencia: `${imgSinAlt.length} <img> sin alt` });
  }
  const blanks = html.match(/<a[^>]*target\s*=\s*["']?_blank[^>]*>/gi) ?? [];
  if (blanks.some((a) => !/noopener|noreferrer/i.test(a))) {
    add({ tipo: "noopener", evidencia: `enlace(s) _blank sin noopener (${blanks.length})` });
  }
  if (/tabindex\s*=\s*["']?[1-9]/i.test(html)) {
    add({ tipo: "tabindex", evidencia: "tabindex positivo detectado" });
  }
  if (/@keyframes/i.test(html) && !/prefers-reduced-motion/i.test(html)) {
    add({ tipo: "reduced-motion", evidencia: "keyframes sin @media prefers-reduced-motion" });
  }
  if (/<body[^>]*\swidth\s*[:=]\s*["']?\s*1[0-9]{3}px/i.test(html) || /<style[^>]*>[\s\S]*?\bbody\s*\{[^}]*\bwidth\s*:\s*1[0-9]{3}px/i.test(html)) {
    add({ tipo: "overflow", evidencia: "body con width fijo ~desktop (scroll horizontal en m\xF3vil)" });
  }
  return out;
}
function parchesDesdeInforme(inf) {
  if (!inf) return [];
  const out = [];
  for (const h of inf.hallazgos) {
    const t = `${h.titulo} ${h.detalle}`.toLowerCase();
    if (/lang/.test(t) && h.severidad !== "mejora") out.push({ tipo: "lang", evidencia: h.titulo });
    else if (/viewport/.test(t)) out.push({ tipo: "viewport", evidencia: h.titulo });
    else if (/sin alt|alt/.test(t) && /img|imagen/.test(t)) out.push({ tipo: "alt", evidencia: h.titulo });
    else if (/noopener|_blank/.test(t)) out.push({ tipo: "noopener", evidencia: h.titulo });
    else if (/aria|label/.test(t)) out.push({ tipo: "aria", evidencia: h.titulo });
    else if (/tabindex/.test(t)) out.push({ tipo: "tabindex", evidencia: h.titulo });
    else if (/overflow|desbord/.test(t)) out.push({ tipo: "overflow", evidencia: h.titulo });
  }
  return out;
}
function detectarParches(html, inf) {
  const vistos = /* @__PURE__ */ new Set();
  const todos = [...detectarEnHtml(html), ...parchesDesdeInforme(inf ?? null)];
  return todos.filter((p) => {
    const k = `${p.tipo}:${p.evidencia}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}
function altGenerico(src) {
  const nombre = (src ?? "").split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "";
  const limpio = nombre.replace(/[-_]+/g, " ").trim();
  return limpio ? limpio.slice(0, 60) : "imagen de la p\xE1gina";
}
var RE_MS_ALTA = /(150|200|300|400|500)ms/;
function parchearHtml(html, candidatos) {
  let h = html;
  const aplicados = [];
  let sinParche = 0;
  for (const p of candidatos) {
    const antes = h;
    try {
      switch (p.tipo) {
        case "lang": {
          if (!/<html[^>]*\slang\s*=/i.test(h)) {
            h = h.replace(/<html(\s[^>]*)?>/i, (m) => m.replace(/>$/, ' lang="es">'));
            if (h === antes && /<html/i.test(html) === false) sinParche++;
          }
          break;
        }
        case "viewport": {
          if (!/name=["']?viewport/i.test(h) && /<head[^>]*>/i.test(h)) {
            h = h.replace(/<head([^>]*)>/i, (m) => `${m}
<meta name="viewport" content="width=device-width, initial-scale=1">`);
          }
          break;
        }
        case "charset": {
          if (!/<meta[^>]+charset/i.test(h) && /<head[^>]*>/i.test(h)) {
            h = h.replace(/<head([^>]*)>/i, (m) => `${m}
<meta charset="utf-8">`);
          }
          break;
        }
        case "title": {
          if (!/<title>[^<]{2,}<\/title>/i.test(h)) {
            if (/<title>[^<]*<\/title>/i.test(h)) {
              h = h.replace(/<title>[^<]*<\/title>/i, "<title>P\xE1gina</title>");
            } else if (/<head[^>]*>/i.test(h)) {
              h = h.replace(/<head([^>]*)>/i, (m) => `${m}
<title>P\xE1gina</title>`);
            }
          }
          break;
        }
        case "alt": {
          h = h.replace(/<img((?:(?!alt\s*=)[^>])*)>/gi, (m, attrs) => {
            const src = attrs.match(/\ssrc\s*=\s*["']?([^"'\s>]+)/i)?.[1];
            return `<img${attrs} alt="${altGenerico(src)}">`;
          });
          break;
        }
        case "noopener": {
          h = h.replace(/<a([^>]*)target\s*=\s*["']?_blank([^>]*)>/gi, (m, a, b) => {
            if (/noopener|noreferrer/i.test(m)) return m;
            const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(a + b);
            if (rel) {
              return m.replace(rel[0], rel[0].replace(/rel\s*=\s*["']([^"']*)["']/i, (_r, r) => `rel="${r} noopener noreferrer"`));
            }
            return `<a${a}target="_blank" rel="noopener noreferrer"${b}>`;
          });
          break;
        }
        case "tabindex": {
          h = h.replace(/\stabindex\s*=\s*["']?[1-9][^"'\s>]*["']?/gi, "");
          break;
        }
        case "reduced-motion": {
          if (/@keyframes/i.test(h) && !/prefers-reduced-motion/i.test(h)) {
            const bloque = "\n@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}";
            if (/<\/style>/i.test(h)) h = h.replace(/<\/style>/i, `${bloque}
</style>`);
            else if (/<\/head>/i.test(h)) h = h.replace(/<\/head>/i, `<style>${bloque}
</style>
</head>`);
          }
          break;
        }
        case "overflow": {
          h = h.replace(/(\bbody\s*\{[^}]*?)\bwidth\s*:\s*1[0-9]{3}px/gi, "$1max-width:100%");
          h = h.replace(/(<body[^>]*\s?)width(\s*[:=]\s*["']?\s*)1[0-9]{3}px/gi, "$1min-width$2100%");
          break;
        }
        default:
          sinParche++;
          continue;
      }
      if (h !== antes) {
        aplicados.push(p);
      } else {
        sinParche++;
      }
    } catch {
      sinParche++;
    }
  }
  void RE_MS_ALTA;
  return { html: h, parches: aplicados, sinParche };
}
function ahorroEstimado(parches) {
  const llamadas = parches.length ? 2 : 0;
  return { llamadasEvitadas: llamadas, tokensEvitados: parches.length ? 6e3 : 0 };
}

// src/lib/prism/forja/salida-temprana.ts
var UMBRALES_DEFECTO = {
  pleno: 92,
  suficiente: 84,
  minimo: 70
};
function esSuficientementeBueno(informe, iteracionesUsadas, u = UMBRALES_DEFECTO) {
  const score = scoreDe(informe);
  if (informe.veredicto === "PASS" && informe.criticos === 0 && informe.avisos === 0 && score >= u.pleno) return true;
  if (iteracionesUsadas >= 1 && informe.criticos === 0 && score >= u.suficiente) return true;
  return false;
}
function decidirSiguientePaso(informe, iteracionesUsadas, maxIteraciones, html, u = UMBRALES_DEFECTO) {
  const score = scoreDe(informe);
  if (esSuficientementeBueno(informe, iteracionesUsadas, u)) {
    return { tipo: "parar", motivo: `score ${score} \u2265 umbral con ${iteracionesUsadas} iter.: suficiente` };
  }
  if (iteracionesUsadas >= maxIteraciones) {
    return { tipo: "parar", motivo: `tope de ${maxIteraciones} iteraciones alcanzado` };
  }
  const candidatos = detectarParches(html, informe);
  if (candidatos.length > 0) {
    const r = parchearHtml(html, candidatos);
    if (r.parches.length > 0) {
      return {
        tipo: "parche-determinista",
        parches: r.parches,
        html: r.html,
        motivo: `${r.parches.length} parche(s) sin LLM: ${r.parches.map((p) => p.tipo).join(", ")}`
      };
    }
  }
  if (score >= u.minimo && informe.criticos === 0) {
    return { tipo: "parar", motivo: `score ${score} con 0 cr\xEDticos: regenerar arriesga m\xE1s de lo que gana` };
  }
  return { tipo: "llm", motivo: `score ${score} (< ${u.minimo}) o con cr\xEDticos: correcci\xF3n con modelo` };
}
function resumenTemprana(iteracionesUsadas, maxIteraciones, decisiones) {
  const evitadas = Math.max(0, maxIteraciones - iteracionesUsadas);
  const parches = decisiones.filter((d) => d.tipo === "parche-determinista").length;
  const partes = [];
  if (evitadas > 0) partes.push(`${evitadas} iteraci\xF3n(es) ahorrada(s) de ${maxIteraciones}`);
  if (parches) partes.push(`${parches} correcci\xF3n(es) sin LLM`);
  return partes.length ? `salida temprana: ${partes.join(" \xB7 ")}` : "salida temprana: sin ahorro esta vez";
}

// src/lib/prism/forja/experience-bias.ts
function senalesHtml(html) {
  const h = html || "";
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const texto = h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ");
  const textoLen = texto.replace(/\s+/g, " ").trim().length;
  const totalLen = Math.max(1, h.length);
  const parrafos = [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  const enParrafos = parrafos.join(" ").length;
  const textDensity = clamp(enParrafos / Math.max(1, totalLen * 0.18));
  const largos = parrafos.filter((p) => p.length > 240).length;
  const largeTextBlocks = clamp(largos / 4);
  const imgs = (h.match(/<img\b/gi) ?? []).length;
  const figure = (h.match(/<figure|class="[^"]*(media|photo|imagen)[^"]*"/gi) ?? []).length;
  const imageRectangles = clamp((imgs + figure) / 10);
  const articulo = /<article\b|<main\b/i.test(h) ? 0.4 : 0;
  const columnasUnicas = /max-width:\s*(600|620|640|660|680|700|720)px/i.test(h) ? 0.4 : 0;
  const readingFlow = clamp(articulo + columnasUnicas + (largos > 2 ? 0.2 : 0));
  const sectionCount = clamp((h.match(/<section\b/gi) ?? []).length / 6);
  const anims = (h.match(/@keyframes\b/gi) ?? []).length + (h.match(/transition\s*:/gi) ?? []).length + (h.match(/animation\s*:/gi) ?? []).length;
  const motion = clamp(anims / 12);
  const depthHits = (h.match(/translateZ|perspective\s*:|preserve-3d|parallax/gi) ?? []).length;
  const depth = clamp(depthHits / 6);
  const threeD = clamp((h.match(/preserve-3d|transform-style\s*:\s*3d|rotate3d|rotate[XYZ]/gi) ?? []).length / 4);
  const floats = (h.match(/position\s*:\s*(absolute|fixed)/gi) ?? []).length + (h.match(/shadow-floating|--shadow-deep|box-shadow\s*:[^;]{20,}/gi) ?? []).length;
  const floatingElements = clamp(floats / 8);
  const hovers = (h.match(/:hover[^{]*\{[^}]*(transform|box-shadow|filter|background)/gi) ?? []).length;
  const interactiveSurfaces = clamp(hovers / 6);
  const cardInteraction = clamp((h.match(/<button|role="button"|tabindex="[0-9]"/gi) ?? []).length / 8);
  return { textDensity, largeTextBlocks, imageRectangles, readingFlow, sectionCount, cardInteraction, motion, depth, threeD, floatingElements, interactiveSurfaces };
}
function scoreEditorial(s) {
  const positivo = (s.textDensity * 0.25 + s.readingFlow * 0.2 + s.imageRectangles * 0.15) / 0.6;
  const raw = positivo - s.motion * 0.1 - s.depth * 0.1 - s.cardInteraction * 0.1 - s.threeD * 0.1;
  return Math.max(0, Math.min(1, raw));
}
var UMBRAL_EDITORIAL = 0.62;
function medirExperiencia(html) {
  const s = senalesHtml(html);
  const edit = scoreEditorial(s);
  return {
    editorial: edit,
    spatial: Math.max(0, Math.min(1, s.depth * 0.6 + s.threeD * 0.25 + s.floatingElements * 0.15)),
    motion: s.motion,
    interaction: Math.max(s.interactiveSurfaces, s.cardInteraction * 0.8),
    depth: s.depth,
    componentRichness: Math.max(0, Math.min(1, new Set((html.match(/class="[^"]{3,40}"/gi) ?? []).map((c) => c.slice(7, -1).split(/\s+/)[0])).size / 22)),
    visualNovelty: Math.max(0, Math.min(1, 1 - edit))
  };
}
function desviacionDeDna(m, e) {
  const pares = [
    { dimension: "spatial", esperado: e.spatial.depth, observado: m.spatial },
    { dimension: "motion", esperado: e.motion.intensity, observado: m.motion },
    { dimension: "interaction", esperado: e.interaction.richness, observado: m.interaction }
  ];
  const desalineados = pares.filter((p) => Math.abs(p.esperado - p.observado) > 0.35);
  const desviacion = Math.max(0, Math.min(1, desalineados.reduce((acc, p) => acc + Math.abs(p.esperado - p.observado), 0) / 3));
  const editorialAlta = m.editorial > UMBRAL_EDITORIAL && e.spatial.depth > 0.4;
  const resumen = editorialAlta ? `sesgo editorial alto (${Math.round(m.editorial * 100)}%) con ADN de profundidad: la p\xE1gina volvi\xF3 a la revista` : desviacion > 0.35 ? `experiencia desviada del ADN (${desalineados.map((d) => `${d.dimension} ${Math.round(d.esperado * 100)}%\u2192${Math.round(d.observado * 100)}%`).join(", ")})` : `experiencia coherente con el ADN (editorial ${Math.round(m.editorial * 100)}%, desviaci\xF3n ${Math.round(desviacion * 100)}%)`;
  return { desviacion, desalineados, resumen };
}
function resumenMetricas(m) {
  const p = (n) => `${Math.round(n * 100)}%`;
  return `editorial ${p(m.editorial)} \xB7 spatial ${p(m.spatial)} \xB7 motion ${p(m.motion)} \xB7 interacci\xF3n ${p(m.interaction)} \xB7 depth ${p(m.depth)} \xB7 riqueza ${p(m.componentRichness)} \xB7 novedad ${p(m.visualNovelty)}`;
}

// src/lib/prism/forja/experience-qa.ts
function auditarExperiencia(html, e) {
  const out = [];
  const h = html || "";
  if (!h.trim()) return out;
  const m = medirExperiencia(h);
  if (m.editorial > UMBRAL_EDITORIAL && e.spatial.depth > 0.4) {
    out.push({
      chequeo: "editorial-bias",
      nivel: m.editorial > 0.78 ? "critico" : "aviso",
      evidencia: `editorial ${Math.round(m.editorial * 100)}% (umbral ${Math.round(UMBRAL_EDITORIAL * 100)}%) con ADN de profundidad ${Math.round(e.spatial.depth * 100)}%`,
      correccion: "cambiar la composici\xF3n del hero, introducir objeto focal, convertir cards est\xE1ticas en flotantes y agregar profundidad SIN tocar el contenido"
    });
  }
  const tiene3d = /perspective|translateZ|preserve-3d/i.test(h);
  if (e.spatial.depth >= 0.6 && !tiene3d) {
    out.push({
      chequeo: "spatial-coherence",
      nivel: "aviso",
      evidencia: `ADN pide profundidad ${Math.round(e.spatial.depth * 100)}% y modo ${e.spatial.mode}, pero el HTML no declara perspective/translateZ`,
      correccion: "aplicar los tokens --depth-*/--perspective a objeto focal y cards flotantes"
    });
  }
  const anims = (h.match(/@keyframes/gi) ?? []).length + (h.match(/transition\s*:/gi) ?? []).length;
  if (e.motion.intensity >= 0.6 && anims < 3) {
    out.push({
      chequeo: "motion-coherence",
      nivel: "aviso",
      evidencia: `intensidad de movimiento ${Math.round(e.motion.intensity * 100)}% pero solo ${anims} animaci\xF3n(es)/transici\xF3n(es)`,
      correccion: "activar el MOTION PLAN: reveal al scroll con stagger y flotaci\xF3n ambiente del objeto"
    });
  }
  if (e.motion.intensity <= 0.2 && anims > 8) {
    out.push({
      chequeo: "motion-coherence",
      nivel: "info",
      evidencia: `ADN pide movimiento m\xEDnimo (${Math.round(e.motion.intensity * 100)}%) pero hay ${anims} animaciones`,
      correccion: "reducir a feedback y foco: el movimiento de m\xE1s roba tokens y foco"
    });
  }
  if (e.spatial.layers >= 5 && !/position\s*:\s*(absolute|fixed)/i.test(h)) {
    out.push({
      chequeo: "depth-coherence",
      nivel: "aviso",
      evidencia: `plan de ${e.spatial.layers} capas pero sin elementos posicionados: todo est\xE1 apilado en flujo`,
      correccion: "dar posici\xF3n y translateZ a objeto, cards y capa de fondo seg\xFAn el SPATIAL PLAN"
    });
  }
  const hovers = (h.match(/:hover/gi) ?? []).length;
  if (e.interaction.richness >= 0.7 && hovers < 2) {
    out.push({
      chequeo: "interaction-richness",
      nivel: "aviso",
      evidencia: `riqueza de interacci\xF3n ${Math.round(e.interaction.richness * 100)}% pero ${hovers} reglas :hover`,
      correccion: "estados hover/focus/active en todo lo clicable; tilt/magnetic seg\xFAn el ADN"
    });
  }
  const heroPorDefecto = /<h1[^>]*>[^<]{4,}<\/h1>/i.test(h) && /text-align\s*:\s*center/i.test(h) && !/translateZ|perspective|<img|<video|canvas/i.test(h.slice(0, Math.max(1, h.search(/<section\b/i)) + 900));
  if (heroPorDefecto) {
    out.push({
      chequeo: "hero-quality",
      nivel: "aviso",
      evidencia: "hero por defecto: h1 centrado + p\xE1rrafo + bot\xF3n, sin objeto ni profundidad",
      correccion: "recomponer el hero seg\xFAn el tipo decidido (texto+objeto, texto+UI flotante, escena\u2026)"
    });
  }
  const radios = new Set((h.match(/border(?:-radius)?\s*:\s*[^;\n]*?(\d{1,3})px/gi) ?? []).map((x) => x.replace(/\D+/g, (n) => n)));
  if (radios.size > 4) {
    out.push({
      chequeo: "surface-consistency",
      nivel: "info",
      evidencia: `${radios.size} valores de radio distintos (${[...radios].slice(0, 6).join(", ")}px): superficies sin sistema`,
      correccion: "unificar con los tokens --radius-sm\u2026--radius-2xl"
    });
  }
  const medias = (h.match(/@media/gi) ?? []).length;
  if (medias === 0 && h.length > 1500) {
    out.push({
      chequeo: "responsive-experience",
      nivel: "aviso",
      evidencia: "sin @media: el plan responsivo de experiencia no est\xE1 aplicado",
      correccion: "aplicar el RESPONSIVE EXPERIENCE PLAN (mantiene/reduce/reordena/elimina/transforma)"
    });
  }
  return out;
}
var MARCA_CSS = "/* FORJA \xB7 QA de experiencia (patch-first \xA722) */";
var MARCA_JS = "/* FORJA \xB7 QA de experiencia: activaci\xF3n de clases (capada) */";
function tieneCssForja(h) {
  return h.includes(MARCA_CSS);
}
function inyectarCss(html, css) {
  const bloque = `
<style id="forja-qa-exp">
${MARCA_CSS}
${css}
</style>`;
  if (tieneCssForja(html)) {
    const re = /<style id="forja-qa-exp">[\s\S]*?<\/style>/i;
    return re.test(html) ? html.replace(re, bloque) : `${html}${bloque}`;
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${bloque}
</head>`);
  return `${html}${bloque}`;
}
function inyectarScript(html, js) {
  const bloque = `
<script id="forja-qa-exp-js">
${MARCA_JS}
(function(){
"use strict";
try{
${js}
}catch(e){}
})();
<\/script>`;
  const re = /<script id="forja-qa-exp-js">[\s\S]*?<\/script>/i;
  if (re.test(html)) return html.replace(re, bloque);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${bloque}
</body>`);
  return `${html}${bloque}`;
}
function parchesExperiencia(html, hallazgos, e, planMovimiento, planEspacial) {
  let h = html || "";
  const parches = [];
  const pendientes = new Set(hallazgos.map((x) => x.chequeo));
  const necesita = (t) => pendientes.has(t);
  const cssTokens = tokensExperienciaCss(e);
  if (cssTokens && !/--depth-1/.test(h)) {
    const h2 = inyectarCss(h, cssTokens);
    if (h2 !== h) {
      pendientes.delete("surface-consistency");
      parches.push({ tipo: "tokens-experiencia", evidencia: ":root con --radius/--depth/--motion/--shadow/--surface desde el ADN" });
      h = h2;
    }
  }
  if ((necesita("spatial-coherence") || necesita("depth-coherence") || necesita("editorial-bias")) && e.spatial.depth >= 0.5) {
    const escenario = cssEscenario(planEspacial ?? { depth: e.spatial.depth, perspective: e.spatial.perspective, layers: [] });
    const cssProf = [
      escenario,
      `@media (prefers-reduced-motion: no-preference) {`,
      `  .forja-capa-1 { transform: translateZ(var(--depth-1)); } .forja-capa-2 { transform: translateZ(var(--depth-2)); }`,
      `  .forja-capa-3 { transform: translateZ(var(--depth-3)); } .forja-capa-4 { transform: translateZ(var(--depth-4)); }`,
      `  .forja-escena { perspective: var(--perspective); transform-style: preserve-3d; }`,
      `}`
    ].filter(Boolean).join("\n");
    const h2 = inyectarCss(h, cssProf);
    if (h2 !== h) {
      h = h2;
      parches.push({ tipo: "profundidad", evidencia: `escena con perspective y utilidades de profundidad (ADN ${Math.round(e.spatial.depth * 100)}%)` });
      pendientes.delete("spatial-coherence");
      pendientes.delete("depth-coherence");
    }
  }
  const js = [];
  if (necesita("editorial-bias") || necesita("hero-quality")) {
    js.push(
      `var secciones=document.querySelectorAll("section, main > div");`,
      `var n=Math.min(secciones.length,1);`,
      `if(n){var s0=secciones[0];s0.classList.add("forja-escena","forja-hero-ajustado");`,
      `var hijos=s0.querySelectorAll("h1, h2, img, figure, .card, [class*=card]");`,
      `for(var i=0;i<Math.min(hijos.length,6);i++){var el=hijos[i];el.classList.add(i%2?"forja-capa-2":"forja-capa-3");}}`
    );
    parches.push({ tipo: "hero-composicion", evidencia: "hero recomputado como escena: piezas del hero a profundidades distintas (contenido intacto)" });
    pendientes.delete("hero-quality");
  }
  if (necesita("editorial-bias")) {
    js.push(
      `var cards=document.querySelectorAll("[class*=card], article, li");`,
      `var c=0;`,
      `for(var i=0;i<cards.length&&c<10;i++){var el=cards[i];var r=el.getBoundingClientRect&&el.getBoundingClientRect();`,
      `if(r&&r.width>140&&r.height>90){el.classList.add("forja-flotante");c++;}}`
    );
    parches.push({ tipo: "cards-flotantes", evidencia: "hasta 10 cajas grandes convertidas en superficies flotantes (elevaci\xF3n del ADN)" });
    pendientes.delete("editorial-bias");
  }
  if (necesita("motion-coherence") && e.motion.intensity >= 0.6) {
    js.push(
      `var objetivo=document.querySelectorAll("section, .card, [class*=card], img, figure");`,
      `for(var i=0;i<Math.min(objetivo.length,14);i++){var el=objetivo[i];if(!el.classList.contains("reveal"))el.classList.add("reveal");el.style.setProperty("--i",String(i%6));}`
    );
    parches.push({ tipo: "scroll-reveal", evidencia: "clases reveal + stagger capadas a 14 piezas con timing del MOTION PLAN" });
    pendientes.delete("motion-coherence");
  }
  if (js.length) {
    const h2 = inyectarScript(h, js.join("\n"));
    if (h2 !== h) h = h2;
  }
  const cssExtra = [
    planMovimiento ? cssMovimiento(planMovimiento) : "",
    parches.some((p) => p.tipo === "cards-flotantes") ? `@media (prefers-reduced-motion: no-preference) {
  .forja-flotante { transform: translateZ(var(--depth-2)); box-shadow: var(--surface-floating); transition: transform var(--motion-medium) var(--ease-out); }
  .forja-flotante:hover { transform: translateZ(var(--depth-3)); }
}` : "",
    parches.some((p) => p.tipo === "hero-composicion") ? `.forja-hero-ajustado h1 { text-align: left; max-width: 14ch; font-size: clamp(2.4rem, 7vw, 5.5rem); line-height: 1.02; letter-spacing: -0.02em; }
.forja-hero-ajustado { display: grid; gap: 24px; align-items: center; }` : ""
  ].filter(Boolean).join("\n");
  if (cssExtra) {
    const h2 = inyectarCss(h, cssExtra);
    if (h2 !== h) h = h2;
  }
  return {
    html: h,
    parches,
    sinParche: hallazgos.filter((x) => pendientes.has(x.chequeo))
  };
}
function resumenQaExperiencia(hallazgos, parches) {
  if (!hallazgos.length && !parches.length) return "QA experiencia: sin hallazgos";
  const partes = [`${hallazgos.length} hallazgo(s)`, ...parches.map((p) => `parche ${p.tipo}`)];
  return `QA experiencia: ${partes.join(" \xB7 ")}`;
}
function medirTrasParche(html) {
  return medirExperiencia(html);
}

// src/lib/prism/forja/motion-qa-medido.ts
function dentroDeEscala(ms) {
  if (ms >= 150 && ms <= 1600) return true;
  return false;
}
function clasificar(ms, esAnimacion, contextoHover) {
  if (contextoHover && ms <= 400) return "microinteraccion";
  if (ms <= 300) return "microinteraccion";
  if (ms <= 600) return "componente";
  if (ms <= 1e3) return "reveal";
  return "escena";
}
function reglasDe(html) {
  const out = [];
  const bloques = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? "");
  const fuentes = bloques.length ? bloques : [html];
  for (const css of fuentes) procesarCss(css, out);
  return out;
}
function procesarCss(css, out) {
  const sinMedia = css.replace(/@media([^{}]*)\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_m, cond, cuerpo) => {
    const etiqueta = cond.trim();
    for (const m of cuerpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = (m[1] ?? "").trim();
      const c = (m[2] ?? "").trim();
      if (!selector || !c) continue;
      out.push({ selector: selector.slice(0, 80), cuerpo: c, media: etiqueta });
    }
    return "";
  });
  for (const m of sinMedia.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? "").trim();
    const cuerpo = (m[2] ?? "").trim();
    if (!cuerpo || !selector || selector.includes("@keyframes") || selector.startsWith("to") || /^\d+%$/.test(selector)) continue;
    out.push({ selector: selector.slice(0, 80), cuerpo, media: "" });
  }
}
function medirMovimiento(html) {
  const h = html || "";
  const reglas = reglasDe(h);
  const duraciones = [];
  let totalAnimaciones = 0;
  let totalTransiciones = 0;
  let infinitas = 0;
  const overrides = /* @__PURE__ */ new Map();
  for (const r of reglas) {
    if (/prefers-reduced-motion\s*:\s*reduce/i.test(r.media)) continue;
    for (const m of r.cuerpo.matchAll(/(animation|transition)-duration\s*:\s*([\d.]+m?s)\s*!important/gi)) {
      const ms = extraerTodasDuraciones(m[2] ?? "")[0];
      if (ms == null) continue;
      const prev = overrides.get(r.selector) ?? {};
      if ((m[1] ?? "").toLowerCase() === "animation") prev.anim = ms;
      else prev.trans = ms;
      overrides.set(r.selector, prev);
    }
  }
  for (const r of reglas) {
    const esReduced = /prefers-reduced-motion\s*:\s*reduce/i.test(r.media);
    const contextoHover = /(:hover|:focus|:active)/i.test(r.selector);
    for (const m of r.cuerpo.matchAll(/animation(?:-duration)?\s*:\s*([^;]+)/gi)) {
      const decl = (m[0] ?? "").trim();
      const val = (m[1] ?? "").trim();
      if (esReduced) continue;
      const esInfinita = /infinite/i.test(val);
      let dur = extraerPrimeraDuracion(val);
      totalAnimaciones += 1;
      if (esInfinita) infinitas += 1;
      if (dur == null) continue;
      const ov = overrides.get(r.selector);
      if (ov?.anim != null && ov.anim !== dur) dur = ov.anim;
      duraciones.push({
        ms: dur,
        categoria: esInfinita ? "ambiente" : clasificar(dur, true, contextoHover),
        declaracion: decl.slice(0, 90),
        selector: r.selector.slice(0, 60),
        dentroEscala: esInfinita ? true : dentroDeEscala(dur),
        ambiente: esInfinita
      });
    }
    for (const m of r.cuerpo.matchAll(/transition(?:-duration)?\s*:\s*([^;]+)/gi)) {
      const decl = (m[0] ?? "").trim();
      const val = (m[1] ?? "").trim();
      if (esReduced) continue;
      const durs = extraerTodasDuraciones(val);
      totalTransiciones += 1;
      const ov = overrides.get(r.selector);
      for (const durOrig of durs) {
        const dur = ov?.trans != null && ov.trans !== durOrig ? ov.trans : durOrig;
        duraciones.push({
          ms: dur,
          categoria: clasificar(dur, false, contextoHover),
          declaracion: decl.slice(0, 90),
          selector: r.selector.slice(0, 60),
          dentroEscala: dentroDeEscala(dur),
          ambiente: false
        });
      }
    }
  }
  const staggerDetectado = /(?:transition|animation)-delay\s*:[^;]*(?:calc\(|var\(|,\s*\d|(?:\.\d+|[1-9]\d*)m?s)/i.test(h);
  const guardMatch = /@media[^{]*prefers-reduced-motion\s*:\s*reduce[^{]*\{([\s\S]*?)\n?\}/i.exec(h);
  const guardCuerpo = guardMatch?.[1] ?? "";
  const reducedMotionGuard = /prefers-reduced-motion\s*:\s*reduce/i.test(h) && /(animation(?:-duration)?|transition(?:-duration)?)\s*:\s*[^;]*\.0?0?1?m?s|animation\s*:\s*none|transition\s*:\s*none/i.test(guardCuerpo);
  const hallazgos = [];
  const fuera = duraciones.filter((d) => !d.dentroEscala);
  if (fuera.length) {
    const muestra = fuera.slice(0, 3).map((d) => `${d.ms}ms (${d.selector})`).join(", ");
    hallazgos.push({
      chequeo: "escala-tiempos",
      nivel: fuera.length > 3 ? "aviso" : "info",
      evidencia: `${fuera.length} duraci\xF3n(es) fuera de la escala \xA79 (150-1600ms): ${muestra}`,
      correccion: "normalizar a la categor\xEDa m\xE1s cercana (micro 150-300 \xB7 componente 250-600 \xB7 reveal 500-1000 \xB7 escena 800-1600ms)"
    });
  }
  const necesitaGuard = infinitas > 0 || duraciones.length > 0;
  if (necesitaGuard && !reducedMotionGuard) {
    hallazgos.push({
      chequeo: "reduced-motion-guard",
      nivel: "critico",
      evidencia: `${infinitas} animaci\xF3n(es) infinite y ${duraciones.length} duraci\xF3n(es) sin @media (prefers-reduced-motion: reduce) que las apague`,
      correccion: "inyectar la guardia: animation/transition a .01ms e iteration-count 1 en reduce"
    });
  }
  if (infinitas > 0 && !reducedMotionGuard) {
    hallazgos.push({
      chequeo: "ambiente-sin-guardia",
      nivel: "aviso",
      evidencia: `${infinitas} animaci\xF3n(es) ambiente(s) (infinite) sin guardia de reduced-motion`,
      correccion: "la guardia reduce/elimina las ambientales: mismo parche que reduced-motion-guard"
    });
  }
  const base = duraciones.length ? duraciones.filter((d) => d.dentroEscala).length / duraciones.length : 1;
  const score = Math.round(Math.max(0, Math.min(1, base - (reducedMotionGuard ? 0 : 0.2))) * 100);
  const resumen = [
    `${totalAnimaciones} animaci\xF3n(es) \xB7 ${totalTransiciones} transici\xF3n(es) \xB7 ${infinitas} ambiente(s)`,
    `${duraciones.length - fuera.length}/${duraciones.length || 0} duraciones en escala \xA79`,
    `stagger ${staggerDetectado ? "presente" : "ausente"} \xB7 reduced-motion ${reducedMotionGuard ? "OK" : "FALTA"}`,
    `score ${score}/100`
  ].join(" \xB7 ");
  return {
    duraciones: duraciones.slice(0, 40),
    totalAnimaciones,
    totalTransiciones,
    infinitas,
    staggerDetectado,
    reducedMotionGuard,
    hallazgos,
    score,
    resumen
  };
}
function extraerPrimeraDuracion(val) {
  const durs = extraerTodasDuraciones(val);
  return durs.length ? durs[0] : null;
}
function extraerTodasDuraciones(val) {
  const out = [];
  for (const m of val.matchAll(/(\d*\.?\d+)(m?s)\b/gi)) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    out.push(m[2]?.toLowerCase() === "s" ? Math.round(n * 1e3) : Math.round(n));
  }
  return out;
}
var MARCA_CSS_MOTION = "/* FORJA \xB7 Motion QA medido (v4.6) */";
var MARCA_JS_MOTION = "/* FORJA \xB7 Motion QA: utilidades de stagger (capadas) */";
function inyectarCssMotion(html, css) {
  const bloque = `
<style id="forja-motion-qa">
${MARCA_CSS_MOTION}
${css}
</style>`;
  const re = /<style id="forja-motion-qa">[\s\S]*?<\/style>/i;
  if (re.test(html)) return html.replace(re, bloque);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${bloque}
</head>`);
  return `${html}${bloque}`;
}
function inyectarScriptMotion(html, js) {
  const bloque = `
<script id="forja-motion-qa-js">
${MARCA_JS_MOTION}
(function(){
${js}
})();
<\/script>`;
  const re = /<script id="forja-motion-qa-js">[\s\S]*?<\/script>/i;
  if (re.test(html)) return html.replace(re, bloque);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${bloque}
</body>`);
  return `${html}${bloque}`;
}
function guardReducedMotion() {
  return [
    `@media (prefers-reduced-motion: reduce) {`,
    `  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }`,
    `}`
  ].join("\n");
}
function normalizarDuracion(ms) {
  if (ms < 150) return ms < 80 ? 150 : Math.max(150, Math.round(ms / 10) * 10);
  if (ms > 1600) return ms > 4e3 ? 900 : 900;
  return ms;
}
function parchesMovimiento(html, informe, planMovimiento) {
  let h = html || "";
  const parches = [];
  const pendientes = new Set(informe.hallazgos.map((x) => x.chequeo));
  const cssBloques = [];
  let jsPendiente = "";
  if (pendientes.has("reduced-motion-guard") || pendientes.has("ambiente-sin-guardia")) {
    cssBloques.push(guardReducedMotion());
    parches.push({ tipo: "reduced-motion-guard", evidencia: "guardia inyectada: todo animation/transition a .01ms con reduce" });
    pendientes.delete("reduced-motion-guard");
    pendientes.delete("ambiente-sin-guardia");
  }
  const fuera = informe.duraciones.filter((d) => !d.dentroEscala && !d.ambiente);
  if (fuera.length && pendientes.has("escala-tiempos")) {
    const vistos = /* @__PURE__ */ new Set();
    const reglasOverride = [];
    for (const d of fuera) {
      if (reglasOverride.length >= 8) break;
      const clave2 = `${d.selector}|${d.declaracion}`;
      if (vistos.has(clave2)) continue;
      vistos.add(clave2);
      const esAnim = /animation/i.test(d.declaracion);
      const nuevo = normalizarDuracion(d.ms);
      reglasOverride.push(`  ${d.selector} { ${esAnim ? "animation-duration" : "transition-duration"}: ${nuevo}ms !important; }`);
    }
    if (reglasOverride.length) {
      cssBloques.push(
        [`@media (prefers-reduced-motion: no-preference) {`, ...reglasOverride, `}`].join("\n")
      );
      parches.push({ tipo: "normalizar-duraciones", evidencia: `${reglasOverride.length} duraci\xF3n(es) fuera de la escala \xA79 normalizadas con overrides capados` });
      pendientes.delete("escala-tiempos");
    }
  }
  const staggerPedido = planMovimiento ? planMovimiento.primitivas.includes("stagger") : false;
  if (staggerPedido && !informe.staggerDetectado && !/forja-stagger/i.test(h)) {
    cssBloques.push([
      `@media (prefers-reduced-motion: no-preference) {`,
      `  .forja-stagger > * { transition-delay: calc(var(--i, 0) * 80ms); animation-delay: calc(var(--i, 0) * 80ms); }`,
      `}`
    ].join("\n"));
    jsPendiente = [
      `"use strict";`,
      `try {`,
      `  var grupos = document.querySelectorAll("[class*=grid], [class*=cards], [class*=lista], ul");`,
      `  var n = 0;`,
      `  for (var i = 0; i < grupos.length && n < 3; i++) {`,
      `    var hijos = grupos[i].children;`,
      `    if (hijos.length > 1) { grupos[i].classList.add("forja-stagger");`,
      `      for (var j = 0; j < Math.min(hijos.length, 10); j++) hijos[j].style.setProperty("--i", String(j)); n++; }`,
      `  }`,
      `} catch (e) {}`
    ].join("\n");
    parches.push({ tipo: "stagger-utilidad", evidencia: "stagger pedido por el MOTION PLAN: utilidad .forja-stagger aplicada a m\xE1x 3 grupos" });
    pendientes.delete("stagger-ausente");
  }
  if (cssBloques.length) {
    const h2 = inyectarCssMotion(h, cssBloques.join("\n\n"));
    if (h2 !== h) h = h2;
  }
  if (jsPendiente) {
    const h3 = inyectarScriptMotion(h, jsPendiente);
    if (h3 !== h) h = h3;
  }
  const informeFinal = medirMovimiento(h);
  return {
    html: h,
    parches,
    sinParche: informe.hallazgos.filter((x) => pendientes.has(x.chequeo)),
    informe: informeFinal
  };
}
function resumenMovimiento(i) {
  if (!i.totalAnimaciones && !i.totalTransiciones) return "Motion QA: sin movimiento que medir";
  const partes = [`Motion QA ${i.score}/100`, i.resumen];
  if (i.hallazgos.length) partes.push(`hallazgos: ${i.hallazgos.map((h) => `${h.chequeo}(${h.nivel})`).join(", ")}`);
  return partes.join(" \xB7 ");
}
function auditarYparchearMovimiento(html, planMovimiento) {
  const informe = medirMovimiento(html);
  if (!informe.hallazgos.length) return { html, parches: [], sinParche: [], informe };
  return parchesMovimiento(html, informe, planMovimiento);
}

// src/lib/prism/forja/qa-detalle.ts
var RX_ESTADOS = [
  [":hover", /:hover\b/],
  [":focus-visible", /:focus-visible\b/],
  [":focus", /:focus\b/],
  [":active", /:active\b/],
  [":disabled", /:disabled\b|\[disabled\]/],
  ["[aria-expanded]", /\[aria-expanded/],
  [":checked", /:checked\b/],
  ["::placeholder", /::placeholder\b/],
  [":empty", /:empty\b/]
];
var RX_RELLENO = /\b(lorem ipsum|dolor sit amet|texto de ejemplo|su texto aqu[íi]|tu texto aqu[íi]|placeholder text|descripci[óo]n breve|t[íi]tulo de la secci[óo]n|nombre del producto|caracter[íi]stica \d|lorem)\b/gi;
var RX_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu;
function contar(rx, s) {
  const g = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
  return (s.match(g) ?? []).length;
}
function textoVisible(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function soloCss(html) {
  return (html.match(/<style[\s\S]*?<\/style>/gi) ?? []).join("\n");
}
function medirDetalle(html) {
  const vacio = {
    secciones: 0,
    h2: 0,
    h3: 0,
    anclas: 0,
    anclasConectadas: 0,
    palabras: 0,
    piezas: 0,
    estados: [],
    breakpoints: 0,
    imagenes: 0,
    imagenesConDimension: 0,
    svgInline: 0,
    emojis: 0,
    tablas: 0,
    listas: 0,
    campos: 0,
    camposConLabel: 0,
    relleno: [],
    duplicados: 0,
    declaracionesCss: 0,
    lineas: 0
  };
  const h = html ?? "";
  if (!h.trim()) return vacio;
  try {
    const css = soloCss(h);
    const texto = textoVisible(h);
    const ids2 = [...h.matchAll(/\sid="([^"]+)"/gi)].map((m) => m[1]);
    const hrefs = [...h.matchAll(/href="#([^"]+)"/gi)].map((m) => m[1]);
    const anclasConectadas = hrefs.filter((x) => ids2.includes(x)).length;
    const imgs = h.match(/<img\b[^>]*>/gi) ?? [];
    const imagenesConDimension = imgs.filter(
      (t) => /\bwidth=|\bheight=|aspect-ratio/i.test(t) || /class="[^"]*"/.test(t)
    ).length;
    const campos = contar(/<(?:input|textarea|select)\b/i, h);
    const labels = contar(/<label\b/i, h);
    const bloques = (h.match(/<(?:article|li|div)[^>]*>[\s\S]{120,400}?<\/(?:article|li|div)>/gi) ?? []).map(
      (b) => b.replace(/\s+/g, " ").replace(/>[^<]{3,}</g, "><")
    );
    const cuenta = /* @__PURE__ */ new Map();
    for (const b of bloques) cuenta.set(b, (cuenta.get(b) ?? 0) + 1);
    const duplicados = [...cuenta.values()].filter((n) => n > 1).length;
    return {
      secciones: contar(/<section\b/i, h) + contar(/<article\b/i, h),
      h2: contar(/<h2\b/i, h),
      h3: contar(/<h3\b/i, h),
      anclas: ids2.length,
      anclasConectadas,
      palabras: texto ? texto.split(/\s+/).length : 0,
      piezas: contar(/<li\b/i, h) + contar(/<article\b/i, h),
      estados: RX_ESTADOS.filter(([, rx]) => rx.test(css)).map(([n]) => n),
      breakpoints: contar(/@media[^{]*\(/i, css),
      imagenes: imgs.length,
      imagenesConDimension,
      svgInline: contar(/<svg\b/i, h),
      emojis: contar(RX_EMOJI, texto),
      tablas: contar(/<table\b/i, h),
      listas: contar(/<(?:ul|ol|dl)\b/i, h),
      campos,
      camposConLabel: Math.min(campos, labels),
      relleno: [...new Set((texto.match(RX_RELLENO) ?? []).map((x) => x.toLowerCase()))],
      duplicados,
      declaracionesCss: contar(/[a-z-]+\s*:\s*[^;{}]+;/i, css),
      lineas: h.split("\n").length
    };
  } catch {
    return vacio;
  }
}
var H = (id, gravedad, titulo, evidencia2, correccion) => ({ id, gravedad, titulo, evidencia: evidencia2, correccion });
function auditarDetalle(html, plano) {
  const m = medirDetalle(html);
  const hallazgos = [];
  const minSecciones = plano?.presupuesto.minSecciones ?? 6;
  const minItems = plano?.presupuesto.minItemsColeccion ?? 4;
  const estadosExigidos = plano?.presupuesto.estadosExigidos ?? [":hover", ":focus-visible"];
  const [lineaMin] = plano?.presupuesto.lineasObjetivo ?? [500, 900];
  if (!html.trim()) {
    return {
      metricas: m,
      hallazgos: [H("sin-html", "critico", "No hay p\xE1gina", "el HTML lleg\xF3 vac\xEDo", "regenerar")],
      puntuacion: 0,
      veredicto: "FAIL",
      resumen: "sin HTML que auditar"
    };
  }
  const seccionesReales = Math.max(m.secciones, m.h2);
  if (seccionesReales < minSecciones) {
    hallazgos.push(
      H(
        "pocas-secciones",
        "critico",
        "La p\xE1gina tiene menos secciones de las prometidas",
        `${seccionesReales} secciones detectadas, el plano exige ${minSecciones}`,
        `a\xF1adir las secciones que faltan del PLANO DE CONTENIDO, completas y con su contenido real (no encabezados vac\xEDos)`
      )
    );
  }
  if (plano) {
    const idsPresentes = [...html.matchAll(/\sid="([^"]+)"/gi)].map((x) => x[1].toLowerCase());
    const faltan = plano.secciones.filter((s) => s.id !== "nav" && s.id !== "footer").filter((s) => !idsPresentes.some((id) => id.includes(s.id) || s.id.includes(id))).map((s) => s.nombre);
    if (faltan.length) {
      hallazgos.push(
        H(
          "secciones-sin-ancla",
          "aviso",
          "Secciones del plano sin ancla identificable",
          `sin id reconocible: ${faltan.join(", ")}`,
          "dar a cada secci\xF3n el id del plano y enlazarlo desde la navegaci\xF3n"
        )
      );
    }
  }
  if (m.palabras < minSecciones * 90) {
    hallazgos.push(
      H(
        "contenido-fino",
        "critico",
        "Contenido demasiado fino para el n\xBA de secciones",
        `${m.palabras} palabras visibles en ${seccionesReales} secciones`,
        "escribir contenido espec\xEDfico y concreto en cada secci\xF3n: datos, nombres, cifras, plazos; una secci\xF3n con tres frases no es una secci\xF3n"
      )
    );
  }
  if (m.piezas < minItems) {
    hallazgos.push(
      H(
        "coleccion-pobre",
        "aviso",
        "Las secciones de colecci\xF3n no llegan al m\xEDnimo de piezas",
        `${m.piezas} piezas repetibles (li/article) detectadas, m\xEDnimo ${minItems}`,
        "completar cada colecci\xF3n hasta su m\xEDnimo con piezas REALES y distintas entre s\xED"
      )
    );
  }
  if (m.relleno.length) {
    hallazgos.push(
      H(
        "relleno",
        "critico",
        "Texto de relleno en la entrega",
        `detectado: ${m.relleno.join(", ")}`,
        "sustituir por copy realista y espec\xEDfico del negocio"
      )
    );
  }
  if (m.duplicados >= 2) {
    hallazgos.push(
      H(
        "piezas-gemelas",
        "aviso",
        "Piezas clonadas literalmente",
        `${m.duplicados} bloques repetidos car\xE1cter a car\xE1cter`,
        "diferenciar cada pieza: distinto texto, distinta longitud, distinto dato; si de verdad son id\xE9nticas, la secci\xF3n no aporta"
      )
    );
  }
  const faltanEstados = estadosExigidos.filter((e) => !m.estados.includes(e));
  if (faltanEstados.length) {
    hallazgos.push(
      H(
        "estados",
        faltanEstados.includes(":focus-visible") ? "critico" : "aviso",
        "Faltan estados interactivos en el CSS",
        `sin reglas para: ${faltanEstados.join(", ")}`,
        "declarar cada estado con un cambio visible (no solo opacidad): color, elevaci\xF3n, borde o desplazamiento"
      )
    );
  }
  if (m.breakpoints < 2) {
    hallazgos.push(
      H(
        "responsive-pobre",
        "critico",
        "Responsive insuficiente",
        `${m.breakpoints} media query(s)`,
        "declarar al menos 768px y 1024px, y revisar que el plan responsivo del contrato se cumple (qu\xE9 se reduce, reordena o transforma)"
      )
    );
  }
  if (m.imagenes > 0 && m.imagenesConDimension < m.imagenes) {
    hallazgos.push(
      H(
        "imagenes-sin-dimension",
        "aviso",
        "Im\xE1genes sin dimensi\xF3n declarada",
        `${m.imagenes - m.imagenesConDimension} de ${m.imagenes} sin width/height ni aspect-ratio`,
        "fijar aspect-ratio y object-fit para que el layout no salte al cargar"
      )
    );
  }
  if (m.svgInline === 0 && m.emojis > 2) {
    hallazgos.push(
      H(
        "emoji-por-icono",
        "aviso",
        "Emojis haciendo de iconograf\xEDa",
        `${m.emojis} emojis y 0 SVG inline`,
        "sustituir por SVG inline con currentColor y grosor de trazo coherente en toda la p\xE1gina"
      )
    );
  }
  if (m.campos > 0 && m.camposConLabel < m.campos) {
    hallazgos.push(
      H(
        "campos-sin-label",
        "critico",
        "Campos de formulario sin etiqueta",
        `${m.campos} campos, ${m.camposConLabel} labels`,
        "a\xF1adir <label for> visible a cada campo; el placeholder no es una etiqueta"
      )
    );
  }
  if (m.anclas > 0 && m.anclasConectadas === 0) {
    hallazgos.push(
      H(
        "nav-muerta",
        "aviso",
        "La navegaci\xF3n no lleva a ninguna parte",
        'ning\xFAn href="#\u2026" coincide con un id de la p\xE1gina',
        "conectar cada enlace de la navegaci\xF3n con el ancla real de su secci\xF3n"
      )
    );
  }
  if (m.declaracionesCss < 120) {
    hallazgos.push(
      H(
        "css-fino",
        "mejora",
        "Sistema visual poco desarrollado",
        `${m.declaracionesCss} declaraciones CSS`,
        "desarrollar el sistema: escala tipogr\xE1fica completa, espaciado por tokens, superficies, estados y variantes"
      )
    );
  }
  if (m.lineas < lineaMin * 0.6) {
    hallazgos.push(
      H(
        "pagina-corta",
        "aviso",
        "La p\xE1gina queda muy por debajo de la extensi\xF3n objetivo",
        `${m.lineas} l\xEDneas frente a un objetivo de ${lineaMin}+`,
        "no es un problema de verbosidad: falta contenido y acabado; completar el plano antes que a\xF1adir CSS"
      )
    );
  }
  const puntuacion = puntuacionDetalle(m, plano);
  const criticos = hallazgos.filter((x) => x.gravedad === "critico").length;
  const avisos = hallazgos.filter((x) => x.gravedad === "aviso").length;
  const veredicto = criticos > 0 ? "FAIL" : avisos >= 3 ? "WARN" : "PASS";
  return {
    metricas: m,
    hallazgos,
    puntuacion,
    veredicto,
    resumen: `detalle ${puntuacion}/100 (${veredicto}) \xB7 ${seccionesReales} secciones \xB7 ${m.palabras} palabras \xB7 ${m.piezas} piezas \xB7 estados [${m.estados.join(" ") || "ninguno"}] \xB7 ${m.breakpoints} breakpoints \xB7 ${criticos} cr\xEDtico(s), ${avisos} aviso(s)`
  };
}
function puntuacionDetalle(m, plano) {
  const minSecciones = plano?.presupuesto.minSecciones ?? 6;
  const minItems = plano?.presupuesto.minItemsColeccion ?? 4;
  const escala = (v, objetivo) => Math.max(0, Math.min(1, v / Math.max(1, objetivo)));
  const puntos = escala(Math.max(m.secciones, m.h2), minSecciones) * 22 + escala(m.palabras, minSecciones * 140) * 22 + escala(m.piezas, minItems * 2) * 12 + escala(m.estados.length, 4) * 12 + escala(m.breakpoints, 3) * 8 + escala(m.declaracionesCss, 260) * 10 + escala(m.svgInline, 6) * 6 + escala(m.anclasConectadas, 4) * 4 + (m.tablas + m.listas > 0 ? 4 : 0);
  const castigo = (m.relleno.length ? 25 : 0) + Math.min(12, m.duplicados * 4) + (m.campos > m.camposConLabel ? 8 : 0);
  return Math.max(0, Math.min(100, Math.round(puntos - castigo)));
}
function seccionReparacionDetalle(informe, plano) {
  const graves = informe.hallazgos.filter((h) => h.gravedad !== "mejora");
  if (!graves.length) return "";
  const l = [];
  l.push("# REPARACI\xD3N DE DETALLE (no regeneres la p\xE1gina: AMPL\xCDALA)");
  l.push(`Puntuaci\xF3n de detalle actual: ${informe.puntuacion}/100 \u2014 ${informe.veredicto}.`);
  l.push("Devuelve el MISMO documento con estas correcciones aplicadas. Conserva intactos los tokens, la CSS determinista, el objeto 3D, las primitivas y el contenido que ya estaba bien.");
  l.push("");
  for (const h of graves) {
    l.push(`- **${h.titulo}** (${h.gravedad}) \u2014 evidencia: ${h.evidencia}.`);
    l.push(`  Correcci\xF3n: ${h.correccion}.`);
  }
  if (plano) {
    const coleccion = plano.secciones.filter((s) => s.coleccion);
    if (coleccion.length) {
      l.push("");
      l.push("Recordatorio de m\xEDnimos del plano:");
      for (const s of coleccion) l.push(`- ${s.nombre}: ${s.minItems} piezas reales y distintas.`);
    }
  }
  l.push("");
  l.push("Salida: SOLO el documento HTML completo corregido.");
  return l.join("\n");
}
function resumenDetalle(informe) {
  return informe.resumen;
}

// src/lib/prism/forja/nucleo-v4.ts
async function ejecutarMvpForja(p, deps = {}) {
  const traza = [];
  const progreso = (e) => {
    traza.push(e);
    deps.onProgreso?.(e);
  };
  const registro = crearRegistro(deps.projectId ?? "prisma");
  const perfil = perfilCostoSeguro(deps.perfil);
  const receta = RECETAS_COSTO[perfil];
  const modelo = deps.modeloCodificador ?? { providerId: "prism", modelId: "d1-diseno" };
  const runtime = deps.runtime ?? new RuntimeLocal();
  if (deps.memoriaAprendizaje?.length) {
    cargarMemoriaAprendizaje(deps.memoriaAprendizaje);
    progreso(`[aprendizaje] memoria restaurada: ${deps.memoriaAprendizaje.length} resultado(s) previo(s)`);
  }
  if (deps.historialComposicion?.length) {
    cargarHistorial(deps.historialComposicion);
    progreso(`[anti-repeticion] historial restaurado: ${deps.historialComposicion.length} composici\xF3n(es) previa(s)`);
  }
  const esEdicion = Boolean(p.codigoActual);
  const { complejidad, reparto } = presupuestoPara(p.mensaje, esEdicion, perfil);
  const presupuesto = crearPresupuesto(reparto, perfil);
  const sinEficiencia = deps.sinEficiencia === true;
  const cacheMulti = sinEficiencia ? crearCacheMultinivel({}) : cacheMultinivelCompartido(deps.cache);
  const roi = crearLibroROI();
  let eficiente = deps.llamarModelo;
  if (eficiente && !sinEficiencia) {
    const envoltorio = crearLlamadaEficiente(eficiente, {
      presupuesto,
      cache: cacheMulti,
      roi,
      onDenegada: (rol, motivo) => progreso(`[eficiencia] llamada denegada (${rol}): ${motivo}`),
      onCacheHit: (nivel2) => progreso(`[eficiencia] acierto de cach\xE9 L${nivel2}: 0 tokens`)
    });
    eficiente = envoltorio.llamarModelo;
  }
  const llamada = eficiente;
  progreso(
    `[mvp] perfil ${perfil} (${receta.llamadasEstimadas} llamadas estimadas) \xB7 runtime ${runtime.nombre} \xB7 complejidad ${complejidad} \xB7 presupuesto ${presupuesto.total} tok`
  );
  progreso("[adn] definiendo el ADN visual 2.0");
  let adn = adn2DesdeAdn1(null, p.mensaje);
  const claveL3 = claveArquitectura(p.mensaje, p.reglasAprendidas ?? []);
  const adnCacheado = sinEficiencia ? null : cacheMulti.obtenerJSON(NIVEL.arquitectura, claveL3);
  if (adnCacheado) {
    adn = adnCacheado;
    progreso("[adn] decisi\xF3n de ADN servida del cach\xE9 L3 (0 tokens)");
  } else if (llamada) {
    try {
      const salidaAdn = await llamada({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system: promptBloqueAdn2(p.mensaje),
        user: "Define el ADN visual 2.0 del proyecto.",
        temperatura: 0.4,
        rol: "disenador",
        maxTokens: 8192
      });
      adn = parseAdn2(salidaAdn) ?? adn;
      cacheMulti.guardarJSON(NIVEL.arquitectura, claveL3, adn);
    } catch {
      progreso("[adn] sin respuesta del modelo: ADN de respaldo anti-gen\xE9rico");
    }
  }
  registro.adn = adn.identidad.slice(0, 120);
  progreso("[experiencia] seleccionando familia, receta, planes, objeto y primitivas (motor creativo v4.6)");
  const senales = [
    p.mensaje,
    adn.identidad,
    ...adn.personalidad ?? [],
    ...adn.lenguaje ?? [],
    ...adn.composicion ?? [],
    ...adn.representacion ?? [],
    ...adn.movimiento ?? [],
    ...adn.prohibiciones ?? []
  ].filter(Boolean).join("\n").slice(0, 6e3);
  const seleccion = seleccionarExperiencia(senales, {
    mensajeOriginal: p.mensaje,
    nivelDetalle: deps.nivelDetalle
  });
  progreso(`[experiencia] ${seleccion.resumen}`);
  progreso(`[plano] ${resumenPlano(seleccion.plano)}`);
  if (seleccion.razonesDna.length) progreso(`[experiencia] se\xF1ales: ${seleccion.razonesDna.join("; ")}`);
  if (seleccion.representacion.degradadoDe) progreso(`[experiencia] ${seleccion.representacion.razon}`);
  if (seleccion.objeto) progreso(`[objeto-3d] forjado: ${seleccion.objeto.nombre} \u2014 ${seleccion.objeto.descripcion}`);
  if (seleccion.primitivas.primitivas.length) progreso(`[primitivas] compiladas: ${seleccion.primitivas.primitivas.join(", ")} (${seleccion.primitivas.kbTotales} KB, nacen auditadas)`);
  if (seleccion.aprendizaje.length) progreso(`[aprendizaje] ${seleccion.aprendizaje.map((r) => `${r.accion} ${r.dimension} ${r.valor}`).join(" \xB7 ")}`);
  registro.experiencia = {
    familia: seleccion.familia.familia,
    receta: seleccion.receta.receta.id,
    hero: seleccion.hero.tipo,
    representacion: seleccion.representacion.modo,
    dna: resumenExperienciaDna(seleccion.dna),
    metricas: "",
    qa: "",
    parches: 0,
    objeto: seleccion.objeto ? seleccion.objeto.id : "ninguno",
    primitivas: seleccion.primitivas.primitivas.join(",") || "ninguna",
    aprendizaje: seleccion.aprendizaje.length ? seleccion.aprendizaje.map((r) => `${r.accion}:${r.dimension}:${r.valor}`).join(" \xB7 ") : "",
    plano: resumenPlano(seleccion.plano),
    detalleQa: ""
  };
  const ds = designSystemCompleto(adn, registro.projectId);
  registro.designSystem = ds.nombre;
  progreso(`[sistema] design system \xAB${ds.nombre}\xBB con ${ds.colores.length} colores declarados`);
  let arena = null;
  let nombreDireccion = "";
  let briefAdicional = "";
  if (receta.visiones > 1 && llamada) {
    progreso(`[arena] modo ${deps.modoArena ?? "profesional"} (${receta.visiones} visiones, ${receta.maquetas} maquetas)`);
    const asignacion = asignarFamiliasArena(p.mensaje);
    progreso(`[arena-familias] ${resumenAsignacionFamilias(asignacion)}`);
    arena = await arena2Forja(p.mensaje, adn, deps.modoArena ?? "profesional", perfil, {
      llamarModelo: llamada,
      modeloDirector: modelo,
      onProgreso: progreso,
      familiasArena: asignacion
    });
    nombreDireccion = arena.fusion ? arena.fusion.concepto : arena.visiones.find((v) => v.letra === arena?.mejor)?.nombre ?? "";
    registro.direccionesExploradas = arena.visiones.map((v) => v.nombre);
    if (registro.experiencia) {
      const asignacionFam = asignacion.porLetra[arena.mejor];
      registro.experiencia.arenaFamilia = `${asignacionFam} (visi\xF3n ${arena.mejor})`;
    }
    briefAdicional = textoArena2(arena).slice(0, 2500);
  } else {
    progreso("[direcciones] perfil sin Arena: 1 direcci\xF3n directa");
    nombreDireccion = "direcci\xF3n directa del Dise\xF1ador";
  }
  registro.direccion = nombreDireccion.slice(0, 120);
  progreso(`[codigo] ejecutando en ${runtime.nombre}`);
  const request = peticionARequest(p, adn, null, ds, registro.projectId);
  if (briefAdicional) {
    request.brief = `${request.brief}

# Resultado de la Arena (visi\xF3n ganadora y fusi\xF3n)
${briefAdicional}`;
  }
  registro.skills = request.skills;
  let artifact = await ejecutarEnRuntime(runtime, request);
  if (llamada && (!artifact.ok || artifact.productor === "runtime-local")) {
    progreso("[codigo] Codificador con modelo");
    const ctxCod = compilarContexto({
      mensaje: p.mensaje,
      objetivo: "construir la p\xE1gina completa respetando ADN, sistema y CONTRATO DE EXPERIENCIA",
      techoCaracteres: 5500,
      fuentes: [
        { tipo: "fallos-confirmados", prioridad: 0, lineas: p.reglasAprendidas ?? [] },
        { tipo: "conocimiento-global", prioridad: 2, lineas: p.conocimientoGlobal ?? [] },
        { tipo: "estado", prioridad: 1, lineas: request.brief.split(/\n+/) }
      ]
    });
    progreso(`[codigo] contexto compilado: ${resumenContexto(ctxCod.stats)}`);
    try {
      const salida = await llamada({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system: [
          `Eres el Codificador de FORJA IA. Construye el HTML autocontenido completo.`,
          `Cumples el ADN 2.0, el design system y el CONTRATO DE EXPERIENCIA AL PIE DE LA LETRA.`,
          seccionAdn2(adn),
          seccionContratoExperiencia(seleccion),
          `La CSS determinista de la experiencia (tokens + escenario + objeto 3D + movimiento + cards + primitivas compiladas) viaja en el mensaje: INCLUYELA y a\xF1ade la tuya ENCIMA, nunca en contra.`,
          `Si viaja un script capado de primitivas (\xABscripts de primitivas compiladas\xBB), p\xE9galo al FINAL del <body> tal cual: es idempotente y respeta reduced-motion.`,
          `Prohibido: el cat\xE1logo gen\xE9rico (hero centrado + t\xEDtulo gigante + bot\xF3n azul, 3 tarjetas gemelas, blobs, glassmorphism, dashboard de cajitas).`,
          `Salida: SOLO el c\xF3digo HTML completo.`
        ].join("\n"),
        user: [
          ctxCod.texto || request.brief.slice(0, 4500),
          `# CSS determinista de la experiencia (incluir tal cual)
${cssDeterminista(seleccion)}`,
          scriptDeterminista(seleccion) ? `# Scripts capados de las primitivas compiladas (pegar al final del body, tal cual)
${scriptDeterminista(seleccion)}` : ""
        ].filter(Boolean).join("\n\n"),
        temperatura: 0.5,
        onFragmento: void 0,
        rol: "codificador",
        // v4.7 — el techo lo fija el NIVEL DE DETALLE, no el defecto del
        // rol. Hasta v4.6 esta llamada —la que produce la página entera—
        // no pedía maxTokens y heredaba el defecto: el modelo entregaba lo
        // que cabía y recortaba contenido antes que CSS.
        maxTokens: seleccion.plano.presupuesto.maxTokensImplementacion
      });
      const codigo = extraerCodigo(salida);
      if (codigo) {
        artifact = { ...artifact, html: codigo, ok: true, productor: `${modelo.providerId}:${modelo.modelId}` };
      }
    } catch {
      progreso("[codigo] el Codificador fall\xF3: se conserva el artefacto del runtime");
    }
  }
  registro.modelos.push(`${modelo.providerId}:${modelo.modelId}`);
  registro.agentes.push("director", "codificador");
  registro.artifact = `${artifact.productor} (${artifact.html.length} chars)`;
  progreso("[revision] evaluando con inspector + anti-gen\xE9rico + sistema");
  const evaluacion = artifactAEvaluacion(artifact, ds);
  registro.antiGeneric = `identidad ${evaluacion.genericidad.puntuacionIdentidad}/100 (${evaluacion.genericidad.nivel})`;
  registro.critic = evaluacion.resumen;
  progreso(`[revision] ${evaluacion.resumen}`);
  let iteraciones = [];
  const decisionesTempranas = [];
  let parchesGratis = 0;
  let htmlFinal = artifact.html;
  let informeActual = revisarVisual(htmlFinal, { ds });
  let decision = decidirSiguientePaso(informeActual, 0, MAX_ITERACIONES_MEJORA, htmlFinal);
  decisionesTempranas.push(decision);
  if (decision.tipo === "parche-determinista") {
    const scoreAntes = scoreDe(informeActual);
    htmlFinal = decision.html;
    parchesGratis += decision.parches.length;
    progreso(`[temprana] parche gratis: ${decision.motivo}`);
    informeActual = revisarVisual(htmlFinal, { ds });
    roi.registrar({
      operacion: "parche-det",
      rol: "-",
      modelo: "determinista",
      tokens: 0,
      llamadas: 0,
      scoreAntes,
      scoreDespues: scoreDe(informeActual)
    });
    decision = decidirSiguientePaso(informeActual, 1, MAX_ITERACIONES_MEJORA, htmlFinal);
    decisionesTempranas.push(decision);
  }
  let parchesExp = 0;
  if (htmlFinal && artifact.ok) {
    const hallazgos = auditarExperiencia(htmlFinal, seleccion.dna);
    if (hallazgos.length) {
      const rExp = parchesExperiencia(htmlFinal, hallazgos, seleccion.dna, seleccion.planMovimiento, seleccion.planEspacial);
      parchesExp = rExp.parches.length;
      const metricasTras = medirExperiencia(rExp.html);
      const desvio = desviacionDeDna(metricasTras, seleccion.dna);
      if (registro.experiencia) {
        registro.experiencia.metricas = resumenMetricas(metricasTras);
        registro.experiencia.qa = resumenQaExperiencia(hallazgos, rExp.parches);
        registro.experiencia.parches = parchesExp;
      }
      if (parchesExp > 0) {
        const scoreAntesExp = scoreDe(informeActual);
        htmlFinal = rExp.html;
        parchesGratis += parchesExp;
        progreso(`[experiencia-qa] ${resumenQaExperiencia(hallazgos, rExp.parches)}`);
        progreso(`[experiencia-qa] ${desvio.resumen}`);
        informeActual = revisarVisual(htmlFinal, { ds });
        roi.registrar({
          operacion: "parche-experiencia",
          rol: "-",
          modelo: "determinista",
          tokens: 0,
          llamadas: 0,
          scoreAntes: scoreAntesExp,
          scoreDespues: scoreDe(informeActual)
        });
        decision = decidirSiguientePaso(informeActual, iteraciones.length ? 1 : 0, MAX_ITERACIONES_MEJORA, htmlFinal);
        decisionesTempranas.push(decision);
      }
      if (rExp.sinParche.length) {
        progreso(`[experiencia-qa] sin parche: ${rExp.sinParche.map((h) => h.chequeo).join(", ")} \u2192 sube al bucle con correcci\xF3n propuesta`);
      }
    } else if (registro.experiencia) {
      registro.experiencia.metricas = resumenMetricas(medirExperiencia(htmlFinal));
      registro.experiencia.qa = "sin hallazgos";
    }
  }
  if (htmlFinal && artifact.ok) {
    const rMov = auditarYparchearMovimiento(htmlFinal, seleccion.planMovimiento);
    if (registro.experiencia) registro.experiencia.motionQa = resumenMovimiento(rMov.informe);
    if (rMov.parches.length) {
      const scoreAntesMov = scoreDe(informeActual);
      htmlFinal = rMov.html;
      parchesGratis += rMov.parches.length;
      progreso(`[motion-qa] ${resumenMovimiento(rMov.informe)}`);
      progreso(`[motion-qa] parches: ${rMov.parches.map((p2) => p2.tipo).join(", ")}`);
      informeActual = revisarVisual(htmlFinal, { ds });
      roi.registrar({
        operacion: "parche-motion-qa",
        rol: "-",
        modelo: "determinista",
        tokens: 0,
        llamadas: 0,
        scoreAntes: scoreAntesMov,
        scoreDespues: scoreDe(informeActual)
      });
    } else if (rMov.informe.hallazgos.length === 0) {
      progreso(`[motion-qa] ${resumenMovimiento(rMov.informe)}`);
    }
  }
  let informeDetalle = auditarDetalle(htmlFinal, seleccion.plano);
  if (registro.experiencia) registro.experiencia.detalleQa = resumenDetalle(informeDetalle);
  progreso(`[detalle-qa] ${resumenDetalle(informeDetalle)}`);
  if (htmlFinal && artifact.ok && llamada && !deps.sinReparacionDetalle && informeDetalle.veredicto === "FAIL") {
    const encargo = seccionReparacionDetalle(informeDetalle, seleccion.plano);
    if (encargo) {
      progreso(`[detalle-qa] reparaci\xF3n quir\xFArgica: ${informeDetalle.hallazgos.filter((h) => h.gravedad === "critico").length} cr\xEDtico(s)`);
      const scoreAntesDet = scoreDe(informeActual);
      const puntosAntes = informeDetalle.puntuacion;
      const htmlPrevio = htmlFinal;
      try {
        const salidaDet = await llamada({
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system: [
            `Eres el Codificador de FORJA IA en modo AMPLIACI\xD3N.`,
            `NO regeneras la p\xE1gina: devuelves el MISMO documento con el contenido que falta a\xF1adido.`,
            `Conservas intactos: el bloque :root de tokens, la CSS determinista, el objeto 3D, las primitivas compiladas, sus scripts y todo el contenido que ya estaba bien.`,
            `Salida: SOLO el documento HTML completo.`
          ].join("\n"),
          user: [encargo, `# Documento actual
${htmlFinal}`].join("\n\n"),
          temperatura: 0.4,
          rol: "codificador",
          maxTokens: seleccion.plano.presupuesto.maxTokensImplementacion
        });
        const ampliado = extraerCodigo(salidaDet);
        const informeAmpliado = ampliado ? auditarDetalle(ampliado, seleccion.plano) : null;
        if (ampliado && informeAmpliado && informeAmpliado.puntuacion > puntosAntes) {
          const informeVisualAmpliado = revisarVisual(ampliado, { ds });
          if (informeVisualAmpliado.veredicto !== "FAIL" || informeActual.veredicto === "FAIL") {
            htmlFinal = ampliado;
            informeActual = informeVisualAmpliado;
            informeDetalle = informeAmpliado;
            progreso(`[detalle-qa] ampliada: detalle ${puntosAntes} \u2192 ${informeAmpliado.puntuacion}/100`);
          } else {
            progreso(`[detalle-qa] ampliaci\xF3n descartada: mejoraba el detalle pero romp\xEDa la p\xE1gina (rollback)`);
          }
        } else {
          htmlFinal = htmlPrevio;
          progreso(`[detalle-qa] ampliaci\xF3n descartada: no mejor\xF3 el detalle (rollback)`);
        }
      } catch {
        progreso("[detalle-qa] la reparaci\xF3n fall\xF3: se conserva el documento anterior");
      }
      if (registro.experiencia) registro.experiencia.detalleQa = resumenDetalle(informeDetalle);
      roi.registrar({
        operacion: "reparacion-detalle",
        rol: "codificador",
        modelo: `${modelo.providerId}:${modelo.modelId}`,
        tokens: 0,
        llamadas: 0,
        scoreAntes: scoreAntesDet,
        scoreDespues: scoreDe(informeActual)
      });
    }
  }
  if (receta.bucleMejora && artifact.ok && decision.tipo === "llm") {
    progreso("[bucle] bucle de mejora aut\xF3nomo (m\xE1x 3)");
    const bucle = await ejecutarBucleMejora(htmlFinal, {
      llamarModelo: llamada,
      modelo,
      ds,
      onProgreso: progreso
    });
    const scoreFinalBucle = scoreDe(bucle.informeFinal);
    roi.registrar({
      operacion: "bucle-mejora",
      rol: "codificador",
      modelo: `${modelo.providerId}:${modelo.modelId}`,
      tokens: 0,
      // las llamadas del bucle ya se contaron por el envoltorio
      llamadas: 0,
      scoreAntes: scoreDe(informeActual),
      scoreDespues: scoreFinalBucle
    });
    htmlFinal = bucle.html;
    iteraciones = bucle.iteraciones;
    informeActual = bucle.informeFinal;
    registro.iteraciones = bucle.iteracionesUsadas;
    progreso(`[bucle] fin tras ${bucle.iteracionesUsadas} iteraci\xF3n(es): ${bucle.informeFinal.veredicto}`);
  } else if (receta.bucleMejora && artifact.ok) {
    progreso(`[bucle] omitido \u2014 ${decision.motivo}`);
    registro.iteraciones = 0;
  } else if (decision.tipo === "parche-determinista") {
    progreso(`[temprana] ${decision.motivo}`);
  }
  let metricas = null;
  if (receta.benchmark) {
    progreso("[metricas] midiendo las 8 m\xE9tricas del plan");
    metricas = medir(htmlFinal, { ds, iteraciones });
  }
  const informeFinal = informeActual;
  const totalesRoi = roi.totales();
  registro.llamadas = totalesRoi.llamadas;
  const informePresupuesto = presupuesto.informe();
  const statsCache = cacheMulti.stats();
  const temprana = resumenTemprana(
    registro.iteraciones,
    receta.bucleMejora ? MAX_ITERACIONES_MEJORA : 0,
    decisionesTempranas
  );
  const iteracionesEvitadas = Math.max(0, (receta.bucleMejora ? MAX_ITERACIONES_MEJORA : 0) - registro.iteraciones);
  const ahorroEstimado2 = totalesRoi.deCache * 1500 + iteracionesEvitadas * 4500 + parchesGratis * 6e3;
  registro.eficiencia = {
    complejidad,
    presupuesto: presupuesto.resumen(),
    fases: Object.entries(informePresupuesto.porFase).map(([fase, e]) => ({ fase, cupo: e.cupo, gastado: e.gastado })),
    cache: statsCache.resumen(),
    roi: roi.resumen(),
    temprana,
    contexto: "ver [codigo] en la traza (compilado por petici\xF3n)",
    ahorroTokensEstimado: ahorroEstimado2
  };
  progreso(`[eficiencia] ${presupuesto.resumen()} \xB7 ${statsCache.resumen()} \xB7 ${roi.resumen()} \xB7 ${temprana}`);
  const registroCerrado = cerrarRegistro(registro, informeFinal.identidad, arena?.lecciones.map((l) => l.texto) ?? []);
  let genomaFinal = null;
  if (arena?.lecciones.length) {
    genomaFinal = incorporarLeccionesGenoma(deps.genoma ?? { generacion: 0, lecciones: [], patrones: [], antiPatrones: [], referencias: [] }, arena.lecciones);
    registroCerrado.lecciones = [...registroCerrado.lecciones, ...genomaFinal.patrones.map((x) => `patr\xF3n: ${x.texto}`)].slice(0, 12);
    progreso(`[genoma] generaci\xF3n ${genomaFinal.generacion} con ${genomaFinal.lecciones.length} lecciones`);
  }
  const huellaActual = {
    hero: seleccion.hero.tipo,
    cards: seleccion.cards.variantes,
    motion: seleccion.planMovimiento.primitivas,
    spatial: seleccion.dna.spatial.mode,
    navegacion: seleccion.receta.receta.navegacion.minimal ? "minimal" : "est\xE1ndar",
    secciones: seleccion.familia.razones,
    cuando: Date.now()
  };
  registrarComposicion(huellaActual);
  registrarResultadoAprendizaje({
    cuando: huellaActual.cuando,
    vertical: p.mensaje.slice(0, 80),
    familia: seleccion.familia.familia,
    huella: huellaActual,
    score: scoreDe(informeFinal),
    veredicto: informeFinal.veredicto === "PASS" ? "exito" : informeFinal.veredicto === "WARN" ? "regular" : "fallo",
    metricas: registro.experiencia?.metricas ?? ""
  });
  const recsAprendidas = recomendacionesAprendidas({ max: 4 });
  progreso(`[aprendizaje] ${resumenAprendizaje(recsAprendidas)}`);
  const exito = evaluarExito(montarResultado());
  progreso(`[fin] ${exito.resumen}`);
  return {
    resultado: montarResultado(),
    arena,
    adn,
    experiencia: seleccion,
    designMd: ds.designMd,
    tokensCss: ds.tokensCss,
    iteraciones,
    metricas,
    exito,
    registro: registroCerrado,
    traza
  };
  function montarResultado() {
    return {
      estado: "completo",
      codigo: htmlFinal,
      respuesta: [
        `**FORJA IA v4 (MVP ${perfil})**`,
        informado(),
        informadoExperiencia(),
        metricas ? metricas.resumen : "",
        informadoEficiencia()
      ].filter(Boolean).join("\n\n"),
      ficha: null,
      fichaTexto: request.brief.slice(0, 2e3),
      maqueta: null,
      rondas: [],
      veredicto: { aprobado: informeFinal.veredicto !== "FAIL", defectos: informeFinal.hallazgos.map((h) => `${h.titulo}: ${h.correccion}`).slice(0, 6), resumen: informeFinal.resumen },
      agotado: false,
      vision: informeFinal.hallazgos,
      adn,
      genericidad: evaluacion.genericidad
    };
  }
  function informadoExperiencia() {
    const e = registro.experiencia;
    if (!e) return "";
    const partes = [
      `**Experiencia v4.6**: familia \xAB${e.familia}\xBB \xB7 receta ${e.receta} \xB7 hero ${e.hero} \xB7 representaci\xF3n ${e.representacion}${e.arenaFamilia ? ` \xB7 Arena de familias: gan\xF3 ${e.arenaFamilia}` : ""} \u2014 ${e.dna}`,
      e.objeto && e.objeto !== "ninguno" ? `Objeto 3D forjado (0 librer\xEDas): ${e.objeto}. Primitivas compiladas: ${e.primitivas}.` : "",
      e.aprendizaje ? `El Genoma recomend\xF3 con evidencia: ${e.aprendizaje}.` : ""
    ];
    if (e.metricas) partes.push(`M\xE9tricas del resultado: ${e.metricas}.`);
    if (e.qa && e.qa !== "sin hallazgos") partes.push(`QA de experiencia: ${e.qa}.`);
    if (e.motionQa) partes.push(`Motion QA medido: ${e.motionQa}.`);
    return partes.filter(Boolean).join("\n");
  }
  function informado() {
    const partes = [`C\xF3digo producido por ${artifact.productor}.`, textoRevisorVisual(informeFinal)];
    if (iteraciones.length) partes.push(`Bucle de mejora: ${iteraciones.length} iteraci\xF3n(es), score ${iteraciones[0].scoreAntes} \u2192 ${iteraciones[iteraciones.length - 1].scoreDespues}.`);
    return partes.join("\n\n");
  }
  function informadoEficiencia() {
    const e = registro.eficiencia;
    if (!e) return "";
    const partes = [
      `**Eficiencia v4.4**: complejidad ${e.complejidad} \xB7 ${e.presupuesto} \xB7 ${e.cache}`,
      e.ahorroTokensEstimado > 0 ? `Ahorro estimado de esta generaci\xF3n: ~${e.ahorroTokensEstimado.toLocaleString("es-ES")} tokens de salida (cach\xE9 ${totalesRoi.deCache} \xB7 ${iteracionesEvitadas} iteraci\xF3n(es) evitada(s) \xB7 ${parchesGratis} parche(s) sin modelo).` : `Esta generaci\xF3n us\xF3 el presupuesto completo: la calidad pag\xF3 su precio.`,
      e.roi
    ];
    return partes.filter(Boolean).join("\n");
  }
}

// src/lib/prism/forja/motivo-parada.ts
var LONGITUD = [
  "length",
  "max_tokens",
  "maxtokens",
  "max_output_tokens",
  "model_length"
];
var HERRAMIENTA = ["tool_calls", "tool_use", "function_call", "tool"];
var FILTRO = [
  "content_filter",
  "safety",
  "recitation",
  "blocklist",
  "prohibited_content"
];
var FIN = ["stop", "end_turn", "stop_sequence", "eos", "complete"];
function motivoDeParada(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "desconocido";
  const v = raw.trim().toLowerCase();
  if (LONGITUD.includes(v)) return "longitud";
  if (HERRAMIENTA.includes(v)) return "herramienta";
  if (FILTRO.includes(v)) return "filtro";
  if (FIN.includes(v)) return "fin";
  return "desconocido";
}
function motivoDeRespuesta(protocolo, json) {
  if (!json || typeof json !== "object") return null;
  const j = json;
  if (protocolo === "anthropic") {
    const delta = j.delta;
    const raw2 = j.stop_reason ?? delta?.stop_reason;
    return raw2 == null ? null : motivoDeParada(raw2);
  }
  if (protocolo === "gemini") {
    const cands = j.candidates;
    const raw2 = cands?.[0]?.finishReason;
    return raw2 == null ? null : motivoDeParada(raw2);
  }
  const choices = j.choices;
  const raw = choices?.[0]?.finish_reason;
  return raw == null ? null : motivoDeParada(raw);
}
function esCortePorLongitud(m) {
  return m === "longitud";
}
function mensajeParada(m) {
  switch (m) {
    case "longitud":
      return "El proveedor cort\xF3 la respuesta por longitud.";
    case "filtro":
      return "El proveedor cort\xF3 la respuesta con su filtro de contenido.";
    default:
      return null;
  }
}

// src/lib/prism/forja/adaptador-resiliente.ts
function esErrorDeRed(e) {
  const s = `${e instanceof Error ? e.message : e}`.toLowerCase();
  return /fetch failed|network|socket|econn(reset|refused|aborted)|etimedout|aborted?\b|timeout|timed out|temporarily unavailable|too many requests|rate limit|\b429\b|\b5(0[0234]|1[03]|2[0-9])\b|bad gateway|service unavailable|gateway time/.test(
    s
  ) || e instanceof TypeError || // fetch del navegador lanza TypeError en red rota
  e instanceof DOMException && e.name === "AbortError";
}
function esErrorFatal(e) {
  const s = `${e instanceof Error ? e.message : e}`.toLowerCase();
  return /\b40[013]\b|unauthorized|forbidden|invalid api key|authentication|model not found|not found for|permission/.test(
    s
  );
}
var dormir = (ms) => new Promise((r) => setTimeout(r, ms));
function esperaBackoff(baseMs, intento) {
  const base = baseMs * Math.pow(2, intento - 1);
  const jitter = base * (Math.random() * 0.6 - 0.3);
  return Math.max(150, Math.round(base + jitter));
}
var clave = (m) => `${m.providerId}:${m.modelId}`;
function crearAdaptadorForja(transporte, opciones = {}) {
  const {
    suplentesPorRol,
    suplentesDefecto,
    maxTokensPorRol,
    salud,
    intentosRed = 3,
    backoffBaseMs = 600,
    maxContinuaciones = 2,
    timeoutMs,
    onEvento
  } = opciones;
  return async (args) => {
    const rol = args.rol ?? "codificador";
    const primario = {
      providerId: args.providerId,
      modelId: args.modelId
    };
    const vistos = /* @__PURE__ */ new Set([clave(primario)]);
    const suplentes = [
      ...suplentesPorRol?.[rol] ?? [],
      ...args.rol ? [] : suplentesDefecto ?? []
    ].filter((m) => {
      const k = clave(m);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
    const cadenaPre = [primario, ...suplentes];
    const cadena = salud ? salud.ordenar(cadenaPre) : cadenaPre;
    const maxTokens = args.maxTokens ?? maxTokensPorRol?.[rol] ?? MAX_TOKENS_DEFECTO[rol] ?? 8192;
    const errores = [];
    for (let i = 0; i < cadena.length; i++) {
      const objetivo = cadena[i];
      let ultimoError = null;
      const t0 = Date.now();
      for (let intento = 0; intento < intentosRed; intento++) {
        if (intento > 0) {
          const esperaMs = esperaBackoff(backoffBaseMs, intento);
          onEvento?.({
            tipo: "red-reintento",
            providerId: objetivo.providerId,
            modelId: objetivo.modelId,
            intento,
            esperaMs,
            motivo: errores.length ? errores[errores.length - 1] : "reintento"
          });
          await dormir(esperaMs);
        }
        try {
          const se\u00F1al = timeoutMs ? AbortSignal.timeout(timeoutMs) : void 0;
          const resp = await transporte({
            providerId: objetivo.providerId,
            modelId: objetivo.modelId,
            system: args.system,
            user: args.user,
            temperatura: args.temperatura,
            maxTokens,
            onFragmento: args.onFragmento,
            signal: se\u00F1al
          });
          if (!resp.texto.trim()) {
            throw new Error("El proveedor devolvi\xF3 una respuesta vac\xEDa.");
          }
          let texto = resp.texto;
          let motivo = motivoDeParada(resp.motivoParada);
          let tokens = resp.tokensSalida;
          let piezas = 0;
          for (let n = 1; n <= maxContinuaciones; n++) {
            if (!esCortePorLongitud(motivo)) break;
            onEvento?.({
              tipo: "continuacion",
              providerId: objetivo.providerId,
              modelId: objetivo.modelId,
              n
            });
            const se\u00F1alCont = timeoutMs ? AbortSignal.timeout(timeoutMs) : void 0;
            const tCont = Date.now();
            const cont = await transporte({
              providerId: objetivo.providerId,
              modelId: objetivo.modelId,
              system: args.system,
              user: promptContinuacion(texto),
              temperatura: args.temperatura,
              maxTokens,
              onFragmento: args.onFragmento ? (frag) => args.onFragmento?.(`
${frag}`) : void 0,
              signal: se\u00F1alCont
            });
            if (cont.texto.trim()) {
              texto = `${texto}
${limpiaContinuacion(cont.texto)}`;
              motivo = motivoDeParada(cont.motivoParada);
              tokens = (tokens ?? 0) + (cont.tokensSalida ?? 0);
              piezas += 1;
              salud?.anotarExito(clave(objetivo), Date.now() - tCont);
            } else {
              break;
            }
          }
          if (esCortePorLongitud(motivo)) {
            onEvento?.({
              tipo: "truncado-final",
              providerId: objetivo.providerId,
              modelId: objetivo.modelId,
              motivo
            });
          }
          const msTotal = Date.now() - t0;
          salud?.anotarExito(clave(objetivo), msTotal);
          onEvento?.({
            tipo: "exito",
            providerId: objetivo.providerId,
            modelId: objetivo.modelId,
            ms: msTotal,
            tokensSalida: tokens,
            continuaciones: piezas
          });
          return texto;
        } catch (e) {
          ultimoError = e;
          const msError = Date.now() - t0;
          salud?.anotarFallo(
            clave(objetivo),
            msError,
            e instanceof Error ? e.message : String(e)
          );
          errores.push(
            `${clave(objetivo)}: ${e instanceof Error ? e.message : String(e)}`
          );
          const red = esErrorDeRed(e);
          const fatal = esErrorFatal(e);
          if (!(red && intento < intentosRed - 1)) break;
        }
      }
      const siguiente = cadena[i + 1];
      if (siguiente) {
        onEvento?.({
          tipo: "failover",
          desde: clave(objetivo),
          hacia: clave(siguiente),
          motivo: ultimoError instanceof Error ? ultimoError.message : String(ultimoError ?? "desconocido")
        });
      }
    }
    const resumen = errores.join(" \xB7 ") || "sin detalle";
    onEvento?.({ tipo: "cadena-agotada", intentos: errores, ultimoError: resumen });
    throw new Error(
      `FORJA IA: toda la cadena de modelos fall\xF3 (${cadena.length} proveedor/es). \xDAltimo detalle: ${resumen}`
    );
  };
}
function cadenaDesdeSugerencias(sugerenciasPorRol) {
  const salida = {};
  for (const [rol, lista] of Object.entries(sugerenciasPorRol)) {
    salida[rol] = lista.map((m) => ({ providerId: m.providerId, modelId: m.modelId }));
  }
  return salida;
}

// src/lib/prism/forja/salud-proveedores.ts
var DEFECTO = {
  ewmaAlpha: 0.3,
  enfriadoBaseMs: 15e3,
  enfriadoMaxMs: 5 * 6e4,
  topeFichas: 64
};
function crearSaludProveedores(opciones = {}) {
  const { ewmaAlpha, enfriadoBaseMs, enfriadoMaxMs, topeFichas } = {
    ...DEFECTO,
    ...opciones
  };
  const fichas = /* @__PURE__ */ new Map();
  function ficha(clave2) {
    let f = fichas.get(clave2);
    if (!f) {
      f = {
        clave: clave2,
        exitos: 0,
        fallos: 0,
        fallosSeguidos: 0,
        latenciaMs: null,
        ultimoMs: null,
        enfriadoHasta: 0,
        ultimoError: "",
        actualizado: 0
      };
      fichas.set(clave2, f);
      podar();
    }
    return f;
  }
  function podar() {
    while (fichas.size > topeFichas) {
      const masVieja = [...fichas.values()].sort((a, b) => a.actualizado - b.actualizado)[0];
      if (!masVieja) break;
      fichas.delete(masVieja.clave);
    }
  }
  return {
    anotarExito(clave2, ms) {
      const f = ficha(clave2);
      f.exitos += 1;
      f.fallosSeguidos = 0;
      f.enfriadoHasta = 0;
      f.ultimoMs = Math.max(0, Math.round(ms));
      f.latenciaMs = f.latenciaMs == null ? f.ultimoMs : Math.round(f.latenciaMs * (1 - ewmaAlpha) + f.ultimoMs * ewmaAlpha);
      f.actualizado = Date.now();
    },
    anotarFallo(clave2, ms, motivo) {
      const f = ficha(clave2);
      f.fallos += 1;
      f.fallosSeguidos += 1;
      if (ms != null) f.ultimoMs = Math.max(0, Math.round(ms));
      f.ultimoError = String(motivo ?? "").slice(0, 140);
      const msEnfriado = Math.min(
        enfriadoMaxMs,
        enfriadoBaseMs * Math.pow(2, f.fallosSeguidos - 1)
      );
      f.enfriadoHasta = Date.now() + msEnfriado;
      f.actualizado = Date.now();
    },
    estaEnfriado(clave2, ahora = Date.now()) {
      const f = fichas.get(clave2);
      return !!f && f.enfriadoHasta > ahora;
    },
    ordenar(cadena, ahora = Date.now()) {
      if (cadena.length <= 1) return [...cadena];
      const [primario, ...resto] = cadena;
      const restoOrdenado = [...resto].sort((a, b) => rango(a, ahora) - rango(b, ahora));
      return [primario, ...restoOrdenado];
    },
    instantanea() {
      const out = {};
      for (const [k, f] of fichas) out[k] = { ...f };
      return out;
    }
  };
  function rango(m, ahora) {
    const f = fichas.get(`${m.providerId}:${m.modelId}`);
    if (!f) return Number.MAX_SAFE_INTEGER - 1;
    const enfriado = f.enfriadoHasta > ahora;
    const latencia = f.latenciaMs ?? Number.MAX_SAFE_INTEGER - 2;
    return enfriado ? Number.MAX_SAFE_INTEGER : latencia;
  }
}
function saludAJSON(salud) {
  return JSON.stringify(salud.instantanea());
}
function saludDesdeJSON(crudo, opciones = {}) {
  const salud = crearSaludProveedores(opciones);
  if (!crudo) return salud;
  try {
    const obj = JSON.parse(crudo);
    for (const [clave2, f] of Object.entries(obj)) {
      if (!f || typeof clave2 !== "string") continue;
      const exitos = Number(f.exitos) || 0;
      const fallos = Number(f.fallos) || 0;
      const latencia = Number(f.latenciaMs);
      if (exitos > 0 && Number.isFinite(latencia) && latencia > 0) {
        for (let i = 0; i < Math.min(exitos, 10); i++) salud.anotarExito(clave2, latencia);
      }
      const seguidos = Math.min(Number(f.fallosSeguidos) || 0, 2);
      if (fallos > 0 && seguidos > 0 && (f.enfriadoHasta ?? 0) > Date.now()) {
        for (let i = 0; i < seguidos; i++) salud.anotarFallo(clave2, null, String(f.ultimoError ?? ""));
      }
    }
  } catch {
  }
  return salud;
}
function claveModelo(m) {
  return `${m.providerId}:${m.modelId}`;
}

// src/lib/prism/forja/benchmark.ts
var CASOS_BENCHMARK = [
  {
    categoria: "saas",
    brief: "Landing de un SaaS B2B de facturaci\xF3n para pymes: demo, precios, confianza.",
    esperado: ["secci\xF3n de precios legible", "prueba social real (no 3 logos gen\xE9ricos)", "CTA principal claro", "explicaci\xF3n del producto en una frase"],
    prohibido: ["hero centrado con t\xEDtulo gigante", "tres tarjetas gemelas de features", "bot\xF3n azul por defecto"],
    accesibilidad: ["contraste AA", "labels en el formulario de demo"],
    responsive: ["precios legibles en m\xF3vil", "CTA accesible en pantallas peque\xF1as"],
    criterios: ["claridad de propuesta en 10s", "confianza visual", "cero plantilla"]
  },
  {
    categoria: "ecommerce",
    brief: "Tienda de caf\xE9 de especialidad: cat\xE1logo, notas de cata, suscripci\xF3n.",
    esperado: ["ficha de producto con datos sensoriales", "proceso de suscripci\xF3n claro", "carrito accesible"],
    prohibido: ["grid uniforme de tarjetas id\xE9nticas", "badges decorativos sin funci\xF3n"],
    accesibilidad: ["alt en im\xE1genes de producto", "contraste AA en precios"],
    responsive: ["grilla adaptativa real (no shrink)", "botones de compra t\xE1ctiles"],
    criterios: ["apetito visual", "jerarqu\xEDa de producto", "cero plantilla"]
  },
  {
    categoria: "finanzas",
    brief: "Web de una gestora patrimonial: sobriedad, n\xFAmeros, confianza regulatoria.",
    esperado: ["presentaci\xF3n de servicios con jerarqu\xEDa sobria", "datos con tipograf\xEDa tabular", "avisos legales visibles"],
    prohibido: ["gradientes vivos", "glassmorphism", "tono casual"],
    accesibilidad: ["contraste AA estricto", "tablas legibles por lectores"],
    responsive: ["tablas con scroll horizontal contenido", "n\xFAmeros sin corte"],
    criterios: ["sobriedad", "precisi\xF3n tipogr\xE1fica", "cero plantilla"]
  },
  {
    categoria: "tecnologia",
    brief: "Producto dev (SDK): documentaci\xF3n viva, quickstart, changelog.",
    esperado: ["bloques de c\xF3digo con copiar", "quickstart en 3 pasos", "navegaci\xF3n de docs"],
    prohibido: ["dashboard de cajitas decorativas", "iconos sin funci\xF3n"],
    accesibilidad: ["foco visible", "c\xF3digo con contraste suficiente"],
    responsive: ["c\xF3digo sin desborde horizontal", "nav colapsable"],
    criterios: ["utilidad dev", "velocidad percibida", "cero plantilla"]
  },
  {
    categoria: "restaurantes",
    brief: "Restaurante de autor: men\xFA, historia, reservas.",
    esperado: ["men\xFA legible con platos y precios", "reserva visible", "historia con voz propia"],
    prohibido: ["carrusel de fotos infinito", "hero centrado gen\xE9rico"],
    accesibilidad: ["alt en fotos de platos", "contraste AA en el men\xFA"],
    responsive: ["men\xFA usable en m\xF3vil", "bot\xF3n de reserva flotante o visible"],
    criterios: ["apetito", "car\xE1cter", "cero plantilla"]
  },
  {
    categoria: "portfolio",
    brief: "Portfolio de fot\xF3grafa: obra, series, contacto.",
    esperado: ["obra protagonista con espacio", "series navegables", "contacto directo"],
    prohibido: ["grid uniforme 3xN", "miniaturas id\xE9nticas sin ritmo"],
    accesibilidad: ["alt descriptivo en obra", "navegaci\xF3n por teclado"],
    responsive: ["obra a sangre o casi en m\xF3vil", "galer\xEDa sin scroll doble"],
    criterios: ["protagonismo de la obra", "ritmo visual", "cero plantilla"]
  },
  {
    categoria: "agencias",
    brief: "Agencia creativa: servicios, casos, equipo, cultura.",
    esperado: ["casos con resultado (no solo est\xE9tica)", "equipo con rostro real", "manifesto o cultura visible"],
    prohibido: ["blob background", "t\xEDtulo gigante + subt\xEDtulo + bot\xF3n (combo plantilla)"],
    accesibilidad: ["contraste AA", "textos alternativos en casos"],
    responsive: ["casos apilables con jerarqu\xEDa", "equipo legible en m\xF3vil"],
    criterios: ["personalidad", "prueba de trabajo", "cero plantilla"]
  },
  {
    categoria: "dashboards",
    brief: "Panel de m\xE9tricas de energ\xEDa para una f\xE1brica: consumo, alertas, hist\xF3rico.",
    esperado: ["representaci\xF3n de datos con narrativa (no cajitas)", "alertas con estado claro", "hist\xF3rico con contexto"],
    prohibido: ["dashboard de cajitas gen\xE9ricas", "3 tarjetas gemelas de KPI", "gr\xE1ficos sin etiquetas"],
    accesibilidad: ["datos con alternativa textual", "contraste AA en series"],
    responsive: ["priorizaci\xF3n de KPIs en m\xF3vil", "tablas navegables"],
    criterios: ["narrativa de datos", "estado y acci\xF3n", "cero plantilla"]
  },
  {
    categoria: "landing",
    brief: "Landing de un evento de m\xFAsica: lineup, entradas, lugar.",
    esperado: ["lineup con jerarqu\xEDa real", "compra de entradas evidente", "lugar con contexto"],
    prohibido: ["gradientes de ne\xF3n gen\xE9ricos", "cuenta atr\xE1s decorativa sin compra"],
    accesibilidad: ["contraste AA sobre fondo vivo", "botones de compra etiquetados"],
    responsive: ["lineup apilable", "compra en 1 toque"],
    criterios: ["energ\xEDa", "claridad de compra", "cero plantilla"]
  },
  {
    categoria: "webapp",
    brief: "App de gesti\xF3n para cl\xEDnicas: pacientes, citas, facturaci\xF3n.",
    esperado: ["navegaci\xF3n de m\xF3dulos clara", "formularios con validaci\xF3n", "estados vac\xEDos \xFAtiles"],
    prohibido: ["tablas sin orden ni b\xFAsqueda", "modales anidados sin foco"],
    accesibilidad: ["labels completos", "foco gestionado en di\xE1logos"],
    responsive: ["tablas \u2192 tarjetas en m\xF3vil", "navegaci\xF3n accesible"],
    criterios: ["eficiencia cl\xEDnica", "confianza", "cero plantilla"]
  }
];
function casoPorCategoria(cat) {
  return CASOS_BENCHMARK.find((c) => c.categoria === cat);
}
function correrCaso(caso, html) {
  const informe = revisarVisual(html);
  const gen1 = detectarGenericidad(html);
  const gen2 = analisisVisual(html);
  const inspector = chequeosEstaticos(html);
  const cuerpo = html.toLowerCase();
  const esperadosOk = [];
  const esperadosFaltan = [];
  for (const e of caso.esperado) {
    const pistas = e.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const presente = pistas.some((p) => cuerpo.includes(p));
    (presente ? esperadosOk : esperadosFaltan).push(e);
  }
  const nombresSintomas = [...gen1.sintomas.map((s) => s.nombre.toLowerCase()), ...gen2.sintomas.map((s) => s.nombre.toLowerCase())];
  const prohibidosDetectados = caso.prohibido.filter((p) => {
    const pistas = p.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    return pistas.some((pista) => nombresSintomas.some((n) => n.includes(pista)));
  });
  const graves = inspector.filter((h) => h.severidad === "critico").length + prohibidosDetectados.length;
  const identidad = Math.round(gen1.puntuacionIdentidad * 0.5 + gen2.puntuacion * 0.5);
  const score = Math.max(0, Math.min(100, scoreDe(informe) - prohibidosDetectados.length * 8));
  const veredicto = graves > 0 ? "FAIL" : prohibidosDetectados.length > 0 || informe.veredicto === "WARN" ? "WARN" : "PASS";
  return {
    categoria: caso.categoria,
    score,
    esperadosOk,
    esperadosFaltan,
    prohibidosDetectados,
    graves,
    identidad,
    veredicto,
    evidencia: [
      `Inspector: ${inspector.length} hallazgo(s) (${graves} graves).`,
      `Anti-gen\xE9rico: saturaci\xF3n ${gen1.nivel} (identidad ${identidad}/100).`,
      esperadosFaltan.length ? `Esperados sin detectar: ${esperadosFaltan.join("; ")}.` : `Todos los esperados detectados.`,
      prohibidosDetectados.length ? `Prohibidos detectados: ${prohibidosDetectados.join("; ")}.` : `Ning\xFAn patr\xF3n prohibido de la categor\xEDa.`
    ]
  };
}
function correrBenchmark(htmlPorCategoria) {
  const resultados = [];
  for (const caso of CASOS_BENCHMARK) {
    const html = htmlPorCategoria[caso.categoria];
    if (html) resultados.push(correrCaso(caso, html));
  }
  const scoreMedio = resultados.length ? Math.round(resultados.reduce((s, r) => s + r.score, 0) / resultados.length) : 0;
  const passes = resultados.filter((r) => r.veredicto === "PASS").length;
  const warns = resultados.filter((r) => r.veredicto === "WARN").length;
  const fails = resultados.filter((r) => r.veredicto === "FAIL").length;
  return {
    resultados,
    scoreMedio,
    resumen: `Benchmark: ${resultados.length} caso(s), score medio ${scoreMedio}/100 \u2014 ${passes} PASS, ${warns} WARN, ${fails} FAIL.`
  };
}

// src/lib/prism/forja/arena.ts
var CRITERIOS_ARENA = [
  "jerarquia",
  "color",
  "tipografia",
  "accesibilidad",
  "originalidad"
];
var MAX_HTML_JUZGADO = 7e3;
var MAX_CODIGO_JUZGADO = 9e3;
function promptJuez(criteriosDelUsuario) {
  return `## Qui\xE9n eres
Eres el JUEZ de la Arena de FORJA IA: un director de arte senior imparcial.
La misma petici\xF3n se la han resuelto DOS equipos (A y B); t\xFA la punt\xFAas con
criterio, sin favoritismos y sin saber nada m\xE1s de ellos.

## Criterios (0 a 10 cada uno; 5 = mediocre, 9-10 = excepcional, s\xE9 exigente)
- jerarquia: en 10 segundos se entiende qu\xE9 mirar primero, segundo y tercero.
- color: paleta coherente, contraste real, el acento solo en lo importante.
- tipografia: pareja tipogr\xE1fica con intenci\xF3n y escala con ritmo claro.
- accesibilidad: foco visible, contrastes AA, labels/aria correctos, orden de lectura.
- originalidad: personalidad propia SIN sacrificar usabilidad ni claridad.${criteriosDelUsuario?.trim() ? `

## Peso extra del due\xF1o del proyecto
\xAB${criteriosDelUsuario.trim().slice(0, 200)}\xBB \u2014 si afecta a un criterio, se lo suma o resta ah\xED, y si es un criterio nuevo, refl\xE9jalo en el m\xE1s cercano.` : ""}

## C\xF3mo juzgas
- Juzgas lo que ves (ficha de dise\xF1o y maqueta/c\xF3digo entregado), no promesas.
- Empata criterios solo si de verdad son equivalentes; no repartas 7s por comodidad.
- Penaliza con firmeza: placeholders sin estilo, jerarqu\xEDa plana, color por defecto del navegador, textos falsos sin contenido real.

## Salida OBLIGATORIA (etiquetas exactas, sin JSON y sin markdown dentro)
<puntuacion equipo="A" criterio="jerarquia">7</puntuacion>
<puntuacion equipo="A" criterio="color">6</puntuacion>
<puntuacion equipo="A" criterio="tipografia">7</puntuacion>
<puntuacion equipo="A" criterio="accesibilidad">8</puntuacion>
<puntuacion equipo="A" criterio="originalidad">5</puntuacion>
<puntuacion equipo="B" criterio="jerarquia">8</puntuacion>
\u2026 (las 10 l\xEDneas: 5 criterios \xD7 2 equipos)
<ganador>A</ganador>
<razones>3 a 5 frases: por qu\xE9 gana el que gana, qu\xE9 le falt\xF3 al otro y qu\xE9 copiar\xEDa del perdedor.</razones>

## Despu\xE9s, las LECCIONES para la siguiente generaci\xF3n
Del veredicto sacas 2 a 4 lecciones REUTILIZABLES (a nivel de patr\xF3n, no de
p\xEDxel) con estas etiquetas exactas:
<lecciones>
<leccion tipo="destacar" equipo="B">qu\xE9 hizo muy bien el ganador y se repetir\xE1</leccion>
<leccion tipo="conservar" equipo="A">qu\xE9 hizo bien el perdedor y merece conservarse</leccion>
<leccion tipo="evitar" equipo="A">qu\xE9 patr\xF3n del perdedor produjo el resultado inferior</leccion>
</lecciones>
Reglas de las lecciones: una l\xEDnea cada una (m\xE1x. 200 caracteres), concreta
(\xABla jerarqu\xEDa del hero guiaba la mirada en 3 pasos\xBB) y generalizable
(\xABevitar el carrusel autom\xE1tico del hero\xBB, no \xABevitar el azul del equipo A\xBB).`;
}
function mensajeJuez(peticion, modo2, ma, mb) {
  const bloque = (nombre, m) => {
    const artefacto = modo2 === "maquetas" ? `# Maqueta HTML (recortada)
${(m.maqueta?.html || "(sin maqueta HTML)").slice(0, MAX_HTML_JUZGADO)}` : `# C\xF3digo entregado (recortado)
${(m.codigo || "(sin c\xF3digo)").slice(0, MAX_CODIGO_JUZGADO)}`;
    return [
      `## EQUIPO ${nombre}`,
      `# Ficha de dise\xF1o`,
      m.ficha,
      artefacto,
      ""
    ].join("\n");
  };
  return [
    `# Petici\xF3n original del usuario
${peticion.mensaje}`,
    peticion.codigoActual ? `(Proyecto existente: es una edici\xF3n sobre c\xF3digo actual.)` : "",
    bloque("A", ma),
    bloque("B", mb)
  ].filter(Boolean).join("\n\n");
}
function parseVeredictoArena(texto) {
  const valor = (crudo) => {
    const n = Math.round(Number(crudo));
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 5;
  };
  const notas = { A: {}, B: {} };
  const re = /<puntuacion\s+(?:equipo="(A|B)"\s+criterio="([a-záéíóú]+)"|criterio="([a-záéíóú]+)"\s+equipo="(A|B)")\s*>\s*([\d.]+)\s*<\/puntuacion>/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const equipo = (m[1] ?? m[4])?.toUpperCase();
    const criterio = normalizarCriterio(m[2] ?? m[3] ?? "");
    if (equipo !== "A" && equipo !== "B") continue;
    if (!criterio) continue;
    notas[equipo][criterio] = valor(m[5]);
  }
  const puntuacion = (equipo) => {
    const n = notas[equipo];
    const p = {
      jerarquia: n.jerarquia ?? 5,
      color: n.color ?? 5,
      tipografia: n.tipografia ?? 5,
      accesibilidad: n.accesibilidad ?? 5,
      originalidad: n.originalidad ?? 5,
      total: 0
    };
    p.total = CRITERIOS_ARENA.reduce((s, c) => s + p[c], 0);
    return p;
  };
  const A = puntuacion("A");
  const B = puntuacion("B");
  const razones = (texto.match(/<razones>([\s\S]*?)<\/razones>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 700);
  let ganador;
  if (A.total > B.total) ganador = "A";
  else if (B.total > A.total) ganador = "B";
  else {
    const etiqueta = texto.match(/<ganador>\s*(A|B|empate)\s*<\/ganador>/i)?.[1]?.toLowerCase();
    ganador = etiqueta === "a" ? "A" : etiqueta === "b" ? "B" : "empate";
  }
  return { ganador, A, B, razones };
}
function parseLeccionesArena(texto) {
  if (!texto) return [];
  const bloque = texto.match(/<lecciones>([\s\S]*?)<\/lecciones>/i);
  const fuente = bloque ? bloque[1] : texto;
  const out = [];
  const re = /<leccion\s+([\s\S]*?)>([\s\S]*?)<\/leccion>/gi;
  let m;
  while ((m = re.exec(fuente)) !== null && out.length < 6) {
    const attrs = m[1];
    const tipoCrudo = attrs.match(/tipo\s*=\s*"?([a-z_áéíóú]+)"?/i)?.[1] ?? "";
    const tipo = tipoCrudo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (tipo !== "destacar" && tipo !== "conservar" && tipo !== "evitar") continue;
    const equipoCrudo = attrs.match(/equipo\s*=\s*"?(A|B)"?/i)?.[1]?.toUpperCase();
    const cuerpo = m[2].replace(/\s+/g, " ").trim().slice(0, 220);
    if (cuerpo.length < 15) continue;
    out.push({ tipo, texto: cuerpo, equipo: equipoCrudo });
  }
  return out;
}
function normalizarCriterio(s) {
  const t = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return CRITERIOS_ARENA.find((c) => c === t);
}
async function arenaForja(peticion, cfgA, depsA, arena, fallback) {
  const modo2 = arena.modo ?? (debeMaquetar(peticion, cfgA) ? "maquetas" : "completa");
  const peticionArena = modo2 === "maquetas" ? { ...peticion, modo: "maqueta" } : { ...peticion, modo: "directo" };
  const envolver = (equipo, deps) => ({
    ...deps,
    onProgreso: deps.onProgreso ? (ev) => deps.onProgreso?.({ tipo: "arena", equipo, evento: ev }) : void 0
  });
  const [resA, resB] = await Promise.all([
    ejecutarForja(peticionArena, cfgA, envolver("A", depsA), fallback),
    ejecutarForja(peticionArena, arena.equipoB, envolver("B", arena.depsB), fallback)
  ]);
  const ma = {
    ficha: resA.fichaTexto,
    maqueta: resA.maqueta,
    codigo: resA.codigo
  };
  const mb = {
    ficha: resB.fichaTexto,
    maqueta: resB.maqueta,
    codigo: resB.codigo
  };
  const juez = arena.juez ?? fallback;
  const { veredicto, lecciones } = await puntuar(
    peticion,
    modo2,
    ma,
    mb,
    juez,
    depsA.llamarModelo,
    arena.criteriosDelUsuario
  );
  const ganadorResultado = veredicto.ganador === "B" ? resB : resA;
  const ganadorConfig = veredicto.ganador === "B" ? arena.equipoB : cfgA;
  return {
    equipoA: resA,
    equipoB: resB,
    veredicto,
    ganadorResultado,
    ganadorConfig,
    modo: modo2,
    lecciones,
    respuesta: construirRespuestaArena(modo2, veredicto, resA, resB, lecciones)
  };
}
async function puntuar(peticion, modo2, ma, mb, juez, llamar, criteriosDelUsuario) {
  try {
    const texto = await llamar({
      providerId: juez.providerId,
      modelId: juez.modelId,
      system: promptJuez(criteriosDelUsuario),
      user: mensajeJuez(peticion, modo2, ma, mb),
      temperatura: 0.2
    });
    const v = parseVeredictoArena(texto);
    if (!v.razones && v.A.total === 25 && v.B.total === 25) {
      return {
        veredicto: {
          ...v,
          ganador: "empate",
          razones: "El juez no devolvi\xF3 un veredicto legible: empate por defecto. Puedes continuar con cualquiera de los dos equipos."
        },
        lecciones: []
      };
    }
    return { veredicto: v, lecciones: parseLeccionesArena(texto) };
  } catch {
    return {
      veredicto: {
        ganador: "empate",
        A: puntuacionNeutra(),
        B: puntuacionNeutra(),
        razones: "El juez no pudo puntuar (cuota o respuesta vac\xEDa): empate. Elige t\xFA la propuesta que m\xE1s te guste \u2014 ambas est\xE1n completas."
      },
      lecciones: []
    };
  }
}
function puntuacionNeutra() {
  return { jerarquia: 5, color: 5, tipografia: 5, accesibilidad: 5, originalidad: 5, total: 25 };
}
function construirRespuestaArena(modo2, veredicto, resA, resB, lecciones = []) {
  const nombre = (r) => {
    const primera = r.maqueta?.direcciones?.[0]?.nombre;
    return primera ? `\xAB${primera}\xBB` : r.ficha?.tipoWeb || "propuesta";
  };
  const fila = (c) => `| ${c.charAt(0).toUpperCase() + c.slice(1)} | ${veredicto.A[c]} | ${veredicto.B[c]} |`;
  const titular = veredicto.ganador === "empate" ? "\u2696\uFE0F **Empate** \u2014 el juez no vio diferencias decisivas." : `\u{1F3C6} **Gana el Equipo ${veredicto.ganador}** con ${nombre(veredicto.ganador === "A" ? resA : resB)}.`;
  const modoTexto = modo2 === "maquetas" ? "Duelo de DISE\xD1O: dos equipos propusieron, maquetaron y solo el ganador pasa a producci\xF3n." : "Duelo COMPLETO: los dos equipos entregaron c\xF3digo final y el juez compar\xF3 las entregas.";
  const veredictoTexto = veredicto.razones || "Sin razones del juez (respuesta vac\xEDa).";
  const aprendido = lecciones.length ? `

### Lo que FORJA IA aprendi\xF3 en este duelo
${lecciones.map((l) => {
    const icono = l.tipo === "destacar" ? "\u2726" : l.tipo === "conservar" ? "\u2295" : "\u2715";
    const tipo = l.tipo === "destacar" ? "Destacar" : l.tipo === "conservar" ? "Conservar" : "Evitar";
    const de = l.equipo ? ` (Equipo ${l.equipo})` : "";
    return `- ${icono} **${tipo}**${de}: ${l.texto}`;
  }).join("\n")}
Estas lecciones entran al conocimiento como experimentos, patrones y fallos: la siguiente generaci\xF3n de dise\xF1os parte de aqu\xED.` : "";
  return `## La Arena de FORJA IA

${modoTexto}

| Criterio | Equipo A | Equipo B |
|---|---|---|
${CRITERIOS_ARENA.map(fila).join("\n")}
| **Total** | **${veredicto.A.total}/50** | **${veredicto.B.total}/50** |

${titular}

**Por qu\xE9:** ${veredictoTexto}${aprendido}

Las dos propuestas est\xE1n guardadas: puedes seguir con el ganador o decirme \xABsigo con el equipo ${veredicto.ganador === "A" ? "B" : "A"}\xBB y trabajo con esa. Y si el ganador tiene maqueta, apru\xE9bala o aj\xFAstala como siempre.`;
}

// src/lib/prism/forja/director.ts
var JUECES_ESTUDIO = [
  {
    id: "visual",
    nombre: "Juez visual",
    criterios: ["jerarquia", "color", "tipografia"],
    instruccion: "Juzgas SOLO la mirada: \xBFen 10 segundos se entiende qu\xE9 mirar primero? \xBFLa paleta es propia y coherente (60-30-10, contraste real)? \xBFLa tipograf\xEDa tiene intenci\xF3n y escala con ritmo? Ignoras accesibilidad t\xE9cnica y originalidad: no te tocan."
  },
  {
    id: "ux",
    nombre: "Juez UX y accesibilidad",
    criterios: ["accesibilidad", "responsive"],
    instruccion: "Juzgas SOLO uso y accesibilidad: contraste AA, alt, labels, foco visible, sem\xE1ntica, un solo h1; \xBFfunciona a 375px con \xE1reas t\xE1ctiles de 44px y sin scroll horizontal? Ignoras est\xE9tica y originalidad: no te tocan."
  },
  {
    id: "originalidad",
    nombre: "Juez de originalidad",
    criterios: ["originalidad"],
    instruccion: "Juzgas SOLO identidad: \xBFesto se distingue de una plantilla de IA? Recibir\xE1s el INFORME ANTI-GEN\xC9RICO de cada visi\xF3n (detecci\xF3n autom\xE1tica de patrones gen\xE9ricos): \xFAsalo como evidencia f\xEDsica. Sin s\xEDntomas no basta para un 10: premia la decisi\xF3n compositiva que se recuerda (\xABla web de los nodos\xBB, \xABel mapa vivo\xBB), no la decoraci\xF3n."
  }
];
function extraerFicha(texto) {
  const bloque = texto.match(/<ficha>([\s\S]*?)<\/ficha>/i);
  if (bloque) return bloque[1].trim();
  const idx = texto.search(/tipo de web\s*:/i);
  return idx >= 0 ? texto.slice(idx).trim() : "";
}
function parseVisiones(texto) {
  if (!texto) return [];
  const bloque = texto.match(/<visiones>([\s\S]*?)<\/visiones>/i);
  const fuente = bloque ? bloque[1] : texto;
  const out = [];
  const re = /^\s*(\d)[.)]\s*(.+?)\s*[—–-]\s*(.+?)(?:\s*[—–-]\s*(.+?))?\s*$/gm;
  let m;
  while ((m = re.exec(fuente)) !== null && out.length < 3) {
    const n = Number(m[1]);
    if (n < 1 || n > 3) continue;
    if (out.some((v) => v.n === n)) continue;
    const enfoque = m[3].trim().slice(0, 220);
    if (enfoque.length < 10) continue;
    out.push({
      n,
      nombre: m[2].trim().slice(0, 48),
      enfoque,
      porQue: (m[4] ?? "").trim().slice(0, 200)
    });
  }
  return out;
}
function parseFusion(texto, defectoBase) {
  const bloque = texto.match(/<fusion([^>]*)>([\s\S]*?)<\/fusion>/i);
  const attrs = bloque?.[1] ?? texto;
  const cuerpo = bloque?.[2] ?? texto ?? "";
  const baseAttr = attrs.match(/base\s*=\s*"?([123])"?/i)?.[1];
  const baseTexto = cuerpo.match(/base\s*[:=]\s*(?:visi[óo]n\s*)?([123])/i)?.[1];
  const base = Number(baseAttr ?? baseTexto ?? defectoBase) || defectoBase;
  const listaDe = (nombre) => {
    const m = cuerpo.match(new RegExp(`<${nombre}>([\\s\\S]*?)<\\/${nombre}>`, "i"));
    if (!m) return [];
    return m[1].split(/\n+/).map((l) => l.trim().replace(/^[-*\d.)\s]+/, "").trim()).filter((l) => l.length >= 8).slice(0, 4).map((l) => l.slice(0, 200));
  };
  return {
    base,
    adoptar: listaDe("adoptar"),
    evitar: listaDe("evitar"),
    razones: (cuerpo.match(/<razones>([\s\S]*?)<\/razones>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 600)
  };
}
var NFD = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function parseNotasJuez(texto, juez) {
  const notas = { 1: {}, 2: {}, 3: {} };
  const re = /<puntuacion\s+(?:vision="([123])"\s+criterio="([a-záéíóú]+)"|criterio="([a-záéíóú]+)"\s+vision="([123])")\s*>\s*([\d.]+)\s*<\/puntuacion>/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const vision = Number(m[1] ?? m[4]);
    const criterio = NFD(m[2] ?? m[3] ?? "");
    if (vision !== 1 && vision !== 2 && vision !== 3) continue;
    if (!juez.criterios.some((c) => NFD(c) === criterio)) continue;
    const n = Math.round(Number(m[5]));
    notas[vision][criterio] = Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 5;
  }
  const total = [1, 2, 3].map((v) => {
    const porCriterio = juez.criterios.map((c) => notas[v][NFD(c)] ?? 5);
    return porCriterio.reduce((s, x) => s + x, 0);
  });
  return {
    notas,
    total,
    razones: (texto.match(/<razones>([\s\S]*?)<\/razones>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
    lecciones: parseLeccionesArena(texto)
  };
}
function promptJuezEstudio(juez, criteriosDelUsuario) {
  const criterios = juez.criterios.map((c) => `- ${c}: 0 a 10 (5 = mediocre, 9-10 = excepcional, s\xE9 exigente)`).join("\n");
  return `## Qui\xE9n eres
Eres el ${juez.nombre} del panel del Estudio de FORJA IA: especialista
imparcial. La misma petici\xF3n la resolvieron TRES visiones del mismo ADN
(visi\xF3n 1, 2 y 3); t\xFA punt\xFAas SOLO tu especialidad en cada una.

## Tu especialidad
${juez.instruccion}

## Tus criterios (0..10)
${criterios}${criteriosDelUsuario?.trim() ? `

## Peso extra del due\xF1o del proyecto
\xAB${criteriosDelUsuario.trim().slice(0, 200)}\xBB \u2014 si afecta a tus criterios, refl\xE9jalo en la nota.` : ""}

## C\xF3mo juzgas
- Juzgas lo que ves (ficha + maqueta HTML), no promesas.
- S\xE9 exigente y diferenciador: no repartas 7s por comodidad.
- Si una visi\xF3n no tiene maqueta disponible, ponle 3 y dilo en razones.

## Salida OBLIGATORIA (etiquetas exactas, sin JSON)
<puntuacion vision="1" criterio="${juez.criterios[0]}">7</puntuacion>
\u2026 (una por criterio y visi\xF3n: ${juez.criterios.length} \xD7 3)
<razones>2-4 frases comparando las tres visiones desde TU especialidad</razones>

Y SOLO si ves algo reutilizable a nivel de patr\xF3n:
<lecciones>
<leccion tipo="conservar" vision="2">qu\xE9 hizo bien y merece conservarse en la fusi\xF3n</leccion>
<leccion tipo="evitar" vision="1">qu\xE9 patr\xF3n produjo el resultado inferior</leccion>
</lecciones>
Una l\xEDnea por lecci\xF3n (m\xE1x 200 caracteres), concreta y generalizable.`;
}
function promptDirectorFinal() {
  return `## Qui\xE9n eres
Eres el DIRECTOR FINAL del Estudio de FORJA IA. Tres maquetadores
materializaron tres visiones del mismo ADN; el panel (visual, UX,originalidad) ya las puntu\xF3. Tu trabajo NO es repetir el veredicto: es
dise\xF1ar la FUSI\xD3N \u2014 el dise\xF1o final que este proyecto merece.

## C\xF3mo decides
1. Eliges la BASE: la visi\xF3n que mejor resuelve el problema (composici\xF3n y
   contenido). La fusi\xF3n NO es un empate de cosas: es un dise\xF1o coherente
   con un solo punto de vista.
2. Dictas qu\xE9 ADOPTAR de las otras visiones: elementos concretos que el
   panel valor\xF3 y que encajan sin romper la base (2-4, una l\xEDnea cada uno).
3. Dictas qu\xE9 EVITAR: patrones que el panel penaliz\xF3 o que el informe
   anti-gen\xE9rico detect\xF3 (1-3).

## Salida OBLIGATORIA (etiquetas exactas, sin JSON)
<fusion base="1">
<adoptar>
- de la visi\xF3n 2: [elemento concreto y por qu\xE9]
- \u2026
</adoptar>
<evitar>
- [patr\xF3n a no repetir y por qu\xE9]
- \u2026
</evitar>
<razones>3-5 frases: por qu\xE9 esta base, qu\xE9 aporta cada adopci\xF3n y c\xF3mo quedar\xE1 el dise\xF1o final.</razones>
</fusion>`;
}
var MAX_HTML_JUEZ = 7e3;
var MAX_HTML_DIRECTOR = 4500;
function mensajePanel(peticion, adn, visiones, maquetas, informes, juez) {
  const bloques = visiones.map((v, i) => {
    const m = maquetas[i];
    const informe = informes[i];
    const partes = [
      `## VISI\xD3N ${v.n}: \xAB${v.nombre}\xBB`,
      `Enfoque: ${v.enfoque}`,
      m?.html ? `# Maqueta (recortada)
${m.html.slice(0, MAX_HTML_JUEZ)}` : `# Maqueta: NO DISPONIBLE (fall\xF3 su generaci\xF3n)`
    ];
    if (juez.id === "originalidad" && informe) {
      partes.push(
        `# INFORME ANTI-GEN\xC9RICO (evidencia autom\xE1tica)
Nivel de saturaci\xF3n: ${informe.nivel.toUpperCase()} \xB7 Identidad ${informe.puntuacionIdentidad}/100
${informe.sintomas.length ? informe.sintomas.map((s) => `- ${s.nombre}: ${s.motivo}`).join("\n") : "- sin s\xEDntomas de plantilla detectados"}`
      );
    }
    return partes.join("\n\n");
  });
  return [
    `# Petici\xF3n original del usuario
${peticion.mensaje}`,
    `# ADN visual com\xFAn de las tres visiones
${textoAdn(adn)}`,
    ...bloques
  ].join("\n\n");
}
function mensajeDirectorFinal(peticion, adn, visiones, maquetas, informes, panel, lecciones) {
  const bloques = visiones.map((v, i) => {
    const m = maquetas[i];
    const informe = informes[i];
    return [
      `## VISI\xD3N ${v.n}: \xAB${v.nombre}\xBB \u2014 total del panel: ${panel.totales[i]}/60`,
      `Enfoque: ${v.enfoque}`,
      m?.html ? `# Maqueta (recortada)
${m.html.slice(0, MAX_HTML_DIRECTOR)}` : `# Maqueta NO DISPONIBLE`,
      informe && informe.sintomas.length ? `# Anti-gen\xE9rico: ${resumenAntiGenerico(informe)}` : ""
    ].filter(Boolean).join("\n\n");
  });
  const mirada = panel.jueces.map((j) => `- ${j.nombre}: ${j.total.join(" / ")} (V1/V2/V3)${j.razones ? ` \u2014 \xAB${j.razones.slice(0, 220)}\xBB` : ""}`).join("\n");
  const lecs = lecciones.length ? lecciones.map((l) => `- [${l.tipo}] ${l.texto}`).join("\n") : "(el panel no dej\xF3 lecciones)";
  return [
    `# Petici\xF3n original del usuario
${peticion.mensaje}`,
    `# ADN visual com\xFAn
${textoAdn(adn)}`,
    `# Veredicto del panel
${mirada}
Lecciones del panel:
${lecs}`,
    ...bloques
  ].join("\n\n");
}
function mensajeFusion(peticion, fichaTexto, adn, fusion, visiones) {
  const base = visiones.find((v) => v.n === fusion.base);
  const adoptar = fusion.adoptar.length ? fusion.adoptar.map((a) => `- ${a}`).join("\n") : "- (nada concreto: mant\xE9n la base con coherencia)";
  const evitar = fusion.evitar.length ? fusion.evitar.map((a) => `- ${a}`).join("\n") : "- los patrones gen\xE9ricos del bloque Anti-gen\xE9rico";
  return `# Ficha de dise\xF1o base del estudio
${fichaTexto}

${seccionAdn(adn)}

${seccionAntiGenerico()}

## FUSI\xD3N DEL DIRECTOR FINAL (obligatoria)
Toma como BASE la maqueta de la visi\xF3n ${fusion.base}${base ? ` (\xAB${base.nombre}\xBB: ${base.enfoque})` : ""} \u2014 conservas su composici\xF3n, su representaci\xF3n de la informaci\xF3n y su contenido \u2014 y ADOPTA de las otras visiones EXACTAMENTE esto:
${adoptar}

EVITA:
${evitar}

El resultado debe leerse como UN dise\xF1o coherente, no como un collage.

# Petici\xF3n original del usuario
${peticion.mensaje}`;
}
function construirRespuestaEstudio(visiones, panel, fusion, informes, lecciones, hayHtmlFusion) {
  const filaJuez = (j) => `| ${j.nombre}${j.ausente ? " (ausente)" : ""} | ${j.total[0]} | ${j.total[1]} | ${j.total[2]} |`;
  const ganadorVision = visiones.find((v) => v.n === panel.ganador);
  const titular = `\u{1F3C6} El panel elige la **Visi\xF3n ${panel.ganador}**${ganadorVision ? ` \xAB${ganadorVision.nombre}\xBB` : ""} con ${panel.totales[panel.ganador - 1]}/60, y el Director Final fusiona desde ah\xED.`;
  const lineaInforme = (i) => {
    const inf = informes[i];
    if (!inf) return `- Visi\xF3n ${i + 1}: sin informe (maqueta no generada)`;
    if (inf.sintomas.length === 0)
      return `- Visi\xF3n ${i + 1}: limpio \u2014 identidad ${inf.puntuacionIdentidad}/100`;
    return `- Visi\xF3n ${i + 1}: saturaci\xF3n ${inf.nivel.toUpperCase()} (${inf.puntuacionIdentidad}/100) \u2014 ${inf.sintomas.map((s) => s.nombre).join(", ")}`;
  };
  const fusionTexto = [
    `### Dise\xF1o fusi\xF3n`,
    `- **Base:** visi\xF3n ${fusion.base}${visiones.find((v) => v.n === fusion.base) ? ` \xAB${visiones.find((v) => v.n === fusion.base).nombre}\xBB` : ""}`,
    fusion.adoptar.length ? `- **Adoptar:**
${fusion.adoptar.map((a) => `  - ${a}`).join("\n")}` : "",
    fusion.evitar.length ? `- **Evitar:**
${fusion.evitar.map((a) => `  - ${a}`).join("\n")}` : "",
    fusion.razones ? `
**Por qu\xE9:** ${fusion.razones}` : ""
  ].filter(Boolean).join("\n");
  const aprendido = lecciones.length ? `

### Lo que FORJA IA aprendi\xF3 en este estudio
${lecciones.map((l) => {
    const icono = l.tipo === "destacar" ? "\u2726" : l.tipo === "conservar" ? "\u2295" : "\u2715";
    return `- ${icono} **${l.tipo.charAt(0).toUpperCase()}${l.tipo.slice(1)}**: ${l.texto}`;
  }).join("\n")}
Estas lecciones entran al conocimiento (experimentos, patrones y fallos): la siguiente generaci\xF3n parte de aqu\xED.` : "";
  const estadoHtml = hayHtmlFusion ? "Tienes la maqueta FUSIONADA en la vista previa." : "No pude generar la maqueta fusionada (cuota o red): elige visi\xF3n abajo y contin\xFAo con ella.";
  return `## El Estudio de FORJA IA

**C\xF3mo ha funcionado:** Director Creativo \u2192 3 visiones divergentes en paralelo \u2192 Panel de Jueces (visual \xB7 UX/accesibilidad \xB7 originalidad) \u2192 Director Final \u2192 Dise\xF1o fusi\xF3n.

### Panel de Jueces
| Juez | Visi\xF3n 1 | Visi\xF3n 2 | Visi\xF3n 3 |
|---|---|---|---|
${panel.jueces.map(filaJuez).join("\n")}
| **Total (m\xE1x 60)** | **${panel.totales[0]}** | **${panel.totales[1]}** | **${panel.totales[2]}** |

${titular}

${fusionTexto}

### Anti-gen\xE9rico por visi\xF3n
${informes.map((_, i) => lineaInforme(i)).join("\n")}${aprendido}

${estadoHtml}

**Para continuar:** \xABAprobado\xBB \u2192 el equipo codifica la fusi\xF3n \xB7 \xABAjusta: \u2026\xBB \u2192 corrijo la fusi\xF3n \xB7 \xABUso la visi\xF3n 2/3\xBB \u2192 contin\xFAo con esa base tal cual.`;
}
function preparar(peticion, cfg, deps) {
  const reglas = reglasParaPrompt(deps.memoria);
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;
  const reglasGlobales = (peticion.conocimientoGlobal ?? []).slice(0, PERFILES[perfil].reglasGlobales);
  const sugeridas = /* @__PURE__ */ new Set([...cfg.habilidades, ...habilidadesSugeridas(peticion.mensaje)]);
  return { bloques: bloquesDeHabilidades([...sugeridas]), reglas, reglasGlobales };
}
async function estudioForja(peticion, cfg, deps, fallback, opciones = {}) {
  const rondas = [];
  let contadorRondas = 0;
  const ev = (fase, extra = {}) => deps.onProgreso?.({ tipo: "estudio", fase, ...extra });
  const temp = (rol) => cfg.temperaturaPorRol?.[rol] ?? EQUIPO_FORJA[rol].temperatura;
  const llamada = async (rol, system, user, artefacto, modeloOverride) => {
    const modelo = modeloOverride ?? cfg.porRol[rol] ?? fallback;
    const clave2 = `${modelo.providerId}:${modelo.modelId}`;
    const ronda = ++contadorRondas;
    deps.onProgreso?.({ tipo: "rol-inicio", rol, ronda, modelo: clave2 });
    const t0 = Date.now();
    let salida = "";
    try {
      salida = await deps.llamarModelo({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system,
        user,
        temperatura: temp(rol),
        onFragmento: (t) => deps.onProgreso?.({ tipo: "fragmento", rol, texto: t }),
        rol,
        // v4.1: para el techo de salida y la cadena de failover del adaptador
        maxTokens: techoTokens(cfg, rol)
        // v4.2: presupuesto por rol desde la config
      });
      const res = await continuarSalidaTruncada({
        salida,
        continuarCon: continuarConLlamada(deps.llamarModelo, {
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system,
          temperatura: temp(rol),
          rol,
          maxTokens: techoTokens(cfg, rol),
          onFragmento: (t) => deps.onProgreso?.({ tipo: "fragmento", rol, texto: t })
        }),
        onContinuacion: (n) => deps.onProgreso?.({ tipo: "continuacion-nucleo", rol, ronda, n })
      });
      salida = res.texto;
    } finally {
      rondas.push({ n: ronda, rol, artefacto, salida, modeloUsado: clave2, duracionMs: Date.now() - t0 });
      deps.onProgreso?.({ tipo: "rol-fin", rol, ronda, ok: salida.length > 0 });
    }
    return salida;
  };
  ev("director", { detalle: "El Dise\xF1ador dirige: ADN + 3 visiones divergentes" });
  const { bloques, reglas, reglasGlobales } = preparar(peticion, cfg, deps);
  let textoDirector = "";
  try {
    textoDirector = await llamada(
      "disenador",
      promptDisenador(bloques, reglas, reglasGlobales, false, true, seccionRepresentacion(peticion.mensaje)),
      mensajeDisenador(peticion),
      "direcciones"
    );
  } catch {
    textoDirector = "";
  }
  const visiones = parseVisiones(textoDirector);
  const fichaTexto = extraerFicha(textoDirector);
  if (visiones.length < 2 || !fichaTexto) {
    ev("fallback", { detalle: "Visiones no legibles: se contin\xFAa con el pipeline normal" });
    const res = await ejecutarForja(peticion, cfg, deps, fallback);
    return {
      modo: "estudio",
      adn: res.adn ?? sanearAdn(adnDesdePeticion(peticion.mensaje)),
      visiones: [],
      maquetas: [],
      informes: [],
      panel: { jueces: [], totales: [0, 0, 0], ganador: 1 },
      fusion: { base: 1, adoptar: [], evitar: [], razones: "" },
      propuesta: res.maqueta ?? { direcciones: [], html: "", eleccion: 1, estado: "propuesta", notas: "", ajustes: 0 },
      fichaTexto: res.fichaTexto,
      lecciones: [],
      rondas: res.rondas,
      respuesta: res.respuesta,
      fallbackUsado: true,
      resultadoFallback: res
    };
  }
  const adn = sanearAdn(parseAdn(textoDirector) ?? adnDesdePeticion(peticion.mensaje));
  ev("maquetas", { total: visiones.length, hecho: 0 });
  const modeloCodificador = cfg.porRol.codificador ?? fallback;
  const maquetas = await Promise.all(
    visiones.map(async (v, i) => {
      try {
        ev("maquetas", { detalle: `visi\xF3n ${v.n}: ${v.nombre}`, hecho: i, total: visiones.length });
        const user = [
          `# Ficha de dise\xF1o base del estudio
${fichaTexto}`,
          seccionAdn(adn),
          seccionAntiGenerico(),
          `## DIRECTRIZ DEL DIRECTOR CREATIVO (obligatoria)
Tu visi\xF3n asignada es la ${v.n}: \xAB${v.nombre}\xBB.
Enfoque: ${v.enfoque}${v.porQue ? `
Por qu\xE9: ${v.porQue}` : ""}
Desarrolla SOLO esta visi\xF3n: es una de las tres variaciones del mismo ADN y debe ser claramente DISTINTA de las otras (otra representaci\xF3n de la informaci\xF3n, otra composici\xF3n), nunca un clon con otro color.`,
          `# Petici\xF3n original del usuario
${peticion.mensaje}`
        ].join("\n\n");
        const texto = await llamada("codificador", PROMPT_MAQUETA, user, "maqueta", modeloCodificador);
        const html = extraerCodigo(texto);
        if (!html) return null;
        const informe = detectarGenericidad(html);
        const visionComoDireccion = {
          n: v.n,
          nombre: v.nombre,
          concepto: v.enfoque,
          porQue: v.porQue || v.enfoque,
          paleta: "",
          tipografia: ""
        };
        return {
          direcciones: [visionComoDireccion],
          html,
          eleccion: v.n,
          estado: "propuesta",
          notas: (informe.nivel === "alto" ? `- \u26A0 ${resumenAntiGenerico(informe)}
` : "") + `- Maqueta de la visi\xF3n ${v.n} del Estudio.`,
          ajustes: 0,
          genericidad: informe
        };
      } catch {
        return null;
      }
    })
  );
  const informes = maquetas.map((m) => m?.html ? detectarGenericidad(m.html) : null);
  ev("jueces", { total: JUECES_ESTUDIO.length, hecho: 0 });
  const modeloJuez = opciones.juez ?? fallback;
  const jueces = await Promise.all(
    JUECES_ESTUDIO.map(async (j, i) => {
      try {
        ev("jueces", { detalle: j.nombre, hecho: i, total: JUECES_ESTUDIO.length });
        const texto = await llamada(
          "revisor",
          promptJuezEstudio(j, opciones.criteriosDelUsuario),
          mensajePanel(peticion, adn, visiones, maquetas, informes, j),
          "veredicto",
          modeloJuez
        );
        const parse = parseNotasJuez(texto, j);
        if (!parse.razones) {
          return { juez: j.id, nombre: j.nombre, notas: parse.notas, total: parse.total, razones: "(sin razones)", lecciones: [], ausente: true };
        }
        return { juez: j.id, nombre: j.nombre, notas: parse.notas, total: parse.total, razones: parse.razones, lecciones: parse.lecciones.slice(0, 4) };
      } catch {
        return {
          juez: j.id,
          nombre: j.nombre,
          notas: {},
          total: [j.criterios.length * 5, j.criterios.length * 5, j.criterios.length * 5],
          razones: "El juez no pudo puntuar (cuota o red): nota neutra.",
          lecciones: [],
          ausente: true
        };
      }
    })
  );
  const totales = [1, 2, 3].map((v) => jueces.reduce((s, j) => s + j.total[v - 1], 0));
  const juezOriginalidad = jueces.find((j) => j.juez === "originalidad");
  let ganador = 1;
  for (const v of [1, 2, 3]) {
    if (totales[v - 1] > totales[ganador - 1]) ganador = v;
  }
  const empatados = [1, 2, 3].filter((v) => totales[v - 1] === totales[ganador - 1]);
  if (empatados.length > 1 && juezOriginalidad) {
    ganador = empatados.reduce(
      (mejor, v) => juezOriginalidad.total[v - 1] > juezOriginalidad.total[mejor - 1] ? v : mejor
    );
  }
  const panel = { jueces, totales, ganador };
  ev("fusion", { detalle: "El Director Final dicta la fusi\xF3n" });
  const leccionesPanel = jueces.flatMap((j) => j.lecciones).slice(0, 6);
  let fusion;
  try {
    const textoFusion = await llamada(
      "disenador",
      promptDirectorFinal(),
      mensajeDirectorFinal(peticion, adn, visiones, maquetas, informes, panel, leccionesPanel),
      "ficha-diseno",
      cfg.porRol.disenador ?? fallback
    );
    fusion = parseFusion(textoFusion, ganador);
  } catch {
    fusion = {
      base: ganador,
      adoptar: [],
      evitar: [],
      razones: "El Director Final no pudo decidir (cuota o red): se contin\xFAa con la base del panel."
    };
  }
  ev("fusion", { detalle: `Maquetando la fusi\xF3n (base: visi\xF3n ${fusion.base})` });
  let htmlFusion = "";
  try {
    const texto = await llamada(
      "codificador",
      PROMPT_MAQUETA,
      mensajeFusion(peticion, fichaTexto, adn, fusion, visiones),
      "maqueta",
      modeloCodificador
    );
    htmlFusion = extraerCodigo(texto);
  } catch {
    htmlFusion = "";
  }
  let baseUsada = fusion.base;
  if (!htmlFusion) {
    const maquetaBase = maquetas[fusion.base - 1] ?? maquetas.find((m) => m?.html) ?? null;
    htmlFusion = maquetaBase?.html ?? "";
    const e = maquetaBase?.eleccion;
    baseUsada = e === 1 || e === 2 || e === 3 ? e : fusion.base;
  }
  const propuesta = {
    direcciones: visiones.map(
      (v) => ({ n: v.n, nombre: v.nombre, concepto: v.enfoque, porQue: v.porQue || v.enfoque, paleta: "", tipografia: "" })
    ),
    html: htmlFusion,
    eleccion: baseUsada,
    estado: "propuesta",
    notas: [
      `- Fusi\xF3n del Director Final: base = visi\xF3n ${baseUsada}${fusion.adoptar.length ? `, ${fusion.adoptar.length} adopci\xF3n(es)` : ""}${fusion.evitar.length ? `, ${fusion.evitar.length} evitaci\xF3n(es)` : ""}.`,
      `- Panel: ${jueces.map((j) => `${j.nombre} ${j.total.join("/")}`).join(" \xB7 ")}.`,
      ...informes.map((inf, i) => `- Visi\xF3n ${i + 1}: ${inf ? resumenAntiGenerico(inf) : "sin maqueta"}`),
      "- Los textos son provisionales pero realistas: revisa tono y datos."
    ].join("\n"),
    ajustes: 0,
    genericidad: htmlFusion ? detectarGenericidad(htmlFusion) : void 0
  };
  ev("fin", { ok: true });
  return {
    modo: "estudio",
    adn,
    visiones,
    maquetas,
    informes,
    panel,
    fusion: { ...fusion, base: baseUsada },
    propuesta,
    fichaTexto,
    lecciones: leccionesPanel,
    rondas,
    respuesta: construirRespuestaEstudio(visiones, panel, { ...fusion, base: baseUsada }, informes, leccionesPanel, htmlFusion.length > 0),
    fallbackUsado: false
  };
}
function comoResultadoForja(estudio) {
  if (estudio.fallbackUsado && estudio.resultadoFallback) return estudio.resultadoFallback;
  return {
    estado: "esperando-aprobacion",
    codigo: "",
    respuesta: estudio.respuesta,
    ficha: null,
    fichaTexto: estudio.fichaTexto,
    maqueta: estudio.propuesta,
    rondas: estudio.rondas,
    veredicto: null,
    agotado: false,
    adn: estudio.adn
  };
}

// src/lib/prism/forja/conocimiento-global.ts
var CATEGORIAS_FORJA = [
  "color",
  "tipografia",
  "layout",
  "movimiento",
  "contenido",
  "accesibilidad",
  "patron",
  "tendencia"
];
var CAPAS_CONOCIMIENTO = {
  preferencia: { etiqueta: "preferencia", autoridad: 1, max: 20 },
  fallo: { etiqueta: "fallo", autoridad: 2, max: 30 },
  experimento: { etiqueta: "experimento", autoridad: 3, max: 30 },
  fundamento: { etiqueta: "fundamento", autoridad: 4, max: 40 },
  patron: { etiqueta: "patr\xF3n", autoridad: 5, max: 30 },
  tendencia: { etiqueta: "tendencia", autoridad: 6, max: 30 }
};
var CAPAS_FORJA = Object.keys(CAPAS_CONOCIMIENTO);
var CONOCIMIENTO_GLOBAL_DEFECTO = {
  reglas: [],
  ultimaLectura: {},
  generacion: 0
};
var MAX_REGLAS_GLOBALES = 180;
var CLAVE_CONOCIMIENTO_GLOBAL = "forja.conocimiento-global";
function pesoBase(calidad) {
  return calidad === 3 ? 1 : calidad === 2 ? 0.7 : 0.4;
}
function similitud(a, b) {
  const norm = (s) => new Set(
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9áéíóúñü\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
  );
  const A = norm(a);
  const B = norm(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
var UMBRAL_DUPLICADO = 0.55;
function reglaDuplicada(reglas, texto) {
  return reglas.some((r) => similitud(r.texto, texto) >= UMBRAL_DUPLICADO);
}
var PISTAS_CAPA = [
  {
    capa: "preferencia",
    re: /\b(el usuario|el dueño|odiat?|prefiere|prefiero|quiero que|no me gusta|no uses|nunca uses)\b/i
  },
  {
    capa: "fallo",
    re: /\b(fallo|fall[óo]|error|mediocre|evitar|evita|nunca|prohibid|no repitas|produjo|fracas)\b/i
  },
  {
    capa: "experimento",
    re: /\b(probamos|probado|arena|duelo|puntu[oó]|resultado|generaci[oó]n|gana(?:dor|ndo)?)\b/i
  },
  {
    capa: "tendencia",
    re: /\b(20\d\d|este a[ñn]o|pr[oó]xima temporada|moda|trend|popularizado|est[aá] de moda|ahora)\b/i
  },
  {
    capa: "patron",
    re: /\b(este tipo de|este tipo|tipo de (?:web|saas|sitio|proyecto)|funciona mejor|suele funcionar|conviene en)\b/i
  },
  {
    capa: "fundamento",
    re: /\b(wcag|accesib|contraste|sem[aá]ntic|responsive|aria|foco|usabilidad|siempre|legibilidad)\b/i
  }
];
function capaPorCategoria(categoria) {
  if (categoria === "tendencia") return "tendencia";
  if (categoria === "patron") return "patron";
  if (categoria === "accesibilidad") return "fundamento";
  return "fundamento";
}
function inferirCapa(texto, categoria) {
  for (const pista of PISTAS_CAPA) {
    if (pista.re.test(texto)) return pista.capa;
  }
  return capaPorCategoria(categoria);
}
function capaDe(regla) {
  return regla.capa && CAPAS_FORJA.includes(regla.capa) ? regla.capa : inferirCapa(regla.texto, regla.categoria);
}
function numerosDe(texto) {
  const out = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(px|%|:1|rem|em|fr|ms|s\b|x)/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const n = Number(m[1].replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}
function conflictoEntre(a, b) {
  if (a.categoria !== b.categoria) return false;
  const comparten = (() => {
    const norm = (s) => new Set(
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4)
    );
    for (const w of norm(a.texto)) if (norm(b.texto).has(w)) return true;
    return false;
  })();
  if (!comparten && similitud(a.texto, b.texto) < 0.35) return false;
  const na = numerosDe(a.texto);
  const nb = numerosDe(b.texto);
  if (na.length === 0 || nb.length === 0) return false;
  return na.some((x) => nb.some((y) => x !== y));
}
function autoridadDe(r) {
  const capa = CAPAS_CONOCIMIENTO[capaDe(r)];
  return (7 - capa.autoridad) * 1e3 + r.peso * (r.usos + 1) * 10;
}
function fusionarReglasConInforme(almacen, nuevas) {
  let reglas = [...almacen.reglas];
  const informe = {
    aceptadas: 0,
    duplicadas: 0,
    conflictosGanados: 0,
    conflictosPerdidos: 0
  };
  for (const n of nuevas) {
    const rivales = reglas.filter((r) => !r.superada && !r.caducada && conflictoEntre(r, n));
    if (rivales.length > 0) {
      const masFuerte = rivales.reduce((a, b) => autoridadDe(b) > autoridadDe(a) ? b : a);
      if (autoridadDe(masFuerte) >= autoridadDe(n)) {
        informe.conflictosPerdidos++;
        continue;
      }
      reglas = reglas.map((r) => r.id === masFuerte.id ? { ...r, superada: true } : r);
      informe.conflictosGanados++;
    }
    if (reglaDuplicada(reglas, n.texto)) {
      informe.duplicadas++;
      continue;
    }
    const igual = reglas.find((r) => r.id === n.id);
    if (igual) {
      reglas = reglas.map((r) => r.id === n.id ? { ...r, peso: Math.max(r.peso, n.peso) } : r);
      informe.aceptadas++;
      continue;
    }
    reglas.push(n);
    informe.aceptadas++;
  }
  for (const capa of CAPAS_FORJA) {
    const max = CAPAS_CONOCIMIENTO[capa].max;
    const enCapa = reglas.filter((r) => capaDe(r) === capa && !r.superada);
    if (enCapa.length > max) {
      const aSalvar = new Set(
        [...enCapa].sort((a, b) => b.peso * (b.usos + 1) - a.peso * (a.usos + 1)).slice(0, max).map((r) => r.id)
      );
      reglas = reglas.map(
        (r) => capaDe(r) === capa && !r.superada && !aSalvar.has(r.id) ? { ...r, superada: true } : r
      );
    }
  }
  if (reglas.filter((r) => !r.superada).length > MAX_REGLAS_GLOBALES) {
    const vivas = reglas.filter((r) => !r.superada).sort((a, b) => b.peso * (b.usos + 1) - a.peso * (a.usos + 1)).slice(0, MAX_REGLAS_GLOBALES);
    const salvar = new Set(vivas.map((r) => r.id));
    reglas = reglas.filter((r) => !r.superada || salvar.has(r.id));
  }
  return { almacen: { ...almacen, reglas }, informe };
}
function fusionarReglas(almacen, nuevas) {
  return fusionarReglasConInforme(almacen, nuevas).almacen;
}
function aplicarVigencia(almacen, ahora = /* @__PURE__ */ new Date()) {
  const MESES = 1e3 * 60 * 60 * 24 * 30.5;
  const GRACIA = 1e3 * 60 * 60 * 24 * 30;
  const vivas = [];
  for (const r of almacen.reglas) {
    if (r.categoria === "tendencia" && r.vigenciaHasta) {
      const fin = new Date(r.vigenciaHasta).getTime();
      if (Number.isFinite(fin) && ahora.getTime() > fin + GRACIA) continue;
      if (Number.isFinite(fin) && ahora.getTime() > fin) {
        vivas.push({ ...r, caducada: true });
        continue;
      }
    }
    if (r.categoria === "tendencia" && !r.vigenciaHasta) {
      const meses = Math.max(0, (ahora.getTime() - new Date(r.alta).getTime()) / MESES);
      vivas.push({ ...r, peso: Math.max(0.1, r.peso * Math.pow(0.89, meses)) });
      continue;
    }
    vivas.push(r);
  }
  return { ...almacen, reglas: vivas };
}
function etiquetaDe(r) {
  const capa = capaDe(r);
  if (capa === "experimento" && typeof r.puntuacion === "number") {
    return `[experimento ${Math.round(r.puntuacion)}/100]`;
  }
  if (capa === "fallo" && typeof r.generacion === "number") {
    return `[fallo G${r.generacion}]`;
  }
  return `[${CAPAS_CONOCIMIENTO[capa].etiqueta}]`;
}
function conocimientoParaPrompt(almacen, max, categorias) {
  const vivas = almacen.reglas.filter((r) => !r.superada && !r.caducada);
  const candidatas = categorias?.length ? vivas.filter((r) => categorias.includes(r.categoria)) : vivas;
  const porCapa = /* @__PURE__ */ new Map();
  for (const capa of CAPAS_FORJA) {
    porCapa.set(
      capa,
      candidatas.filter((r) => capaDe(r) === capa).sort((a, b) => b.peso * (b.usos + 1) - a.peso * (a.usos + 1))
    );
  }
  const salida = [];
  let indice = 0;
  while (salida.length < Math.max(0, max)) {
    let quedan = false;
    for (const capa of CAPAS_FORJA) {
      const lista = porCapa.get(capa) ?? [];
      if (indice < lista.length) {
        quedan = true;
        if (salida.length < max) salida.push(`${etiquetaDe(lista[indice])} ${lista[indice].texto}`);
      }
    }
    if (!quedan) break;
    indice++;
  }
  return salida;
}
function reglasGlobalesParaPrompt(almacen, max, categorias) {
  return conocimientoParaPrompt(almacen, max, categorias);
}
function registrarUso(almacen, textos) {
  const limpios = textos.map((t) => t.replace(/^\[[^\]]+\]\s*/, ""));
  const set = new Set(limpios);
  const setCrudo = new Set(textos);
  return {
    ...almacen,
    reglas: almacen.reglas.map(
      (r) => set.has(r.texto) || setCrudo.has(r.texto) ? { ...r, usos: r.usos + 1 } : r
    )
  };
}
function registrarLeccionesArena(almacen, lecciones, opciones) {
  const generacion = (almacen.generacion ?? 0) + 1;
  const nuevas = [];
  for (const l of lecciones.slice(0, 6)) {
    const texto = l.texto.replace(/\s+/g, " ").trim().slice(0, 220);
    if (texto.length < 15) continue;
    const capa = l.tipo === "destacar" ? "experimento" : l.tipo === "conservar" ? "patron" : "fallo";
    const categoria = l.tipo === "evitar" ? "patron" : inferirCapa(texto, "patron") === "tendencia" ? "tendencia" : "patron";
    const prefijo = `[Arena G${generacion}] ${l.tipo === "evitar" ? "Evitar" : l.tipo === "conservar" ? "Conservar" : "Funcion\xF3"}: `;
    const regla = {
      id: `arena_g${generacion}_${Date.now().toString(36)}_${nuevas.length}`,
      texto: `${prefijo}${texto}`,
      categoria,
      capa,
      contexto: opciones?.contexto,
      generacion,
      puntuacion: capa === "experimento" && typeof opciones?.puntuacionGanador === "number" ? Math.max(0, Math.min(100, Math.round(opciones.puntuacionGanador / 50 * 100))) : void 0,
      origen: "arena",
      peso: 1,
      alta: (/* @__PURE__ */ new Date()).toISOString(),
      usos: 0
    };
    if (reglaDuplicada(nuevas, regla.texto)) continue;
    nuevas.push(regla);
  }
  const fusionado = fusionarReglas({ ...almacen, generacion }, nuevas);
  return fusionado;
}
function registrarPreferencia(almacen, texto) {
  const limpio = texto.replace(/\s+/g, " ").trim().slice(0, 220);
  if (limpio.length < 8) return almacen;
  const regla = {
    id: `pref_${Date.now().toString(36)}`,
    texto: limpio,
    categoria: inferirCapa(limpio, "layout") === "tendencia" ? "tendencia" : "layout",
    capa: "preferencia",
    origen: "usuario",
    peso: 1,
    alta: (/* @__PURE__ */ new Date()).toISOString(),
    usos: 0
  };
  return fusionarReglas(almacen, [regla]);
}
function estadisticasPorCapa(almacen) {
  const out = { preferencia: 0, fallo: 0, experimento: 0, fundamento: 0, patron: 0, tendencia: 0 };
  for (const r of almacen.reglas) {
    if (r.superada || r.caducada) continue;
    out[capaDe(r)]++;
  }
  return out;
}
function serializarConocimiento(a) {
  return JSON.stringify(a);
}
function deserializarConocimiento(s) {
  if (!s) return CONOCIMIENTO_GLOBAL_DEFECTO;
  try {
    const p = JSON.parse(s);
    if (!Array.isArray(p.reglas)) return CONOCIMIENTO_GLOBAL_DEFECTO;
    const reglas = p.reglas.filter(
      (r) => typeof r?.texto === "string" && typeof r?.categoria === "string" && CATEGORIAS_FORJA.includes(r.categoria)
    ).map((r) => ({ ...r, capa: capaDe(r) }));
    return {
      reglas,
      ultimaLectura: p.ultimaLectura ?? {},
      ultimoCiclo: p.ultimoCiclo,
      generacion: typeof p.generacion === "number" ? p.generacion : 0
    };
  } catch {
    return CONOCIMIENTO_GLOBAL_DEFECTO;
  }
}

// src/lib/prism/forja/fuentes.ts
var FUENTES_SEMILLA = [
  {
    id: "sysprompts-mejores-ias",
    nombre: "System prompts de las mejores IAs de webs (repo abierto)",
    url: "https://raw.githubusercontent.com/x1xhlol/system-prompts-and-models-of-ai-tools/main/README.md",
    tipo: "prompts-ia",
    calidad: 3,
    extraer: "Principios que repiten los prompts de v0, Lovable, Bolt y Cursor: c\xF3mo exigen fidelidad visual, evitan placeholders rotos, manejan estilos por defecto y ordenan construir (dise\xF1o \u2192 c\xF3digo). Destilar en REGLAS generales; nunca copiar frases literales.",
    consultaAmpliacion: "github system prompts v0 lovable bolt cursor repo"
  },
  {
    id: "material-3",
    nombre: "Material Design 3 \u2014 fundaciones",
    url: "https://m3.material.io/foundations",
    tipo: "design-system",
    calidad: 3,
    extraer: "Roles de color (surface, on-surface, primary), escala tipogr\xE1fica, elevaci\xF3n, estados de interacci\xF3n, layout adaptativo.",
    consultaAmpliacion: "material design 3 foundations color roles typography scale"
  },
  {
    id: "apple-hig",
    nombre: "Apple Human Interface Guidelines",
    url: "https://developer.apple.com/design/human-interface-guidelines",
    tipo: "design-system",
    calidad: 3,
    extraer: "Jerarqu\xEDa visual, tipograf\xEDa din\xE1mica, \xE1reas t\xE1ctiles, feedback de interacci\xF3n, dise\xF1o de formularios sin fricci\xF3n.",
    consultaAmpliacion: "human interface guidelines layout typography feedback"
  },
  {
    id: "webdev-a11y",
    nombre: "web.dev \u2014 Learn Accessibility",
    url: "https://web.dev/learn/accessibility",
    tipo: "accesibilidad",
    calidad: 3,
    extraer: "Contraste real, orden de foco, ARIA cuando hace falta (y cuando sobra), formularios accesibles, im\xE1genes decorativas vs informativas.",
    consultaAmpliacion: "learn accessibility web.dev contrast focus aria forms"
  },
  {
    id: "tailwind-fundamentos",
    nombre: "Tailwind CSS \u2014 conceptos (escalas y utilidades)",
    url: "https://tailwindcss.com/docs/typography",
    tipo: "design-system",
    calidad: 2,
    extraer: "Escalas de espaciado y tipograf\xEDa que usa el ecosistema real, nombres de tama\xF1o, c\xF3mo se traduce una ficha de dise\xF1o a clases.",
    consultaAmpliacion: "tailwind css scale spacing typography docs"
  },
  {
    id: "refactoring-ui",
    nombre: "Refactoring UI \u2014 vistas previas",
    url: "https://www.refactoringui.com/previews",
    tipo: "design-system",
    calidad: 2,
    extraer: "Jerarqu\xEDa con peso/tono en vez de solo tama\xF1o, densidad correcta, sombras por capas, decisiones de alineaci\xF3n que evitan el look amateur.",
    consultaAmpliacion: "refactoring ui hierarchy shadows alignment density"
  },
  {
    id: "awwwards-galeria",
    nombre: "Awwwards \u2014 webs premiadas del mes",
    url: "https://www.awwwards.com/websites/",
    tipo: "tendencias",
    calidad: 1,
    extraer: "Solo TENDENCIAS VISUALES de alto nivel (paletas recurrentes, tipograf\xEDas display, patrones de hero). Filtrar agresivamente: nada de trucos de accesibilidad dudosa.",
    consultaAmpliacion: "awwwards web design trends of the month"
  },
  {
    id: "awesome-prompts",
    nombre: "Awesome ChatGPT Prompts \u2014 rol de dise\xF1ador",
    url: "https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/README.md",
    tipo: "prompts-ia",
    calidad: 1,
    extraer: "Vocabulario y t\xE9cnicas de rol prompting (act\xFAa como dise\xF1ador senior, pide criterios medibles). Filtrar: solo lo que mejore reglas de dise\xF1o concretas.",
    consultaAmpliacion: "awesome chatgpt prompts act as web designer"
  }
];
function fuentePorId(id) {
  return FUENTES_SEMILLA.find((f) => f.id === id);
}

// src/lib/prism/forja/seguridad-web.ts
function urlSegura(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost")) return false;
    if (/^127\./.test(h) || /^10\./.test(h)) return false;
    if (/^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (/^169\.254\./.test(h) || /^0\./.test(h)) return false;
    if (h === "0.0.0.0" || h === "[::1]") return false;
    return true;
  } catch {
    return false;
  }
}
var DOMINIOS_BLOQUEADOS = [
  // acortadores: el destino real queda oculto
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "is.gd",
  "cutt.ly",
  "ow.ly",
  "buff.ly",
  "rebrand.ly",
  "shorturl.at",
  "rb.gy",
  "tiny.cc",
  // rastreadores / publicidad
  "doubleclick.net",
  "google-analytics.com",
  "googletagmanager.com",
  "adservice.google.com"
];
var EXT_BINARIAS = /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|exe|dmg|pkg|msi|apk|iso|bin|deb|rpm|mp4|mp3|mov|avi|mkv|webm|woff|woff2|ttf|otf|eot|psd|ai|sketch|fig|pdf|doc|docx|ppt|pptx|xls|xlsx|odt|ods|epub|mobi)$/i;
var MAX_LARGO_URL = 800;
function urlAptaparaAprendizaje(url) {
  const motivos = [];
  const avisos = [];
  if (!url || url.length > MAX_LARGO_URL) {
    motivos.push(`URL vac\xEDa o demasiado larga (m\xE1x. ${MAX_LARGO_URL} caracteres).`);
    return { ok: false, motivos, avisos };
  }
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, motivos: ["No es una URL v\xE1lida."], avisos };
  }
  if (u.protocol !== "https:") {
    motivos.push("Solo se acepta https (el contenido viaja cifrado).");
  }
  if (u.username || u.password) {
    motivos.push("La URL contiene usuario/contrase\xF1a: no se acepta.");
  }
  if (u.port) {
    motivos.push(`Puerto no est\xE1ndar (${u.port}) no permitido: solo 443.`);
  }
  const h = u.hostname.toLowerCase();
  if (!urlSegura(url)) {
    motivos.push(
      "Host no p\xFAblico (localhost, red privada o direcci\xF3n de metadatos): bloqueado por SSRF."
    );
  }
  if (h.startsWith("xn--") || h.includes(".xn--")) {
    avisos.push("Dominio internacionalizado (punycode): verifica que es el real.");
  }
  if (DOMINIOS_BLOQUEADOS.some((d) => h === d || h.endsWith("." + d))) {
    motivos.push("Dominio en la lista de bloqueados (acortador o rastreador).");
  }
  if (EXT_BINARIAS.test(u.pathname)) {
    motivos.push("Parece un archivo binario: solo se leen textos (html, md, txt\u2026).");
  }
  return { ok: motivos.length === 0, motivos, avisos };
}
function tipoContenidoAceptado(contentType) {
  const ct = contentType.toLowerCase();
  return ct.includes("text/html") || ct.includes("text/plain") || ct.includes("text/markdown") || ct.includes("application/json") || ct.includes("application/xml") || ct.includes("text/xml");
}
function textoDesdeHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(
    /<(script|style|noscript|iframe|object|embed|svg|template|form)[\s\S]*?<\/\1>/gi,
    " "
  ).replace(/<(p|div|li|h[1-6]|tr|section|article|header|footer|ul|ol|table)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#0?39;/gi, "'").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}
function escaparHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var RX_INSTRUCCIONES_INJERTADAS = [
  /\bignora(?:r)?\s+(?:todas\s+)?(?:las\s+)?(?:instrucciones|indicaciones|reglas|prompts?|sistema)\s+(?:anteriores|previas|previos|del\s+sistema)?/gi,
  /\b(?:disregard|ignore|forget)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts?|rules)/gi,
  /(?:^|\n)\s*(?:sistema|system|asistente|assistant)\s*:/gi,
  /\beres\s+un(?:a)?\s+(?:nueva|nuevo)\s+(?:ia|ai|instrucci[óo]n|versi[óo]n)/gi,
  /\b(?:you are|from now on you are)\s+(?:a\s+)?(?:new|the new)\s+/gi
];
var MARCADOR_NEUTRALIZADO = "[texto neutralizado]";
function limpiarTextoParaExtractor(texto) {
  let t = texto.replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/<\/?regla\b[^>]*>/gi, " ");
  for (const rx of RX_INSTRUCCIONES_INJERTADAS) {
    t = t.replace(rx, MARCADOR_NEUTRALIZADO);
  }
  return t.replace(/\n{3,}/g, "\n\n").trim();
}
var PRESUPUESTO_APRENDIZAJE = {
  /** fuentes por ciclo (semilla + usuario combinadas) */
  fuentesPorCiclo: 3,
  /** caracteres de contenido por página que llegan al extractor */
  maxCharsPorPagina: 4e4,
  /** bytes máximos de descarga por página (2 MB) — el host lo aplica */
  maxBytesPorPagina: 2e6,
  /** minutos de descanso mínimo entre ciclos */
  minutosEntreCiclos: 15,
  /** segundos de timeout recomendados por página (el host lo aplica) */
  timeoutSegundos: 12
};
function intervaloSuficiente(ultimoCicloIso, ahora = /* @__PURE__ */ new Date()) {
  if (!ultimoCicloIso) return true;
  const t = new Date(ultimoCicloIso).getTime();
  if (Number.isNaN(t)) return true;
  return ahora.getTime() - t >= PRESUPUESTO_APRENDIZAJE.minutosEntreCiclos * 6e4;
}

// src/lib/prism/forja/fuentes-usuario.ts
var MAX_FUENTES_USUARIO = 30;
var CLAVE_FUENTES_USUARIO = "forja.fuentes-usuario";
var FUENTES_USUARIO_DEFECTO = [];
var PARAMETROS_RASTREO = /^(utm_|fbclid$|gclid$|dclid$|mc_[a-z]+$|ref$|ref_src$|igshid$)/i;
function normalizarUrlFuente(entrada) {
  const limpia = entrada.trim();
  if (!limpia || /\s/.test(limpia)) return null;
  const conEsquema = /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`;
  let u;
  try {
    u = new URL(conEsquema);
  } catch {
    return null;
  }
  if (!u.hostname.includes(".")) return null;
  const sobran = [];
  u.searchParams.forEach((_v, k) => {
    if (PARAMETROS_RASTREO.test(k)) sobran.push(k);
  });
  for (const k of sobran) u.searchParams.delete(k);
  u.hash = "";
  const h = u.hostname.toLowerCase().replace(/^www\./, "");
  const mRepo = u.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/(?:tree|blob)\/[^/]+)?\/?$/);
  if (h === "github.com" && mRepo) {
    const [, owner, repo] = mRepo;
    return {
      url: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`,
      tipo: "repo",
      nombre: `GitHub \xB7 ${owner}/${repo}`
    };
  }
  const mBlob = u.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(?:blob|raw)\/(.+)$/);
  if (h === "github.com" && mBlob) {
    const [, owner, repo, resto] = mBlob;
    const archivo = resto.split("/").pop() ?? "archivo";
    return {
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${resto}`,
      tipo: "raw",
      nombre: `GitHub \xB7 ${owner}/${repo}/${archivo}`.slice(0, 70)
    };
  }
  const segmentos = u.pathname.split("/").filter(Boolean).filter((s) => s.length < 50);
  const ultimo = segmentos[segmentos.length - 1];
  const detalle = ultimo ? ultimo.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ") : "";
  return {
    url: u.toString(),
    tipo: /\.(md|txt|markdown)$/i.test(u.pathname) ? "raw" : "web",
    nombre: `${h}${detalle ? ` \xB7 ${detalle}` : ""}`.slice(0, 70)
  };
}
function crearId() {
  return `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
function dictamenFuente(entrada) {
  const propuesta = normalizarUrlFuente(entrada);
  if (!propuesta) {
    return {
      ok: false,
      motivos: ["No parece un enlace v\xE1lido (\xBFtiene espacios o falta el dominio?)."],
      avisos: []
    };
  }
  const d = urlAptaparaAprendizaje(propuesta.url);
  return { ...d, propuesta };
}
function anadirFuente(lista, entrada, opciones = {}) {
  const d = dictamenFuente(entrada);
  if (!d.ok || !d.propuesta) {
    return { lista, error: d.motivos.join(" ") || "Enlace rechazado por seguridad." };
  }
  if (lista.some((f) => f.url === d.propuesta.url)) {
    return { lista, error: "Esa fuente ya estaba en tu lista." };
  }
  if (lista.length >= MAX_FUENTES_USUARIO) {
    return {
      lista,
      error: `Tope de ${MAX_FUENTES_USUARIO} fuentes alcanzado: pausa o quita alguna para a\xF1adir otra.`
    };
  }
  const fuente = {
    id: crearId(),
    nombre: (opciones.nombre?.trim() || d.propuesta.nombre).slice(0, 80),
    url: d.propuesta.url,
    tipo: d.propuesta.tipo,
    activa: opciones.activa ?? true,
    calidad: opciones.calidad ?? 2,
    nota: opciones.nota?.trim() ? opciones.nota.trim().slice(0, 200) : void 0,
    contraejemplo: opciones.contraejemplo === true ? true : void 0,
    alta: (/* @__PURE__ */ new Date()).toISOString(),
    lecturas: 0,
    reglasAportadas: 0
  };
  return { lista: [...lista, fuente], fuente };
}
function quitarFuente(lista, id) {
  return lista.filter((f) => f.id !== id);
}
function alternarFuente(lista, id, activa) {
  return lista.map((f) => f.id === id ? { ...f, activa: activa ?? !f.activa } : f);
}
function editarFuente(lista, id, cambios) {
  return lista.map(
    (f) => f.id === id ? {
      ...f,
      nombre: cambios.nombre?.trim() ? cambios.nombre.trim().slice(0, 80) : f.nombre,
      nota: cambios.nota !== void 0 ? cambios.nota.trim() ? cambios.nota.trim().slice(0, 200) : void 0 : f.nota,
      calidad: cambios.calidad ?? f.calidad,
      contraejemplo: cambios.contraejemplo !== void 0 ? cambios.contraejemplo || void 0 : f.contraejemplo
    } : f
  );
}
function fuentesActivas(lista) {
  return lista.filter((f) => f.activa);
}
function registrarLecturasFuentes(lista, reglasPorFuente) {
  return lista.map(
    (f) => reglasPorFuente[f.id] !== void 0 ? {
      ...f,
      lecturas: f.lecturas + 1,
      reglasAportadas: f.reglasAportadas + reglasPorFuente[f.id]
    } : f
  );
}
function olvidarReglasDeFuente(almacen, idOrigen) {
  return { ...almacen, reglas: almacen.reglas.filter((r) => r.origen !== idOrigen) };
}
function olvidarTodoElConocimiento(almacen) {
  return { ...almacen, reglas: [], ultimaLectura: {} };
}
var EXTRACCION_DEFECTO = {
  web: "Reglas de dise\xF1o que esta p\xE1gina ejemplifique: jerarqu\xEDa, color, tipograf\xEDa, espaciado, patrones de composici\xF3n y accesibilidad. Si el texto no aporta criterio de dise\xF1o web, devuelve CERO reglas.",
  repo: "Principios que aparecen en el README/c\xF3digo: c\xF3mo estructuran interfaces, naming, patrones de UI y criterios de calidad. Reglas generales, nunca frases copiadas.",
  raw: "Principios del texto reescritos como reglas imperativas de dise\xF1o web, medibles y generales. Si no aporta criterio de dise\xF1o, devuelve CERO reglas."
};
var EXTRACCION_CONTRAEJEMPLO = "ESTA FUENTE ES UN CONTRAEJEMPLO: es una p\xE1gina MALA o gen\xE9rica que sirve de ejemplo de lo que NO hacer. NO destiles sus aciertos. Identifica los patrones que la delatan como plantilla (composici\xF3n por defecto, jerarqu\xEDa plana, decoraci\xF3n sin idea, dashboards de cajitas, gradientes y blobs, tipograf\xEDa sin intenci\xF3n) y escr\xEDbelos como REGLAS DE EVITACI\xD3N imperativas y generales: \xABEvita \u2026\xBB. Toda regla debe ser aplicable a otra web como aviso, no como copia de esta p\xE1gina.";
function comoFuenteCiclo(f) {
  const base = f.nota ? `${EXTRACCION_DEFECTO[f.tipo]} Gu\xEDa del usuario: ${f.nota}` : EXTRACCION_DEFECTO[f.tipo];
  return {
    id: f.id,
    nombre: f.nombre,
    url: f.url,
    tipo: "personalizada",
    calidad: f.calidad,
    extraer: f.contraejemplo ? `${base} ${EXTRACCION_CONTRAEJEMPLO}` : base,
    consultaAmpliacion: ""
  };
}
function serializarFuentes(lista) {
  return JSON.stringify(lista);
}
function deserializarFuentes(s) {
  if (!s) return FUENTES_USUARIO_DEFECTO;
  try {
    const p = JSON.parse(s);
    if (!Array.isArray(p)) return FUENTES_USUARIO_DEFECTO;
    const validas = [];
    for (const crudo of p) {
      const f = crudo;
      if (typeof f?.id !== "string" || typeof f?.url !== "string" || typeof f?.nombre !== "string" || f.tipo !== "web" && f.tipo !== "repo" && f.tipo !== "raw" || f.calidad !== 1 && f.calidad !== 2 && f.calidad !== 3) {
        continue;
      }
      if (!urlAptaparaAprendizaje(f.url).ok) continue;
      validas.push({
        id: f.id,
        nombre: f.nombre,
        url: f.url,
        tipo: f.tipo,
        activa: f.activa !== false,
        calidad: f.calidad,
        nota: typeof f.nota === "string" ? f.nota : void 0,
        contraejemplo: f.contraejemplo === true ? true : void 0,
        alta: typeof f.alta === "string" ? f.alta : (/* @__PURE__ */ new Date()).toISOString(),
        lecturas: typeof f.lecturas === "number" ? f.lecturas : 0,
        reglasAportadas: typeof f.reglasAportadas === "number" ? f.reglasAportadas : 0
      });
      if (validas.length >= MAX_FUENTES_USUARIO) break;
    }
    return validas;
  } catch {
    return FUENTES_USUARIO_DEFECTO;
  }
}
function textoPanelFuentes(lista, ultimoCicloIso) {
  if (lista.length === 0) {
    return "Tu Apartado de Aprendizaje est\xE1 vac\xEDo. A\xF1ade sitios, repos de GitHub o documentos (.md/.txt) y FORJA IA destilar\xE1 reglas de dise\xF1o de ellos en cada ciclo.";
  }
  const linea = (f) => `- ${f.activa ? "\u25CF" : "\u25CB"}${f.contraejemplo ? " \u26A0" : ""} ${f.nombre} [${f.tipo}] \u2014 ${f.reglasAportadas} reglas \xB7 ${f.lecturas} lecturas` + (f.contraejemplo ? " \u2014 contraejemplo (aprende lo que EVITAR)" : "") + (f.nota ? ` \u2014 \xAB${f.nota}\xBB` : "");
  const activas = lista.filter((f) => f.activa).map(linea);
  const pausadas = lista.filter((f) => !f.activa).map(linea);
  const cuando = ultimoCicloIso ? `\xDAltimo ciclo de aprendizaje: ${new Date(ultimoCicloIso).toLocaleString("es")}.` : "Todav\xEDa no ha habido ciclos de aprendizaje.";
  return [
    `Apartado de Aprendizaje \u2014 ${activas.length} activa(s) de ${lista.length} (tope ${MAX_FUENTES_USUARIO}).`,
    cuando,
    activas.length ? "\nActivas:" : "",
    ...activas,
    pausadas.length ? "\nPausadas (no entran en los ciclos):" : "",
    ...pausadas,
    "\nAprobar, pausar o borrar se hace desde el panel; el chat solo propone."
  ].filter(Boolean).join("\n");
}
var RX_SOLO_URL = /^https?:\/\/\S+$/i;
var RX_PROPONER = /(?:anade|añade|agrega|aprende de|aprender de|mira esta|mira este|lee esta|lee este|usa esta|usa este)\s+(?:esta|este|la|el|un|una|mi)?\s*(?:fuente|pagina|página|sitio|web|repo|repositorio|enlace|link|doc|documento|guia|guía)?\s*:?\s*(https?:\/\/[^\s]+)/i;
var RX_LISTAR = /(?:muestra|lista|listar|ensename|enséñame|cuales son|cuáles son|que fuentes|qué fuentes)\s+(?:las\s+)?fuentes|^\s*fuentes\s*$|(?:qué|cuales|cuáles)\s+fuentes\s+tienes|tienes\s+fuentes|mis\s+fuentes/i;
function interpretarOrdenFuentes(mensaje) {
  const texto = mensaje.trim();
  if (!texto) return { tipo: "ninguna" };
  if (RX_SOLO_URL.test(texto)) return { tipo: "proponer", url: texto };
  const m = texto.match(RX_PROPONER);
  if (m?.[1]) return { tipo: "proponer", url: m[1] };
  if (RX_LISTAR.test(texto)) return { tipo: "listar" };
  return { tipo: "ninguna" };
}
function responderOrdenFuentes(orden, lista, ultimoCicloIso) {
  if (orden.tipo === "ninguna") return null;
  if (orden.tipo === "listar") return textoPanelFuentes(lista, ultimoCicloIso);
  const d = dictamenFuente(orden.url);
  if (!d.ok || !d.propuesta) {
    return `No puedo proponer esa fuente: ${d.motivos.join(" ")}`;
  }
  return [
    "Propongo a\xF1adir esta fuente al Apartado de Aprendizaje:",
    `- ${d.propuesta.nombre} (${d.propuesta.tipo}) \u2014 ${d.propuesta.url}`,
    d.avisos.length ? `Avisos: ${d.avisos.join(" ")}` : "",
    "Apru\xE9bala en el panel de Aprendizaje y la leer\xE9 en el pr\xF3ximo ciclo. Por seguridad, una fuente solo se acepta con tu aprobaci\xF3n ah\xED \u2014 nunca porque llegue por el chat."
  ].filter(Boolean).join("\n");
}

// src/lib/prism/forja/memoria2.ts
var MAX_LECCIONES_PROYECTO = 40;
var MAX_EXPERIMENTOS = 30;
var MAX_FALLOS = 30;
var CONFIRMACIONES_PARA_PROHIBIR = 3;
var CLAVES_MEMORIA2 = {
  proyecto: "forja.memoria-proyecto",
  experimentos: "forja.experimentos",
  fallos: "forja.memoria-fallos"
};
function memoria2Vacia() {
  return {
    usuario: { ...MEMORIA_DEFECTO, reglas: [] },
    global: { ...CONOCIMIENTO_GLOBAL_DEFECTO, reglas: [], ultimaLectura: {}, generacion: 0 },
    proyecto: { projectId: "", lecciones: [] },
    experimentos: [],
    fallos: []
  };
}
function registrarLeccionProyecto(m, projectId, leccion) {
  const lecciones = listaLimpia([...m.proyecto.lecciones, leccion], MAX_LECCIONES_PROYECTO, 140);
  return { ...m, proyecto: { projectId: projectId || m.proyecto.projectId, lecciones } };
}
function registrarExperimento(m, exp) {
  const nuevo = {
    ...exp,
    id: `exp-${(m.experimentos.length + 1).toString(36)}-${Date.now().toString(36)}`,
    fecha: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
  };
  const experimentos = [nuevo, ...m.experimentos].slice(0, MAX_EXPERIMENTOS);
  return { ...m, experimentos };
}
function registrarFallo(m, patron, evidencia2, alternativa) {
  const clave2 = patron.trim().toLowerCase();
  const existente = m.fallos.find((f) => f.patron.trim().toLowerCase() === clave2);
  let fallos;
  if (existente) {
    fallos = m.fallos.map(
      (f) => f.id === existente.id ? { ...f, confirmaciones: f.confirmaciones + 1, evidencia: evidencia2 || f.evidencia, prohibicion: f.confirmaciones + 1 >= CONFIRMACIONES_PARA_PROHIBIR } : f
    );
  } else {
    const nuevo = {
      id: `fallo-${(m.fallos.length + 1).toString(36)}-${Date.now().toString(36)}`,
      patron: patron.trim().slice(0, 160),
      evidencia: evidencia2.slice(0, 200),
      alternativa: alternativa.slice(0, 160),
      confirmaciones: 1,
      prohibicion: false,
      fecha: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
    };
    fallos = [nuevo, ...m.fallos].slice(0, MAX_FALLOS);
  }
  return { ...m, fallos };
}
function absorberLeccionesGenoma(m, lecciones, projectId) {
  let out = m;
  for (const l of lecciones) {
    if (l.tipo === "destacar") {
      out = registrarLeccionProyecto(out, projectId, l.texto);
    } else if (l.tipo === "evitar") {
      out = registrarFallo(out, l.texto, `confirmado en generaci\xF3n ${l.generacion}`, "ver alternativas del informe anti-gen\xE9rico");
    }
  }
  return out;
}
function memoriaParaPrompt(m, maxLineas = 12) {
  const out = [];
  for (const f of m.fallos.filter((x) => x.prohibicion)) {
    out.push(`PROHIBIDO (fallos confirmados ${f.confirmaciones}x): ${f.patron} \u2192 ${f.alternativa}`);
  }
  for (const r of m.usuario.reglas.slice(0, 4)) {
    out.push(`Preferencia del usuario: ${r.texto}`);
  }
  for (const l of m.proyecto.lecciones.slice(0, 4)) {
    out.push(`Funciona en este proyecto: ${l}`);
  }
  for (const e of m.experimentos.filter((x) => x.concluyente).slice(0, 2)) {
    out.push(`Experimento concluyente: ${e.hipotesis} \u2192 ${e.resultado}`);
  }
  return out.slice(0, maxLineas);
}
function estadisticasMemoria2(m) {
  return {
    usuario: m.usuario.reglas.length,
    global: m.global.reglas.length,
    proyecto: m.proyecto.lecciones.length,
    experimentos: m.experimentos.length,
    fallos: m.fallos.length,
    prohibicionesActivas: m.fallos.filter((f) => f.prohibicion).length
  };
}
var CLAVES_DELEGADAS = {
  usuario: CLAVE_MEMORIA,
  global: CLAVE_CONOCIMIENTO_GLOBAL
};

// src/lib/prism/forja/voz.ts
var NEGADOR = /\b(sin|menos|nada de|no quiero|no la quiero|sin que)\b/i;
var MUCHO = /\b(mucho|much[oa]s|muy|super|súper|mucho m[aá]s|much[ií]sim)\b/i;
var POCO = /\b(un poco|ligera?mente|algo|sutil(?:mente)?)\b/i;
var ENTRADAS = [
  // Elegancia / lujo (ejemplo canónico del plan: elegancia ↑, densidad ↓,
  // espacio ↑, decoración ↓, personalidad →)
  { patron: /\belegan\w*|\bluj\w*|\brefinad\w*|\bpremium\b/i, comandos: [{ dimension: "elegancia", direccion: "subir" }, { dimension: "densidad", direccion: "bajar" }, { dimension: "espacio", direccion: "subir" }, { dimension: "decoracion", direccion: "bajar" }, { dimension: "personalidad", direccion: "mantener" }] },
  // Exclusividad (el ejemplo del plan)
  { patron: /\bexclusiv\w*|\búnico\w*|\bunic\w*|\bdiferente\b|\bdistinto\b/i, comandos: [{ dimension: "densidad", direccion: "bajar" }, { dimension: "espacio", direccion: "subir" }, { dimension: "jerarquia", direccion: "subir" }, { dimension: "repetitivos", direccion: "bajar" }, { dimension: "diferenciacion tipografica", direccion: "subir" }] },
  // Simple / limpio
  { patron: /\bsimple\b|\blimpio\w*|\bminimal\w*|\baire\b|\bdescargado\b/i, comandos: [{ dimension: "densidad", direccion: "bajar" }, { dimension: "espacio", direccion: "subir" }, { dimension: "decoracion", direccion: "bajar" }] },
  // Vivaz / divertido
  { patron: /\bvivaz\w*|\bdivertid\w*|\bjuguet[óo]n\w*|\benerg\w*|\bfresco\w*/i, comandos: [{ dimension: "energia", direccion: "subir" }, { dimension: "personalidad", direccion: "subir" }, { dimension: "movimiento", direccion: "subir" }] },
  // Serio / serio pero no aburrido
  { patron: /\bserio\w*|\bprofesional\b|\bcorporativ\w*|\bsobrio\w*/i, comandos: [{ dimension: "elegancia", direccion: "subir" }, { dimension: "energia", direccion: "bajar" }, { dimension: "confianza", direccion: "subir" }] },
  // Aburrido (señal de alerta: bajar elegancia excesiva, subir personalidad)
  { patron: /\baburrid\w*|\bsoso\w*|\bgen[ée]ric\w*|\bplantilla\b/i, comandos: [{ dimension: "personalidad", direccion: "subir" }, { dimension: "decoracion", direccion: "bajar" }] },
  // Tecnológico
  { patron: /\btecnol[óo]gic\w*|\bfuturista\b|\bmoderno\b|\bnuevo\b/i, comandos: [{ dimension: "innovacion", direccion: "subir" }, { dimension: "densidad", direccion: "bajar" }] },
  // Cálido / cercano
  { patron: /\bc[áa]lid\w*|\bcercan\w*|\bhumano\b|\bamigable\b/i, comandos: [{ dimension: "cercania", direccion: "subir" }, { dimension: "agresividad", direccion: "bajar" }] },
  // Oscuro / claro (tema)
  { patron: /\boscuro\b|\bdark\b/i, comandos: [{ dimension: "tema", direccion: "fijar", valor: 8 }] },
  { patron: /\bclaro\b|\bwhite\b|\blight\b/i, comandos: [{ dimension: "tema", direccion: "fijar", valor: 2 }] },
  // Tipografía protagonista
  { patron: /\btipograf[ií]a\s+(protagonista|m[aá]s grande|más protagon)/i, comandos: [{ dimension: "diferenciacion tipografica", direccion: "subir" }] },
  // Color
  { patron: /\bcolores?\b/i, comandos: [{ dimension: "expresion color", direccion: "subir" }] },
  // Velocidad / peso
  { patron: /\br[áa]pid\w*|\bligero\b|\bvelocidad\b/i, comandos: [{ dimension: "movimiento", direccion: "bajar" }, { dimension: "densidad", direccion: "bajar" }] }
];
function interpretarVoz(frase) {
  const texto = (frase || "").trim();
  if (!texto) return [];
  const comandos = [];
  const negativo = NEGADOR.test(texto);
  const mucho = MUCHO.test(texto);
  const poco = POCO.test(texto);
  const intensidad = mucho ? 3 : poco ? 1 : 2;
  for (const entrada of ENTRADAS) {
    const m = texto.match(entrada.patron);
    if (!m) continue;
    for (const c of entrada.comandos) {
      let direccion = c.direccion;
      if (negativo && direccion === "subir" && /decoracion|energia|expresion|agresividad/i.test(c.dimension)) {
        direccion = "bajar";
      }
      comandos.push({
        dimension: c.dimension,
        direccion,
        valor: c.valor,
        intensidad,
        motivo: texto
      });
    }
  }
  return dedupeComandos(comandos);
}
function dedupeComandos(cs) {
  const vistos = /* @__PURE__ */ new Set();
  const out = [];
  for (const c of cs) {
    const clave2 = `${c.dimension}:${c.direccion}`;
    if (vistos.has(clave2)) continue;
    vistos.add(clave2);
    out.push(c);
  }
  return out;
}
function textoComandos(cs) {
  if (!cs.length) return "(no entend\xED ning\xFAn ajuste concreto)";
  const flecha = { subir: "\u2191", bajar: "\u2193", fijar: "=", mantener: "\u2192" };
  return cs.map((c) => `${c.dimension} ${flecha[c.direccion]}${c.valor != null ? ` ${c.valor}` : ""} (x${c.intensidad})`).join("\n");
}
function aplicarComandos(adn, comandos) {
  let a = sanearAdn2({ ...adn });
  const deltaPorDimension = /* @__PURE__ */ new Map();
  for (const c of comandos) {
    const peso = c.direccion === "subir" ? c.intensidad : c.direccion === "bajar" ? -c.intensidad : 0;
    deltaPorDimension.set(c.dimension, (deltaPorDimension.get(c.dimension) ?? 0) + peso);
  }
  const sensacion = a.sensacion.map((e) => {
    const d = deltaPorDimension.get(e.eje) ?? 0;
    return d ? { eje: e.eje, valor: Math.max(0, Math.min(10, e.valor + d)) } : e;
  });
  for (const [dim, delta] of deltaPorDimension) {
    if (sensacion.some((e) => e.eje === dim) || !/^[a-z ]{3,20}$/.test(dim) || delta === 0) continue;
    if (sensacion.length >= 6) break;
    sensacion.push({ eje: dim, valor: Math.max(0, Math.min(10, 5 + delta)) });
  }
  const lenguaje = [...a.lenguaje];
  const apunta = (dim, _delta, fraseSube, fraseBaja) => {
    const d = deltaPorDimension.get(dim) ?? 0;
    if (d > 0 && !lenguaje.includes(fraseSube) && lenguaje.length < 8) lenguaje.push(fraseSube);
    if (d < 0 && !lenguaje.includes(fraseBaja) && lenguaje.length < 8) lenguaje.push(fraseBaja);
  };
  apunta("espacio", 1, "espacio negativo generoso", "composici\xF3n compacta y contenida");
  apunta("densidad", -1, "pocos elementos por pantalla, solo lo esencial", "");
  apunta("decoracion", -1, "cero adorno sin funci\xF3n", "");
  apunta("personalidad", 1, "decisiones con car\xE1cter propio", "");
  apunta("movimiento", 1, "movimiento con prop\xF3sito y breve", "est\xE1tica deliberada");
  const exclusivo = comandos.some((c) => /exclusiv|jerarquia|repetitivos/i.test(c.dimension) && c.direccion !== "mantener");
  const composicion = exclusivo && !a.composicion.some((c) => /asim|rompim|foco/i.test(c)) ? [...a.composicion, "rompimiento de ret\xEDcula en la secci\xF3n clave, foco \xFAnico"] : a.composicion;
  const resultado = {
    ...a,
    sensacion,
    lenguaje,
    composicion
  };
  return sanearAdn2(resultado);
}
function promptRefinarVoz(frase, adn) {
  return [
    `## Interpreta esta direcci\xF3n del usuario`,
    `Frase: \xAB${frase}\xBB`,
    `ADN actual: ${adn.personalidad.join(", ")} \xB7 prohibiciones: ${adn.prohibiciones.join("; ")}`,
    ``,
    `Traduce a AJUSTES SEM\xC1NTICOS (no tokens CSS). Responde EXACTAMENTE:`,
    `<comandos>`,
    `dimension: subir|bajar|fijar N (x1-3)`,
    `...`,
    `</comandos>`,
    `Prohibido: gradientes autom\xE1ticos, glassmorphism autom\xE1tico, efectos sin funci\xF3n.`
  ].join("\n");
}
function parseComandosModelo(texto, fraseOriginal) {
  const bloque = texto.match(/<comandos>([\s\S]*?)<\/comandos>/i)?.[1] ?? "";
  const out = [];
  for (const m of bloque.matchAll(/^\s*([a-z á-ú]{3,30})\s*:\s*(subir|bajar|fijar)\s*(\d{1,2})?\s*(?:\(x([1-3])\))?/gim)) {
    out.push({
      dimension: m[1].trim(),
      direccion: m[2],
      valor: m[3] != null ? Math.max(0, Math.min(10, Number(m[3]))) : void 0,
      intensidad: Number(m[4]) || 2,
      motivo: fraseOriginal
    });
  }
  return dedupeComandos(out);
}

// src/lib/prism/forja/canvas.ts
function estadoCanvasInicial() {
  return {
    fase: "esperando",
    activa: "A",
    visiones: [],
    artifact: null,
    historial: [],
    steering: [],
    adnAjustado: null,
    acciones: []
  };
}
function steerCanvas(_estado, frase, adn) {
  const comandos = interpretarVoz(frase);
  const nuevoAdn = comandos.length ? aplicarComandos(adn, comandos) : null;
  return {
    comandos,
    interpretacion: textoComandos(comandos),
    prohibidoAutomatico: [
      "a\xF1adir gradientes autom\xE1ticamente",
      "a\xF1adir glassmorphism autom\xE1ticamente",
      "cambiar la estructura sin pedirlo"
    ],
    nuevoAdn
  };
}
function accionesDeFase(f) {
  switch (f) {
    case "direcciones-listas":
      return ["iterar"];
    case "canvas-listo":
      return ["iterar", "fusionar", "comparar", "codigo"];
    case "iterando":
    case "comparando":
      return ["iterar", "comparar"];
    case "listo-para-codigo":
      return ["codigo", "exportar"];
    case "exportado":
      return ["exportar"];
    default:
      return [];
  }
}
function transicionCanvas(estado, nuevaFase, cambios = {}) {
  const siguiente = { ...estado, ...cambios, fase: nuevaFase };
  siguiente.acciones = accionesDeFase(nuevaFase);
  return siguiente;
}
function guardarVersion(estado, etiqueta, artifact, score) {
  const historial2 = [...estado.historial, { etiqueta, artifact, score }].slice(-10);
  return transicionCanvas(estado, estado.fase, { historial: historial2 });
}
function compararVersiones(estado, a, b) {
  const va = estado.historial[a];
  const vb = estado.historial[b];
  if (!va || !vb) return null;
  const mejor = vb.score >= va.score ? vb : va;
  const peor = mejor === va ? vb : va;
  return {
    mejor: `${mejor.etiqueta} (score ${mejor.score})`,
    detalle: `Diferencia de score: ${mejor.score - peor.score} puntos a favor de ${mejor.etiqueta}.`
  };
}
function textoCritic(resumenRevisor, identidad, genericidadNivel) {
  return [
    `# FORJA CRITIC`,
    `Identidad: ${identidad}/100`,
    `Genericidad: ${genericidadNivel}`,
    resumenRevisor
  ].join("\n");
}

// src/lib/prism/forja/mejora-pagina.ts
var HUELLAS_FRAMEWORKS = [
  { nombre: "Next.js", pista: /__next|next\/head|data-nextjs/i },
  { nombre: "React", pista: /data-reactroot|react-dom/i },
  { nombre: "Vue", pista: /data-v-[0-9a-f]{8}|v-app/i },
  { nombre: "Tailwind", pista: /\b(?:flex|grid)\s+(?:items-|justify-|gap-)|\b(?:bg|text|p|m)-\[/i },
  { nombre: "Bootstrap", pista: /\b(?:btn|col-md|row|container-fluid)\b/i },
  { nombre: "WordPress", pista: /wp-content|wp-includes/i }
];
function extraerSistemaActual(codigo) {
  const colores = [...new Set([...codigo.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()))].slice(0, 10);
  const fuentes = listaDeFuentes(codigo);
  const secciones = [
    ...codigo.matchAll(/<(?:section|header|footer|nav|main)[^>]*(?:class|id)="([^"]{2,40})"/gi)
  ].map((m) => m[1].split(/\s+/)[0]).slice(0, 10);
  const frameworks = HUELLAS_FRAMEWORKS.filter((f) => f.pista.test(codigo)).map((f) => f.nombre);
  const escala = [...new Set([...codigo.matchAll(/font-size\s*:\s*([\d.]+)(?:px|rem)/gi)].map((m) => `${m[1]}${m[2]}`))].slice(0, 6);
  return { colores, fuentes, secciones, frameworks, escalaTipografica: escala };
}
function listaDeFuentes(codigo) {
  const out = [];
  const vistos = /* @__PURE__ */ new Set();
  for (const m of codigo.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const primera = m[1].split(",")[0].replace(/["']/g, "").trim().slice(0, 40);
    const clave2 = primera.toLowerCase();
    if (primera && !vistos.has(clave2)) {
      vistos.add(clave2);
      out.push(primera);
    }
    if (out.length >= 4) break;
  }
  return out;
}
function diagnosticarPagina(codigo, mensajeUsuario = "") {
  const sistema = extraerSistemaActual(codigo);
  const hallazgos = chequeosEstaticos(codigo);
  const gen1 = detectarGenericidad(codigo);
  const gen2 = analisisVisual(codigo);
  const informe = revisarVisual(codigo);
  const identidad = Math.round(gen1.puntuacionIdentidad * 0.5 + gen2.puntuacion * 0.5);
  const adnDetectado = sanearAdn2({
    ...adn2DesdeAdn1(null, mensajeUsuario),
    identidad: identidad >= 70 ? "el proyecto actual ya tiene voz propia (conservar y potenciar)" : "el proyecto actual deriva a plantilla (necesita decisiones propias)",
    color: sistema.colores.slice(0, 3).map((c) => `color en uso: ${c} (decidir si se queda)`),
    tipografia: sistema.fuentes.slice(0, 2).map((f) => `fuente en uso: ${f}`),
    composicion: [
      `${sistema.secciones.length} secciones: ${sistema.secciones.slice(0, 5).join(" \u2192 ") || "(sin estructura clara)"}`,
      `focal point: ${gen2.focalPoint ? "presente" : "AUSENTE (definir uno)"}`
    ],
    referencias: [],
    antiPatrones: gen1.sintomas.map((s) => s.nombre)
  });
  const propuesta = [];
  if (!gen2.focalPoint) propuesta.push("Definir UN focal point dominante en la portada (ahora la vista no aterriza en nada).");
  for (const s of gen1.sintomas.slice(0, 4)) {
    propuesta.push(`Sustituir \xAB${s.nombre}\xBB \u2192 ${s.alternativa}`);
  }
  for (const s of gen2.sintomas.slice(0, 3)) {
    propuesta.push(`Composici\xF3n: ${s.nombre} (${s.evidencia}) \u2192 romper el patr\xF3n con estructura variable.`);
  }
  const criticos = hallazgos.filter((h) => h.severidad === "critico");
  if (criticos.length) {
    propuesta.push(`Reparar ${criticos.length} hallazgo(s) cr\xEDtico(s) del inspector antes de cualquier est\xE9tica.`);
  }
  if (!propuesta.length) {
    propuesta.push("El c\xF3digo actual est\xE1 sano: el redise\xF1o debe ser quir\xFArgico (foco, identidad, detalle), no un refactor.");
  }
  return {
    sistema,
    hallazgos,
    identidad,
    sintomas: [...gen1.sintomas.map((s) => s.nombre), ...gen2.sintomas.map((s) => s.nombre)],
    scoreActual: scoreDe(informe),
    adnDetectado,
    propuesta: propuesta.slice(0, 8),
    siguientesPasos: [
      "confirmar el ADN detectado con el usuario (o ajustar)",
      "generar la VARIANTE con el Codificador respetando el ADN",
      "comparar score actual vs variante (revisor visual)",
      "aplicar solo si la variante GANA con evidencia"
    ]
  };
}
function promptVarianteMejora(codigo, diagnostico) {
  return [
    `## Genera la VARIANTE mejorada de esta p\xE1gina`,
    `ADN detectado (respetar y POTENCIAR):`,
    `- Identidad: ${diagnostico.adnDetectado.identidad}`,
    `- Composici\xF3n: ${diagnostico.adnDetectado.composicion.join("; ")}`,
    `- Prohibido: ${[...diagnostico.adnDetectado.prohibiciones, ...diagnostico.adnDetectado.antiPatrones].join("; ")}`,
    ``,
    `## Cambios pedidos (con evidencia, no gustos)`,
    ...diagnostico.propuesta.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `## C\xF3digo actual`,
    codigo.slice(0, 5e4),
    ``,
    `Devuelve el HTML COMPLETO de la variante. Solo el c\xF3digo.`
  ].join("\n");
}
function compararMejora(scoreActual, scoreVariante) {
  const delta = scoreVariante - scoreActual;
  return {
    aplicable: delta > 0,
    veredicto: delta > 0 ? `La variante GANA (+${delta} puntos): procede aplicar.` : delta === 0 ? "Empate t\xE9cnico: conservar el original (no cambiar por cambiar)." : `La variante PIERDE (${delta} puntos): descartar y conservar el original.`
  };
}

// src/lib/prism/forja/reference-dna.ts
var SENALES2 = [
  { re: /\b(dark|oscuro|black canvas|fondo negro|noche)\b/i, dimension: "palette", principio: "lienzo oscuro como base de la composici\xF3n" },
  { re: /\b(purple|violeta|morado|lila|magenta)\b/i, dimension: "palette", principio: "paleta dominante de tono p\xFArpura con acento saturado" },
  { re: /\b(neon|neón|glow|brillo)\b/i, dimension: "palette", principio: "acento luminoso usado solo en el focal" },
  { re: /\b(oversized|huge|gigante|enorme tipografia|tipografía enorme|grande tipografia)\b/i, dimension: "typography", principio: "tipograf\xEDa display a escala de escena" },
  { re: /\b(mono|monospace|monoespaciad|t[eé]cnic)\b/i, dimension: "typography", principio: "pareja con voz t\xE9cnica (mono para datos/etiquetas)" },
  { re: /\b(grid|reticula|retícula|technic|t[eé]cnic)\b/i, dimension: "composition", principio: "ret\xEDcula t\xE9cnica visible que ordena la escena" },
  { re: /\b(asymmetr|asimetr)\w*/i, dimension: "composition", principio: "composici\xF3n asim\xE9trica con foco descentrado" },
  { re: /\b(layer|capas|superpuesta|overlap)\b/i, dimension: "composition", principio: "capas superpuestas con solapamiento intencional" },
  { re: /\b(dense|densid|alta densidad|saturad)\b/i, dimension: "density", principio: "densidad alta controlada con jerarqu\xEDa clara" },
  { re: /\b(airy|aire|minimal|limpio|espacioso)\b/i, dimension: "density", principio: "aire generoso: pocos elementos, bien colocados" },
  { re: /\b(depth|profundidad|3d|parallax|perspectiv)\b/i, dimension: "depth", principio: "profundidad real: capas a distinta distancia" },
  { re: /\b(central 3d|objeto 3d|objeto central|3d object)\b/i, dimension: "objectTreatment", principio: "objeto 3D central como punto focal de la escena" },
  { re: /\b(floating ui|ui flotante|cards flotan|flotantes)\b/i, dimension: "motion", principio: "UI flotante con deriva ambiente lenta" },
  { re: /\b(parallax)\b/i, dimension: "motion", principio: "parallax por capas al hacer scroll" },
  { re: /\b(animad|animated|motion|movimiento)\b/i, dimension: "motion", principio: "movimiento con prop\xF3sito: entrada, foco y feedback" },
  { re: /\b(rounded|redondead|curvas suaves|suave)\b/i, dimension: "surfaces", principio: "superficies redondeadas generosas (24-28px)" },
  { re: /\b(sharp|recto|angul|filo)\b/i, dimension: "surfaces", principio: "bordes rectos con precisi\xF3n t\xE9cnica" },
  { re: /\b(glass|transl[uú]cido|blur)\b/i, dimension: "surfaces", principio: "vidrio usado con moderaci\xF3n y solo sobre capas con contenido" },
  { re: /\b(hover|tilt|magnetic|magn[eé]tic|interactiv)\b/i, dimension: "interaction", principio: "microinteracci\xF3n visible en cada superficie viva" },
  { re: /\b(reveal|aparece|entra|stagger)\b/i, dimension: "interaction", principio: "contenido que se revela con el scroll por piezas" },
  { re: /\b(fullscreen|pantalla completa|hero grande|immersive|inmersiv)\b/i, dimension: "heroStructure", principio: "hero a pantalla completa con un solo mensaje" },
  { re: /\b(split|dividido|dos columnas|lado a lado)\b/i, dimension: "heroStructure", principio: "hero dividido: promesa y prueba visible" },
  { re: /\b(minimal navigation|navegaci[óo]n m[ií]nima|nav m[ií]nima)\b/i, dimension: "navigation", principio: "navegaci\xF3n m\xEDnima: logo + una acci\xF3n" },
  { re: /\b(metric|metricas|m[eé]tricas|kpi|n[uú]meros flotan)\b/i, dimension: "objectTreatment", principio: "m\xE9tricas flotantes acompa\xF1ando al objeto" },
  { re: /\b(product visualiz|visualizaci[óo]n de producto|ui real|captura)\b/i, dimension: "objectTreatment", principio: "el producto se muestra real (UI viva), nunca maqueta vac\xEDa" },
  { re: /\b(cinemat|escena|pelicul|film)\b/i, dimension: "heroStructure", principio: "composici\xF3n cinematogr\xE1fica: apertura, desarrollo, cierre" }
];
function adnReferenciaVacio() {
  return {
    palette: [],
    typography: [],
    composition: [],
    density: "desconocida",
    depth: "desconocida",
    motion: [],
    surfaces: [],
    radius: "\u2014",
    interaction: [],
    heroStructure: "\u2014",
    navigation: "\u2014",
    objectTreatment: "\u2014"
  };
}
function extraerAdnReferencia(texto) {
  const t = texto || "";
  const dna = adnReferenciaVacio();
  for (const s of SENALES2) {
    try {
      if (s.re.test(t)) {
        const v = dna[s.dimension];
        if (Array.isArray(v)) {
          if (!v.includes(s.principio)) v.push(s.principio);
        } else if (s.dimension === "density") {
          dna.density = /\b(dense|densid|alta)\b/i.test(t) ? "alta" : /\b(airy|minimal|aire)\b/i.test(t) ? "baja" : "media";
        } else if (s.dimension === "depth") {
          dna.depth = /\b(3d|profundidad|parallax)\b/i.test(t) ? "alta" : "media";
        } else if (s.dimension === "surfaces") {
          dna.surfaces = dna.surfaces.includes(s.principio) ? dna.surfaces : [...dna.surfaces, s.principio];
        } else if (s.dimension === "interaction") {
          dna.interaction = dna.interaction.includes(s.principio) ? dna.interaction : [...dna.interaction, s.principio];
        } else if (s.dimension === "heroStructure") {
          dna.heroStructure = s.principio;
        } else if (s.dimension === "navigation") {
          dna.navigation = s.principio;
        } else if (s.dimension === "objectTreatment") {
          dna.objectTreatment = s.principio;
        }
        if (/redondead|rounded/.test(t)) dna.radius = "24-28px";
        if (/\b(sharp|recto|angul)\b/i.test(t)) dna.radius = "0-4px";
      }
    } catch {
    }
  }
  return dna;
}
function principiosNoPixeles(dna) {
  const aprender2 = [];
  const noCopiar = [];
  if (dna.palette.length) aprender2.push(`lenguaje de color: ${dna.palette.join("; ")}`);
  if (dna.typography.length) aprender2.push(`lenguaje tipogr\xE1fico: ${dna.typography.join("; ")}`);
  if (dna.composition.length) aprender2.push(`composici\xF3n: ${dna.composition.join("; ")}`);
  if (dna.depth !== "desconocida" && dna.depth !== "\u2014") aprender2.push(`profundidad ${dna.depth} con prop\xF3sito`);
  if (dna.motion.length) aprender2.push(`movimiento: ${dna.motion.join("; ")}`);
  if (dna.surfaces.length) aprender2.push(`superficies: ${dna.surfaces.join("; ")}`);
  if (dna.interaction.length) aprender2.push(`interacci\xF3n: ${dna.interaction.join("; ")}`);
  if (dna.heroStructure !== "\u2014") aprender2.push(`estructura del hero: ${dna.heroStructure}`);
  if (dna.navigation !== "\u2014") aprender2.push(`navegaci\xF3n: ${dna.navigation}`);
  if (dna.objectTreatment !== "\u2014") aprender2.push(`tratamiento del objeto: ${dna.objectTreatment}`);
  noCopiar.push("estructura literal de secciones y componentes (nueva estructura, mismos principios)");
  noCopiar.push("marca, textos, logotipos, im\xE1genes y contenido de la referencia");
  if (dna.density === "alta") noCopiar.push("densidad asfixiante: adopta la jerarqu\xEDa, no la saturaci\xF3n");
  if (/glass/i.test(dna.surfaces.join(" "))) noCopiar.push("glassmorphism en exceso: el vidrio es acento, no sistema");
  const total = aprender2.length;
  return {
    aprender: aprender2.slice(0, 8),
    noCopiar: noCopiar.slice(0, 5),
    resumen: total ? `Reference DNA: ${total} principio(s) de lenguaje extra\xEDdo(s) \u2014 se genera una composici\xF3n NUEVA con esos principios` : "Reference DNA: sin se\xF1ales suficientes en la referencia; pedir atributos m\xE1s concretos"
  };
}
function seccionAdnReferencia(dna) {
  const p = principiosNoPixeles(dna);
  if (!p.aprender.length) return "";
  return [
    `# REFERENCE DNA (principios, NO p\xEDxeles \u2014 correcciones \xA724/\xA725)`,
    `\xABNo voy a copiar esta referencia: extraigo su LENGUAJE y creo una experiencia nueva.\xBB`,
    `Aprender (principios):`,
    ...p.aprender.map((a) => `- ${a}`),
    `Prohibido copiar:`,
    ...p.noCopiar.map((a) => `- ${a}`)
  ].join("\n");
}

// src/lib/prism/forja/referencias.ts
function analizarReferencia(ref) {
  const texto = ref.texto ?? "";
  const atributos = {
    estructura: [],
    color: [],
    tipografia: [],
    densidad: "desconocida",
    representaciones: [],
    riesgos: []
  };
  if (ref.tipo === "url" && ref.url) {
    const dictamen = urlAptaparaAprendizaje(ref.url);
    atributos.riesgos.push(dictamen.ok ? "contenido externo: usar como inspiraci\xF3n, nunca como copia" : `URL no apta: ${dictamen.motivos[0] ?? "rechazada por seguridad"}`);
    ref.urlSegura = dictamen.ok;
    if (!dictamen.ok) return atributos;
  }
  if (ref.tipo === "html" || ref.tipo === "repositorio") {
    const secciones = [...texto.matchAll(/<(?:section|header|footer|main)[^>]*(?:class|id)="([^"]{2,40})"/gi)].map((m) => m[1].split(/\s+/)[0]).slice(0, 8);
    atributos.estructura = listaLimpia(secciones, 8, 40);
    const hexes = [...texto.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
    atributos.color = listaLimpia([...new Set(hexes)], 5, 12);
    const fuentes = [...texto.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim().slice(0, 40));
    atributos.tipografia = listaLimpia(fuentes, 3, 60);
    const dens = texto.replace(/<[^>]+>/g, " ").trim().length;
    atributos.densidad = dens > 4e3 ? "alta" : dens > 1200 ? "media" : "baja";
  }
  if (ref.tipo === "descripcion" || ref.tipo === "design-system") {
    const lineas = texto.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter((l) => l.length >= 8 && l.length <= 120).slice(0, 8);
    atributos.estructura = listaLimpia(lineas, 8, 90);
  }
  if (ref.tipo === "imagen" || ref.tipo === "screenshot") {
    atributos.estructura = listaLimpia(ref.atributosVisuales ?? [], 6, 80);
    if (!(ref.atributosVisuales ?? []).length) {
      atributos.riesgos.push("captura sin an\xE1lisis visual previo: pide atributos al host multimodal");
    }
  }
  const cuerpo = `${texto} ${(ref.atributosVisuales ?? []).join(" ")}`.toLowerCase();
  const mapaRepr = [
    { palabra: /timeline|l[ií]nea de tiempo|cronolog|historia\b/, nombre: "l\xEDnea de tiempo" },
    { palabra: /mapa|cartograf|geograf/, nombre: "mapa" },
    { palabra: /compara|versus|frente a/, nombre: "comparaci\xF3n lado a lado" },
    { palabra: /pasos|proceso|c[óo]mo funciona/, nombre: "proceso en pasos" },
    { palabra: /dashboard|panel de control/, nombre: "dashboard" },
    { palabra: /editorial|revista|art[ií]culo/, nombre: "editorial" }
  ];
  for (const { palabra, nombre } of mapaRepr) {
    if (palabra.test(cuerpo)) atributos.representaciones.push(nombre);
  }
  atributos.representaciones = atributos.representaciones.slice(0, 4);
  const fuenteDna = [texto, (ref.atributosVisuales ?? []).join(" ")].join(" ");
  if (fuenteDna.trim()) atributos.adn = extraerAdnReferencia(fuenteDna);
  return atributos;
}
function inspiracionDesdeAtributos(atributos, tipo) {
  const referencias = [];
  const antiPatrones = [];
  if (atributos.estructura.length) {
    referencias.push(`${tipo}: composici\xF3n que ordena as\xED \u2014 ${atributos.estructura.slice(0, 3).join(" \u2192 ")}`);
  }
  if (atributos.representaciones.length) {
    referencias.push(`${tipo}: usa ${atributos.representaciones.join(" y ")} para su informaci\xF3n (valorar para el nuestro)`);
  }
  if (atributos.densidad === "media") {
    referencias.push(`${tipo}: equilibrio de densidad notable (ni saturado ni vac\xEDo)`);
  }
  if (atributos.tipografia.length) {
    referencias.push(`${tipo}: pareja tipogr\xE1fica con contraste real (${atributos.tipografia[0]})`);
  }
  if (atributos.densidad === "alta") antiPatrones.push(`${tipo}: densidad asfixiante \u2014 no imitar`);
  if (atributos.densidad === "baja" && tipo !== "descripcion") antiPatrones.push(`${tipo}: aire sin contenido \u2014 no imitar`);
  if (atributos.riesgos.length) antiPatrones.push(...atributos.riesgos.map((r) => `${tipo}: ${r}`));
  antiPatrones.push(`${tipo}: copiar colores/fuentes literalmente \u2014 prohibido (inspiraci\xF3n \u2260 plantilla)`);
  if (atributos.adn) {
    const p = principiosNoPixeles(atributos.adn);
    referencias.push(...p.aprender);
    antiPatrones.push(...p.noCopiar);
  }
  return {
    referencias: listaLimpia(referencias, 8, 110),
    antiPatrones: listaLimpia(antiPatrones, 8, 110),
    resumen: `Referencia (${tipo}) analizada: ${atributos.estructura.length} pistas de estructura, ${atributos.representaciones.length} representaciones, ${antiPatrones.length} riesgos a no imitar${atributos.adn ? " + Reference DNA de principios" : ""}.`
  };
}
function inyectarEnAdn(adn, inspiraciones) {
  const referencias = listaLimpia(
    [...adn.referencias, ...inspiraciones.flatMap((i) => i.referencias)],
    8,
    110
  );
  const antiPatrones = listaLimpia(
    [...adn.antiPatrones, ...inspiraciones.flatMap((i) => i.antiPatrones)],
    8,
    110
  );
  return { ...adn, referencias, antiPatrones };
}
function seccionReferencias(adn) {
  if (!adn.referencias.length && !adn.antiPatrones.length) return "";
  return [
    `# Referencias e inspiraci\xF3n (regla: ABSTRACTO, nunca copiar)`,
    adn.referencias.length ? `Aprender: ${adn.referencias.join("; ")}` : "",
    adn.antiPatrones.length ? `No imitar: ${adn.antiPatrones.join("; ")}` : ""
  ].filter(Boolean).join("\n");
}
function nuevoIdReferencia() {
  return `ref-${Date.now().toString(36)}`;
}

// src/lib/prism/forja/contrato-experiencia.ts
var SCHEMA_CONTRATO = "forja.experiencia@1";
function exportarContrato(sel, mensaje, version = "4.6.0", edicion = {}) {
  return {
    schema: SCHEMA_CONTRATO,
    version,
    generado: (/* @__PURE__ */ new Date()).toISOString(),
    mensaje: (mensaje || "").slice(0, 2e3),
    edicion,
    decision: {
      familia: sel.familia.familia,
      receta: sel.receta.receta.id,
      hero: sel.hero.tipo,
      representacion: sel.representacion.modo,
      intensidad: sel.planMovimiento.intensidad,
      modoEspacial: sel.dna.spatial.mode,
      profundidad: Math.round(sel.dna.spatial.depth * 100) / 100,
      objeto3d: sel.objeto ? sel.objeto.id : null,
      primitivas: [...sel.primitivas.primitivas],
      cards: [...sel.cards.variantes]
    },
    razones: sel.razonesDna.slice(0, 6)
  };
}
function serializarContrato(c) {
  return JSON.stringify(c, null, 2);
}
var MODOS_ESPACIALES = ["flat", "2.5d", "3d", "immersive"];
function validarContrato(c) {
  const errores = [];
  const avisos = [];
  if (!c || typeof c !== "object") {
    return { ok: false, errores: ["el contrato debe ser un objeto JSON"], avisos };
  }
  const o = c;
  if (typeof o.schema === "string" && o.schema !== SCHEMA_CONTRATO) {
    errores.push(`schema desconocido \xAB${o.schema}\xBB (esperado ${SCHEMA_CONTRATO})`);
  }
  const ed = o.edicion ?? o;
  if (ed.familia !== void 0 && !FAMILIAS.some((f) => f.id === ed.familia)) {
    errores.push(`familia \xAB${String(ed.familia)}\xBB no existe (v\xE1lidas: ${FAMILIAS.map((f) => f.id).join(", ")})`);
  }
  if (ed.hero !== void 0 && !defHero(String(ed.hero))) {
    errores.push(`hero \xAB${String(ed.hero)}\xBB no existe (debe ser un tipo HERO_*)`);
  }
  if (ed.intensidad !== void 0) {
    const n = Number(ed.intensidad);
    if (!Number.isInteger(n) || n < 0 || n > 4) errores.push(`intensidad debe ser entero 0-4 (lleg\xF3 ${String(ed.intensidad)})`);
    if (n === 0 && ed.use3d === true) avisos.push("intensidad 0 (static) con objeto 3D: el objeto quedar\xE1 quieto \u2014 quiz\xE1 quisiste 1 o m\xE1s");
  }
  if (ed.modoEspacial !== void 0 && !MODOS_ESPACIALES.includes(ed.modoEspacial)) {
    errores.push(`modoEspacial \xAB${String(ed.modoEspacial)}\xBB no existe (v\xE1lidos: ${MODOS_ESPACIALES.join(", ")})`);
  }
  for (const campo2 of ["profundidad", "elevacion", "blur", "pesoObjeto"]) {
    if (ed[campo2] !== void 0) {
      const n = Number(ed[campo2]);
      if (!Number.isFinite(n) || n < 0 || n > 1) errores.push(`${campo2} debe ser n\xFAmero 0..1 (lleg\xF3 ${String(ed[campo2])})`);
    }
  }
  if (ed.radiusPx !== void 0) {
    const n = Number(ed.radiusPx);
    if (!Number.isFinite(n) || n < 4 || n > 32) errores.push(`radiusPx debe ser 4..32 (lleg\xF3 ${String(ed.radiusPx)})`);
  }
  if (ed.use3d !== void 0 && typeof ed.use3d !== "boolean") errores.push("use3d debe ser booleano");
  return { ok: errores.length === 0, errores, avisos };
}
function aplicarEdicionContrato(json, opts = {}) {
  const vacio = { ok: false, sel: null, ajustesAplicados: [], errores: [], css: "", script: "", contrato: "" };
  const val = validarContrato({ schema: SCHEMA_CONTRATO, edicion: json.edicion ?? {} });
  if (!val.ok) return { ...vacio, errores: val.errores };
  const ed = json.edicion ?? {};
  const ajustes = [];
  const base = seleccionarExperiencia(json.mensaje ?? "");
  const dna = clonarExperiencia(base.dna);
  if (ed.intensidad !== void 0) {
    const n = Math.max(0, Math.min(4, Number(ed.intensidad)));
    dna.motion.intensity = n === 0 ? 0 : n === 1 ? 0.2 : n === 2 ? 0.45 : n === 3 ? 0.72 : 0.9;
    ajustes.push(`intensidad de movimiento fijada a ${n}/4`);
  }
  if (ed.modoEspacial !== void 0) {
    dna.spatial.mode = ed.modoEspacial;
    ajustes.push(`modo espacial fijado a ${String(ed.modoEspacial)}`);
  }
  if (ed.profundidad !== void 0) {
    dna.spatial.depth = Math.max(0, Math.min(1, Number(ed.profundidad)));
    ajustes.push(`profundidad fijada a ${Math.round(dna.spatial.depth * 100)}%`);
  }
  if (ed.elevacion !== void 0) {
    dna.surface.elevation = Math.max(0, Math.min(1, Number(ed.elevacion)));
    ajustes.push(`elevaci\xF3n de superficies fijada a ${Math.round(dna.surface.elevation * 100)}%`);
  }
  if (ed.blur !== void 0) {
    dna.surface.blur = Math.max(0, Math.min(1, Number(ed.blur)));
    ajustes.push(`blur de superficies fijado a ${Math.round(dna.surface.blur * 100)}%`);
  }
  if (ed.radiusPx !== void 0) {
    dna.surface.radius = `${Math.max(4, Math.min(32, Number(ed.radiusPx)))}px`;
    ajustes.push(`radio base fijado a ${dna.surface.radius}`);
  }
  if (ed.use3d !== void 0) {
    dna.object.use3d = Boolean(ed.use3d);
    if (dna.object.use3d) {
      dna.spatial.mode = dna.spatial.mode === "flat" ? "3d" : dna.spatial.mode;
      dna.spatial.perspective = Math.max(dna.spatial.perspective, 0.7);
    }
    ajustes.push(`objeto 3D ${dna.object.use3d ? "activado" : "desactivado"}`);
  }
  if (ed.pesoObjeto !== void 0) {
    dna.object.visualWeight = Math.max(0, Math.min(1, Number(ed.pesoObjeto)));
    ajustes.push(`peso visual del objeto fijado a ${Math.round(dna.object.visualWeight * 100)}%`);
  }
  const familiaForzada = ed.familia !== void 0 ? ed.familia : void 0;
  if (familiaForzada) ajustes.push(`familia fijada a ${familiaForzada}`);
  if (ed.hero !== void 0) ajustes.push(`hero fijado a ${String(ed.hero)}`);
  const sel = seleccionarExperiencia(json.mensaje ?? "", {
    ...opts,
    dnaForzado: dna,
    familiaForzada,
    heroForzado: ed.hero,
    // v4.7 — el mensaje original viaja: el plano de contenido lo necesita
    // para extraer los hechos del brief (precios, horarios, ciudad…).
    mensajeOriginal: json.mensaje ?? ""
  });
  const contrato = exportarContrato(sel, json.mensaje ?? "", json.version ?? "4.6.0", ed);
  return {
    ok: true,
    sel,
    ajustesAplicados: ajustes,
    errores: [],
    css: cssDeterminista(sel),
    script: scriptDeterminista(sel),
    contrato: serializarContrato(contrato)
  };
}
function resumenEdicion(r) {
  if (!r.ok) return `contrato RECHAZADO: ${r.errores.join("; ")}`;
  return r.ajustesAplicados.length ? `contrato editado y re-compilado (0 tokens): ${r.ajustesAplicados.join(" \xB7 ")}` : "contrato re-compilado sin ediciones";
}
export {
  ARQUETIPOS,
  CAPACIDADES_FORJA,
  CAPAS_CONOCIMIENTO,
  CAPAS_FORJA,
  CARDS,
  CASCADA,
  CASOS_BENCHMARK,
  CATALOGO_ANTIPATRONES,
  CATALOGO_INTENSIDAD,
  CATALOGO_SECCIONES,
  CATEGORIAS_FORJA,
  CLAVES_DELEGADAS,
  CLAVES_MEMORIA2,
  CLAVE_CONOCIMIENTO_GLOBAL,
  CLAVE_FUENTES_USUARIO,
  CLAVE_MEMORIA,
  CONFIRMACIONES_PARA_CONSOLIDAR,
  CONFIRMACIONES_PARA_PROHIBIR,
  CONOCIMIENTO_GLOBAL_DEFECTO,
  CRITERIOS_ARENA,
  CSS_ICONOS,
  CSS_IMAGEN,
  DIMENSIONES_ADN2,
  DOMINIOS_BLOQUEADOS,
  ENTRADA_FORJA,
  EQUIPO_FORJA,
  ESCALA_TIEMPO,
  FAMILIAS,
  FASES,
  FORJA_ID,
  FORJA_NOMBRE,
  FORJA_RESUMEN,
  FORMATO_VISION,
  FUENTES_SEMILLA,
  FUENTES_USUARIO_DEFECTO,
  HABILIDADES_FORJA,
  ICONOS,
  JUECES_2,
  JUECES_ESTUDIO,
  MAX_AJUSTES_MAQUETA,
  MAX_CONTINUACIONES_NUCLEO,
  MAX_EJES_ADN,
  MAX_EXPERIMENTOS,
  MAX_FALLOS,
  MAX_FUENTES_USUARIO,
  MAX_ITERACIONES_MEJORA,
  MAX_LECCIONES_GENOMA,
  MAX_LECCIONES_PROYECTO,
  MAX_LENGUAJE_ADN,
  MAX_LISTA_ADN2,
  MAX_PROHIBICIONES_ADN,
  MAX_PROHIBICIONES_PROMPT,
  MAX_REGLAS,
  MAX_REGLAS_GLOBALES,
  MAX_RONDAS_DEFECTO,
  MAX_RONDAS_LIMITE,
  MAX_TOKENS_DEFECTO,
  MAX_TOKENS_LIMITE,
  MAX_TRAITOS_ADN,
  MEMORIA_DEFECTO,
  MIN_TOKENS_ROL,
  NIVEL,
  NOMBRES_NIVEL,
  NOMBRE_VERSION_FORJA,
  NOVEDADES_FORJA,
  ORDEN_PIPELINE,
  PATRONES_POSITIVOS,
  PERFILES,
  PERFIL_COSTO_DEFECTO,
  PERFIL_DEFECTO,
  PLANES_MVP,
  PREGUNTA_SEMANTICA,
  PRESUPUESTOS,
  PRESUPUESTO_APRENDIZAJE,
  PRIMITIVAS,
  PRIMITIVAS_BLOQUE,
  PROMPT_MAQUETA,
  PROMPT_VISION,
  RECETAS,
  RECETAS_COSTO,
  REPRESENTACIONES,
  ROLES_FORJA,
  RuntimeLocal,
  SCHEMA_CONTRATO,
  UMBRALES_DEFECTO,
  UMBRAL_EDITORIAL,
  UMBRAL_NODOS_MOVIL,
  UMBRAL_PESO_KB,
  VERSION_FORJA,
  VERTICALES,
  absorberLeccionesGenoma,
  adn2DesdeAdn1,
  adn2EstaVacio,
  adn2Vacio,
  adnDesdePeticion,
  adnReferenciaVacio,
  adnVacio,
  agregarTelemetria,
  ahorroEstimado,
  ajustarMaquetaForja,
  ajustarPropuesta,
  ajustesFamiliaAprendidos,
  ajustesHeroAprendidos,
  alternarFuente,
  anadirFuente,
  analisisVisual,
  analizarReferencia,
  aplicarComandos,
  aplicarEdicionContrato,
  aplicarVigencia,
  aporteAlAdn,
  aprender,
  aprenderDeExito,
  arena2Forja,
  arenaForja,
  arquetipoDeFamilia,
  arquetipoPorId,
  artifactAEvaluacion,
  asignarFamiliasArena,
  auditarContraDesignSystem,
  auditarDetalle,
  auditarExperiencia,
  auditarYparchearMovimiento,
  bloquesDeHabilidades,
  cacheEnCascada,
  cacheMultinivelCompartido,
  cadenaDesdeSugerencias,
  capaDe,
  cargarHistorial,
  cargarMemoriaAprendizaje,
  casoPorCategoria,
  catalogoObjetos3d,
  cerrarRegistro,
  chequeosEstaticos,
  claveArquitectura,
  claveFicha,
  claveMaqueta,
  claveModelo,
  claveParche,
  clavePatron,
  claveQA,
  claveRespuesta,
  clonarExperiencia,
  coherenciaFamilia,
  comoFuenteCiclo,
  comoResultadoForja,
  compararMejora,
  compararVersiones,
  compilarContexto,
  complejidadDe,
  conflictoEntre,
  conocimientoParaPrompt,
  construirCompositionBlueprint,
  construirExperienceManifest,
  construirPlanEspacial,
  construirPlanMovimiento,
  construirPlanResponsivo,
  construirPlanoContenido,
  construirPropuesta,
  consultarRegistros,
  contextoSkillsDesdeAdn2,
  continuarConLlamada,
  continuarForja,
  continuarSalidaTruncada,
  corpusDeSenales,
  correrBenchmark,
  correrCaso,
  crearAdaptadorForja,
  crearCacheMemoria,
  crearCacheMultinivel,
  crearDesignSystem,
  crearLibroROI,
  crearLlamadaEficiente,
  crearPresupuesto,
  crearRegistro,
  crearSaludProveedores,
  crearTelemetriaForja,
  criteriosArenaDesdeAdn2,
  cssCards,
  cssCompositionBlueprint,
  cssDeterminista,
  cssEscenario,
  cssIconografia,
  cssMovimiento,
  cssObjeto3d,
  cssPrimitivas,
  debeMaquetar,
  decidirSiguientePaso,
  defCard,
  defHero,
  defObjeto3d,
  defPrimitiva,
  defectosCorregibles,
  deserializarAprendizaje,
  deserializarConocimiento,
  deserializarFuentes,
  deserializarGenoma,
  deserializarRegistro,
  designMdDesdeAdn2,
  designSystemCompleto,
  desviacionDeDna,
  detectarGenericidad,
  detectarParches,
  diagnosticarPagina,
  dictamenFuente,
  editarFuente,
  ejecutarBucleMejora,
  ejecutarEnRuntime,
  ejecutarForja,
  ejecutarMvpForja,
  elegirCards,
  elegirHero,
  elegirIconos,
  elegirObjeto3d,
  elegirPrimitivas,
  esCortePorLongitud,
  esErrorDeRed,
  esErrorFatal,
  esForja,
  esReglaDeCalidad,
  esSuficientementeBueno,
  esTruncadoEstructural,
  escaparHtml,
  estadisticasMemoria2,
  estadisticasPorCapa,
  estadoCanvasInicial,
  estimarTokensSalida,
  estudioForja,
  evaluarExito,
  evaluarPuerta,
  evidenciaDeterminista,
  experienciaPorDefecto,
  explicarVision2,
  exportarContrato,
  extraerAdnReferencia,
  extraerCodigo,
  extraerDecisiones,
  extraerHechos,
  extraerSistemaActual,
  familiaPorId,
  faseDeRol,
  fichaForja,
  figuraPlaceholder,
  fuentePorId,
  fuentesActivas,
  fusionarReglas,
  fusionarReglasConInforme,
  genomaVacio,
  guardReducedMotion,
  guardarVersion,
  habilidadPorId,
  habilidadesSugeridas,
  hashTexto,
  htmlObjeto3d,
  htmlPrimitiva,
  iconoPorId,
  idV4,
  incorporarLeccionesArena,
  incorporarLeccionesGenoma,
  inferirCapa,
  informeAntiGenerico2,
  informeInspector,
  inspiracionDesdeAtributos,
  intensidadDesdeFraccion,
  interpretarOrdenFuentes,
  interpretarVoz,
  intervaloSuficiente,
  inyectarEnAdn,
  juezPorId,
  leccionArenaAGenoma,
  leccionesFamilia,
  limpiaContinuacion,
  limpiarTextoParaExtractor,
  lineaEstado,
  listaLimpia,
  mediasPorVision,
  medir,
  medirDetalle,
  medirExperiencia,
  medirMovimiento,
  medirTrasParche,
  mejorVision,
  memoria2Vacia,
  memoriaParaPrompt,
  mensajeDisenador,
  mensajeMaqueta,
  mensajeParada,
  mensajeVision,
  modoDeseado,
  motivoDeParada,
  motivoDeRespuesta,
  nivelDeDetalle,
  normalizarDuracion,
  normalizarLinea,
  normalizarUrlFuente,
  notasCoherenciaFamilia,
  nuevoIdArena,
  nuevoIdInforme,
  nuevoIdReferencia,
  obtenerHistorial,
  obtenerMemoriaAprendizaje,
  olvidarReglasDeFuente,
  olvidarTodoElConocimiento,
  operacionDeRol,
  parchearHtml,
  parchesExperiencia,
  parchesMovimiento,
  parseAdn,
  parseAdn2,
  parseCapaSemantica,
  parseComandosModelo,
  parseDirecciones,
  parseFusion,
  parseFusion2,
  parseHallazgos,
  parseLeccionesArena,
  parseNotaJuez2,
  parseNotasJuez,
  parseVeredicto,
  parseVeredictoArena,
  parseVisiones,
  parseVisiones2,
  patronesPara,
  penalizacionComposicion,
  penalizacionHero,
  perfilCostoSeguro,
  perfilRecursosDesdeCosto,
  pesoBase,
  peticionARequest,
  planArena,
  planMvp,
  presupuestoDefecto,
  presupuestoPara,
  principiosNoPixeles,
  promptBloqueAdn2,
  promptCapaSemantica,
  promptContinuacion,
  promptDirector2,
  promptDirectorFinal,
  promptDirectorFusion2,
  promptJuez,
  promptJuez2,
  promptJuezEstudio,
  promptRefinarVoz,
  promptVarianteMejora,
  puntuacionDetalle,
  quitarFuente,
  recetaParaFamilia,
  recetaPorId,
  recomendacionesAprendidas,
  recomendarPorVertical,
  recompilarDesdeDna,
  registrarComposicion,
  registrarEventoAdaptador,
  registrarExperimento,
  registrarFallo,
  registrarLeccionProyecto,
  registrarLeccionesArena,
  registrarLecturasFuentes,
  registrarPreferencia,
  registrarResultadoAprendizaje,
  registrarUso,
  reglaDuplicada,
  reglasCritiqueDesdeAdn2,
  reglasGlobalesParaPrompt,
  reglasParaPrompt,
  reiniciarAntiRepeticion,
  reiniciarAprendizaje,
  reiniciarCacheMultinivel,
  render,
  responderOrdenFuentes,
  respuestaDePropuesta,
  restriccionesCodificadorDesdeAdn2,
  resumenAntiGenerico,
  resumenAntiRepeticion,
  resumenAprendizaje,
  resumenAsignacionFamilias,
  resumenCache,
  resumenContexto,
  resumenDesignSystem,
  resumenDetalle,
  resumenEdicion,
  resumenExperienciaDna,
  resumenGenoma,
  resumenIconografia,
  resumenMetricas,
  resumenMovimiento,
  resumenObjeto3d,
  resumenPlano,
  resumenPrimitivas,
  resumenQaExperiencia,
  resumenTemprana,
  resumenTokens,
  revisarVisual,
  roiAJSON,
  roiDesdeJSON,
  rolesAsignados,
  rondasDePerfil,
  saludAJSON,
  saludDesdeJSON,
  sanearAdn,
  sanearAdn2,
  sanearRondas,
  sanearTokensRol,
  scoreDe,
  scoreEditorial,
  scriptDeterminista,
  scriptPrimitivas,
  seccionAdn,
  seccionAdn2,
  seccionAdnReferencia,
  seccionAntiGenerico,
  seccionAntiRepeticion,
  seccionAprendizaje,
  seccionCards,
  seccionCompositionBlueprint,
  seccionContratoExperiencia,
  seccionExperienceManifest,
  seccionExperienciaDna,
  seccionFamiliaAsignada,
  seccionFamilias,
  seccionGenoma,
  seccionHero,
  seccionIconografia,
  seccionObjeto3d,
  seccionPatronesPositivos,
  seccionPlanEspacial,
  seccionPlanMovimiento,
  seccionPlanResponsivo,
  seccionPlanoContenido,
  seccionPrimitivas,
  seccionPuerta,
  seccionReceta,
  seccionReferencias,
  seccionReparacionDetalle,
  seccionRepresentacion,
  seccionVisionParaMaqueta,
  seleccionarExperiencia,
  seleccionarFamilia,
  senalesHtml,
  serializarAprendizaje,
  serializarConocimiento,
  serializarContrato,
  serializarFuentes,
  serializarGenoma,
  serializarRegistro,
  similitud,
  sintetizarExperienciaDna,
  sintomasUnificados,
  steerCanvas,
  sugerirRepresentaciones,
  svgIcono,
  tablaNotas,
  techoTokens,
  telemetriaVacia,
  textoAdn,
  textoAdn2,
  textoArena2,
  textoComandos,
  textoConsultas,
  textoCritic,
  textoDesdeHtml,
  textoExito,
  textoInforme2,
  textoInformeAntiGenerico,
  textoMedicion,
  textoPanelFuentes,
  textoRevisorVisual,
  tipoContenidoAceptado,
  tokensCssDesdeAdn2,
  tokensExperienciaCss,
  transicionCanvas,
  urlAptaparaAprendizaje,
  urlSegura,
  usuarioPideMaqueta,
  usuarioQuiereDirecto,
  validarContrato,
  verticalDeContenido,
  visionesDeRespaldo
};
