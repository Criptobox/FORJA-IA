/** FORJA IA — EXPERIENCE DNA (v4.5.0, correcciones §2 del doc moderno-3D).
 *
 * ─── El problema ───
 * El ADN 2.0 piensa sobre todo en visual: composición, tipografía, color,
 * espaciado, movimiento. Eso basta para evitar lo genérico, pero NO basta
 * para producir experiencias «SaaS moderno» o «portfolio inmersivo»:
 * les falta vocabulario de ESPACIO (profundidad, capas, perspectiva),
 * de SUPERFICIE (radio, elevación, blur), de OBJETO (¿hay un objeto
 * protagonista?) y de INTERACCIÓN (magnetic, tilt, expandible).
 *
 * ─── La solución (el tipo EXACTO del doc) ───
 *
 *   visual · composition · spatial · motion · interaction · surface · object
 *
 * Este ADN de experiencia es DETERMINISTA y gratis: se sintetiza desde la
 * petición con señales léxicas (misma disciplina que representacion.ts) y
 * viaja al prompt como contrato. El LLM ya no inventa la dirección
 * creativa desde cero: la RECIBE (corrección §15/§16).
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* -------------------------------- tipos ------------------------------------ */

export type ModoEspacial = "flat" | "2.5d" | "3d" | "immersive";

/** El EXPERIENCE DNA completo (las 7 dimensiones del doc §2). */
export interface ExperienciaDna {
  visual: {
    palette: string;
    typography: string;
    /** 0..1 */
    contrast: number;
    /** 0..1 */
    density: number;
  };
  composition: {
    structure: string;
    /** 0..1 */
    asymmetry: number;
    focalPoint: string;
    /** 0..1 */
    negativeSpace: number;
  };
  spatial: {
    mode: ModoEspacial;
    /** 0..1 */
    depth: number;
    layers: number;
    /** 0..1 */
    perspective: number;
  };
  motion: {
    /** 0..1 (se traduce a intensidad 0-4 en motor-movimiento) */
    intensity: number;
    scroll: boolean;
    parallax: boolean;
    hover: boolean;
    entrance: boolean;
  };
  interaction: {
    /** 0..1 */
    richness: number;
    magnetic: boolean;
    tilt: boolean;
    expandable: boolean;
  };
  surface: {
    radius: string;
    /** 0..1 */
    elevation: number;
    /** 0..1 */
    blur: number;
    border: string;
  };
  object: {
    heroType: string;
    use3d: boolean;
    /** 0..1 */
    visualWeight: number;
  };
}

/* ------------------------------- señales ----------------------------------- */

/** Señales de intención y lo que suben en el ADN. Determinista y gratis. */
const SENALES: ReadonlyArray<{
  re: RegExp;
  aplica: (e: ExperienciaDna) => void;
  nota: string;
}> = [
  {
    re: /\b(3d|webgl|three\.?js|objeto 3d|modelo 3d)\b/i,
    nota: "petición explícita de 3D",
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
    },
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
    },
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
    },
  },
  {
    re: /\b(portfolio|portafolio|estudio creativo|creative studio|fotograf|galer[ií]a|arquitectura|moda|fashion)\b/i,
    nota: "portfolio/estudio: lienzo oscuro, tipografía enorme, objeto central",
    aplica: (e) => {
      e.spatial.mode = e.spatial.mode === "flat" ? "2.5d" : e.spatial.mode;
      e.spatial.depth = Math.max(e.spatial.depth, 0.75);
      e.visual.contrast = Math.max(e.visual.contrast, 0.85);
      e.visual.density = Math.min(e.visual.density, 0.35);
      e.composition.negativeSpace = Math.max(e.composition.negativeSpace, 0.7);
      e.object.heroType = "objeto-central";
      e.object.visualWeight = Math.max(e.object.visualWeight, 0.85);
      e.motion.parallax = true;
    },
  },
  {
    re: /\b(premium|lujo|exclusiv|elegan|sofisticad)\w*/i,
    nota: "intención premium: aire, contraste y acabado",
    aplica: (e) => {
      e.visual.contrast = Math.max(e.visual.contrast, 0.8);
      e.composition.negativeSpace = Math.max(e.composition.negativeSpace, 0.65);
      e.surface.elevation = Math.max(e.surface.elevation, 0.6);
      e.surface.border = "1px sutil";
    },
  },
  {
    re: /\b(modern|moderno|futurist|futurista|tecnolog|tech|innovad)\w*/i,
    nota: "intención moderna/tecnológica",
    aplica: (e) => {
      e.spatial.mode = e.spatial.mode === "flat" ? "2.5d" : e.spatial.mode;
      e.spatial.depth = Math.max(e.spatial.depth, 0.6);
      e.motion.entrance = true;
      e.motion.hover = true;
      e.interaction.richness = Math.max(e.interaction.richness, 0.6);
    },
  },
  {
    re: /\b(animad|animated|movimiento|motion|parallax|dinamic|dinámico)\w*/i,
    nota: "petición explícita de movimiento",
    aplica: (e) => {
      e.motion.intensity = Math.max(e.motion.intensity, 0.75);
      e.motion.scroll = true;
      e.motion.parallax = true;
      e.motion.entrance = true;
    },
  },
  {
    re: /\b(interactiv|interactiva|interactivo|interacción|interaccion|hover|magnetic|magn[eé]tic|tilt)\w*/i,
    nota: "petición explícita de interacción",
    aplica: (e) => {
      e.interaction.richness = Math.max(e.interaction.richness, 0.8);
      e.interaction.magnetic = true;
      e.interaction.tilt = true;
      e.motion.hover = true;
    },
  },
  {
    re: /\b(cinemat|cinematográf|cinematic|pelicul|film|dramatic|dramático)\w*/i,
    nota: "intención cinematográfica",
    aplica: (e) => {
      e.motion.intensity = Math.max(e.motion.intensity, 0.8);
      e.motion.scroll = true;
      e.composition.negativeSpace = Math.max(e.composition.negativeSpace, 0.6);
      e.object.heroType = e.object.heroType === "objeto-central" ? e.object.heroType : "escena";
      e.object.visualWeight = Math.max(e.object.visualWeight, 0.8);
    },
  },
  {
    re: /\b(dashboard|panel|admin|analitic|m[eé]tric|datos?)\b/i,
    nota: "contenido de datos: densidad y foco utilitario",
    aplica: (e) => {
      e.visual.density = Math.max(e.visual.density, 0.6);
      e.composition.structure = "retícula técnica";
      e.spatial.layers = Math.max(e.spatial.layers, 3);
    },
  },
  {
    re: /\b(blog|revista|magazine|art[ií]culo|noticias?|editorial|publicaci[óo]n)\b/i,
    nota: "intención editorial legítima (doc §23): aquí editorial SÍ manda",
    aplica: (e) => {
      e.spatial.mode = "flat";
      e.spatial.depth = Math.min(e.spatial.depth, 0.2);
      e.visual.density = Math.max(e.visual.density, 0.55);
      e.motion.intensity = Math.min(e.motion.intensity, 0.3);
      e.object.heroType = "tipografico";
    },
  },
  {
    re: /\b(restaurante|bar|cafeter|tienda|ecommerce|e-commerce|tienda online|panader|pizz|helader|pasteler|florister|carnicer|pescader|boutique|bodega|hostal|hotel|gimnas|gym|barber|peluquer|est[eé]tic|tattoo|tatuaj|taller|taller|estudio fotogr[aá]f|autolavado|ferreter|mercado|supermercado|negocio local)\w*/i,
    nota: "vertical comercial local: producto visible, superficies elevadas y carta/catálogo",
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
    },
  },
];

/* ----------------------------- síntesis ------------------------------------ */

/** Experiencia por defecto: PROFESIONAL con aire — plana pero nunca aburrida.
 * Ojo: flat NO significa genérico; significa que nada en la petición pide
 * profundidad y el coste se invierte en jerarquía y acabado. */
export function experienciaPorDefecto(): ExperienciaDna {
  return {
    visual: { palette: "dominante + un acento + neutros con matiz", typography: "display + texto, contraste de peso", contrast: 0.7, density: 0.45 },
    composition: { structure: "retícula con rompimientos intencionales", asymmetry: 0.55, focalPoint: "un focal por pantalla", negativeSpace: 0.6 },
    spatial: { mode: "flat", depth: 0.25, layers: 2, perspective: 0.15 },
    motion: { intensity: 0.3, scroll: false, parallax: false, hover: true, entrance: true },
    interaction: { richness: 0.4, magnetic: false, tilt: false, expandable: false },
    surface: { radius: "16px", elevation: 0.35, blur: 0.1, border: "1px sutil" },
    object: { heroType: "tipografico", use3d: false, visualWeight: 0.4 },
  };
}

/** Clona profundo (los cambios de señal no deben filtrarse entre peticiones). */
export function clonarExperiencia(e: ExperienciaDna): ExperienciaDna {
  return JSON.parse(JSON.stringify(e)) as ExperienciaDna;
}

/** Sintetiza el EXPERIENCE DNA desde la petición. Determinista, gratis,
 * nunca lanza: cada señal identificada APLICA sus decisiones y queda
 * registrada la razón (para la traza y para que el usuario entienda el porqué). */
export function sintetizarExperienciaDna(mensaje: string): { dna: ExperienciaDna; razones: string[] } {
  const dna = experienciaPorDefecto();
  const m = (mensaje || "").toLowerCase();
  const razones: string[] = [];
  for (const s of SENALES) {
    try {
      if (s.re.test(m)) {
        s.aplica(dna);
        razones.push(s.nota);
      }
    } catch {
      /* una señal nunca tumba la síntesis */
    }
  }
  // si algo pidió 3D pero también hubo señal editorial, gana la petición
  // explícita (el doc §23: editorial solo domina con intención editorial real)
  if (dna.object.use3d && /\b(blog|revista|art[ií]culo|noticias?)\b/i.test(m)) {
    dna.object.use3d = false;
    razones.push("conflicto resuelto: contenido editorial manda, el 3D se limita al hero");
  }
  return { dna, razones: razones.slice(0, 6) };
}

/* --------------------------- salidas de texto ------------------------------ */

const pct = (n: number): string => `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;

/** Bloque COMPACTO para prompts (el contrato del doc §15): el LLM recibe
 * la dirección de experiencia, no la inventa. */
export function seccionExperienciaDna(e: ExperienciaDna): string {
  return [
    `# EXPERIENCE DNA (contrato obligatorio de la experiencia)`,
    `visual: ${e.visual.palette}; ${e.visual.typography}; contraste ${pct(e.visual.contrast)}; densidad ${pct(e.visual.density)}`,
    `composition: ${e.visual.palette ? e.composition.structure : ""}; asimetría ${pct(e.composition.asymmetry)}; foco: ${e.composition.focalPoint}; aire ${pct(e.composition.negativeSpace)}`,
    `spatial: modo ${e.spatial.mode}; profundidad ${pct(e.spatial.depth)}; capas ${e.spatial.layers}; perspectiva ${pct(e.spatial.perspective)}`,
    `motion: intensidad ${pct(e.motion.intensity)}; scroll ${siNo(e.motion.scroll)}; parallax ${siNo(e.motion.parallax)}; hover ${siNo(e.motion.hover)}; entrada ${siNo(e.motion.entrance)}`,
    `interaction: riqueza ${pct(e.interaction.richness)}; magnetic ${siNo(e.interaction.magnetic)}; tilt ${siNo(e.interaction.tilt)}; expandible ${siNo(e.interaction.expandable)}`,
    `surface: radius ${e.surface.radius}; elevación ${pct(e.surface.elevation)}; blur ${pct(e.surface.blur)}; borde ${e.surface.border}`,
    `object: hero ${e.object.heroType}; 3D ${siNo(e.object.use3d)}; peso visual ${pct(e.object.visualWeight)}`,
  ].join("\n");
}

/** Resumen de una línea para trazas y registro. */
export function resumenExperienciaDna(e: ExperienciaDna): string {
  return `spatial=${e.spatial.mode} depth=${pct(e.spatial.depth)} capas=${e.spatial.layers} motion=${pct(e.motion.intensity)} interacción=${pct(e.interaction.richness)} hero=${e.object.heroType}${e.object.use3d ? "+3d" : ""}`;
}

function siNo(b: boolean): string {
  return b ? "sí" : "no";
}
