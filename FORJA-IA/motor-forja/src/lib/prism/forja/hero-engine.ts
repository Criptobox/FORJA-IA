/** FORJA IA — HERO ENGINE (v4.5.0, correcciones §6).
 *
 * El hero actual deja de ser un único patrón. Tipos explícitos:
 *
 *   HERO_SPATIAL · HERO_3D_OBJECT · HERO_PRODUCT · HERO_CINEMATIC
 *   HERO_INTERACTIVE · HERO_SPLIT · HERO_FLOATING_CARDS · HERO_FULLSCREEN
 *   HERO_SCROLL_REVEAL · HERO_MINIMAL
 *
 * REGLA del doc: NUNCA asumir «hero centrado + h1 gigante + párrafo + botón».
 * El hero se compone: texto + objeto, texto + UI flotante, objeto central +
 * navegación, tipografía gigante + objeto 3D, cards flotantes + producto,
 * canvas + métricas, escena + CTA.
 *
 * Además decide con ANTI-REPETICIÓN: si el historial reciente ya usó el tipo
 * elegido, rota a una alternativa con la misma capacidad (doc §13).
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";
import type { FamiliaExperiencia } from "./familias-experiencia";

/* -------------------------------- tipos ------------------------------------ */

export type TipoHero =
  | "HERO_SPATIAL"
  | "HERO_3D_OBJECT"
  | "HERO_PRODUCT"
  | "HERO_CINEMATIC"
  | "HERO_INTERACTIVE"
  | "HERO_SPLIT"
  | "HERO_FLOATING_CARDS"
  | "HERO_FULLSCREEN"
  | "HERO_SCROLL_REVEAL"
  | "HERO_MINIMAL";

export interface HeroElegido {
  tipo: TipoHero;
  /** con qué se construye (las composiciones del doc, en español) */
  composicion: string[];
  /** por qué este tipo para ESTA experiencia */
  motivo: string;
  /** los que quedaron como plan B (la Arena puede explorarlos) */
  alternativas: TipoHero[];
}

interface DefHero {
  tipo: TipoHero;
  /** familias donde encaja de forma natural */
  familias: FamiliaExperiencia[];
  /** composiciones canónicas */
  composiciones: string[][];
  /** señales de petición que lo refuerzan */
  cuando?: RegExp;
  motivo: string;
}

const DEFS: ReadonlyArray<DefHero> = [
  {
    tipo: "HERO_3D_OBJECT",
    familias: ["3d-showcase", "spatial", "immersive"],
    composiciones: [
      ["tipografía gigante", "objeto 3D central", "navegación mínima"],
      ["objeto central", "navegación", "métricas flotantes"],
    ],
    cuando: /\b(3d|objeto 3d|modelo 3d|webgl|rotar|girar)\b/i,
    motivo: "hay un objeto 3D protagonista: se mira antes de leerse",
  },
  {
    tipo: "HERO_PRODUCT",
    familias: ["product", "interactive", "modular"],
    composiciones: [
      ["texto", "UI flotante del producto", "métrica clave"],
      ["captura viva del producto", "texto asimétrico", "CTA"],
    ],
    cuando: /\b(saas|app|software|plataforma|demo|producto)\b/i,
    motivo: "el producto se muestra vivo (UI real), no se describe",
  },
  {
    tipo: "HERO_SPATIAL",
    familias: ["spatial", "immersive", "product"],
    composiciones: [
      ["texto", "objeto", "capas de profundidad"],
      ["escena por capas", "tipografía sobre la capa media", "CTA flotante"],
    ],
    motivo: "la profundidad es el mensaje: cada capa explica una parte",
  },
  {
    tipo: "HERO_CINEMATIC",
    familias: ["cinematic", "immersive"],
    composiciones: [
      ["plano de apertura a pantalla completa", "texto mínimo", "CTA al final del plano"],
      ["escena", "título enorme", "indicación de scroll"],
    ],
    motivo: "el scroll es un cambio de plano: apertura con ritmo",
  },
  {
    tipo: "HERO_INTERACTIVE",
    familias: ["interactive", "product"],
    composiciones: [
      ["canvas interactivo", "métricas en vivo", "CTA"],
      ["texto", "panel manipulable", "feedback inmediato"],
    ],
    cuando: /\b(interactiv|demo|juguete|juego|prueba)\b/i,
    motivo: "la interacción ES el argumento: tocar enseña más que leer",
  },
  {
    tipo: "HERO_SPLIT",
    familias: ["product", "modular", "minimal"],
    composiciones: [
      ["texto a un lado", "objeto/UI al otro", "asimetría 60/40"],
      ["claim enorme", "producto flotando", "prueba social mínima"],
    ],
    motivo: "dos ideas conviven: la promesa y la prueba visible",
  },
  {
    tipo: "HERO_FLOATING_CARDS",
    familias: ["product", "spatial", "interactive"],
    composiciones: [
      ["cards flotantes", "producto", "fondo con profundidad"],
      ["métricas flotantes", "objeto central", "texto corto"],
    ],
    motivo: "los datos flotan sobre el objeto: jerarquía espacial literal",
  },
  {
    tipo: "HERO_FULLSCREEN",
    familias: ["cinematic", "immersive", "minimal"],
    composiciones: [
      ["una sola pantalla", "un mensaje", "una acción"],
      ["tipografía enorme", "objeto de fondo", "navegación mínima"],
    ],
    motivo: "una idea a pantalla completa: fuerza de foco máxima",
  },
  {
    tipo: "HERO_SCROLL_REVEAL",
    familias: ["cinematic", "editorial", "immersive"],
    composiciones: [
      ["título que se revela al hacer scroll", "objeto que entra", "CTA"],
      ["texto por capas", "profundidad que emerge"],
    ],
    motivo: "el contenido aparece con el scroll: revelación como argumento",
  },
  {
    tipo: "HERO_MINIMAL",
    familias: ["minimal", "editorial", "modular"],
    composiciones: [
      ["tipografía protagonista", "aire generoso", "una acción"],
      ["claim corto", "enlace fuerte", "nada más"],
    ],
    motivo: "menos es la decisión: precisión y silencio",
  },
];

export function defHero(tipo: string): DefHero | undefined {
  return DEFS.find((d) => d.tipo === tipo);
}

/* ------------------------------- elección ---------------------------------- */

/** Elige el tipo de hero. Orden de decisión:
 * 1. coincidencia de familia (+ señales de petición);
 * 2. intensidad de objeto 3D del ADN;
 * 3. penalización por repetición en el historial (doc §13);
 * 4. v4.6 B — ajustes APRENDIDOS del Genoma (+2 destacado, -2 evitado);
 * 5. desempate estable por orden del catálogo. */
export function elegirHero(
  e: ExperienciaDna,
  familia: FamiliaExperiencia,
  mensaje: string = "",
  historialHeroes: string[] = [],
  /** v4.6 B — bonus/penalización aprendida por tipo (learning loop) */
  ajustesAprendidos: Record<string, number> = {}
): HeroElegido {
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
    // anti-repetición: usado en los 3 últimos proyectos → penaliza fuerte
    const recientes = historialHeroes.slice(-3);
    const usos = recientes.filter((h) => h === d.tipo).length;
    puntos -= usos * 2.5;
    // v4.6 B — learning loop: lo que ganó suma, lo que falló resta
    puntos += ajustesAprendidos[d.tipo] ?? 0;
    return { d, puntos, i };
  });
  puntuados.sort((a, b) => b.puntos - a.puntos || a.i - b.i);
  const ganador = puntuados[0].d;
  const alternativas = puntuados.slice(1, 3).map((p) => p.d.tipo);
  // composición: la primera que el historial no haya quemado, si no la 1ª
  const usadas = new Set(historialHeroes.slice(-2));
  const comp = ganador.composiciones.find((c, i) => (i === 0 ? true : !usadas.has(`${ganador.tipo}#${i}`))) ?? ganador.composiciones[0];
  return {
    tipo: ganador.tipo,
    composicion: comp,
    motivo: ganador.motivo,
    alternativas,
  };
}

/** Bloque para prompts (maqueta y Codificador): el hero DECIDIDO y la regla
 * dura contra el hero por defecto. */
export function seccionHero(h: HeroElegido): string {
  return [
    `# HERO (tipo decidido — corrección §6)`,
    `Tipo: ${h.tipo}`,
    `Se construye con: ${h.composicion.join(" + ")}`,
    `Por qué: ${h.motivo}`,
    h.alternativas.length ? `Alternativas explorables: ${h.alternativas.join(", ")}` : "",
    `PROHIBIDO por defecto: hero centrado + h1 gigante + párrafo + botón. Si tu hero se parece a eso, no es este hero.`,
  ]
    .filter(Boolean)
    .join("\n");
}
