/** FORJA IA — EXPERIENCE FAMILIES (v4.5.0, correcciones §1/§3/§23).
 *
 * ─── El problema (§1: el sesgo editorial) ───
 * En director2.ts las visiones de respaldo elegían
 *   ["editorial", "espacial", "cinematica"]
 * con EDITORIAL PRIMERO: un orden no es una preferencia creativa, pero
 * funciona como una. Resultado: muchas páginas se parecen entre sí y
 * especialmente a una revista moderna.
 *
 * ─── La solución ───
 *   INTENCIÓN → FAMILIA DE EXPERIENCIA → RECETA → COMPOSICIÓN
 *
 * Los VERTICALES (SaaS, portfolio, restaurante, agencia, fintech, startup…)
 * dicen DE QUÉ negocio hablamos. Las FAMILIAS DE EXPERIENCIA dicen CÓMO se
 * vive la página:
 *
 *   spatial · immersive · product · cinematic · interactive · 3d-showcase
 *   modular · editorial · minimal · dashboard
 *
 * «SaaS + Spatial» ya no tiene por qué significar hero + 3 cards + features
 * + testimonials + CTA.
 *
 * Regla de seguridad creativa (§23): si el usuario pide moderno/premium/
 * futurista/3D/inmersivo/interactivo/creativo/tecnológico/visual/animado,
 * las familias candidatas son spatial/product/cinematic/interactive/
 * 3d-showcase ANTES que editorial. Editorial solo domina cuando la
 * intención real es blog/magazine/artículo/noticias/publicación.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* -------------------------------- tipos ------------------------------------ */

/** Las 10 familias del doc. Editorial es UNA posibilidad, no el refugio. */
export type FamiliaExperiencia =
  | "spatial"
  | "immersive"
  | "product"
  | "cinematic"
  | "interactive"
  | "3d-showcase"
  | "modular"
  | "editorial"
  | "minimal"
  | "dashboard";

export interface FamiliaDef {
  id: FamiliaExperiencia;
  nombre: string;
  /** qué EXPERIENCIA produce, en una frase */
  descripcion: string;
  /** señales de intención que la sugieren (ES, insensible a mayúsculas) */
  cuando: RegExp;
  /** qué gana el usuario con esta familia */
  paraQue: string;
  /** riesgo honesto (igual que los arquetipos del Director) */
  riesgo: string;
}

export const FAMILIAS: ReadonlyArray<FamiliaDef> = [
  {
    id: "spatial",
    nombre: "Espacial",
    descripcion: "la página es un espacio por capas: fondo, retícula, tipografía, objeto y UI flotante con profundidad real",
    cuando: /\b(3d|espacial|spatial|capas|profundidad|parallax|perspectiva|escena)\b/i,
    paraQue: "entender un producto u obra mirándolo desde fuera, como una maqueta viva",
    riesgo: "el exceso de capas dispersa: cada capa debe ganarse su z-index",
  },
  {
    id: "immersive",
    nombre: "Inmersiva",
    descripcion: "el usuario DENTRO de la experiencia: scroll que avanza por escenas, canvas dominante, navegación mínima",
    cuando: /\b(inmersiv|immersiv|experiencia|recorrido|tour|museo|exposici[óo]n|historia interactiva)\b/i,
    paraQue: "vivir un relato o un lugar, no leer una lista de características",
    riesgo: "funciona mal con mucho contenido: acotar la escena",
  },
  {
    id: "product",
    nombre: "Producto",
    descripcion: "el PRODUCTO es el héroe: UI real flotante, capturas vivas, composición asimétrica alrededor del objeto",
    cuando: /\b(saas|startup|app|software|plataforma|producto|fintech|demo)\b/i,
    paraQue: "ver QUÉ compra el usuario antes de leer cómo funciona",
    riesgo: "capturas decorativas sin dato real parecen maquetas vacías",
  },
  {
    id: "cinematic",
    nombre: "Cinematográfica",
    descripcion: "secuencia de planos con ritmo: pantallas completas, tipografía enorme, coreografía de scroll",
    cuando: /\b(cinemat|cinematic|dramatic|dramático|pelicul|film|epic|[eé]pico|impacto)\b/i,
    paraQue: "contar una historia con ritmo: apertura, desarrollo, cierre con acción",
    riesgo: "el ritmo puede sacrificar densidad de contenido",
  },
  {
    id: "interactive",
    nombre: "Interactiva",
    descripcion: "la interacción ES el contenido: paneles vivos, tarjetas magnéticas, tilt, estados que responden a todo",
    cuando: /\b(interactiv|interactiva|interactivo|interacci[óo]n|hover|magnetic|magn[eé]tic|tilt|responsive)\b/i,
    paraQue: "explorar tocando: cada respuesta refuerza el mensaje",
    riesgo: "más feedback que contenido: la interacción necesita carne",
  },
  {
    id: "3d-showcase",
    nombre: "Escaparate 3D",
    descripcion: "un objeto 3D central (producto, pieza, edificio) que se puede mirar, girar y acercar",
    cuando: /\b(3d|objeto 3d|modelo 3d|webgl|three|showcase|escaparate|producto 3d|automoci[óo]n|automotive|gaming)\b/i,
    paraQue: "inspeccionar el objeto de verdad: rotar, acercar, ver el detalle",
    riesgo: "peso y rendimiento: si el objeto no aporta, 2.5D basta",
  },
  {
    id: "modular",
    nombre: "Modular",
    descripcion: "módulos asimétricos de distinto peso: lo importante mide más, la retícula se rompe con intención",
    cuando: /\b(portfolio|galer[ií]a|mosaico|bento|agencia|estudio|destacad|modular)\b/i,
    paraQue: "comparar piezas por peso real, no por orden de lista",
    riesgo: "mosaico monótono si todos los módulos acaban iguales",
  },
  {
    id: "editorial",
    nombre: "Editorial",
    descripcion: "estructura de publicación: jerarquía tipográfica fuerte, columna de lectura, margen que comenta",
    cuando: /\b(blog|revista|magazine|art[ií]culo|noticias?|editorial|publicaci[óo]n|journal|peri[óo]dico|ensayo)\b/i,
    paraQue: "leer con orden: el argumento es el producto",
    riesgo: "es la familia por defecto de todo generador mediocre: solo con intención editorial real",
  },
  {
    id: "minimal",
    nombre: "Minimal",
    descripcion: "menos elementos, más precisión: aire generoso, tipografía protagonista, una acción por pantalla",
    cuando: /\b(minimal|minimalista|simple|limpio|sobrio|auster|silencios)\b/i,
    paraQue: "decidir rápido sin ruido",
    riesgo: "vacío sin contenido se lee como plantilla sin terminar",
  },
  {
    id: "dashboard",
    nombre: "Dashboard",
    descripcion: "densidad alta gobernada: KPIs, gráficos y tablas con jerarquía clara y decoración cero",
    cuando: /\b(dashboard|panel de control|admin|anal[ií]tic|m[eé]tricas?|datos|report|informe)\b/i,
    paraQue: "operar: comparar, decidir y actuar con datos a la vista",
    riesgo: "el «dashboard de cajitas» sin narrativa: prohibido por el ADN",
  },
];

export function familiaPorId(id: string): FamiliaDef | undefined {
  return FAMILIAS.find((f) => f.id === id);
}

/** VERTICALES de negocio (doc §3): conviven con la familia, no la sustituyen. */
export const VERTICALES: ReadonlyArray<{ id: string; cuando: RegExp }> = [
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
    cuando:
      /\b(panader|pasteler|pizzer|helader|carnicer|pescader|florister|boutique|barber|peluquer|est[ée]tic|tatuaj|tattoo|taller|ferreter|gimnas|gym|autolavado|hostal|cl[íi]nica|dentista|veterinar|abogad|gestor[íi]a|fontaner|electricist|cerrajer|mudanz|negocio local)\w*/i,
  },
];

/* --------------------------- selección ------------------------------------- */

export interface SeleccionFamilia {
  familia: FamiliaExperiencia;
  /** segunda opción (viaja a la Arena como exploración) */
  alternativa: FamiliaExperiencia;
  vertical: string;
  /** 0..1: cuánta evidencia sostiene la decisión */
  confianza: number;
  razones: string[];
}

/** Señales de la REGLA DE SEGURIDAD CREATIVA (§23): estas palabras piden
 * una experiencia moderna y EMPUJAN fuera de editorial. */
const SENALES_MODERNAS =
  /\b(modern|moderno|premium|futurist|futurista|3d|inmersiv|immersiv|interactiv|interactivo|creativ|creativo|tecnolog|visual|animad|animated|wow|espectacular|innovador)\b/i;

/** Señales editoriales legítimas (§23): la ÚNICA puerta por la que editorial
 * puede llegar a dominar. */
const SENALES_EDITORIALES =
  /\b(blog|revista|magazine|art[ií]culo|noticias?|publicaci[óo]n|journal|peri[óo]dico|editorial|ensayo|columna)\b/i;

/** La decisión INTENCIÓN → FAMILIA (doc §1): determinista, gratis, explicable.
 * NUNCA devuelve editorial por defecto: editorial solo con su intención. */
export function seleccionarFamilia(mensaje: string): SeleccionFamilia {
  const m = (mensaje || "").toLowerCase();
  const razones: string[] = [];

  // puntuación por señales de cada familia (nº de matches + longitud)
  const puntos = new Map<FamiliaExperiencia, number>();
  let mejor: FamiliaExperiencia = "minimal"; // el refugio YA NO es editorial
  let mejorPuntos = -1;
  for (const f of FAMILIAS) {
    const rx = new RegExp(f.cuando.source, f.cuando.flags.includes("g") ? f.cuando.flags : f.cuando.flags + "g");
    const matches = m.match(rx) ?? [];
    if (!matches.length) continue;
    const p = matches.length + (matches[0]?.length ?? 0) / 1000;
    puntos.set(f.id, (puntos.get(f.id) ?? 0) + p);
    if (p > mejorPuntos) {
      mejor = f.id;
      mejorPuntos = p;
    }
  }
  if (mejorPuntos > 0) {
    razones.push(`señales de intención apuntan a «${familiaPorId(mejor)?.nombre ?? mejor}»`);
  }

  // vertical detectado (solo informativo)
  const vertical = VERTICALES.find((v) => v.cuando.test(m))?.id ?? "general";

  // §23 — regla de seguridad creativa
  const pideModerna = SENALES_MODERNAS.test(m);
  const pideEditorial = SENALES_EDITORIALES.test(m);
  if (pideModerna) {
    razones.push("el brief pide experiencia moderna: spatial/product/cinematic/interactive/3d antes que editorial (doc §23)");
    if (mejor === "editorial" && !pideEditorial) {
      mejor = "spatial";
      mejorPuntos = Math.max(mejorPuntos, 0.5);
      razones.push("editorial descartada: las señales modernas no vienen acompañadas de intención editorial");
    }
    if (mejorPuntos <= 0) {
      mejor = "spatial";
      razones.push("sin familia dominante: spatial como lectura moderna por defecto del brief");
    }
  }
  if (mejorPuntos <= 0) {
    // sin señales: minimal/modular según vertical — JAMÁS editorial de regalo
    // v4.7 — un negocio local merece superficie y profundidad, no el
    // refugio quieto: «modular» para verticales, «spatial» para los locales
    // (que es donde más dolía el «solo genera un hero con degradado»).
    mejor = vertical === "general" ? "minimal" : vertical === "local" ? "spatial" : "modular";
    razones.push(`sin señales claras: «${mejor}» como base neutra para ${vertical}`);
  }
  if (mejor === "editorial" && !pideEditorial) {
    mejor = "modular";
    razones.push("editorial exige intención editorial explícita: sustituida por modular");
  }

  // alternativa: la segunda con más puntos, o una familia de contraste
  let alternativa: FamiliaExperiencia = "modular";
  let segundoPuntos = -1;
  for (const [id, p] of puntos) {
    if (id === mejor) continue;
    if (p > segundoPuntos) {
      alternativa = id;
      segundoPuntos = p;
    }
  }
  if (segundoPuntos <= 0) {
    const contrastes: Record<string, FamiliaExperiencia> = {
      spatial: "product",
      immersive: "cinematic",
      product: "spatial",
      cinematic: "immersive",
      interactive: "product",
      "3d-showcase": "spatial",
      modular: "spatial",
      editorial: "minimal",
      minimal: "modular",
      dashboard: "product",
    };
    alternativa = contrastes[mejor] ?? "modular";
  }

  const confianza = Math.max(0, Math.min(1, mejorPuntos / 4));
  return { familia: mejor, alternativa, vertical, confianza, razones: razones.slice(0, 5) };
}

/** Bloque para prompts: la familia decidida + el catálogo para que el
 * modelo TRABAJE dentro de ella (y su alternativa para la Arena). */
export function seccionFamilias(sel: SeleccionFamilia): string {
  const cat = FAMILIAS.map((f) => `- ${f.nombre} (${f.id}): ${f.descripcion}`).join("\n");
  const elegida = familiaPorId(sel.familia)!;
  return [
    `# FAMILIA DE EXPERIENCIA (decidida por intención, doc §1/§3/§23)`,
    `Vertical: ${sel.vertical} · Familia elegida: ${elegida.nombre} (${elegida.id}) · Explora también: ${sel.alternativa}`,
    `Por qué: ${sel.razones.join("; ") || "decisión por defecto neutra"}`,
    `Qué debe producir: ${elegida.descripcion} — para que ${elegida.paraQue}.`,
    `Riesgo a controlar: ${elegida.riesgo}`,
    `REGLA §23: si el brief pide moderno/premium/futurista/3D/inmersivo/interactivo, NO propongas editorial; editorial solo para blog/magazine/artículo/noticias/publicación.`,
    `Catálogo de familias (por si la fusión hibrida):`,
    cat,
  ].join("\n");
}
