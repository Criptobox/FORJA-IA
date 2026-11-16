/** Forja IA — «Auto no tiene modelos»: ¿no hay ninguna IA, o están en pausa?
 *
 * Con una sola IA conectada (típico con OpenCode Zen) un 429 la deja en
 * cooldown, la cadena de Auto queda vacía y el chat decía «necesito una IA
 * conectada»: falso, ya la tenías, solo está en pausa por cuota. Aquí se
 * distingue y se dice cuánto falta. Puro: se prueba sin red. */
import { cooldownRemaining, providerCooldownRemaining, type HealthEntry } from "./health";

export interface CandidatoPausa {
  providerId: string;
  modelId: string;
}

export interface PausaDeLaCadena {
  /** ms hasta que vuelva el primero */
  ms: number;
  /** proveedores en pausa, sin repetir */
  proveedores: string[];
}

/** De los candidatos que habría SIN contar los cooldowns, cuánto falta para el
 * primero. `null` si no hay candidatos (entonces de verdad no hay IA) o si
 * ninguno está en pausa (entonces el motivo es otro). */
export function pausaDeLaCadena(
  candidatos: readonly CandidatoPausa[],
  entries: Record<string, HealthEntry>,
  providerEntries: Record<string, HealthEntry>,
  makeKey: (p: string, m: string) => string,
  ahora = Date.now()
): PausaDeLaCadena | null {
  let minimo = Infinity;
  const proveedores = new Set<string>();
  for (const c of candidatos) {
    const falta = Math.max(
      cooldownRemaining(entries[makeKey(c.providerId, c.modelId)], ahora),
      providerCooldownRemaining(providerEntries[c.providerId], ahora)
    );
    if (falta <= 0) return null; // este está libre: la cadena no estaba vacía por pausas
    minimo = Math.min(minimo, falta);
    proveedores.add(c.providerId);
  }
  return proveedores.size ? { ms: minimo, proveedores: [...proveedores] } : null;
}

/** Texto del chat cuando todas las IAs conectadas están en pausa. */
export function textoEnPausa(pausa: PausaDeLaCadena, nombres: (id: string) => string): string {
  const quienes = pausa.proveedores.map(nombres).join(", ");
  const min = Math.max(1, Math.ceil(pausa.ms / 60_000));
  return (
    `Tus IAs conectadas (${quienes}) están en pausa por cuota o límite de uso y vuelven en ~${min} min. ` +
    "No es que falte una IA: espera un poco, o conecta otra IA gratis en Ajustes ▸ Proveedores (Gemini o Groq se sacan en un minuto) " +
    "para que Forja salte a ella mientras tanto. Para crear una app o una web no hace falta ninguna: pídelo y la arma la biblioteca de Forja."
  );
}
