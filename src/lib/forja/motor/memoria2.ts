/** FORJA IA — MEMORIA 2.0 de FORJA IA (v4.0.0, fase 12 del plan maestro).
 *
 * El plan separa la memoria en CINCO memorias, cada una con regla propia:
 *
 *   · PROYECTO     — qué funciona PARA ESTE proyecto
 *   · USUARIO      — preferencias explícitas del usuario (v2: MemoriaForja)
 *   · GLOBAL       — conocimiento general destilado (v3: 6 capas)
 *   · EXPERIMENTAL — resultados de pruebas de la Arena/benchmark
 *   · FALLOS       — patrones que produjeron resultados malos
 *                    («esta última es especialmente importante»)
 *
 * No duplica lo existente: el Usuario delega en conocimiento-usuario.ts
 * (MemoriaForja) y la Global en conocimiento-global.ts (ConocimientoGlobal,
 * 6 capas). Este módulo es el CONTENEDOR que las une, añade las dos nuevas
 * (experimental y fallos) y las convierte en contexto de prompt con la
 * política correcta: los fallos van SIEMPRE al prompt (son oro), los
 * experimentos solo si son concluyentes.
 */

import type { LeccionGenoma, MetricasForja } from "./tipos-v4";
import { listaLimpia } from "./tipos-v4";
import { CLAVE_MEMORIA, MEMORIA_DEFECTO, type MemoriaForja } from "./conocimiento-usuario";
import { CLAVE_CONOCIMIENTO_GLOBAL, CONOCIMIENTO_GLOBAL_DEFECTO, type ConocimientoGlobal } from "./conocimiento-global";

/* -------------------------------- tipos ------------------------------------ */

/** Un experimento: hipótesis, cómo se probó, resultado y conclusión. */
export interface ExperimentoForja {
  id: string;
  /** la hipótesis en una frase («un acento único por pantalla mejora la
   * percepción de identidad») */
  hipotesis: string;
  /** cómo se probó (Arena, benchmark A/B, comparación de iteraciones) */
  metodo: string;
  /** qué pasó (con datos si los hay) */
  resultado: string;
  /** concluyente = puede volverse regla; inconcluyente = repetir */
  concluyente: boolean;
  /** métricas del experimento, si hubo */
  metricas?: Partial<MetricasForja>;
  /** iso de cuándo */
  fecha: string;
}

/** Un patrón que produjo un resultado MALO (la memoria de fallos). */
export interface FalloForja {
  id: string;
  /** el patrón concreto que falló */
  patron: string;
  /** por qué fue malo (evidencia) */
  evidencia: string;
  /** qué hacer en su lugar */
  alternativa: string;
  /** cuántas veces confirmado */
  confirmaciones: number;
  /** si llega a 3 confirmaciones se propone como prohibición dura */
  prohibicion: boolean;
  fecha: string;
}

/** El contenedor de las 5 memorias. */
export interface Memoria2 {
  /** delegada: memoria de usuario de v2/v3 (por referencia de datos) */
  usuario: MemoriaForja;
  /** delegada: conocimiento global de v3 (por referencia de datos) */
  global: ConocimientoGlobal;
  /** nueva: qué funciona en ESTE proyecto */
  proyecto: { projectId: string; lecciones: string[] };
  /** nueva: experimentos de Arena/benchmark */
  experimentos: ExperimentoForja[];
  /** nueva: patrones que produjeron resultados malos */
  fallos: FalloForja[];
}

export const MAX_LECCIONES_PROYECTO = 40;
export const MAX_EXPERIMENTOS = 30;
export const MAX_FALLOS = 30;
export const CONFIRMACIONES_PARA_PROHIBIR = 3;

/** Claves de storage para las memorias nuevas (las delegadas conservan su
 * clave original para no romper nada instalado). */
export const CLAVES_MEMORIA2 = {
  proyecto: "forja.memoria-proyecto",
  experimentos: "forja.experimentos",
  fallos: "forja.memoria-fallos",
} as const;

/* ------------------------------ construcción ------------------------------- */

/** Memoria 2.0 vacía, delegando en los valores por defecto de v2/v3. */
export function memoria2Vacia(): Memoria2 {
  return {
    usuario: { ...MEMORIA_DEFECTO, reglas: [] },
    global: { ...CONOCIMIENTO_GLOBAL_DEFECTO, reglas: [], ultimaLectura: {}, generacion: 0 },
    proyecto: { projectId: "", lecciones: [] },
    experimentos: [],
    fallos: [],
  };
}

/** Registro de una lección de proyecto (lo que sí funcionó aquí). */
export function registrarLeccionProyecto(m: Memoria2, projectId: string, leccion: string): Memoria2 {
  const lecciones = listaLimpia([...m.proyecto.lecciones, leccion], MAX_LECCIONES_PROYECTO, 140);
  return { ...m, proyecto: { projectId: projectId || m.proyecto.projectId, lecciones } };
}

/** Registro de un experimento concluyente o no. */
export function registrarExperimento(m: Memoria2, exp: Omit<ExperimentoForja, "id" | "fecha">): Memoria2 {
  const nuevo: ExperimentoForja = {
    ...exp,
    id: `exp-${(m.experimentos.length + 1).toString(36)}-${Date.now().toString(36)}`,
    fecha: new Date().toISOString().slice(0, 10),
  };
  const experimentos = [nuevo, ...m.experimentos].slice(0, MAX_EXPERIMENTOS);
  return { ...m, experimentos };
}

/** Registro de un fallo: dedupe por patrón (suma confirmaciones) y
 * promoción automática a prohibición al llegar al umbral. */
export function registrarFallo(
  m: Memoria2,
  patron: string,
  evidencia: string,
  alternativa: string
): Memoria2 {
  const clave = patron.trim().toLowerCase();
  const existente = m.fallos.find((f) => f.patron.trim().toLowerCase() === clave);
  let fallos: FalloForja[];
  if (existente) {
    fallos = m.fallos.map((f) =>
      f.id === existente.id
        ? { ...f, confirmaciones: f.confirmaciones + 1, evidencia: evidencia || f.evidencia, prohibicion: f.confirmaciones + 1 >= CONFIRMACIONES_PARA_PROHIBIR }
        : f
    );
  } else {
    const nuevo: FalloForja = {
      id: `fallo-${(m.fallos.length + 1).toString(36)}-${Date.now().toString(36)}`,
      patron: patron.trim().slice(0, 160),
      evidencia: evidencia.slice(0, 200),
      alternativa: alternativa.slice(0, 160),
      confirmaciones: 1,
      prohibicion: false,
      fecha: new Date().toISOString().slice(0, 10),
    };
    fallos = [nuevo, ...m.fallos].slice(0, MAX_FALLOS);
  }
  return { ...m, fallos };
}

/** Las lecciones del Genoma alimentan la memoria: destacar → proyecto,
 * evitar → fallos (la conversión que el plan dibuja como ciclo). */
export function absorberLeccionesGenoma(m: Memoria2, lecciones: LeccionGenoma[], projectId: string): Memoria2 {
  let out = m;
  for (const l of lecciones) {
    if (l.tipo === "destacar") {
      out = registrarLeccionProyecto(out, projectId, l.texto);
    } else if (l.tipo === "evitar") {
      out = registrarFallo(out, l.texto, `confirmado en generación ${l.generacion}`, "ver alternativas del informe anti-genérico");
    }
    // "conservar" no entra directo: necesita confirmación (experimento)
  }
  return out;
}

/* ------------------------------- para prompt -------------------------------- */

/** Contexto de memoria para el prompt del Diseñador/Codificador, con la
 * política correcta: fallos SIEMPRE (capa de oro), reglas de usuario,
 * lecciones de proyecto y experimentos concluyentes. */
export function memoriaParaPrompt(m: Memoria2, maxLineas = 12): string[] {
  const out: string[] = [];
  for (const f of m.fallos.filter((x) => x.prohibicion)) {
    out.push(`PROHIBIDO (fallos confirmados ${f.confirmaciones}x): ${f.patron} → ${f.alternativa}`);
  }
  for (const r of m.usuario.reglas.slice(0, 4)) {
    out.push(`Preferencia del usuario: ${r.texto}`);
  }
  for (const l of m.proyecto.lecciones.slice(0, 4)) {
    out.push(`Funciona en este proyecto: ${l}`);
  }
  for (const e of m.experimentos.filter((x) => x.concluyente).slice(0, 2)) {
    out.push(`Experimento concluyente: ${e.hipotesis} → ${e.resultado}`);
  }
  return out.slice(0, maxLineas);
}

/** Estadísticas de las 5 memorias (para el panel de aprendizaje). */
export function estadisticasMemoria2(m: Memoria2): {
  usuario: number;
  global: number;
  proyecto: number;
  experimentos: number;
  fallos: number;
  prohibicionesActivas: number;
} {
  return {
    usuario: m.usuario.reglas.length,
    global: m.global.reglas.length,
    proyecto: m.proyecto.lecciones.length,
    experimentos: m.experimentos.length,
    fallos: m.fallos.length,
    prohibicionesActivas: m.fallos.filter((f) => f.prohibicion).length,
  };
}

/** Re-export de las claves delegadas (documentación viva: el que integre
 * ve de un vistazo dónde vive cada memoria). */
export const CLAVES_DELEGADAS = {
  usuario: CLAVE_MEMORIA,
  global: CLAVE_CONOCIMIENTO_GLOBAL,
} as const;
