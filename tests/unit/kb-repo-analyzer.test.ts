import { describe, expect, it } from "vitest";
import { analyzeZipRepository, renderKBRepoAnalysis } from "@/lib/forja/kb-repo-analyzer";
import { writeZip } from "@/lib/forja/zip";

function zipFile(name: string, files: { path: string; text: string }[]): File {
  const enc = new TextEncoder();
  const bytes = writeZip(files.map((f) => ({ path: f.path, data: enc.encode(f.text) })));
  return new File([bytes as BlobPart], name);
}

describe("kb-repo-analyzer", () => {
  it("renderiza un manifiesto compacto sin ocultar los contadores", () => {
    const text = renderKBRepoAnalysis({
      version: 1,
      id: "x",
      name: "demo",
      analyzedAt: new Date().toISOString(),
      totalFiles: 12,
      indexedFiles: 10,
      ignoredFiles: 2,
      totalBytes: 1234,
      technologies: ["TypeScript", "React"],
      frameworks: ["Next.js"],
      packageManagers: ["npm"],
      components: ["Button"],
      patterns: ["component-library"],
      licenses: ["LICENSE"],
      entryPoints: ["src/app/page.tsx"],
      importantFiles: ["package.json"],
      files: [],
    });
    expect(text).toContain("Archivos: 12 | indexados: 10 | ignorados: 2");
    expect(text).toContain("Next.js");
    expect(text).toContain("Button");
  });

  describe("analyzeZipRepository (proyecto real en memoria)", () => {
    it("detecta stack, framework, package manager, componentes, patrones, licencia, entradas y archivos importantes", async () => {
      const file = zipFile("proyecto.zip", [
        { path: "package.json", text: '{"name":"demo"}' },
        { path: "package-lock.json", text: "{}" },
        { path: "README.md", text: "# Demo" },
        { path: "LICENSE", text: "MIT License" },
        { path: "tsconfig.json", text: "{}" },
        { path: "next.config.ts", text: "export default {}" },
        { path: "src/app/page.tsx", text: "export default function Page() { return <div>hola</div>; }" },
        {
          path: "src/components/Button.tsx",
          text: "import { useState } from 'react';\nexport function Button() { const [x] = useState(0); return <button className=\"px-2\">{x}</button>; }",
        },
        { path: "src/lib/utils.ts", text: "export const x = 1;" },
        { path: "styles/globals.css", text: "body { margin: 0; }" },
      ]);

      const analysis = await analyzeZipRepository(file);

      expect(analysis.technologies).toContain("React");
      expect(analysis.technologies).toContain("TypeScript");
      expect(analysis.technologies).toContain("CSS");
      expect(analysis.frameworks).toContain("Next.js");
      expect(analysis.frameworks).toContain("React");
      expect(analysis.packageManagers).toEqual(["npm"]);
      expect(analysis.components).toContain("Button");
      expect(analysis.patterns).toContain("component-library");
      expect(analysis.patterns).toContain("utility-css");
      expect(analysis.licenses).toContain("LICENSE");
      expect(analysis.entryPoints).toContain("src/app/page.tsx");
      expect(analysis.importantFiles).toEqual(
        expect.arrayContaining(["package.json", "README.md", "tsconfig.json", "next.config.ts"])
      );
      expect(analysis.totalFiles).toBe(10);
      expect(analysis.ignoredFiles).toBe(0);
      expect(analysis.indexedFiles).toBe(10);
    });

    it("ignora node_modules, .git, dist, build, .next, coverage y archivos minificados/mapas", async () => {
      const file = zipFile("con-basura.zip", [
        { path: "index.html", text: "<html></html>" },
        { path: "node_modules/paquete/index.js", text: "module.exports = 1;" },
        { path: ".git/HEAD", text: "ref: refs/heads/main" },
        { path: "dist/bundle.js", text: "console.log(1)" },
        { path: "build/output.js", text: "console.log(1)" },
        { path: ".next/cache/x.json", text: "{}" },
        { path: "coverage/index.html", text: "<html></html>" },
        { path: "app.min.js", text: "!function(){}()" },
        { path: "app.js.map", text: "{}" },
      ]);

      const analysis = await analyzeZipRepository(file);

      expect(analysis.totalFiles).toBe(9);
      expect(analysis.indexedFiles).toBe(1);
      expect(analysis.ignoredFiles).toBe(8);
      expect(analysis.files.map((f) => f.path)).toEqual(["index.html"]);
    });

    it("quita la carpeta envolvente única antes de analizar, igual que el resto de flujos de ZIP", async () => {
      const file = zipFile("envuelto.zip", [
        { path: "mi-repo/package.json", text: "{}" },
        { path: "mi-repo/src/index.ts", text: "export {}" },
      ]);

      const analysis = await analyzeZipRepository(file);

      expect(analysis.importantFiles).toContain("package.json");
      expect(analysis.files.map((f) => f.path)).toEqual(
        expect.arrayContaining(["package.json", "src/index.ts"])
      );
    });

    it("un ZIP vacío no revienta: cero archivos, nada detectado", async () => {
      const file = zipFile("vacio.zip", []);
      const analysis = await analyzeZipRepository(file);
      expect(analysis.totalFiles).toBe(0);
      expect(analysis.technologies).toEqual([]);
      expect(analysis.frameworks).toEqual([]);
    });
  });
});
