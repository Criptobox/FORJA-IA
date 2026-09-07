/** Prism AI — La ficha de cada modelo: en qué es bueno y con qué se atraganta.
 *
 * Prism ya sabía cosas sueltas de cada modelo y las guardaba en tres sitios
 * distintos: `modelos-rotos` (los que el proveedor no reconoce), `limites-
 * medidos` (lo que demostró que no le cabe) y `usage` (cuántas veces respondió,
 * cuánto tardó y en qué encargos). Cada uno servía para una decisión interna y
 * ninguno se podía LEER.
 *
 * Así que pasaba lo que el usuario contó: «hay modelos que me los da como que
 * están buenos y al final no funcionan». La app lo sabía —lo había medido esa
 * misma mañana— y no lo decía en ninguna parte antes de elegir.
 *
 * Esto lo junta en una ficha por modelo. Con la regla de siempre: lo que no se
 * ha medido no se afirma. Un modelo sin historial sale como «sin probar», que
 * es información, no como «fiable», que sería mentira.
 */
import type { TaskKind } from "./task-router";
import type { ModelUsage } from "./usage";
import type { ModeloRoto } from "./modelos-rotos";
import type { LimiteMedido } from "./limites-medidos";
import { VIGENCIA_MS } from "./limites-medidos";
import { ETIQUETA_TAREA } from "./gasto-modelos";
import { splitModelKey } from "./types";

/** Con menos de esto, el porcentaje de acierto es ruido: dos llamadas y un
 * fallo darían «50 % fiable», que no significa nada. Se enseña el recuento
 * crudo en su lugar. */
export const MIN_LLAMADAS_FIABLES = 5;

export interface PerfilTarea {
  tarea: TaskKind;
  llamadas: number;
  ok: number;
  /** null mientras no haya llamadas suficientes para que signifique algo */
  fiabilidad: number | null;
  msMedio: number | null;
}

export interface PerfilModelo {
  modelKey: string;
  providerId: string;
  modelId: string;
  llamadas: number;
  ok: number;
  fallos: number;
  /** ok/llamadas, o null si no hay historial suficiente */
  fiabilidad: number | null;
  msMedio: number | null;
  /** el proveedor no lo reconoce: es lo más grave que puede decirse de él */
  roto: ModeloRoto | null;
  /** techo demostrado de entrada, en tokens. `limite` es el número que dio el
   * proveedor; `rechazado`, lo que se le pidió cuando dijo que no */
  techo: LimiteMedido | null;
  /** los topes por minuto se reponen: una medición vieja ya no manda */
  techoVigente: boolean;
  /** en qué encargos se ha usado, del más usado al menos */
  tareas: PerfilTarea[];
  ultimoUso: number | null;
}

function mediaMs(u: ModelUsage | undefined): number | null {
  if (!u || u.ok === 0 || !u.totalMs) return null;
  return Math.round(u.totalMs / u.ok);
}

/** Arma la ficha de un modelo con lo que haya medido. Nada obligatorio: sin
 * ninguna de las tres fuentes sale una ficha vacía, que es lo honesto. */
export function perfilDe(
  modelKey: string,
  uso: ModelUsage | undefined,
  roto: ModeloRoto | undefined,
  techo: LimiteMedido | undefined,
  ahora: number
): PerfilModelo {
  // una clave mal formada no puede tumbar el panel: se enseña tal cual
  const partes = splitModelKey(modelKey);
  const providerId = partes?.providerId ?? modelKey;
  const modelId = partes?.modelId ?? modelKey;
  const llamadas = uso?.requests ?? 0;
  const ok = uso?.ok ?? 0;
  const tareas: PerfilTarea[] = Object.entries(uso?.porTarea ?? {})
    .map(([k, t]) => ({
      tarea: k as TaskKind,
      llamadas: t.llamadas,
      ok: t.ok,
      fiabilidad: t.llamadas >= MIN_LLAMADAS_FIABLES ? t.ok / t.llamadas : null,
      msMedio: t.ok > 0 && t.totalMs ? Math.round(t.totalMs / t.ok) : null,
    }))
    .sort((a, b) => b.llamadas - a.llamadas);

  return {
    modelKey,
    providerId,
    modelId,
    llamadas,
    ok,
    fallos: uso?.fail ?? 0,
    fiabilidad: llamadas >= MIN_LLAMADAS_FIABLES ? ok / llamadas : null,
    msMedio: mediaMs(uso),
    roto: roto ?? null,
    techo: techo ?? null,
    techoVigente: techo != null && ahora - techo.at <= VIGENCIA_MS,
    tareas,
    ultimoUso: uso?.lastUsed ?? null,
  };
}

/** ¿Hay algo medido que contar? Sin esto se pintarían fichas vacías por cada
 * modelo del catálogo, que es peor que no pintar ninguna. */
export function hayPerfil(p: PerfilModelo): boolean {
  return p.llamadas > 0 || p.roto != null || p.techo != null;
}

/** Lo más grave que se sabe del modelo, en una línea. `null` si no hay nada
 * malo que decir: el silencio aquí es una respuesta. */
export function avisoDePerfil(p: PerfilModelo, ahora: number): string | null {
  if (p.roto) {
    const cuando = new Date(p.roto.at).toLocaleDateString("es");
    return `Tu proveedor no lo reconoce (${p.roto.status || "sin respuesta"}, comprobado el ${cuando}).`;
  }
  if (p.techo && p.techoVigente) {
    return p.techo.limite != null
      ? `Admite ${p.techo.limite.toLocaleString("es")} tokens de entrada: las conversaciones largas no le caben.`
      : `Rechazó un mensaje de ${p.techo.rechazado.toLocaleString("es")} tokens por tamaño.`;
  }
  if (p.techo && !p.techoVigente) {
    const horas = Math.round((ahora - p.techo.at) / 3_600_000);
    return `Rechazó un mensaje por tamaño hace ${horas} h; ese tope pudo ser por minuto y ya no cuenta.`;
  }
  if (p.fiabilidad != null && p.fiabilidad < 0.7) {
    return `Falla a menudo: ${p.ok} de ${p.llamadas} intentos salieron bien.`;
  }
  return null;
}

/** Las líneas de la ficha. Lo que no se sabe no sale, salvo el «sin probar»,
 * que es justo lo que hay que saber antes de elegirlo. */
export function lineasDePerfil(p: PerfilModelo): { etiqueta: string; valor: string }[] {
  const out: { etiqueta: string; valor: string }[] = [];
  if (p.llamadas === 0) {
    out.push({ etiqueta: "Historial", valor: "sin probar todavía en esta app" });
  } else {
    out.push({
      etiqueta: "Historial",
      valor:
        p.fiabilidad != null
          ? `${Math.round(p.fiabilidad * 100)} % de acierto en ${p.llamadas} intentos`
          : `${p.ok} de ${p.llamadas} intentos bien (pocos para un porcentaje)`,
    });
  }
  if (p.msMedio != null) {
    out.push({ etiqueta: "Tarda de media", valor: `${(p.msMedio / 1000).toFixed(1)} s` });
  }
  if (p.techo) {
    out.push({
      etiqueta: "Techo medido",
      valor:
        (p.techo.limite != null
          ? `${p.techo.limite.toLocaleString("es")} tokens (lo dijo el proveedor)`
          : `rechazó ${p.techo.rechazado.toLocaleString("es")} tokens`) +
        (p.techoVigente ? "" : " · medición caducada"),
    });
  }
  const mejor = mejorTareaDe(p);
  if (mejor) {
    out.push({ etiqueta: "Donde mejor va", valor: ETIQUETA_TAREA[mejor] ?? mejor });
  }
  for (const t of p.tareas.slice(0, 3)) {
    out.push({
      etiqueta: ETIQUETA_TAREA[t.tarea] ?? t.tarea,
      valor:
        (t.fiabilidad != null
          ? `${Math.round(t.fiabilidad * 100)} % en ${t.llamadas}`
          : `${t.ok}/${t.llamadas}`) + (t.msMedio != null ? ` · ${(t.msMedio / 1000).toFixed(1)} s` : ""),
    });
  }
  return out;
}

/** Para qué encargo va mejor ESTE modelo, según lo medido. `null` cuando no
 * hay con qué comparar: proponer el primero de la lista sería inventar. */
export function mejorTareaDe(p: PerfilModelo): TaskKind | null {
  const conDatos = p.tareas.filter((t) => t.fiabilidad != null);
  if (conDatos.length < 2) return null;
  const mejor = [...conDatos].sort((a, b) => (b.fiabilidad ?? 0) - (a.fiabilidad ?? 0))[0];
  const peor = [...conDatos].sort((a, b) => (a.fiabilidad ?? 0) - (b.fiabilidad ?? 0))[0];
  // sin diferencia real no hay nada que recomendar
  if ((mejor.fiabilidad ?? 0) - (peor.fiabilidad ?? 0) < 0.15) return null;
  return mejor.tarea;
}

/** Todos los perfiles con algo medido, los más problemáticos primero: un
 * modelo roto arriba del todo, luego los que tienen techo, luego por acierto. */
export function perfiles(
  usos: Record<string, ModelUsage>,
  rotos: Record<string, ModeloRoto>,
  techos: Record<string, LimiteMedido>,
  ahora: number
): PerfilModelo[] {
  const claves = new Set([...Object.keys(usos), ...Object.keys(rotos), ...Object.keys(techos)]);
  return [...claves]
    .map((k) => perfilDe(k, usos[k], rotos[k], techos[k], ahora))
    .filter(hayPerfil)
    .sort((a, b) => {
      const gravedad = (p: PerfilModelo) =>
        p.roto ? 0 : p.techo && p.techoVigente ? 1 : (p.fiabilidad ?? 1) < 0.7 ? 2 : 3;
      const d = gravedad(a) - gravedad(b);
      if (d !== 0) return d;
      return b.llamadas - a.llamadas;
    });
}
