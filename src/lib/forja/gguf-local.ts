/** Forja IA — Modelo local .gguf que corre DENTRO del navegador.
 *
 * llama.cpp compilado a WebAssembly (wllama) en un worker: eliges un archivo
 * .gguf y la app lo usa como un modelo más —chat, agente, crear páginas,
 * consenso— sin servidor, sin clave y sin conexión. Si el navegador tiene
 * WebGPU, las capas van a la GPU; si no, a la CPU.
 *
 * Los archivos se copian al almacenamiento privado del sitio (OPFS) para que
 * sigan ahí al recargar. Donde OPFS no deja escribir (algunos Safari), se
 * quedan en memoria hasta cerrar la pestaña, y la interfaz lo dice.
 *
 * wllama tiene un solo contexto: las llamadas van en cola, una detrás de otra,
 * y cambiar de modelo descarga el anterior. Es lo honesto con la memoria de un
 * navegador: dos modelos de 2 GB a la vez no caben en casi ningún equipo.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatCompletionChunk } from "@wllama/wllama/esm/types/oai-compat";
import type { Wllama } from "@wllama/wllama/esm/wllama";
import { toast } from "sonner";
import {
  agruparGguf,
  aligerarParaContexto,
  contextoEfectivo,
  explicarErrorGguf,
  GGUF_CONTEXTO_PARA_HERRAMIENTAS,
  GGUF_CONTEXTO_POR_DEFECTO,
  GGUF_MAX_TROZO,
  esAbortoDelMotor,
  esArchivoGguf,
  esDispositivoMovil,
  parametrosParaWllama,
  plantillaConHerramientas,
  proporcionReal,
  tamanoLegible,
  type CuerpoOpenAI,
  type GrupoGguf,
} from "./gguf-mensajes";

const CARPETA = "forja-gguf";

export interface ModeloGguf extends GrupoGguf {
  bytes: number;
}

interface EstadoGguf {
  modelos: ModeloGguf[];
  /** Modelo en memoria, listo para generar. */
  cargado: string | null;
  /** Modelo que se está cargando ahora mismo. */
  cargando: string | null;
  /** Copia de archivos al almacenamiento (0-1), o null si no hay copia. */
  copiando: { nombre: string; progreso: number } | null;
  /** Último error, para enseñarlo en el panel. */
  error: string | null;
  /** Dónde corre el modelo cargado. */
  aceleracion: "webgpu" | "cpu" | null;
  /** Contexto con el que se entrenó el modelo cargado: llama.cpp no pasa de ahí. */
  contextoEntrenado: number | null;
  /** Velocidad de la última respuesta, en tokens por segundo. */
  tokensPorSegundo: number | null;
  /** false si OPFS no deja escribir: los modelos solo duran esta sesión. */
  persistente: boolean;
}

export const useGgufEstado = create<EstadoGguf>(() => ({
  modelos: [],
  cargado: null,
  cargando: null,
  copiando: null,
  error: null,
  aceleracion: null,
  contextoEntrenado: null,
  tokensPorSegundo: null,
  persistente: true,
}));

/** GPU: «auto» usa WebGPU en ordenadores y la CPU en móviles; «no» fuerza la
 * CPU (también lo pone la app si la GPU de este dispositivo hizo caer el
 * motor); «si» prueba WebGPU también en el móvil. */
export type PreferenciaGpu = "auto" | "si" | "no";

/** Lo que elige el usuario y sobrevive a recargar. */
export const useGgufAjustes = create<{
  contexto: number;
  setContexto: (n: number) => void;
  gpu: PreferenciaGpu;
  setGpu: (g: PreferenciaGpu) => void;
}>()(
  persist(
    (set) => ({
      contexto: GGUF_CONTEXTO_POR_DEFECTO,
      setContexto: (contexto) => set({ contexto }),
      gpu: "auto",
      setGpu: (gpu) => set({ gpu }),
    }),
    { name: "forja-gguf-v1", storage: createJSONStorage(() => localStorage) }
  )
);

/** ¿Se intenta WebGPU al cargar? */
function quiereGpu(w: Wllama): boolean {
  if (!w.isSupportWebGPU()) return false;
  const g = useGgufAjustes.getState().gpu;
  if (g === "no") return false;
  if (g === "si") return true;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return !esDispositivoMovil(navigator.userAgent, nav.userAgentData?.mobile);
}

// ——— Log nativo ———
// llama.cpp explica sus fallos (GGML_ABORT, memoria) en su log, y wllama solo
// devuelve «(ABORT)». Se guardan las últimas líneas para poder decir el porqué.
const registroNativo: string[] = [];
function anotarNativo(...args: unknown[]): void {
  const linea = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ").trim();
  if (!linea) return;
  registroNativo.push(linea.slice(0, 300));
  if (registroNativo.length > 30) registroNativo.shift();
}
/** La última línea del log que suena a fallo, si la hay. */
function causaNativa(): string | null {
  for (let i = registroNativo.length - 1; i >= 0; i--) {
    if (/error|abort|assert|fail|out of memory|oom|cannot|unable|exceed/i.test(registroNativo[i])) {
      return registroNativo[i];
    }
  }
  return null;
}
const loggerForja = {
  debug: () => {},
  log: (...a: unknown[]) => anotarNativo(...a),
  warn: (...a: unknown[]) => anotarNativo(...a),
  error: (...a: unknown[]) => {
    anotarNativo(...a);
    console.error("[gguf]", ...a);
  },
};

// ——— Almacenamiento: OPFS, o memoria si no se puede ———

/** Respaldo cuando OPFS no está o no deja escribir. */
const enMemoria = new Map<string, File>();

async function carpeta(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!navigator.storage?.getDirectory) return null;
    const raiz = await navigator.storage.getDirectory();
    return await raiz.getDirectoryHandle(CARPETA, { create: true });
  } catch {
    return null;
  }
}

type DirConEntradas = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function archivosGuardados(): Promise<Map<string, File>> {
  const out = new Map<string, File>(enMemoria);
  const dir = await carpeta();
  if (!dir) return out;
  for await (const [nombre, h] of (dir as DirConEntradas).entries()) {
    if (h.kind === "file" && esArchivoGguf(nombre)) {
      out.set(nombre, await (h as FileSystemFileHandle).getFile());
    }
  }
  return out;
}

/** Relee lo guardado y actualiza la lista de modelos. Devuelve sus nombres. */
export async function refrescarModelos(): Promise<string[]> {
  const archivos = await archivosGuardados();
  const modelos = agruparGguf([...archivos.keys()]).map((g) => ({
    ...g,
    bytes: g.archivos.reduce((s, n) => s + (archivos.get(n)?.size ?? 0), 0),
  }));
  useGgufEstado.setState({ modelos });
  return modelos.filter((m) => !m.faltan).map((m) => m.nombre);
}

/** Copia los .gguf elegidos al almacenamiento del sitio. Devuelve los
 * nombres de modelo que quedan disponibles. */
export async function guardarModelos(files: readonly File[]): Promise<string[]> {
  const ggufs = files.filter((f) => esArchivoGguf(f.name));
  if (!ggufs.length) throw new Error("Elige uno o más archivos .gguf.");
  const grande = ggufs.find((f) => f.size > GGUF_MAX_TROZO);
  if (grande) {
    throw new Error(
      `«${grande.name}» pesa ${tamanoLegible(grande.size)} y el navegador no puede leer un solo archivo de más de 2 GB. ` +
        "Pártelo con llama-gguf-split --split-max-size 1G y elige todos los trozos a la vez."
    );
  }
  const total = ggufs.reduce((s, f) => s + f.size, 0);
  const dir = await carpeta();
  // ¿Cabe? Mejor decirlo antes que a mitad de copiar 2 GB.
  const est = await navigator.storage?.estimate?.().catch(() => null);
  if (dir && est?.quota && est.usage != null && est.quota - est.usage < total) {
    throw new Error(
      `No hay sitio: el modelo ocupa ${tamanoLegible(total)} y al sitio le quedan ` +
        `${tamanoLegible(est.quota - est.usage)}. Borra otro modelo o libera espacio en el disco.`
    );
  }
  // Que el navegador no lo borre por su cuenta cuando ande justo de espacio.
  void navigator.storage?.persist?.().catch(() => false);

  let copiado = 0;
  let persistente = !!dir;
  try {
    for (const f of ggufs) {
      useGgufEstado.setState({ copiando: { nombre: f.name, progreso: copiado / total }, error: null });
      let ok = false;
      if (dir) {
        try {
          const h = await dir.getFileHandle(f.name, { create: true });
          const w = await h.createWritable();
          const contar = new TransformStream<Uint8Array, Uint8Array>({
            transform(trozo, ctl) {
              copiado += trozo.byteLength;
              useGgufEstado.setState({ copiando: { nombre: f.name, progreso: copiado / total } });
              ctl.enqueue(trozo);
            },
          });
          await f.stream().pipeThrough(contar).pipeTo(w);
          ok = true;
        } catch {
          // createWritable no existe en todos los navegadores (Safari antiguo):
          // se queda en memoria para esta sesión.
          await dir.removeEntry(f.name).catch(() => {});
        }
      }
      if (!ok) {
        persistente = false;
        enMemoria.set(f.name, f);
        copiado += f.size;
      }
    }
  } finally {
    useGgufEstado.setState({ copiando: null, persistente });
  }
  await refrescarModelos();
  const nombres = new Set(ggufs.map((f) => f.name));
  return useGgufEstado
    .getState()
    .modelos.filter((m) => !m.faltan && m.archivos.some((a) => nombres.has(a)))
    .map((m) => m.nombre);
}

/** Borra un modelo (todos sus trozos). Si estaba cargado, lo descarga. */
export async function borrarModelo(nombre: string): Promise<void> {
  const m = useGgufEstado.getState().modelos.find((x) => x.nombre === nombre);
  const archivos = m?.archivos ?? [nombre];
  if (useGgufEstado.getState().cargado === nombre) await descargar();
  const dir = await carpeta();
  for (const a of archivos) {
    enMemoria.delete(a);
    await dir?.removeEntry(a).catch(() => {});
  }
  await refrescarModelos();
}

// ——— Motor ———

let instancia: Wllama | null = null;
let nCtxCargado = GGUF_CONTEXTO_POR_DEFECTO;
let cola: Promise<unknown> = Promise.resolve();

/** Una cosa cada vez: wllama tiene un solo contexto. */
function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const r = cola.then(fn, fn);
  cola = r.catch(() => {});
  return r;
}

function abortado(): DOMException {
  return new DOMException("Generación cancelada", "AbortError");
}

async function nuevaInstancia(): Promise<Wllama> {
  const { Wllama } = await import("@wllama/wllama/esm/index.js");
  // El .wasm lo sirve el propio sitio (el empaquetador lo copia y le pone
  // hash): nada sale a un CDN, y con la PWA instalada funciona sin conexión.
  const wasm = new URL("@wllama/wllama/esm/wasm/wllama.wasm", import.meta.url).href;
  // El log nativo no se silencia: va a `loggerForja`, que lo guarda para
  // explicar un fallo en vez de enseñar «(ABORT)» a secas.
  return new Wllama({ default: wasm }, { suppressNativeLog: false, logger: loggerForja });
}

async function descargar(): Promise<void> {
  const w = instancia;
  instancia = null;
  useGgufEstado.setState({ cargado: null, aceleracion: null, contextoEntrenado: null });
  await w?.exit().catch(() => {});
}

/** Libera la memoria del modelo cargado (botón «Descargar de memoria»). */
export function descargarModelo(): Promise<void> {
  return enCola(descargar);
}

async function cargar(nombre: string, signal?: AbortSignal): Promise<void> {
  const st = useGgufEstado.getState();
  if (st.cargado === nombre && instancia) return;
  if (signal?.aborted) throw abortado();
  await refrescarModelos();
  const modelo = useGgufEstado.getState().modelos.find((m) => m.nombre === nombre);
  if (!modelo) {
    throw new Error(
      `El modelo local «${nombre}» ya no está en este navegador. Vuelve a elegir el archivo en Ajustes → Proveedores → Modelo local.`
    );
  }
  if (modelo.faltan) {
    throw new Error(`A «${nombre}» le faltan ${modelo.faltan} trozos: elige todos los archivos del modelo a la vez.`);
  }
  const archivos = await archivosGuardados();
  const blobs = modelo.archivos.map((a) => archivos.get(a)).filter((b): b is File => !!b);

  await descargar();
  useGgufEstado.setState({ cargando: nombre, error: null });
  const pedido = useGgufAjustes.getState().contexto;
  try {
    let w = await nuevaInstancia();
    let aceleracion: "webgpu" | "cpu" = quiereGpu(w) ? "webgpu" : "cpu";
    try {
      await w.loadModel(blobs, aceleracion === "webgpu" ? { n_ctx: pedido } : { n_ctx: pedido, n_gpu_layers: 0 });
    } catch (e) {
      if (aceleracion !== "webgpu") throw e;
      // WebGPU anunciado pero sin memoria o sin soporte real: a la CPU.
      await w.exit().catch(() => {});
      w = await nuevaInstancia();
      await w.loadModel(blobs, { n_ctx: pedido, n_gpu_layers: 0 });
      aceleracion = "cpu";
    }
    instancia = w;
    const info = w.getLoadedContextInfo();
    // llama.cpp no pasa del contexto con el que se entrenó el modelo, aunque
    // `n_ctx` diga lo pedido: el que cuenta es el menor.
    nCtxCargado = contextoEfectivo(info?.n_ctx || pedido, info?.n_ctx_train);
    useGgufEstado.setState({
      cargado: nombre,
      aceleracion,
      contextoEntrenado: info?.n_ctx_train || null,
    });
  } catch (e) {
    const msg = explicarErrorGguf(e, pedido, causaNativa());
    useGgufEstado.setState({ error: msg });
    throw new Error(msg);
  } finally {
    useGgufEstado.setState({ cargando: null });
  }
}

/** Carga el modelo en memoria (para el botón «Cargar» del panel). */
export function cargarModelo(nombre: string): Promise<void> {
  return enCola(() => cargar(nombre));
}

/** ¿El modelo sabe llamar herramientas de forma nativa? Lo dice su plantilla
 * de chat; para leerla hay que cargarlo. */
export function soportaHerramientas(nombre: string, signal?: AbortSignal): Promise<boolean> {
  return enCola(async () => {
    await cargar(nombre, signal);
    // Con poco contexto, el catálogo de herramientas (~5.000 tokens) no deja
    // sitio para el encargo: el agente va por su modo de texto.
    return nCtxCargado >= GGUF_CONTEXTO_PARA_HERRAMIENTAS && plantillaConHerramientas(instancia?.getChatTemplate());
  });
}

/** Trozo con el uso relleno a partir de los tiempos de llama.cpp: así la ficha
 * «por qué» de la respuesta enseña tokens también con el modelo local. */
function conUso(c: ChatCompletionChunk): ChatCompletionChunk {
  const t = c.timings;
  if (c.usage || !t || !c.choices?.[0]?.finish_reason) return c;
  const entrada = (t.prompt_n ?? 0) + (t.cache_n ?? 0);
  const salida = t.predicted_n ?? 0;
  return { ...c, usage: { prompt_tokens: entrada, completion_tokens: salida, total_tokens: entrada + salida } };
}

/** Proporción caracteres/token aprendida de los errores de llama.cpp, por
 * modelo: la estimación de partida es conservadora y esto la afina. */
const proporcionPorModelo = new Map<string, number>();

/** Último aviso de aligerado enseñado, para no repetirlo en cada vuelta del
 * agente ni en cada mensaje con el mismo recorte. */
let ultimoAviso = "";

/** Dice qué se quitó para que la petición cupiera (lo usa también el motor
 * nativo de la APK). Una vez por recorte distinto. */
export function avisarAligerado(quitado: readonly string[], nCtx: number): void {
  const texto = quitado.join(", ");
  if (!texto || texto === ultimoAviso) return;
  ultimoAviso = texto;
  toast.info("Petición aligerada para el modelo local", {
    description:
      `No cabía entera en su contexto (${new Intl.NumberFormat("es").format(nCtx)} tokens). Se quitó: ${texto}. ` +
      "Para enviarla completa, sube el contexto en Ajustes → Proveedores → Modelo local.",
    duration: 9000,
  });
}

/** Genera con el modelo local. `onData` recibe trozos con el formato exacto
 * del streaming de OpenAI, así que `streamChat` los procesa con el mismo
 * código que a cualquier proveedor: contenido, razonamiento, herramientas,
 * motivo de parada y uso.
 *
 * Antes de mandar nada, la petición se ajusta al contexto del modelo
 * (`aligerarParaContexto`): el prompt de sistema de un encargo de página y
 * las herramientas pasan de 10.000 tokens, más que el contexto entero de
 * muchos modelos locales. Lo que se quita se dice. */
export function generarLocal(
  nombre: string,
  cuerpo: CuerpoOpenAI,
  signal: AbortSignal,
  onData: (chunk: ChatCompletionChunk) => void
): Promise<void> {
  return enCola(async () => {
    if (signal.aborted) throw abortado();
    await cargar(nombre, signal);
    if (!instancia) throw new Error(explicarErrorGguf(null, nCtxCargado));
    let ajuste = aligerarParaContexto(cuerpo, nCtxCargado, proporcionPorModelo.get(nombre));
    let emitido = false;
    // `instancia`, no una copia: tras un aborto se recrea y se reintenta.
    const motor = (): Wllama => {
      if (!instancia) throw new Error(explicarErrorGguf(null, nCtxCargado));
      return instancia;
    };
    const generar = () =>
      motor().createChatCompletion({
        ...(parametrosParaWllama(ajuste.cuerpo, nCtxCargado) as unknown as Parameters<Wllama["createChatCompletion"]>[0]),
        stream: true,
        abortSignal: signal,
        onData: (c: ChatCompletionChunk) => {
          if (c.timings?.predicted_per_second) {
            useGgufEstado.setState({ tokensPorSegundo: c.timings.predicted_per_second });
          }
          const d = c.choices?.[0]?.delta;
          if (d?.content || d?.tool_calls?.length) emitido = true;
          onData(conUso(c));
        },
      });
    let reajustado = false;
    let pasadoACpu = false;
    for (let intento = 0; ; intento++) {
      try {
        avisarAligerado(ajuste.quitado, nCtxCargado);
        await generar();
        return;
      } catch (e) {
        if (signal.aborted || (e as Error)?.name === "AbortError") throw abortado();
        // llama.cpp se detuvo por dentro: el worker está muerto y el próximo
        // mensaje tiene que encontrar uno nuevo, no este.
        if (esAbortoDelMotor(e)) {
          const causa = causaNativa();
          const enGpu = useGgufEstado.getState().aceleracion === "webgpu";
          await descargar();
          if (enGpu) {
            // La GPU de este dispositivo no puede con el modelo (en móviles es
            // lo normal: admiten búferes mucho más pequeños). Desde ahora, la
            // CPU; y si aún no había nada escrito, se reintenta ya.
            useGgufAjustes.getState().setGpu("no");
            toast.warning("El modelo local pasa a la CPU", {
              description:
                "La GPU de este dispositivo no pudo con el modelo. A partir de ahora va en la CPU (más lento, pero estable). Puedes cambiarlo en Ajustes → Proveedores → Modelo local.",
              duration: 10000,
            });
            if (!emitido && !pasadoACpu) {
              pasadoACpu = true;
              await cargar(nombre, signal);
              continue;
            }
          }
          throw new Error(explicarErrorGguf(e, nCtxCargado, causa));
        }
        const texto = (e as Error)?.message ?? String(e);
        // No cupo aunque la estimación decía que sí: llama.cpp dice cuántos
        // tokens ocupaba de verdad. Con esa proporción se vuelve a aligerar,
        // una vez, y queda aprendida para este modelo.
        const real = !emitido && !reajustado ? proporcionReal(ajuste.cuerpo, texto) : null;
        if (real) {
          reajustado = true;
          proporcionPorModelo.set(nombre, real);
          ajuste = aligerarParaContexto(cuerpo, nCtxCargado, real);
          continue;
        }
        if (!esFalloDeBytes(e)) throw new Error(explicarErrorGguf(e, nCtxCargado));
        // El modelo soltó bytes que no forman UTF-8 válido y wllama se cae al
        // serializarlos (el contexto sigue sano: la llamada siguiente va
        // bien). Sin nada escrito, se reintenta una vez; con texto ya en
        // pantalla, la respuesta se da por terminada ahí en vez de tirarla.
        if (!emitido && intento === 0) continue;
        if (emitido) {
          console.warn("[gguf] el modelo generó UTF-8 no válido; la respuesta se corta ahí");
          onData({
            id: "gguf-corte",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: nombre,
            choices: [{ index: 0, delta: {}, finish_reason: "stop", logprobs: null }],
          });
          return;
        }
        throw new Error(explicarErrorGguf(e, nCtxCargado));
      }
    }
  });
}

/** Fallo de wllama 3.8 al serializar texto con UTF-8 no válido: su worker lee
 * la longitud de la respuesta donde no está («Invalid typed array length»).
 * Se distingue por el mensaje para no tapar fallos de verdad del motor. */
function esFalloDeBytes(e: unknown): boolean {
  return /Invalid typed array length/i.test((e as Error)?.message ?? "");
}
