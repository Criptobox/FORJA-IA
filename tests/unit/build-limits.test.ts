/** Tests de build-limits.ts.
 *
 * El bug real que motivó esto: al desplegar un proyecto grande desde el
 * Sandbox, Vercel rechazaba el cuerpo de la petición con una respuesta de
 * texto plano ("Request Entity Too Large", no JSON) y el cliente reventaba
 * con "Unexpected token 'R', "Request En"... is not valid JSON" en vez de
 * un error legible. `parseBuildResponse` es lo que evita eso ahora. */
import { describe, it, expect } from "vitest";
import { buildUploadSizeError, parseBuildResponse, MAX_BUILD_UPLOAD_BYTES } from "../../src/lib/forja/build-limits";

describe("buildUploadSizeError", () => {
  it("null cuando el proyecto está por debajo del tope", () => {
    expect(buildUploadSizeError(1024)).toBeNull();
    expect(buildUploadSizeError(MAX_BUILD_UPLOAD_BYTES)).toBeNull();
  });

  it("mensaje claro (con MB) cuando supera el tope", () => {
    const msg = buildUploadSizeError(MAX_BUILD_UPLOAD_BYTES + 1);
    expect(msg).not.toBeNull();
    expect(msg).toContain("MB");
    expect(msg).toContain(String(MAX_BUILD_UPLOAD_BYTES / (1024 * 1024)));
  });
});

describe("parseBuildResponse", () => {
  it("respuesta 200 con JSON válido: devuelve el objeto parseado", () => {
    const body = JSON.stringify({ status: "built", outputDir: "dist" });
    expect(parseBuildResponse(200, body)).toEqual({ status: "built", outputDir: "dist" });
  });

  it('respuesta de error JSON (4xx/5xx de nuestro propio código): lanza con el mensaje de "error"', () => {
    const body = JSON.stringify({ error: "El package.json no declara un script «build»." });
    expect(() => parseBuildResponse(400, body)).toThrow("El package.json no declara un script «build».");
  });

  it("413 con cuerpo de texto plano (el caso real reportado): lanza un mensaje legible, no un parseo roto", () => {
    expect(() => parseBuildResponse(413, "Request Entity Too Large")).toThrow(
      /demasiado grande/i
    );
  });

  it('cuerpo no-JSON sin ser 413 ni mencionar "request entity too large": lanza con el status y un fragmento del texto', () => {
    expect(() => parseBuildResponse(502, "<html>Bad Gateway</html>")).toThrow(/502/);
  });

  it("cuerpo vacío con status 200: no revienta, devuelve objeto vacío", () => {
    expect(parseBuildResponse(200, "")).toEqual({});
  });

  it("cuerpo vacío con status de error: lanza con el código de status", () => {
    expect(() => parseBuildResponse(500, "")).toThrow("500");
  });
});
