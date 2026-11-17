/** Forja IA — Motor OpenCode de la APK: modelos gratis sin API key ni contraseña.
 *
 * Dentro de la APK corre el OpenCode oficial (Alpine + PRoot), igual que en la
 * app OpenCode Mobile. Cuando está listo, el proveedor «opencode-motor» pasa a
 * apuntar a él (URL y contraseña local que lleva el puente nativo), se cargan
 * sus modelos gratis y quedan activos: la persona no pega nada. Para el resto de
 * la app es un proveedor como cualquier otro (selector, Auto, failover, agente
 * por el camino XML; ver opencode-motor.ts). */
import { useForja } from "./store";
import { makeModelKey } from "./types";
import { fetchModels } from "./chat-client";
import { MOTOR_PROVIDER_ID } from "./opencode-motor";
import { useModelosRotos } from "./modelos-rotos";
import type { EstadoOpenCode } from "./plataforma";

/** El modelo por el que empezar: uno de los gratis más probados de OpenCode, si está. */
export function modeloPorDefecto(modelos: readonly string[]): string | null {
  if (!modelos.length) return null;
  return modelos.find((m) => /big-pickle/i.test(m)) ?? modelos[0];
}

let cargando: Promise<string[]> | null = null;

/** El motor está listo: configura el proveedor, carga los modelos gratis y los activa.
 * Devuelve los modelos cargados (vacío si no ofrece ninguno o no se pudo leer). */
export function aplicarOpenCodeListo(e: EstadoOpenCode): Promise<string[]> {
  if (e.estado !== "listo") return Promise.resolve([]);
  // Dos avisos «listo» seguidos (evento + foto inicial) no deben cargar dos veces.
  if (cargando) return cargando;
  cargando = (async () => {
    const st = useForja.getState();
    st.setProviderConfig(MOTOR_PROVIDER_ID, { enabled: true, apiKey: e.clave, baseUrl: e.url, useProxy: false });
    const cfg = useForja.getState().providers[MOTOR_PROVIDER_ID];
    const modelos = await fetchModels(MOTOR_PROVIDER_ID, { ...cfg, apiKey: e.clave, baseUrl: e.url });
    if (modelos.length) {
      useModelosRotos.getState().limpiarProveedor(MOTOR_PROVIDER_ID);
      useForja.getState().setProviderConfig(MOTOR_PROVIDER_ID, { models: [...modelos], enabled: true });
      // Solo se elige uno por ti si aún no habías elegido ninguno.
      if (!useForja.getState().settings.defaultModelKey) {
        const m = modeloPorDefecto(modelos);
        if (m) useForja.getState().setSettings({ defaultModelKey: makeModelKey(MOTOR_PROVIDER_ID, m) });
      }
    }
    return modelos;
  })().finally(() => {
    cargando = null;
  });
  return cargando;
}
