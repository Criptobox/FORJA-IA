/** FORJA IA — Registro de FORJA IA como modelo virtual en la lista de modelos.
 *
 * La idea central del proyecto: el usuario no configura "agentes", elige una
 * IA en el mismo selector donde elige gemini o deepseek. Este archivo define
 * esa entrada virtual y las funciones para detectarla y describirla, de modo
 * que el selector, el coste por mensaje y la ficha de modelo puedan tratarla
 * como cualquier otra opción.
 *
 * Convención de id con prefijo de espacio propio («forja:») para que jamás
 * colisione con un modelId real de ningún proveedor, ni presente ni futuro.
 *
 * Historia del id: antes del rebrand v4.1.0 era «prism:d1-diseno» (PRISMA-D1).
 * El rebrand cambió el id a propósito — la ficha de Ajustes explica la
 * migración. Desde v4.1.0 la regla vuelve a aplicar: FORJA_ID es ESTABLE,
 * no renombrar entre versiones.
 */

import type { ConfigForja } from "./tipos";
import { VERSION_FORJA, NOMBRE_VERSION_FORJA } from "./version";

/** Id público del modelo virtual. Estable: no renombrar entre versiones. */
export const FORJA_ID = "forja:ia-diseno";

/** Nombre que ve el usuario en la lista. */
export const FORJA_NOMBRE = "FORJA IA · IA de Diseño";

/** Descripción corta para la ficha del selector. La metáfora es la marca:
 * en la forja el metal bruto se convierte en obra — los modelos (DeepSeek,
 * GLM, el que sea) entran crudos y sale un diseño forjado. El cerebro es
 * la forja; los modelos, el metal. */
export const FORJA_RESUMEN =
  "IA propia especializada en páginas web con criterio visual propio. En la " +
  "forja, el metal bruto se convierte en obra: tus modelos entran crudos y " +
  "sale un diseño forjado con ADN del proyecto, ideas y una maqueta navegable " +
  "ANTES de codificar, y un motor anti-genérico que le impide parecer " +
  "plantilla de IA. Lo construye un equipo de tres especialistas (Diseñador, " +
  "Codificador y Revisor) sobre los modelos que tú asignes, con tubería " +
  "blindada: failover por proveedor, max_tokens 16k+ en el Codificador, " +
  "continuación automática si la salida llega corta y reintentos con backoff " +
  "en errores de red. El Estudio (Director Creativo + panel de jueces + " +
  "fusión) y la Arena hacen evolucionar el diseño, y aprende de internet, de " +
  "tus fuentes y de las páginas MALAS que le marques como contraejemplo.";

/** Capacidades declaradas, para la ficha de modelo y para que otras partes
 * de la app sepan qué esperar de esta IA sin importar el núcleo. */
export const CAPACIDADES_FORJA = [
  "ideas-y-maqueta-antes-de-codigo",
  "pipeline-disenador-codificador-revisor",
  "modelos-por-rol",
  "memoria-del-usuario",
  "autoaprendizaje-web",
  "apartado-de-fuentes-propias",
  "arena-de-equipos-con-juez",
  "inspeccion-visual-de-paginas",
  "adn-visual-del-proyecto",
  "arena-evolutiva-con-lecciones",
  "conocimiento-estratificado-en-capas",
  "motor-antigenerico-con-saturacion",
  "representacion-primero",
  "estudio-con-director-creativo-y-panel-de-jueces",
  "contraejemplos-aprender-de-paginas-malas",
  // v4.1 — la tubería blindada:
  "adaptador-resiliente-con-failover",
  "anti-truncamiento-max-tokens-16k",
  "continuacion-automatica-finish-reason",
  "reintentos-con-backoff-en-red",
] as const;

export type CapacidadForja = (typeof CAPACIDADES_FORJA)[number];

/** Entrada para la lista de modelos. Mantener campo a campo compatible con
 * lo que el selector pinta: id, nombre, resumen y marca de virtual. */
export interface EntradaModeloVirtual {
  id: string;
  nombre: string;
  resumen: string;
  /** true: no es un modelo de ningún proveedor, es una IA local de FORJA IA */
  virtual: true;
  /** qué proveedores necesita conectados para funcionar al 100% */
  requiereModelos: true;
}

export const ENTRADA_FORJA: EntradaModeloVirtual = {
  id: FORJA_ID,
  nombre: FORJA_NOMBRE,
  resumen: FORJA_RESUMEN,
  virtual: true,
  requiereModelos: true,
};

/** Ficha compacta para la pantalla de Ajustes. */
export function fichaForja(): { nombre: string; version: string; clave: string } {
  return {
    nombre: FORJA_NOMBRE,
    version: VERSION_FORJA,
    clave: `${FORJA_ID} · ${NOMBRE_VERSION_FORJA}`,
  };
}

/** ¿Es esta selección el modelo virtual? Comparación estable por id. */
export function esForja(modelKey: string | null | undefined): boolean {
  return modelKey === FORJA_ID;
}

/** Línea de estado para la UI: versión, qué cerebros hay asignados hoy.
 * «FORJA IA v4.1.0 · D deepseek-v3 · C qwen3-coder · R llama-4-scout» */
export function lineaEstado(cfg: ConfigForja): string {
  const partes = (["disenador", "codificador", "revisor"] as const).map((rol) => {
    const m = cfg.porRol[rol];
    const inicial = rol === "disenador" ? "D" : rol === "codificador" ? "C" : "R";
    return `${inicial} ${m ? m.modelId : "modelo activo"}`;
  });
  return `FORJA IA v${VERSION_FORJA} · ${partes.join(" · ")}`;
}

/** Grado de preparación 0..3: cuántos roles tienen modelo propio asignado.
 * Sirve para avisar (sin bloquear) en el selector: con 0 la IA funciona con
 * el modelo activo para todo, que es el peor caso pero nunca un error. */
export function rolesAsignados(cfg: ConfigForja): number {
  return (["disenador", "codificador", "revisor"] as const)
    .filter((r) => cfg.porRol[r] !== null)
    .length;
}
