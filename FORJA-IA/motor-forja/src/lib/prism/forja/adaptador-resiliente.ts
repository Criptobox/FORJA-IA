/** FORJA IA — El ADAPTADOR RESILIENTE: un solo archivo que resuelve las
 * dos cosas que faltaban cablear — failover y anti-truncamiento.
 *
 * ─── El problema ───
 * El módulo FORJA no sabe de red: recibe una `LlamadaModelo` y llama. Si
 * esa función es tonta (una sola petición, un solo proveedor), entonces:
 *
 *   1. TRUNCAMIENTO: si la petición pide un límite de salida bajo, el
 *      modelo corta el HTML a la mitad — y pasa igual de pagado que de
 *      gratis. Para generación de páginas el Codificador necesita
 *      max_tokens de 16k o más, SIEMPRE.
 *   2. finish_reason: la API dice por qué terminó. Si es "length" en vez
 *      de "stop", la salida quedó corta y hay que pedir CONTINUACIÓN.
 *      El módulo motivo-parada.ts traduce el campo de los tres protocolos.
 *   3. TIMEOUTS de red en generaciones largas: reintento automático con
 *      backoff exponencial (el streaming por onFragmento ya lo soporta
 *      el transporte; aquí no se toca).
 *   4. CAÍDAS puntuales del proveedor: cadena de failover — caído el
 *      primario, el siguiente entra sin que el usuario lo note.
 *
 * ─── La solución ───
 * `crearAdaptadorForja(transporte, opciones)` devuelve una `LlamadaModelo`
 * estándar: el núcleo no cambia nada, la tubería se blinda sola.
 *
 *   Llamada del núcleo
 *        │  (rol incluido: el núcleo pasa `rol` en cada llamada)
 *        ▼
 *   ADAPTADOR ── cadena de proveedores ──┐
 *        │           ↺ backoff en red    │ failover
 *        ▼                               ▼
 *   TRANSPORTE (UNA llamada cruda: chat-client del host, SDK del Lab,
 *               mock de pruebas) → { texto, motivoParada }
 *        │
 *        ▼
 *   ANTI-TRUNCAMIENTO: si `finish_reason = length` → petición de
 *   CONTINUACIÓN (máx. N veces) y concatena. Si sigue corta: el texto
 *   sale igual, marcado como truncado — los chequeosEstaticos y el
 *   Revisor con el bucle-mejora lo detectan y corrigen aguas abajo.
 *
 * Reglas de la casa respetadas: sin red propia, sin React, sin storage,
 * TypeScript estricto, cero dependencias. El transporte es inyectado.
 */

import type { LlamadaModelo, ModeloDeRol, RolForja } from "./tipos";
import { MAX_TOKENS_DEFECTO } from "./tipos";
import {
  esCortePorLongitud,
  motivoDeParada,
  type MotivoParada,
} from "./motivo-parada";
import {
  limpiaContinuacion,
  promptContinuacion,
} from "./continuacion-nucleo";
import type { SaludProveedores } from "./salud-proveedores";

/** Re-exportado: la constante vive en tipos.ts desde v4.2 (núcleo y
 * adaptador la comparten sin ciclos), pero quien la importaba del
 * adaptador sigue sin enterarse del cambio. */
export { MAX_TOKENS_DEFECTO } from "./tipos";

/* ══════════════════════════ transporte ══════════════════════════ */

/** Lo que el transporte debe devolver: el texto y, si puede mirarlo,
 * el motivo de parada CRUDO tal cual llegó del proveedor (aquí se
 * traduce con `motivoDeParada`, no en el transporte). */
export interface RespuestaTransporte {
  texto: string;
  /** finish_reason / stop_reason / finishReason crudo. Opcional: si el
   * transporte no lo mira, no hay continuación automática y la defensa
   * por forma del texto (chequeosEstaticos) toma el relevo. */
  motivoParada?: unknown;
  /** tokens de salida reportados, si el proveedor los manda (telemetría) */
  tokensSalida?: number;
}

/** Firma del transporte: UNA llamada a UN modelo, sin defensas. Es la
 * pieza que cada host implementa con su chat-client o SDK. */
export type TransporteModelo = (args: {
  providerId: string;
  modelId: string;
  system: string;
  user: string;
  temperatura: number;
  /** techo de salida que esta llamada pide al proveedor */
  maxTokens: number;
  /** streaming opcional, mismo contrato que LlamadaModelo */
  onFragmento?: (texto: string) => void;
  /** señal de aborto opcional (el host decide su timeout duro) */
  signal?: AbortSignal;
}) => Promise<RespuestaTransporte>;

/* ══════════════════════════ opciones ══════════════════════════ */

export interface OpcionesAdaptador {
  /** Suplentes por rol para el failover: si el primario (el modelo que
   * llega en cada llamada) cae, el adaptador prueba estos en orden.
   * El primario SIEMPRE es el (providerId, modelId) de la llamada. */
  suplentesPorRol?: Partial<Record<RolForja, ModeloDeRol[]>>;
  /** Suplentes comunes, para llamadas sin rol conocido. */
  suplentesDefecto?: ModeloDeRol[];
  /** techo de salida por rol (defecto: MAX_TOKENS_DEFECTO). Un techo
   *  CONCRETO que llegue en la llamada (args.maxTokens, resuelto por el
   *  núcleo desde ConfigForja.maxTokensPorRol) manda sobre este. */
  maxTokensPorRol?: Partial<Record<RolForja, number>>;
  /** v4.2 — libro de salud de proveedores (salud-proveedores.ts): el
   *  adaptador le anota latencia de éxitos y fallos, y ella REORDENA los
   *  suplentes por evidencia (sanos por latencia, enfriados al final).
   *  El primario nunca se toca: es la elección explícita del usuario.
   *  Crea UNA instancia por proceso (no por llamada) para que acumule. */
  salud?: SaludProveedores;
  /** intentos ANTES de rendirse con un proveedor, en errores de red
   *  (defecto 3: 1 original + 2 reintentos con backoff) */
  intentosRed?: number;
  /** base del backoff exponencial en ms (defecto 600 → ~0.6s, 1.2s, …) */
  backoffBaseMs?: number;
  /** continuaciones máximas por llamada cuando finish_reason = length
   *  (defecto 2; con max_tokens 16k casi nunca hace falta ninguna) */
  maxContinuaciones?: number;
  /** timeout duro opcional por intento en ms (el host decide; el
   *  transporte lo aplica vía signal) */
  timeoutMs?: number;
  /** telemetría opcional: cada decisión del adaptador sale por aquí.
   *  Conectarla a observabilidad.ts del host para registrar reintentos. */
  onEvento?: (evento: EventoAdaptador) => void;
}

/** Telemetría del adaptador. Nada de esto es un error fatal: es la
 * tubería defendiéndose en vivo. `truncado-final` sí avisa que la
 * salida podría llegar incompleta (lo recogen los chequeos estáticos). */
export type EventoAdaptador =
  | {
      tipo: "red-reintento";
      providerId: string;
      modelId: string;
      /** 1-based: reintento 1 = segundo intento del mismo proveedor */
      intento: number;
      esperaMs: number;
      motivo: string;
    }
  | { tipo: "failover"; desde: string; hacia: string; motivo: string }
  | { tipo: "continuacion"; providerId: string; modelId: string; n: number }
  | {
      tipo: "truncado-final";
      providerId: string;
      modelId: string;
      motivo: MotivoParada | null;
    }
  | { tipo: "cadena-agotada"; intentos: string[]; ultimoError: string }
  /** v4.2 — la llamada terminó BIEN: latencia, tokens reportados y cuántas
   *  piezas de continuación costó. Es el evento que el puente de
   *  observabilidad usa para llenar el registro de la generación. */
  | {
      tipo: "exito";
      providerId: string;
      modelId: string;
      ms: number;
      tokensSalida?: number;
      continuaciones: number;
    };

/* ══════════════════════════ utilidades ══════════════════════════ */

/** ¿Este error es de RED (vale reintentar el mismo proveedor) o es un
 * no del proveedor (vale saltar a otro)? Los mensajes varían por
 * runtime; se cubren los patrones comunes de fetch/Node/browsers. */
export function esErrorDeRed(e: unknown): boolean {
  const s = `${e instanceof Error ? e.message : e}`.toLowerCase();
  return (
    /fetch failed|network|socket|econn(reset|refused|aborted)|etimedout|aborted?\b|timeout|timed out|temporarily unavailable|too many requests|rate limit|\b429\b|\b5(0[0234]|1[03]|2[0-9])\b|bad gateway|service unavailable|gateway time/.test(
      s
    ) ||
    e instanceof TypeError || // fetch del navegador lanza TypeError en red rota
    e instanceof DOMException && e.name === "AbortError"
  );
}

/** ¿Este error es fatal en ESTE proveedor (credenciales, petición mal
 * formada)? Reintentar el mismo no va a cambiar nada: directo failover. */
export function esErrorFatal(e: unknown): boolean {
  const s = `${e instanceof Error ? e.message : e}`.toLowerCase();
  return /\b40[013]\b|unauthorized|forbidden|invalid api key|authentication|model not found|not found for|permission/.test(
    s
  );
}

const dormir = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Backoff exponencial + jitter (±30%): 0.6s, 1.2s, 2.4s… sin toro de
 * reintentos sincronizados cuando varios pipelines fallan a la vez. */
function esperaBackoff(baseMs: number, intento: number): number {
  const base = baseMs * Math.pow(2, intento - 1);
  const jitter = base * (Math.random() * 0.6 - 0.3);
  return Math.max(150, Math.round(base + jitter));
}

const clave = (m: ModeloDeRol) => `${m.providerId}:${m.modelId}`;

/* ══════════════════════════ el adaptador ══════════════════════════ */

/**
 * Fábrica del adaptador resiliente. Devuelve una `LlamadaModelo` estándar:
 * el núcleo de FORJA la recibe sin enterarse de que dentro hay cadena de
 * proveedores, backoff y continuación anti-truncamiento.
 *
 * Ejemplo (host FORJA IA):
 * ```ts
 * const transporte: TransporteModelo = async (a) => {
 *   const r = await streamChat({ ...a, maxTokens: a.maxTokens, signal });
 *   return { texto: r.texto, motivoParada: r.motivoParada };
 * };
 * const llamarModelo = crearAdaptadorForja(transporte, {
 *   suplentesPorRol: {
 *     codificador: [
 *       { providerId: "openrouter", modelId: "qwen/qwen3-coder:free" },
 *       { providerId: "zai", modelId: "glm-4.7-flash" },
 *     ],
 *   },
 * });
 * ```
 */
export function crearAdaptadorForja(
  transporte: TransporteModelo,
  opciones: OpcionesAdaptador = {}
): LlamadaModelo {
  const {
    suplentesPorRol,
    suplentesDefecto,
    maxTokensPorRol,
    salud,
    intentosRed = 3,
    backoffBaseMs = 600,
    maxContinuaciones = 2,
    timeoutMs,
    onEvento,
  } = opciones;

  return async (args): Promise<string> => {
    const rol: RolForja = args.rol ?? "codificador";

    // --- la cadena: primario (la llamada manda) + suplentes del rol ---
    const primario: ModeloDeRol = {
      providerId: args.providerId,
      modelId: args.modelId,
    };
    const vistos = new Set([clave(primario)]);
    const suplentes = [
      ...(suplentesPorRol?.[rol] ?? []),
      ...(args.rol ? [] : (suplentesDefecto ?? [])),
    ].filter((m) => {
      const k = clave(m);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
    // v4.2: con libro de salud, los SUPLENTES se reordenan por evidencia
    // (sanos por latencia EWMA, enfriados al final). El primario no se
    // toca: es la elección explícita del usuario/cfg. OJO: se pasa la
    // cadena COMPLETA (primario + suplentes) porque ordenar() respeta el
    // índice 0 — con solo suplentes, el primer suplente quedaría clavado.
    const cadenaPre: ModeloDeRol[] = [primario, ...suplentes];
    const cadena: ModeloDeRol[] = salud ? salud.ordenar(cadenaPre) : cadenaPre;

    // v4.2: el techo CONCRETO de la llamada (resuelto por el núcleo desde
    // ConfigForja.maxTokensPorRol) manda; luego el del adaptador; luego
    // el defecto por rol.
    const maxTokens =
      args.maxTokens ?? maxTokensPorRol?.[rol] ?? MAX_TOKENS_DEFECTO[rol] ?? 8192;

    const errores: string[] = [];

    for (let i = 0; i < cadena.length; i++) {
      const objetivo = cadena[i];
      let ultimoError: unknown = null;
      const t0 = Date.now(); // v4.2: latencia para la salud y el evento exito

      // ── intentos con backoff en ESTE proveedor ─────────────────────
      for (let intento = 0; intento < intentosRed; intento++) {
        if (intento > 0) {
          const esperaMs = esperaBackoff(backoffBaseMs, intento);
          onEvento?.({
            tipo: "red-reintento",
            providerId: objetivo.providerId,
            modelId: objetivo.modelId,
            intento,
            esperaMs,
            motivo: errores.length
              ? errores[errores.length - 1]
              : "reintento",
          });
          await dormir(esperaMs);
        }

        try {
          const señal = timeoutMs
            ? AbortSignal.timeout(timeoutMs)
            : undefined;
          const resp = await transporte({
            providerId: objetivo.providerId,
            modelId: objetivo.modelId,
            system: args.system,
            user: args.user,
            temperatura: args.temperatura,
            maxTokens,
            onFragmento: args.onFragmento,
            signal: señal,
          });

          if (!resp.texto.trim()) {
            throw new Error("El proveedor devolvió una respuesta vacía.");
          }

          // ── ANTI-TRUNCAMIENTO: continuación si finish_reason = length ──
          let texto = resp.texto;
          let motivo: MotivoParada | null = motivoDeParada(resp.motivoParada);
          let tokens = resp.tokensSalida;
          let piezas = 0;

          for (let n = 1; n <= maxContinuaciones; n++) {
            if (!esCortePorLongitud(motivo)) break;
            onEvento?.({
              tipo: "continuacion",
              providerId: objetivo.providerId,
              modelId: objetivo.modelId,
              n,
            });
            const señalCont = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
            const tCont = Date.now();
            const cont = await transporte({
              providerId: objetivo.providerId,
              modelId: objetivo.modelId,
              system: args.system,
              user: promptContinuacion(texto),
              temperatura: args.temperatura,
              maxTokens,
              onFragmento: args.onFragmento
                ? (frag) => args.onFragmento?.(`\n${frag}`)
                : undefined,
              signal: señalCont,
            });
            if (cont.texto.trim()) {
              texto = `${texto}\n${limpiaContinuacion(cont.texto)}`;
              motivo = motivoDeParada(cont.motivoParada);
              tokens = (tokens ?? 0) + (cont.tokensSalida ?? 0);
              piezas += 1;
              salud?.anotarExito(clave(objetivo), Date.now() - tCont);
            } else {
              break; // continuación vacía: no insistir
            }
          }

          if (esCortePorLongitud(motivo)) {
            // Se agotó el presupuesto de continuaciones. El texto sale
            // igual: aguas abajo los chequeosEstaticos detectan etiquetas
            // sin cerrar y el Revisor con el bucle-mejora manda corregir.
            // Un corte a medias NO llega roto al usuario: llega detectado.
            // v4.2: si aún así quedó roto ESTRUCTURALMENTE, el núcleo tiene
            // su propio cinturón (continuacion-nucleo.ts) que lo cierra.
            onEvento?.({
              tipo: "truncado-final",
              providerId: objetivo.providerId,
              modelId: objetivo.modelId,
              motivo,
            });
          }

          // v4.2: la salud aprende de la evidencia y la telemetría recibe
          // el éxito completo (latencia + tokens + piezas).
          const msTotal = Date.now() - t0;
          salud?.anotarExito(clave(objetivo), msTotal);
          onEvento?.({
            tipo: "exito",
            providerId: objetivo.providerId,
            modelId: objetivo.modelId,
            ms: msTotal,
            tokensSalida: tokens,
            continuaciones: piezas,
          });
          return texto;
        } catch (e) {
          ultimoError = e;
          const msError = Date.now() - t0;
          salud?.anotarFallo(
            clave(objetivo),
            msError,
            e instanceof Error ? e.message : String(e)
          );
          errores.push(
            `${clave(objetivo)}: ${e instanceof Error ? e.message : String(e)}`
          );
          const red = esErrorDeRed(e);
          const fatal = esErrorFatal(e);
          // red → reintentar el mismo (queda intento por gastar);
          // fatal o no-red → el mismo no va a cambiar de opinión: salir.
          if (!(red && intento < intentosRed - 1)) break;
        }
      }

      // ── este proveedor cayó: failover al siguiente ─────────────────
      const siguiente = cadena[i + 1];
      if (siguiente) {
        onEvento?.({
          tipo: "failover",
          desde: clave(objetivo),
          hacia: clave(siguiente),
          motivo:
            ultimoError instanceof Error
              ? ultimoError.message
              : String(ultimoError ?? "desconocido"),
        });
      }
    }

    // ── la cadena entera se agotó: error con la historia completa ──────
    const resumen = errores.join(" · ") || "sin detalle";
    onEvento?.({ tipo: "cadena-agotada", intentos: errores, ultimoError: resumen });
    throw new Error(
      `FORJA IA: toda la cadena de modelos falló (${cadena.length} proveedor/es). Último detalle: ${resumen}`
    );
  };
}

/* ══════════════════════════ continuación ══════════════════════════ */

/** El prompt de continuación y su limpieza viven desde v4.2 en
 * `continuacion-nucleo.ts` (compartidos con el segundo cinturón del
 * núcleo). Aquí solo se consumen: `promptContinuacion(texto)` arma el
 * mensaje y `limpiaContinuacion(pieza)` deja el pegado limpio. */

/** Conveniencia: construye suplentesPorRol a partir de las sugerencias
 * de EQUIPO_FORJA, excluyendo el primario de cada rol. Útil cuando el
 * host no tiene todavía su propia cadena configurada. */
export function cadenaDesdeSugerencias(
  sugerenciasPorRol: Record<RolForja, { providerId: string; modelId: string }[]>
): Partial<Record<RolForja, ModeloDeRol[]>> {
  const salida: Partial<Record<RolForja, ModeloDeRol[]>> = {};
  for (const [rol, lista] of Object.entries(sugerenciasPorRol) as [
    RolForja,
    { providerId: string; modelId: string }[]
  ][]) {
    salida[rol] = lista.map((m) => ({ providerId: m.providerId, modelId: m.modelId }));
  }
  return salida;
}
