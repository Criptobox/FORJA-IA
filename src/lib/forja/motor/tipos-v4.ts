/** FORJA IA — Tipos compartidos de la v4.0.0 «El Cerebro Creativo».
 *
 * La v4 implementa el Plan Maestro de integración OpenDesign + Stitch:
 * FORJA IA es el CEREBRO (decide), OpenDesign sería el CUERPO (ejecuta,
 * vía adaptador) y Stitch es solo REFERENCIA de experiencia (canvas, voz,
 * steering). Este archivo define los contratos transversales que usan
 * varios módulos v4; cada módulo define sus tipos propios junto a su
 * lógica, igual que en v3.
 *
 * Reglas del plan que este archivo protege:
 *  - el ADN 2.0 EXTENDE el ADN v1 (nunca lo rompe: cualquier AdnVisual de
 *    v3 se convierte en AdnVisual2 con una línea);
 *  - los jueces producen EVIDENCIA (funciona / falla / conservar), no solo
 *    puntuaciones;
 *  - todo queda registrado (observabilidad) y medido (métricas).
 */

import type { AdnVisual } from "./adn-visual";
import type { HallazgoVision } from "./vision";
import type { LeccionArena } from "./conocimiento-global";

/* ----------------------------- ADN Visual 2.0 ---------------------------- */

/** Las 14 dimensiones del ADN 2.0 (fase 3 del plan). Las 4 primeras son el
 * ADN v1 intacto; las 10 nuevas dan identidad real: composición, tipografía,
 * color, espaciado, movimiento, representación, interacción, referencias,
 * anti-patrones y accesibilidad. */
export interface AdnVisual2 extends AdnVisual {
  /** v4: la identidad en una frase («una editorial técnica silenciosa…») */
  identidad: string;
  /** v4: composición (retícula, asimetría, focal, densidad) */
  composicion: string[];
  /** v4: pareja tipográfica y reglas de escala/ritmo */
  tipografia: string[];
  /** v4: paleta con intención (no «azul 500»: por qué cada color existe) */
  color: string[];
  /** v4: sistema de espaciado (escala, ritmo, aire) */
  espaciado: string[];
  /** v4: movimiento con propósito (qué anima, cuándo, cuánto) */
  movimiento: string[];
  /** v4: cómo se representa la información (de representacion.ts) */
  representacion: string[];
  /** v4: interacción (hover, foco, estados, feedback) */
  interaccion: string[];
  /** v4: referencias abstractas (inspiración, nunca copia) */
  referencias: string[];
  /** v4: anti-patrones del sector/proyecto (de Arena y contraejemplos) */
  antiPatrones: string[];
  /** v4: reglas de accesibilidad mínimas del proyecto */
  accesibilidad: string[];
}

/** Topes de las listas del ADN 2.0: un ADN verborreico deja de ser un ADN. */
export const MAX_LISTA_ADN2 = 8;

/** Las 14 dimensiones con su etiqueta humana (para UI y DESIGN.md). */
export const DIMENSIONES_ADN2: ReadonlyArray<{
  clave: keyof AdnVisual2;
  etiqueta: string;
  core: boolean;
}> = [
  { clave: "identidad", etiqueta: "Identidad", core: true },
  { clave: "personalidad", etiqueta: "Personalidad", core: true },
  { clave: "sensacion", etiqueta: "Sensación", core: true },
  { clave: "composicion", etiqueta: "Composición", core: false },
  { clave: "tipografia", etiqueta: "Tipografía", core: false },
  { clave: "color", etiqueta: "Color", core: false },
  { clave: "espaciado", etiqueta: "Espaciado", core: false },
  { clave: "movimiento", etiqueta: "Movimiento", core: false },
  { clave: "representacion", etiqueta: "Representación", core: false },
  { clave: "interaccion", etiqueta: "Interacción", core: false },
  { clave: "prohibiciones", etiqueta: "Prohibiciones", core: true },
  { clave: "referencias", etiqueta: "Referencias", core: false },
  { clave: "antiPatrones", etiqueta: "Anti-patrones", core: false },
  { clave: "accesibilidad", etiqueta: "Accesibilidad", core: false },
];

/* -------------------------- Comandos semánticos --------------------------- */

/** Un ajuste semántico que sale de la voz o del canvas («más elegante, no
 * aburrida» → elegancia ↑, decoración ↓, personalidad →). Es la capa que
 * traduce lenguaje natural a DECISIONES, nunca a tokens sueltos. */
export interface ComandoSemantico {
  /** dimensión del ADN 2.0 o eje de sensación al que afecta */
  dimension: string;
  direccion: "subir" | "bajar" | "fijar" | "mantener";
  /** valor concreto si dirección = "fijar" (0..10) */
  valor?: number;
  /** 1..3: cuánta intención lleva el comando (3 = «mucho más») */
  intensidad: 1 | 2 | 3;
  /** la frase del usuario que lo motivó, para trazabilidad */
  motivo: string;
}

/* ------------------------------ Jueces 2.0 -------------------------------- */

/** Evidencia de un juez. El plan es taxativo: «los jueces no deben
 * reducirse a una puntuación total». Cada juez responde a TRES preguntas
 * con hechos concretos, y el juez de originalidad añade sus tres. */
export interface EvidenciaJuez {
  /** qué funciona (hechos, no gustos) */
  funciona: string[];
  /** qué falla (con dónde y por qué) */
  falla: string[];
  /** qué conservar aunque se descarte la propuesta */
  conservar: string[];
  /** solo juez de originalidad: patrones de plantilla detectados */
  patronesGenericos?: string[];
  /** solo juez de originalidad: qué diferencia esta propuesta */
  diferenciadores?: string[];
  /** solo juez de originalidad: riesgos de deriva a plantilla */
  riesgos?: string[];
}

/* --------------------------- Revisor visual 2.0 --------------------------- */

/** Veredicto global del revisor visual automático (fase 10 del plan). */
export type VeredictoVisual = "PASS" | "WARN" | "FAIL";

/** Hallazgo enriquecido: problema + evidencia + gravedad + causa probable +
 * corrección propuesta. Extiende HallazgoVision de v3 (título/detalle) con
 * las dos columnas que faltaban para que sea ACCIONABLE. */
export interface HallazgoVisual2 extends HallazgoVision {
  /** causa probable, en una línea («el hero no declara altura y el texto
   * flota»: ayuda al Codificador a corregir de raíz) */
  causaProbable: string;
  /** corrección concreta propuesta */
  correccion: string;
}

/* --------------------------- Genoma Visual -------------------------------- */

/** Qué lección extrae el Genoma de una Arena. */
export type TipoLeccionGenoma = "destacar" | "conservar" | "evitar";

/** A qué se convierte una lección al consolidarse (plan, sección 20). */
export type ConversionLeccion =
  | "patron"
  | "anti-patron"
  | "experimento"
  | "regla"
  | "referencia";

/** Una lección evolutiva: la Arena produce lecciones, el Genoma las
 * convierte en conocimiento que cambia la próxima generación. */
export interface LeccionGenoma {
  id: string;
  tipo: TipoLeccionGenoma;
  /** la lección en una frase accionable */
  texto: string;
  /** a qué se convirtió (o null si aún es lección cruda) */
  conversion: ConversionLeccion | null;
  /** qué dirección/equipo la produjo («A», «B», «fusión») */
  origen: string;
  /** generación en la que nació (las Arenas numeran sus ciclos) */
  generacion: number;
  /** cuántas generaciones lleva confirmándose */
  confirmaciones: number;
}

/* --------------------------- Observabilidad -------------------------------- */

/** Registro de UNA generación completa (sección 28 del plan): el «expediente
 * clínico» que permite saber qué modelo, skill o dirección funciona mejor,
 * cuánta genericidad se produce y cuánto cuesta cada flujo. */
export interface RegistroGeneracion {
  projectId: string;
  requestId: string;
  /** iso8601 del inicio */
  inicio: string;
  /** iso8601 del fin ("" mientras corre) */
  fin: string;
  /** modelos usados por rol/agente («disenador:free:gemini-2.0-flash») */
  modelos: string[];
  /** agentes que intervinieron (roles FORJA, jueces, director, runtime) */
  agentes: string[];
  designSystem: string;
  adn: string;
  /** direcciones exploradas (nombres) y la elegida */
  direccion: string;
  direccionesExploradas: string[];
  skills: string[];
  artifact: string;
  critic: string;
  antiGeneric: string;
  /** iteraciones del bucle de mejora (0 = aprobó a la primera) */
  iteraciones: number;
  finalScore: number;
  /** lecciones que esta generación deja al Genoma */
  lecciones: string[];
  /** nº de llamadas de modelo consumidas (el coste real del flujo) */
  llamadas: number;
  /** v4.2 — telemetría del adaptador-resiliente durante esta generación.
   * Undefined en registros antiguos (deserializados de v4.1): las consultas
   * la tratan como ceros. La llena crearTelemetriaForja() de observabilidad. */
  telemetria?: TelemetriaAdaptador;
  /** v4.4 — informe de eficiencia (presupuesto, caché, ROI, salida temprana).
   * Optional para no romper registros antiguos. Todo serializable. */
  eficiencia?: EficienciaRegistro;
  /** v4.5 — la decisión de experiencia de esta generación (familia, receta,
   * hero, representación, métricas y parches). Optional, serializable. */
  experiencia?: ExperienciaRegistro;
}

/** v4.5 — Resumen de la DECISIÓN DE EXPERIENCIA (doc moderno-3D §1/§26).
 * Strings y números: el host lo persiste junto al registro. */
export interface ExperienciaRegistro {
  /** familia de experiencia elegida (spatial/product/cinematic/…) */
  familia: string;
  /** receta ejecutada (SPATIAL_PRODUCT, INTERACTIVE_SAAS, …) */
  receta: string;
  /** tipo de hero (HERO_*) */
  hero: string;
  /** representación tras la puerta de rendimiento (2d/2.5d/3d/webgl) */
  representacion: string;
  /** resumen del ADN de experiencia (modo, capas, movimiento, interacción) */
  dna: string;
  /** métricas medidas del resultado (editorial/spatial/motion/…) */
  metricas: string;
  /** hallazgos del QA de experiencia y parches aplicados */
  qa: string;
  /** nº de parches de experiencia aplicados sin LLM */
  parches: number;
  /** v4.6 C — objeto 3D forjado elegido (MONOLITO, ORBE…) o "ninguno" */
  objeto?: string;
  /** v4.6 A — primitivas compiladas elegidas (lista separada por comas) */
  primitivas?: string;
  /** v4.6 D — Motion QA medido: score y hallazgos del movimiento real */
  motionQa?: string;
  /** v4.6 F — familia ganadora de la Arena entre familias (si corrió) */
  arenaFamilia?: string;
  /** v4.6 B — recomendaciones del learning loop aplicadas a esta decisión */
  aprendizaje?: string;
  /** v4.7 — plano de contenido aplicado (vertical, nivel, nº de secciones) */
  plano?: string;
  /** v4.7 — QA de detalle: puntuación 0-100, veredicto y métricas clave */
  detalleQa?: string;
}

/** v4.4 — Resumen de eficiencia de la generación (plan §22-26, §28).
 * Solo strings y números: el host lo persiste tal cual con el registro. */
export interface EficienciaRegistro {
  /** complejidad estimada de la petición (simple/media/compleja) */
  complejidad: string;
  /** «presupuesto 12.400/34.000 tok (36%) · ok 7 · denegadas 0» */
  presupuesto: string;
  /** gasto por fase del plan */
  fases: { fase: string; cupo: number; gastado: number }[];
  /** «multinivel: 4 acierto(s) (L1×2, L6×2)» */
  cache: string;
  /** «ROI: 9 op · 18.432 tok · 7 llamadas · +3 puntos → 0.2 puntos/1k tok» */
  roi: string;
  /** «salida temprana: 2 iteración(es) ahorrada(s) · 1 corrección sin LLM» */
  temprana: string;
  /** «contexto 84→31 líneas (12 dup) · 7.900→3.120 car · 60% menos» */
  contexto: string;
  /** tokens de salida que la capa de eficiencia ahorró en esta generación */
  ahorroTokensEstimado: number;
}

/** v4.2 — Telemetría del ADAPTADOR-RESILIENTE dentro del registro. La
 * llena el puente crearTelemetriaForja() de observabilidad.ts a partir de
 * los eventos onEvento del adaptador. Contadores simples, serializables:
 * cuántas veces la tubería se defendió sola mientras el usuario esperaba. */
export interface TelemetriaAdaptador {
  /** reintentos con backoff por errores de red */
  reintentosRed: number;
  /** saltos de proveedor caído al siguiente de la cadena */
  failovers: number;
  /** piezas de continuación pedidas por finish_reason = length */
  continuaciones: number;
  /** llamadas que terminaron AUN truncadas (detectadas, no rotas) */
  truncados: number;
  /** llamadas que terminaron bien (eventos exito) */
  llamadasOk: number;
  /** suma de tokens de salida reportados por los proveedores */
  tokensSalida: number;
  /** suma de latencias de las llamadas ok (para medias) */
  latenciaMsTotal: number;
}

/** Telemetría en ceros: la forma canónica de un registro sin eventos. */
export function telemetriaVacia(): TelemetriaAdaptador {
  return {
    reintentosRed: 0,
    failovers: 0,
    continuaciones: 0,
    truncados: 0,
    llamadasOk: 0,
    tokensSalida: 0,
    latenciaMsTotal: 0,
  };
}

/* ------------------------------ Métricas ---------------------------------- */

/** Las 8 métricas del plan (sección 30). Nunca solo «bonito». */
export interface MetricasForja {
  /** ¿tiene decisiones propias? 0..10 */
  identidad: number;
  /** 10 = cero patrones genéricos */
  genericidad: number;
  /** ¿respeta el ADN? 0..10 */
  coherencia: number;
  /** ¿la información se entiende? 0..10 */
  ux: number;
  /** ¿cumple los criterios definidos? 0..10 */
  accesibilidad: number;
  /** ¿funciona en distintos tamaños? 0..10 */
  responsive: number;
  /** ¿el código es limpio y funcional? 0..10 */
  codigo: number;
  /** ¿las correcciones realmente mejoran? 0..10 */
  iteracion: number;
}

/* ------------------------------- Utilidades ------------------------------- */

/** Genera ids cortos estables sin dependencias (para registros, lecciones,
 * experimentos): epoch36 + contador. NO es un uuid y no lo necesita ser. */
let _secuencia = 0;
export function idV4(prefijo: string): string {
  _secuencia += 1;
  return `${prefijo}-${Date.now().toString(36)}${_secuencia.toString(36)}`;
}

/** Recorta una lista de strings con dedupe y limpieza (misma disciplina
 * que sanearAdn de v3, compartida por todos los módulos v4). */
export function listaLimpia(xs: string[], max: number, maxTexto = 90): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const t = (x ?? "")
      .replace(/\s+/g, " ")
      .replace(/^[-*•\d.)\s]+/, "")
      .trim()
      .slice(0, maxTexto);
    if (t.length < 3) continue;
    const clave = t.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Convierte lecciones crudas de Arena (v3) en el formato del Genoma. */
export function leccionArenaAGenoma(
  leccion: LeccionArena,
  generacion: number
): LeccionGenoma {
  return {
    id: idV4("lec"),
    tipo: leccion.tipo,
    texto: (leccion.texto ?? "").slice(0, 200),
    conversion: null,
    origen: leccion.equipo ?? "",
    generacion,
    confirmaciones: 1,
  };
}
