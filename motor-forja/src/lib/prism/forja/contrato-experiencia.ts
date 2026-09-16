/** FORJA IA — CONTRATO DE EXPERIENCIA EXPORTABLE/EDITABLE (v4.6.0, idea E
 * del plan).
 *
 * El doc moderno-3D (§16) separa Design Direction de Code Generation.
 * v4.5 hizo esa dirección DETERMINISTA; este módulo la hace EDITABLE POR
 * HUMANOS:
 *
 *   SeleccionExperiencia → ContratoExperienciaJson (schema estable)
 *                        → el host (o un futuro Studio) EDITA
 *                          familia / hero / intensidad / profundidad…
 *                        → validarContrato + aplicarEdicionContrato
 *                        → SeleccionExperiencia re-compilada (0 tokens)
 *
 * El re-compilado re-corre el pipeline determinista completo con las
 * decisiones fijadas: tokens CSS, objeto 3D, primitivas, planes y
 * contrato textual se REGENERAN coherentes — sin tocar el pipeline, sin
 * LLM, sin coste. Es el eslabón para un panel «Elige la experiencia».
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { SeleccionExperiencia, OpcionesExperiencia } from "./motor-creativo";
import { seleccionarExperiencia, cssDeterminista, scriptDeterminista } from "./motor-creativo";
import { clonarExperiencia, type ExperienciaDna, type ModoEspacial } from "./experience-dna";
import { FAMILIAS, type FamiliaExperiencia } from "./familias-experiencia";
import { defHero, type TipoHero } from "./hero-engine";

/* -------------------------------- tipos ------------------------------------ */

export const SCHEMA_CONTRATO = "forja.experiencia@1";

/** Campos EDITABLES del contrato. Todo opcional: lo no editado se vuelve a
 * decidir determinísticamente como siempre. */
export interface EdicionContrato {
  /** familia de experiencia (una de las 10) */
  familia?: string;
  /** tipo de hero (HERO_*) */
  hero?: string;
  /** intensidad de movimiento 0-4 (static → immersive) */
  intensidad?: number;
  /** modo espacial flat/2.5d/3d/immersive */
  modoEspacial?: string;
  /** profundidad espacial 0..1 */
  profundidad?: number;
  /** elevación de superficies 0..1 */
  elevacion?: number;
  /** blur de superficies 0..1 (disciplina del doc: el vidrio es acento) */
  blur?: number;
  /** radio base de superficies (px, 4-32) */
  radiusPx?: number;
  /** ¿objeto 3D en el hero? */
  use3d?: boolean;
  /** peso visual del objeto 0..1 */
  pesoObjeto?: number;
}

/** El JSON exportable completo: decisión + edición + material compilado. */
export interface ContratoExperienciaJson {
  schema: typeof SCHEMA_CONTRATO;
  /** versión del motor que lo exportó */
  version: string;
  /** iso8601 de la exportación */
  generado: string;
  /** el mensaje original (para re-sintetizar señales al re-compilar) */
  mensaje: string;
  /** la EDICIÓN humana (vacía = sin editar) */
  edicion: EdicionContrato;
  /** la decisión resultante (snapshot legible, solo lectura) */
  decision: {
    familia: string;
    receta: string;
    hero: string;
    representacion: string;
    intensidad: number;
    modoEspacial: string;
    profundidad: number;
    objeto3d: string | null;
    primitivas: string[];
    cards: string[];
  };
  /** razón de la decisión (señales del ADN) */
  razones: string[];
}

export interface ResultadoValidacion {
  ok: boolean;
  errores: string[];
  avisos: string[];
}

export interface ResultadoEdicion {
  ok: boolean;
  /** la selección re-compilada con la edición aplicada */
  sel: SeleccionExperiencia | null;
  ajustesAplicados: string[];
  errores: string[];
  /** material listo para el host */
  css: string;
  script: string;
  contrato: string;
}

/* ------------------------------- exportación -------------------------------- */

/** Exporta la selección a JSON estable (todo serializable, sin ciclos). */
export function exportarContrato(sel: SeleccionExperiencia, mensaje: string, version = "4.6.0", edicion: EdicionContrato = {}): ContratoExperienciaJson {
  return {
    schema: SCHEMA_CONTRATO,
    version,
    generado: new Date().toISOString(),
    mensaje: (mensaje || "").slice(0, 2000),
    edicion,
    decision: {
      familia: sel.familia.familia,
      receta: sel.receta.receta.id,
      hero: sel.hero.tipo,
      representacion: sel.representacion.modo,
      intensidad: sel.planMovimiento.intensidad,
      modoEspacial: sel.dna.spatial.mode,
      profundidad: Math.round(sel.dna.spatial.depth * 100) / 100,
      objeto3d: sel.objeto ? sel.objeto.id : null,
      primitivas: [...sel.primitivas.primitivas],
      cards: [...sel.cards.variantes],
    },
    razones: sel.razonesDna.slice(0, 6),
  };
}

/** Serializa el contrato (pretty-print, listo para descargar). */
export function serializarContrato(c: ContratoExperienciaJson): string {
  return JSON.stringify(c, null, 2);
}

/* -------------------------------- validación -------------------------------- */

const MODOS_ESPACIALES: ModoEspacial[] = ["flat", "2.5d", "3d", "immersive"];

/** Valida un contrato (o una edición suelta). Nunca lanza. */
export function validarContrato(c: unknown): ResultadoValidacion {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (!c || typeof c !== "object") {
    return { ok: false, errores: ["el contrato debe ser un objeto JSON"], avisos };
  }
  const o = c as Record<string, unknown>;
  if (typeof o.schema === "string" && o.schema !== SCHEMA_CONTRATO) {
    errores.push(`schema desconocido «${o.schema}» (esperado ${SCHEMA_CONTRATO})`);
  }
  const ed = (o.edicion ?? o) as Record<string, unknown>;
  if (ed.familia !== undefined && !FAMILIAS.some((f) => f.id === ed.familia)) {
    errores.push(`familia «${String(ed.familia)}» no existe (válidas: ${FAMILIAS.map((f) => f.id).join(", ")})`);
  }
  if (ed.hero !== undefined && !defHero(String(ed.hero))) {
    errores.push(`hero «${String(ed.hero)}» no existe (debe ser un tipo HERO_*)`);
  }
  if (ed.intensidad !== undefined) {
    const n = Number(ed.intensidad);
    if (!Number.isInteger(n) || n < 0 || n > 4) errores.push(`intensidad debe ser entero 0-4 (llegó ${String(ed.intensidad)})`);
    if (n === 0 && ed.use3d === true) avisos.push("intensidad 0 (static) con objeto 3D: el objeto quedará quieto — quizá quisiste 1 o más");
  }
  if (ed.modoEspacial !== undefined && !MODOS_ESPACIALES.includes(ed.modoEspacial as ModoEspacial)) {
    errores.push(`modoEspacial «${String(ed.modoEspacial)}» no existe (válidos: ${MODOS_ESPACIALES.join(", ")})`);
  }
  for (const campo of ["profundidad", "elevacion", "blur", "pesoObjeto"] as const) {
    if (ed[campo] !== undefined) {
      const n = Number(ed[campo]);
      if (!Number.isFinite(n) || n < 0 || n > 1) errores.push(`${campo} debe ser número 0..1 (llegó ${String(ed[campo])})`);
    }
  }
  if (ed.radiusPx !== undefined) {
    const n = Number(ed.radiusPx);
    if (!Number.isFinite(n) || n < 4 || n > 32) errores.push(`radiusPx debe ser 4..32 (llegó ${String(ed.radiusPx)})`);
  }
  if (ed.use3d !== undefined && typeof ed.use3d !== "boolean") errores.push("use3d debe ser booleano");
  return { ok: errores.length === 0, errores, avisos };
}

/* ------------------------------- aplicación --------------------------------- */

/** Aplica una EDICIÓN al DNA base y re-compila la selección completa.
 * Determinista, 0 tokens. Las decisiones forzadas viajan con confianza 1
 * y su motivo dice «fijado por edición del contrato». */
export function aplicarEdicionContrato(
  json: ContratoExperienciaJson,
  opts: OpcionesExperiencia = {}
): ResultadoEdicion {
  const vacio: ResultadoEdicion = { ok: false, sel: null, ajustesAplicados: [], errores: [], css: "", script: "", contrato: "" };
  const val = validarContrato({ schema: SCHEMA_CONTRATO, edicion: json.edicion ?? {} });
  if (!val.ok) return { ...vacio, errores: val.errores };

  const ed = json.edicion ?? {};
  const ajustes: string[] = [];

  // 1 · DNA base: re-sintetizado del mensaje original (mismas señales) o el
  // que traía la selección… el JSON no guarda el DNA completo: se re-sintetiza.
  const base = seleccionarExperiencia(json.mensaje ?? "");
  const dna: ExperienciaDna = clonarExperiencia(base.dna);

  // 2 · aplicar edición al DNA
  if (ed.intensidad !== undefined) {
    const n = Math.max(0, Math.min(4, Number(ed.intensidad)));
    dna.motion.intensity = n === 0 ? 0 : n === 1 ? 0.2 : n === 2 ? 0.45 : n === 3 ? 0.72 : 0.9;
    ajustes.push(`intensidad de movimiento fijada a ${n}/4`);
  }
  if (ed.modoEspacial !== undefined) {
    dna.spatial.mode = ed.modoEspacial as ModoEspacial;
    ajustes.push(`modo espacial fijado a ${String(ed.modoEspacial)}`);
  }
  if (ed.profundidad !== undefined) {
    dna.spatial.depth = Math.max(0, Math.min(1, Number(ed.profundidad)));
    ajustes.push(`profundidad fijada a ${Math.round(dna.spatial.depth * 100)}%`);
  }
  if (ed.elevacion !== undefined) {
    dna.surface.elevation = Math.max(0, Math.min(1, Number(ed.elevacion)));
    ajustes.push(`elevación de superficies fijada a ${Math.round(dna.surface.elevation * 100)}%`);
  }
  if (ed.blur !== undefined) {
    dna.surface.blur = Math.max(0, Math.min(1, Number(ed.blur)));
    ajustes.push(`blur de superficies fijado a ${Math.round(dna.surface.blur * 100)}%`);
  }
  if (ed.radiusPx !== undefined) {
    dna.surface.radius = `${Math.max(4, Math.min(32, Number(ed.radiusPx)))}px`;
    ajustes.push(`radio base fijado a ${dna.surface.radius}`);
  }
  if (ed.use3d !== undefined) {
    dna.object.use3d = Boolean(ed.use3d);
    if (dna.object.use3d) {
      dna.spatial.mode = dna.spatial.mode === "flat" ? "3d" : dna.spatial.mode;
      dna.spatial.perspective = Math.max(dna.spatial.perspective, 0.7);
    }
    ajustes.push(`objeto 3D ${dna.object.use3d ? "activado" : "desactivado"}`);
  }
  if (ed.pesoObjeto !== undefined) {
    dna.object.visualWeight = Math.max(0, Math.min(1, Number(ed.pesoObjeto)));
    ajustes.push(`peso visual del objeto fijado a ${Math.round(dna.object.visualWeight * 100)}%`);
  }

  // 3 · familia/hero forzados viajan como overrides del pipeline
  const familiaForzada = ed.familia !== undefined ? (ed.familia as FamiliaExperiencia) : undefined;
  if (familiaForzada) ajustes.push(`familia fijada a ${familiaForzada}`);
  if (ed.hero !== undefined) ajustes.push(`hero fijado a ${String(ed.hero)}`);

  const sel = seleccionarExperiencia(json.mensaje ?? "", {
    ...opts,
    dnaForzado: dna,
    familiaForzada,
    heroForzado: ed.hero,
    // v4.7 — el mensaje original viaja: el plano de contenido lo necesita
    // para extraer los hechos del brief (precios, horarios, ciudad…).
    mensajeOriginal: json.mensaje ?? "",
  });

  const contrato = exportarContrato(sel, json.mensaje ?? "", json.version ?? "4.6.0", ed);
  return {
    ok: true,
    sel,
    ajustesAplicados: ajustes,
    errores: [],
    css: cssDeterminista(sel),
    script: scriptDeterminista(sel),
    contrato: serializarContrato(contrato),
  };
}

/* ------------------------------- salidas ----------------------------------- */

/** Bloque para la traza: qué editó el humano y qué se re-compiló. */
export function resumenEdicion(r: ResultadoEdicion): string {
  if (!r.ok) return `contrato RECHAZADO: ${r.errores.join("; ")}`;
  return r.ajustesAplicados.length
    ? `contrato editado y re-compilado (0 tokens): ${r.ajustesAplicados.join(" · ")}`
    : "contrato re-compilado sin ediciones";
}
