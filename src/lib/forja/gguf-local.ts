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
import {
  agruparGguf,
  contextoEfectivo,
  explicarErrorGguf,
  GGUF_CONTEXTO_POR_DEFECTO,
  GGUF_MAX_TROZO,
  esArchivoGguf,
  parametrosParaWllama,
  plantillaConHerramientas,
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

/** Lo que elige el usuario y sobrevive a recargar. */
export const useGgufAjustes = create<{ contexto: number; setContexto: (n: number) => void }>()(
  persist(
    (set) => ({
      contexto: GGUF_CONTEXTO_POR_DEFECTO,
      setContexto: (contexto) => set({ contexto }),
    }),
    { name: "forja-gguf-v1", storage: createJSONStorage(() => localStorage) }
  )
);

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
  const { Wllama, LoggerWithoutDebug } = await import("@wllama/wllama/esm/index.js");
  // El .wasm lo sirve el propio sitio (el empaquetador lo copia y le pone
  // hash): nada sale a un CDN, y con la PWA instalada funciona sin conexión.
  const wasm = new URL("@wllama/wllama/esm/wasm/wllama.wasm", import.meta.url).href;
  return new Wllama({ default: wasm }, { suppressNativeLog: true, logger: LoggerWithoutDebug });
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
    let aceleracion: "webgpu" | "cpu" = w.isSupportWebGPU() ? "webgpu" : "cpu";
    try {
      await w.loadModel(blobs, { n_ctx: pedido });
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
    const msg = explicarErrorGguf(e, pedido);
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
    return plantillaConHerramientas(instancia?.getChatTemplate());
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

/** Genera con el modelo local. `onData` recibe trozos con el formato exacto
 * del streaming de OpenAI, así que `streamChat` los procesa con el mismo
 * código que a cualquier proveedor: contenido, razonamiento, herramientas,
 * motivo de parada y uso. */
export function generarLocal(
  nombre: string,
  cuerpo: CuerpoOpenAI,
  signal: AbortSignal,
  onData: (chunk: ChatCompletionChunk) => void
): Promise<void> {
  return enCola(async () => {
    if (signal.aborted) throw abortado();
    await cargar(nombre, signal);
    const w = instancia;
    if (!w) throw new Error(explicarErrorGguf(null, nCtxCargado));
    const params = parametrosParaWllama(cuerpo, nCtxCargado);
    try {
      await w.createChatCompletion({
        ...(params as unknown as Parameters<Wllama["createChatCompletion"]>[0]),
        stream: true,
        abortSignal: signal,
        onData: (c: ChatCompletionChunk) => {
          if (c.timings?.predicted_per_second) {
            useGgufEstado.setState({ tokensPorSegundo: c.timings.predicted_per_second });
          }
          onData(conUso(c));
        },
      });
    } catch (e) {
      if (signal.aborted || (e as Error)?.name === "AbortError") throw abortado();
      throw new Error(explicarErrorGguf(e, nCtxCargado));
    }
  });
}
