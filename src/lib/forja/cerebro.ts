/** Forja IA — El Cerebro: el mapa del proyecto que Forja ya usa por dentro.
 *
 * Idea tomada de herramientas como Graphify: en vez de releer archivos a
 * ciegas, el proyecto es un GRAFO que se puede mirar y consultar. Forja ya
 * lo tenía (`grafo-proyecto.ts` decide qué archivos viajan al modelo en cada
 * turno); aquí solo se convierte en algo visible:
 *
 *  · nodos = la última versión de cada archivo de la conversación,
 *  · aristas = lo que el código referencia de verdad (`<script src>`,
 *    `import`, `@import`, `url()`…). Todas son EXTRAÍDAS del código: nada
 *    se adivina, así que el mapa nunca enseña una relación que no existe,
 *  · posiciones = un reparto por fuerzas DETERMINISTA (mismo proyecto →
 *    mismo dibujo; nada de Math.random), para que el mapa no baile.
 *
 * Sin React ni almacenamiento: se prueba solo. */

import { archivosVigentes, aristasDeArchivos } from "./grafo-proyecto";

export type TipoArchivo = "html" | "css" | "js" | "datos" | "imagen" | "otro";

export const TIPOS: Record<TipoArchivo, { nombre: string; color: string }> = {
  html: { nombre: "Páginas", color: "#f97316" },
  css: { nombre: "Estilos", color: "#3b82f6" },
  js: { nombre: "Código", color: "#eab308" },
  datos: { nombre: "Datos", color: "#10b981" },
  imagen: { nombre: "Imágenes", color: "#ec4899" },
  otro: { nombre: "Otros", color: "#94a3b8" },
};

export function tipoDeArchivo(ruta: string): TipoArchivo {
  const ext = ruta.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  if (/^html?$/.test(ext)) return "html";
  if (/^(css|scss|sass|less)$/.test(ext)) return "css";
  if (/^(m?js|cjs|jsx|ts|tsx|vue|svelte)$/.test(ext)) return "js";
  if (/^(json|ya?ml|csv|toml|xml|md)$/.test(ext)) return "datos";
  if (/^(png|jpe?g|gif|webp|svg|ico|avif)$/.test(ext)) return "imagen";
  return "otro";
}

export interface NodoMapa {
  id: string;
  /** nombre corto para la etiqueta */
  nombre: string;
  tipo: TipoArchivo;
  caracteres: number;
  /** archivos que este referencia */
  usa: string[];
  /** archivos que lo referencian */
  loUsan: string[];
}

export interface MapaProyecto {
  nodos: NodoMapa[];
  aristas: { de: string; a: string }[];
}

interface MensajeLeible {
  role: string;
  content: string;
}

/** El mapa de cualquier conjunto de archivos (ruta → texto). */
export function mapaDeArchivos(archivos: ReadonlyMap<string, { text: string }>): MapaProyecto {
  const aristas = aristasDeArchivos(archivos);
  const usa = new Map<string, string[]>();
  const loUsan = new Map<string, string[]>();
  for (const e of aristas) {
    usa.set(e.de, [...(usa.get(e.de) ?? []), e.a]);
    loUsan.set(e.a, [...(loUsan.get(e.a) ?? []), e.de]);
  }
  const nodos: NodoMapa[] = [...archivos.entries()]
    .map(([ruta, a]) => ({
      id: ruta,
      nombre: ruta.split("/").pop() || ruta,
      tipo: tipoDeArchivo(ruta),
      caracteres: a.text.length,
      usa: usa.get(ruta) ?? [],
      loUsan: loUsan.get(ruta) ?? [],
    }))
    .sort((x, y) => x.id.localeCompare(y.id));
  return { nodos, aristas };
}

/** El mapa de la conversación: un nodo por archivo vigente. */
export function mapaDelProyecto(mensajes: readonly MensajeLeible[]): MapaProyecto {
  return mapaDeArchivos(archivosVigentes(mensajes));
}

/** Un repo puede tener cientos de archivos y en un móvil no se leen más de
 * unas decenas: se quedan los más conectados (los que vertebran el proyecto)
 * y las conexiones entre ellos. `total` dice cuántos había. */
export function recortarMapa(mapa: MapaProyecto, max = 40): { mapa: MapaProyecto; total: number } {
  const total = mapa.nodos.length;
  if (total <= max) return { mapa, total };
  const grado = (n: NodoMapa) => n.usa.length + n.loUsan.length;
  const elegidos = new Set(
    [...mapa.nodos]
      .sort((x, y) => grado(y) - grado(x) || x.id.localeCompare(y.id))
      .slice(0, max)
      .map((n) => n.id)
  );
  const nodos = mapa.nodos
    .filter((n) => elegidos.has(n.id))
    .map((n) => ({ ...n, usa: n.usa.filter((x) => elegidos.has(x)), loUsan: n.loUsan.filter((x) => elegidos.has(x)) }));
  const aristas = mapa.aristas.filter((e) => elegidos.has(e.de) && elegidos.has(e.a));
  return { mapa: { nodos, aristas }, total };
}

/** Hueco mínimo entre dos nodos para que sus etiquetas no se pisen. */
const SEPARACION_X = 74;
const SEPARACION_Y = 34;

export interface Posicion {
  x: number;
  y: number;
}

/** Reparto por fuerzas, determinista, dentro de `ancho × alto` con margen.
 * Arranca en círculo (por orden alfabético), repele todos con todos, atrae
 * los conectados y tira suave hacia el centro. 200 pasos con enfriamiento. */
export function disponerMapa(mapa: MapaProyecto, ancho: number, alto: number, margen = 36): Map<string, Posicion> {
  const n = mapa.nodos.length;
  const pos = new Map<string, Posicion>();
  if (!n) return pos;
  const cx = ancho / 2;
  const cy = alto / 2;
  if (n === 1) {
    pos.set(mapa.nodos[0].id, { x: cx, y: cy });
    return pos;
  }
  const radio = Math.min(ancho, alto) / 2 - margen;
  const x = mapa.nodos.map((_, i) => cx + radio * Math.cos((2 * Math.PI * i) / n - Math.PI / 2));
  const y = mapa.nodos.map((_, i) => cy + radio * Math.sin((2 * Math.PI * i) / n - Math.PI / 2));
  const indice = new Map(mapa.nodos.map((nd, i) => [nd.id, i]));
  const aristas = mapa.aristas
    .map((e) => [indice.get(e.de), indice.get(e.a)] as const)
    .filter((e): e is readonly [number, number] => e[0] !== undefined && e[1] !== undefined);
  const ideal = Math.max(52, Math.sqrt((ancho * alto) / n) * 0.7);
  for (let paso = 0; paso < 200; paso++) {
    const temp = (1 - paso / 200) * ideal * 0.5;
    const fx = new Array<number>(n).fill(0);
    const fy = new Array<number>(n).fill(0);
    // repulsión de todos con todos
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = x[i] - x[j];
        let dy = y[i] - y[j];
        if (Math.hypot(dx, dy) < 0.01) {
          // dos nodos en el mismo sitio: se separan en una dirección fija
          dx = 0.01 * (i + 1);
          dy = 0.01 * (j + 1);
        }
        const dist = Math.hypot(dx, dy);
        const f = (ideal * ideal) / dist;
        fx[i] += (dx / dist) * f;
        fy[i] += (dy / dist) * f;
        fx[j] -= (dx / dist) * f;
        fy[j] -= (dy / dist) * f;
      }
    }
    // atracción de los conectados
    for (const [i, j] of aristas) {
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const f = (dist * dist) / ideal;
      fx[i] -= (dx / dist) * f;
      fy[i] -= (dy / dist) * f;
      fx[j] += (dx / dist) * f;
      fy[j] += (dy / dist) * f;
    }
    // un tirón suave hacia el centro, movimiento limitado por la temperatura
    for (let i = 0; i < n; i++) {
      fx[i] += (cx - x[i]) * 0.05;
      fy[i] += (cy - y[i]) * 0.05;
      const largo = Math.max(0.01, Math.hypot(fx[i], fy[i]));
      const mov = Math.min(largo, temp);
      x[i] = Math.min(ancho - margen, Math.max(margen, x[i] + (fx[i] / largo) * mov));
      y[i] = Math.min(alto - margen, Math.max(margen, y[i] + (fy[i] / largo) * mov));
    }
  }
  // Pasada final: las etiquetas van debajo de cada nodo y miden más que él,
  // así que dos nodos a la misma altura y demasiado juntos se separan hasta
  // que sus nombres no se pisen (por el eje en que menos se solapan).
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    let movido = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sx = SEPARACION_X - Math.abs(x[i] - x[j]);
        const sy = SEPARACION_Y - Math.abs(y[i] - y[j]);
        if (sx <= 0 || sy <= 0) continue;
        movido = true;
        if (sx < sy) {
          const s = (x[i] <= x[j] ? -1 : 1) * (sx / 2 + 0.5);
          x[i] = Math.min(ancho - margen, Math.max(margen, x[i] + s));
          x[j] = Math.min(ancho - margen, Math.max(margen, x[j] - s));
        } else {
          const s = (y[i] <= y[j] ? -1 : 1) * (sy / 2 + 0.5);
          y[i] = Math.min(alto - margen, Math.max(margen, y[i] + s));
          y[j] = Math.min(alto - margen, Math.max(margen, y[j] - s));
        }
      }
    }
    if (!movido) break;
  }
  mapa.nodos.forEach((nd, i) => pos.set(nd.id, { x: x[i], y: y[i] }));
  return pos;
}

/** Frase para «Preguntar por este archivo»: rellena el compositor. */
export function preguntaSobre(nodo: Pick<NodoMapa, "id" | "usa" | "loUsan">): string {
  const rel = [
    nodo.usa.length ? `usa ${nodo.usa.join(", ")}` : "",
    nodo.loUsan.length ? `lo usan ${nodo.loUsan.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  return `Sobre \`${nodo.id}\`${rel ? ` (${rel})` : ""}: `;
}
