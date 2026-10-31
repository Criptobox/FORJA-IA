/** Forja IA — Motor nativo de la APK: ajustes y enganche con la app.
 *
 * Cuando el motor de la APK está listo, el proveedor «nativo» pasa a apuntar a
 * él (URL, clave de la sesión, modelo) y queda como modelo por defecto. Así el
 * chat, el agente y la creación de páginas lo usan sin tocar nada más: para el
 * resto de la app es un servidor OpenAI-compatible como cualquier otro.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useForja } from "./store";
import { makeModelKey } from "./types";
import type { EstadoMotor } from "./plataforma";

export interface AjustesNativo {
  /** Último modelo elegido: se arranca solo al abrir la app. */
  modelo: string | null;
  /** 16.384 por defecto: con menos, las herramientas del agente no caben. */
  contexto: number;
  hilos: number;
  set: (p: Partial<Omit<AjustesNativo, "set">>) => void;
}

export const useNativoAjustes = create<AjustesNativo>()(
  persist(
    (set) => ({
      modelo: null,
      contexto: 16384,
      hilos: 4,
      set: (p) => set(p),
    }),
    { name: "forja-nativo-v1", storage: createJSONStorage(() => localStorage) }
  )
);

/** El motor está listo: el proveedor «nativo» apunta a él y queda por defecto. */
export function aplicarMotorListo(e: EstadoMotor): void {
  if (e.estado !== "listo" || !e.modelo) return;
  const st = useForja.getState();
  st.setProviderConfig("nativo", {
    enabled: true,
    models: [e.modelo],
    apiKey: e.clave,
    baseUrl: e.url,
    useProxy: false,
  });
  st.setSettings({ defaultModelKey: makeModelKey("nativo", e.modelo) });
}
