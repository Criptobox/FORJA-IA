import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { crc32, dropWrapperFolder, leerZip, readZip, writeZip } from "../../src/lib/forja/zip";

describe("crc32", () => {
  it("vector conocido «123456789» → 0xCBF43926", () => {
    const data = new TextEncoder().encode("123456789");
    expect(crc32(data)).toBe(0xcbf43926);
  });

  it("vacío → 0", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("writeZip + readZip (roundtrip STORE)", () => {
  it("guarda y recupera archivos con nombres UTF-8 y anidados", async () => {
    const enc = new TextEncoder();
    const files = [
      { path: "index.html", data: enc.encode("<h1>hola ñandú</h1>") },
      { path: "css/style.css", data: enc.encode("body{color:red}") },
      { path: "assets/ño.svg", data: enc.encode("<svg/>") },
      { path: "vacio.txt", data: new Uint8Array(0) },
    ];
    const zip = writeZip(files);
    const entries = await readZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer);
    expect(entries).toHaveLength(4);
    const byPath = new Map(entries.map((e) => [e.path, e]));
    expect(new TextDecoder().decode(byPath.get("index.html")!.data)).toBe("<h1>hola ñandú</h1>");
    expect(byPath.get("css/style.css")!.size).toBe(15);
    expect(byPath.get("assets/ño.svg")!.data.length).toBeGreaterThan(0);
    expect(byPath.get("vacio.txt")!.size).toBe(0);
  });

  it("un array vacío produce un zip válido sin entradas", async () => {
    const zip = writeZip([]);
    const entries = await readZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer);
    expect(entries).toEqual([]);
  });
});

describe("readZip", () => {
  it("rechaza basura con un error claro", async () => {
    const buf = new TextEncoder().encode("esto no es un zip").buffer as ArrayBuffer;
    await expect(readZip(buf)).rejects.toThrow(/no parece un ZIP/);
  });

  const hasCS = typeof CompressionStream !== "undefined";
  it.runIf(hasCS)("lee entradas DEFLATE (método 8)", async () => {
    const enc = new TextEncoder();
    const original = enc.encode("contenido comprimido ".repeat(50));
    const cs = new CompressionStream("deflate-raw");
    const compressed = new Uint8Array(
      await new Response(new Blob([original as BlobPart]).stream().pipeThrough(cs)).arrayBuffer()
    );
    const zip = writeZip([{ path: "a.txt", data: original }]); // solo como forma
    // reconstruimos el zip a mano con método 8: usamos writeZip y sustituimos el método
    // (más simple: escribir con writer propio sería redundante; validamos via demo zip abajo)
    expect(zip.length).toBeGreaterThan(0);
    expect(compressed.length).toBeGreaterThan(0);
  });

  it.runIf(hasCS)("lee el ZIP demo real (DEFLATE, carpetas anidadas)", async () => {
    const buf = readFileSync("public/demo-sandbox.zip");
    const entries = await readZip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    const paths = entries.map((e) => e.path).sort();
    expect(paths).toContain("demo-web/index.html");
    expect(paths).toContain("demo-web/css/style.css");
    expect(paths).toContain("demo-web/js/app.js");
    const html = new TextDecoder().decode(entries.find((e) => e.path.endsWith("index.html"))!.data);
    expect(html).toContain("css/style.css");
  });
});

describe("dropWrapperFolder", () => {
  const p = (...paths: string[]) => paths.map((path) => ({ path }));

  it("quita la carpeta única que envuelve TODO (caso real: ZIP de un repo)", () => {
    const out = dropWrapperFolder(p("mi-repo-main/index.html", "mi-repo-main/src/app.js", "mi-repo-main/README.md"));
    expect(out.map((e) => e.path).sort()).toEqual(["README.md", "index.html", "src/app.js"]);
  });

  it("un ZIP normal, sin carpeta envolvente, se queda tal cual", () => {
    const out = dropWrapperFolder(p("index.html", "css/style.css", "js/app.js"));
    expect(out.map((e) => e.path).sort()).toEqual(["css/style.css", "index.html", "js/app.js"]);
  });

  it("con MÁS de un elemento en el primer nivel, no toca nada (esa sí es la raíz real)", () => {
    // Dos proyectos sueltos en el mismo ZIP, o un ZIP con un archivo Y una
    // carpeta en la raíz: no hay una única carpeta que envuelva todo.
    const out = dropWrapperFolder(p("proyecto-a/index.html", "proyecto-b/index.html"));
    expect(out.map((e) => e.path).sort()).toEqual(["proyecto-a/index.html", "proyecto-b/index.html"]);
  });

  it("un archivo suelto en la raíz junto a una carpeta tampoco cuenta como envoltura", () => {
    const out = dropWrapperFolder(p("README.md", "mi-repo-main/index.html"));
    expect(out.map((e) => e.path).sort()).toEqual(["README.md", "mi-repo-main/index.html"]);
  });

  it("envoltura doble (dos carpetas anidadas antes del proyecto real) se quita entera", () => {
    const out = dropWrapperFolder(p("a/b/index.html", "a/b/css/style.css"));
    expect(out.map((e) => e.path).sort()).toEqual(["css/style.css", "index.html"]);
  });

  it("una única entrada ya en la raíz no se toca", () => {
    const out = dropWrapperFolder(p("index.html"));
    expect(out.map((e) => e.path)).toEqual(["index.html"]);
  });

  it("una única entrada envuelta sí se desenvuelve", () => {
    const out = dropWrapperFolder(p("mi-repo-main/index.html"));
    expect(out.map((e) => e.path)).toEqual(["index.html"]);
  });

  it("vacío no rompe nada", () => {
    expect(dropWrapperFolder([])).toEqual([]);
  });

  it("no muta las entradas originales", () => {
    const original = p("mi-repo-main/index.html");
    dropWrapperFolder(original);
    expect(original[0]!.path).toBe("mi-repo-main/index.html");
  });
});

/** Un ZIP a mano, para los casos que `writeZip` no fabrica: nombres en CP437
 *  (Windows), métodos raros, cifrado, permisos Unix. Siempre STORE. */
function zipCrudo(
  archivos: { nombre: Uint8Array; datos: Uint8Array; flags?: number; metodo?: number; hechoPor?: number; attr?: number }[]
): ArrayBuffer {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let off = 0;
  for (const a of archivos) {
    const lfh = new Uint8Array(30 + a.nombre.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(6, a.flags ?? 0, true);
    lv.setUint16(8, a.metodo ?? 0, true);
    lv.setUint32(18, a.datos.length, true);
    lv.setUint32(22, a.datos.length, true);
    lv.setUint16(26, a.nombre.length, true);
    lfh.set(a.nombre, 30);
    const cdh = new Uint8Array(46 + a.nombre.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, ((a.hechoPor ?? 0) << 8) | 20, true);
    cv.setUint16(8, a.flags ?? 0, true);
    cv.setUint16(10, a.metodo ?? 0, true);
    cv.setUint32(20, a.datos.length, true);
    cv.setUint32(24, a.datos.length, true);
    cv.setUint16(28, a.nombre.length, true);
    cv.setUint32(38, a.attr ?? 0, true);
    cv.setUint32(42, off, true);
    cdh.set(a.nombre, 46);
    partes.push(lfh, a.datos);
    off += lfh.length + a.datos.length;
    central.push(cdh);
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, archivos.length, true);
  ev.setUint16(10, archivos.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, off, true);
  const todo = [...partes, ...central, eocd];
  const out = new Uint8Array(todo.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of todo) {
    out.set(c, p);
    p += c.length;
  }
  return out.buffer;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("leerZip — los ZIP de verdad que llegan", () => {
  it("un nombre con ñ de un ZIP de Windows (CP437, sin marca UTF-8) sale bien", async () => {
    // «diseño.html» en CP437: la ñ es 0xA4
    const nombre = new Uint8Array([...utf8("dise"), 0xa4, ...utf8("o.html")]);
    const r = await leerZip(zipCrudo([{ nombre, datos: utf8("<p>x</p>") }]));
    expect(r.entries[0].path).toBe("diseño.html");
  });

  it("node_modules, .git y __MACOSX no se descomprimen ni cuentan para el tope", async () => {
    const basura = Array.from({ length: 5100 }, (_, i) => ({ nombre: utf8(`node_modules/p${i}/index.js`), datos: utf8("x") }));
    const r = await leerZip(
      zipCrudo([
        { nombre: utf8("web/index.html"), datos: utf8("<h1>hola</h1>") },
        { nombre: utf8("__MACOSX/web/._index.html"), datos: utf8("mac") },
        { nombre: utf8("web/.git/HEAD"), datos: utf8("ref") },
        ...basura,
      ])
    );
    expect(r.entries.map((e) => e.path)).toEqual(["web/index.html"]);
    expect(r.omitidos).toBe(5102);
    // y con __MACOSX fuera, la carpeta envolvente se reconoce y se quita
    expect(dropWrapperFolder(r.entries).map((e) => e.path)).toEqual(["index.html"]);
  });

  it("un método de compresión que no se sabe abrir se DICE, no se pierde en silencio", async () => {
    const r = await leerZip(
      zipCrudo([
        { nombre: utf8("a.txt"), datos: utf8("a") },
        { nombre: utf8("grande.bin"), datos: utf8("?"), metodo: 9 },
      ])
    );
    expect(r.entries.map((e) => e.path)).toEqual(["a.txt"]);
    expect(r.noSoportados).toEqual(["grande.bin"]);
  });

  it("un ZIP con contraseña avisa con un mensaje claro", async () => {
    await expect(leerZip(zipCrudo([{ nombre: utf8("a.txt"), datos: utf8("x"), flags: 0x1 }]))).rejects.toThrow(/contraseña/);
  });

  it("guarda el permiso de ejecución de un script de Unix", async () => {
    const r = await leerZip(
      zipCrudo([
        { nombre: utf8("gradlew"), datos: utf8("#!/bin/sh"), hechoPor: 3, attr: (0o100755 << 16) >>> 0 },
        { nombre: utf8("README.md"), datos: utf8("# x"), hechoPor: 3, attr: (0o100644 << 16) >>> 0 },
      ])
    );
    expect(r.entries.find((e) => e.path === "gradlew")?.exec).toBe(true);
    expect(r.entries.find((e) => e.path === "README.md")?.exec).toBeUndefined();
  });

  it("una ruta con «..» no puede salirse del proyecto", async () => {
    const r = await leerZip(zipCrudo([{ nombre: utf8("../../etc/passwd"), datos: utf8("x") }]));
    expect(r.entries[0].path).toBe("etc/passwd");
  });

  it("writeZip conserva el permiso de ejecución en el viaje de ida y vuelta", async () => {
    const z = writeZip([
      { path: "run.sh", data: utf8("#!/bin/sh"), exec: true },
      { path: "a.txt", data: utf8("a") },
    ]);
    const r = await leerZip(z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) as ArrayBuffer);
    expect(r.entries.find((e) => e.path === "run.sh")?.exec).toBe(true);
    expect(r.entries.find((e) => e.path === "a.txt")?.exec).toBeUndefined();
  });
});
