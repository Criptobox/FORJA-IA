/** Forja IA — integración MEGA para navegador.
 *
 * `megajs` es una dependencia real del proyecto (fijada en package-lock.json,
 * con el hash de integridad de npm), cargada con un `import()` dinámico para
 * no engordar el bundle inicial — el propio Next.js la separa en su propio
 * chunk, que solo se descarga la primera vez que alguien pulsa "Conectar".
 *
 * Antes esta misma idea se implementaba pidiendo el módulo browser de MEGAJS
 * directamente a unpkg.com en tiempo de ejecución (`new Function("url",
 * "return import(url)")(...)`, para esquivar el análisis estático del
 * bundler). Eso cambia qué código se ejecuta en la app según lo que unpkg
 * sirva en cada momento — sin el hash de integridad ni el candado del
 * lockfile que sí tiene una dependencia real — así que se sustituyó por esto:
 * mismo efecto (carga bajo demanda, misma versión 1.3.10), sin extender la
 * confianza de la app a un CDN externo.
 *
 * La contraseña nunca se guarda: solo vive durante el login y la sesión MEGA
 * queda en memoria de esta pestaña. Basado en la API documentada de MEGAJS 1.x.
 *
 * Los tipos de `megajs` no se importan directamente: su `.d.ts` publicado
 * arrastra imports de `https://cdn.deno.land/...` (pensados para Deno) que
 * rompen la resolución de tipos de un proyecto Node/Next normal. Los tipos
 * de aquí abajo son un resumen mínimo, a mano, de lo que este archivo usa.
 */
import type { StorageItem, StorageProvider } from "./storage-providers";

type MegaFile = {
  nodeId?: string;
  name?: string;
  size?: number;
  timestamp?: number;
  directory?: boolean;
  children?: MegaFile[];
  delete?: (permanent?: boolean) => Promise<void>;
  rename?: (name: string) => Promise<unknown>;
  moveTo?: (folder: MegaFile) => Promise<unknown>;
  downloadBuffer?: () => Promise<Uint8Array | ArrayBuffer>;
  link?: () => Promise<string>;
  upload?: (name: string, data: Uint8Array) => { complete: Promise<MegaFile> };
  mkdir?: (name: string) => Promise<MegaFile>;
};

type MegaStorage = {
  root: MegaFile;
  user?: string;
  name?: string;
  getAccountInfo?: () => Promise<{ spaceUsed?: number; spaceTotal?: number }>;
  close?: () => void;
};

type MegaModule = { Storage: new (options: Record<string, unknown>) => { ready: Promise<MegaStorage> } };

let activeStorage: MegaStorage | null = null;
let activeEmail = "";
let loadingModule: Promise<MegaModule> | null = null;

async function loadMega(): Promise<MegaModule> {
  if (!loadingModule) {
    // Especificador literal ("megajs"): así el bundler SÍ lo reconoce y lo
    // separa en su propio chunk, en vez de una URL dinámica que ningún
    // bundler puede analizar en tiempo de build.
    loadingModule = import("megajs") as unknown as Promise<MegaModule>;
  }
  return loadingModule;
}

function requireStorage(): MegaStorage {
  if (!activeStorage) throw new Error("MEGA no está conectado.");
  return activeStorage;
}

function toItem(file: MegaFile, parentId?: string): StorageItem {
  return {
    id: file.nodeId ?? file.name ?? crypto.randomUUID(),
    name: file.name ?? "Sin nombre",
    kind: file.directory ? "folder" : "file",
    sizeBytes: file.directory ? undefined : file.size,
    modifiedAt: file.timestamp ? new Date(file.timestamp * 1000).toISOString() : undefined,
    parentId,
    provider: "mega",
  };
}

export interface MegaConnectionState {
  connected: boolean;
  email?: string;
  name?: string;
}

export function megaConnectionState(): MegaConnectionState {
  return activeStorage ? { connected: true, email: activeEmail, name: activeStorage.name } : { connected: false };
}

export async function connectMega(email: string, password: string, secondFactorCode?: string): Promise<MegaConnectionState> {
  if (typeof window === "undefined") throw new Error("MEGA solo puede conectarse desde el navegador.");
  if (!email.trim() || !password) throw new Error("Introduce el correo y la contraseña de MEGA.");
  const { Storage } = await loadMega();
  const storage = await new Storage({
    email: email.trim(),
    password,
    ...(secondFactorCode?.trim() ? { secondFactorCode: secondFactorCode.trim() } : {}),
    userAgent: "Forja-IA/4.x (MEGAJS browser)",
  }).ready;
  activeStorage?.close?.();
  activeStorage = storage;
  activeEmail = email.trim();
  return megaConnectionState();
}

export function disconnectMega(): void {
  activeStorage?.close?.();
  activeStorage = null;
  activeEmail = "";
}

export async function megaAccountInfo(): Promise<{ spaceUsed: number; spaceTotal: number }> {
  const info = await requireStorage().getAccountInfo?.();
  return { spaceUsed: info?.spaceUsed ?? 0, spaceTotal: info?.spaceTotal ?? 0 };
}

export function createMegaProvider(): StorageProvider {
  return {
    id: "mega",
    label: "MEGA",
    capabilities: { list: true, read: true, write: true, move: true, delete: true, search: true },
    async list(parentId) {
      const root = requireStorage().root;
      const folder = parentId ? findMegaFile(root, parentId) : root;
      if (!folder) throw new Error("Carpeta MEGA no encontrada.");
      return (folder.children ?? []).map((file) => toItem(file, folder.nodeId));
    },
    async read(id) {
      const file = findMegaFile(requireStorage().root, id);
      if (!file?.downloadBuffer) throw new Error("Archivo MEGA no encontrado.");
      const data = await file.downloadBuffer();
      return data instanceof Uint8Array ? data : new Uint8Array(data);
    },
    async write(name, bytes, parentId) {
      const root = requireStorage().root;
      const folder = parentId ? findMegaFile(root, parentId) : root;
      if (!folder?.upload) throw new Error("Carpeta MEGA no encontrada.");
      const file = await folder.upload(name, bytes).complete;
      return toItem(file, folder.nodeId);
    },
    async delete(id) {
      const file = findMegaFile(requireStorage().root, id);
      if (!file?.delete) throw new Error("Archivo MEGA no encontrado.");
      await file.delete(false);
    },
  };
}

function findMegaFile(root: MegaFile, id: string): MegaFile | undefined {
  if (root.nodeId === id) return root;
  for (const child of root.children ?? []) {
    if (child.nodeId === id) return child;
    if (child.directory) {
      const found = findMegaFile(child, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function isMegaCodeRole(role: string): boolean {
  return ["code", "repositories", "components", "templates", "forja-recipes"].includes(role);
}

export function megaItemLabel(item: StorageItem): string {
  return `${item.name} · ${item.kind}`;
}
