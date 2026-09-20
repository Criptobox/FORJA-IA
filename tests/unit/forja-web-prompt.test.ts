/** Forja IA — El flujo obligatorio de FORJA WEB tiene que ser real, no una
 * lista de cajas bonitas: el usuario pidió explícito que el orden se
 * ejecute de verdad y que, al reparar, el modelo corrija el archivo
 * original en vez de crear un "fix.ts"/"patch-final.js" aparte. Este test
 * vigila que el prompt siga nombrando cada paso y la prohibición, con las
 * herramientas reales del catálogo — no un texto que se quede desfasado. */
import { describe, it, expect } from "vitest";
import { FORJA_WEB_PROMPT } from "../../src/lib/forja/prompt-actual";
import { TOOL_BY_NAME } from "../../src/lib/forja/tools-catalog";

describe("FORJA_WEB_PROMPT", () => {
  it("nombra las ocho etapas del flujo, en orden", () => {
    const etapas = [
      "Conocimiento",
      "Diseño",
      "Arquitectura",
      "Código",
      "QA",
      "Reparación",
      "Nueva prueba",
      "Entrega",
    ];
    let ultimaPos = -1;
    for (const etapa of etapas) {
      const pos = FORJA_WEB_PROMPT.indexOf(etapa);
      expect(pos, `falta la etapa «${etapa}»`).toBeGreaterThan(-1);
      expect(pos, `«${etapa}» está fuera de orden`).toBeGreaterThan(ultimaPos);
      ultimaPos = pos;
    }
  });

  it("solo nombra herramientas que existen de verdad en el catálogo", () => {
    // El regex solo captura nombres «entre_comillas» sin puntos ni guiones,
    // así que los archivos de ejemplo (fix.ts, patch-final.js…) quedan
    // fuera solos: no hace falta filtrarlos a mano.
    const nombres = FORJA_WEB_PROMPT.match(/«([a-z_]+)»/g)?.map((m) => m.slice(1, -1)) ?? [];
    expect(nombres.length).toBeGreaterThan(0);
    for (const n of nombres) {
      expect(n in TOOL_BY_NAME, `«${n}» no está en TOOL_BY_NAME`).toBe(true);
    }
  });

  it("prohíbe explícitamente crear un archivo de parche aparte", () => {
    expect(FORJA_WEB_PROMPT).toMatch(/PROHIBIDO crear un archivo nuevo/);
    expect(FORJA_WEB_PROMPT).toContain("fix.ts");
    expect(FORJA_WEB_PROMPT).toContain("patch-final.js");
  });

  it("dice explícitamente que hay que corregir el MISMO archivo, no uno nuevo", () => {
    expect(FORJA_WEB_PROMPT).toMatch(/ESE MISMO archivo/);
  });
});
