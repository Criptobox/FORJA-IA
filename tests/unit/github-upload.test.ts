import { describe, it, expect } from "vitest";
import {
  necesitaInstalarApp,
  pistaDeGithub,
  shouldIgnore,
} from "../../src/lib/forja/github-upload";

describe("shouldIgnore", () => {
  it("deja fuera los .env con valores reales", () => {
    for (const p of [".env", ".env.local", ".env.production", "app/.env", "app/.env.local"]) {
      expect(shouldIgnore(p), p).toBe(true);
    }
  });

  it("SÍ sube las plantillas de entorno: son las que hay que publicar", () => {
    for (const p of [
      ".env.example",
      ".env.sample",
      ".env.template",
      "app/.env.example",
      "config/.env.sample",
    ]) {
      expect(shouldIgnore(p), p).toBe(false);
    }
  });

  it("deja fuera carpetas generadas y basura del sistema", () => {
    for (const p of [
      "node_modules/react/index.js",
      ".next/build.js",
      "dist/app.js",
      "coverage/lcov.info",
      ".DS_Store",
      "sub/Thumbs.db",
      "salida.log",
      "paquete.zip",
    ]) {
      expect(shouldIgnore(p), p).toBe(true);
    }
  });

  it("no confunde nombres que solo se parecen", () => {
    for (const p of ["environment.ts", "src/env.ts", "docs/node_modules.md", "logica.ts"]) {
      expect(shouldIgnore(p), p).toBe(false);
    }
  });
});

describe("pistaDeGithub", () => {
  it("en un 403 con token de GitHub App, apunta a instalar el repo (no a un scope que no existe)", () => {
    const pista = pistaDeGithub(403, "Resource not accessible by integration", "ghu_abc123");
    expect(pista).toMatch(/no tiene acceso a ESTE repo/);
    expect(pista).toContain("https://github.com/settings/installations");
    expect(pista).not.toMatch(/scope/);
  });

  it("en un 404 con token de GitHub App, también apunta a instalar el repo", () => {
    const pista = pistaDeGithub(404, "Not Found", "ghu_abc123");
    expect(pista).toContain("https://github.com/settings/installations");
  });

  it("en un 403 con token clásico (PAT), sigue hablando del alcance «repo»", () => {
    const pista = pistaDeGithub(403, "message", "ghp_abc123");
    expect(pista).toMatch(/alcance «repo»/);
    expect(pista).not.toMatch(/installations/);
  });

  it("en un 403 con token de OAuth App clásica, sigue hablando del alcance «repo»", () => {
    const pista = pistaDeGithub(403, "message", "gho_abc123");
    expect(pista).toMatch(/alcance «repo»/);
  });

  it("el límite de peticiones se detecta antes que el tipo de token", () => {
    const pista = pistaDeGithub(403, "API rate limit exceeded", "ghu_abc123");
    expect(pista).toMatch(/límite de peticiones/);
  });
});

describe("necesitaInstalarApp", () => {
  it("un 403 con token de GitHub App necesita instalación", () => {
    expect(necesitaInstalarApp(403, "Resource not accessible by integration", "ghu_abc123")).toBe(true);
  });

  it("un 404 con token de GitHub App también", () => {
    expect(necesitaInstalarApp(404, "Not Found", "ghu_abc123")).toBe(true);
  });

  it("un 403 con token clásico (PAT) NO es de instalación", () => {
    expect(necesitaInstalarApp(403, "message", "ghp_abc123")).toBe(false);
  });

  it("un 403 de límite de peticiones NO es de instalación, aunque el token sea de la App", () => {
    expect(necesitaInstalarApp(403, "API rate limit exceeded", "ghu_abc123")).toBe(false);
  });

  it("otros códigos (401, 500…) nunca son de instalación", () => {
    expect(necesitaInstalarApp(401, "Bad credentials", "ghu_abc123")).toBe(false);
    expect(necesitaInstalarApp(500, "boom", "ghu_abc123")).toBe(false);
  });
});
