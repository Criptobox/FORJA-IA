/** Forja IA — Utilidades puras de OAuth de Google Drive (sin I/O).
 *
 * Mismo reparto que `github-oauth.ts`: aquí solo hay parsers y
 * constructores de URL, para poder probarlos sin red. El intercambio de
 * código, los refrescos de token y las cookies viven en el servidor
 * (`gdrive-oauth-server.ts`).
 *
 * A diferencia de GitHub, Google no tiene un "manifiesto" que registre una
 * app automáticamente: cada persona que use Forja crea su propio cliente
 * OAuth en su Google Cloud (gratis, unos clics) y lo pega en el diálogo de
 * Drive — mismo espíritu «trae tus propias credenciales» que el resto de
 * la app con los proveedores de modelos.
 */
import { parseAppCredsJson, type AppCreds } from "./github-oauth";

export type GoogleTokenResult = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

/** Google siempre responde JSON (a diferencia de GitHub, que a veces manda
 * form-urlencoded), pero mantenemos el mismo parseo defensivo. */
export function parseGoogleTokenResponse(text: string): GoogleTokenResult {
  const trimmed = text.trim();
  if (!trimmed) return { error: "empty", error_description: "Google no devolvió token" };
  try {
    return JSON.parse(trimmed) as GoogleTokenResult;
  } catch {
    return { error: "invalid_json", error_description: "Google devolvió una respuesta ilegible" };
  }
}

/** Alcance mínimo para leer Y escribir solo lo que Forja gestiona:
 * `drive.file` (archivos creados o abiertos por la app) no basta para
 * indexar carpetas que ya existían antes de conectar Drive, así que se
 * pide `drive` completo — el plan de biblioteca necesita leer carpetas
 * arbitrarias del usuario, no solo lo que la propia app cree. */
export const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export function googleAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge?: string;
  loginHint?: string;
}): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GDRIVE_SCOPE);
  u.searchParams.set("state", opts.state);
  // access_type=offline + prompt=consent: sin esto Google solo entrega
  // refresh_token la PRIMERA vez que la cuenta autoriza la app, y aquí
  // necesitamos poder refrescar el token en cada conexión (varias cuentas,
  // reconexiones tras revocar acceso, etc.).
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  // Varias cuentas de Google conectadas a la vez: sin esto, si ya hay una
  // sesión de Google abierta, el selector de cuenta no aparece.
  u.searchParams.set("include_granted_scopes", "true");
  if (opts.loginHint) u.searchParams.set("login_hint", opts.loginHint);
  if (opts.challenge) {
    u.searchParams.set("code_challenge", opts.challenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  return u.toString();
}

/** Reexportado tal cual: el formato {clientId, clientSecret, slug?} de
 * GitHub sirve igual aquí (Google no usa `slug`, queda vacío). */
export { parseAppCredsJson, type AppCreds };

export const GD_OAUTH_MSG = "forja-gdrive";
export const GD_STATE_COOKIE = "forja_gd_state";
export const GD_APP_COOKIE = "forja_gd_app";

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
