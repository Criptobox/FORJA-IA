/** FORJA IA Lab — Variante del Equipo B para la Arena.
 *
 * En FORJA IA el Equipo B lleva la ConfigForja que tú elijas (otros modelos
 * gratis por rol). Aquí, con un único motor conectado, la variante honesta
 * es recetar al equipo B una «personalidad» distinta: perfil alternado
 * (más o menos presupuesto) y un Diseñador más atrevido. Así el duelo
 * compara dos recetas reales, no dos copias.
 */

import type { ConfigForja, PerfilRecursos } from "@/lib/prism/forja/tipos";

const PERFIL_ALT: Record<PerfilRecursos, PerfilRecursos> = {
  ligero: "profundo",
  equilibrado: "profundo",
  profundo: "ligero",
};

export function crearConfigB(cfgA: ConfigForja): ConfigForja {
  return {
    ...cfgA,
    perfil: PERFIL_ALT[cfgA.perfil ?? "equilibrado"],
    temperaturaPorRol: { ...cfgA.temperaturaPorRol, disenador: 0.85 },
  };
}
