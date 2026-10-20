/** Forja IA — Presupuesto en dinero: mensual, diario y por tarea (Plan Maestro 2026 §10, §35, §58).
 *
 * `gasto.ts` pone un techo de LLAMADAS de pago al día. Sirve para parar un
 * bucle, pero no responde a la pregunta que se hace quien paga: «¿cuánto
 * llevo este mes y cuánto me queda?». Eso ya se puede responder de verdad,
 * porque `precios.ts` convierte en dinero los tokens que el propio proveedor
 * reporta. Aquí se lleva la cuenta y se pone el límite:
 *
 *   MENSUAL = 5 $ · DIARIO = 1 $ · POR TAREA = 0,50 $   (de fábrica, del plan)
 *
 * Al llegar a cualquiera de los tres, FORJA pasa a SOLO GRATIS: las llamadas
 * a modelos de pago se cortan antes de salir y Auto / FORJA WEB los quitan de
 * su cadena. Los modelos gratis siguen funcionando.
 *
 * ——— Lo que se promete y lo que no ———
 *
 *  · **Solo se cuenta dinero medido**: tokens del proveedor × precio fechado
 *    del catálogo. Una llamada sin cuenta del proveedor o sin precio conocido
 *    no suma aquí (queda contada en `sinPrecio`) y para esas sigue valiendo el
 *    techo de llamadas de `gasto.ts`.
 *  · **El corte es antes de la llamada siguiente**, no a mitad de una: el
 *    importe de una llamada solo se sabe cuando termina. Así que la llamada que
 *    cruza el límite se paga entera, y es la última. Se dice así en Ajustes.
 *  · «Tarea» es un envío tuyo con todo lo que desencadena: failover,
 *    continuaciones, revisiones y los ejecutores del orquestador.
 *
 * Funciones puras + almacenamiento inyectable: se prueba sin navegador.
 */
import { diaDe } from "./gasto";

export interface LimitesDinero {
  /** USD al mes natural; `null` = sin límite */
  mensual: number | null;
  /** USD al día natural; `null` = sin límite */
  diario: number | null;
  /** USD por tarea (un envío del usuario); `null` = sin límite */
  tarea: number | null;
}

/** Los números del plan (§58). Pensados para quien empieza con 5 $ de
 *  DeepSeek: suficiente para refuerzos, imposible de quemar en una tarde. */
export const LIMITES_POR_DEFECTO: LimitesDinero = { mensual: 5, diario: 1, tarea: 0.5 };

/** Por encima de esto un límite ya no protege de nada. */
export const LIMITE_MAXIMO_USD = 10_000;

/** A partir de qué fracción de un límite se avisa. */
export const AVISAR_DESDE = 0.8;

export interface Libro {
  /** gasto medido por día natural (`YYYY-MM-DD` local) */
  dias: Record<string, number>;
  /** llamadas de pago de las que no se pudo saber el importe, por día */
  sinPrecio: Record<string, number>;
  /** la tarea en curso */
  tarea: { id: string; usd: number } | null;
}

export const LIBRO_VACIO: Libro = { dias: {}, sinPrecio: {}, tarea: null };

/** Días que se conservan: el mes en curso y el anterior, con margen. */
const DIAS_CONSERVADOS = 70;

function normalizarUno(v: unknown, porDefecto: number | null): number | null {
  if (v === null) return null;
  if (v === undefined) return porDefecto;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return porDefecto;
  return Math.min(LIMITE_MAXIMO_USD, Math.round(n * 100) / 100);
}

/** Sanea lo que venga de los ajustes. `null` en un campo = sin ese límite. */
export function normalizarLimites(v: unknown): LimitesDinero {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof LimitesDinero, unknown>>;
  return {
    mensual: normalizarUno(o.mensual, LIMITES_POR_DEFECTO.mensual),
    diario: normalizarUno(o.diario, LIMITES_POR_DEFECTO.diario),
    tarea: normalizarUno(o.tarea, LIMITES_POR_DEFECTO.tarea),
  };
}

export function gastoDelDia(libro: Libro, ahora: number): number {
  return libro.dias[diaDe(ahora)] ?? 0;
}

export function gastoDelMes(libro: Libro, ahora: number): number {
  const mes = diaDe(ahora).slice(0, 7);
  return Object.entries(libro.dias)
    .filter(([d]) => d.startsWith(mes))
    .reduce((a, [, usd]) => a + usd, 0);
}

function podar<T>(registro: Record<string, T>, ahora: number): Record<string, T> {
  const limite = diaDe(ahora - DIAS_CONSERVADOS * 86_400_000);
  return Object.fromEntries(Object.entries(registro).filter(([d]) => d >= limite));
}

/** Empieza una tarea nueva: el contador por tarea vuelve a cero. */
export function iniciarTarea(libro: Libro, id: string): Libro {
  return { ...libro, tarea: { id, usd: 0 } };
}

/** Suma un importe medido. `usd === null` = llamada de pago sin importe. */
export function anotarGasto(libro: Libro, usd: number | null, ahora: number): Libro {
  const dia = diaDe(ahora);
  if (usd == null) {
    return { ...libro, sinPrecio: podar({ ...libro.sinPrecio, [dia]: (libro.sinPrecio[dia] ?? 0) + 1 }, ahora) };
  }
  const v = Math.max(0, usd);
  return {
    dias: podar({ ...libro.dias, [dia]: (libro.dias[dia] ?? 0) + v }, ahora),
    sinPrecio: podar(libro.sinPrecio, ahora),
    tarea: libro.tarea ? { ...libro.tarea, usd: libro.tarea.usd + v } : null,
  };
}

export type CualLimite = "mensual" | "diario" | "tarea";

export interface VeredictoDinero {
  /** ¿puede salir otra llamada de pago? */
  ok: boolean;
  /** el límite que corta (o el más cercano si se avisa) */
  cual?: CualLimite;
  /** ¿se ha pasado el `AVISAR_DESDE` de algún límite sin llegar? */
  avisar: boolean;
  motivo?: string;
}

const NOMBRE: Record<CualLimite, string> = {
  mensual: "mensual",
  diario: "de hoy",
  tarea: "de esta tarea",
};

export function fmtUsd(n: number): string {
  return `${n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 3 : 2 })} $`;
}

/** ¿Puede salir otra llamada de pago? No muta nada. */
export function veredictoDinero(libro: Libro, limites: LimitesDinero, ahora: number): VeredictoDinero {
  const usos: Array<[CualLimite, number, number | null]> = [
    ["tarea", libro.tarea?.usd ?? 0, limites.tarea],
    ["diario", gastoDelDia(libro, ahora), limites.diario],
    ["mensual", gastoDelMes(libro, ahora), limites.mensual],
  ];
  for (const [cual, usado, limite] of usos) {
    if (limite == null) continue;
    if (usado >= limite) {
      return {
        ok: false,
        cual,
        avisar: false,
        motivo:
          `Presupuesto ${NOMBRE[cual]} alcanzado (${fmtUsd(usado)} de ${fmtUsd(limite)}): FORJA pasa a solo modelos gratis. ` +
          "Es un límite tuyo; cámbialo en Ajustes → Chat → Presupuesto.",
      };
    }
  }
  const cerca = usos.find(([, usado, limite]) => limite != null && limite > 0 && usado >= limite * AVISAR_DESDE);
  return { ok: true, avisar: !!cerca, ...(cerca ? { cual: cerca[0] } : {}) };
}

/** Línea corta para la interfaz: «Mes 2,13 $ de 5,00 $ · hoy 0,40 $ de 1,00 $». */
export function resumenPresupuesto(libro: Libro, limites: LimitesDinero, ahora: number): string {
  const parte = (etq: string, usado: number, limite: number | null) =>
    `${etq} ${fmtUsd(usado)}${limite == null ? "" : ` de ${fmtUsd(limite)}`}`;
  const sin = libro.sinPrecio[diaDe(ahora)] ?? 0;
  return [
    parte("Mes", gastoDelMes(libro, ahora), limites.mensual),
    parte("hoy", gastoDelDia(libro, ahora), limites.diario),
    ...(sin ? [`${sin} llamada${sin === 1 ? "" : "s"} de pago hoy sin importe conocido`] : []),
  ].join(" · ");
}

/* ------------------------------------------------------------------ */
/* persistencia                                                       */
/* ------------------------------------------------------------------ */

const CLAVE = "forja-presupuesto-v1";

function storage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* bloqueado */
  }
  return null;
}

/** Copia en memoria por si no hay localStorage (tests, modo privado). */
let enMemoria: Libro = LIBRO_VACIO;

export function leerLibro(st: Storage | null = storage()): Libro {
  if (!st) return enMemoria;
  try {
    const v = JSON.parse(st.getItem(CLAVE) ?? "null") as Partial<Libro> | null;
    if (!v || typeof v !== "object") return LIBRO_VACIO;
    return {
      dias: v.dias && typeof v.dias === "object" ? v.dias : {},
      sinPrecio: v.sinPrecio && typeof v.sinPrecio === "object" ? v.sinPrecio : {},
      tarea: v.tarea && typeof v.tarea.id === "string" ? { id: v.tarea.id, usd: Number(v.tarea.usd) || 0 } : null,
    };
  } catch {
    return LIBRO_VACIO;
  }
}

export function guardarLibro(libro: Libro, st: Storage | null = storage()): void {
  enMemoria = libro;
  if (!st) return;
  try {
    st.setItem(CLAVE, JSON.stringify(libro));
  } catch {
    /* lleno o bloqueado: la copia en memoria sigue valiendo esta sesión */
  }
}
