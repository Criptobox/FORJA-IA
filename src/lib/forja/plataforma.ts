/** Forja IA — ¿Dentro de la APK de Android o en un navegador?
 *
 * La APK (android/forja-app) lleva la interfaz exportada en estático y añade
 * un puente nativo, `window.ForjaAndroid`: importar modelos .gguf, arrancar
 * llama.cpp compilado para el móvil y actualizar la propia app. Aquí vive el
 * contrato de ese puente para que el resto de la app no toque `window`.
 *
 * Las operaciones largas (copiar un modelo de 1 GB, cargarlo, descargar una
 * actualización) no bloquean: el puente contesta al momento y luego avisa con
 * eventos `forja-android` en `window` (ver `escucharAndroid`).
 */

/** Build de la APK: sin servidor (las rutas de `src/app/api` no existen). */
export const EN_APK = process.env.NEXT_PUBLIC_FORJA_ANDROID === "1";

/** Lo que expone la app Android. Lo monta un script de arranque sobre un canal
 * de mensajes que solo existe para el origen propio y el marco principal (las
 * páginas generadas de la vista previa, en iframes, no lo ven). Las lecturas
 * devuelven la última foto que mandó el lado nativo; `listo` se resuelve con
 * la primera. */
export interface PuenteAndroid {
  listo?: Promise<void>;
  /** JSON de `InfoAndroid`. */
  info(): string;
  /** JSON de `ModeloNativo[]`. */
  modelos(): string;
  /** Abre el selector de archivos; avisa con «importando» e «importado». */
  elegirModelo(): void;
  borrarModelo(nombre: string): void;
  /** Arranca llama-server con ese modelo; avisa con «motor». */
  iniciar(nombre: string, contexto: number, hilos: number): void;
  detener(): void;
  /** JSON de `EstadoMotor`. */
  estadoMotor(): string;
  /** Mira si hay APK nueva; avisa con «actualizacion». */
  buscarActualizacion(): void;
  /** Descarga e instala la APK nueva; avisa con «descarga». */
  instalarActualizacion(): void;
}

export interface InfoAndroid {
  version: string;
  versionCode: number;
  ramTotalMB: number;
  ramDisponibleMB: number;
  nucleos: number;
}

export interface ModeloNativo {
  nombre: string;
  bytes: number;
}

export interface EstadoMotor {
  estado: "parado" | "cargando" | "listo" | "error";
  modelo: string | null;
  contexto: number;
  /** URL base OpenAI-compatible del motor (http://127.0.0.1:PUERTO/v1). */
  url: string;
  /** Clave de esta sesión del motor: sin ella, otras apps del móvil no pueden usarlo. */
  clave: string;
  detalle?: string;
}

export type EventoAndroid =
  /** Llegó una foto nueva (modelos, motor, info): vuelve a leerlas. */
  | { tipo: "estado" }
  | { tipo: "importando"; nombre: string; progreso: number }
  | { tipo: "importado"; nombre: string }
  | { tipo: "motor"; estado: EstadoMotor }
  | { tipo: "actualizacion"; disponible: boolean; version?: string; notas?: string; error?: string }
  | { tipo: "descarga"; progreso: number; error?: string }
  | { tipo: "error"; mensaje: string };

/** El puente, si la página corre dentro de la APK. */
export function puenteAndroid(): PuenteAndroid | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ForjaAndroid?: PuenteAndroid }).ForjaAndroid ?? null;
}

/** JSON del puente, sin reventar si viene roto. */
export function leerJson<T>(texto: string | null | undefined, porDefecto: T): T {
  try {
    return texto ? (JSON.parse(texto) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

/** Escucha los avisos del puente. Devuelve la función para dejar de escuchar. */
export function escucharAndroid(fn: (e: EventoAndroid) => void): () => void {
  const h = (ev: Event) => fn((ev as CustomEvent<EventoAndroid>).detail);
  window.addEventListener("forja-android", h);
  return () => window.removeEventListener("forja-android", h);
}

/** Estado del motor nativo, o null fuera de la APK. */
export function estadoMotorNativo(): EstadoMotor | null {
  const p = puenteAndroid();
  return p ? leerJson<EstadoMotor | null>(p.estadoMotor(), null) : null;
}
