/** FORJA IA — CACHÉ DE GENERACIONES POR HASH (v4.2): no pagar dos veces
 * la misma idea.
 *
 * ─── El problema ───
 * La llamada más conceptual del pipeline es la del Diseñador: ficha + ADN +
 * 3 direcciones. Cuesta tiempo y cuota, y su ENTRADA es determinable: la
 * petición del usuario + la config + las reglas. Cuando el usuario reintenta
 * la misma petición (o el Lab repite el mismo caso en pruebas), FORJA pagaba
 * otra ficha idéntica. Igual con la MAQUETA: aprobada la ficha, re-maquetas
 * tras un toque de red y pagas la misma maqueta.
 *
 * ─── La solución ───
 * Un caché LRU en memoria indexed por HASH de la entrada (FNV-1a, sin
 * dependencias): `claveFicha(peticion, cfg)` y `claveMaqueta(...)`. El
 * núcleo consulta ANTES de llamar al modelo y guarda DESPUÉS de un éxito.
 * Si el usuario cambia una coma, el hash cambia y se paga la llamada — el
 * caché nunca devuelve una ficha de otra petición.
 *
 * Invalidación por versión: las claves incluyen VERSION_FORJA, así que una
 * actualización del módulo (prompts nuevos, ADN nuevo) vacía el caché solo.
 *
 * El módulo no toca storage: `CacheGeneracion` es una interfaz mínima, con
 * implementación LRU en memoria por defecto. Un host que quiera caché
 * persistente implementa la interfaz sobre su store (localStorage, SQLite,
 * redis) y la inyecta en DependenciasForja.cache.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto.
 */

import type { ConfigForja, PeticionForja } from "./tipos";
import { rondasDePerfil } from "./tipos";
import { VERSION_FORJA } from "./version";

/* ══════════════════════════ interfaz ══════════════════════════ */

/** El caché mínimo que el núcleo necesita. Valores SIEMPRE texto (ficha o
 * HTML de maqueta): serializable, inspeccionable, sin tipos raros. */
export interface CacheGeneracion {
  obtener(clave: string): string | null;
  guardar(clave: string, valor: string): void;
  /** para el panel/telemetría: tamaño y utilidad real del caché */
  stats(): CacheStats;
}

export interface CacheStats {
  entradas: number;
  aciertos: number;
  escrituras: number;
  /** entradas descartadas por LRU (el caché funcionó y aun así pagaste) */
  expulsiones: number;
}

/* ══════════════════════════ hash ══════════════════════════ */

/** FNV-1a 32-bit → hex de 8 dígitos. Criptográficamente modesto y
 * suficientemente honesto: distingue peticiones distintas y no colisiona
 * en la escala de un caché local (decenas de entradas). */
export function hashTexto(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Normaliza para el hash: colapsa espacios y recorta — la misma petición
 * con un salto de línea extra ES la misma petición. No se pasa a minúsculas:
 * «FORJA» y «forja» pueden ser mensajes distintos para el usuario. */
function normaliza(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Componentes que cambian el resultado del Diseñador (y por tanto la clave):
 * versión, mensaje, código actual, reglas de memoria, conocimiento global,
 * habilidades, perfil y rondas efectivas. La temperatura NO entra: cachear
 * una idea y reusarla con otra temperatura es justo el ahorro buscado. */
export function claveFicha(p: PeticionForja, cfg: ConfigForja): string {
  const partes = [
    VERSION_FORJA,
    normaliza(p.mensaje),
    hashTexto(p.codigoActual ?? ""),
    (p.reglasAprendidas ?? []).map(normaliza).join("|"),
    (p.conocimientoGlobal ?? []).map(normaliza).join("|"),
    [...(cfg.habilidades ?? [])].sort().join("|"),
    cfg.perfil ?? "equilibrado",
    String(rondasDePerfil(cfg)),
    cfg.maquetaPrimero === false ? "sin-maqueta" : "con-maqueta",
  ];
  return `ficha:${hashTexto(partes.join("\u0001"))}`;
}

/** Clave de la MAQUETA inicial: la ficha ya es un texto largo y estable —
 * su hash basta. El feedback de ajustes NO se cachea: cada ajuste es único
 * y re-maquetasr con el mismo feedback no tiene sentido estadístico. */
export function claveMaqueta(p: PeticionForja, fichaTexto: string): string {
  return `maqueta:${hashTexto(`${VERSION_FORJA}\u0001${normaliza(p.mensaje)}\u0001${hashTexto(p.codigoActual ?? "")}\u0001${hashTexto(fichaTexto)}`)}`;
}

/* ══════════════════════════ LRU en memoria ══════════════════════════ */

/** El caché por defecto: Map LRU (el orden de inserción de Map es barato de
 * girar) con tope de entradas y tope de tamaño por valor. Un valor de 500k
 * es una ficha/maqueta razonable; más que eso, no cabe en caché. */
export function crearCacheMemoria(tamano = 24, maxBytesValor = 500_000): CacheGeneracion {
  const mapa = new Map<string, string>();
  const stats: CacheStats = { entradas: 0, aciertos: 0, escrituras: 0, expulsiones: 0 };

  return {
    obtener(clave) {
      const v = mapa.get(clave);
      if (v == null) return null;
      // toque LRU: reinsertar al final (más reciente)
      mapa.delete(clave);
      mapa.set(clave, v);
      stats.aciertos += 1;
      return v;
    },
    guardar(clave, valor) {
      if (valor.length > maxBytesValor) return; // demasiado grande para cachear
      if (mapa.has(clave)) mapa.delete(clave);
      mapa.set(clave, valor);
      stats.escrituras += 1;
      while (mapa.size > tamano) {
        const masVieja = mapa.keys().next().value;
        if (masVieja == null) break;
        mapa.delete(masVieja);
        stats.expulsiones += 1;
      }
      stats.entradas = mapa.size;
    },
    stats() {
      return { ...stats, entradas: mapa.size };
    },
  };
}

/** Línea de estado para paneles y logs: «caché 3 entradas · 5 aciertos». */
export function resumenCache(c: CacheGeneracion): string {
  const s = c.stats();
  return `caché ${s.entradas} entrada(s) · ${s.aciertos} acierto(s) · ${s.escrituras} escritura(s)` +
    (s.expulsiones ? ` · ${s.expulsiones} expulsión(es)` : "");
}

/* ══════════════════════════ envoltorio compuesto ══════════════════════════ */

/** Compone dos cachés: consulta primero al A y escribe en AMBOS. Útil para
 * añadir una capa persistente del host DELANTE del LRU de memoria sin
 * reescribir el núcleo. */
export function cacheEnCascada(a: CacheGeneracion, b: CacheGeneracion): CacheGeneracion {
  return {
    obtener(clave) {
      const va = a.obtener(clave);
      if (va != null) return va;
      const vb = b.obtener(clave);
      if (vb != null) a.guardar(clave, vb); // repuebla la capa rápida
      return vb;
    },
    guardar(clave, valor) {
      a.guardar(clave, valor);
      b.guardar(clave, valor);
    },
    stats() {
      // la capa A manda en el relato (es la que ve el usuario)
      return a.stats();
    },
  };
}
