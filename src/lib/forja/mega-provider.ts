/** Forja IA — adaptador MEGA.
 *
 * MEGA no se marca como "conectado" hasta que exista una sesión real. El
 * contrato permite que el Cerebro seleccione MEGA para código/repos/recetas sin
 * fingir que la autenticación o el cifrado ya están implementados.
 */
import type { StorageItem, StorageProvider } from "./storage-providers";

export interface MegaConnectionState {
  connected: boolean;
  email?: string;
  reason?: string;
}

export function megaConnectionState(): MegaConnectionState {
  return {
    connected: false,
    reason: "MEGA requiere una sesión autenticada; no se almacenan contraseñas ni se simula una conexión.",
  };
}

export function createMegaProvider(): StorageProvider {
  const unavailable = async (): Promise<never> => {
    throw new Error("MEGA todavía no está conectado. Configura una sesión MEGA para habilitar este proveedor.");
  };
  return {
    id: "mega",
    label: "MEGA",
    capabilities: { list: false, read: false, write: false, move: false, delete: false, search: false },
    list: unavailable,
    read: unavailable,
    write: unavailable,
    delete: unavailable,
  } as StorageProvider;
}

export function isMegaCodeRole(role: string): boolean {
  return ["code", "repositories", "components", "templates", "forja-recipes"].includes(role);
}

export function megaItemLabel(item: StorageItem): string {
  return `${item.name} · ${item.kind}`;
}
