/** Forja IA — Cuentas y credenciales de Google Drive (guardadas en el dispositivo).
 *
 * A diferencia de GitHub (una sola cuenta, `github-upload.ts`), Drive
 * admite VARIAS cuentas conectadas a la vez — el plan pide poder sacar
 * información de varios Google Drive — así que aquí se guarda un array,
 * indexado por email.
 *
 * Las credenciales (Client ID + API Key) tampoco pasan por el servidor:
 * ninguna de las dos es secreta (el Client ID es público por diseño; la
 * API Key se restringe por dominio en Google Cloud, pensada para vivir en
 * el navegador) — es justo el mismo trato que ya reciben las API keys de
 * los proveedores de modelos en esta app.
 */
import { GDRIVE_SCOPE, quotaPercent, type GDriveQuota } from "./gdrive-oauth";
import { requestGoogleToken } from "./gdrive-gis";

export interface GDriveAccount {
  email: string;
  name: string;
  avatar: string;
  accessToken: string;
  /** epoch ms en el que caduca `accessToken`. */
  expiresAt: number;
  quota: GDriveQuota;
}

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  iconLink: string;
  webViewLink: string;
}

export interface GDriveCreds {
  clientId: string;
  apiKey: string;
  /** Opcional: número de proyecto de Google Cloud. Solo hace falta para
   * algunas funciones del Picker (Team Drives); casi nadie lo necesita. */
  appId?: string;
}

const ACCOUNTS_KEY = "forja-gdrive-accounts";
const CREDS_KEY = "forja-gdrive-creds";
export const GD_ACCOUNTS_EVENT = "forja-gdrive-accounts";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function gdGetAccounts(): GDriveAccount[] {
  if (typeof localStorage === "undefined") return [];
  const j = safeParse<GDriveAccount[]>(localStorage.getItem(ACCOUNTS_KEY));
  return Array.isArray(j) ? j : [];
}

function persist(accounts: GDriveAccount[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  try {
    window.dispatchEvent(new Event(GD_ACCOUNTS_EVENT));
  } catch {
    /* SSR o sin window */
  }
}

/** Reemplaza la cuenta con el mismo email, o la añade si es nueva. */
export function gdUpsertAccount(account: GDriveAccount): void {
  const accounts = gdGetAccounts();
  const i = accounts.findIndex((a) => a.email === account.email);
  if (i === -1) accounts.push(account);
  else accounts[i] = account;
  persist(accounts);
}

export function gdRemoveAccount(email: string): void {
  persist(gdGetAccounts().filter((a) => a.email !== email));
}

/** Con margen de un minuto: mejor renovar un poco antes que fallar a mitad de una petición. */
export function gdIsTokenExpired(account: GDriveAccount, skewMs = 60_000): boolean {
  return Date.now() + skewMs >= account.expiresAt;
}

export { quotaPercent };

/** El despliegue puede fijar Client ID/API Key para todo el mundo con
 * variables NEXT_PUBLIC_* (ninguna de las dos es secreta, así que Next las
 * puede incluir en el bundle del navegador sin problema) — así Drive
 * funciona sin que cada persona tenga que crear su propio cliente OAuth.
 * Si no están, cada quien pega las suyas y quedan en su propio dispositivo. */
function envCreds(): GDriveCreds | null {
  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();
  const apiKey = (process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "").trim();
  if (!clientId || !apiKey) return null;
  const appId = (process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "").trim();
  return { clientId, apiKey, appId: appId || undefined };
}

export function gdGetCreds(): GDriveCreds | null {
  const fromEnv = envCreds();
  if (fromEnv) return fromEnv;
  if (typeof localStorage === "undefined") return null;
  const local = safeParse<GDriveCreds>(localStorage.getItem(CREDS_KEY));
  return local?.clientId && local?.apiKey ? local : null;
}

export type GDriveCredsSource = "env" | "local" | null;

export function gdCredsSource(): GDriveCredsSource {
  if (envCreds()) return "env";
  if (typeof localStorage !== "undefined" && localStorage.getItem(CREDS_KEY)) return "local";
  return null;
}

export function gdSetCreds(creds: GDriveCreds): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  try {
    window.dispatchEvent(new Event(GD_ACCOUNTS_EVENT));
  } catch {
    /* SSR o sin window */
  }
}

export function gdClearCreds(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CREDS_KEY);
  try {
    window.dispatchEvent(new Event(GD_ACCOUNTS_EVENT));
  } catch {
    /* SSR o sin window */
  }
}

interface GDriveAbout {
  email: string;
  name: string;
  avatar: string;
  quota: GDriveQuota;
}

/** Perfil + cuota de almacenamiento de la cuenta dueña del token — directo
 * a la API de Drive desde el navegador, sin pasar por ningún servidor. */
export async function gdFetchAbout(accessToken: string): Promise<GDriveAbout> {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName,photoLink),storageQuota(limit,usage,usageInDrive)",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("No se pudo leer tu cuenta de Google Drive");
  const j = (await res.json()) as {
    user?: { emailAddress?: string; displayName?: string; photoLink?: string };
    storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
  };
  const q = j.storageQuota ?? {};
  return {
    email: j.user?.emailAddress ?? "",
    name: j.user?.displayName ?? j.user?.emailAddress ?? "",
    avatar: j.user?.photoLink ?? "",
    quota: {
      limit: q.limit ? Number(q.limit) : null,
      usage: q.usage ? Number(q.usage) : 0,
      usageInDrive: q.usageInDrive ? Number(q.usageInDrive) : 0,
    },
  };
}

/** Si el token está a punto de caducar, pide uno nuevo con Google Identity
 * Services (silencioso mientras la sesión de Google siga viva: sin
 * refresh_token que guardar, sin servidor de por medio) y actualiza la
 * cuenta guardada. */
export async function gdEnsureFreshToken(account: GDriveAccount, creds: GDriveCreds): Promise<GDriveAccount> {
  if (!gdIsTokenExpired(account)) return account;
  const { accessToken, expiresIn } = await requestGoogleToken({
    clientId: creds.clientId,
    scope: GDRIVE_SCOPE,
    hint: account.email,
    interactive: false,
  });
  const next: GDriveAccount = { ...account, accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  gdUpsertAccount(next);
  return next;
}

/** Últimos archivos de la cuenta (vista previa; elegir carpetas para
 * indexar en la Knowledge Base llega en la siguiente fase). */
export async function gdListRecentFiles(account: GDriveAccount, creds: GDriveCreds, pageSize = 15): Promise<GDriveFile[]> {
  const fresh = await gdEnsureFreshToken(account, creds);
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,size,modifiedTime,iconLink,webViewLink)",
    q: "trashed = false",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${fresh.accessToken}` },
  });
  if (!res.ok) throw new Error("No se pudo leer los archivos de Drive");
  const j = (await res.json()) as { files?: Array<Partial<GDriveFile>> };
  return (j.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    size: f.size ? Number(f.size) : 0,
    modifiedTime: f.modifiedTime ?? "",
    iconLink: f.iconLink ?? "",
    webViewLink: f.webViewLink ?? "",
  }));
}
