/** FORJA IA — BIBLIOTECA POSITIVA DE PATRONES (v4.5.0, corrección §14).
 *
 * El sistema tiene muchas reglas de «NO hacer esto» (prohibiciones del ADN,
 * anti-genérico, anti-patrones). Eso no basta: la IA necesita ALTERNATIVAS
 * CONCRETAS. Esta biblioteca es el «SÍ usar cuando corresponda»:
 *
 *   floating product · oversized typography · 3d hero object · interactive
 *   grid · technical grid · layered surfaces · asymmetric composition ·
 *   floating metrics · scroll choreography · sticky storytelling ·
 *   horizontal exploration · magnetic CTA · tilt card · spotlight
 *   interaction · depth stacking · product UI collage · perspective
 *   composition · animated workflow · orbital navigation
 *
 * 20 patrones, cada uno con CUÁNDO encaja (señal) y CÓMO aplicarlo. Los
 * que la petición activa viajan al Diseñador/Codificador como menú de
 * decisiones positivas — no como sermón de prohibiciones.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

export interface PatronPositivo {
  nombre: string;
  /** señal de intención que lo activa */
  cuando: RegExp;
  /** cómo se aplica, en una frase ejecutable */
  como: string;
  /** con qué lo combina bien (para sugerir composiciones, no piezas sueltas) */
  combinaCon: string;
}

export const PATRONES_POSITIVOS: ReadonlyArray<PatronPositivo> = [
  { nombre: "floating product", cuando: /\b(producto|saas|app|hardware|fisic|gadget)\b/i, como: "el producto flota sobre el fondo con sombra propia y entra con la primera pantalla", combinaCon: "layered surfaces + floating metrics" },
  { nombre: "oversized typography", cuando: /\b(tipografia|titular|statement|manifiesto|impacto|cinemat)\b/i, como: "el claim principal a tamaño de escena (clamp hasta 9-12vw) con interlineado cerrado", combinaCon: "asymmetric composition" },
  { nombre: "3d hero object", cuando: /\b(3d|objeto 3d|modelo 3d|webgl)\b/i, como: "un objeto 3D central mirable y sutilmente animado como protagonista del hero", combinaCon: "depth stacking + orbital navigation" },
  { nombre: "interactive grid", cuando: /\b(portfolio|galeria|galer[ií]a|proyectos|catalogo|catálogo)\b/i, como: "retícula cuyas piezas reaccionan al hover con transform y revelan detalle", combinaCon: "tilt card + spotlight interaction" },
  { nombre: "technical grid", cuando: /\b(tecnolog|tech|arquitectura|ingenier|datos|dashboard)\b/i, como: "retícula visible de fondo (líneas 1px, opacidad baja) que ordena la escena", combinaCon: "oversized typography" },
  { nombre: "layered surfaces", cuando: /\b(capas|profundidad|superficie|spatial)\b/i, como: "superficies apiladas con elevación distinta por capa y sombras que las separan", combinaCon: "floating metrics + depth stacking" },
  { nombre: "asymmetric composition", cuando: /\b(asimetr|dinamic|dinámico|editorial moderno)\b/i, como: "composición 60/40 o 70/30 con el foco fuera del centro geométrico", combinaCon: "oversized typography" },
  { nombre: "floating metrics", cuando: /\b(metric|m[eé]tricas|datos|kpi|n[uú]meros)\b/i, como: "números clave flotando como cards pequeñas sobre el objeto o la escena", combinaCon: "layered surfaces" },
  { nombre: "scroll choreography", cuando: /\b(scroll|animad|animated|narrativa|historia)\b/i, como: "el scroll orquesta entradas, parallax y cambios de escena con timing por categoría", combinaCon: "sticky storytelling" },
  { nombre: "sticky storytelling", cuando: /\b(narrativa|historia|proceso|pasos|como funciona|cómo funciona)\b/i, como: "una pieza anclada mientras el contenido cambia a su lado", combinaCon: "scroll choreography" },
  { nombre: "horizontal exploration", cuando: /\b(galeria|galer[ií]a|timeline|proceso|pasos|slider)\b/i, como: "una franja que se recorre horizontal (drag o scroll lateral) para contenido secuencial", combinaCon: "interactive grid" },
  { nombre: "magnetic CTA", cuando: /\b(interactiv|cta|boton|botón|conversi[óo]n)\b/i, como: "el botón principal se atrae hacia el puntero (≤12px) y regresa con easing elástico", combinaCon: "spotlight interaction" },
  { nombre: "tilt card", cuando: /\b(tilt|3d|cards|tarjetas|interactiv)\b/i, como: "las piezas clave se inclinan en 3D (máx 8°, perspective 1000px) siguiendo al puntero", combinaCon: "interactive grid" },
  { nombre: "spotlight interaction", cuando: /\b(destacad|spotlight|foco|lujo|premium)\b/i, como: "un foco sutil sigue al puntero dentro de la pieza destacada", combinaCon: "magnetic CTA" },
  { nombre: "depth stacking", cuando: /\b(profundidad|capas|stack|pila|planes)\b/i, como: "piezas apiladas con translateZ distinto que se separan al interactuar", combinaCon: "layered surfaces" },
  { nombre: "product UI collage", cuando: /\b(saas|app|software|plataforma|dashboard)\b/i, como: "varias vistas reales del producto superpuestas como collage con profundidad", combinaCon: "floating product + floating metrics" },
  { nombre: "perspective composition", cuando: /\b(perspectiva|3d|escena|spatial)\b/i, como: "todo el bloque comparte perspective y las piezas viven a distinta translateZ", combinaCon: "3d hero object" },
  { nombre: "animated workflow", cuando: /\b(proceso|flujo|workflow|automatiz|integraci[óo]n)\b/i, como: "el flujo del producto se anima paso a paso (nodos que se activan en secuencia)", combinaCon: "sticky storytelling" },
  { nombre: "orbital navigation", cuando: /\b(navegaci[óo]n|explorar|radial|orbita|orbital)\b/i, como: "la navegación secundaria orbita el objeto o el centro de la escena", combinaCon: "3d hero object" },
  { nombre: "canvas dinámico", cuando: /\b(fondo|canvas|ambient|ambiente|vivo)\b/i, como: "fondo con vida sutil (grano, gradiente que respira o partículas ligeras) SIN robar foco", combinaCon: "oversized typography" },
];

export function patronesPara(mensaje: string, max = 6): PatronPositivo[] {
  const m = (mensaje || "").toLowerCase();
  const hits = PATRONES_POSITIVOS.filter((p) => p.cuando.test(m));
  const resto = PATRONES_POSITIVOS.filter((p) => !p.cuando.test(m));
  return [...hits, ...resto].slice(0, Math.max(3, max));
}

/** El bloque «SÍ usar cuando corresponda» para prompts (doc §14: «la IA
 * necesita alternativas concretas»). */
export function seccionPatronesPositivos(mensaje: string, max = 6): string {
  const elegidos = patronesPara(mensaje, max);
  return [
    `# BIBLIOTECA POSITIVA (SÍ usar cuando corresponda — corrección §14)`,
    `Patrones sugeridos para ESTE proyecto (elige 2-4 y combínalos con intención):`,
    ...elegidos.map((p) => `- ${p.nombre}: ${p.como} → combina con ${p.combinaCon}`),
    `Regla: un patrón sin propósito es decoración. Cada patrón que tomes, nombrado en la explicación.`,
  ].join("\n");
}
