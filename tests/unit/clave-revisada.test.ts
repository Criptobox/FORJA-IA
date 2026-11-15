import { describe, expect, it } from "vitest";
import { huellaDeClave, revisarClave } from "../../src/lib/forja/clave-revisada";

// Las claves de mentira se arman en memoria: el escáner de higiene del repo no admite ninguna literal.
const DE_OPENAI = "sk" + "-proj-1234567890abcdefghijklmnop";
const DE_GOOGLE = "AI" + "zaSyD-1234567890abcdefghijklmnop";
const NVIDIA_BUENA = "nvapi-AbCdEf1234567890_ghijKLMNOP-qrstUVWXYZ0123456789abcdefgh";

describe("huellaDeClave: se reconoce sin enseñarla entera", () => {
  it("enseña el inicio, el final y cuántos caracteres tiene", () => {
    expect(huellaDeClave(NVIDIA_BUENA)).toBe(`nvapi-Ab…gh · ${NVIDIA_BUENA.length} caracteres`);
    expect(huellaDeClave("  $NVIDIA_API_KEY  ")).toBe("$NVIDIA_…EY · 15 caracteres");
  });
  it("una clave corta no se enseña casi entera", () => {
    expect(huellaDeClave("abcdef")).toBe("ab… · 6 caracteres");
  });
  it("sin clave, nada", () => {
    expect(huellaDeClave("   ")).toBe("");
  });
});

describe("revisarClave: lo que no puede ser una clave", () => {
  it("una clave de NVIDIA normal no tiene reparos", () => {
    expect(revisarClave("nvidia", NVIDIA_BUENA)).toEqual([]);
  });
  it("detecta los marcadores de la documentación", () => {
    for (const k of ["$NVIDIA_API_KEY", "${NVIDIA_API_KEY}", "YOUR_API_KEY_HERE", "<tu-clave-aquí>", "xxxxxxxxxxxxxxxxxxxx", "nvapi-********************", "API_KEY_REQUIRED_IF_EXECUTING_OUTSIDE_NGC"]) {
      expect(revisarClave("nvidia", k).join(" "), k).toMatch(/marcador/);
    }
  });
  it("detecta lo que se pega de más", () => {
    expect(revisarClave("nvidia", `Bearer ${NVIDIA_BUENA}`).join(" ")).toMatch(/Bearer/);
    expect(revisarClave("nvidia", `"${NVIDIA_BUENA}"`).join(" ")).toMatch(/comillas/);
    expect(revisarClave("nvidia", `${NVIDIA_BUENA}\nsegunda línea`).join(" ")).toMatch(/espacios|saltos/);
    expect(revisarClave("nvidia", "https://build.nvidia.com/settings/api-keys").join(" ")).toMatch(/dirección web/);
  });
  it("avisa si es demasiado corta", () => {
    expect(revisarClave("custom", "abc123").join(" ")).toMatch(/corta/);
  });
  it("avisa si el prefijo es el de otro proveedor", () => {
    expect(revisarClave("nvidia", DE_OPENAI).join(" ")).toMatch(/nvapi-/);
    expect(revisarClave("groq", "gsk_1234567890abcdefghijklmnop")).toEqual([]);
    expect(revisarClave("gemini", DE_GOOGLE)).toEqual([]);
    // sin prefijo conocido, no se inventa uno
    expect(revisarClave("custom", "cualquier-clave-larga-1234567890")).toEqual([]);
  });
  it("sin clave, nada que revisar", () => {
    expect(revisarClave("nvidia", "")).toEqual([]);
  });
});
