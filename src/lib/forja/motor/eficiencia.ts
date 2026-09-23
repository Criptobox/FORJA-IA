/** FORJA IA — CAPA DE EFICIENCIA (v4.4): el pegamento que hace que TODAS las
 * llamadas del pipeline respeten presupuesto, caché y ROI sin cambiar al
 * núcleo ni al adaptador.
 *
 * ─── Idea central ───
 * `LlamadaModelo` es la única puerta por la que pasa dinero (tokens). Si
 * esa puerta se vuelve EFICIENTE, todo el sistema lo es:
 *
 *   llamarModelo(args)
 *     ↓
 *   1. CACHÉ L1 (respuesta exacta)   → acierto: 0 tokens, 0 latencia
 *   2. PRESUPUESTO (autorizar)       → denegado: no se llama, degrada el
 *                                      paso con dignidad (cupo agotado)
 *   3. maxTokens = lo que la fase
 *      puede pagar (estimar)         → nunca pedir lo impagable
 *   4. LLAMADA REAL (adaptador v4.1) → reintentos/failover/continuación
 *   5. REGISTRO (presupuesto.gastar + ROI + estimación de tokens)
 *
 * Los tres sistemas del plan quedan ENCADENADOS en un único envoltorio:
 * multilevel cache (§24) · token budget (§25) · token ROI (§28). El
 * ContextCompiler (§23) y el Early Exit + Router (§22/26) se usan en el
 * núcleo, donde se conoce la intención de cada paso.
 *
 * Compatibilidad: el envoltorio ES una LlamadaModelo (misma firma). Cualquier
 * host que ya pasa su adaptador a ejecutarMvpForja / ejecutarForja puede
 * envolverlo aquí antes de inyectarlo — o usar DepsMvp.eficiencia y que el
 * núcleo lo monte solo.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { LlamadaModelo, RolForja } from "./tipos";
import { MAX_TOKENS_DEFECTO } from "./tipos";
import type { PresupuestoGlobal, FasePresupuesto } from "./presupuesto-tokens";
import type { LibroROI, OperacionROI } from "./token-roi";
import type { crearCacheMultinivel } from "./cache-multinivel";
import { NIVEL, claveRespuesta } from "./cache-multinivel";

/* -------------------------------- tipos ------------------------------------ */

type CacheMulti = ReturnType<typeof crearCacheMultinivel>;

/** Opciones del envoltorio eficiente. */
export interface OpcionesEficiencia {
  presupuesto: PresupuestoGlobal;
  cache: CacheMulti;
  roi: LibroROI;
  /** ¿usar la caché L1 de respuestas exactas? (defecto true; desactívala
   * para forzar regeneración creativa pese al presupuesto) */
  cacheL1?: boolean;
  /** aviso de llamada denegada por presupuesto (para la traza/UI) */
  onDenegada?: (rol: string, motivo: string) => void;
  /** aviso de acierto de caché (para contadores de la UI) */
  onCacheHit?: (nivel: number, clave: string) => void;
}

export interface Eficiencia {
  /** la LlamadaModelo eficiente: inyéctala donde iría el adaptador */
  llamarModelo: LlamadaModelo;
}

/* ------------------------------ mapeo rol→fase ----------------------------- */

/** Cada rol del equipo paga de una fase del presupuesto. */
export function faseDeRol(rol: RolForja | undefined): FasePresupuesto {
  switch (rol) {
    case "disenador":
      return "planning";
    case "codificador":
      return "implementation";
    case "revisor":
      return "qa";
    default:
      return "planning";
  }
}

/** Operación ROI según el rol y el sistema (system prompt) que pide. */
export function operacionDeRol(rol: RolForja | undefined, system: string): OperacionROI {
  const s = (system ?? "").toLowerCase();
  if (/arena|jueces|juez /.test(s)) return "jueces";
  if (/fusi[óo]n|director final/.test(s)) return "fusion";
  if (/direcciones|arquetipos/.test(s)) return "direcciones";
  if (/adn/.test(s) && /define/.test(s)) return "adn";
  if (rol === "codificador") return "codificador";
  if (rol === "revisor") return "revisor";
  if (rol === "disenador") return "ficha";
  return "otra";
}

/* ------------------------------- estimación -------------------------------- */

/** Estimación honesta de tokens de salida: ~4 caracteres por token en
 * código/markup (medida estable para HTML/CSS/ES). No es la factura del
 * proveedor: es el PRESUPUESTO interno, que decide ANTES de llamar. */
export function estimarTokensSalida(texto: string): number {
  return Math.ceil((texto?.length ?? 0) / 4);
}

/* ------------------------------- el envoltorio ----------------------------- */

/** Envuelve una LlamadaModelo base (el adaptador-resiliente) con:
 * caché multinivel + presupuesto + ROI. NUNCA lanza: si el envoltorio
 * falla por algo raro, degrada a la llamada base (mejor caro que roto). */
export function crearLlamadaEficiente(base: LlamadaModelo, opts: OpcionesEficiencia): Eficiencia {
  const usaL1 = opts.cacheL1 !== false;

  const eficiente: LlamadaModelo = async (args) => {
    try {
      const fase = faseDeRol(args.rol);
      const operacion = operacionDeRol(args.rol, args.system);
      const claveL1 = claveRespuesta({
        system: args.system,
        user: args.user,
        rol: args.rol,
        temperatura: args.temperatura,
        modelo: `${args.providerId}:${args.modelId}`,
      });

      /* 1 · caché L1: la misma llamada no paga dos veces */
      if (usaL1) {
        const hit = opts.cache.obtener(NIVEL.respuesta, claveL1);
        if (hit != null) {
          opts.cache.guardar(NIVEL.respuesta, claveL1, hit); // toque LRU
          opts.onCacheHit?.(NIVEL.respuesta, claveL1);
          opts.roi.registrar({
            operacion,
            rol: args.rol ?? "-",
            modelo: `${args.providerId}:${args.modelId}`,
            tokens: 0,
            llamadas: 0,
            scoreAntes: 0,
            scoreDespues: 0,
            deCache: true,
          });
          return hit;
        }
      }

      /* 2 · presupuesto: ¿puede esta fase pagar la llamada? */
      const techo = args.maxTokens ?? MAX_TOKENS_DEFECTO[args.rol ?? "disenador"];
      const estimado = Math.min(techo, opts.presupuesto.estimar(fase, techo));
      const autor = opts.presupuesto.autorizar(fase, estimado);
      if (!autor.ok) {
        opts.onDenegada?.(args.rol ?? "-", autor.motivo);
        // degradación con dignidad: salida vacía, el paso usa su respaldo
        return "";
      }

      /* 3+4 · llamada real con techo PAGABLE (no el máximo del rol si el
       * presupuesto no llega: pedir lo impagable es pagar un corte) */
      const salida = await base({
        ...args,
        maxTokens: Math.min(args.maxTokens ?? techo, estimado),
      });

      /* 5 · registro: presupuesto + ROI (tokens estimados del output real) */
      const tokens = estimarTokensSalida(salida);
      opts.presupuesto.gastar(fase, tokens);
      if (salida && usaL1) {
        opts.cache.guardar(NIVEL.respuesta, claveL1, salida);
      }
      opts.roi.registrar({
        operacion,
        rol: args.rol ?? "-",
        modelo: `${args.providerId}:${args.modelId}`,
        tokens,
        llamadas: salida ? 1 : 0,
        scoreAntes: 0,
        scoreDespues: 0,
      });
      return salida;
    } catch {
      // el envoltorio jamás rompe el pipeline: la base manda
      return base(args);
    }
  };

  return { llamarModelo: eficiente };
}
