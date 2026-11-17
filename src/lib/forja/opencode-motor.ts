/** Forja IA — Motor OpenCode del móvil: los modelos gratis de OpenCode SIN clave de API.
 *
 * La app «OpenCode Mobile» corre el OpenCode oficial dentro del teléfono (Alpine +
 * PRoot) y lo sirve en `http://127.0.0.1:4096`. Forja IA le habla como a cualquier
 * proveedor: el motor se encarga del acceso a los modelos gratis (es el cliente
 * oficial, no una llamada anónima de un tercero) y aquí solo se le pide una
 * respuesta de texto.
 *
 * Decisiones:
 *  - Las herramientas PROPIAS del motor (bash, write, edit…) se apagan en cada
 *    petición: Forja IA tiene las suyas (`write_file`, `edit_file`, `run_project`,
 *    Sandbox, QA…) y las usa por el camino XML, que es texto puro. El motor es la
 *    pasarela a los modelos, no un segundo agente que escriba en otro sitio.
 *  - Una sesión del motor por respuesta, que se borra al acabar: Forja IA ya
 *    manda la conversación entera en cada turno y el historial vive aquí.
 *  - Se abre el flujo de eventos ANTES de pedir la respuesta para no perder el
 *    principio.
 *
 * La API es la clásica de OpenCode (`/session`, `/session/:id/prompt_async`,
 * `/event`), la misma que usa la interfaz de la app. La lógica pura (traducir la
 * conversación, interpretar eventos, filtrar gratis) está aparte de la red para
 * poder probarla sin ella. */

export const MOTOR_PROVIDER_ID = "opencode-motor";
export const MOTOR_URL_POR_DEFECTO = "http://127.0.0.1:4096";
export const MOTOR_USUARIO = "opencode";

/** Cuánto puede estar el flujo SIN ningún evento antes de darlo por muerto. */
export const MOTOR_INACTIVIDAD_MS = 90_000;

/** Cuánto se espera sin NINGÚN evento de ESTA sesión (los latidos del motor no cuentan)
 * antes de dar la respuesta por parada: un modelo caído o con tope de uso no devuelve un
 * error, se queda reintentando, y sin esto los puntos suspensivos no acaban nunca. */
export const MOTOR_SIN_PROGRESO_MS = 60_000;

/** El motor reintenta solo cuando el modelo falla; estos mensajes son un tope de uso. */
const RE_LIMITE = /rate[\s_-]?limit|limit|quota|exceed|usage|too many|\b429\b|saldo|credit/i;
/** Reintentos que se toleran (con un mensaje que no es de tope) antes de rendirse. */
const REINTENTOS_MAX = 3;

import { escucharAndroid, puenteAndroid } from "./plataforma";
import {
  crearFetchNativo,
  esUrlLocalDelMotor,
  type FetchMotor,
} from "./opencode-puente";

type Json = Record<string, unknown>;

let fetchNativo: { puente: unknown; fetch: FetchMotor } | null = null;

/** El `fetch` con el que se habla con el motor. Dentro de la APK, el del lado
 * nativo (sin CORS ni contraseña en JavaScript); fuera de ella, el del
 * navegador, que necesita la contraseña y que el motor permita el origen. */
export function fetchDelMotor(url: string): FetchMotor {
  const puente = puenteAndroid();
  if (
    puente &&
    typeof puente.ocHttp === "function" &&
    typeof puente.ocCancelar === "function" &&
    esUrlLocalDelMotor(url)
  ) {
    if (fetchNativo?.puente !== puente) {
      fetchNativo = {
        puente,
        fetch: crearFetchNativo(
          {
            ocHttp: puente.ocHttp.bind(puente),
            ocCancelar: puente.ocCancelar.bind(puente),
          },
          escucharAndroid,
        ),
      };
    }
    return fetchNativo.fetch;
  }
  return (u, init) => fetch(u, init);
}

/* ------------------------------------------------------------------ */
/* conexión                                                            */
/* ------------------------------------------------------------------ */

/** La URL base sin barras finales ni `/v1`: la que dé el usuario o la de siempre. */
export function urlDelMotor(base?: string): string {
  const limpia = (base ?? "").trim().replace(/\/+$/, "").replace(/\/v1$/i, "");
  return limpia && /^https?:\/\//i.test(limpia)
    ? limpia
    : MOTOR_URL_POR_DEFECTO;
}

/** UTF-8 seguro para `btoa`. */
function base64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Cabeceras de la petición: Basic con la contraseña del motor, si la hay. */
export function cabecerasMotor(
  password: string,
  conJson = true,
): Record<string, string> {
  const h: Record<string, string> = {};
  if (conJson) h["Content-Type"] = "application/json";
  const clave = password.trim();
  if (clave) h.Authorization = `Basic ${base64(`${MOTOR_USUARIO}:${clave}`)}`;
  return h;
}

/** Error con el estado HTTP, para que el sistema de salud y el failover lo traten
 * como cualquier otro fallo de proveedor. */
function errorMotor(mensaje: string, status?: number): Error {
  return Object.assign(new Error(mensaje), status ? { status } : {});
}

function mensajeDeConexion(url: string): string {
  return (
    `No se pudo conectar con el motor en ${url}. Abre la app OpenCode Mobile en el móvil ` +
    "(debe estar abierta o en segundo plano) y comprueba la URL."
  );
}

/* ------------------------------------------------------------------ */
/* modelos: solo los de coste cero                                     */
/* ------------------------------------------------------------------ */

/** Id de modelo de Forja IA para uno del motor: `proveedor/modelo`. */
export function idDeModeloMotor(providerID: string, modelID: string): string {
  return `${providerID}/${modelID}`;
}

export function separarModeloMotor(
  id: string,
): { providerID: string; modelID: string } | null {
  const i = id.indexOf("/");
  if (i <= 0 || i === id.length - 1) return null;
  return { providerID: id.slice(0, i), modelID: id.slice(i + 1) };
}

function costeCero(cost: unknown): boolean {
  if (!cost || typeof cost !== "object") return false;
  const c = cost as Json;
  const cache = (c.cache ?? {}) as Json;
  const valores = [
    c.input,
    c.output,
    c.cache_read ?? cache.read,
    c.cache_write ?? cache.write,
  ];
  // Un precio desconocido NO cuenta como gratis: se exige que estén todos y sean 0.
  return valores.every(
    (v) =>
      v !== null &&
      v !== undefined &&
      v !== "" &&
      Number.isFinite(Number(v)) &&
      Number(v) === 0,
  );
}

/** Ids `proveedor/modelo` con coste cero de la respuesta de `/config/providers`
 * (o `/provider`). Tolerante a formas raras: si algo no cuadra devuelve []. */
export function modelosGratisDelMotor(json: unknown): string[] {
  const raiz = (json && typeof json === "object" ? json : {}) as Json;
  const lista = Array.isArray(raiz.providers)
    ? (raiz.providers as Json[])
    : Array.isArray(raiz.all)
      ? (raiz.all as Json[])
      : (Object.values((raiz.providers ?? {}) as Json) as Json[]);
  const out = new Set<string>();
  for (const p of lista) {
    if (!p || typeof p !== "object" || typeof p.id !== "string") continue;
    const modelos = (p.models ?? {}) as Json;
    for (const [clave, m] of Object.entries(modelos)) {
      const mod = (m ?? {}) as Json;
      if (!costeCero(mod.cost)) continue;
      out.add(idDeModeloMotor(p.id, String(mod.id ?? clave)));
    }
  }
  return [...out].sort();
}

/* ------------------------------------------------------------------ */
/* la petición: de la conversación de Forja IA al prompt del motor     */
/* ------------------------------------------------------------------ */

/** Las herramientas propias del motor, todas apagadas. */
export function herramientasApagadas(): Record<string, boolean> {
  const nombres = [
    "bash",
    "edit",
    "write",
    "read",
    "grep",
    "glob",
    "list",
    "patch",
    "todowrite",
    "todoread",
    "webfetch",
    "task",
  ];
  return Object.fromEntries(nombres.map((n) => [n, false]));
}

export interface MensajeMotor {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: {
    dataUrl?: string;
    name?: string;
    mime?: string;
    type?: string;
  }[];
}

export interface GuionMotor {
  system?: string;
  text: string;
  files: { type: "file"; mime: string; url: string; filename?: string }[];
}

function mimeDeDataUrl(url: string): string {
  const m = /^data:([^;,]+)[;,]/.exec(url);
  return m ? m[1] : "application/octet-stream";
}

/** Convierte la conversación en lo que se le manda al motor: el prompt de sistema
 * aparte y el resto como un único mensaje. Con varios turnos se manda el guion
 * entero (el motor no guarda nada: cada respuesta es una sesión nueva). Las
 * imágenes que lleve el ÚLTIMO mensaje del usuario viajan como archivos. */
export function guionDeConversacion(
  mensajes: readonly MensajeMotor[],
  systemPrompt?: string,
): GuionMotor {
  const sistema: string[] = [];
  if (systemPrompt?.trim()) sistema.push(systemPrompt.trim());
  const turnos: MensajeMotor[] = [];
  for (const m of mensajes) {
    if (m.role === "system") {
      if (m.content?.trim()) sistema.push(m.content.trim());
    } else if (
      typeof m.content === "string" &&
      (m.content.trim() || m.attachments?.length)
    ) {
      turnos.push(m);
    }
  }
  const ultimoUsuario = [...turnos].reverse().find((m) => m.role === "user");
  const files = (ultimoUsuario?.attachments ?? [])
    .filter(
      (a): a is { dataUrl: string; name?: string; mime?: string } =>
        typeof a.dataUrl === "string" && a.dataUrl.startsWith("data:"),
    )
    .map((a) => ({
      type: "file" as const,
      mime: a.mime || mimeDeDataUrl(a.dataUrl),
      url: a.dataUrl,
      filename: a.name,
    }));
  let text: string;
  if (turnos.length <= 1) {
    text = turnos[0]?.content ?? "";
  } else {
    const guion = turnos
      .map(
        (m) =>
          `${m.role === "assistant" ? "Asistente" : "Usuario"}: ${m.content}`,
      )
      .join("\n\n");
    text = `Esta es la conversación hasta ahora. Responde SOLO al último mensaje del usuario.\n\n${guion}`;
  }
  return {
    ...(sistema.length ? { system: sistema.join("\n\n") } : {}),
    text: text || " ",
    files,
  };
}

/* ------------------------------------------------------------------ */
/* la respuesta: eventos del motor → texto                             */
/* ------------------------------------------------------------------ */

interface Parte {
  tipo: "text" | "reasoning";
  texto: string;
}

export interface UsoMotor {
  entrada: number | null;
  salida: number | null;
  cacheLeido: number | null;
  cacheEscrito: number | null;
}

export interface EstadoMotor {
  sessionID: string;
  asistentes: Set<string>;
  usuarios: Set<string>;
  /** partes por id, en orden de llegada */
  partes: Map<string, Parte & { mensaje: string }>;
  /** eventos de partes cuyo mensaje aún no se sabe de quién es */
  pendientes: Map<string, Json[]>;
  ocupado: boolean;
  terminado: boolean;
  error: { mensaje: string; status?: number } | null;
  uso: UsoMotor | null;
  /** el modelo falló y el motor está reintentando (`session.status` = retry) */
  reintento: { mensaje: string; intento: number } | null;
  /** cuántos eventos de ESTA sesión han llegado (sin contar latidos ni de otras) */
  eventosSesion: number;
  /** cuántos eventos de cada tipo, para explicar un cuelgue */
  vistos: Record<string, number>;
}

export function nuevoEstadoMotor(sessionID: string): EstadoMotor {
  return {
    sessionID,
    asistentes: new Set(),
    usuarios: new Set(),
    partes: new Map(),
    pendientes: new Map(),
    ocupado: false,
    terminado: false,
    error: null,
    uso: null,
    reintento: null,
    eventosSesion: 0,
    vistos: {},
  };
}

/** «server.connected×1, session.status×3»: qué llegó, para explicar un cuelgue. */
export function resumenDeEventos(e: EstadoMotor): string {
  const partes = Object.entries(e.vistos).map(([t, n]) => `${t}×${n}`);
  return partes.length
    ? `eventos recibidos: ${partes.join(", ")}`
    : "no llegó ningún evento del motor";
}

/** Texto y razonamiento acumulados de las partes del asistente. */
export function textoDelEstado(e: EstadoMotor): {
  texto: string;
  razonamiento: string;
} {
  let texto = "";
  let razonamiento = "";
  for (const p of e.partes.values()) {
    if (p.tipo === "text") texto += p.texto;
    else razonamiento += p.texto;
  }
  return { texto, razonamiento };
}

function errorDeEvento(err: unknown): { mensaje: string; status?: number } {
  const e = (err && typeof err === "object" ? err : {}) as Json;
  const d = ((e.data && typeof e.data === "object" ? e.data : e) ?? {}) as Json;
  const mensaje =
    typeof d.message === "string" && d.message
      ? d.message
      : typeof e.message === "string"
        ? e.message
        : "El motor devolvió un error.";
  const status =
    typeof d.statusCode === "number"
      ? d.statusCode
      : typeof d.status === "number"
        ? d.status
        : undefined;
  return { mensaje: mensaje.slice(0, 400), status };
}

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

function registrarParte(e: EstadoMotor, part: Json): void {
  const id = typeof part.id === "string" ? part.id : "";
  const tipo =
    part.type === "text"
      ? "text"
      : part.type === "reasoning"
        ? "reasoning"
        : null;
  if (!id || !tipo) return;
  const previo = e.partes.get(id);
  e.partes.set(id, {
    tipo,
    mensaje: String(part.messageID ?? ""),
    texto: typeof part.text === "string" ? part.text : (previo?.texto ?? ""),
  });
}

function procesarParte(e: EstadoMotor, ev: Json): void {
  const p = (ev.properties ?? {}) as Json;
  if (ev.type === "message.part.updated")
    registrarParte(e, (p.part ?? {}) as Json);
  else if (
    ev.type === "message.part.delta" &&
    p.field === "text" &&
    typeof p.delta === "string"
  ) {
    const parte = e.partes.get(String(p.partID ?? ""));
    if (parte) parte.texto += p.delta;
  }
}

/** Aplica un evento del flujo `/event` al estado. Devuelve true si cambió el texto. */
export function aplicarEventoMotor(e: EstadoMotor, evento: unknown): boolean {
  if (!evento || typeof evento !== "object") return false;
  const ev = evento as Json;
  const p = (ev.properties ?? {}) as Json;
  const tipo = String(ev.type ?? "");
  const antes = textoDelEstado(e);
  e.vistos[tipo] = (e.vistos[tipo] ?? 0) + 1;

  if (tipo === "message.updated") {
    const info = (p.info ?? {}) as Json;
    if (info.sessionID !== e.sessionID) return false;
    e.eventosSesion++;
    const id = String(info.id ?? "");
    if (info.role === "assistant") {
      e.asistentes.add(id);
      // los eventos de partes que llegaron antes de saber de quién eran
      for (const pend of e.pendientes.get(id) ?? []) procesarParte(e, pend);
      e.pendientes.delete(id);
      if (info.error) e.error = errorDeEvento(info.error);
      const t = (info.tokens ?? {}) as Json;
      const c = (t.cache ?? {}) as Json;
      const uso: UsoMotor = {
        entrada: numero(t.input),
        salida: numero(t.output),
        cacheLeido: numero(c.read),
        cacheEscrito: numero(c.write),
      };
      if (uso.entrada !== null || uso.salida !== null) e.uso = uso;
    } else if (info.role === "user") {
      e.usuarios.add(id);
      e.pendientes.delete(id);
    }
  } else if (tipo === "message.part.updated" || tipo === "message.part.delta") {
    const sesion =
      tipo === "message.part.updated"
        ? ((p.part ?? {}) as Json).sessionID
        : p.sessionID;
    if (sesion !== e.sessionID) return false;
    e.eventosSesion++;
    const mensaje = String(
      tipo === "message.part.updated"
        ? (((p.part ?? {}) as Json).messageID ?? "")
        : (p.messageID ?? ""),
    );
    if (e.usuarios.has(mensaje)) return false;
    if (e.asistentes.has(mensaje)) procesarParte(e, ev);
    else {
      const lista = e.pendientes.get(mensaje) ?? [];
      lista.push(ev);
      e.pendientes.set(mensaje, lista);
    }
  } else if (tipo === "session.status") {
    if (p.sessionID !== e.sessionID) return false;
    e.eventosSesion++;
    const st = (p.status ?? {}) as Json;
    const t = String(st.type ?? "");
    if (t === "retry") {
      e.ocupado = true;
      e.reintento = {
        mensaje: typeof st.message === "string" ? st.message.slice(0, 300) : "",
        intento: typeof st.attempt === "number" ? st.attempt : 0,
      };
    } else if (t === "busy") {
      e.ocupado = true;
    } else if (t === "idle" && (e.ocupado || e.asistentes.size))
      e.terminado = true;
  } else if (tipo === "session.idle") {
    if (p.sessionID === e.sessionID) e.eventosSesion++;
    if (p.sessionID === e.sessionID && (e.ocupado || e.asistentes.size))
      e.terminado = true;
  } else if (tipo === "session.error") {
    if (p.sessionID !== undefined && p.sessionID !== e.sessionID) return false;
    e.eventosSesion++;
    e.error = errorDeEvento(p.error);
    e.terminado = true;
  }

  const despues = textoDelEstado(e);
  return (
    despues.texto !== antes.texto || despues.razonamiento !== antes.razonamiento
  );
}

/** Al terminar sin haber sabido de quién eran unas partes (el evento del mensaje
 * se perdió), se adoptan las que no son del usuario. */
export function adoptarPendientes(e: EstadoMotor): void {
  if (textoDelEstado(e).texto) return;
  for (const [mensaje, lista] of e.pendientes) {
    if (e.usuarios.has(mensaje)) continue;
    for (const ev of lista) procesarParte(e, ev);
  }
  e.pendientes.clear();
}

/* ------------------------------------------------------------------ */
/* red                                                                 */
/* ------------------------------------------------------------------ */

async function pedir(
  url: string,
  init: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), timeoutMs);
  const fuera = init.signal;
  if (fuera) {
    if (fuera.aborted) control.abort();
    else fuera.addEventListener("abort", () => control.abort(), { once: true });
  }
  try {
    return await fetchDelMotor(url)(url, { ...init, signal: control.signal });
  } catch (e) {
    if (fuera?.aborted) throw e;
    throw errorMotor(
      mensajeDeConexion(urlDelMotor(url.replace(/(https?:\/\/[^/]+).*/, "$1"))),
    );
  } finally {
    clearTimeout(t);
  }
}

function errorHttp(res: Response, cuerpo: string): Error {
  const detalle = cuerpo.slice(0, 200);
  if (res.status === 401) {
    // Dentro de la APK no hay contraseña que copiar: la pone el lado nativo.
    if (puenteAndroid()?.ocHttp)
      return errorMotor(
        "El motor del móvil no aceptó la conexión. Detenlo y vuelve a iniciarlo en Ajustes → OpenCode (motor del móvil).",
        401,
      );
    return errorMotor(
      "El motor rechazó la contraseña. Cópiala de nuevo desde la app OpenCode Mobile (Ajustes → Conectar con Forja IA).",
      401,
    );
  }
  return errorMotor(
    `El motor respondió ${res.status}${detalle ? `: ${detalle}` : ""}`,
    res.status,
  );
}

export interface ConfigMotor {
  apiKey: string;
  baseUrl?: string;
}

/** Modelos gratis que ofrece el motor ahora mismo. Lanza si no se puede conectar. */
export async function leerModelosMotor(
  config: ConfigMotor,
  signal?: AbortSignal,
): Promise<string[]> {
  const base = urlDelMotor(config.baseUrl);
  const cab = cabecerasMotor(config.apiKey, false);
  for (const ruta of ["/config/providers", "/provider"]) {
    const res = await pedir(`${base}${ruta}`, { headers: cab, signal });
    if (res.status === 404) continue;
    if (!res.ok) throw errorHttp(res, await res.text().catch(() => ""));
    return modelosGratisDelMotor(await res.json().catch(() => null));
  }
  return [];
}

export interface SondeoMotor {
  estado: "ok" | "sin-conexion" | "clave" | "otro";
  mensaje: string;
  status: number;
  modelos: string[];
}

/** «Probar»: ¿responde el motor y qué modelos gratis tiene? No gasta ninguna
 * llamada a un modelo: solo pregunta el catálogo. */
export async function sondearMotor(config: ConfigMotor): Promise<SondeoMotor> {
  const base = urlDelMotor(config.baseUrl);
  try {
    const salud = await pedir(
      `${base}/global/health`,
      { headers: cabecerasMotor(config.apiKey, false) },
      8_000,
    );
    if (salud.status === 401)
      return {
        estado: "clave",
        status: 401,
        modelos: [],
        mensaje: errorHttp(salud, "").message,
      };
    const modelos = await leerModelosMotor(config);
    if (!modelos.length) {
      return {
        estado: "otro",
        status: 200,
        modelos,
        mensaje:
          "El motor responde, pero no ofrece ningún modelo gratis ahora mismo.",
      };
    }
    return {
      estado: "ok",
      status: 200,
      modelos,
      mensaje: `Motor conectado: ${modelos.length} modelos gratis, sin clave de API.`,
    };
  } catch (e) {
    const status = (e as { status?: number })?.status ?? 0;
    return {
      estado: status === 401 ? "clave" : status ? "otro" : "sin-conexion",
      status,
      modelos: [],
      mensaje: e instanceof Error ? e.message : mensajeDeConexion(base),
    };
  }
}

/** Lee un flujo SSE entregando cada `data:`; corta si pasa demasiado sin eventos. */
async function leerSSE(
  res: Response,
  alDato: (json: string) => boolean | void,
  inactividadMs: number,
): Promise<void> {
  const lector = res.body?.getReader();
  if (!lector) throw errorMotor("El motor no admite el flujo de eventos.");
  const dec = new TextDecoder();
  let buffer = "";
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const muerto = new Promise<never>((_, rechazar) => {
      timer = setTimeout(
        () =>
          rechazar(
            errorMotor(
              `Sin eventos del motor durante ${Math.round(inactividadMs / 1000)} s: parece colgado.`,
            ),
          ),
        inactividadMs,
      );
    });
    let r: ReadableStreamReadResult<Uint8Array>;
    try {
      r = await Promise.race([lector.read(), muerto]);
    } catch (e) {
      await lector.cancel().catch(() => {});
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (r.done) return;
    buffer += dec.decode(r.value, { stream: true });
    const lineas = buffer.split("\n");
    buffer = lineas.pop() ?? "";
    for (const cruda of lineas) {
      const linea = cruda.trim();
      if (!linea.startsWith("data:")) continue;
      const dato = linea.slice(5).trim();
      if (dato && dato !== "[DONE]" && alDato(dato) === true) {
        await lector.cancel().catch(() => {});
        return;
      }
    }
  }
}

export interface OpcionesMotor {
  config: ConfigMotor;
  /** `proveedor/modelo` */
  modelId: string;
  messages: readonly MensajeMotor[];
  systemPrompt?: string;
  signal: AbortSignal;
  onDelta: (texto: string) => void;
  onReasoning?: (texto: string) => void;
  onUsage?: (u: UsoMotor) => void;
  onFinish?: (motivo: "fin") => void;
  /** inyectables en pruebas */
  inactividadMs?: number;
  sinProgresoMs?: number;
}

/** ¿El motor se rindió con este modelo? Un mensaje de tope se corta al momento; otro fallo,
 * tras unos cuantos reintentos. Devuelve el error a mostrar o null si aún se espera. */
export function errorPorReintentos(
  e: EstadoMotor,
  modelo: string,
): { mensaje: string; status?: number } | null {
  const r = e.reintento;
  if (!r || textoDelEstado(e).texto) return null;
  const limite = RE_LIMITE.test(r.mensaje);
  if (!limite && r.intento < REINTENTOS_MAX) return null;
  return {
    mensaje:
      `El motor no consigue responder con ${modelo}: ${r.mensaje || "el modelo falla"}` +
      (limite
        ? " — es un tope de uso del modelo; espera un rato o prueba otro."
        : ` (lleva ${r.intento} reintentos; prueba otro modelo).`),
    ...(limite ? { status: 429 } : {}),
  };
}

/** Pide UNA respuesta de texto al motor y la entrega en streaming. Devuelve el texto. */
export async function streamMotor(op: OpcionesMotor): Promise<string> {
  const modelo = separarModeloMotor(op.modelId);
  if (!modelo)
    throw errorMotor(
      `«${op.modelId}» no es un modelo del motor (se espera proveedor/modelo). Pulsa «Probar» para cargar la lista.`,
    );
  const base = urlDelMotor(op.config.baseUrl);
  const cab = cabecerasMotor(op.config.apiKey);
  const guion = guionDeConversacion(op.messages, op.systemPrompt);

  // 1) una sesión para esta respuesta
  const sesionRes = await pedir(`${base}/session`, {
    method: "POST",
    headers: cab,
    body: JSON.stringify({ title: "Forja IA" }),
    signal: op.signal,
  });
  if (!sesionRes.ok)
    throw errorHttp(sesionRes, await sesionRes.text().catch(() => ""));
  const sesion = (await sesionRes.json().catch(() => null)) as {
    id?: string;
  } | null;
  const sessionID = typeof sesion?.id === "string" ? sesion.id : "";
  if (!/^[\w-]{1,128}$/.test(sessionID))
    throw errorMotor("El motor devolvió una sesión no válida.");

  const flujo = new AbortController();
  const alAbortar = () => {
    flujo.abort();
    void fetchDelMotor(base)(
      `${base}/session/${encodeURIComponent(sessionID)}/abort`,
      { method: "POST", headers: cab },
    ).catch(() => {});
  };
  if (op.signal.aborted) alAbortar();
  else op.signal.addEventListener("abort", alAbortar, { once: true });

  const estado = nuevoEstadoMotor(sessionID);
  let ultimoTexto = "";
  let ultimoRazonamiento = "";
  let ultimoProgreso = Date.now();
  let vistoSesion = 0;
  let sinProgreso = false;
  const limiteSinProgreso = op.sinProgresoMs ?? MOTOR_SIN_PROGRESO_MS;
  const vigilante = setInterval(
    () => {
      if (
        Date.now() - ultimoProgreso > limiteSinProgreso &&
        !estado.terminado
      ) {
        sinProgreso = true;
        flujo.abort();
      }
    },
    Math.max(20, Math.min(2000, Math.floor(limiteSinProgreso / 4))),
  );
  try {
    // 2) el flujo de eventos, abierto ANTES de pedir la respuesta
    const eventos = await fetchDelMotor(base)(`${base}/event`, {
      headers: cabecerasMotor(op.config.apiKey, false),
      signal: flujo.signal,
    }).catch((e) => {
      if (op.signal.aborted) throw e;
      throw errorMotor(mensajeDeConexion(base));
    });
    if (!eventos.ok)
      throw errorHttp(eventos, await eventos.text().catch(() => ""));

    // 3) la petición
    const cuerpo = {
      model: { providerID: modelo.providerID, modelID: modelo.modelID },
      ...(guion.system ? { system: guion.system } : {}),
      tools: herramientasApagadas(),
      parts: [{ type: "text", text: guion.text }, ...guion.files],
    };
    const envio = await pedir(
      `${base}/session/${encodeURIComponent(sessionID)}/prompt_async`,
      {
        method: "POST",
        headers: cab,
        body: JSON.stringify(cuerpo),
        signal: op.signal,
      },
    );
    if (!envio.ok) throw errorHttp(envio, await envio.text().catch(() => ""));

    // 4) texto a medida que llega, hasta que la sesión queda libre
    ultimoProgreso = Date.now();
    try {
      await leerSSE(
        eventos,
        (dato) => {
          let ev: unknown;
          try {
            ev = JSON.parse(dato);
          } catch {
            return;
          }
          const cambio = aplicarEventoMotor(estado, ev);
          // solo cuenta lo de ESTA sesión: los latidos del motor no son progreso
          if (estado.eventosSesion !== vistoSesion) {
            vistoSesion = estado.eventosSesion;
            ultimoProgreso = Date.now();
          }
          const rendido = errorPorReintentos(estado, op.modelId);
          if (rendido) {
            estado.error = rendido;
            estado.terminado = true;
          }
          if (cambio) {
            const t = textoDelEstado(estado);
            if (t.razonamiento !== ultimoRazonamiento) {
              ultimoRazonamiento = t.razonamiento;
              op.onReasoning?.(t.razonamiento);
            }
            if (t.texto !== ultimoTexto) {
              ultimoTexto = t.texto;
              op.onDelta(t.texto);
            }
          }
          return estado.terminado;
        },
        op.inactividadMs ?? MOTOR_INACTIVIDAD_MS,
      );
    } catch (e) {
      // el vigilante cortó el flujo: se explica qué pasó en vez de un «Aborted»
      if (sinProgreso && !op.signal.aborted) {
        const r = estado.reintento;
        throw errorMotor(
          `El motor aceptó la petición pero no empezó a responder en ${Math.round(limiteSinProgreso / 1000)} s (${resumenDeEventos(estado)}` +
            (r?.mensaje ? `; dice: ${r.mensaje}` : "") +
            "). Suele ser un modelo caído o con tope de uso: prueba otro.",
        );
      }
      throw e;
    }
    if (op.signal.aborted) throw new DOMException("Aborted", "AbortError");
    adoptarPendientes(estado);
    const final = textoDelEstado(estado);
    if (final.texto !== ultimoTexto) op.onDelta(final.texto);
    if (estado.error && !final.texto)
      throw errorMotor(estado.error.mensaje, estado.error.status);
    if (estado.uso) op.onUsage?.(estado.uso);
    op.onFinish?.("fin");
    return final.texto;
  } finally {
    clearInterval(vigilante);
    op.signal.removeEventListener("abort", alAbortar);
    flujo.abort();
    // la sesión ya no hace falta: se borra para no llenar la lista de proyectos
    void fetchDelMotor(base)(
      `${base}/session/${encodeURIComponent(sessionID)}`,
      { method: "DELETE", headers: cabecerasMotor(op.config.apiKey, false) },
    ).catch(() => {});
  }
}
