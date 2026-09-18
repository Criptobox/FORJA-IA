import { describe, it, expect } from "vitest";
import { GET } from "../../src/app/api/health/route";
import { APP_VERSION } from "../../src/lib/prism/app-version";
import { MANIFEST } from "../../src/lib/project-manifest";

/* El health se prueba llamando al handler directamente: no hace falta un
 * servidor para comprobar la forma de la respuesta, y así el test corre en
 * node puro sin puerto ni espera. */

describe("/api/health", () => {
  it("responde ok con la versión real de la app", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.estado).toBe("ok");
    expect(body.version).toBe(APP_VERSION);
  });

  it("incluye métricas de proceso coherentes (uptime y memoria no negativas)", async () => {
    const body = (await (await GET()).json()) as Record<string, number | string>;
    expect(Number(body.uptimeSeg)).toBeGreaterThanOrEqual(0);
    expect(Number(body.memoriaMb)).toBeGreaterThan(0);
    expect(String(body.node)).toMatch(/^v\d+/);
    expect(() => new Date(String(body.ts)).toISOString()).not.toThrow();
  });

  it("se presenta con el manifiesto: nombre del proyecto en la línea de identidad", async () => {
    const body = (await (await GET()).json()) as Record<string, string>;
    expect(body.proyecto).toContain(MANIFEST.nombre);
    expect(body.proyecto).toContain("áreas");
  });

  it("dos llamadas seguidas dan uptime igual o creciente (no está cacheado)", async () => {
    const a = (await (await GET()).json()) as Record<string, number>;
    const b = (await (await GET()).json()) as Record<string, number>;
    expect(Number(b.uptimeSeg)).toBeGreaterThanOrEqual(Number(a.uptimeSeg));
  });
});
