import { describe, expect, it } from "vitest";
import { aplicarCatalogo, catalogoGratis, parseModelsDev, parseZenIds } from "@/lib/forja/opencode-catalog";

const dev = {
  opencode: {
    models: {
      "a-free": { id: "a-free", name: "A Free", cost: { input: 0, output: 0 }, limit: { context: 200000 } },
      "b-pago": { id: "b-pago", name: "B", cost: { input: 1, output: 2 } },
      "c-medio": { id: "c-medio", name: "C", cost: { input: 0, output: 3 } },
      "d-free": { id: "d-free", name: "D" }, // sin precio: vale el sufijo
      "e-sinprecio": { id: "e-sinprecio", name: "E" }, // sin precio ni sufijo: no se da por gratis
    },
  },
};

describe("catálogo de OpenCode", () => {
  it("solo es gratis lo que cuesta cero en entrada y salida (o el sufijo si no hay precio)", () => {
    expect(parseModelsDev(dev).map((m) => m.id).sort()).toEqual(["a-free", "d-free"]);
  });

  it("un JSON raro no revienta", () => {
    expect(parseModelsDev(null)).toEqual([]);
    expect(parseModelsDev({ opencode: 3 })).toEqual([]);
    expect(parseZenIds({ data: "x" })).toEqual([]);
  });

  it("si la pasarela contesta, solo se ofrece lo que sirve; si no, vale el precio", () => {
    const gratis = parseModelsDev(dev);
    expect(catalogoGratis(gratis, ["a-free", "otro"]).map((m) => m.id)).toEqual(["a-free"]);
    expect(catalogoGratis(gratis, []).map((m) => m.id).sort()).toEqual(["a-free", "d-free"]);
  });

  it("sincronizar quita lo que Forja metió y ya no es gratis, y respeta lo del usuario", () => {
    const r = aplicarCatalogo(["viejo-free", "mio-pago", "a-free"], ["viejo-free", "a-free"], ["a-free", "nuevo-free"]);
    expect(r.models).toEqual(["mio-pago", "a-free", "nuevo-free"]);
    expect(r.sincronizados).toEqual(["a-free", "nuevo-free"]);
  });
});
