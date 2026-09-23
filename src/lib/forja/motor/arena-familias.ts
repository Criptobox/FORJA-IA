/** FORJA IA — ARENA ENTRE FAMILIAS (v4.6.0, idea F del plan).
 *
 * Hasta v4.5 la elección de familia era una HEURÍSTICA CONGELADA (señales
 * léxicas → familia). Este módulo la convierte en APRENDIZAJE MEDIDO:
 *
 *   las 3 visiones de la Arena corren EN 3 FAMILIAS DISTINTAS
 *   (asignación determinista por intención + rotación),
 *   los jueces puntúan también la COHERENCIA DE FAMILIA (§12: la
 *   maqueta habla el vocabulario de su familia),
 *   y el GANADOR alimenta el Genoma:
 *     «la familia spatial funcionó para el vertical saas: 8.4/10»
 *     «la familia minimal quedó corta para saas: 6.1/10».
 *
 * La coherencia es DETERMINISTA (vocabulario por familia sobre la maqueta
 * textual), así que el juez de coherencia parte de evidencia física y no
 * de opinión — misma disciplina que jueces2.ts.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { FamiliaExperiencia } from "./familias-experiencia";
import { FAMILIAS, seleccionarFamilia } from "./familias-experiencia";
import type { NotaJuez2 } from "./jueces2";
import { ajustesFamiliaAprendidos } from "./aprendizaje-genoma";

/* -------------------------------- tipos ------------------------------------ */

export type LetraVision = "A" | "B" | "C";

export interface AsignacionFamilias {
  /** familia por visión (garantizado: 3 DISTINTAS) */
  porLetra: Record<LetraVision, FamiliaExperiencia>;
  /** por qué cada familia entra en esta Arena */
  motivos: { letra: LetraVision; familia: FamiliaExperiencia; motivo: string }[];
  /** la familia que la heurística habría elegido sola (la defiende A) */
  natural: FamiliaExperiencia;
}

export interface InformeCoherenciaFamilia {
  familia: FamiliaExperiencia;
  /** 0..1 */
  score: number;
  /** señales del vocabulario encontradas */
  encontradas: string[];
  /** señales esperadas y ausentes (evidencia para el juez) */
  faltantes: string[];
  evidencia: string;
}

/* --------------------------- asignación de familias ------------------------- */

const ROTACION_ARENA: Record<string, FamiliaExperiencia[]> = {
  spatial: ["immersive", "3d-showcase", "product"],
  immersive: ["spatial", "cinematic", "3d-showcase"],
  product: ["interactive", "spatial", "cinematic"],
  cinematic: ["immersive", "editorial", "interactive"],
  interactive: ["product", "3d-showcase", "modular"],
  "3d-showcase": ["spatial", "immersive", "interactive"],
  modular: ["product", "editorial", "dashboard"],
  editorial: ["minimal", "modular", "cinematic"],
  minimal: ["editorial", "product", "spatial"],
  dashboard: ["modular", "product", "spatial"],
};

/** Asigna 3 familias DISTINTAS a las 3 visiones. Determinista:
 * 1. la familia natural (la que la intención elegiría) defiende la A;
 * 2. B y C salen de la rotación vecina de la natural, puntuadas por
 *    señales de la petición y por el APRENDIZAJE del Genoma (v4.6 B);
 * 3. desempate estable por orden del catálogo. */
export function asignarFamiliasArena(mensaje: string): AsignacionFamilias {
  const natural = seleccionarFamilia(mensaje).familia;
  const aprendidos = ajustesFamiliaAprendidos(2); // en Arena hay pocas muestras: umbral blando
  const m = (mensaje || "").toLowerCase();

  const candidatas = (ROTACION_ARENA[natural] ?? ["spatial", "product", "editorial"])
    .filter((f) => f !== natural)
    .map((f, i) => {
      const def = FAMILIAS.find((x) => x.id === f);
      let puntos = def?.cuando?.test(m) ? 2 : 0;
      puntos += aprendidos[f] ?? 0;
      return { f, puntos, i };
    })
    .sort((a, b) => b.puntos - a.puntos || a.i - b.i);

  const b = candidatas[0]?.f ?? (natural === "spatial" ? "product" : "spatial");
  const c = candidatas.find((x) => x.f !== b)?.f ?? (b === "immersive" ? "cinematic" : "immersive");

  return {
    porLetra: { A: natural, B: b as FamiliaExperiencia, C: c as FamiliaExperiencia },
    natural,
    motivos: [
      { letra: "A", familia: natural, motivo: `familia natural de la intención (señales de la petición) — defiende la heurística` },
      { letra: "B", familia: b as FamiliaExperiencia, motivo: `vecina puntuada${candidatas[0]?.puntos ? " por señales/aprendizaje" : " por rotación de vocabulario"}` },
      { letra: "C", familia: c as FamiliaExperiencia, motivo: `tercera vía para comparar estructura (diferencia en 3 segundos)` },
    ],
  };
}

/** Bloque para el prompt del maquetador de cada visión: su familia MANDA. */
export function seccionFamiliaAsignada(familia: FamiliaExperiencia): string {
  const def = FAMILIAS.find((f) => f.id === familia);
  return [
    `# FAMILIA ASIGNADA A ESTA MAQUETA (Arena v4.6): «${familia}»`,
    def ? `${def.nombre}: ${def.descripcion}` : "",
    def ? `Para qué: ${def.paraQue} · Riesgo a vigilar: ${def.riesgo}` : "",
    `La maqueta debe hablar el VOCABULARIO de la familia (espacio, movimiento, superficie, interacción). Una maqueta de otra familia se puntúa como INCOHERENTE aunque sea bonita.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* --------------------------- coherencia de familia -------------------------- */

/** Vocabulario §12 por familia: qué palabras PRUEBAN que la maqueta habla
 * su lenguaje (regex sobre la maqueta textual/HTML). */
const VOCABULARIO: Record<FamiliaExperiencia, { senal: string; re: RegExp; peso: number }[]> = {
  spatial: [
    { senal: "capas con z semántico", re: /\b(capas|z-index|profundidad|translatez|perspectiva)\b/i, peso: 1 },
    { senal: "parallax", re: /\bparallax\b/i, peso: 0.7 },
    { senal: "objeto focal", re: /\b(objeto|focal|escena)\b/i, peso: 0.7 },
    { senal: "profundidad declarada", re: /\b(profundidad|depth)\b/i, peso: 0.6 },
  ],
  immersive: [
    { senal: "escenas completas", re: /\b(escena|plano|pantalla completa|full)\b/i, peso: 1 },
    { senal: "scroll coreografiado", re: /\b(scroll|avanza|recorrido)\b/i, peso: 0.9 },
    { senal: "navegación mínima", re: /\b(navegaci[oó]n m[ií]nima|minimal nav)\b/i, peso: 0.5 },
  ],
  product: [
    { senal: "UI del producto viva", re: /\b(ui|interfaz|captura|panel|app)\b/i, peso: 1 },
    { senal: "métricas flotantes", re: /\b(m[eé]tric|dato|kpi|n[uú]mero)\b/i, peso: 0.7 },
    { senal: "CTA claro", re: /\b(cta|bot[oó]n|accio?n|empezar|probar)\b/i, peso: 0.5 },
  ],
  cinematic: [
    { senal: "secuencia de planos", re: /\b(plano|secuencia|apertura|transici[oó]n)\b/i, peso: 1 },
    { senal: "tipografía enorme", re: /\b(tipograf[ií]a (enorme|display|gigante)|t[ií]tulo grande)\b/i, peso: 0.8 },
    { senal: "ritmo del scroll", re: /\b(ritmo|scroll|coreograf)\b/i, peso: 0.7 },
  ],
  interactive: [
    { senal: "interacción concreta", re: /\b(tilt|magnetic|magn[eé]tic|hover|arrastr|clic|interactiv)\b/i, peso: 1 },
    { senal: "feedback inmediato", re: /\b(feedback|respuesta|estado)\b/i, peso: 0.7 },
    { senal: "panel manipulable", re: /\b(panel|manipul|controles?)\b/i, peso: 0.6 },
  ],
  "3d-showcase": [
    { senal: "objeto 3D central", re: /\b(3d|objeto|rotar|girar|modelo)\b/i, peso: 1 },
    { senal: "órbita/cámara", re: /\b([oó]rbita|c[aá]mara|zoom|acercar)\b/i, peso: 0.8 },
    { senal: "perspectiva", re: /\b(perspectiva|profundidad)\b/i, peso: 0.5 },
  ],
  modular: [
    { senal: "módulos de distinto peso", re: /\b(m[oó]dulo|bento|mosaico|asim[eé]tr)\b/i, peso: 1 },
    { senal: "retícula rota", re: /\b(ret[ií]cula|grid|romp)\b/i, peso: 0.7 },
    { senal: "destacado jerárquico", re: /\b(destacad|peso|jerarqu[ií]a)\b/i, peso: 0.5 },
  ],
  editorial: [
    { senal: "jerarquía tipográfica", re: /\b(jerarqu[ií]a|titular|encabezad|tipograf[ií]a)\b/i, peso: 1 },
    { senal: "columna de lectura", re: /\b(columna|lectura|margen|p[aá]rrafo)\b/i, peso: 0.9 },
    { senal: "ritmo de publicación", re: /\b(art[ií]culo|secci[oó]n|publicaci[oó]n|fecha)\b/i, peso: 0.6 },
  ],
  minimal: [
    { senal: "aire generoso", re: /\b(aire|blanco|espacio|silencio|limpio)\b/i, peso: 1 },
    { senal: "una acción", re: /\b(una accio?n|u[nn] solo|claridad)\b/i, peso: 0.8 },
    { senal: "sin decoración", re: /\b(sin decoraci[oó]n|esencial|m[ií]nim)\b/i, peso: 0.6 },
  ],
  dashboard: [
    { senal: "retícula técnica", re: /\b(ret[ií]cula t[eé]cnica|grid|panel)\b/i, peso: 1 },
    { senal: "datos tabulares", re: /\b(tabular|dato|tabla|valor)\b/i, peso: 0.9 },
    { senal: "densidad utilitaria", re: /\b(densidad|utilitario|funcional)\b/i, peso: 0.5 },
  ],
};

/** Mide la COHERENCIA de una maqueta (textual o HTML) con su familia.
 * Determinista, gratis: score = peso de las señales encontradas. */
export function coherenciaFamilia(texto: string, familia: FamiliaExperiencia): InformeCoherenciaFamilia {
  const t = (texto || "").slice(0, 12000);
  const vocab = VOCABULARIO[familia] ?? [];
  const encontradas: string[] = [];
  const faltantes: string[] = [];
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
  const evidencia =
    encontradas.length || faltantes.length
      ? `habla ${familia} con ${encontradas.length} señal(es) (${encontradas.slice(0, 3).join(", ") || "—"})${faltantes.length ? ` · le faltan: ${faltantes.slice(0, 3).join(", ")}` : ""}`
      : `sin señales medibles de la familia ${familia}`;
  return { familia, score, encontradas, faltantes, evidencia };
}

/** Las notas de coherencia de familia como NotaJuez2 (juez «coherencia»,
 * base determinista) — entran al panel como un juez más. */
export function notasCoherenciaFamilia(
  maquetas: { letra: LetraVision; texto: string }[],
  asignacion: AsignacionFamilias
): NotaJuez2[] {
  const out: NotaJuez2[] = [];
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
        conservar: [],
      },
    });
  }
  return out;
}

/* --------------------------- lecciones al Genoma ----------------------------- */

/** Convierte el veredicto de la Arena en lecciones de FAMILIA para el
 * Genoma: «esta familia funcionó para este vertical» (destacar) y «esta
 * quedó corta» (evitar). Solo con evidencia (≥1 maqueta puntuada). */
export function leccionesFamilia(
  asignacion: AsignacionFamilias,
  notasCoherencia: NotaJuez2[],
  mediasPorLetra: Record<LetraVision, number>,
  vertical: string
): { tipo: "destacar" | "conservar" | "evitar"; texto: string; equipo: LetraVision }[] {
  const out: { tipo: "destacar" | "conservar" | "evitar"; texto: string; equipo: LetraVision }[] = [];
  if (!notasCoherencia.length) return out;
  const v = (vertical || "general").slice(0, 60);
  const puntuadas = notasCoherencia.filter((n) => asignacion.porLetra[n.vision]);
  if (!puntuadas.length) return out;
  const mejor = puntuadas.reduce((a, b) => (b.nota > a.nota ? b : a));
  const peor = puntuadas.reduce((a, b) => (b.nota < a.nota ? b : a));
  const famMejor = asignacion.porLetra[mejor.vision];
  const famPeor = asignacion.porLetra[peor.vision];
  const mediaMejor = mediasPorLetra[mejor.vision];
  if (famMejor && famMejor !== famPeor) {
    out.push({
      tipo: "destacar",
      texto: `la familia «${famMejor}» funcionó para «${v}»: coherencia ${mejor.nota}/10 y media del panel ${mediaMejor.toFixed(1)}/10`,
      equipo: mejor.vision,
    });
  }
  if (famPeor && peor.nota <= 4.5 && famPeor !== famMejor) {
    out.push({
      tipo: "evitar",
      texto: `la familia «${famPeor}» quedó corta para «${v}»: coherencia ${peor.nota}/10 (${(peor.evidencia.falla[0] ?? "sin vocabulario de la familia").slice(0, 90)})`,
      equipo: peor.vision,
    });
  }
  return out;
}

/* ------------------------------- salidas ----------------------------------- */

/** Resumen de una línea para la traza. */
export function resumenAsignacionFamilias(a: AsignacionFamilias): string {
  return `arena-familias: A=${a.porLetra.A} · B=${a.porLetra.B} · C=${a.porLetra.C}`;
}
