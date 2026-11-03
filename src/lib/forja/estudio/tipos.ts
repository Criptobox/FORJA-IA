/** FORJA IA — Estudio de diseño: tipos del proyecto.
 *
 * Un proyecto de diseño es un conjunto de PANTALLAS que comparten un mismo
 * sistema de diseño (la dirección visual de `design-directions.ts` y sus
 * tokens). Cada pantalla guarda sus versiones: iterar no destruye la anterior.
 *
 * Todo es serializable (JSON) porque vive en localStorage. */

/** Web = páginas de escritorio adaptables; app = pantallas de móvil. */
export type TipoProyecto = "web" | "app";

export type Dispositivo = "movil" | "tablet" | "escritorio";

/** Un archivo tal como lo entregó el modelo (sin el kit de efectos, que se
 * añade al pintar: es constante y no merece ocupar almacenamiento). */
export interface ArchivoPantalla {
  path: string;
  text: string;
}

export interface VersionPantalla {
  id: string;
  creada: number;
  /** qué se pidió para llegar a esta versión (generar, «hazlo más oscuro»…) */
  pedido: string;
  archivos: ArchivoPantalla[];
  /** ruta del HTML de entrada dentro de `archivos` */
  entrada: string;
  /** modelKey que la generó, si se sabe */
  modelo?: string;
}

export type EstadoPantalla = "vacia" | "generando" | "lista" | "error";

export interface Pantalla {
  id: string;
  nombre: string;
  /** para qué sirve la pantalla: viaja en el prompt */
  proposito: string;
  versiones: VersionPantalla[];
  /** índice de la versión que se ve (por defecto la última) */
  actual: number;
  estado: EstadoPantalla;
  error?: string;
  /** skills de pantalla elegidas a mano (`skills.ts`); sin el campo se
   * eligen solas por el nombre y el propósito */
  skills?: string[];
}

export interface ProyectoDiseno {
  id: string;
  nombre: string;
  /** el encargo en palabras del usuario */
  brief: string;
  tipo: TipoProyecto;
  /** id de la dirección visual (`DIRECCIONES`) — el sistema de diseño */
  direccionId: string;
  creado: number;
  actualizado: number;
  pantallas: Pantalla[];
  /** ids de referencias de la Biblioteca que guían el diseño (opcional:
   * los proyectos guardados antes de la Biblioteca no lo traen) */
  referencias?: string[];
}

/** De dónde salió una referencia de la Biblioteca. */
export type OrigenReferencia = "subida" | "pantalla" | "drive";

/** Una imagen de la Biblioteca: inspiración, captura o diseño anterior.
 * La imagen vive en IndexedDB (`attachment-blob.ts`) bajo `blobId`; aquí
 * solo lo ligero, que va en localStorage. */
export interface Referencia {
  id: string;
  nombre: string;
  origen: OrigenReferencia;
  /** colores dominantes en hex, del más presente al menos */
  paleta: string[];
  blobId: string;
  ancho?: number;
  alto?: number;
  creada: number;
  /** proyecto del que salió (si es una pantalla guardada) */
  proyectoId?: string;
}

/** Lo que propone el plan de pantallas antes de generarlas. */
export interface PantallaPlan {
  nombre: string;
  proposito: string;
}
