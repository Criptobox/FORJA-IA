/** FORJA IA — OBSERVABILIDAD de FORJA IA (v4.0.0, sección 28 del plan).
 *
 * «Cada generación debe producir un registro» con:
 *   project_id, request_id, model, agent, design_system, adn, direction,
 *   skills, artifact, critic, anti_generic, iterations, final_score, lessons
 *
 * Esto permite saber: qué modelo funciona mejor, qué skill funciona mejor,
 * qué diseño produce menos genericidad, qué iteraciones mejoran y cuánto
 * cuesta cada flujo.
 *
 * El registro es un objeto plano serializable (el host lo persiste donde
 * quiera: localStorage, SQLite de OpenDesign, archivo). Aquí solo vive la
 * lógica: crear, actualizar, cerrar, serializar y CONSULTAR (los 5 análisis
 * del plan sobre una lista de registros).
 */

import type { RegistroGeneracion } from "./tipos-v4";
import { idV4, telemetriaVacia } from "./tipos-v4";
import type { EventoAdaptador } from "./adaptador-resiliente";

/* ------------------------------ crear/cerrar -------------------------------- */

/** Crea el registro al INICIO de una generación. */
export function crearRegistro(projectId: string): RegistroGeneracion {
  return {
    projectId: projectId || "prisma",
    requestId: idV4("req"),
    inicio: new Date().toISOString(),
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
    telemetria: telemetriaVacia(),
  };
}

/** Cierra el registro con el score final y las lecciones. */
export function cerrarRegistro(r: RegistroGeneracion, finalScore: number, lecciones: string[]): RegistroGeneracion {
  return {
    ...r,
    fin: new Date().toISOString(),
    finalScore,
    lecciones: lecciones.slice(0, 12),
  };
}

/** Serializa (JSON una-línea, listo para storage). */
export function serializarRegistro(r: RegistroGeneracion): string {
  return JSON.stringify(r);
}

/** Deserializa tolerante. */
export function deserializarRegistro(s: string): RegistroGeneracion | null {
  try {
    const obj = JSON.parse(s) as Partial<RegistroGeneracion>;
    if (!obj.requestId || !obj.inicio) return null;
    return { ...crearRegistro(obj.projectId ?? "prisma"), ...obj, requestId: obj.requestId };
  } catch {
    return null;
  }
}

/* ------------------------------ telemetría --------------------------------- */

/** v4.2 — Registra UN evento del adaptador-resiliente en el registro de la
 * generación. MUTA el registro a propósito: los eventos llegan en vivo
 * durante la generación y crear un objeto nuevo por evento sería ruido.
 * Nunca lanza: un evento raro (futuro) no puede romper un pipeline en
 * marcha — el peor caso es un contador que no sube. */
export function registrarEventoAdaptador(
  r: RegistroGeneracion,
  e: EventoAdaptador
): RegistroGeneracion {
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
        // no lleva contador propio: el error final ya sube por la ruta
        // normal de excepciones; aquí solo dejaría rastro si se pidiera.
        break;
    }
  } catch {
    // telemetría a prueba de todo: jamás rompe la generación
  }
  return r;
}

/** v4.2 — EL PUENTE que la sección «Cablear el adaptador» pedía: convierte
 * los eventos `onEvento` del adaptador-resiliente en telemetría del
 * registro de observabilidad.
 *
 * ```ts
 * const registro = crearRegistro(projectId);
 * const llamarModelo = crearAdaptadorForja(transporte, {
 *   onEvento: crearTelemetriaForja(registro), // ← una línea y queda cableado
 * });
 * // … al cerrar la generación:
 * cerrarRegistro(registro, score, lecciones);
 * persistir(serializarRegistro(registro));
 * ```
 *
 * Para compose con un logger del host:
 * `onEvento: (e) => { crearTelemetriaForja(registro)(e); log(e); }` — o
 * mejor, usa `crearTelemetriaForja(registro, { tambien: log })`. */
export function crearTelemetriaForja(
  registro: RegistroGeneracion,
  opciones: { tambien?: (e: EventoAdaptador) => void } = {}
): (e: EventoAdaptador) => void {
  return (e: EventoAdaptador) => {
    registrarEventoAdaptador(registro, e);
    try {
      opciones.tambien?.(e);
    } catch {
      // el logger del host tampoco puede romper el pipeline
    }
  };
}

/** v4.2 — Agregado de telemetría sobre una lista de registros cerrados:
 * cuántas veces se defendió la tubería en total. Para el panel y para
 * textoConsultas(). */
export interface SaludRedAgregada {
  reintentosRed: number;
  failovers: number;
  continuaciones: number;
  truncados: number;
  llamadasOk: number;
  tokensSalida: number;
  /** latencia media de las llamadas ok (0 sin datos) */
  latenciaMsMedia: number;
}

export function agregarTelemetria(rs: RegistroGeneracion[]): SaludRedAgregada {
  const out: SaludRedAgregada = {
    reintentosRed: 0,
    failovers: 0,
    continuaciones: 0,
    truncados: 0,
    llamadasOk: 0,
    tokensSalida: 0,
    latenciaMsMedia: 0,
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

/* ------------------------------ consultas ---------------------------------- */

/** Los 5 análisis del plan, sobre una lista de registros cerrados. */
export interface ConsultasRegistro {
  /** mejor modelo por score medio (mínimo 1 generación) */
  mejorModelo: { modelo: string; scoreMedio: number; usos: number } | null;
  /** skill con mejor score medio */
  mejorSkill: { skill: string; scoreMedio: number; usos: number } | null;
  /** media de genericidad (puntuación compuesta) por dirección */
  menosGenerica: { direccion: string; identidadMedia: number; usos: number } | null;
  /** cuántas iteraciones mejoraron realmente (mejoró=true / total) */
  efectividadIteraciones: { mejoraron: number; total: number; porcentaje: number };
  /** coste medio por flujo (llamadas) */
  costeMedio: { llamadas: number; duracionMsMedio: number; generaciones: number };
  /** v4.2 — telemetría del adaptador agregada sobre los registros cerrados */
  saludRed: SaludRedAgregada;
}

/** La información de score/genericidad viaja dentro de antiGeneric y
 * finalScore del registro; direcciones y skills en sus listas. */
export function consultarRegistros(rs: RegistroGeneracion[]): ConsultasRegistro {
  const cerrados = rs.filter((r) => r.fin !== "");

  const porModelo = new Map<string, { suma: number; n: number }>();
  const porSkill = new Map<string, { suma: number; n: number }>();
  const porDireccion = new Map<string, { suma: number; n: number }>();
  let _totalIter = 0;
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
      // la identidad viaja codificada en antiGeneric («identidad N/100»)
      const m = r.antiGeneric.match(/identidad\s+(\d{1,3})\/100/i);
      e.suma += m ? Number(m[1]) : r.finalScore;
      e.n += 1;
      porDireccion.set(d, e);
    }
    _totalIter += r.iteraciones;
    llamadasTotales += r.llamadas;
  }

  /** El mejor de un mapa por media, o null si está vacío. */
  const mejorDe = (mapa: Map<string, { suma: number; n: number }>): { clave: string; media: number; n: number } | null => {
    let mejor: { clave: string; media: number; n: number } | null = null;
    for (const [clave, e] of mapa) {
      const media = e.suma / e.n;
      if (!mejor || media > mejor.media) mejor = { clave, media, n: e.n };
    }
    return mejor;
  };

  const mModelo = mejorDe(porModelo);
  const mSkill = mejorDe(porSkill);
  const mDireccion = mejorDe(porDireccion);

  const duraciones = cerrados
    .filter((r) => r.inicio && r.fin)
    .map((r) => Math.max(0, new Date(r.fin).getTime() - new Date(r.inicio).getTime()));

  const mejoraron = cerrados.reduce((s, r) => s + (r.iteraciones > 0 ? 1 : 0), 0);

  return {
    mejorModelo: mModelo ? { modelo: mModelo.clave, scoreMedio: Math.round(mModelo.media * 10) / 10, usos: mModelo.n } : null,
    mejorSkill: mSkill ? { skill: mSkill.clave, scoreMedio: Math.round(mSkill.media * 10) / 10, usos: mSkill.n } : null,
    menosGenerica: mDireccion ? { direccion: mDireccion.clave, identidadMedia: Math.round(mDireccion.media), usos: mDireccion.n } : null,
    efectividadIteraciones: {
      mejoraron,
      total: cerrados.length,
      porcentaje: cerrados.length ? Math.round((mejoraron / cerrados.length) * 100) : 0,
    },
    costeMedio: {
      llamadas: cerrados.length ? Math.round((llamadasTotales / cerrados.length) * 10) / 10 : 0,
      duracionMsMedio: duraciones.length ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : 0,
      generaciones: cerrados.length,
    },
    saludRed: agregarTelemetria(cerrados),
  };
}

/** Texto de las consultas para el panel. */
export function textoConsultas(c: ConsultasRegistro): string {
  return [
    c.mejorModelo ? `Mejor modelo: ${c.mejorModelo.modelo} (${c.mejorModelo.scoreMedio}/100, ${c.mejorModelo.usos} usos)` : "Sin datos de modelos aún",
    c.menosGenerica ? `Dirección menos genérica: ${c.menosGenerica.direccion} (identidad media ${c.menosGenerica.identidadMedia})` : "Sin datos de direcciones aún",
    `Iteraciones que mejoraron: ${c.efectividadIteraciones.porcentaje}% (${c.efectividadIteraciones.mejoraron}/${c.efectividadIteraciones.total})`,
    `Coste medio por flujo: ${c.costeMedio.llamadas} llamadas · ${c.costeMedio.duracionMsMedio}ms`,
    // v4.2: el blindaje en números — lo que la tubería evitó sin que nadie
    // se enterara (o lo que conviene mirar si los números suben solos).
    `Blindaje de red: ${c.saludRed.reintentosRed} reintento(s) · ${c.saludRed.failovers} failover(s) · ${c.saludRed.continuaciones} continuación(es) · ${c.saludRed.truncados} truncado(s) detectado(s)`,
    c.saludRed.llamadasOk
      ? `Salud: ${c.saludRed.llamadasOk} llamada(s) ok · latencia media ${c.saludRed.latenciaMsMedia}ms · ${c.saludRed.tokensSalida} tokens de salida`
      : "Salud: sin llamadas registradas aún",
  ].join("\n");
}
