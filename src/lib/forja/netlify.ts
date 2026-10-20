/** Forja IA — Publicar en Netlify con un clic.
 *
 * GitHub Pages ya estaba (Repo Studio), pero exige repo, workflow y esperar
 * a Actions. Netlify acepta el sitio entero como UN ZIP en una llamada:
 * justo lo que la vista previa ya sabe fabricar para «Descargar ZIP».
 *
 *   1. Si esta conversación aún no tiene sitio: POST /api/v1/sites → un
 *      sitio nuevo con nombre aleatorio (`xxx.netlify.app`).
 *   2. POST /api/v1/sites/{id}/deploys con el ZIP → despliegue.
 *   3. Se recuerda el id del sitio por conversación: volver a publicar
 *      actualiza la MISMA URL en vez de crear un sitio nuevo cada vez.
 *
 * El token es un «personal access token» del usuario (BYOK, como las
 * claves de los modelos): vive en su navegador y va directo a Netlify.
 * Si el sitio guardado ya no existe (lo borró en Netlify), se crea otro y
 * se dice.
 */

export const NETLIFY_API = "https://api.netlify.com/api/v1";
export const URL_TOKEN_NETLIFY = "https://app.netlify.com/user/applications#personal-access-tokens";
const CLAVE_TOKEN = "forja-netlify-token";
const CLAVE_SITIOS = "forja-netlify-sites";

export type ResultadoNetlify =
  | { ok: true; siteId: string; url: string; adminUrl?: string; nuevo: boolean }
  | { ok: false; motivo: string };

type Fetch = typeof fetch;

function motivoHttp(status: number, cuerpo: string): string {
  if (status === 401) return "Netlify rechazó el token (401): revísalo o crea uno nuevo.";
  if (status === 403) return "El token no tiene permiso para crear o desplegar sitios (403).";
  if (status === 422) return `Netlify no aceptó el sitio (422): ${cuerpo.slice(0, 160) || "datos no válidos"}.`;
  if (status === 429) return "Netlify pide esperar un poco (demasiadas peticiones, 429).";
  return `Netlify respondió ${status}${cuerpo ? `: ${cuerpo.slice(0, 160)}` : ""}.`;
}

async function leerError(r: Response): Promise<string> {
  try {
    const t = await r.text();
    try {
      const j = JSON.parse(t) as { message?: string; errors?: unknown };
      return j.message ?? t;
    } catch {
      return t;
    }
  } catch {
    return "";
  }
}

async function crearSitio(token: string, f: Fetch): Promise<{ id: string; url: string; adminUrl?: string } | { error: string }> {
  const r = await f(`${NETLIFY_API}/sites`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) return { error: motivoHttp(r.status, await leerError(r)) };
  const j = (await r.json()) as { id?: string; ssl_url?: string; url?: string; admin_url?: string };
  if (!j.id) return { error: "Netlify creó el sitio pero no devolvió su id." };
  return { id: j.id, url: j.ssl_url || j.url || "", adminUrl: j.admin_url };
}

/** Publica un ZIP. `siteId` es el sitio ya creado para esta conversación, si lo hay. */
export async function publicarEnNetlify(opts: {
  token: string;
  zip: Uint8Array;
  siteId?: string | null;
  fetchImpl?: Fetch;
}): Promise<ResultadoNetlify> {
  const token = opts.token.trim();
  if (!token) return { ok: false, motivo: "Falta el token de Netlify." };
  if (!opts.zip.length) return { ok: false, motivo: "No hay nada que publicar." };
  const f = opts.fetchImpl ?? fetch;
  try {
    let siteId = opts.siteId ?? null;
    let url = "";
    let adminUrl: string | undefined;
    let nuevo = false;
    const nuevoSitio = async (): Promise<string | null> => {
      const s = await crearSitio(token, f);
      if ("error" in s) return s.error;
      siteId = s.id;
      url = s.url;
      adminUrl = s.adminUrl;
      nuevo = true;
      return null;
    };
    if (!siteId) {
      const e = await nuevoSitio();
      if (e) return { ok: false, motivo: e };
    }
    const desplegar = () =>
      f(`${NETLIFY_API}/sites/${encodeURIComponent(siteId as string)}/deploys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
        body: opts.zip as BodyInit,
      });
    let r = await desplegar();
    // el sitio recordado ya no existe (lo borraste en Netlify): uno nuevo
    if (r.status === 404 && !nuevo) {
      const e = await nuevoSitio();
      if (e) return { ok: false, motivo: e };
      r = await desplegar();
    }
    if (!r.ok) return { ok: false, motivo: motivoHttp(r.status, await leerError(r)) };
    const d = (await r.json()) as { ssl_url?: string; url?: string; admin_url?: string };
    return {
      ok: true,
      siteId: siteId as string,
      url: d.ssl_url || d.url || url,
      adminUrl: d.admin_url || adminUrl,
      nuevo,
    };
  } catch (e) {
    return {
      ok: false,
      motivo: `No se pudo conectar con Netlify (${e instanceof Error ? e.message : String(e)}). Comprueba la conexión o si una extensión bloquea la petición.`,
    };
  }
}

/* ——— token y sitio por conversación, en este navegador ——— */

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
const almacen = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function leerTokenNetlify(s: StorageLike | null = almacen()): string {
  try {
    return s?.getItem(CLAVE_TOKEN) ?? "";
  } catch {
    return "";
  }
}
export function guardarTokenNetlify(token: string, s: StorageLike | null = almacen()): void {
  try {
    if (token.trim()) s?.setItem(CLAVE_TOKEN, token.trim());
    else s?.removeItem(CLAVE_TOKEN);
  } catch {
    /* sin almacenamiento: se pedirá la próxima vez */
  }
}
export function sitioDeConversacion(id: string | null | undefined, s: StorageLike | null = almacen()): string | null {
  if (!id) return null;
  try {
    const m = JSON.parse(s?.getItem(CLAVE_SITIOS) ?? "{}") as Record<string, string>;
    return typeof m[id] === "string" ? m[id] : null;
  } catch {
    return null;
  }
}
export function recordarSitio(id: string | null | undefined, siteId: string, s: StorageLike | null = almacen()): void {
  if (!id) return;
  try {
    const m = JSON.parse(s?.getItem(CLAVE_SITIOS) ?? "{}") as Record<string, string>;
    m[id] = siteId;
    s?.setItem(CLAVE_SITIOS, JSON.stringify(m));
  } catch {
    /* no se recuerda: la próxima publicación creará otro sitio */
  }
}
