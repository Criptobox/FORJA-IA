/** Forja IA — Manifiesto del proyecto: qué es esta app y qué sabe hacer.
 *
 * El dato vive en `.forja/project.json` (el mismo directorio que el tooling
 * propio de FORJA lee) y aquí está su contrato tipado. La versión NO va en el
 * manifiesto: vive solo en package.json — tenerla escrita en dos sitios ya
 * hizo que divergieran una vez (Ajustes anunció «v3.1» durante cuatro
 * versiones) y no se repite.
 *
 * Consumidores: /api/health (saludo con identidad) y el Inspector Visual
 * (pinta las áreas auditadas). Si mañana una capacidad cambia de sitio, se
 * edita el JSON y nada de código: para eso es un manifiesto.
 */
import manifiesto from "../../.forja/project.json";

export interface CapacidadManifest {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
}

export interface AreaManifest {
  readonly id: string;
  readonly nombre: string;
  /** nombre de icono lucide (el componente decide cómo dibujarlo) */
  readonly icono: string;
  readonly capacidades: readonly CapacidadManifest[];
}

export interface ManifiestoProyecto {
  readonly nombre: string;
  readonly descripcion: string;
  readonly areas: readonly AreaManifest[];
}

export const MANIFEST = manifiesto as unknown as ManifiestoProyecto;

export const AREAS = MANIFEST.areas;

/** Total de capacidades declaradas en todo el manifiesto. */
export function capacidadesTotal(): number {
  return AREAS.reduce((n, area) => n + area.capacidades.length, 0);
}

/** Busca un área por id (p. ej. "chat"). undefined si no existe. */
export function areaPorId(id: string): AreaManifest | undefined {
  return AREAS.find((a) => a.id === id);
}

/** Busca una capacidad en TODO el manifiesto (p. ej. "sandbox"). */
export function capacidadPorId(id: string): CapacidadManifest | undefined {
  for (const area of AREAS) {
    const cap = area.capacidades.find((c) => c.id === id);
    if (cap) return cap;
  }
  return undefined;
}

/** Resumen de una línea para salud, logs y el Inspector:
 *  «FORJA-IA · 7 áreas · 31 capacidades». */
export function resumenManifest(): string {
  return `${MANIFEST.nombre} · ${AREAS.length} áreas · ${capacidadesTotal()} capacidades`;
}
