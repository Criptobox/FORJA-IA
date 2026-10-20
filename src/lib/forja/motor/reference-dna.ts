/** FORJA IA — REFERENCE DNA (v4.5.0, correcciones §24 y §25).
 *
 * Cuando el usuario aporta una referencia (descripción, atributos visuales
 * del host multimodal, HTML), el sistema NO dice simplemente «hazlo
 * parecido». La referencia se convierte en ESPECIFICACIÓN:
 *
 *   REFERENCE DNA
 *   palette · typography · composition · density · depth · motion ·
 *   surfaces · radius · interaction · heroStructure · navigation ·
 *   objectTreatment
 *
 * Y la regla de oro (§25): la referencia se convierte en PRINCIPIOS, no en
 * píxeles. FORJA extrae el lenguaje (dark, technical, spatial, 3D, minimal,
 * cinematic) y genera una composición NUEVA con nueva estructura, nuevos
 * componentes, nuevo contenido y nueva identidad.
 *
 * Dos ejemplos calibrados en el doc:
 *  · Referencia SaaS moderno: purple dominant, rounded surfaces, floating
 *    UI, layered composition, product visualization, soft depth, large
 *    cards, asymmetric, high density.
 *  · Referencia portfolio inmersivo: dark canvas, technical grid,
 *    oversized typography, central 3D object, minimal navigation, high
 *    contrast, deep spatial focal point, floating metrics, cinematic.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* -------------------------------- tipos ------------------------------------ */

export interface AdnReferencia {
  palette: string[];
  typography: string[];
  composition: string[];
  density: string;
  depth: string;
  motion: string[];
  surfaces: string[];
  radius: string;
  interaction: string[];
  heroStructure: string;
  navigation: string;
  objectTreatment: string;
}

/** Cada señal detecta un PRINCIPIO y lo coloca en su dimensión. */
const SENALES: ReadonlyArray<{
  re: RegExp;
  dimension: keyof AdnReferencia;
  principio: string;
}> = [
  { re: /\b(dark|oscuro|black canvas|fondo negro|noche)\b/i, dimension: "palette", principio: "lienzo oscuro como base de la composición" },
  { re: /\b(purple|violeta|morado|lila|magenta)\b/i, dimension: "palette", principio: "paleta dominante de tono púrpura con acento saturado" },
  { re: /\b(neon|neón|glow|brillo)\b/i, dimension: "palette", principio: "acento luminoso usado solo en el focal" },
  { re: /\b(oversized|huge|gigante|enorme tipografia|tipografía enorme|grande tipografia)\b/i, dimension: "typography", principio: "tipografía display a escala de escena" },
  { re: /\b(mono|monospace|monoespaciad|t[eé]cnic)\b/i, dimension: "typography", principio: "pareja con voz técnica (mono para datos/etiquetas)" },
  { re: /\b(grid|reticula|retícula|technic|t[eé]cnic)\b/i, dimension: "composition", principio: "retícula técnica visible que ordena la escena" },
  { re: /\b(asymmetr|asimetr)\w*/i, dimension: "composition", principio: "composición asimétrica con foco descentrado" },
  { re: /\b(layer|capas|superpuesta|overlap)\b/i, dimension: "composition", principio: "capas superpuestas con solapamiento intencional" },
  { re: /\b(dense|densid|alta densidad|saturad)\b/i, dimension: "density", principio: "densidad alta controlada con jerarquía clara" },
  { re: /\b(airy|aire|minimal|limpio|espacioso)\b/i, dimension: "density", principio: "aire generoso: pocos elementos, bien colocados" },
  { re: /\b(depth|profundidad|3d|parallax|perspectiv)\b/i, dimension: "depth", principio: "profundidad real: capas a distinta distancia" },
  { re: /\b(central 3d|objeto 3d|objeto central|3d object)\b/i, dimension: "objectTreatment", principio: "objeto 3D central como punto focal de la escena" },
  { re: /\b(floating ui|ui flotante|cards flotan|flotantes)\b/i, dimension: "motion", principio: "UI flotante con deriva ambiente lenta" },
  { re: /\b(parallax)\b/i, dimension: "motion", principio: "parallax por capas al hacer scroll" },
  { re: /\b(animad|animated|motion|movimiento)\b/i, dimension: "motion", principio: "movimiento con propósito: entrada, foco y feedback" },
  { re: /\b(rounded|redondead|curvas suaves|suave)\b/i, dimension: "surfaces", principio: "superficies redondeadas generosas (24-28px)" },
  { re: /\b(sharp|recto|angul|filo)\b/i, dimension: "surfaces", principio: "bordes rectos con precisión técnica" },
  { re: /\b(glass|transl[uú]cido|blur)\b/i, dimension: "surfaces", principio: "vidrio usado con moderación y solo sobre capas con contenido" },
  { re: /\b(hover|tilt|magnetic|magn[eé]tic|interactiv)\b/i, dimension: "interaction", principio: "microinteracción visible en cada superficie viva" },
  { re: /\b(reveal|aparece|entra|stagger)\b/i, dimension: "interaction", principio: "contenido que se revela con el scroll por piezas" },
  { re: /\b(fullscreen|pantalla completa|hero grande|immersive|inmersiv)\b/i, dimension: "heroStructure", principio: "hero a pantalla completa con un solo mensaje" },
  { re: /\b(split|dividido|dos columnas|lado a lado)\b/i, dimension: "heroStructure", principio: "hero dividido: promesa y prueba visible" },
  { re: /\b(minimal navigation|navegaci[óo]n m[ií]nima|nav m[ií]nima)\b/i, dimension: "navigation", principio: "navegación mínima: logo + una acción" },
  { re: /\b(metric|metricas|m[eé]tricas|kpi|n[uú]meros flotan)\b/i, dimension: "objectTreatment", principio: "métricas flotantes acompañando al objeto" },
  { re: /\b(product visualiz|visualizaci[óo]n de producto|ui real|captura)\b/i, dimension: "objectTreatment", principio: "el producto se muestra real (UI viva), nunca maqueta vacía" },
  { re: /\b(cinemat|escena|pelicul|film)\b/i, dimension: "heroStructure", principio: "composición cinematográfica: apertura, desarrollo, cierre" },
];

export function adnReferenciaVacio(): AdnReferencia {
  return {
    palette: [],
    typography: [],
    composition: [],
    density: "desconocida",
    depth: "desconocida",
    motion: [],
    surfaces: [],
    radius: "—",
    interaction: [],
    heroStructure: "—",
    navigation: "—",
    objectTreatment: "—",
  };
}

/** Extrae el REFERENCE DNA desde texto (descripción, HTML o los atributos
 * visuales que el host multimodal ya extrajo de la imagen/captura). */
export function extraerAdnReferencia(texto: string): AdnReferencia {
  const t = texto || "";
  const dna = adnReferenciaVacio();
  for (const s of SENALES) {
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
      /* una señal nunca tumba la extracción */
    }
  }
  return dna;
}

/* ------------------------- principios, no píxeles --------------------------- */

export interface PrincipiosReferencia {
  /** el LENGUAJE que aprendemos (viaja a referencias del ADN) */
  aprender: string[];
  /** lo que NO se copia (viaja a anti-patrones) */
  noCopiar: string[];
  resumen: string;
}

/** La conversión §25: principios ≠ píxeles. Nunca «hazlo parecido»:
 * el lenguaje se especifica, la composición se reinventa. */
export function principiosNoPixeles(dna: AdnReferencia): PrincipiosReferencia {
  const aprender: string[] = [];
  const noCopiar: string[] = [];

  if (dna.palette.length) aprender.push(`lenguaje de color: ${dna.palette.join("; ")}`);
  if (dna.typography.length) aprender.push(`lenguaje tipográfico: ${dna.typography.join("; ")}`);
  if (dna.composition.length) aprender.push(`composición: ${dna.composition.join("; ")}`);
  if (dna.depth !== "desconocida" && dna.depth !== "—") aprender.push(`profundidad ${dna.depth} con propósito`);
  if (dna.motion.length) aprender.push(`movimiento: ${dna.motion.join("; ")}`);
  if (dna.surfaces.length) aprender.push(`superficies: ${dna.surfaces.join("; ")}`);
  if (dna.interaction.length) aprender.push(`interacción: ${dna.interaction.join("; ")}`);
  if (dna.heroStructure !== "—") aprender.push(`estructura del hero: ${dna.heroStructure}`);
  if (dna.navigation !== "—") aprender.push(`navegación: ${dna.navigation}`);
  if (dna.objectTreatment !== "—") aprender.push(`tratamiento del objeto: ${dna.objectTreatment}`);

  noCopiar.push("estructura literal de secciones y componentes (nueva estructura, mismos principios)");
  noCopiar.push("marca, textos, logotipos, imágenes y contenido de la referencia");
  if (dna.density === "alta") noCopiar.push("densidad asfixiante: adopta la jerarquía, no la saturación");
  if (/glass/i.test(dna.surfaces.join(" "))) noCopiar.push("glassmorphism en exceso: el vidrio es acento, no sistema");

  const total = aprender.length;
  return {
    aprender: aprender.slice(0, 8),
    noCopiar: noCopiar.slice(0, 5),
    resumen: total
      ? `Reference DNA: ${total} principio(s) de lenguaje extraído(s) — se genera una composición NUEVA con esos principios`
      : "Reference DNA: sin señales suficientes en la referencia; pedir atributos más concretos",
  };
}

/* ------------------------------- salidas ----------------------------------- */

/** Bloque para prompts del Diseñador/Codificador cuando hay referencia. */
export function seccionAdnReferencia(dna: AdnReferencia): string {
  const p = principiosNoPixeles(dna);
  if (!p.aprender.length) return "";
  return [
    `# REFERENCE DNA (principios, NO píxeles — correcciones §24/§25)`,
    `«No voy a copiar esta referencia: extraigo su LENGUAJE y creo una experiencia nueva.»`,
    `Aprender (principios):`,
    ...p.aprender.map((a) => `- ${a}`),
    `Prohibido copiar:`,
    ...p.noCopiar.map((a) => `- ${a}`),
  ].join("\n");
}
