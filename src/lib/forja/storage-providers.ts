/**
 * Forja IA — contrato unificado de almacenamiento.
 *
 * Google Drive: referencias/documentos/Knowledge Base.
 * MEGA: código, repos, componentes, datasets y recetas.
 * El Cerebro habla con este contrato y no con SDKs concretos.
 */

export type StorageProviderId = "google-drive" | "mega";

export interface StorageItem {
  id: string;
  name: string;
  kind: "file" | "folder";
  mimeType?: string;
  sizeBytes?: number;
  modifiedAt?: string;
  parentId?: string;
  webUrl?: string;
  provider: StorageProviderId;
}

export interface StorageProvider {
  id: StorageProviderId;
  label: string;
  capabilities: {
    list: boolean;
    read: boolean;
    write: boolean;
    move: boolean;
    delete: boolean;
    search: boolean;
  };
  list(parentId?: string): Promise<StorageItem[]>;
  read(id: string): Promise<Uint8Array>;
  write(name: string, bytes: Uint8Array, parentId?: string): Promise<StorageItem>;
  delete(id: string): Promise<void>;
}

export const STORAGE_ROLES: Record<StorageProviderId, string[]> = {
  "google-drive": ["knowledge", "references", "documents", "images", "datasets", "licenses"],
  mega: ["code", "repositories", "components", "templates", "datasets", "forja-recipes"],
};

/** MEGA queda como contrato hasta conectar una sesión/SDK real. No finge una implementación. */
export function storageRoleFor(provider: StorageProviderId): string {
  return STORAGE_ROLES[provider].join(", ");
}
