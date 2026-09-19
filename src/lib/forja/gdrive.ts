/** Forja IA — Cuentas de Google Drive conectadas (guardadas en el dispositivo).
 *
 * A diferencia de GitHub (una sola cuenta, `github-upload.ts`), Drive
 * admite VARIAS cuentas conectadas a la vez — el plan pide poder sacar
 * información de varios Google Drive — así que aquí se guarda un array,
 * indexado por email.
 */
import { accessCodeHeaders } from "./chat-client";
import { quotaPercent, type GDriveQuota } from "./gdrive-oauth";

export interface GDriveAccount {
  email: string;
  name: string;
  avatar: string;
  accessToken: string;
  refreshToken: string;
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

const ACCOUNTS_KEY = "forja-gdrive-accounts";
export const GD_ACCOUNTS_EVENT = "forja-gdrive-accounts";

function safeParse(raw: string | null): GDriveAccount[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? (j as GDriveAccount[]) : [];
  } catch {
    return [];
  }
}

export function gdGetAccounts(): GDriveAccount[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(ACCOUNTS_KEY));
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

/** Con margen de un minuto: mejor refrescar un poco antes que fallar a mitad de una petición. */
export function gdIsTokenExpired(account: GDriveAccount, skewMs = 60_000): boolean {
  return Date.now() + skewMs >= account.expiresAt;
}

export { quotaPercent };

/** Si el token está a punto de caducar, lo renueva contra nuestro servidor
 * (necesita el client_secret, que el navegador no tiene) y actualiza la
 * cuenta guardada. Devuelve la cuenta con un `accessToken` utilizable. */
export async function gdEnsureFreshToken(account: GDriveAccount): Promise<GDriveAccount> {
  if (!gdIsTokenExpired(account)) return account;
  const res = await fetch("/api/gdrive/oauth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...accessCodeHeaders() },
    body: JSON.stringify({ refreshToken: account.refreshToken }),
  });
  const j = (await res.json()) as { accessToken?: string; expiresIn?: number; error?: string };
  if (!res.ok || !j.accessToken) {
    throw new Error(j.error || "No se pudo renovar el acceso a Google Drive");
  }
  const next: GDriveAccount = {
    ...account,
    accessToken: j.accessToken,
    expiresAt: Date.now() + (j.expiresIn ?? 3600) * 1000,
  };
  gdUpsertAccount(next);
  return next;
}

/** Últimos archivos de la cuenta (vista previa; la selección de carpetas a
 * indexar en la Knowledge Base llega en la siguiente fase). Google acepta
 * llamadas de la API de Drive directas desde el navegador con el token
 * Bearer, sin pasar por nuestro servidor. */
export async function gdListRecentFiles(account: GDriveAccount, pageSize = 15): Promise<GDriveFile[]> {
  const fresh = await gdEnsureFreshToken(account);
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
