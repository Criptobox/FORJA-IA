/** Forja IA — Avisar de que el modelo que usas ya está retirado.
 *
 * Las listas de modelos que trae la app son una foto, y las fotos envejecen.
 * Cuando esto se escribió, Forja ofrecía ocho modelos que sus proveedores ya
 * habían retirado —`pixtral-12b-2409` desde diciembre de 2025, los `grok-3`
 * desde febrero— y no ofrecía el Gemini más nuevo. Nadie se enteraba hasta
 * que una petición volvía con un 404 y parecía culpa de la clave.
 *
 * Esto lo hace visible. La tabla la genera `npm run modelos` desde el catálogo
 * público de LiteLLM, que publica `deprecation_date` por modelo, y viene con
 * su fecha: lo que se enseña es «según una foto del día X», no una verdad
 * eterna.
 *
 * ——— Lo que NO hace ———
 *
 * No bloquea. Un modelo marcado como retirado puede seguir respondiendo
 * semanas —los proveedores no apagan a medianoche— y un catálogo de terceros
 * puede equivocarse. Se avisa y se deja pasar: la app no sabe más que tu
 * proveedor sobre lo que tu proveedor sirve.
 */
import { RETIRADOS } from "./modelos-datos";

export { MODELOS_FECHA, MODELOS_FUENTE } from "./modelos-datos";

export type TablaRetirados = Record<string, Record<string, string>>;

/** Quita el sufijo de gratis y el prefijo del proveedor: el catálogo guarda
 * el id pelado y las pasarelas lo decoran de formas distintas. */
function pelar(modelId: string): string {
  const sinSufijo = modelId.trim().toLowerCase().replace(/:free$/, "").replace(/-free$/, "");
  return sinSufijo.includes("/") ? sinSufijo.slice(sinSufijo.lastIndexOf("/") + 1) : sinSufijo;
}

/** El día en que el proveedor retira (o retiró) este modelo. `null` si el
 * catálogo no dice nada — que NO significa «está vivo», significa que no se
 * sabe, y por eso quien pinta no escribe nada en ese caso. */
export function retiradoEl(
  providerId: string,
  modelId: string,
  tabla: TablaRetirados = RETIRADOS
): string | null {
  const delProveedor = tabla[providerId];
  if (!delProveedor) return null;
  return delProveedor[pelar(modelId)] ?? delProveedor[modelId] ?? null;
}

export type EstadoModelo = "vivo" | "se-retira" | "retirado";

/** Estado de un modelo respecto a hoy.
 *
 * «se-retira» es una fecha en el futuro: enterarse con antelación es justo el
 * favor que hace esta tabla, y avisar solo cuando ya está muerto llega tarde
 * para mover un proyecto. */
export function estadoModelo(
  providerId: string,
  modelId: string,
  hoy: string,
  tabla: TablaRetirados = RETIRADOS
): { estado: EstadoModelo; fecha: string | null } {
  const fecha = retiradoEl(providerId, modelId, tabla);
  if (!fecha) return { estado: "vivo", fecha: null };
  return { estado: fecha <= hoy ? "retirado" : "se-retira", fecha };
}

/** La frase que se enseña. `null` cuando no hay nada que decir: un aviso que
 * sale siempre se deja de leer en dos días. */
export function avisoModelo(
  providerId: string,
  modelId: string,
  hoy: string,
  tabla: TablaRetirados = RETIRADOS
): string | null {
  const { estado, fecha } = estadoModelo(providerId, modelId, hoy, tabla);
  if (estado === "vivo" || !fecha) return null;
  if (estado === "retirado") {
    return `«${modelId}» consta como retirado el ${fecha}. Puede seguir respondiendo unos días, pero conviene cambiarlo.`;
  }
  return `«${modelId}» tiene retirada anunciada para el ${fecha}.`;
}

/** Cuántos de una lista están retirados. Para poder decirlo en un sitio
 * (Ajustes) sin recorrer la lista a ojo. */
export function cuantosRetirados(
  providerId: string,
  modelos: readonly string[],
  hoy: string,
  tabla: TablaRetirados = RETIRADOS
): number {
  return modelos.filter((m) => estadoModelo(providerId, m, hoy, tabla).estado === "retirado").length;
}

/** El día de la foto, en días. Para decir «esta lista se comprobó hace N». */
export function diasDeLaFoto(fecha: string, ahora: number): number {
  const t = Date.parse(`${fecha}T00:00:00Z`);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((ahora - t) / 86_400_000));
}
