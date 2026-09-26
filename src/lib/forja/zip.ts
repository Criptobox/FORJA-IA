/** Forja IA — ZIP mínimo sin dependencias (para el Sandbox).
 * Lector: usa DecompressionStream nativo del navegador (deflate-raw) + stored.
 * Escritor: método STORE (sin comprimir) con CRC32 — válido y universal.
 * Soporta nombres UTF-8 y carpetas anidadas. Sin zip64 (proyectos pequeños).
 */

export interface ZipEntry {
  path: string;
  size: number;
  data: Uint8Array;
  /** permiso de ejecución (scripts, `gradlew`…), si el ZIP lo guardó */
  exec?: boolean;
}

/** Lo que se leyó y lo que NO, dicho en voz alta. */
export interface LecturaZip {
  entries: ZipEntry[];
  /** carpetas de dependencias o basura del sistema que no se descomprimieron */
  omitidos: number;
  /** archivos con un método de compresión que el navegador no sabe abrir */
  noSoportados: string[];
}

export interface OpcionesZip {
  /** conservar también node_modules, .git, __MACOSX… (por defecto se omiten) */
  conBasura?: boolean;
}

const MAX_ENTRIES = 5000;
const MAX_TOTAL = 256 * 1024 * 1024; // 256 MB descomprimidos
const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

/** Lo que nunca es el proyecto: dependencias instaladas, el repo git por
 *  dentro y lo que añade macOS. Se salta SIN descomprimir, así un ZIP con
 *  `node_modules` (decenas de miles de archivos) ya no revienta el tope de
 *  entradas ni el de tamaño antes de llegar a ignorarse. */
const BASURA_RE = /(^|\/)(node_modules|\.git|__MACOSX)(\/|$)|(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/;

export function esBasuraZip(path: string): boolean {
  return BASURA_RE.test(path);
}

function u16(v: DataView, off: number): number {
  return v.getUint16(off, true);
}
function u32(v: DataView, off: number): number {
  return v.getUint32(off, true);
}

/** Encuentra el EOCD escaneando hacia atrás (máx. 64 KB de comentario). */
function findEocd(v: DataView): number {
  const min = Math.max(0, v.byteLength - 22 - 65535);
  for (let i = v.byteLength - 22; i >= min; i--) {
    if (u32(v, i) === EOCD_SIG) return i;
  }
  return -1;
}

/** CP437: la codificación de los nombres en los ZIP que hace Windows (el
 *  «Enviar a → Carpeta comprimida»). Sin esto, «diseño/menú.html» llegaba
 *  como «dise±o/men·.html» y el enlace del HTML ya no casaba con el archivo. */
const CP437_ALTO =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0";

function decodeNombre(bytes: Uint8Array, utf8: boolean): string {
  if (utf8) return new TextDecoder().decode(bytes);
  // Sin la marca UTF-8: si aun así es UTF-8 válido (muchas herramientas no
  // ponen la marca), se respeta; si no, es CP437.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    let out = "";
    for (const b of bytes) out += b < 128 ? String.fromCharCode(b) : CP437_ALTO[b - 128];
    return out;
  }
}

/** Ruta segura: sin barras invertidas, sin «/» inicial, sin «..» ni «.». Un
 *  ZIP puede traer «../../algo» y no debe poder salirse del proyecto. */
function rutaSegura(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p && p !== "." && p !== "..")
    .join("/");
}

export async function leerZip(buf: ArrayBuffer, opts: OpcionesZip = {}): Promise<LecturaZip> {
  const v = new DataView(buf);
  const eocd = findEocd(v);
  if (eocd < 0) throw new Error("El archivo no parece un ZIP válido.");
  const count = u16(v, eocd + 10);
  let cdOff = u32(v, eocd + 16);

  const out: ZipEntry[] = [];
  const noSoportados: string[] = [];
  let omitidos = 0;
  let total = 0;

  for (let i = 0; i < count; i++) {
    if (cdOff + 46 > v.byteLength || u32(v, cdOff) !== CDH_SIG)
      throw new Error("ZIP corrupto: cabecera central no válida.");
    const hechoPor = u16(v, cdOff + 4) >> 8; // 3 = Unix
    const flags = u16(v, cdOff + 8);
    const method = u16(v, cdOff + 10);
    const compSize = u32(v, cdOff + 20);
    const nameLen = u16(v, cdOff + 28);
    const extraLen = u16(v, cdOff + 30);
    const commentLen = u16(v, cdOff + 32);
    const attrExt = u32(v, cdOff + 38);
    const lfhOff = u32(v, cdOff + 42);
    const crudo = decodeNombre(new Uint8Array(buf, cdOff + 46, nameLen), (flags & 0x800) !== 0);
    cdOff += 46 + nameLen + extraLen + commentLen;

    if (crudo.endsWith("/") || crudo.endsWith("\\")) continue; // carpeta
    const path = rutaSegura(crudo);
    if (!path) continue;
    if (!opts.conBasura && esBasuraZip(path)) {
      omitidos++;
      continue;
    }
    if (flags & 0x1) {
      throw new Error("El ZIP está protegido con contraseña. Descomprímelo y vuelve a comprimirlo sin contraseña.");
    }
    if (method !== 0 && method !== 8) {
      noSoportados.push(path);
      continue;
    }
    if (out.length >= MAX_ENTRIES) throw new Error(`Demasiados archivos en el ZIP (más de ${MAX_ENTRIES} sin contar dependencias).`);
    const unixMode = hechoPor === 3 ? attrExt >>> 16 : 0;
    const exec = (unixMode & 0o111) !== 0 && (unixMode & 0o170000) !== 0o120000 ? true : undefined;

    if (compSize === 0) {
      out.push({ path, size: 0, data: new Uint8Array(0), ...(exec ? { exec } : {}) });
      continue;
    }

    // cabecera local (tiene sus propias longitudes de nombre/extra)
    if (lfhOff + 30 > v.byteLength || u32(v, lfhOff) !== LFH_SIG)
      throw new Error("ZIP corrupto: cabecera local no válida.");
    const lNameLen = u16(v, lfhOff + 26);
    const lExtraLen = u16(v, lfhOff + 28);
    const dataStart = lfhOff + 30 + lNameLen + lExtraLen;
    if (dataStart + compSize > v.byteLength)
      throw new Error("ZIP corrupto: datos truncados.");
    const raw = new Uint8Array(buf.slice(dataStart, dataStart + compSize));

    let data: Uint8Array;
    if (method === 0) {
      data = raw;
    } else {
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Blob([raw as BlobPart]).stream().pipeThrough(ds);
      const ab = await new Response(stream).arrayBuffer();
      data = new Uint8Array(ab);
    }
    total += data.length;
    if (total > MAX_TOTAL) throw new Error("El ZIP descomprimido es demasiado grande (máx. 256 MB sin contar dependencias).");
    out.push({ path, size: data.length, data, ...(exec ? { exec } : {}) });
  }
  return { entries: out, omitidos, noSoportados };
}

/** Las entradas del ZIP, sin dependencias ni basura del sistema. */
export async function readZip(buf: ArrayBuffer, opts: OpcionesZip = {}): Promise<ZipEntry[]> {
  return (await leerZip(buf, opts)).entries;
}

/** Si TODAS las entradas comparten una única carpeta de primer nivel, la
 * quita — es el caso de un ZIP descargado de GitHub ("mi-repo-main/…" para
 * cada archivo, o cualquier proyecto exportado igual): sin esto, el
 * proyecto quedaba con esa carpeta como único elemento en la raíz, con todo
 * dentro, en vez de con los archivos y carpetas reales del proyecto.
 *
 * Si hay más de un archivo o carpeta en el primer nivel, no se toca nada:
 * esa SÍ es la raíz real del proyecto (un ZIP normal de una web, con
 * `index.html` y `css/` sueltos, tiene que seguir así). Repite mientras siga
 * habiendo una única carpeta envolviendo (tope de 5 vueltas: un ZIP de
 * verdad no anida así de hondo, y evita un bucle si algo raro pasara). */
export function dropWrapperFolder<T extends { path: string }>(entries: readonly T[]): T[] {
  let out: T[] = [...entries];
  for (let vuelta = 0; vuelta < 5 && out.length > 0; vuelta++) {
    const raiz = out[0]!.path.split("/")[0];
    if (!raiz) break;
    const todasEnvueltas = out.every((e) => e.path.startsWith(`${raiz}/`));
    if (!todasEnvueltas) break;
    out = out.map((e) => ({ ...e, path: e.path.slice(raiz.length + 1) }));
  }
  return out;
}

/* ---------- escritor (STORE) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Crea un ZIP (STORE) válido con los archivos dados. Rutas con «/». */
export function writeZip(files: { path: string; data: Uint8Array; exec?: boolean }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const push = (arr: Uint8Array) => {
    chunks.push(arr);
    offset += arr.length;
  };

  for (const f of files) {
    const path = f.path.replace(/\\/g, "/").replace(/^\/+/, "");
    const name = enc.encode(path);
    const crc = crc32(f.data);
    const size = f.data.length;

    const lfh = new Uint8Array(30 + name.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, LFH_SIG, true);
    lv.setUint16(4, 20, true); // versión
    lv.setUint16(6, 0x0800, true); // flag UTF-8
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true); // hora
    lv.setUint16(12, 0x21, true); // fecha (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // comprimido
    lv.setUint32(22, size, true); // original
    lv.setUint16(26, name.length, true);
    lfh.set(name, 30);
    push(lfh);
    push(f.data);

    const cdh = new Uint8Array(46 + name.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, CDH_SIG, true);
    // «hecho en Unix» + modo en los atributos externos: así el permiso de
    // ejecución de un script sobrevive al ZIP (lo lee `leerZip`)
    cv.setUint16(4, (3 << 8) | 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(38, ((f.exec ? 0o100755 : 0o100644) << 16) >>> 0, true);
    cv.setUint32(42, offset - size - lfh.length, true); // offset local
    cdh.set(name, 46);
    central.push(cdh);
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) {
    push(c);
    cdSize += c.length;
  }
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, EOCD_SIG, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  push(eocd);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
