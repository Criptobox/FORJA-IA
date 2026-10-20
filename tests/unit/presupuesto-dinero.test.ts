import { describe, it, expect } from "vitest";
import {
  anotarGasto,
  gastoDelDia,
  gastoDelMes,
  guardarLibro,
  iniciarTarea,
  leerLibro,
  LIBRO_VACIO,
  LIMITES_POR_DEFECTO,
  normalizarLimites,
  resumenPresupuesto,
  veredictoDinero,
} from "../../src/lib/forja/presupuesto-dinero";

const dia = (d: number, mes = 3) => new Date(2026, mes - 1, d, 12).getTime();

function almacen(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("límites", () => {
  it("de fábrica son los del plan, y null en un campo es sin límite", () => {
    expect(normalizarLimites(undefined)).toEqual(LIMITES_POR_DEFECTO);
    expect(normalizarLimites({ mensual: null, diario: "2", tarea: -1 })).toEqual({ mensual: null, diario: 2, tarea: 0.5 });
  });
});

describe("cuenta", () => {
  it("suma por día y por mes, y separa los meses", () => {
    let l = anotarGasto(LIBRO_VACIO, 0.4, dia(1));
    l = anotarGasto(l, 0.3, dia(2));
    l = anotarGasto(l, 1, dia(28, 2));
    expect(gastoDelDia(l, dia(2))).toBeCloseTo(0.3);
    expect(gastoDelMes(l, dia(2))).toBeCloseTo(0.7);
  });

  it("una llamada sin importe no suma dinero, pero queda contada", () => {
    const l = anotarGasto(LIBRO_VACIO, null, dia(1));
    expect(gastoDelMes(l, dia(1))).toBe(0);
    expect(resumenPresupuesto(l, LIMITES_POR_DEFECTO, dia(1))).toContain("1 llamada de pago hoy sin importe conocido");
  });

  it("la tarea empieza en cero en cada envío", () => {
    let l = iniciarTarea(LIBRO_VACIO, "a");
    l = anotarGasto(l, 0.2, dia(1));
    expect(l.tarea?.usd).toBeCloseTo(0.2);
    expect(iniciarTarea(l, "b").tarea).toEqual({ id: "b", usd: 0 });
  });
});

describe("veredictoDinero", () => {
  const lim = { mensual: 5, diario: 1, tarea: 0.5 };

  it("deja pasar por debajo y avisa desde el 80 %", () => {
    const l = anotarGasto(LIBRO_VACIO, 0.85, dia(1));
    const v = veredictoDinero(l, lim, dia(1));
    expect(v.ok).toBe(true);
    expect(v.avisar).toBe(true);
    expect(v.cual).toBe("diario");
  });

  it("corta al llegar al diario, y al día siguiente vuelve a dejar", () => {
    const l = anotarGasto(LIBRO_VACIO, 1, dia(1));
    const v = veredictoDinero(l, lim, dia(1));
    expect(v.ok).toBe(false);
    expect(v.cual).toBe("diario");
    expect(v.motivo).toContain("solo modelos gratis");
    expect(veredictoDinero(l, lim, dia(2)).ok).toBe(true);
  });

  it("corta por tarea y por mes", () => {
    const t = anotarGasto(iniciarTarea(LIBRO_VACIO, "x"), 0.5, dia(1));
    expect(veredictoDinero(t, lim, dia(1)).cual).toBe("tarea");
    let m = LIBRO_VACIO;
    for (let d = 1; d <= 6; d++) m = anotarGasto(m, 0.9, dia(d));
    const v = veredictoDinero(m, lim, dia(7));
    expect(v.ok).toBe(false);
    expect(v.cual).toBe("mensual");
  });

  it("sin límites no corta nunca", () => {
    const l = anotarGasto(LIBRO_VACIO, 999, dia(1));
    expect(veredictoDinero(l, { mensual: null, diario: null, tarea: null }, dia(1)).ok).toBe(true);
  });
});

describe("persistencia", () => {
  it("guarda y lee, y tolera basura", () => {
    const st = almacen();
    const l = anotarGasto(iniciarTarea(LIBRO_VACIO, "t"), 0.25, dia(1));
    guardarLibro(l, st);
    expect(leerLibro(st)).toEqual(l);
    st.setItem("forja-presupuesto-v1", "{roto");
    expect(leerLibro(st)).toEqual(LIBRO_VACIO);
  });
});
