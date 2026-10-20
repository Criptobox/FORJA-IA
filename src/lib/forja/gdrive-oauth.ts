/** Forja IA — Utilidades puras de Google Drive (sin I/O).
 *
 * Antes esto tenía constructores de URL para un intercambio OAuth de
 * servidor (código + client_secret + redirect_uri exacto), pero esa ruta
 * le dio a un usuario real un "Error 400: redirect_uri_mismatch" sin
 * ninguna pista dentro de Forja. Se sustituyó por Google Identity Services
 * (`gdrive-gis.ts`): sin servidor, sin secret, sin ruta de redirección que
 * tenga que coincidir carácter por carácter — solo un Client ID y una API
 * Key, exactamente igual de "trae tus propias credenciales" que el resto
 * de la app, pero sin el paso más frágil del anterior.
 */

/** Alcance mínimo para leer Y escribir solo lo que Forja gestiona:
 * `drive.file` (archivos creados o abiertos por la app) no basta para
 * indexar carpetas que ya existían antes de conectar Drive, así que se
 * pide `drive` completo — el plan de biblioteca necesita leer carpetas
 * arbitrarias del usuario, no solo lo que la propia app cree. */
export const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/** «12.4 GB de 15 GB» — o solo «12.4 GB usados» si la cuenta no tiene
 * límite (Workspace ilimitado devuelve `limit` vacío). */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : v < 10 ? 1 : 0;
  const rounded = v.toFixed(digits);
  // "2.0 KB" queda peor que "2 KB": solo se muestra el decimal si aporta algo.
  return `${rounded.endsWith(".0") ? rounded.slice(0, -2) : rounded} ${units[i]}`;
}

export interface GDriveQuota {
  /** null cuando la cuenta no tiene límite (Workspace ilimitado). */
  limit: number | null;
  usage: number;
  usageInDrive: number;
}

/** Porcentaje 0-100, o null si no hay límite que medir. */
export function quotaPercent(q: GDriveQuota): number | null {
  if (!q.limit || q.limit <= 0) return null;
  return Math.min(100, Math.round((q.usage / q.limit) * 100));
}
