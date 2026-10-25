/** Forja IA — Catálogo vivo de los modelos GRATIS de OpenCode Zen.
 *
 * OpenCode no publica «la lista de gratis» como tal. Lo que hace su propia app
 * es cruzar dos cosas públicas: el catálogo de models.dev (con el precio de
 * cada modelo) y lo que la pasarela dice servir en /zen/v1/models. Aquí se
 * hace lo mismo, sin servidor propio ni URL que configurar:
 *
 *  - gratis = precio de entrada Y de salida a cero (o, si el catálogo no trae
 *    precio, el sufijo «-free» que OpenCode usa en esos ids);
 *  - si la pasarela contesta, solo se ofrece lo que de verdad sirve hoy.
 *
 * Funciones puras: el servidor las usa para montar la respuesta y los tests
 * las prueban sin red.
 */

export type OpenCodeFreeModel = {
  id: string;
  name: string;
  /** ventana de contexto en tokens, si el catálogo la trae */
  context?: number;
};

/** Último recurso si no hay red: los «-free» que la documentación de OpenCode cita. */
export const OPENCODE_FALLBACK: OpenCodeFreeModel[] = [
  { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free" },
  { id: "mimo-v2.5-free", name: "MiMo V2.5 Free" },
];

function numero(x: unknown): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

/** Saca los modelos gratis del JSON de models.dev (proveedor «opencode»). */
export function parseModelsDev(json: unknown): OpenCodeFreeModel[] {
  if (!json || typeof json !== "object") return [];
  const prov = (json as Record<string, unknown>).opencode;
  const models =
    prov && typeof prov === "object" ? (prov as Record<string, unknown>).models : null;
  if (!models || typeof models !== "object") return [];
  const out: OpenCodeFreeModel[] = [];
  for (const [key, raw] of Object.entries(models as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const id = typeof m.id === "string" && m.id ? m.id : key;
    const cost = m.cost && typeof m.cost === "object" ? (m.cost as Record<string, unknown>) : null;
    const entrada = numero(cost?.input);
    const salida = numero(cost?.output);
    // Con precio manda el precio. Sin precio no se da nada por gratis a ojo,
    // salvo el sufijo que OpenCode reserva para ellos.
    const gratis =
      entrada !== undefined && salida !== undefined ? entrada === 0 && salida === 0 : /-free$/i.test(id);
    if (!gratis) continue;
    const limit = m.limit && typeof m.limit === "object" ? (m.limit as Record<string, unknown>) : null;
    out.push({
      id,
      name: typeof m.name === "string" && m.name ? m.name : id,
      context: numero(limit?.context),
    });
  }
  return out;
}

/** Ids que la pasarela dice servir (respuesta de /zen/v1/models). */
export function parseZenIds(json: unknown): string[] {
  const data = json && typeof json === "object" ? (json as Record<string, unknown>).data : null;
  if (!Array.isArray(data)) return [];
  return data
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>).id : null))
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** Cruza precio y pasarela. Si la pasarela no contestó (lista vacía), vale solo el precio. */
export function catalogoGratis(dev: OpenCodeFreeModel[], zenIds: string[]): OpenCodeFreeModel[] {
  const sirve = new Set(zenIds);
  const lista = sirve.size ? dev.filter((m) => sirve.has(m.id)) : dev;
  return [...lista].sort((a, b) => (b.context ?? 0) - (a.context ?? 0) || a.name.localeCompare(b.name));
}

/**
 * Pone al día la lista de modelos del proveedor SIN pisar lo que añadió el
 * usuario: quita solo lo que Forja había metido antes y ya no es gratis, y
 * suma lo nuevo. `anteriores` = ids que esta misma sincronización puso la vez pasada.
 */
export function aplicarCatalogo(
  actuales: string[],
  anteriores: string[],
  vivos: string[]
): { models: string[]; sincronizados: string[] } {
  const vivosSet = new Set(vivos);
  const caducados = new Set(anteriores.filter((id) => !vivosSet.has(id)));
  const conservados = actuales.filter((id) => !caducados.has(id));
  const models = [...conservados, ...vivos.filter((id) => !conservados.includes(id))];
  return { models, sincronizados: [...vivos] };
}
