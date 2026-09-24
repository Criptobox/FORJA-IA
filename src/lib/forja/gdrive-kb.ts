/** Forja IA — Google Drive como Knowledge Base legible (varias cuentas).
 *
 * Reparto de proveedores: Google Drive guarda el CONOCIMIENTO (una cuenta
 * por área: diseño, y las que vengan) y MEGA guarda solo CÓDIGO. Este
 * módulo es la mitad de Drive:
 *
 *   - `gdReadKBFile`: descarga el contenido de UN archivo con la cuenta que
 *     lo indexó (`accountEmail`). Si esa cuenta ya no está conectada, o no
 *     puede verlo, prueba con las demás cuentas conectadas: un archivo
 *     compartido entre cuentas sigue siendo legible.
 *   - `gdListFolderTree`: recorre una carpeta (la raíz de un área, p. ej.
 *     «DISEÑO») para indexarla entera de una vez.
 *   - `driveFileToKBResource` y `enrichFromForjaIndex`: convierten lo listado
 *     en recursos del índice local, con categoría sacada de la carpeta y las
 *     etiquetas del `29-INDICES/INDEX.json` de la propia cuenta si existe.
 *
 * Solo viaja metadata al índice: el contenido se pide bajo demanda
 * (`kb-content-retrieval.ts`), nunca se copia la biblioteca entera.
 */
import { gdEnsureFreshToken, gdGetAccounts, gdGetCreds, gdIsTokenExpired, type GDriveAccount, type GDriveCreds } from "./gdrive";
import type { KBResource } from "./kb-index";

const API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Documentos nativos de Google (no tienen bytes propios): se exportan a
 * texto. Cualquier otro `application/vnd.google-apps.*` (formularios,
 * atajos, mapas…) no tiene una representación de texto útil. */
const GOOGLE_EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

/** Carpetas que no son conocimiento todavía: la bandeja de entrada guarda
 * material pendiente de análisis o de licencia (regla de FILE-FORMATS.md). */
const SKIPPED_FOLDERS = /^99-inbox$/i;

export interface GDriveTreeFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  webViewLink: string;
  /** Ruta desde la carpeta raíz recorrida, incluida ella: «DISEÑO/07-COLOR/contraste/contraste.md». */
  path: string;
}

export interface GDriveTreeOptions {
  maxFiles?: number;
  maxDepth?: number;
  onProgress?: (found: number) => void;
}

/** Acepta el id suelto o cualquier enlace de Drive a una carpeta/archivo. */
export function parseDriveId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const fromPath = s.match(/\/(?:folders|d)\/([A-Za-z0-9_-]{10,})/);
  if (fromPath) return fromPath[1]!;
  const fromQuery = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (fromQuery) return fromQuery[1]!;
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : null;
}

async function driveJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google Drive respondió ${res.status} al listar la carpeta.`);
  return (await res.json()) as T;
}

async function freshToken(account: GDriveAccount, creds: GDriveCreds | null): Promise<GDriveAccount> {
  if (!gdIsTokenExpired(account)) return account;
  if (!creds) throw new Error("La sesión de Google Drive caducó y faltan las credenciales para renovarla.");
  return gdEnsureFreshToken(account, creds);
}

/** Recorre una carpeta en anchura, con topes de archivos y profundidad para
 * que una carpeta enorme no bloquee la pestaña. */
export async function gdListFolderTree(
  account: GDriveAccount,
  creds: GDriveCreds | null,
  rootId: string,
  options: GDriveTreeOptions = {},
): Promise<{ rootName: string; files: GDriveTreeFile[]; truncated: boolean }> {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(rootId)) throw new Error("Id de carpeta de Drive no válido.");
  const maxFiles = options.maxFiles ?? 3000;
  const maxDepth = options.maxDepth ?? 8;
  let acc = await freshToken(account, creds);

  const root = await driveJson<{ id?: string; name?: string; mimeType?: string }>(
    `${API}/files/${encodeURIComponent(rootId)}?fields=id,name,mimeType&supportsAllDrives=true`,
    acc.accessToken,
  );
  if (root.mimeType !== FOLDER_MIME) throw new Error("Ese enlace no es una carpeta de Drive.");
  const rootName = root.name ?? "Drive";

  const files: GDriveTreeFile[] = [];
  const queue: Array<{ id: string; path: string; depth: number }> = [{ id: rootId, path: rootName, depth: 0 }];
  let truncated = false;

  while (queue.length) {
    const folder = queue.shift()!;
    let pageToken: string | undefined;
    do {
      acc = await freshToken(acc, creds);
      const params = new URLSearchParams({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)",
        pageSize: "1000",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await driveJson<{
        nextPageToken?: string;
        files?: Array<{ id?: string; name?: string; mimeType?: string; size?: string; modifiedTime?: string; webViewLink?: string }>;
      }>(`${API}/files?${params}`, acc.accessToken);

      for (const f of page.files ?? []) {
        if (!f.id || !f.name) continue;
        const path = `${folder.path}/${f.name}`;
        if (f.mimeType === FOLDER_MIME) {
          if (SKIPPED_FOLDERS.test(f.name)) continue;
          if (folder.depth + 1 <= maxDepth) queue.push({ id: f.id, path, depth: folder.depth + 1 });
          else truncated = true;
          continue;
        }
        if (files.length >= maxFiles) {
          truncated = true;
          break;
        }
        files.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType ?? "",
          size: f.size ? Number(f.size) : 0,
          modifiedTime: f.modifiedTime ?? "",
          webViewLink: f.webViewLink ?? "",
          path,
        });
      }
      options.onProgress?.(files.length);
      pageToken = files.length >= maxFiles ? undefined : page.nextPageToken;
    } while (pageToken);
    if (files.length >= maxFiles) {
      truncated = truncated || queue.length > 0;
      break;
    }
  }

  return { rootName, files, truncated };
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** «07-COLOR» → «color»; «23-PATRONES-A-EVITAR» → «patrones-a-evitar». */
export function categoryFromFolder(folder: string): string {
  return slug(folder.replace(/^\d{1,3}[-_ ]+/, ""));
}

/** Convierte un archivo listado en recurso del índice. La primera carpeta
 * bajo la raíz es la categoría; la raíz (el área: «DISEÑO») y las
 * subcarpetas pasan a etiquetas para que la búsqueda por tema funcione. */
export function driveFileToKBResource(file: GDriveTreeFile, accountEmail: string, now = new Date().toISOString()): KBResource {
  const segments = file.path.split("/");
  const folders = segments.slice(0, -1);
  const area = folders[0] ?? "";
  const category = folders[1] ? categoryFromFolder(folders[1]) : "";
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  const tags = [
    ...new Set(
      [slug(area), ...folders.slice(2).map(slug), slug(file.name.replace(/\.[^.]+$/, "")), ext]
        .filter((t) => t && t !== category),
    ),
  ];
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType || "application/octet-stream",
    sizeBytes: file.size,
    accountEmail,
    webViewLink: file.webViewLink,
    category,
    tags,
    technology: "",
    license: "",
    status: category ? "clasificado" : "pendiente",
    indexedAt: now,
    relativePath: file.path,
    sourceKind: "drive",
    sourceProvider: "google-drive",
    remoteId: file.id,
  };
}

interface ForjaIndexEntry {
  drive_id?: string;
  tags?: string[];
  aliases?: string[];
  license?: string;
}

/** Si la cuenta trae su propio índice (`29-INDICES/INDEX.json`, esquema
 * FORJA), sus etiquetas y licencia completan las que salen de la ruta.
 * Un índice mal formado se ignora: la ruta ya da una clasificación útil. */
export function enrichFromForjaIndex(resources: KBResource[], indexJson: string): { resources: KBResource[]; enriched: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(indexJson);
  } catch {
    return { resources, enriched: 0 };
  }
  const list = (parsed as { resources?: unknown })?.resources;
  if (!Array.isArray(list)) return { resources, enriched: 0 };
  const defaultLicense = /license=([a-z0-9-]+)/i.exec(String((parsed as { _schema?: unknown })._schema ?? ""))?.[1] ?? "";
  const byDriveId = new Map<string, ForjaIndexEntry>();
  for (const e of list as ForjaIndexEntry[]) if (e && typeof e.drive_id === "string") byDriveId.set(e.drive_id, e);

  let enriched = 0;
  const out = resources.map((r) => {
    const entry = byDriveId.get(r.id);
    if (!entry) return r;
    enriched++;
    const extra = [...(entry.tags ?? []), ...(entry.aliases ?? [])].filter((t): t is string => typeof t === "string").map(slug);
    return {
      ...r,
      tags: [...new Set([...r.tags, ...extra].filter(Boolean))],
      license: entry.license || r.license || defaultLicense,
    };
  });
  return { resources: out, enriched };
}

/** Cuentas en el orden en que se intentan: primero la que indexó el
 * archivo, después el resto. */
function accountsFor(email: string): GDriveAccount[] {
  const all = gdGetAccounts();
  const owner = all.filter((a) => a.email === email);
  return [...owner, ...all.filter((a) => a.email !== email)];
}

async function downloadWith(account: GDriveAccount, creds: GDriveCreds | null, fileId: string, mimeType: string): Promise<Response> {
  const acc = await freshToken(account, creds);
  const exportAs = GOOGLE_EXPORTS[mimeType];
  const url = exportAs
    ? `${API}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportAs)}`
    : `${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  return fetch(url, { headers: { Authorization: `Bearer ${acc.accessToken}` } });
}

/** Descarga el contenido de un archivo de Drive indexado. Lanza con un
 * mensaje claro si ninguna cuenta conectada puede leerlo. */
export async function gdReadKBFile(resource: Pick<KBResource, "id" | "remoteId" | "accountEmail" | "mimeType" | "name">): Promise<Uint8Array> {
  const fileId = resource.remoteId || resource.id;
  if (resource.mimeType.startsWith("application/vnd.google-apps.") && !GOOGLE_EXPORTS[resource.mimeType]) {
    throw new Error(`«${resource.name}» es un tipo nativo de Google sin versión en texto.`);
  }
  const accounts = accountsFor(resource.accountEmail);
  if (!accounts.length) throw new Error("No hay ninguna cuenta de Google Drive conectada.");
  const creds = gdGetCreds();
  let lastStatus = 0;
  for (const account of accounts) {
    let res: Response;
    try {
      res = await downloadWith(account, creds, fileId, resource.mimeType);
    } catch {
      continue; // token que no se pudo renovar: se prueba la siguiente cuenta
    }
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    lastStatus = res.status;
    // 401/403/404 = esta cuenta no puede verlo; cualquier otro error es de Drive, no de permisos
    if (![401, 403, 404].includes(res.status)) break;
  }
  const owner = gdGetAccounts().some((a) => a.email === resource.accountEmail);
  throw new Error(
    owner
      ? `Google Drive no dejó leer «${resource.name}» (${lastStatus || "sin respuesta"}).`
      : `«${resource.name}» se indexó con ${resource.accountEmail}, que no está conectada, y ninguna otra cuenta puede leerlo.`,
  );
}
