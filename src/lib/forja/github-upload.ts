/** Forja IA — Subida directa a GitHub con la Git Data API.
 *
 * Un proyecto entero, sea del tamaño que sea, entra como UN SOLO commit:
 *  - blobs base64 para binarios y textos grandes; el texto normal va embebido
 *    en el árbol (menos peticiones)
 *  - el árbol se construye por tramos encadenados (cada tramo parte del
 *    anterior) para no mandar peticiones gigantes, y al final un commit
 *  - modo «reemplazar» (por defecto): el repo queda EXACTAMENTE como el
 *    proyecto; lo que ya no está se quita, y el historial anterior sigue en
 *    GitHub. Modo «añadir»: solo añade y sobrescribe.
 *  - repos vacíos (creados en GitHub sin README) se inicializan solos
 *  - cada petición se reintenta ante cortes de red, 5xx y límites temporales
 *  - scripts con `#!` o con permiso de ejecución en el ZIP suben como 100755
 *  - crea el repo si no existe (auto_init con README)
 * El token se guarda SOLO en localStorage de tu dispositivo. */
import { isTextPath } from "./sandbox";
import type { ReviewFile } from "./sandbox-review";

export type GhItem = {
  path: string;
  file: File;
  /** permiso de ejecución (del ZIP); los scripts con `#!` se detectan solos */
  exec?: boolean;
};

/** Qué pasa con lo que ya había en el repo. */
export type ModoSubida = "reemplazar" | "anadir";
export type GhProgress = {
  done: number;
  total: number;
  batch: number;
  batches: number;
  message: string;
};

const GH_API = "https://api.github.com";
const TOKEN_KEY = "forja-github-token";
const ACCOUNT_KEY = "forja-github-account";
export const GH_ACCOUNT_EVENT = "forja-github-account";

export type GhAccount = {
  token: string;
  login: string;
  name: string;
  avatar: string;
  source: "oauth" | "pat";
};

function ghNotifyAccount(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(GH_ACCOUNT_EVENT));
  } catch {
    /* ignore */
  }
}
const SINGLE_LIMIT = 95 * 1024 * 1024; // GitHub rechaza blobs >100MB; margen propio

// ——— token local ———
export function ghGetToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}
export function ghSetToken(t: string): void {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ACCOUNT_KEY);
    }
  } catch {
    /* almacenamiento no disponible */
  }
  ghNotifyAccount();
}

export function ghGetAccount(): GhAccount | null {
  const token = ghGetToken();
  if (!token) return null;
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return { token, login: "", name: "", avatar: "", source: "pat" };
    const p = JSON.parse(raw) as Partial<GhAccount>;
    return {
      token,
      login: typeof p.login === "string" ? p.login : "",
      name: typeof p.name === "string" ? p.name : "",
      avatar: typeof p.avatar === "string" ? p.avatar : "",
      source: p.source === "oauth" ? "oauth" : "pat",
    };
  } catch {
    return { token, login: "", name: "", avatar: "", source: "pat" };
  }
}

export function ghSetAccount(account: GhAccount | null): void {
  if (!account?.token) {
    ghSetToken("");
    return;
  }
  try {
    localStorage.setItem(TOKEN_KEY, account.token);
    localStorage.setItem(
      ACCOUNT_KEY,
      JSON.stringify({
        login: account.login,
        name: account.name,
        avatar: account.avatar,
        source: account.source,
      })
    );
  } catch {
    /* almacenamiento no disponible */
  }
  ghNotifyAccount();
}

// ——— reglas de ignorado (como un .gitignore básico) ———
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  ".vercel",
  "dist",
  "build",
  "out",
  "coverage",
  ".cache",
  ".idea",
  ".vscode",
]);
const IGNORE_FILE_RE = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|.*\.log|.*\.zip|.*\.tar|.*\.gz)$/i;
/** .env y sus variantes quedan excluidos por seguridad. Las plantillas sin
 * valores (.env.example, .env.sample, .env.template) SÍ se suben: son
 * justamente lo que hay que publicar para que otros sepan qué variables hacen
 * falta. */
const IGNORE_ENV_RE = /(^|\/)\.env(?!\.example$|\.sample$|\.template$)(\..+)?$/i;

export function shouldIgnore(relPath: string): boolean {
  const parts = relPath.split("/");
  if (parts.some((p) => IGNORE_DIRS.has(p))) return true;
  if (IGNORE_FILE_RE.test(relPath)) return true;
  if (IGNORE_ENV_RE.test(relPath)) return true;
  return false;
}

/** Ruta relativa desde un File de un input con webkitdirectory (quita el nombre de la carpeta raíz) */
export function relPathFrom(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const parts = rel.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : rel;
}

/** Prepara la lista: rutas limpias, ignorados aparte, archivos demasiado grandes aparte */
export function prepareFiles(files: File[]): {
  keep: GhItem[];
  ignored: number;
  tooBig: File[];
} {
  const keep: GhItem[] = [];
  let ignored = 0;
  const tooBig: File[] = [];
  for (const f of files) {
    const rel = relPathFrom(f);
    if (!rel || shouldIgnore(rel)) {
      ignored++;
      continue;
    }
    if (f.size > SINGLE_LIMIT) {
      tooBig.push(f);
      continue;
    }
    keep.push({ path: rel, file: f });
  }
  return { keep, ignored, tooBig };
}

/** Máximo que se lee para revisar: por encima de esto el archivo va como binario. */
const REVIEW_TEXT_LIMIT = 1_500_000;

/** Convierte lo que se va a subir en la entrada de la revisión previa.
 * Los archivos de texto se leen enteros (hasta el límite) para poder buscar
 * credenciales dentro; del resto solo se mira la ruta y el tamaño. */
export async function toReviewFiles(items: GhItem[]): Promise<ReviewFile[]> {
  return Promise.all(
    items.map(async (it) => {
      const readable = isTextPath(it.path) && it.file.size <= REVIEW_TEXT_LIMIT;
      let text: string | null = null;
      if (readable) {
        try {
          text = await it.file.text();
        } catch {
          text = null;
        }
      }
      return { path: it.path, text, size: it.file.size };
    })
  );
}

// ——— helpers HTTP ———

/** El `fetch` que usa la subida. Se puede sustituir para poder PROBAR esto.
 *
 * Sin esto, toda la subida a GitHub era código sin una sola prueba: el fallo
 * de la rama fija vivió versiones enteras porque nada podía ejecutarlo sin
 * una cuenta de GitHub de verdad delante. */
export type GhFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Espera entre reintentos. Sustituible en las pruebas para no dormir. */
export type Dormir = (ms: number) => Promise<void>;
const dormirReal: Dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reintentos: 4 intentos en total, esperando 1 s, 3 s y 7 s. */
const ESPERAS_MS = [1000, 3000, 7000];

/** Tiempo máximo de una petición según lo que manda: 30 s de base más lo que
 *  tarda en subir el cuerpo a ~20 KB/s (un móvil con mala cobertura). Antes
 *  era 30 s fijos, y una imagen de 2 MB por 4G flojo cortaba la subida
 *  entera. Tope de 10 minutos. */
export function tiempoMaximo(bytesCuerpo: number): number {
  return Math.min(600_000, 30_000 + Math.ceil(bytesCuerpo / 20));
}

/** ¿Merece otro intento? Cortes de red y fallos de GitHub, sí; un «no» de
 *  verdad (401, 404, 422…), no: repetirlo solo gasta tiempo. */
async function reintentable(res: Response): Promise<number | null> {
  if (res.status >= 500) return 0;
  if (res.status === 429) return Number(res.headers.get("retry-after") ?? 0) * 1000;
  if (res.status === 403) {
    const retry = res.headers.get("retry-after");
    if (retry) return Number(retry) * 1000;
    // límite secundario (demasiadas peticiones seguidas): el mensaje lo dice
    try {
      const j = (await res.clone().json()) as { message?: string };
      if (/secondary rate limit|abuse/i.test(j.message ?? "")) return 0;
    } catch {
      /* sin cuerpo */
    }
  }
  return null;
}

function ghFetchCon(fetchImpl?: GhFetch, dormir: Dormir = dormirReal) {
  const f: GhFetch = fetchImpl ?? ((u, i) => fetch(u, i));
  return async (token: string, path: string, init?: RequestInit): Promise<Response> => {
    const url = path.startsWith("http") ? path : GH_API + path;
    const cuerpo = typeof init?.body === "string" ? init.body.length : 0;
    let ultimoError: unknown = null;
    for (let intento = 0; intento <= ESPERAS_MS.length; intento++) {
      try {
        const res = await f(url, {
          ...init,
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...(init?.headers ?? {}),
          },
          signal: AbortSignal.timeout(tiempoMaximo(cuerpo)),
        });
        const espera = intento < ESPERAS_MS.length ? await reintentable(res) : null;
        if (espera === null) return res;
        // GitHub puede pedir esperar mucho: más de un minuto no se espera, se dice
        if (espera > 60_000) return res;
        await dormir(Math.max(espera, ESPERAS_MS[intento]));
      } catch (e) {
        // corte de red o tiempo agotado: se reintenta igual
        ultimoError = e;
        if (intento >= ESPERAS_MS.length) break;
        await dormir(ESPERAS_MS[intento]);
      }
    }
    throw new Error(
      `No se pudo hablar con GitHub tras varios intentos (${
        ultimoError instanceof Error ? ultimoError.message : "sin conexión"
      }). Revisa la conexión y vuelve a intentarlo: lo ya subido no se pierde.`
    );
  };
}

const ghFetch = ghFetchCon();

/** El token dice cómo se consiguió, y eso importa para el 403: una GitHub
 * App no tiene «scopes», tiene repos instalados; un token clásico sí tiene
 * scopes. Decir «te falta el scope repo» a alguien conectado con la App
 * (el camino de un clic, el que usa casi todo el mundo) es un consejo que
 * no se puede seguir — esa pantalla no existe para ese tipo de token. */
function tipoDeToken(token: string): "app" | "oauth-clasico" | "pat" {
  if (token.startsWith("ghu_")) return "app";
  if (token.startsWith("gho_")) return "oauth-clasico";
  return "pat";
}

/** Qué hacer, no solo qué pasó.
 *
 * «GitHub 403» no le dice nada a nadie. Cada código tiene una causa que se
 * puede arreglar, y decirla es la diferencia entre volver a intentarlo y dar
 * la app por rota. */
export function pistaDeGithub(status: number, mensaje: string, token = ""): string {
  if (status === 401) {
    return "tu conexión con GitHub caducó o se revocó: desconecta y vuelve a conectar";
  }
  if (status === 403 || status === 404) {
    if (status === 403 && /rate limit/i.test(mensaje)) {
      return "has llegado al límite de peticiones: espera unos minutos";
    }
    const tipo = tipoDeToken(token);
    if (tipo === "app") {
      return "la app de GitHub no tiene acceso a ESTE repo: entra en https://github.com/settings/installations, abre «Forja IA» y añade el repositorio (o elige «All repositories»); si es de una organización, hazlo desde su página de Settings → Installations";
    }
    if (tipo === "oauth-clasico") {
      return "el token no tiene permiso de escritura en ese repo (hace falta el alcance «repo»); si el repo es de una organización con SSO, autorízalo también ahí";
    }
    return status === 403
      ? "el token no tiene permiso de escritura en ese repo: revisa que tenga el alcance «repo» (clásico) o el repo listado en «Repository access» (fine-grained)"
      : "el repo no existe o tu token no puede verlo: revisa que tenga el alcance «repo» (clásico) o el repo listado en «Repository access» (fine-grained)";
  }
  if (status === 409) return "el repositorio está vacío o la rama cambió mientras subías";
  if (status === 422) return "GitHub rechazó los datos: mira el detalle de arriba";
  if (status >= 500) return "falla GitHub, no tú: inténtalo en un rato";
  return "";
}

/** ¿Hace falta instalar/dar acceso a la GitHub App en este repo? Se decide
 * SOLO con el status y el tipo de token — nunca leyendo el texto del
 * mensaje ya compuesto — para que la UI no tenga que volver a analizar una
 * cadena (y CodeQL no tenga un «substring de URL» que marcar como
 * saneamiento incompleto). */
export function necesitaInstalarApp(status: number, mensaje: string, token = ""): boolean {
  if (status !== 403 && status !== 404) return false;
  if (status === 403 && /rate limit/i.test(mensaje)) return false;
  return tipoDeToken(token) === "app";
}

/** Error de subida con el dato que la UI necesita para decidir si mostrar
 * el botón de «abrir instalaciones de GitHub» — calculado aquí, no
 * adivinado después a partir del texto del error. */
export class GithubUploadError extends Error {
  readonly necesitaInstalacion: boolean;
  constructor(message: string, necesitaInstalacion: boolean) {
    super(message);
    this.name = "GithubUploadError";
    this.necesitaInstalacion = necesitaInstalacion;
  }
}

async function ghJsonError(res: Response, fallback: string, token = ""): Promise<never> {
  let msg = fallback;
  try {
    const j = (await res.json()) as {
      message?: string;
      errors?: { message?: string; field?: string; code?: string }[];
    };
    if (j?.message) msg = j.message;
    // El detalle de verdad vive en `errors[]`; sin él un 422 es indescifrable.
    const detalle = (j?.errors ?? [])
      .map((e) => e.message || [e.field, e.code].filter(Boolean).join(" "))
      .filter(Boolean)
      .join("; ");
    if (detalle) msg += ` (${detalle})`;
  } catch {
    /* sin cuerpo JSON */
  }
  const pista = pistaDeGithub(res.status, msg, token);
  throw new GithubUploadError(
    `GitHub ${res.status}: ${msg}${pista ? ` — ${pista}` : ""}`,
    necesitaInstalarApp(res.status, msg, token)
  );
}

function isProbablyText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8000);
  let suspicious = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 7 || (b > 13 && b < 32)) suspicious++;
  }
  if (suspicious > n * 0.02) return false;
  try {
    const s = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(0, n));
    return !s.includes("\uFFFD");
  } catch {
    return false;
  }
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

/** Token clásico pre-rellenado con scope repo (para crear y subir) */
export const GH_TOKEN_URL =
  "https://github.com/settings/tokens/new?scopes=repo&description=Forja%20AI";

// ——— flujo de subida ———

export async function ghWhoAmI(token: string, fetchImpl?: GhFetch): Promise<string> {
  const res = await ghFetchCon(fetchImpl)(token, "/user");
  if (!res.ok) await ghJsonError(res, "No se pudo leer tu usuario", token);
  const j = (await res.json()) as { login?: string };
  return j.login ?? "";
}

/** Completa login/avatar a partir de un token (OAuth o PAT). */
export async function ghResolveAccount(token: string, source: "oauth" | "pat"): Promise<GhAccount> {
  const res = await ghFetch(token, "/user");
  if (!res.ok) await ghJsonError(res, "No se pudo leer tu usuario", token);
  const j = (await res.json()) as { login?: string; name?: string; avatar_url?: string };
  const login = j.login ?? "";
  return {
    token,
    login,
    name: j.name || login,
    avatar: j.avatar_url || (login ? `https://github.com/${login}.png?size=64` : ""),
    source,
  };
}

export async function ghListRepos(token: string): Promise<
  { owner: string; repo: string; fullName: string; isPrivate: boolean; defaultBranch: string; htmlUrl: string }[]
> {
  const res = await ghFetch(token, "/user/repos?per_page=30&sort=updated&affiliation=owner,collaborator");
  if (!res.ok) await ghJsonError(res, "No se pudieron listar tus repositorios", token);
  const j = (await res.json()) as {
    name?: string;
    full_name?: string;
    private?: boolean;
    default_branch?: string;
    html_url?: string;
    owner?: { login?: string };
  }[];
  return (Array.isArray(j) ? j : []).map((r) => ({
    owner: r.owner?.login ?? "",
    repo: r.name ?? "",
    fullName: r.full_name ?? `${r.owner?.login ?? ""}/${r.name ?? ""}`,
    isPrivate: !!r.private,
    defaultBranch: r.default_branch || "main",
    htmlUrl: r.html_url ?? "",
  }));
}

export interface RepoDestino {
  owner: string;
  repo: string;
  url: string;
  created: boolean;
  /** La rama de verdad del repo. NO se asume «main»: un repo con «master»
   * —o con la rama por defecto cambiada a mano— hacía que la subida crease un
   * commit huérfano y no apareciera nada. */
  branch: string;
}

type RepoInfo = { html_url?: string; owner?: { login?: string }; default_branch?: string };

function repoDestinoDe(j: RepoInfo, login: string, name: string, created: boolean): RepoDestino {
  return {
    owner: j.owner?.login ?? login,
    repo: name,
    url: j.html_url ?? `https://github.com/${login}/${name}`,
    created,
    branch: j.default_branch || "main",
  };
}

/** Crea el repo (con README) o devuelve el existente si ya estaba.
 *
 * Mira primero con un GET si el repo ya existe, y solo si no está intenta
 * crearlo con POST — no al revés. `GET /repos/…` solo necesita permiso de
 * LECTURA (metadata), que la app siempre tiene; `POST /user/repos` para
 * CREAR uno necesita permiso de administración de cuenta, que esta app no
 * pide (de sobra para «sube tus cambios»). Con un token de GitHub App, ese
 * POST da 403 «Resource not accessible by integration» SIEMPRE, exista o no
 * el repo y tenga o no la instalación acceso de escritura a su contenido —
 * intentarlo primero hacía fallar hasta la subida a un repo ya existente y
 * ya autorizado, con un mensaje que apuntaba a arreglar la instalación
 * cuando el problema de verdad era el orden de las llamadas. */
export async function ghEnsureRepo(
  token: string,
  name: string,
  isPrivate: boolean,
  fetchImpl?: GhFetch,
  description?: string,
  dormir?: Dormir
): Promise<RepoDestino> {
  const gh = ghFetchCon(fetchImpl, dormir);
  const login = await ghWhoAmI(token, fetchImpl);

  const info = await gh(token, `/repos/${login}/${name}`);
  if (info.ok) {
    return repoDestinoDe((await info.json()) as RepoInfo, login, name, false);
  }

  const res = await gh(token, "/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
      // Sin descripción inventada: antes TODOS los repos salían como «Forja IA
      // — mi chat con modelos gratis», fuese lo que fuese el proyecto.
      ...(description ? { description } : {}),
      has_issues: true,
      has_projects: false,
      has_wiki: false,
    }),
  });
  if (res.ok) {
    return repoDestinoDe((await res.json()) as RepoInfo, login, name, true);
  }
  if (res.status === 422) {
    // Carrera (se creó entre el GET y el POST) o nombre que GitHub no
    // acepta: se vuelve a preguntar antes de dar el 422 por bueno.
    const info2 = await gh(token, `/repos/${login}/${name}`);
    if (info2.ok) {
      return repoDestinoDe((await info2.json()) as RepoInfo, login, name, false);
    }
    return await ghJsonError(res, `No se pudo crear el repositorio «${name}»`, token);
  }
  return await ghJsonError(res, "No se pudo crear el repositorio", token);
}

type Head = { sha: string; treeSha: string } | null;

/** Dónde está la rama ahora mismo. `null` solo si la rama NO EXISTE (repo
 * recién creado y vacío), que es el único caso en que un commit sin padre es
 * lo correcto.
 *
 * Si la rama existe pero no se puede leer su árbol, esto FALLA en vez de
 * devolver un árbol vacío. Antes devolvía `treeSha: ""`, el commit salía sin
 * `base_tree` y eso no es «subir unos archivos»: es dejar el repo con
 * exactamente los archivos del lote y **borrar todos los demás**. Un fallo de
 * red a destiempo borraba el repo del usuario sin decir nada. */
async function ghGetHead(
  gh: ReturnType<typeof ghFetchCon>,
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<Head> {
  const res = await gh(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  if (res.status === 404 || res.status === 409) return null; // rama sin crear / repo vacío
  if (!res.ok) await ghJsonError(res, `No se pudo leer la rama ${branch}`, token);
  const j = (await res.json()) as { object?: { sha?: string } };
  const sha = j.object?.sha;
  if (!sha) return null;
  const cRes = await gh(token, `/repos/${owner}/${repo}/git/commits/${sha}`);
  if (!cRes.ok) {
    await ghJsonError(cRes, `No se pudo leer el último commit de ${branch}`, token);
  }
  const c = (await cRes.json()) as { tree?: { sha?: string } };
  const treeSha = c.tree?.sha ?? "";
  if (!treeSha) {
    throw new Error(
      `GitHub no devolvió el árbol del commit ${sha.slice(0, 7)}. Se para aquí a propósito: ` +
        "seguir habría subido el lote BORRANDO el resto de archivos del repo."
    );
  }
  return { sha, treeSha };
}

type TreeEntry =
  | { path: string; mode: "100644" | "100755"; type: "blob"; content: string }
  | { path: string; mode: "100644" | "100755"; type: "blob"; sha: string }
  | { path: string; mode: "100644"; type: "blob"; sha: null };

/** Por encima de esto un texto va como blob aparte: un árbol con un archivo
 *  de 5 MB dentro es una petición gigante que en móvil no llega. */
const TEXTO_EN_ARBOL_MAX = 512 * 1024;
/** Tramos del árbol: cada petición de árbol lleva como mucho esto. */
const TRAMO_ENTRADAS = 300;
const TRAMO_BYTES = 4 * 1024 * 1024;
/** Blobs en paralelo: más de esto dispara el límite secundario de GitHub. */
const BLOBS_EN_PARALELO = 4;

function esEjecutable(it: GhItem, bytes: Uint8Array): boolean {
  if (it.exec) return true;
  // «#!» al principio: un script, aunque la carpeta no traiga el permiso
  return bytes.length > 2 && bytes[0] === 0x23 && bytes[1] === 0x21;
}

/** Divide las entradas del árbol en tramos por número y por peso del texto
 *  embebido. */
export function tramosDeArbol(entries: TreeEntry[], maxEntradas = TRAMO_ENTRADAS, maxBytes = TRAMO_BYTES): TreeEntry[][] {
  const out: TreeEntry[][] = [];
  let cur: TreeEntry[] = [];
  let bytes = 0;
  for (const e of entries) {
    const peso = "content" in e ? e.content.length : 100;
    if (cur.length && (cur.length >= maxEntradas || bytes + peso > maxBytes)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(e);
    bytes += peso;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Comprueba que la rama apunta DE VERDAD a lo que acabamos de subir.
 *
 * Es la única forma honesta de terminar: hasta ahora «¡Completado!» quería
 * decir «no saltó ninguna excepción», que no es lo mismo que «está en
 * GitHub». */
async function ghVerificar(
  gh: ReturnType<typeof ghFetchCon>,
  token: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> {
  const res = await gh(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  if (!res.ok) await ghJsonError(res, `No se pudo comprobar la rama ${branch} después de subir`, token);
  const j = (await res.json()) as { object?: { sha?: string } };
  if (j.object?.sha !== sha) {
    throw new Error(
      `La subida no quedó publicada: la rama ${branch} apunta a ${
        j.object?.sha?.slice(0, 7) ?? "nada"
      } y no al commit ${sha.slice(0, 7)}. Vuelve a intentarlo.`
    );
  }
}

/** Un repo SIN NINGÚN commit (creado en GitHub sin README) no admite la Git
 *  Data API: blobs, árboles y commits responden 409 «Git Repository is
 *  empty». Se le pone un primer archivo con la Contents API, que sí funciona
 *  ahí, y a partir de ese commit todo sigue igual. En modo «reemplazar» ese
 *  archivo desaparece en el commit de verdad si el proyecto no lo trae. */
async function inicializarRepoVacio(
  gh: ReturnType<typeof ghFetchCon>,
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<void> {
  const res = await gh(token, `/repos/${owner}/${repo}/contents/.forja-init`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Inicializa el repositorio", content: btoa("forja\n"), branch }),
  });
  if (!res.ok) await ghJsonError(res, "No se pudo inicializar el repositorio vacío", token);
}

/** Rutas de archivos que hay ahora mismo en el árbol (para contar lo que
 *  «reemplazar» va a quitar). `null` si GitHub no da la lista entera. */
async function rutasDelArbol(
  gh: ReturnType<typeof ghFetchCon>,
  token: string,
  owner: string,
  repo: string,
  treeSha: string
): Promise<string[] | null> {
  const res = await gh(token, `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
  if (!res.ok) return null;
  const j = (await res.json()) as { truncated?: boolean; tree?: { path?: string; type?: string }[] };
  if (j.truncated) return null;
  return (j.tree ?? []).filter((e) => e.type === "blob" && e.path).map((e) => e.path as string);
}

export interface ResultadoSubida {
  url: string;
  /** siempre 1: todo el proyecto entra en un único commit */
  commits: number;
  branch: string;
  sha: string;
  /** archivos que estaban en el repo y ya no (solo en «reemplazar»); null si no se supo */
  eliminados: number | null;
  /** el repo se creó en esta subida */
  creado: boolean;
}

/** Sube el proyecto entero como un solo commit. */
export async function uploadToGithub(
  token: string,
  opts: {
    repoName: string;
    isPrivate: boolean;
    items: GhItem[];
    /** por defecto «reemplazar»: el repo queda igual que el proyecto */
    modo?: ModoSubida;
    /** mensaje del commit; por defecto uno que dice qué se hizo */
    mensaje?: string;
    /** descripción del repo SI se crea (nunca se toca la de uno existente) */
    descripcion?: string;
    onProgress?: (p: GhProgress) => void;
    /** solo para pruebas: sustituye el `fetch` de la subida */
    fetchImpl?: GhFetch;
    /** solo para pruebas: no dormir entre reintentos */
    dormir?: Dormir;
  }
): Promise<ResultadoSubida> {
  const { repoName, isPrivate, items, onProgress, fetchImpl } = opts;
  const modo: ModoSubida = opts.modo ?? "reemplazar";
  if (!items.length) throw new Error("No hay archivos para subir");
  const gh = ghFetchCon(fetchImpl, opts.dormir);
  const total = items.length;
  const avisar = (done: number, message: string, batch = 1, batches = 1) =>
    onProgress?.({ done, total, batch, batches, message });

  avisar(0, "Preparando el repositorio…");
  const repo = await ghEnsureRepo(token, repoName, isPrivate, fetchImpl, opts.descripcion, opts.dormir);
  // La rama del repo, no «main» a ciegas: en un repo con «master» se creaba
  // un commit huérfano y la app cantaba victoria con GitHub intacto.
  let head = await ghGetHead(gh, token, repo.owner, repo.repo, repo.branch);
  const inicializado = !head;
  if (!head) {
    await inicializarRepoVacio(gh, token, repo.owner, repo.repo, repo.branch);
    head = await ghGetHead(gh, token, repo.owner, repo.repo, repo.branch);
    if (!head) throw new Error("GitHub no creó la rama al inicializar el repositorio. Vuelve a intentarlo.");
  }

  // Lo que había, para decir cuánto se quita al reemplazar.
  const antes = modo === "reemplazar" ? await rutasDelArbol(gh, token, repo.owner, repo.repo, head.treeSha) : null;

  // 1) entradas del árbol: texto embebido o blob aparte (en paralelo moderado)
  const entries: TreeEntry[] = new Array(items.length);
  let hechos = 0;
  const cola = items.map((it, i) => ({ it, i }));
  const trabajadores = Array.from({ length: Math.min(BLOBS_EN_PARALELO, cola.length) }, async () => {
    for (;;) {
      const sig = cola.shift();
      if (!sig) break;
      const { it, i } = sig;
      const bytes = new Uint8Array(await it.file.arrayBuffer());
      const mode = esEjecutable(it, bytes) ? "100755" : "100644";
      if (bytes.length <= TEXTO_EN_ARBOL_MAX && isProbablyText(bytes)) {
        entries[i] = { path: it.path, mode, type: "blob", content: new TextDecoder().decode(bytes) };
      } else {
        const res = await gh(token, `/repos/${repo.owner}/${repo.repo}/git/blobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: toBase64(bytes), encoding: "base64" }),
        });
        if (!res.ok) await ghJsonError(res, `No se pudo subir ${it.path}`, token);
        const j = (await res.json()) as { sha?: string };
        if (!j.sha) throw new Error(`GitHub no devolvió el identificador de ${it.path}`);
        entries[i] = { path: it.path, mode, type: "blob", sha: j.sha };
      }
      hechos++;
      avisar(hechos, `Subiendo archivos ${hechos} de ${total}…`);
    }
  });
  await Promise.all(trabajadores);

  // 2) árbol por tramos encadenados. En «reemplazar» el primero NO parte del
  // árbol anterior: así el resultado es exactamente el proyecto.
  // En «añadir» sobre un repo que estaba vacío, el archivo de arranque se
  // quita en este mismo commit (en «reemplazar» ya desaparece solo).
  if (inicializado && modo === "anadir" && !items.some((it) => it.path === ".forja-init")) {
    entries.push({ path: ".forja-init", mode: "100644", type: "blob", sha: null });
  }
  const tramos = tramosDeArbol(entries);
  let base: string | undefined = modo === "anadir" ? head.treeSha : undefined;
  for (let t = 0; t < tramos.length; t++) {
    avisar(total, `Montando el árbol de archivos (${t + 1} de ${tramos.length})…`, t + 1, tramos.length);
    const res = await gh(token, `/repos/${repo.owner}/${repo.repo}/git/trees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(base ? { base_tree: base, tree: tramos[t] } : { tree: tramos[t] }),
    });
    if (!res.ok) await ghJsonError(res, "No se pudo crear el árbol de archivos", token);
    const j = (await res.json()) as { sha?: string };
    if (!j.sha) throw new Error("GitHub no devolvió el árbol de archivos");
    base = j.sha;
  }
  const arbolFinal = base as string;

  // 3) un solo commit y mover la rama
  avisar(total, "Creando el commit…");
  const mensaje =
    opts.mensaje?.trim() ||
    (repo.created
      ? `Sube el proyecto (${total} archivos)`
      : modo === "reemplazar"
        ? `Actualiza el proyecto (${total} archivos)`
        : `Añade ${total} archivos`);
  const commitRes = await gh(token, `/repos/${repo.owner}/${repo.repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: mensaje, tree: arbolFinal, parents: [head.sha] }),
  });
  if (!commitRes.ok) await ghJsonError(commitRes, "No se pudo crear el commit", token);
  const commit = (await commitRes.json()) as { sha?: string };
  if (!commit.sha) throw new Error("GitHub no devolvió el commit");

  const refRes = await gh(token, `/repos/${repo.owner}/${repo.repo}/git/refs/heads/${encodeURIComponent(repo.branch)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  if (!refRes.ok) {
    if (refRes.status === 422) {
      throw new Error(
        `Alguien subió cambios a ${repo.branch} mientras subías: no se ha tocado nada. Vuelve a intentarlo para subir encima de lo último.`
      );
    }
    await ghJsonError(refRes, `No se pudo actualizar la rama ${repo.branch}`, token);
  }

  avisar(total, "Comprobando que quedó publicado…");
  await ghVerificar(gh, token, repo.owner, repo.repo, repo.branch, commit.sha);

  const nuevas = new Set(items.map((it) => it.path));
  const eliminados = inicializado
    ? 0
    : antes
      ? antes.filter((p) => !nuevas.has(p)).length
      : modo === "anadir"
        ? 0
        : null;
  avisar(total, "¡Completado!");
  return { url: repo.url, commits: 1, branch: repo.branch, sha: commit.sha, eliminados, creado: repo.created };
}
