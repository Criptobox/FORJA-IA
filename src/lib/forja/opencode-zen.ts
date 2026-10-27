/** Forja IA — OpenCode Zen: modo «sin clave» y diagnóstico honesto.
 *
 * Zen es una pasarela compatible con OpenAI (`/zen/v1`). Sus modelos `-free`
 * han funcionado con la clave pública «public» en unas épocas y han exigido
 * clave gratuita en otras (las dos cosas están documentadas por terceros), así
 * que aquí NO se da por hecho ninguna: Forja IA lo INTENTA sin clave y, si Zen
 * contesta que hace falta, lo dice con la causa y qué hacer. Sin servidor, sin
 * instalar OpenCode: las peticiones salen del navegador (o del proxy
 * anti-SSRF incluido) directamente a opencode.ai.
 *
 * Todo lo de este archivo es puro: se prueba sin red. */

/** Clave anónima que usa el propio OpenCode para sus modelos gratuitos. */
export const ZEN_CLAVE_ANONIMA = "public";

/** Proveedores que PUEDEN funcionar sin clave pero no lo garantizan. A
 * diferencia de los locales (Ollama…), aquí un fallo de acceso es esperable. */
export const PROVEEDORES_CLAVE_OPCIONAL = ["opencode"] as const;

export function esClaveOpcional(providerId: string): boolean {
  return (PROVEEDORES_CLAVE_OPCIONAL as readonly string[]).includes(providerId);
}

/** La clave que viaja de verdad: la tuya si la hay; si no, la anónima solo en
 * los proveedores de clave opcional. En el resto, vacía (como antes). */
export function claveEfectiva(providerId: string, apiKey: string): string {
  const k = (apiKey ?? "").trim();
  if (k) return k;
  return esClaveOpcional(providerId) ? ZEN_CLAVE_ANONIMA : "";
}

/** ¿Es un modelo gratuito del catálogo de Zen? Solo por el sufijo `-free`:
 * lo que el catálogo no marca así no se presume gratis. */
export function esModeloGratisZen(id: string): boolean {
  return /-free$/i.test(id.trim());
}

export type EstadoSondeoZen =
  /** Zen contestó con un modelo gratis sin clave: se puede usar ya. */
  | "abierto"
  /** Zen exige clave incluso para los gratis (403 FreeTierError / 401). */
  | "requiere-clave"
  /** La clave que mandaste no vale. */
  | "clave-invalida"
  /** El catálogo no trae ningún `-free` ahora mismo. */
  | "sin-modelos-gratis"
  /** Zen falla (5xx) o no hay red: no es culpa de la clave. */
  | "servicio"
  | "otro";

export interface ResultadoSondeoZen {
  estado: EstadoSondeoZen;
  /** Modelos `-free` del catálogo vivo (puede venir aunque falle el chat). */
  gratis: string[];
  /** Texto para mostrar a la persona, en español y accionable. */
  mensaje: string;
  status?: number;
}

/** Interpreta la respuesta de UNA llamada de chat de prueba. Pura. */
export function clasificarRespuestaZen(
  status: number,
  cuerpo: string,
  conClave: boolean
): { estado: EstadoSondeoZen; mensaje: string } {
  if (status >= 200 && status < 300) {
    return {
      estado: "abierto",
      mensaje: conClave
        ? "Zen respondió con tu clave."
        : "Zen respondió sin clave: los modelos gratis están abiertos.",
    };
  }
  const freeTier = /FreeTierError|free[\s_-]?tier/i.test(cuerpo);
  if (status === 403 && freeTier) {
    return {
      estado: "requiere-clave",
      mensaje:
        "Zen exige una clave incluso para los modelos gratis (FreeTierError). " +
        "Créala gratis en opencode.ai/auth y pégala aquí.",
    };
  }
  if (status === 401 || status === 403) {
    return conClave
      ? { estado: "clave-invalida", mensaje: "Zen rechazó tu clave. Revísala en opencode.ai/auth." }
      : {
          estado: "requiere-clave",
          mensaje: "Zen no admite peticiones anónimas ahora mismo. Crea una clave en opencode.ai/auth.",
        };
  }
  if (status === 429) {
    return { estado: "otro", mensaje: "Zen limita las peticiones gratis por IP o por clave: espera un poco." };
  }
  if (status >= 500) {
    return { estado: "servicio", mensaje: `Zen devolvió un error de servidor (HTTP ${status}); no es tu clave.` };
  }
  return { estado: "otro", mensaje: `Zen respondió HTTP ${status}.` };
}

/** Extrae los ids `-free` de la respuesta de `GET /models`. Pura. */
export function modelosGratisDeCatalogo(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(esModeloGratisZen))].sort();
}
