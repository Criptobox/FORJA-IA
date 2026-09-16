/** FORJA IA — Tipos del núcleo FORJA IA, la IA virtual de diseño web.
 *
 * FORJA IA no es un modelo: es una IA compuesta. En la lista de modelos se
 * comporta como uno más (el usuario lo selecciona y chatea normal), pero cada
 * petición la resuelve un equipo de tres especialistas que trabajan en
 * pipeline: Diseñador → Codificador → Revisor.
 *
 * v2 — «El Diseñador Profesional»: antes de escribir código, la IA propone
 * ideas (3 direcciones de diseño) y construye una MAQUETA navegable para
 * aprobación del usuario. Solo tras el visto bueno se tira código real.
 * Además el sistema puede auto-alimentarse de fuentes de internet
 * (ver fuentes.ts y autoaprendizaje.ts) y ofrece perfiles de recursos
 * para controlar cuántas llamadas de modelo gasta cada petición.
 *
 * Este archivo define el contrato completo entre las piezas. Nada aquí
 * depende de un proveedor concreto: los modelos llegan configurados por rol
 * (ver equipo.ts) y la llamada real se inyecta en el núcleo (ver nucleo.ts),
 * de modo que el módulo se puede probar sin red y portar a otra base sin
 * tocar la lógica.
 */

import type { HallazgoVision } from "./vision";
import type { AdnVisual } from "./adn-visual";
import type { InformeAntiGenerico } from "./antigenerico";

/** Los tres puestos del equipo. El orden importa: es el del pipeline. */
export type RolForja = "disenador" | "codificador" | "revisor";

export const ROLES_FORJA: RolForja[] = ["disenador", "codificador", "revisor"];

/** Qué produce cada rol, para trazar y para decidir el bucle. */
export type ArtefactoForja =
  | "ficha-diseno"
  | "direcciones"
  | "maqueta"
  | "codigo"
  | "veredicto"
  | "respuesta-final";

/** Una ronda del pipeline, para pintar la traza en la UI en vivo. */
export interface RondaForja {
  /** 1-based: ronda 1 = primera pasada de ese rol */
  n: number;
  rol: RolForja;
  artefacto: ArtefactoForja;
  /** el texto bruto que devolvió el modelo de este rol */
  salida: string;
  /** modelo (providerId:modelId) que resolvió esta ronda */
  modeloUsado: string;
  /** milisegundos que tardó la llamada */
  duracionMs: number;
}

/** La ficha de diseño es el contrato entre el Diseñador y el Codificador.
 * Viaja en texto (los modelos gratis entienden texto, no JSON complejo), así
 * que se definen secciones fijas y el Diseñador las rellena con encabezados
 * markdown: el Codificador la lee tal cual, sin parsear nada. */
export interface FichaDiseno {
  tipoWeb: string;
  publico: string;
  mensajePrincipal: string;
  paleta: string;
  tipografia: string;
  estructura: string[];
  interaccion: string[];
  restricciones: string[];
}

/** Una idea de diseño de las tres que el Diseñador propone antes de maquetar.
 * Es la respuesta a «dame ideas de diseño para esta web»: nombre memorable,
 * concepto en una frase y por qué sirve para ESTE proyecto. */
export interface DireccionDiseno {
  n: 1 | 2 | 3;
  /** nombre corto y memorable: «Editorial oscura», «Bento luminoso»… */
  nombre: string;
  /** el concepto en una frase */
  concepto: string;
  /** por qué funciona para este proyecto y público concretos */
  porQue: string;
  /** paleta con hex, separada por comas */
  paleta: string;
  /** pareja tipográfica */
  tipografia: string;
}

/** Estado de la propuesta visual. Solo «aprobada» desbloquea el código. */
export type EstadoMaqueta = "propuesta" | "ajustada" | "aprobada" | "descartada";

/** La propuesta que el usuario ve antes de aprobar el código: las 3 ideas,
 * la maqueta HTML navegable de la dirección recomendada y las notas. */
export interface PropuestaMaqueta {
  direcciones: DireccionDiseno[];
  /** HTML autocontenido de la maqueta (una sola página, sin lógica) para la
   * vista previa en vivo de FORJA IA. Vacío si la maqueta falló al generarse
   * (en ese caso el usuario igual puede elegir dirección y seguir). */
  html: string;
  /** dirección maquetada (1..3, por defecto la recomendada = 1) */
  eleccion: number;
  estado: EstadoMaqueta;
  /** qué hay que decidir/revisar: textos provisionales, pendientes… */
  notas: string;
  /** cuántos ajustes lleva ya (tope: MAX_AJUSTES_MAQUETA en nucleo.ts) */
  ajustes: number;
  /** informe del motor anti-genérico sobre esta maqueta (v3.0): síntomas de
   * plantilla detectados y nivel de saturación. Lo pinta la UI y lo usa el
   * Estudio como evidencia del Juez de Originalidad. */
  genericidad?: InformeAntiGenerico;
}

/** Veredicto del Revisor. `aprobado: false` obliga a otra ronda de código. */
export interface VeredictoForja {
  aprobado: boolean;
  /** defectos concretos y accionables; vacío si aprueba sin observaciones */
  defectos: string[];
  /** una línea de por qué, para la traza de la UI */
  resumen: string;
}

/** Configuración de modelo para un rol. El par coincide con el makeModelKey
 * del proyecto (providerId:modelId), pero se guarda separado para poder
 * validar cada parte y para que cada rol caiga a failover distinto. */
export interface ModeloDeRol {
  providerId: string;
  modelId: string;
}

/** Cuánto gasta FORJA IA en cada petición. Es el dial entre calidad y
 * recursos: menos llamadas = más rápido y más barato (los modelos son
 * gratis, pero la cuota no es infinita). */
export type PerfilRecursos = "ligero" | "equilibrado" | "profundo";

/** La receta concreta de cada perfil. El núcleo la lee; los Ajustes la pintan. */
export interface RecetaPerfil {
  /** rondas máximas de corrección Código → Revisión */
  maxRondas: number;
  /** cuántas reglas del conocimiento global viajan al Diseñador */
  reglasGlobales: number;
  /** ¿maqueta antes de codificar en proyectos nuevos? */
  maquetaNuevos: boolean;
  /** una línea para la UI de ajustes */
  descripcion: string;
}

export const PERFILES: Record<PerfilRecursos, RecetaPerfil> = {
  ligero: {
    maxRondas: 2,
    reglasGlobales: 4,
    maquetaNuevos: false,
    descripcion: "Rápido y barato: ficha → código → revisión. Sin maquetas.",
  },
  equilibrado: {
    maxRondas: 3,
    reglasGlobales: 6,
    maquetaNuevos: true,
    descripcion:
      "Recomendado: ideas + maqueta en proyectos nuevos, código tras tu visto bueno.",
  },
  profundo: {
    maxRondas: 4,
    reglasGlobales: 10,
    maquetaNuevos: true,
    descripcion:
      "Máxima calidad: más reglas aprendidas, más rondas de corrección, maqueta siempre.",
  },
};

export const PERFIL_DEFECTO: PerfilRecursos = "equilibrado";

/** Configuración completa de la IA. Persistida en el store del proyecto. */
export interface ConfigForja {
  /** modelo por rol; si falta alguno, el núcleo usa el modelo activo del chat */
  porRol: Record<RolForja, ModeloDeRol | null>;
  /** rondas máximas de corrección Codificador → Revisor (1..5, defecto por perfil) */
  maxRondas?: number;
  /** habilidades activadas del catálogo (ids de habilidades.ts) */
  habilidades: string[];
  /** temperatura por rol: 0 para el Revisor (determinista), 0.6 Diseñador */
  temperaturaPorRol?: Partial<Record<RolForja, number>>;
  /** v4.2 — presupuesto de salida POR ROL (max_tokens que la llamada pide al
   *  proveedor). El núcleo lo calcula con techoTokens() y viaja en cada
   *  LlamadaModelo; el adaptador-resiliente lo aplica al transporte. Sin
   *  valor para un rol manda MAX_TOKENS_DEFECTO (16.384 en el Codificador).
   *  Útil cuando el proveedor del usuario impone techos menores (algunos
   *  routers gratuitos cortan en 8k aunque pidas más). */
  maxTokensPorRol?: Partial<Record<RolForja, number>>;
  /** perfil de recursos (defecto «equilibrado»). maxRondas explícito manda. */
  perfil?: PerfilRecursos;
  /** interruptor global de la fase de maqueta (defecto true). */
  maquetaPrimero?: boolean;
}

/** Firma de la función que realmente habla con un modelo. El núcleo no sabe
 * de proveedores: quien integre pasa aquí su chat-client (o un mock).
 *
 * v4.1: los argumentos incluyen `rol` — así el adaptador-resiliente sabe
 * qué techo de salida pedir (16k+ en el Codificador) y qué cadena de
 * suplentes usar si el proveedor cae. Opcional para no romper a nadie:
 * sin rol, el adaptador aplica los valores por defecto.
 *
 * v4.2: los argumentos incluyen `maxTokens` — el techo de salida CONCRETO
 * de esta llamada, resuelto por el núcleo con techoTokens() desde
 * ConfigForja.maxTokensPorRol. Si no llega, el adaptador usa su defecto
 * por rol. Gana el que más cerca de la llamada esté. */
export type LlamadaModelo = (args: {
  providerId: string;
  modelId: string;
  system: string;
  user: string;
  temperatura: number;
  /** callback de streaming opcional; si llega, se emiten fragmentos */
  onFragmento?: (texto: string) => void;
  /** el puesto del equipo que pide esta llamada (disenador/codificador/
   *  revisor). Lo rellena el núcleo en crearLlamadora(). */
  rol?: RolForja;
  /** v4.2: techo de salida de ESTA llamada (resuelto desde la config).
   *  Opcional: sin él, el adaptador aplica MAX_TOKENS_DEFECTO[rol]. */
  maxTokens?: number;
}) => Promise<string>;

/** Cómo quiere trabajar el usuario en ESTA petición. Vacío = auto (el núcleo
 * decide según perfil y tipo de petición). */
export type ModoPeticionForja = "auto" | "directo" | "maqueta";

/** Petición que entra al núcleo cuando el usuario selecciona FORJA IA. */
export interface PeticionForja {
  /** el mensaje del usuario, tal cual */
  mensaje: string;
  /** código actual del proyecto, si es una edición sobre lo existente */
  codigoActual?: string;
  /** reglas aprendidas (memoria de fallos + conocimiento del usuario) */
  reglasAprendidas?: string[];
  /** reglas destiladas de internet (conocimiento-global.ts), ya cargadas
   * por el llamador; el núcleo no toca storage ni red */
  conocimientoGlobal?: string[];
  /** fuerza el modo de esta petición: «directo» salta la maqueta, «maqueta»
   * la fuerza aunque sea una edición */
  modo?: ModoPeticionForja;
}

/** Estado final de la ejecución: o hay código completo, o hay maqueta que
 * esperar a aprobación (el usuario decide: aprobar / ajustar / otra idea). */
export type EstadoResultadoForja = "completo" | "esperando-aprobacion";

/** Resultado final que devuelve el núcleo y la UI muestra como respuesta. */
export interface ResultadoForja {
  estado: EstadoResultadoForja;
  /** el código final aprobado (o el mejor alcanzado si se agotaron rondas).
   * Vacío mientras el estado sea «esperando-aprobacion». */
  codigo: string;
  /** explicación final para el usuario: decisiones, uso, pendientes */
  respuesta: string;
  ficha: FichaDiseno | null;
  /** la ficha EN TEXTO: se necesita tal cual para continuar tras aprobar */
  fichaTexto: string;
  /** la propuesta visual si hubo fase de maqueta */
  maqueta: PropuestaMaqueta | null;
  rondas: RondaForja[];
  veredicto: VeredictoForja | null;
  /** true si se agotaron las rondas sin aprobación del Revisor */
  agotado: boolean;
  /** hallazgos del Inspector visual sobre el código final (v2.3). Vacío si
   * el chequeo no encontró nada; undefined si no hubo fase de código. */
  vision?: HallazgoVision[];
  /** ADN visual del proyecto (v2.4): identidad que generó el Diseñador (o la
   * de respaldo anti-genérico) y que auditan Revisor y Juez. */
  adn?: AdnVisual;
  /** informe anti-genérico del código final (v3.0): síntomas de plantilla y
   * puntuación de identidad. Undefined si no hubo fase de código. */
  genericidad?: InformeAntiGenerico;
}

/* ------------------------------------------------------------------ *
 * Presupuesto de tokens por rol (v4.2)                                *
 * ------------------------------------------------------------------ */

/** Techo de salida por defecto. EL NÚMERO CLAVE: el Codificador pide
 * 16k porque una página completa (HTML+CSS+JS) no cabe en 4k — y el
 * corte por max_tokens pasa igual en planes pagados que gratis.
 * (Vive en tipos.ts desde v4.2 para que núcleo y adaptador lo compartan
 * sin ciclos de importación; adaptador-resiliente.ts lo re-exporta.) */
export const MAX_TOKENS_DEFECTO: Record<RolForja, number> = {
  disenador: 8192,
  codificador: 16_384,
  revisor: 8192,
};

/** Guardas del presupuesto: por debajo de 256 ni el Revisor cabe; por
 * encima de 64k los proveedores gratuitos empiezan a rechazar la llamada. */
export const MIN_TOKENS_ROL = 256;
export const MAX_TOKENS_LIMITE = 65_536;

/** Sanea un valor de ConfigForja.maxTokensPorRol[rol]. Devuelve undefined
 * si no hay valor utilizable (la llamada entonces usa el defecto). */
export function sanearTokensRol(n: number | undefined): number | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  const v = Math.round(n);
  if (v < MIN_TOKENS_ROL) return undefined;
  return Math.min(MAX_TOKENS_LIMITE, v);
}

/** El techo de salida efectivo para un rol: la config del usuario manda
 * (saneada), luego el defecto por rol. Nunca lanza, nunca devuelve 0. */
export function techoTokens(cfg: ConfigForja, rol: RolForja): number {
  return sanearTokensRol(cfg.maxTokensPorRol?.[rol]) ?? MAX_TOKENS_DEFECTO[rol];
}

/** Guardas de configuración (mismos criterios que el resto de Prism). */
export const MAX_RONDAS_LIMITE = 5;
export const MAX_RONDAS_DEFECTO = 3;
/** Tope de ajustes de maqueta por propuesta: sin tope, el usuario (y la
 * cuota del modelo gratis) puede girar en bucle. */
export const MAX_AJUSTES_MAQUETA = 2;

export function sanearRondas(n: number | undefined): number {
  const v = Math.round(Number(n) || 0);
  if (v < 1) return MAX_RONDAS_DEFECTO;
  return Math.min(MAX_RONDAS_LIMITE, v);
}

/** El perfil manda en maxRondas SALVO que el usuario fijó uno explícito.
 * Convención: undefined = usar perfil; número = decisión del usuario. */
export function rondasDePerfil(cfg: ConfigForja): number {
  if (cfg.maxRondas != null) return sanearRondas(cfg.maxRondas);
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;
  return PERFILES[perfil].maxRondas;
}

/* ------------------------------------------------------------------ *
 * Detección de intención sobre la maqueta (determinista, sin modelo) *
 * ------------------------------------------------------------------ */

/** Palabras con las que el usuario pide saltarse la propuesta visual. */
const DIRECTO_RX =
  /\b(sin maqueta|sin mockup|sin propuesta|directo al codigo|directo al código|código directo|codigo directo|directamente el codigo|directamente el código|ya sabes lo que quiero|sin vista previa|fast)\b/i;

/** Palabras con las que el usuario PIDE ideas o maqueta explícitamente. */
const MAQUETA_RX =
  /\b(maqueta|mockup|propuesta(s)? de diseño|dise[nñ]o(s)? primero|que? ideas|dame ideas|mu[eé]strame (una|la)? ?propuesta|concepto(s)? de dise[nñ]o)\b/i;

export function usuarioQuiereDirecto(mensaje: string): boolean {
  return DIRECTO_RX.test(mensaje);
}

export function usuarioPideMaqueta(mensaje: string): boolean {
  return MAQUETA_RX.test(mensaje);
}

/** ¿Toca fase de maqueta en esta petición? Reglas, en orden:
 * 1. el modo explícito de la petición manda;
 * 2. interruptor global de config;
 * 3. el perfil «ligero» nunca maqueta;
 * 4. si el usuario pidió directo, no; si pidió maqueta, sí;
 * 5. en EDICIONES no se maqueta (salvo rediseño o pedido explícito):
 *    el usuario ya tiene un diseño que conoce, la propuesta molestaría;
 * 6. proyectos nuevos con equilibrado/profundo: sí. */
export function debeMaquetar(p: PeticionForja, cfg: ConfigForja): boolean {
  if (p.modo === "directo") return false;
  if (p.modo === "maqueta") return true;
  if (cfg.maquetaPrimero === false) return false;
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;
  if (!PERFILES[perfil].maquetaNuevos) return false;
  if (usuarioPideMaqueta(p.mensaje)) return true;
  if (usuarioQuiereDirecto(p.mensaje)) return false;
  if (p.codigoActual) return false;
  return true;
}

/** Parser tolerante del veredicto. El Revisor responde con etiquetas simples
 * porque los modelos gratis fallan con JSON: esto se lee igual con o sin
 * markdown alrededor y no explota si falta alguna etiqueta. */
export function parseVeredicto(texto: string): VeredictoForja {
  const etiquetaAprobado = /<veredicto>\s*aprobado\s*<\/veredicto>/i.test(texto);
  const etiquetaRechazo = /<veredicto>\s*rechazado\s*<\/veredicto>/i.test(texto);
  const aprobado = etiquetaAprobado ||
    (!etiquetaRechazo && !/rechaz/i.test(texto) && /aprobado/i.test(texto));
  const bloque = texto.match(/<defectos>([\s\S]*?)<\/defectos>/i);
  const defectos = (bloque?.[1] ?? "")
    .split(/\n+/)
    .map((l) => l.trim().replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const resumenBloque = texto.match(/<resumen>([\s\S]*?)<\/resumen>/i);
  return {
    aprobado,
    defectos,
    resumen: (resumenBloque?.[1] ?? "").trim().slice(0, 240) ||
      (aprobado ? "Cumple la ficha y el checklist." : "Rechazado, ver defectos."),
  };
}

/** Parser tolerante del bloque <direcciones> que el Diseñador añade cuando
 * hay fase de maqueta. Devuelve las direcciones encontradas (0..3). */
export function parseDirecciones(texto: string): DireccionDiseno[] {
  const bloque = texto.match(/<direcciones>([\s\S]*?)<\/direcciones>/i);
  const fuente = bloque ? bloque[1] : texto;
  const out: DireccionDiseno[] = [];
  const re =
    /^\s*(\d)[.)]\s*(.+?)\s*[—–-]\s*(.+?)(?:\s*[—–-]\s*(.+?))?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente)) !== null && out.length < 3) {
    const n = Number(m[1]);
    if (n < 1 || n > 3) continue;
    out.push({
      n: n as 1 | 2 | 3,
      nombre: m[2].trim().slice(0, 48),
      concepto: m[3].trim().slice(0, 160),
      porQue: (m[4] ?? m[3]).trim().slice(0, 200),
      paleta: paletaDeDireccion(fuente, n),
      tipografia: tipografiaDeDireccion(fuente, n),
    });
  }
  return out;
}

/** Detalles opcionales por dirección: «Paleta 2: #0F172A, #3B82F6…» */
function paletaDeDireccion(fuente: string, n: number): string {
  const m = fuente.match(new RegExp(`paleta\\s*${n}\\s*:\\s*(.+)`, "i"));
  return m ? m[1].trim().slice(0, 160) : "";
}

function tipografiaDeDireccion(fuente: string, n: number): string {
  const m = fuente.match(new RegExp(`tipograf[ií]a\\s*${n}\\s*:\\s*(.+)`, "i"));
  return m ? m[1].trim().slice(0, 120) : "";
}
