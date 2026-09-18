import { describe, it, expect } from "vitest";
import { prepareFiles } from "../../src/lib/forja/github-upload";
import { readZip, writeZip } from "../../src/lib/forja/zip";

/** Reproduce exactamente lo que hace `pickZipFile` en github-dialog.tsx: un
 * .zip suelto se lee con readZip() y cada entrada se envuelve en un File con
 * `webkitRelativePath` fijado a mano — así `prepareFiles` (que espera el
 * primer segmento de esa ruta como "la carpeta elegida") aplica las mismas
 * reglas de ignorados/tamaño que una carpeta real, sin duplicar lógica. */
function filesFromZipEntries(
  entries: { path: string; data: Uint8Array }[],
  zipRoot: string
): File[] {
  return entries.map((e) => {
    const f = new File([e.data as BlobPart], e.path.split("/").pop() || e.path);
    Object.defineProperty(f, "webkitRelativePath", {
      value: `${zipRoot}/${e.path}`,
      configurable: true,
    });
    return f;
  });
}

async function roundtripZip(files: { path: string; data: Uint8Array }[]) {
  const zip = writeZip(files);
  return readZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer);
}

describe("un .zip suelto subido como proyecto entero", () => {
  it("conserva la estructura de carpetas del proyecto", async () => {
    const enc = new TextEncoder();
    const entries = await roundtripZip([
      { path: "index.html", data: enc.encode("<h1>hola</h1>") },
      { path: "src/app.js", data: enc.encode("console.log(1)") },
      { path: "css/estilo.css", data: enc.encode("body{}") },
    ]);
    const files = filesFromZipEntries(entries, "mi-proyecto");
    const { keep, ignored, tooBig } = prepareFiles(files);
    expect(ignored).toBe(0);
    expect(tooBig).toHaveLength(0);
    expect(keep.map((k) => k.path).sort()).toEqual(["css/estilo.css", "index.html", "src/app.js"]);
  });

  it("sigue ignorando node_modules y .env dentro del zip, igual que en una carpeta real", async () => {
    const enc = new TextEncoder();
    const entries = await roundtripZip([
      { path: "index.html", data: enc.encode("<h1>hola</h1>") },
      { path: "node_modules/paquete/index.js", data: enc.encode("x") },
      { path: ".env", data: enc.encode("SECRETO=1") },
      { path: ".env.example", data: enc.encode("SECRETO=") },
    ]);
    const files = filesFromZipEntries(entries, "mi-proyecto");
    const { keep, ignored } = prepareFiles(files);
    expect(ignored).toBe(2); // node_modules/... y .env (no .env.example)
    expect(keep.map((k) => k.path).sort()).toEqual([".env.example", "index.html"]);
  });

  it("un zip sin archivos usables no revienta: prepareFiles devuelve todo vacío", async () => {
    const entries = await roundtripZip([]);
    const files = filesFromZipEntries(entries, "vacio");
    const { keep, ignored, tooBig } = prepareFiles(files);
    expect(keep).toEqual([]);
    expect(ignored).toBe(0);
    expect(tooBig).toEqual([]);
  });
});
