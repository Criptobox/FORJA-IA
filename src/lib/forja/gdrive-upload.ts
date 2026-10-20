/** Forja IA — Subir archivos a Google Drive (Knowledge Base, Fase 2).
 *
 * Hasta ahora Drive era solo lectura: listar cuentas, ver archivos,
 * elegir con el Picker. Esto es lo nuevo — escribir de verdad — para que
 * "Importar recursos" pueda meter un archivo del dispositivo en la cuenta
 * y carpeta que decida la clasificación, en vez de solo indexar lo que ya
 * estaba en Drive.
 */
import { gdEnsureFreshToken, type GDriveAccount, type GDriveCreds } from "./gdrive";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Las comillas simples rompen la query de Drive si no se escapan. */
function escapeDriveQueryValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Busca una carpeta por nombre dentro de `parentId` (root por defecto) en
 * esa cuenta; si no existe, la crea. Devuelve también la cuenta con el
 * token ya renovado si hizo falta, para que quien llame no tenga que
 * volver a comprobarlo antes de subir el archivo. */
export async function findOrCreateFolder(
  account: GDriveAccount,
  creds: GDriveCreds,
  name: string,
  parentId = "root"
): Promise<{ folderId: string; account: GDriveAccount }> {
  const fresh = await gdEnsureFreshToken(account, creds);
  const q = `name = '${escapeDriveQueryValue(name)}' and mimeType = '${FOLDER_MIME}' and '${parentId}' in parents and trashed = false`;
  const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "1" });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: authHeaders(fresh.accessToken),
  });
  if (!res.ok) throw new Error("No se pudo buscar la carpeta en Drive");
  const found = (await res.json()) as { files?: Array<{ id?: string }> };
  const existingId = found.files?.[0]?.id;
  if (existingId) return { folderId: existingId, account: fresh };

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { ...authHeaders(fresh.accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!createRes.ok) throw new Error("No se pudo crear la carpeta en Drive");
  const created = (await createRes.json()) as { id?: string };
  if (!created.id) throw new Error("Drive no devolvió el id de la carpeta creada");
  return { folderId: created.id, account: fresh };
}

function buildMultipartBody(boundary: string, metadata: unknown, mimeType: string, bytes: ArrayBuffer): Blob {
  const CRLF = "\r\n";
  const head =
    `--${boundary}${CRLF}Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}` +
    `${JSON.stringify(metadata)}${CRLF}--${boundary}${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`;
  const tail = `${CRLF}--${boundary}--`;
  return new Blob([head, bytes, tail]);
}

export interface UploadedFile {
  id: string;
  webViewLink: string;
  account: GDriveAccount;
}

/** Sube los bytes del archivo a una carpeta ya existente. */
export async function uploadFileToDrive(
  account: GDriveAccount,
  creds: GDriveCreds,
  file: File,
  folderId: string
): Promise<UploadedFile> {
  const fresh = await gdEnsureFreshToken(account, creds);
  const boundary = `forja-${Math.random().toString(36).slice(2)}`;
  const bytes = await file.arrayBuffer();
  const body = buildMultipartBody(boundary, { name: file.name, parents: [folderId] }, file.type || "application/octet-stream", bytes);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { ...authHeaders(fresh.accessToken), "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error("No se pudo subir el archivo a Drive");
  const j = (await res.json()) as { id?: string; webViewLink?: string };
  if (!j.id) throw new Error("Drive no devolvió el id del archivo subido");
  return { id: j.id, webViewLink: j.webViewLink ?? "", account: fresh };
}

/** La cuenta con más espacio libre entre las conectadas — el criterio más
 * simple y explicable para repartir cuando hay varias y ninguna razón más
 * fuerte (una carpeta ya existente ahí, por ejemplo) para preferir otra.
 * Cuentas sin límite (Workspace ilimitado) siempre ganan. */
export function pickAccountWithMostSpace(accounts: GDriveAccount[]): GDriveAccount | undefined {
  if (accounts.length === 0) return undefined;
  return accounts.reduce((best, a) => {
    const freeA = a.quota.limit ? a.quota.limit - a.quota.usage : Infinity;
    const freeBest = best.quota.limit ? best.quota.limit - best.quota.usage : Infinity;
    return freeA > freeBest ? a : best;
  });
}
