/** Forja IA — Detección de modelos gratis por proveedor.
 *
 * Reglas (verificado con la documentación oficial de cada proveedor):
 *  - AiHubMix subsidia 27+ modelos con sufijo «-free» (gpt-5.5-free, deepseek-v3-free…).
 *  - OpenRouter marca los gratuitos con sufijo «:free».
 *  - TokenRouter, con sufijo «-free» (su propia página avisa de que la
 *    capacidad gratuita es limitada y la estabilidad no está garantizada).
 *  - Gemini (AI Studio), Groq y Ollama ofrecen capa gratuita completa.
 *  - Z.ai ofrece GLM-Flash gratis.
 */
import type { ProviderId } from "./types";
import { makeModelKey, splitModelKey } from "./types";

/** Proveedores cuya API completa tiene capa gratuita (sin coste, con límites de tasa) */
export const FULL_FREE_TIER: ProviderId[] = ["gemini", "groq", "ollama", "cerebras"];

/** Crédito de prueba o plan experimental: todos sus modelos cuentan como gratis aquí */
export const TRIAL_FREE_TIER: ProviderId[] = ["nvidia", "kimi", "mistral"];

/** Proveedores locales que no necesitan API key */
export const KEYLESS_PROVIDERS: ProviderId[] = [
  "ollama",
  "lmstudio",
  "llamacpp",
  "jan",
  "vllm",
  "mlx",
  "llamafile",
];

/** Modelos gratis conocidos además de los que llevan sufijo -free / :free */
export const CURATED_FREE: Partial<Record<ProviderId, string[]>> = {
  zai: ["glm-4.5-flash", "glm-4.7-flash", "glm-4.5-air"],
};

/** ¿Es este modelo gratis con este proveedor? */
export function isFreeModel(providerId: ProviderId, modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (id.includes("free")) return true; // AiHubMix «-free», OpenRouter «:free»
  if (FULL_FREE_TIER.includes(providerId) || TRIAL_FREE_TIER.includes(providerId)) return true;
  const curated = CURATED_FREE[providerId] ?? [];
  return curated.some((m) => id === m.toLowerCase());
}

/** Filtra una lista dejando solo los modelos gratis */
export function filterFreeModels<T extends string>(
  providerId: ProviderId,
  models: T[]
): T[] {
  return models.filter((m) => isFreeModel(providerId, m));
}

/** Config mínima de proveedores necesaria para elegir failover (evita importar el store aquí) */
export interface FailoverProviderCfg {
  apiKey: string;
  enabled: boolean;
  models: string[];
}

/** Orden de preferencia para el failover: primero capas 100% gratuitas sin recarga.
 * Exportado porque es el valor por defecto del orden configurable (T2, plan V6):
 * «Restablecer» en Ajustes vuelve aquí, y el saneado completa con estos ids. */
export const FAILOVER_ORDER: ProviderId[] = [
  "gemini",
  "groq",
  "cerebras",
  "openrouter",
  "tokenrouter",
  "zai",
  "aihubmix",
  "kimi",
  "nvidia",
  "mistral",
  "ollama",
  "lmstudio",
  // El resto de runtimes locales, junto a los otros dos: no gastan cuota de
  // nadie, pero solo entran en la cadena si TÚ has añadido modelos suyos —
  // un servidor que no está levantado no debe recibir el failover.
  "llamacpp",
  "jan",
  "vllm",
  "mlx",
  "llamafile",
  "deepseek",
  "xai",
  "openai",
  "anthropic",
  "custom",
];

/** Detecta errores de cuota/límite agotado (ej. AiHubMix: «solo 10 intentos sin recargar») */
export function isQuotaError(text: string): boolean {
  return /(abuse of free resources|can only try \d+ times|insufficient (?:balance|quota|credit)|quota.{0,24}(?:exceed|exhaust|limit)|out of (?:credits?|quota)|has_exceeded|billing|topup|recharg|\b429\b|\b402\b)/i.test(
    text
  );
}

/** «User Safety: safe» / «Response Safety: safe»: el preámbulo de
 * clasificación de seguridad que algunos modelos (visto con nemotron vía
 * OpenRouter) devuelven EN VEZ de la respuesta real — no delante, en vez
 * de. Se contaba como éxito porque no está vacío, y el usuario se
 * quedaba con eso como si fuera la respuesta a "hazme una web para una
 * barbería". Dos variantes reales vistas, las dos cubiertas:
 *  · texto plano pegado sin separador: "...safeResponse Safety: safe"
 *  · el mismo aviso en JSON: {"User Safety": "safe", "Response Safety": "safe"}
 * Los `"?` opcionales son por la variante JSON — sin ellos, la comilla de
 * cierre justo después de "Safety" (antes de los dos puntos) rompía el
 * patrón y esa forma pasaba colada. */
// Sin «\b» al principio a propósito: cuando dos avisos quedan pegados sin
// separador ("...safeResponse Safety: safe"), la letra de justo antes de
// "Response" es otra letra ("e"), así que un «\b» ahí no encontraría
// límite de palabra y se perdería el segundo aviso al reemplazarlos.
const PATRON_FILTRO_SEGURIDAD = /"?(?:user|response|prompt)\s*safety"?\s*:\s*"?(?:safe|unsafe)"?/i;

export function esSoloFiltroSeguridad(text: string): boolean {
  const t = text.trim();
  if (!t || !PATRON_FILTRO_SEGURIDAD.test(t)) return false;
  const sinFiltro = t.replace(new RegExp(PATRON_FILTRO_SEGURIDAD.source, "gi"), "").trim();
  // Lo que sobra tras quitar el/los aviso(s) es prácticamente nada: esto
  // ERA solo el filtro, no una respuesta con el filtro delante.
  return sinFiltro.length < 20;
}

/** Sanea un orden de failover guardado: fuera los ids que ya no existen y
 * al final los proveedores que falten.
 *
 * Por qué al sanearlo y no al guardarlo: un orden guardado hace seis versiones
 * no puede dejar fuera a un proveedor que llegó después — el usuario no volvió
 * a tocar Ajustes y aun así el nuevo proveedor tiene que entrar en la cadena. */
export function sanearOrdenFallback(
  orden: ProviderId[],
  conocidos: ProviderId[] = FAILOVER_ORDER
): ProviderId[] {
  const vistos = new Set<ProviderId>();
  const out: ProviderId[] = [];
  for (const id of orden) {
    // ids desconocidos (proveedores retirados en versiones posteriores): fuera
    if (!conocidos.includes(id) || vistos.has(id)) continue;
    vistos.add(id);
    out.push(id);
  }
  // los que falten, al final, en el orden por defecto del código
  for (const id of conocidos) {
    if (!vistos.has(id)) out.push(id);
  }
  return out;
}

/** Elige otro modelo gratis de otro proveedor conectado para reintentar tras agotar cuota.
 * `isBlocked` permite saltar proveedores en cooldown (salud de modelos).
 * `orden` es el preferido por el usuario (T2, plan V6): si no llega, o llega
 * vacío, se usa FAILOVER_ORDER tal cual — nadie que no haya tocado Ajustes
 * nota ningún cambio. */
export function pickFailoverCandidate(
  providers: Partial<Record<ProviderId, FailoverProviderCfg>>,
  excludeProviderId: ProviderId,
  isBlocked?: (providerId: ProviderId, modelId: string) => boolean,
  orden?: ProviderId[]
): { providerId: ProviderId; modelId: string } | null {
  const usable = (id: ProviderId): FailoverProviderCfg | undefined => {
    const cfg = providers[id];
    if (!cfg?.enabled) return undefined;
    if (!cfg.apiKey.trim() && !KEYLESS_PROVIDERS.includes(id)) return undefined;
    return cfg;
  };
  const cadena = orden?.length ? orden : FAILOVER_ORDER;
  for (const id of cadena) {
    if (id === excludeProviderId) continue;
    const cfg = usable(id);
    if (!cfg) continue;
    const free = filterFreeModels(id, cfg.models);
    const modelId = free.find((m) => !isBlocked?.(id, m)) ?? null;
    if (modelId) return { providerId: id, modelId };
  }
  return null;
}

export interface AutoCandidate {
  providerId: ProviderId;
  modelId: string;
  modelKey: string;
}

