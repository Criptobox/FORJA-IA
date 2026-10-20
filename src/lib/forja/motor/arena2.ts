/** FORJA IA — ARENA FORJA 2.0 (v4.0.0, fase 6 del plan maestro).
 *
 * La Arena deja de ser un modo y pasa a ser un LABORATORIO con tres modos:
 *
 *   ECONÓMICO     — 2 visiones, 2 maquetas, 1 juez
 *   PROFESIONAL   — 3 visiones, 3 maquetas, 3 jueces, director final, fusión
 *   EXPERIMENTAL  — N equipos (perfiles ARENA/LAB + modelos distintos por
 *                   equipo: cada visión puede correr en un modelo distinto)
 *
 * Diferencias con el Estudio de v3 (director.ts):
 *  - las visiones son Vision2 (diferencia estructural, no de paleta);
 *  - los jueces producen EVIDENCIA (funciona/falla/conservar) partiendo de
 *    evidencia física determinista (jueces2.ts), no de opinión;
 *  - el plan de llamadas lo gobierna el perfil de coste (perfiles.ts);
 *  - cada Arena deja LECCIONES al Genoma Visual (genoma-visual.ts): la
 *    evolución del sistema es automática.
 *
 * Como todo el módulo: la llamada real llega inyectada (LlamadaModelo), así
 * que esto corre con BYOK, con agentes CLI o con mocks de prueba.
 */

import type { AdnVisual2 } from "./tipos-v4";
import { idV4 } from "./tipos-v4";
import type { LlamadaModelo } from "./tipos";
import {
  type Vision2,
  type Fusion2,
  type NotaVision2,
  promptDirector2,
  promptDirectorFusion2,
  parseVisiones2,
  parseFusion2,
  explicarVision2,
  visionesDeRespaldo,
  seccionVisionParaMaqueta,
} from "./director2";
import {
  type JuezId2,
  type NotaJuez2,
  evidenciaDeterminista,
  promptJuez2,
  parseNotaJuez2,
  mediasPorVision,
  mejorVision,
  tablaNotas,
} from "./jueces2";
import type { PerfilCosto } from "./perfiles";
import { RECETAS_COSTO } from "./perfiles";
import { detectarGenericidad } from "./antigenerico";
import { chequeosEstaticos } from "./vision";
import { sanearAdn2 } from "./adn2";
import { type AsignacionFamilias, seccionFamiliaAsignada, notasCoherenciaFamilia, leccionesFamilia, resumenAsignacionFamilias } from "./arena-familias";

/* -------------------------------- tipos ------------------------------------ */

export type ModoArena2 = "economico" | "profesional" | "experimental";

/** El plan de una Arena: qué se construye y con qué jueces. */
export interface PlanArena {
  modo: ModoArena2;
  visiones: number;
  maquetas: number;
  jueces: JuezId2[];
  directorFinal: boolean;
  fusion: boolean;
  /** modelos distintos por equipo (experimental) */
  modelosPorEquipo: boolean;
  llamadasEstimadas: number;
}

/** Resultado completo de una Arena 2.0. */
export interface ResultadoArena2 {
  plan: PlanArena;
  visiones: Vision2[];
  /** qué visión quedó mejor por evidencia */
  mejor: "A" | "B" | "C";
  medias: Record<"A" | "B" | "C", number>;
  notas: NotaJuez2[];
  fusion: Fusion2 | null;
  /** textos de maqueta por visión (los que el Codificador convierte en HTML) */
  maquetas: { letra: "A" | "B" | "C"; texto: string }[];
  /** evidencia determinista compartida por los jueces */
  evidenciaBase: string;
  /** lecciones para el Genoma Visual */
  lecciones: { tipo: "destacar" | "conservar" | "evitar"; texto: string; equipo: "A" | "B" | "C" | "fusión" }[];
  /** registro de la traza para observabilidad */
  resumenProceso: string;
}

/** Deps inyectadas de la Arena 2.0. */
export interface DepsArena2 {
  llamarModelo: LlamadaModelo;
  /** modelo para el director (opcional; defecto el mismo) */
  modeloDirector?: { providerId: string; modelId: string };
  /** modelos por equipo para el modo experimental */
  modelosPorEquipo?: Record<"A" | "B" | "C", { providerId: string; modelId: string }>;
  /** temperatura del director (defecto 0.7) */
  temperatura?: number;
  /** progreso para la UI */
  onProgreso?: (evento: string) => void;
  /** v4.6 F — ARENA ENTRE FAMILIAS: si llega, cada visión corre EN una
   * familia distinta y el juez de coherencia puntúa el vocabulario (§12).
   * El ganador deja lección de familia al Genoma. */
  familiasArena?: AsignacionFamilias;
}

/* --------------------------------- plan ------------------------------------ */

/** El plan según modo y perfil de coste. El perfil manda en el número de
 * maquetas y jueces; el modo en cuántas visiones compiten. */
export function planArena(modo: ModoArena2, perfil: PerfilCosto): PlanArena {
  const receta = RECETAS_COSTO[perfil];
  const jueces: JuezId2[] = (() => {
    if (modo === "economico") return ["visual"];
    const core: JuezId2[] = ["visual", "ux", "originalidad"];
    if (receta.jueces >= 5) return [...core, "accesibilidad", "coherencia"];
    return core;
  })();
  const visiones = modo === "economico" ? 2 : receta.visiones;
  const maquetas = modo === "economico" ? 2 : receta.maquetas;
  const fusion = modo !== "economico" && receta.fusion;
  const directorFinal = fusion;
  const llamadas =
    1 /*director*/ + visiones + (maquetas > 0 ? maquetas : 0) + jueces.length * (modo === "economico" ? 1 : visiones) + (fusion ? 2 : 0);
  return {
    modo,
    visiones,
    maquetas,
    jueces,
    directorFinal,
    fusion,
    modelosPorEquipo: modo === "experimental",
    llamadasEstimadas: llamadas,
  };
}

/* ------------------------------ orquestador -------------------------------- */

/** Ejecuta la Arena 2.0 completa. Pasos (todos con progreso):
 *  1. Director Creativo → N visiones (Vision2, diferencia estructural).
 *  2. Por visión: informe anti-genérico de su ficha + maqueta textual.
 *  3. Panel de jueces sobre cada maqueta, partiendo de evidencia física.
 *  4. Director Final → fusión (solo profesional/experimental).
 *  5. Lecciones al Genoma (destacar / conservar / evitar). */
export async function arena2Forja(
  mensaje: string,
  adn2: AdnVisual2,
  modo: ModoArena2,
  perfil: PerfilCosto,
  deps: DepsArena2
): Promise<ResultadoArena2> {
  const adn = sanearAdn2(adn2);
  const plan = planArena(modo, perfil);
  const eventos: string[] = [];
  const progreso = (e: string): void => {
    eventos.push(e);
    deps.onProgreso?.(e);
  };
  const letras = (["A", "B", "C"] as const).slice(0, plan.visiones);
  const llamada = deps.llamarModelo;
  const modelo = deps.modeloDirector ?? { providerId: "prism", modelId: "d1-diseno" };
  const temperatura = deps.temperatura ?? 0.7;

  /* 1 · Director Creativo → visiones */
  progreso(`[director] pidiendo ${plan.visiones} visiones (modo ${modo})`);
  // v4.6 F — familias asignadas a cada visión (diferencia ESTRUCTURAL)
  const familiasForzadas = deps.familiasArena
    ? ([deps.familiasArena.porLetra.A, deps.familiasArena.porLetra.B, deps.familiasArena.porLetra.C].slice(0, plan.visiones) as string[])
    : undefined;
  if (deps.familiasArena) progreso(`[arena-familias] ${resumenAsignacionFamilias(deps.familiasArena)}`);
  let visiones: Vision2[] = [];
  try {
    const salida = await llamada({
      providerId: modelo.providerId,
      modelId: modelo.modelId,
      system: promptDirector2(mensaje, adn, familiasForzadas),
      user: `Genera las ${plan.visiones} visiones ahora.`,
      temperatura,
    });
    visiones = parseVisiones2(salida);
  } catch {
    visiones = [];
  }
  if (visiones.length === 0) {
    progreso("[director] sin respuesta usable: visiones de respaldo estructurales");
    visiones = visionesDeRespaldo(mensaje).slice(0, plan.visiones);
  }

  /* 2 · Por visión: evidencia física de su ficha + maqueta textual */
  const maquetas: ResultadoArena2["maquetas"] = [];
  const fichaDeVision = new Map<"A" | "B" | "C", string>();
  for (const v of visiones) {
    const ficha = seccionVisionParaMaqueta(v, adn);
    fichaDeVision.set(v.letra, ficha);
    const gen = detectarGenericidad(`${v.estructura.join("\n")}\n${v.interaccion}\n${v.composicion}`);
    progreso(`[maqueta ${v.letra}] «${v.nombre}» — identidad física: ${gen.puntuacionIdentidad}/100`);
    if (plan.maquetas > 0) {
      let texto = "";
      const familiaVision = deps.familiasArena?.porLetra[v.letra];
      try {
        texto = await llamada({
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system: [
            `Eres maquetador senior de FORJA IA. Produces la MAQUETA TEXTUAL (estructura HTML descripta sección a sección con clases y jerarquía, sin código final) siguiendo la visión y el ADN al pie de la letra. Prohibido el catálogo genérico.`,
            familiaVision ? seccionFamiliaAsignada(familiaVision) : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          user: ficha,
          temperatura: 0.5,
        });
      } catch {
        texto = "";
      }
      maquetas.push({ letra: v.letra, texto: texto.slice(0, 8000) || v.estructura.join("\n") });
    }
  }

  /* 3 · Panel de jueces con evidencia física */
  const notas: NotaJuez2[] = [];
  for (const mq of maquetas) {
    const ficha = fichaDeVision.get(mq.letra) ?? mq.texto;
    const inspector = chequeosEstaticos(mq.texto);
    const gen = detectarGenericidad(mq.texto);
    const evid = evidenciaDeterminista(inspector, gen, []);
    for (const juez of plan.jueces) {
      const evFisica = juez === "originalidad"
        ? [`Patrones: ${gen.sintomas.map((s) => s.nombre).join(", ") || "ninguno"}`, `Identidad: ${gen.puntuacionIdentidad}/100`].join("\n")
        : evid[juez === "visual" ? "visual" : juez === "ux" ? "ux" : "originalidad"].falla.join("\n");
      let nota: NotaJuez2;
      try {
        const salida = await llamada({
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system: promptJuez2(juez, ficha.slice(0, 2500), evFisica, adn),
          user: `Evalúa la maqueta ${mq.letra}.`,
          temperatura: 0.2,
        });
        nota = parseNotaJuez2(salida, juez, mq.letra);
      } catch {
        nota = {
          juez,
          vision: mq.letra,
          nota: Math.max(0, 10 - (juez === "originalidad" ? gen.sintomas.length : inspector.length)),
          evidencia: juez === "originalidad"
            ? { funciona: [], falla: gen.sintomas.map((s) => s.nombre), conservar: [], patronesGenericos: gen.sintomas.map((s) => s.nombre), diferenciadores: [], riesgos: [] }
            : { funciona: [], falla: inspector.map((h) => h.titulo).slice(0, 5), conservar: [] },
          base: "determinista",
        };
      }
      notas.push(nota);
      progreso(`[juez ${juez}] ${mq.letra}: ${nota.nota}/10 (evidencia ${nota.evidencia.falla.length} fallas)`);
    }
  }

  /* 4 · Medias, mejor visión y fusión */
  // v4.6 F — coherencia de familia como juez DETERMINISTA del panel
  if (deps.familiasArena && maquetas.length) {
    const coherencia = notasCoherenciaFamilia(maquetas, deps.familiasArena);
    for (const n of coherencia) {
      notas.push(n);
      progreso(`[juez coherencia·familia] ${n.vision}: ${n.nota}/10 — ${n.evidencia.falla[0] ?? n.evidencia.funciona[0] ?? "sin señales"}`);
    }
  }
  const medias = mediasPorVision(notas, letras);
  const mejor = mejorVision(notas, letras);
  let fusion: Fusion2 | null = null;
  if (plan.fusion && plan.directorFinal) {
    progreso(`[director-final] base ${mejor}, pidiendo fusión`);
    const notasVision: NotaVision2[] = visiones.map((v) => {
      const deV = notas.filter((n) => n.vision === v.letra);
      return {
        letra: v.letra,
        nota: deV.length ? deV.reduce((s, n) => s + n.nota, 0) / deV.length : 0,
        evidencia: {
          funciona: deV.flatMap((n) => n.evidencia.funciona).slice(0, 4),
          falla: deV.flatMap((n) => n.evidencia.falla).slice(0, 4),
          conservar: deV.flatMap((n) => n.evidencia.conservar).slice(0, 4),
        },
      };
    });
    try {
      const salida = await llamada({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system: promptDirectorFusion2(visiones, notasVision),
        user: `Construye la fusión (base sugerida: ${mejor}).`,
        temperatura: 0.5,
      });
      fusion = parseFusion2(salida, mejor);
    } catch {
      fusion = { base: mejor, tomaDe: [], concepto: visiones.find((v) => v.letra === mejor)?.nombre ?? "fusión" };
    }
  }

  /* 5 · Lecciones al Genoma Visual */
  const lecciones: ResultadoArena2["lecciones"] = [];
  const mejorNombre = visiones.find((v) => v.letra === mejor)?.nombre ?? mejor;
  if (mejorNombre) lecciones.push({ tipo: "destacar", texto: `El arquetipo de «${mejorNombre}» ganó con evidencia: ${medias[mejor].toFixed(1)}/10.`, equipo: mejor });
  for (const v of visiones) {
    if (v.letra === mejor) continue;
    const cons = notas.filter((n) => n.vision === v.letra).flatMap((n) => n.evidencia.conservar);
    if (cons.length) lecciones.push({ tipo: "conservar", texto: `De «${v.nombre}» se conserva: ${cons[0]}`, equipo: v.letra });
    const riesgos = notas.filter((n) => n.vision === v.letra).flatMap((n) => n.evidencia.riesgos ?? []);
    if (riesgos.length) lecciones.push({ tipo: "evitar", texto: `Evitar la deriva vista en «${v.nombre}»: ${riesgos[0]}`, equipo: v.letra });
  }
  // v4.6 F — la familia ganadora deja lección al Genoma («esta familia
  // funcionó para este vertical»): la elección de familia APRENDE.
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
    resumenProceso: eventos.join("\n"),
  };
}

/** Un id de Arena para trazas y registro. */
export function nuevoIdArena(): string {
  return idV4("arena");
}

/** Resumen del resultado para el chat (lo que el usuario lee). */
export function textoArena2(r: ResultadoArena2): string {
  const lineas: string[] = [
    `**ARENA ${r.plan.modo.toUpperCase()}** — ${r.plan.visiones} visiones, ${r.plan.maquetas} maquetas, ${r.plan.jueces.length} juez(es)${r.plan.fusion ? " + fusión" : ""}`,
    "",
  ];
  for (const v of r.visiones) {
    lineas.push(explicarVision2(v));
    lineas.push("");
  }
  lineas.push("**Panel de jueces (con evidencia)**");
  lineas.push(r.evidenciaBase || "(sin notas)");
  if (r.fusion) {
    lineas.push("");
    lineas.push(`**Diseño Fusión** (base ${r.fusion.base}): ${r.fusion.concepto}`);
    for (const t of r.fusion.tomaDe) lineas.push(`- Toma de ${t.de}: ${t.que}`);
  }
  return lineas.join("\n");
}
