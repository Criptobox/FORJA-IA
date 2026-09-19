/** Forja IA — Google Identity Services (GIS): pedir un access_token de
 * Drive sin servidor propio.
 *
 * Sustituye al intercambio OAuth de servidor (código, cookie de estado,
 * client_secret): GIS abre y gestiona su propio popup de Google, valida
 * el origen contra "Authorized JavaScript origins" (un dominio entero, no
 * una ruta exacta) y devuelve el token directo al navegador. Nada de
 * `redirect_uri` que tenga que coincidir carácter por carácter — esa era
 * la causa del "Error 400: redirect_uri_mismatch" que reportó el usuario
 * con el flujo anterior.
 *
 * Contrapartida: el flujo "token" de GIS no entrega refresh_token (eso
 * solo lo da el flujo "código de autorización", que sí necesita
 * client_secret). Por eso `gdrive.ts` renueva pidiendo un token nuevo con
 * `prompt: ""` (silencioso mientras la sesión de Google siga viva) en vez
 * de refrescar uno guardado.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: GisTokenClientConfig): GisTokenClient;
        };
      };
    };
  }
}

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  hint?: string;
  prompt?: "" | "none" | "consent" | "select_account";
  callback: (res: GisTokenResponse) => void;
  error_callback?: (err: { type: string; message?: string }) => void;
}

interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

let gisLoading: Promise<void> | null = null;

/** Inyecta el script de GIS una sola vez (si ya está, no hace nada). */
export function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Sin navegador"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google Identity Services")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisLoading;
}

export interface GoogleTokenGrant {
  accessToken: string;
  expiresIn: number;
}

/**
 * Pide un access_token de Google.
 * `interactive: true` → `prompt: "select_account"`: deja elegir (o añadir)
 * cuenta, para poder conectar varias.
 * `interactive: false` → `prompt: ""`: renovación silenciosa; si Google
 * de verdad necesita interacción, `error_callback` rechaza la promesa y
 * quien llame decide si reintenta en modo interactivo.
 */
export async function requestGoogleToken(opts: {
  clientId: string;
  scope: string;
  hint?: string;
  interactive: boolean;
}): Promise<GoogleTokenGrant> {
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google Identity Services no está disponible");

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: opts.clientId,
      scope: opts.scope,
      hint: opts.hint,
      prompt: opts.interactive ? "select_account" : "",
      callback: (res) => {
        if (res.error || !res.access_token) {
          reject(new Error(res.error_description || res.error || "Google no entregó el token"));
          return;
        }
        resolve({ accessToken: res.access_token, expiresIn: res.expires_in ?? 3600 });
      },
      error_callback: (err) => {
        reject(new Error(err.message || err.type || "No se pudo autorizar con Google"));
      },
    });
    client.requestAccessToken();
  });
}
