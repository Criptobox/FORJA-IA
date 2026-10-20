/** Forja IA — Datos que sobreviven a recargar la vista previa.
 *
 * La vista previa corre en un iframe SIN `allow-same-origin` (así la página
 * generada no puede leer tus claves), y por eso ahí dentro `localStorage` es
 * de mentira: el puente de consola lo sustituye por uno en memoria que se
 * vacía al repintar. Para una landing da igual; para una APP —una lista de
 * tareas, un inventario, un CRM— es justo lo que hace falta probar: meto
 * datos, recargo, siguen ahí.
 *
 * Cómo se hace sin romper el aislamiento:
 * 1. El iframe avisa por `postMessage` de su `localStorage` simulado cada
 *    vez que cambia (el puente lo hace, ver `CONSOLE_BRIDGE`).
 * 2. El panel lo valida (objeto plano de cadenas, con tope de tamaño) y lo
 *    guarda en el `localStorage` de Forja bajo una clave propia por
 *    conversación. La página nunca elige la clave ni lee nada más.
 * 3. Al volver a pintar, `sembrarAlmacen` mete esos datos en el HTML antes
 *    del puente, que arranca su almacén con ellos.
 *
 * Lo que la página guarda no sale del dispositivo, y se borra con un botón.
 */

export const PREFIJO_ALMACEN = "forja-preview-store:";
const CLAVE_INDICE = "forja-preview-store-index";
/** Por conversación. Una app de prueba no necesita más, y el localStorage de
 *  Forja (≈5 MB en total) guarda también tus conversaciones. */
export const MAX_BYTES_ALMACEN = 256 * 1024;
/** Conversaciones con datos guardados; al pasarse se borran las más viejas. */
export const MAX_ALMACENES = 20;

export type DatosAlmacen = Record<string, string>;

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function almacenPorDefecto(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Bytes aproximados (UTF-16, como los cuenta el navegador). */
function tamano(datos: DatosAlmacen): number {
  let n = 0;
  for (const [k, v] of Object.entries(datos)) n += (k.length + v.length) * 2;
  return n;
}

/** Lo que manda el iframe es de una página que no controlamos: solo se
 *  acepta un objeto plano de cadenas dentro del tope. */
export function validarAlmacen(x: unknown): { ok: true; datos: DatosAlmacen } | { ok: false; motivo: string } {
  if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, motivo: "no es un objeto" };
  if (Object.getPrototypeOf(x) !== Object.prototype && Object.getPrototypeOf(x) !== null) {
    return { ok: false, motivo: "no es un objeto plano" };
  }
  const datos: DatosAlmacen = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v !== "string") return { ok: false, motivo: `el valor de «${k.slice(0, 40)}» no es texto` };
    datos[k] = v;
  }
  const bytes = tamano(datos);
  if (bytes > MAX_BYTES_ALMACEN) {
    return { ok: false, motivo: `ocupa ${Math.round(bytes / 1024)} KB y el tope es ${MAX_BYTES_ALMACEN / 1024} KB` };
  }
  return { ok: true, datos };
}

function leerIndice(s: StorageLike): { id: string; t: number }[] {
  try {
    const v = JSON.parse(s.getItem(CLAVE_INDICE) ?? "[]");
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === "string" && typeof e.t === "number") : [];
  } catch {
    return [];
  }
}

export function leerAlmacen(id: string | null | undefined, s: StorageLike | null = almacenPorDefecto()): DatosAlmacen {
  if (!id || !s) return {};
  try {
    const r = validarAlmacen(JSON.parse(s.getItem(PREFIJO_ALMACEN + id) ?? "{}"));
    return r.ok ? r.datos : {};
  } catch {
    return {};
  }
}

export function guardarAlmacen(
  id: string | null | undefined,
  crudo: unknown,
  s: StorageLike | null = almacenPorDefecto(),
  ahora = Date.now()
): { ok: true; vacio: boolean } | { ok: false; motivo: string } {
  if (!id) return { ok: false, motivo: "sin conversación activa" };
  if (!s) return { ok: false, motivo: "el navegador no deja guardar" };
  const r = validarAlmacen(crudo);
  if (!r.ok) return r;
  const vacio = Object.keys(r.datos).length === 0;
  try {
    let indice = leerIndice(s).filter((e) => e.id !== id);
    if (vacio) {
      s.removeItem(PREFIJO_ALMACEN + id);
    } else {
      s.setItem(PREFIJO_ALMACEN + id, JSON.stringify(r.datos));
      indice.push({ id, t: ahora });
      indice.sort((a, b) => b.t - a.t);
      for (const viejo of indice.slice(MAX_ALMACENES)) s.removeItem(PREFIJO_ALMACEN + viejo.id);
      indice = indice.slice(0, MAX_ALMACENES);
    }
    s.setItem(CLAVE_INDICE, JSON.stringify(indice));
    return { ok: true, vacio };
  } catch {
    return { ok: false, motivo: "el almacenamiento del navegador está lleno" };
  }
}

export function borrarAlmacen(id: string | null | undefined, s: StorageLike | null = almacenPorDefecto()): void {
  if (!id || !s) return;
  try {
    s.removeItem(PREFIJO_ALMACEN + id);
    s.setItem(CLAVE_INDICE, JSON.stringify(leerIndice(s).filter((e) => e.id !== id)));
  } catch {
    /* nada que borrar */
  }
}

/** JSON que se puede meter dentro de un <script> sin cerrarlo antes de
 *  tiempo: `</script>` o `<!--` dentro de un valor no pueden escapar. */
function jsonSeguroEnScript(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Mete los datos guardados en el HTML, justo al abrir el <head> (antes del
 *  puente de consola, que los lee al arrancar). Que exista la variable —aunque
 *  sea `{}`— es lo que le dice al puente que aquí sí se persiste. */
export function sembrarAlmacen(html: string, datos: DatosAlmacen): string {
  if (!html) return html;
  const tag = `<script>window.__FORJA_ALMACEN__=${jsonSeguroEnScript(datos)};</script>`;
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (m) => `${m}\n${tag}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}\n${tag}`);
  return `${tag}\n${html}`;
}
