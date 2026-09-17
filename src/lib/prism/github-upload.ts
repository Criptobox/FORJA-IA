/** Forja IA — Subida directa a GitHub con la Git Data API.
 * Permite subir carpetas completas (más de 100 archivos) en lotes:
 *  - blobs base64 solo para binarios; el texto va embebido en el tree (menos peticiones)
 *  - 1 commit por lote (≈60 archivos o ≈12 MB) sobre la rama main
 *  - crea el repo si no existe (auto_init con README)
 * El token se guarda SOLO en localStorage de tu dispositivo. */
import { isTextPath } from "./sandbox";
import type { ReviewFile } from "./sandbox-review";

export type GhItem = { path: string; file: File };
export type GhProgress = {
  done: number;
  total: number;
  batch: number;
  batches: number;
  message: string;
};

const GH_API = "https://api.github.com";
const TOKEN_KEY = "prism-github-token";
const ACCOUNT_KEY = "prism-github-account";
export const GH_ACCOUNT_EVENT = "prism-github-account";

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
const MAX_FILES_PER_BATCH = 60;
const MAX_BYTES_PER_BATCH = 12 * 1024 * 1024;

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

/** Divide en lotes por número de archivos y peso total */
export function chunkFiles(
  items: GhItem[],
  maxFiles = MAX_FILES_PER_BATCH,
  maxBytes = MAX_BYTES_PER_BATCH
): GhItem[][] {
  const batches: GhItem[][] = [];
  let cur: GhItem[] = [];
  let curBytes = 0;
  for (const it of items) {
    const size = it.file.size;
    if (cur.length > 0 && (cur.length >= maxFiles || curBytes + size > maxBytes)) {
      batches.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(it);
    curBytes += size;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

// ——— helpers HTTP ———

/** El `fetch` que usa la subida. Se puede sustituir para poder PROBAR esto.
 *
 * Sin esto, toda la subida a GitHub era código sin una sola prueba: el fallo
 * de la rama fija vivió versiones enteras porque nada podía ejecutarlo sin
 * una cuenta de GitHub de verdad delante. */
export type GhFetch = (url: string, init?: RequestInit) => Promise<Response>;

function ghFetchCon(fetchImpl?: GhFetch) {
  const f: GhFetch = fetchImpl ?? ((u, i) => fetch(u, i));
  return async (token: string, path: string, init?: RequestInit): Promise<Response> =>
    f(path.startsWith("http") ? path : GH_API + path, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(30000),
    });
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
  throw new Error(`GitHub ${res.status}: ${msg}${pista ? ` — ${pista}` : ""}`);
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

/** Crea el repo (con README) o devuelve el existente si ya estaba.
 *
 * Un 422 ya NO se interpreta como «existe y es mío»: 422 también es un nombre
 * inválido, y el repo puede existir bajo otro dueño. Se pregunta a GitHub. */
export async function ghEnsureRepo(
  token: string,
  name: string,
  isPrivate: boolean,
  fetchImpl?: GhFetch
): Promise<RepoDestino> {
  const gh = ghFetchCon(fetchImpl);
  const login = await ghWhoAmI(token, fetchImpl);
  const res = await gh(token, "/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
      description: "Forja IA — mi chat con modelos gratis (subido desde la app)",
      has_issues: true,
      has_projects: false,
      has_wiki: false,
    }),
  });
  if (res.ok) {
    const j = (await res.json()) as {
      html_url?: string;
      owner?: { login?: string };
      default_branch?: string;
    };
    return {
      owner: j.owner?.login ?? login,
      repo: name,
      url: j.html_url ?? `https://github.com/${login}/${name}`,
      created: true,
      branch: j.default_branch || "main",
    };
  }
  if (res.status === 422) {
    // Puede ser «ya existe» o un nombre que GitHub no acepta. Se comprueba
    // mirando el repo: si está, se usa el suyo —con SU rama—; si no, el 422
    // era de verdad y hay que contarlo.
    const info = await gh(token, `/repos/${login}/${name}`);
    if (info.ok) {
      const j = (await info.json()) as {
        html_url?: string;
        owner?: { login?: string };
        default_branch?: string;
      };
      return {
        owner: j.owner?.login ?? login,
        repo: name,
        url: j.html_url ?? `https://github.com/${login}/${name}`,
        created: false,
        branch: j.default_branch || "main",
      };
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
  token: string,
  owner: string,
  repo: string,
  branch: string,
  fetchImpl?: GhFetch
): Promise<Head> {
  const gh = ghFetchCon(fetchImpl);
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
  | { path: string; mode: "100644"; type: "blob"; content: string }
  | { path: string; mode: "100644"; type: "blob"; sha: string };

async function ghCommitBatch(
  token: string,
  owner: string,
  repo: string,
  batch: GhItem[],
  head: Head,
  message: string,
  branch: string,
  fetchImpl?: GhFetch
): Promise<{ sha: string; treeSha: string }> {
  const ghFetch = ghFetchCon(fetchImpl);
  // 1) blobs base64 solo para binarios con extensión conocida (en paralelo moderado)
  const entries: TreeEntry[] = [];
  const binaryItems = batch.filter((it) => it.file.size < 512 * 1024 && it.path.match(/\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|mp3|mp4|webm|zip)$/i));
  const blobShas = new Map<string, string>();

  const queue = [...binaryItems];
  const workers = Array.from({ length: Math.min(6, queue.length || 1) }, async () => {
    for (;;) {
      const it = queue.shift();
      if (!it) break;
      const bytes = new Uint8Array(await it.file.arrayBuffer());
      const res = await ghFetch(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: toBase64(bytes), encoding: "base64" }),
      });
      if (!res.ok) await ghJsonError(res, `No se pudo subir el blob ${it.path}`, token);
      const j = (await res.json()) as { sha?: string };
      if (j.sha) blobShas.set(it.path, j.sha);
    }
  });
  await Promise.all(workers);

  // 2) árbol: texto embebido, binarios por sha
  const seenBinary = new Set(binaryItems.map((it) => it.path));
  for (const it of batch) {
    if (seenBinary.has(it.path)) {
      entries.push({ path: it.path, mode: "100644", type: "blob", sha: blobShas.get(it.path) ?? "" });
    } else {
      const bytes = new Uint8Array(await it.file.arrayBuffer());
      // binarios sin extensión conocida → también via blob para no corromperlos
      if (!isProbablyText(bytes)) {
        const res = await ghFetch(token, `/repos/${owner}/${repo}/git/blobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: toBase64(bytes), encoding: "base64" }),
        });
        if (!res.ok) await ghJsonError(res, `No se pudo subir el blob ${it.path}`, token);
        const j = (await res.json()) as { sha?: string };
        entries.push({ path: it.path, mode: "100644", type: "blob", sha: j.sha ?? "" });
      } else {
        entries.push({ path: it.path, mode: "100644", type: "blob", content: new TextDecoder().decode(bytes) });
      }
    }
  }

  // 3) tree → 4) commit → 5) mover la rama
  const treeRes = await ghFetch(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(head?.treeSha ? { base_tree: head.treeSha, tree: entries } : { tree: entries }),
  });
  if (!treeRes.ok) await ghJsonError(treeRes, "No se pudo crear el árbol de archivos", token);
  const tree = (await treeRes.json()) as { sha?: string };

  const commitRes = await ghFetch(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: tree.sha, parents: head ? [head.sha] : [] }),
  });
  if (!commitRes.ok) await ghJsonError(commitRes, "No se pudo crear el commit", token);
  const commit = (await commitRes.json()) as { sha?: string; tree?: { sha?: string } };

  const rama = encodeURIComponent(branch);
  if (head) {
    const refRes = await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${rama}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    if (!refRes.ok) await ghJsonError(refRes, `No se pudo actualizar la rama ${branch}`, token);
  } else {
    const refRes = await ghFetch(token, `/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });
    // El 422 de aquí (la rama ya existía) se TRAGABA, y con él se tragaba la
    // subida entera: la app decía «¡Completado!» y en GitHub no había nada.
    // Si la rama apareció mientras subíamos, se mueve; si no se puede, se dice.
    if (!refRes.ok) {
      if (refRes.status !== 422) await ghJsonError(refRes, `No se pudo crear la rama ${branch}`, token);
      const mover = await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${rama}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      if (!mover.ok) await ghJsonError(mover, `No se pudo apuntar la rama ${branch} al commit`, token);
    }
  }
  return { sha: commit.sha ?? "", treeSha: commit.tree?.sha ?? tree.sha ?? "" };
}

/** Comprueba que la rama apunta DE VERDAD a lo que acabamos de subir.
 *
 * Es la única forma honesta de terminar: hasta ahora «¡Completado!» quería
 * decir «no saltó ninguna excepción», que no es lo mismo que «está en
 * GitHub». */
async function ghVerificar(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  fetchImpl?: GhFetch
): Promise<void> {
  const gh = ghFetchCon(fetchImpl);
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

/** Sube todos los archivos en lotes. Devuelve la URL del repo y la rama. */
export async function uploadToGithub(
  token: string,
  opts: {
    repoName: string;
    isPrivate: boolean;
    items: GhItem[];
    onProgress?: (p: GhProgress) => void;
    /** solo para pruebas: sustituye el `fetch` de la subida */
    fetchImpl?: GhFetch;
  }
): Promise<{ url: string; commits: number; branch: string; sha: string }> {
  const { repoName, isPrivate, items, onProgress, fetchImpl } = opts;
  if (!items.length) throw new Error("No hay archivos para subir");

  const repo = await ghEnsureRepo(token, repoName, isPrivate, fetchImpl);
  // La rama del repo, no «main» a ciegas: ese era el fallo. En un repo con
  // «master» se creaba un commit huérfano, el error de la rama se tragaba y la
  // app cantaba victoria con GitHub intacto.
  let head = await ghGetHead(token, repo.owner, repo.repo, repo.branch, fetchImpl);
  const batches = chunkFiles(items);
  let done = 0;
  let ultimo = "";

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    onProgress?.({
      done,
      total: items.length,
      batch: i + 1,
      batches: batches.length,
      message: `Subiendo lote ${i + 1} de ${batches.length} · ${batch.length} archivos…`,
    });
    const message =
      i === 0
        ? `Forja IA: subida inicial (${items.length} archivos)`
        : `Forja IA: lote ${i + 1}/${batches.length}`;
    const newHead = await ghCommitBatch(
      token,
      repo.owner,
      repo.repo,
      batch,
      head,
      message,
      repo.branch,
      fetchImpl
    );
    head = { sha: newHead.sha, treeSha: newHead.treeSha };
    ultimo = newHead.sha;
    done += batch.length;
  }

  onProgress?.({
    done,
    total: items.length,
    batch: batches.length,
    batches: batches.length,
    message: "Comprobando que quedó publicado…",
  });
  await ghVerificar(token, repo.owner, repo.repo, repo.branch, ultimo, fetchImpl);

  onProgress?.({ done, total: items.length, batch: batches.length, batches: batches.length, message: "¡Completado!" });
  return { url: repo.url, commits: batches.length, branch: repo.branch, sha: ultimo };
}
