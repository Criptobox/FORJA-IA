/** Forja IA — `fetch` hacia el motor OpenCode a través del puente nativo.
 *
 * Dentro de la APK el navegador NO llama al motor: lo hace el lado nativo
 * (`ForjaAndroid.ocHttp`). Así no hay CORS, ni contenido mixto (https → http), ni
 * permiso de red local, y la contraseña del servidor no pasa nunca por
 * JavaScript. Aquí se envuelve el puente en algo con la forma de `fetch`
 * (devuelve una `Response` de verdad, con cuerpo en streaming), de modo que el
 * cliente del motor es el mismo con o sin APK. */
import type { EventoAndroid, EventoOcHttp, PuenteAndroid } from "./plataforma";

export type FetchMotor = (url: string, init?: RequestInit) => Promise<Response>;

type PuenteHttp = Required<Pick<PuenteAndroid, "ocHttp" | "ocCancelar">>;

const SIN_CUERPO = new Set([101, 204, 205, 304]);

function abortado(): Error {
  return typeof DOMException !== "undefined" ? new DOMException("Aborted", "AbortError") : Object.assign(new Error("Aborted"), { name: "AbortError" });
}

/** ¿Esta URL apunta al motor de este mismo móvil (la única que el lado nativo atiende)? */
export function esUrlLocalDelMotor(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "127.0.0.1" || h === "localhost";
  } catch {
    return false;
  }
}

/** `fetch` que pasa por el puente. `escuchar` es `escucharAndroid` (inyectable en pruebas). */
export function crearFetchNativo(puente: PuenteHttp, escuchar: (fn: (e: EventoAndroid) => void) => () => void): FetchMotor {
  const activos = new Map<string, (e: EventoOcHttp) => void>();
  let escuchando = false;
  let contador = 0;
  const asegurarOyente = () => {
    if (escuchando) return;
    escuchando = true;
    escuchar((e) => {
      if (e.tipo === "ocHttp") activos.get(e.id)?.(e);
    });
  };
  const codificador = new TextEncoder();

  return (url, init = {}) =>
    new Promise<Response>((resolver, rechazar) => {
      asegurarOyente();
      const señal = init.signal ?? undefined;
      if (señal?.aborted) return rechazar(abortado());
      const destino = new URL(url);
      const id = `oc${Date.now().toString(36)}${(contador++).toString(36)}`;
      let flujo: ReadableStreamDefaultController<Uint8Array> | null = null;
      let respondido = false;
      let cerrado = false;

      const terminar = (cortar: boolean) => {
        if (cerrado) return;
        cerrado = true;
        activos.delete(id);
        señal?.removeEventListener("abort", alAbortar);
        if (cortar) puente.ocCancelar(id);
      };
      function alAbortar() {
        const e = abortado();
        if (!respondido) rechazar(e);
        else
          try {
            flujo?.error(e);
          } catch {
            /* ya cerrado */
          }
        terminar(true);
      }
      señal?.addEventListener("abort", alAbortar, { once: true });

      const cuerpo = new ReadableStream<Uint8Array>({
        start(c) {
          flujo = c;
        },
        // quien lee dejó de leer: se corta la petición del lado nativo
        cancel() {
          terminar(true);
        },
      });

      activos.set(id, (e) => {
        if (e.fase === "cabecera") {
          respondido = true;
          resolver(new Response(SIN_CUERPO.has(e.status) ? null : cuerpo, { status: e.status }));
        } else if (e.fase === "datos") {
          try {
            flujo?.enqueue(codificador.encode(e.texto));
          } catch {
            /* el lector ya se fue */
          }
        } else if (e.fase === "fin") {
          try {
            flujo?.close();
          } catch {
            /* ya cerrado */
          }
          terminar(false);
        } else {
          const falla = new TypeError(e.mensaje || "Sin conexión con el motor");
          if (!respondido) rechazar(falla);
          else
            try {
              flujo?.error(falla);
            } catch {
              /* ya cerrado */
            }
          terminar(false);
        }
      });

      puente.ocHttp(id, (init.method ?? "GET").toUpperCase(), destino.pathname + destino.search, typeof init.body === "string" ? init.body : null);
    });
}
