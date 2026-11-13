import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TINTA_VERSION } from "@/lib/forja/tinta/version";

/** El motor Tinta que sirve FORJA (public/tinta/motor.html) sale de tinta/web/.
 *  Si alguien toca las fuentes y no reconstruye, esto lo dice. */
describe("motor Tinta", () => {
  it("public/tinta/motor.html está al día con tinta/web/", () => {
    expect(() => execFileSync("node", ["scripts/tinta-construir.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
  });

  it("trae el modo motor y la huella coincide", () => {
    const html = readFileSync("public/tinta/motor.html", "utf8");
    const js = Buffer.from(html.match(/atob\('([A-Za-z0-9+/=]+)'\)/)?.[1] ?? "", "base64").toString("utf8");
    expect(js).toContain("tinta:pedir");
    expect(js).toContain("MOTOR_API");
    expect(TINTA_VERSION).toMatch(/^[0-9a-f]{12}$/);
    expect(html).not.toContain('href="agente.html"');
  });
});
