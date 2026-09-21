import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectPackageManager,
  hasBuildScript,
  findStaticOutputDir,
  trimLog,
} from "@/app/api/repos/route";

const dirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "forja-repos-build-"));
  dirs.push(d);
  return d;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("api/repos build helpers", () => {
  it("detecta el gestor de paquetes por el lockfile presente, no por preferencia", () => {
    const npmDir = tempDir();
    expect(detectPackageManager(npmDir)).toBe("npm");

    const yarnDir = tempDir();
    writeFileSync(join(yarnDir, "yarn.lock"), "");
    expect(detectPackageManager(yarnDir)).toBe("yarn");

    const pnpmDir = tempDir();
    writeFileSync(join(pnpmDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(pnpmDir)).toBe("pnpm");
  });

  it("pnpm-lock.yaml manda incluso si también hay yarn.lock (poco común, pero el pnpm es el más específico)", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "yarn.lock"), "");
    writeFileSync(join(dir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(dir)).toBe("pnpm");
  });

  it("solo confirma un script build si package.json lo declara de verdad", () => {
    const withBuild = tempDir();
    writeFileSync(join(withBuild, "package.json"), JSON.stringify({ scripts: { build: "vite build" } }));
    expect(hasBuildScript(withBuild)).toBe(true);

    const withoutBuild = tempDir();
    writeFileSync(join(withoutBuild, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    expect(hasBuildScript(withoutBuild)).toBe(false);

    const missing = tempDir();
    expect(hasBuildScript(missing)).toBe(false);

    const broken = tempDir();
    writeFileSync(join(broken, "package.json"), "{ esto no es json");
    expect(hasBuildScript(broken)).toBe(false);
  });

  it("encuentra la salida estática entre out/dist/build, en ese orden", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "dist"));
    writeFileSync(join(dir, "dist", "index.html"), "<html></html>");
    expect(findStaticOutputDir(dir)).toBe("dist");

    mkdirSync(join(dir, "out"));
    writeFileSync(join(dir, "out", "index.html"), "<html></html>");
    expect(findStaticOutputDir(dir)).toBe("out");
  });

  it("no confunde una carpeta de salida vieja/vacía con una build real", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "dist"));
    writeFileSync(join(dir, "dist", "stats.json"), "{}");
    // "dist" existe pero no tiene index.html: no cuenta como salida estática.
    expect(findStaticOutputDir(dir)).toBeNull();
  });

  it("sin ninguna carpeta de salida, no hay nada que previsualizar (proyecto con SSR real)", () => {
    const dir = tempDir();
    expect(findStaticOutputDir(dir)).toBeNull();
  });

  it("recorta el log de un proceso a lo último, que es lo que explica el fallo", () => {
    const text = `linea inicial\n${"x".repeat(5000)}\nerror real al final`;
    const trimmed = trimLog(text, 100);
    expect(trimmed.endsWith("error real al final")).toBe(true);
    expect(trimmed.length).toBeLessThanOrEqual(102);
  });

  it("un log corto no se recorta", () => {
    expect(trimLog("todo bien")).toBe("todo bien");
  });
});
