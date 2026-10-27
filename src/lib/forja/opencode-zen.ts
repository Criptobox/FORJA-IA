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

/** Gratuitos que la documentación de OpenCode cita SIN el sufijo `-free`. */
const GRATIS_SIN_SUFIJO = ["big-pickle"];

/** ¿Es un modelo gratuito del catálogo de Zen? Por el sufijo `-free` o por la
 * lista corta de los documentados sin él: lo demás no se presume gratis. */
export function esModeloGratisZen(id: string): boolean {
  const m = id.trim().toLowerCase();
  return /-free$/.test(m) || GRATIS_SIN_SUFIJO.includes(m);
}

/** Zen no usa el mismo endpoint para todos sus modelos: GPT va por
 * `/responses`, Claude/Qwen/MiniMax por `/messages` y Gemini por una ruta
 * propia. Forja IA habla `/chat/completions`, y contra esos modelos Zen
 * responde 400/404. Se apartan del catálogo en vez de dejar que fallen. */
export function hablaChatCompletions(id: string): boolean {
  return !/^(gpt-|o\d|claude|qwen|minimax|gemini)/i.test(id.trim());
}

/** Saca el mensaje legible de un cuerpo de error (JSON de OpenAI o texto). */
export function detalleDeError(cuerpo: string): string {
  const t = (cuerpo ?? "").trim();
  if (!t) return "";
  try {
    const j = JSON.parse(t);
    const d = j?.error?.message ?? j?.message ?? j?.error ?? t;
    return (typeof d === "string" ? d : JSON.stringify(d)).slice(0, 240);
  } catch {
    return t.slice(0, 240);
  }
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

/** Qué pasó con UN modelo gratis al llamarlo de verdad. */
export type VeredictoModeloZen = "funciona" | "retirado" | "limitado" | "requiere-clave" | "otro";

export interface ModeloZenProbado {
  id: string;
  veredicto: VeredictoModeloZen;
  status?: number;
}

export interface ResultadoSondeoZen {
  estado: EstadoSondeoZen;
  /** Si el sondeo llegó a llamar: los que RESPONDEN. Si no: el catálogo `-free`. */
  gratis: string[];
  /** Resultado modelo a modelo (vacío si no llegó a llamarlos). */
  probados?: ModeloZenProbado[];
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
  if (status === 400 || status === 404 || status === 422) {
    const d = detalleDeError(cuerpo);
    return {
      estado: "otro",
      mensaje: `Zen rechazó la petición de prueba (HTTP ${status})${d ? `: ${d}` : ""}. ` +
        "Suele ser un modelo que no usa /chat/completions.",
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
  return [...new Set(ids.filter((id) => esModeloGratisZen(id) && hablaChatCompletions(id)))].sort();
}

/** Veredicto de una llamada de chat a UN modelo. Pura. Zen retira los `-free`
 * sin avisar y entonces contesta 400 «Upstream request failed: Model is
 * unavailable»: el modelo está en el catálogo pero ya no se sirve. */
export function clasificarModeloZen(status: number, cuerpo: string): VeredictoModeloZen {
  if (status >= 200 && status < 300) return "funciona";
  if (/model is unavailable|deprecated|no longer (?:available|supported)/i.test(cuerpo)) return "retirado";
  if (status === 429 || /FreeUsageLimit|rate.?limit/i.test(cuerpo)) return "limitado";
  if (status === 401 || (status === 403 && /FreeTierError|free[\s_-]?tier/i.test(cuerpo))) return "requiere-clave";
  return "otro";
}

/** Catálogo oficial de OpenCode: https://models.dev/api.json (el mismo que usa
 * OpenCode por dentro). Trae el coste de cada modelo, que es la prueba de que
 * es gratis de verdad, y su estado (`deprecated` = ya no se sirve). */
export const URL_CATALOGO_OFICIAL = "https://models.dev/api.json";

/** Ids con coste cero y no retirados del proveedor `opencode` en models.dev.
 * Tolerante a forma rara: si algo no cuadra devuelve []. Pura. */
export function gratisDelCatalogoOficial(json: unknown): string[] {
  const raiz = json as Record<string, unknown> | null;
  if (!raiz || typeof raiz !== "object") return [];
  const prov = (raiz["opencode"] ?? Object.values(raiz).find((v) => (v as { id?: string })?.id === "opencode")) as
    | { models?: Record<string, { id?: string; cost?: { input?: unknown; output?: unknown }; status?: string }> }
    | undefined;
  const modelos = prov?.models;
  if (!modelos || typeof modelos !== "object") return [];
  const out: string[] = [];
  for (const [clave, m] of Object.entries(modelos)) {
    if (!m || m.status === "deprecated") continue;
    const c = m.cost;
    if (!c || Number(c.input) !== 0 || Number(c.output) !== 0) continue;
    if (c.input === null || c.output === null || c.input === "" || c.output === "") continue;
    out.push(String(m.id ?? clave));
  }
  return out;
}

/** Une el catálogo vivo de Zen (los `-free`) con el oficial (coste $0): lo que
 * salga en cualquiera de los dos, sin duplicados y solo lo que habla
 * `/chat/completions`. Luego cada uno se comprueba con una llamada real. */
export function unirGratisZen(vivos: readonly string[], oficiales: readonly string[]): string[] {
  const todos = new Set<string>();
  for (const id of [...vivos, ...oficiales]) {
    const limpio = id.trim();
    if (limpio && hablaChatCompletions(limpio)) todos.add(limpio);
  }
  return [...todos].sort();
}
