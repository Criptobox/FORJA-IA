/** FORJA IA — Cliente del motor Tinta.
 *
 * Tinta (la biblioteca de diseño de Estilos: 300+ bloques, 48 plantillas,
 * paletas, tipografías, fondos y el equipo de 8 agentes) corre como una página
 * aparte, `public/tinta/motor.html?motor=1`, dentro de un iframe del MISMO
 * origen. Se le habla por postMessage:
 *
 *   FORJA → Tinta  { tipo: "tinta:pedir", id, accion, datos }
 *   Tinta → FORJA  { tipo: "tinta:respuesta", id, ok, datos | error }
 *   Tinta → FORJA  { tipo: "tinta:listo", api }   (al arrancar)
 *
 * Por qué un iframe y no un import: el motor de Tinta mide el contraste real de
 * cada bloque con el DOM y sigue evolucionando en su propio repositorio; aquí
 * se usa una copia versionada (scripts/tinta-actualizar.mjs). La frontera es
 * esta interfaz, con tipos.
 *
 * Esta parte es pura: el canal (iframe, ventana) se inyecta, así se prueba sin DOM. */

export const TINTA_API = 1;

/** Receta: lo único que escribe el modelo. Bloques del catálogo + estilo. */
export interface RecetaTinta {
  brief: string;
  blocks: { id: string; repeat?: number }[];
  palette?: string;
  font?: string;
  background?: string;
  mode?: "light" | "dark";
  texts?: Record<string, string[]>;
  sector?: string;
}

export interface DibujoTinta {
  /** la app completa en un solo HTML, con todas sus pantallas enlazadas */
  html: string;
  pantallas: { id: string; nombre: string }[];
  /** borrador de Tinta: permite reabrir el diseño en Estilos */
  borrador: unknown;
}

export interface RespuestasTinta {
  ping: { api: number; version: string; bloques: number; plantillas: number };
  instrucciones: { sistema: string; prompt: string };
  leer: { ok: boolean; errores: string[]; avisos: string[]; receta: RecetaTinta | null; correccion: string };
  dibujar: DibujoTinta;
  equipo: DibujoTinta & { modo: "equipo" | "mezcla" | "critico"; plantilla: unknown };
}

export interface DatosTinta {
  ping: Record<string, never>;
  instrucciones: { idea: string; actual?: string };
  leer: { texto: string };
  dibujar: { receta: RecetaTinta; idea?: string };
  equipo: { receta: RecetaTinta; idea?: string; nombre?: string };
}

export type AccionTinta = keyof RespuestasTinta;

export interface CanalTinta {
  enviar(mensaje: { tipo: "tinta:pedir"; id: number; accion: AccionTinta; datos: unknown }): void;
  /** se llama con cada mensaje que llega del motor; devuelve la función para dejar de escuchar */
  escuchar(f: (mensaje: unknown) => void): () => void;
}

export class ErrorTinta extends Error {
  constructor(mensaje: string, readonly cancelado = false) {
    super(mensaje);
    this.name = "ErrorTinta";
  }
}

interface Pendiente {
  resolver: (v: unknown) => void;
  rechazar: (e: unknown) => void;
  limpiar: () => void;
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

export interface ClienteTinta {
  /** espera a que el motor avise de que arrancó (o falla tras `ms`) */
  listo(ms?: number): Promise<void>;
  pedir<A extends AccionTinta>(accion: A, datos: DatosTinta[A], opciones?: { ms?: number; signal?: AbortSignal }): Promise<RespuestasTinta[A]>;
  cerrar(): void;
}

export function crearClienteTinta(canal: CanalTinta, opciones: { ms?: number } = {}): ClienteTinta {
  const porDefecto = opciones.ms ?? 60_000;
  const pendientes = new Map<number, Pendiente>();
  let siguiente = 0;
  let estaListo = false;
  const alListo: (() => void)[] = [];

  const dejar = canal.escuchar((m) => {
    if (!esObjeto(m)) return;
    if (m.tipo === "tinta:listo") {
      if (m.api !== TINTA_API) return; // otra versión del contrato: mejor no hablarle
      estaListo = true;
      alListo.splice(0).forEach((f) => f());
      return;
    }
    if (m.tipo !== "tinta:respuesta" || typeof m.id !== "number") return;
    const p = pendientes.get(m.id);
    if (!p) return;
    pendientes.delete(m.id);
    p.limpiar();
    if (m.ok === true) p.resolver(m.datos);
    else {
      const texto = typeof m.error === "string" && m.error ? m.error : "El motor Tinta devolvió un error";
      p.rechazar(new ErrorTinta(texto, /cancelad/i.test(texto)));
    }
  });

  return {
    listo(ms = 20_000) {
      if (estaListo) return Promise.resolve();
      return new Promise<void>((resolver, rechazar) => {
        const t = setTimeout(() => rechazar(new ErrorTinta("El motor Tinta no arrancó a tiempo")), ms);
        alListo.push(() => {
          clearTimeout(t);
          resolver();
        });
      });
    },
    pedir(accion, datos, op = {}) {
      return new Promise((resolver, rechazar) => {
        if (op.signal?.aborted) return rechazar(new ErrorTinta("Cancelado", true));
        const id = ++siguiente;
        const t = setTimeout(() => {
          pendientes.delete(id);
          rechazar(new ErrorTinta(`El motor Tinta no respondió a «${accion}»`));
        }, op.ms ?? porDefecto);
        const alAbortar = () => {
          if (!pendientes.has(id)) return;
          pendientes.delete(id);
          clearTimeout(t);
          rechazar(new ErrorTinta("Cancelado", true));
        };
        op.signal?.addEventListener("abort", alAbortar, { once: true });
        pendientes.set(id, {
          resolver: resolver as (v: unknown) => void,
          rechazar,
          limpiar: () => {
            clearTimeout(t);
            op.signal?.removeEventListener("abort", alAbortar);
          },
        });
        canal.enviar({ tipo: "tinta:pedir", id, accion, datos });
      });
    },
    cerrar() {
      dejar();
      pendientes.forEach((p) => {
        p.limpiar();
        p.rechazar(new ErrorTinta("Motor cerrado", true));
      });
      pendientes.clear();
    },
  };
}
