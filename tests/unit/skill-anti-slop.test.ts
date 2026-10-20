/** Forja IA — Skill "Antimuestrario + paletas listas" (skill-anti-slop).
 *
 * El usuario preguntó por skills públicas de la comunidad (DESIGN.md,
 * Impeccable, UI/UX Pro Max) que dan a los agentes de código reglas
 * concretas anti-genérico y paletas curadas. Se destiló lo de más valor
 * en una skill nueva, DESACTIVADA por defecto: añadirla a «Diseños que no
 * se repiten» (que sí va activada de fábrica) rompía el tope de
 * presupuesto de las skills por defecto (`presupuesto.test.ts`).
 */
import { describe, expect, it } from "vitest";
import { BUILTIN_SKILLS } from "../../src/lib/forja/skills-data";

const skill = BUILTIN_SKILLS.find((s) => s.id === "skill-anti-slop");

describe("skill-anti-slop", () => {
  it("existe y va DESACTIVADA por defecto", () => {
    expect(skill).toBeDefined();
    expect(skill?.enabled).toBe(false);
  });

  it("trae reglas antimuestrario concretas y paletas completas listas para usar", () => {
    expect(skill?.instructions).toMatch(/Antimuestrario/);
    expect(skill?.instructions).toMatch(/emoji/i);
    expect(skill?.instructions).toMatch(/#[0-9A-Fa-f]{6}/);
    expect(skill?.instructions).toMatch(/prefers-reduced-motion/);
  });

  it("no duplica la instrucción de «Diseños que no se repiten»: es una AMPLIACIÓN, no otra skill de variedad", () => {
    expect(skill?.instructions).not.toMatch(/nunca se parezcan/i);
  });
});
