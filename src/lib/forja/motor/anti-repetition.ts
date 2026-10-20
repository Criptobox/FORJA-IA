/** FORJA IA — ANTI-REPETITION ENGINE (v4.5.0, corrección §13).
 *
 * El sistema NO debe generar «hero espacial + 3 cards flotantes + parallax»
 * en todas las páginas. Guarda las composiciones RECIENTES (hero, cards,
 * motion, spatial, navegación, secciones) y penaliza repeticiones a la hora
 * de elegir la siguiente.
 *
 * Ejemplo del doc:
 *
 *   últimos proyectos:
 *   1. HERO_3D_OBJECT
 *   2. HERO_FLOATING_CARDS
 *   3. HERO_SPATIAL
 *   4. HERO_3D_OBJECT
 *   → el siguiente debería explorar otras posibilidades si la intención
 *     lo permite.
 *
 * Estado COMPARTIDO a nivel de proceso (misma disciplina que la caché
 * multinivel v4.4): rentan entre generaciones del mismo proceso. Inyectable
 * para el host y reiniciable para pruebas.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* -------------------------------- tipos ------------------------------------ */

export interface HuellaComposicion {
  /** tipo de hero elegido (HERO_*) */
  hero: string;
  /** variantes de card usadas */
  cards: string[];
  /** primitivas de movimiento activas */
  motion: string[];
  /** modo espacial (flat/2.5d/3d/immersive) */
  spatial: string;
  /** navegación: minimal/estándar */
  navegacion: string;
  /** estructura de secciones (nombres breves) */
  secciones: string[];
  cuando: number;
}

export interface Penalizacion {
  /** penalización total 0..~3 (se resta en las elecciones) */
  puntos: number;
  /** qué se repitió y cuántas veces */
  repeticiones: { patron: string; veces: number }[];
  /** consejo concreto */
  consejo: string;
}

/* ------------------------------ historial ---------------------------------- */

const TOPE_HISTORIAL = 12;

/** Estado global del proceso (igual que la caché compartida v4.4). */
let historial: HuellaComposicion[] = [];

/** Registra la composición de una generación terminada (FIFO con tope). */
export function registrarComposicion(h: HuellaComposicion): void {
  try {
    historial = [...historial.filter((x) => x.cuando !== h.cuando), h].slice(-TOPE_HISTORIAL);
  } catch {
    /* nunca lanza */
  }
}

/** Historial actual (copia: nadie muta el estado de otro). */
export function obtenerHistorial(): HuellaComposicion[] {
  return [...historial];
}

/** Reinicia el historial (pruebas / nuevo proyecto). */
export function reiniciarAntiRepeticion(): void {
  historial = [];
}

/** Inyecta un historial (el host persiste el suyo y lo restaura al arrancar). */
export function cargarHistorial(xs: HuellaComposicion[]): void {
  historial = (Array.isArray(xs) ? xs : []).slice(-TOPE_HISTORIAL);
}

/* ------------------------------ penalización -------------------------------- */

/** Cuenta cuántas veces aparece `valor` en los últimos `ventana` registros. */
function usosRecientes(valor: string, extraer: (h: HuellaComposicion) => string[], ventana = 3): number {
  const recientes = historial.slice(-ventana);
  return recientes.filter((h) => extraer(h).includes(valor)).length;
}

/** Penalización para un tipo de hero (§13: si aparece en los últimos 3,
 * se frena; 2 de 3 o más, se frena fuerte). */
export function penalizacionHero(tipo: string, ventana = 3): number {
  const usos = usosRecientes(tipo, (h) => [h.hero], ventana);
  return usos === 0 ? 0 : usos === 1 ? 1 : 2.5;
}

/** Penalización para una familia/composición completa: hero + modo espacial
 * + primera card. Devuelve también el CONSEJO para el prompt. */
export function penalizacionComposicion(hero: string, spatial: string, cardPrincipal: string): Penalizacion {
  const repeticiones: Penalizacion["repeticiones"] = [];
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

  const consejo = repeticiones.length
    ? `evita repetir ${repeticiones.map((r) => `${r.patron} (×${r.veces})`).join(", ")}: explora ${heroSugeridoAlternativo(hero)} en esta generación`
    : "composición fresca: sin repeticiones recientes";
  return { puntos, repeticiones, consejo };
}

function heroSugeridoAlternativo(heroActual: string): string {
  const ROTACION: Record<string, string[]> = {
    HERO_3D_OBJECT: ["HERO_SPLIT", "HERO_CINEMATIC"],
    HERO_FLOATING_CARDS: ["HERO_3D_OBJECT", "HERO_SPLIT"],
    HERO_SPATIAL: ["HERO_PRODUCT", "HERO_FULLSCREEN"],
    HERO_PRODUCT: ["HERO_SPATIAL", "HERO_INTERACTIVE"],
    HERO_CINEMATIC: ["HERO_SCROLL_REVEAL", "HERO_3D_OBJECT"],
    HERO_INTERACTIVE: ["HERO_PRODUCT", "HERO_FLOATING_CARDS"],
    HERO_SPLIT: ["HERO_SPATIAL", "HERO_CINEMATIC"],
    HERO_FULLSCREEN: ["HERO_SPLIT", "HERO_SCROLL_REVEAL"],
    HERO_SCROLL_REVEAL: ["HERO_CINEMATIC", "HERO_MINIMAL"],
    HERO_MINIMAL: ["HERO_SPLIT", "HERO_PRODUCT"],
  };
  return (ROTACION[heroActual] ?? ["HERO_SPLIT"])[0];
}

/* ------------------------------- salidas ----------------------------------- */

/** Bloque para el prompt del Director/Codificador: la advertencia concreta. */
export function seccionAntiRepeticion(p: Penalizacion): string {
  if (!p.repeticiones.length) return "";
  return [
    `# ANTI-REPETICIÓN (corrección §13)`,
    `Composiciones recientes que NO repetir salvo causa explícita:`,
    ...p.repeticiones.map((r) => `- ${r.patron} — usado ${r.veces} de las últimas 3 generaciones`),
    p.consejo,
  ].join("\n");
}

/** Resumen de una línea para la traza. */
export function resumenAntiRepeticion(p: Penalizacion): string {
  return p.repeticiones.length ? `anti-repetición: -${p.puntos} pts (${p.consejo})` : "anti-repetición: composición fresca";
}
