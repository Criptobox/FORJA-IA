/** FORJA IA — PRESUPUESTO GLOBAL DE TOKENS (v4.4, sección 25 del plan).
 *
 * ─── El problema ───
 * Hasta v4.2 el techo era POR LLAMADA (maxTokensPorRol): limita cuánto
 * puede SOLICITAR una llamada, pero nada dice cuántas llamadas merece la
 * generación. Un perfil ARENA puede gastar 25 llamadas en una petición de
 * 3 líneas; un bucle de mejora puede gastar su 3ª iteración ganando 1 punto.
 *
 * ─── La solución ───
 * Un presupuesto GLOBAL dinámico para toda la generación, repartido por
 * fase (la lista exacta del plan):
 *
 *   Global Budget
 *   ├── planning    (ADN, direcciones, ficha — pensar ANTES de construir)
 *   ├── design      (design system, maqueta)
 *   ├── implementation (Codificador: la fase más cara)
 *   ├── qa          (Revisor, jueces, anti-genérico semántico)
 *   ├── repair      (bucle de mejora, rondas de corrección)
 *   └── reserve     (intocable hasta el cierre: continuaciones, failover)
 *
 * Cuánto repartir depende de la COMPLEJIDAD estimada de la petición
 * (determinista: longitud, si es edición, palabras de ambigüedad, perfil
 * de coste). El presupuesto NO se recarga: gastado es gastado. Lo único
 * que puede pedir dinero extra es una CONTINUACIÓN anti-truncamiento
 * (v4.2) — robar de reserve, jamás de las otras fases.
 *
 * El que decide con esto es el NÚCLEO: `autorizar(fase)` antes de llamar,
 * `gastar()` después. Si una fase se queda sin cupo, la generación DEGRADA
 * con dignidad (salta la fase, usa deterministic patch, entrega lo que hay)
 * — nunca se queda a medias por corte de max_tokens.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* -------------------------------- tipos ------------------------------------ */

export type FasePresupuesto =
  | "planning"
  | "design"
  | "implementation"
  | "qa"
  | "repair"
  | "reserve";

/** Las 6 fases del plan, en el orden en que el pipeline las toca. */
export const FASES: readonly FasePresupuesto[] = [
  "planning",
  "design",
  "implementation",
  "qa",
  "repair",
  "reserve",
];

/** Un presupuesto en TOKENS DE SALIDA estimados (la moneda que de verdad
 * cuesta: los de entrada se abaratan con el compilador de contexto). */
export interface RepartoPresupuesto {
  planning: number;
  design: number;
  implementation: number;
  qa: number;
  repair: number;
  reserve: number;
}

/** Resultado de autorizar una llamada. */
export interface Autorizacion {
  ok: boolean;
  /** si !ok, por qué (para la traza y la UI) */
  motivo: string;
  /** cupo que queda en la fase tras esta autorización */
  restanteFase: number;
}

/* ------------------------- complejidad de la petición ---------------------- */

export type Complejidad = "simple" | "media" | "compleja";

/** Señales de ambigüedad/alcance en el mensaje (determinista, ES+EN). */
const RX_AMBIGUO =
  /\b(varias|multiples|múltiples|todo|completo|integral|plataforma|sistema|tienda|dashboard|galeria|galería|blog|paginas|páginas|seccion(es)?|animaciones?|3d|webgl|interactiva)\b/i;

/** Complejidad estimada de una petición, SIN modelo:
 *  · simple — petición corta, una página directa, sin señales de alcance
 *  · media  — la mayoría de los casos
 *  · compleja — edición sobre código existente, alcance múltiple o mensaje
 *    largo (el usuario sabe lo que quiere y acertar eso cuesta más llamadas). */
export function complejidadDe(mensaje: string, esEdicion: boolean): Complejidad {
  const m = (mensaje ?? "").trim();
  let puntos = 0;
  if (m.length > 240) puntos += 2;
  else if (m.length > 90) puntos += 1;
  const coincidencias = m.match(new RegExp(RX_AMBIGUO.source, "gi"));
  if (coincidencias) puntos += Math.min(3, coincidencias.length);
  if (esEdicion) puntos += 2;
  if (puntos >= 4) return "compleja";
  if (puntos >= 2) return "media";
  return "simple";
}

/* ------------------------------- reparto base ------------------------------ */

/** Reparto en unidades relativas (suman 100). La implementación manda: es
 * la fase que produce el HTML completo (el plan: «la llamada más cara»). */
const REPARTO_RELATIVO: Record<FasePresupuesto, number> = {
  planning: 10,
  design: 8,
  // v4.7 — la implementación sube de 38 a 46. El detalle de una página se
  // paga en tokens de salida: con el reparto anterior, una petición media
  // dejaba ~12.900 tokens para TODA la página y el modelo recortaba
  // contenido (lo invisible) antes que CSS (lo que se nota).
  implementation: 46,
  qa: 12,
  repair: 16,
  reserve: 8,
};

/** Presupuesto TOTAL por complejidad (tokens de salida estimados). Calibrado
 * con los techos por rol de v4.2: una generación simple no necesita el
 * total de una compleja; el ahorro aquí es el objetivo de la v4.4. */
const TOTAL_POR_COMPLEJIDAD: Record<Complejidad, number> = {
  // v4.7 — recalibrado hacia arriba: los techos de v4.4 se fijaron para
  // abaratar, y lo consiguieron a costa de páginas finas. El ahorro real
  // sigue viniendo de la caché, del early exit y de los parches gratis
  // (que no han cambiado), no de entregar media página.
  simple: 32_000,
  media: 56_000,
  compleja: 88_000,
};

/** Ajuste por perfil de coste: FREE recorta (menos visiones, menos bucle),
 * LAB conserva el presupuesto completo. */
const FACTOR_PERFIL: Record<string, number> = {
  FREE: 0.65,
  SMART: 0.85,
  ARENA: 1,
  LAB: 1.15,
};

/** Presupuesto global por defecto para una petición. */
export function presupuestoDefecto(
  complejidad: Complejidad,
  perfil: string
): RepartoPresupuesto {
  const total =
    TOTAL_POR_COMPLEJIDAD[complejidad] *
    (FACTOR_PERFIL[perfil] ?? 0.85);
  const out = {} as RepartoPresupuesto;
  let asignado = 0;
  for (const fase of FASES) {
    const v = Math.round((total * REPARTO_RELATIVO[fase]) / 100 / 256) * 256;
    out[fase] = v;
    asignado += v;
  }
  // el redondeo se lo queda reserve (nunca sobreasignar)
  out.reserve += Math.max(0, Math.round(total) - asignado);
  return out;
}

/* ------------------------------ el presupuesto ----------------------------- */

export interface EstadoFase {
  cupo: number;
  gastado: number;
}

export interface InformePresupuesto {
  total: number;
  gastado: number;
  restante: number;
  porFase: Record<FasePresupuesto, EstadoFase>;
  /** llamadas autorizadas / denegadas / servidas de caché */
  llamadasOk: number;
  llamadasDenegadas: number;
  /** nº de veces que se robó de reserve (continuaciones) */
  rescates: number;
  /** uso del total (0..1); >0.9 la generación está en reserva */
  uso: number;
}

/** El presupuesto vivo de UNA generación. Crearlo es barato; no comparte
 * estado global (cada ejecución del núcleo crea el suyo). */
export interface PresupuestoGlobal {
  readonly total: number;
  /** ¿puede la fase gastar `tokens` más? No muta nada. */
  autorizar(fase: FasePresupuesto, tokens: number): Autorizacion;
  /** registra gasto real (lo que devolvió el proveedor). Roba de reserve
   * si la fase se pasó (con rescate contado). */
  gastar(fase: FasePresupuesto, tokens: number): void;
  /** el estimado que el núcleo usa antes de llamar (maxTokens de la llamada) */
  estimar(fase: FasePresupuesto, techoRol: number): number;
  /** informe para observabilidad/UI */
  informe(): InformePresupuesto;
  /** línea una-línea para la traza */
  resumen(): string;
}

/** Crea el presupuesto de una generación. */
export function crearPresupuesto(
  reparto: RepartoPresupuesto,
  perfil: string
): PresupuestoGlobal {
  const porFase = {} as Record<FasePresupuesto, EstadoFase>;
  for (const f of FASES) porFase[f] = { cupo: Math.max(0, reparto[f]), gastado: 0 };
  const total = FASES.reduce((s, f) => s + porFase[f].cupo, 0);
  const counters = { llamadasOk: 0, llamadasDenegadas: 0, rescates: 0 };
  const esLab = perfil === "LAB" || perfil === "ARENA";

  const restanteDe = (f: FasePresupuesto): number =>
    Math.max(0, porFase[f].cupo - porFase[f].gastado);

  return {
    total,
    autorizar(fase, tokens) {
      const restante = restanteDe(fase);
      // LAB/ARENA tienen margen de maniobra: pueden pedir hasta 25% extra
      // de su fase (los jueces y la fusión son su razón de ser).
      const margen = esLab ? Math.round(porFase[fase].cupo * 0.25) : 0;
      if (tokens <= restante + margen) {
        return { ok: true, motivo: "", restanteFase: restante - tokens };
      }
      counters.llamadasDenegadas++;
      return {
        ok: false,
        motivo:
          `presupuesto ${fase}: pide ${tokens}, quedan ${restante}` +
          (margen ? ` (+margen ${margen})` : ""),
        restanteFase: restante,
      };
    },
    gastar(fase, tokens) {
      const t = Math.max(0, Math.round(tokens || 0));
      porFase[fase].gastado += t;
      const exceso = porFase[fase].gastado - porFase[fase].cupo;
      if (exceso > 0 && restanteDe("reserve") > 0) {
        // rescate: el exceso roba de reserve (continuaciones, failover)
        const robo = Math.min(exceso, restanteDe("reserve"));
        porFase.reserve.gastado += robo;
        counters.rescates++;
      }
      counters.llamadasOk++;
    },
    estimar(fase, techoRol) {
      // pide lo que la fase puede pagar SIN pasarse del techo del rol:
      // pedir más de lo pagable es cómo se paga un corte gratis.
      const restante = restanteDe(fase);
      if (restante <= 0) return 256; // mínimo vital (MIN_TOKENS_ROL)
      return Math.max(256, Math.min(techoRol, restante));
    },
    informe() {
      const gastado = FASES.reduce((s, f) => s + porFase[f].gastado, 0);
      return {
        total,
        gastado,
        restante: Math.max(0, total - gastado),
        porFase: JSON.parse(JSON.stringify(porFase)),
        ...counters,
        uso: total ? Math.min(1, gastado / total) : 0,
      };
    },
    resumen() {
      const i = (function () {
        const gastado = FASES.reduce((s, f) => s + porFase[f].gastado, 0);
        return { gastado };
      })();
      const pct = total ? Math.round((i.gastado / total) * 100) : 0;
      return `presupuesto ${i.gastado}/${total} tok (${pct}%) · ok ${counters.llamadasOk} · denegadas ${counters.llamadasDenegadas}` +
        (counters.rescates ? ` · rescates ${counters.rescates}` : "");
    },
  };
}

/** Reparto para una petición concreta (azúcar del núcleo). */
export function presupuestoPara(
  mensaje: string,
  esEdicion: boolean,
  perfil: string
): { complejidad: Complejidad; reparto: RepartoPresupuesto } {
  const complejidad = complejidadDe(mensaje, esEdicion);
  return { complejidad, reparto: presupuestoDefecto(complejidad, perfil) };
}
