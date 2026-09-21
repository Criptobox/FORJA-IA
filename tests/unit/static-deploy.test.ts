/** Tests de static-deploy.ts: el HTML autocontenido tiene que sobrevivir
 * intacto al viaje comprimir → base64url → descomprimir, porque ese
 * fragmento es el ÚNICO sitio donde vive el sitio desplegado — si el
 * round-trip pierde un byte, el despliegue queda roto sin forma de
 * recuperarlo (no hay copia en ningún servidor). */
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encodeDeploy, decodeDeploy, MAX_FRAGMENT_BYTES } from "../../src/lib/forja/static-deploy";

describe("encodeDeploy / decodeDeploy — round-trip", () => {
  it("HTML simple: decodeDeploy devuelve exactamente el mismo HTML", async () => {
    const html = "<!doctype html><html><body><h1>Hola</h1></body></html>";
    const { fragment, tooLarge } = await encodeDeploy(html);
    expect(tooLarge).toBe(false);
    expect(fragment).not.toContain("+");
    expect(fragment).not.toContain("/");
    expect(fragment).not.toContain("=");
    const decoded = await decodeDeploy(fragment);
    expect(decoded).toBe(html);
  });

  it("HTML con acentos, emoji y caracteres especiales sobrevive el round-trip", async () => {
    const html =
      '<!doctype html><html><body><p>Ñoño café 🚀 — «comillas» & <script>1<2</script></p></body></html>';
    const { fragment } = await encodeDeploy(html);
    const decoded = await decodeDeploy(fragment);
    expect(decoded).toBe(html);
  });

  it("HTML grande (varios MB de texto repetido) también hace round-trip", async () => {
    const html = `<!doctype html><html><body>${"<p>línea de prueba</p>".repeat(50_000)}</body></html>`;
    const { fragment, bytes } = await encodeDeploy(html);
    expect(bytes).toBeGreaterThan(0);
    const decoded = await decodeDeploy(fragment);
    expect(decoded).toBe(html);
  });

  it("marca tooLarge cuando el fragmento comprimido supera el tope", async () => {
    // Bytes al azar de verdad (no texto): gzip no los reduce nada, así que
    // el tamaño del fragmento queda predecible sin generar gigabytes de HTML.
    const random = randomBytes(2_000_000).toString("latin1");
    const { tooLarge, bytes } = await encodeDeploy(random);
    expect(tooLarge).toBe(true);
    expect(bytes).toBeGreaterThan(MAX_FRAGMENT_BYTES);
  });

  it("decodeDeploy con un fragmento corrupto rechaza en vez de devolver basura silenciosa", async () => {
    await expect(decodeDeploy("esto-no-es-gzip-valido")).rejects.toBeTruthy();
  });
});
