/** FORJA IA — SALUD DE PROVEEDORES (v4.2): el dial que ordena el failover
 * por EVIDENCIA medida, no por orden de configuración.
 *
 * ─── El problema ───
 * El adaptador-resiliente prueba la cadena en el orden en que el host la
 * configuró. Pero los proveedores gratuitos no fallan igual todos los días:
 * uno tarda 2s y otro 14s, uno lleva 40 minutos dando 429 y otro acaba de
 * volver de una caída. Con orden fijo, el failover siempre paga primero la
 * caída del favorito antes de llegar al que hoy responde bien.
 *
 * ─── La solución ───
 * Un libro de salud (health ledger) SIN red: el adaptador lo alimenta con
 * lo que ya mide en cada intento (éxito con su latencia, fallo con su
 * motivo) y ofrece `ordenar()` para reordenar los SUPLENTES:
 *
 *   · los ENFRIADOS (fallos consecutivos recientes) van al final;
 *   · los sanos suben ordenados por latencia EWMA (el que responde antes,
 *     primero — un proxy honesto de «cuál funciona mejor HOY»);
 *   · el PRIMARIO nunca se toca: es la elección explícita del usuario.
 *
 * Los datos viven en memoria del proceso. El host que quiera persistencia
 * serializa `instantanea()` y la restaura con `saludDesdeJSON()` — mismo
 * espíritu que health.ts del host, pero a nivel de pipeline y sin React.
 *
 * Reglas de la casa: sin red, sin React, sin storage, TypeScript estricto.
 */

import type { ModeloDeRol } from "./tipos";

/* ══════════════════════════ tipos ══════════════════════════ */

/** Ficha de salud de un modelo (providerId:modelId). Serializable. */
export interface FichaSalud {
  /** clave "providerId:modelId" */
  clave: string;
  exitos: number;
  fallos: number;
  /** fallos CONSECUTIVOS (se resetea con el primer éxito) */
  fallosSeguidos: number;
  /** latencia media EWMA de los éxitos, en ms (null = sin datos) */
  latenciaMs: number | null;
  /** última latencia medida, éxito o fallo */
  ultimoMs: number | null;
  /** epoch ms hasta la que el modelo está enfriado (0 = operativo) */
  enfriadoHasta: number;
  /** último motivo de fallo, recortado (para el panel) */
  ultimoError: string;
  actualizado: number;
}

/** Contrato que el adaptador usa. Implementado por crearSaludProveedores(). */
export interface SaludProveedores {
  anotarExito(clave: string, ms: number): void;
  anotarFallo(clave: string, ms: number | null, motivo: string): void;
  estaEnfriado(clave: string, ahora?: number): boolean;
  /** reordena: primario fijo primero, suplentes sanos por latencia,
   * enfriados al final. Devuelve una lista nueva (no muta). */
  ordenar(cadena: ModeloDeRol[], ahora?: number): ModeloDeRol[];
  /** copia serializable de todas las fichas (para el panel/persistencia) */
  instantanea(): Record<string, FichaSalud>;
}

/* ══════════════════════════ opciones ══════════════════════════ */

export interface OpcionesSalud {
  /** peso de la EWMA (0..1): 0.3 = cada medida pesa un 30% (defecto) */
  ewmaAlpha?: number;
  /** enfriamiento base por fallo consecutivo (defecto 15s) */
  enfriadoBaseMs?: number;
  /** tope de enfriamiento (defecto 5 min — a nivel de pipeline no hace
   * falta el cap de 15 min del host: la cadena corta antes) */
  enfriadoMaxMs?: number;
  /** cuántas fichas se retienen como máximo (defecto 64 modelos) */
  topeFichas?: number;
}

const DEFECTO: Required<OpcionesSalud> = {
  ewmaAlpha: 0.3,
  enfriadoBaseMs: 15_000,
  enfriadoMaxMs: 5 * 60_000,
  topeFichas: 64,
};

/* ══════════════════════════ fábrica ══════════════════════════ */

/** Crea el libro de salud en memoria. El mismo objeto alimenta todas las
 * llamadas del proceso (crear una instancia por petición tiraría los datos). */
export function crearSaludProveedores(opciones: OpcionesSalud = {}): SaludProveedores {
  const { ewmaAlpha, enfriadoBaseMs, enfriadoMaxMs, topeFichas } = {
    ...DEFECTO,
    ...opciones,
  };
  const fichas = new Map<string, FichaSalud>();

  function ficha(clave: string): FichaSalud {
    let f = fichas.get(clave);
    if (!f) {
      f = {
        clave,
        exitos: 0,
        fallos: 0,
        fallosSeguidos: 0,
        latenciaMs: null,
        ultimoMs: null,
        enfriadoHasta: 0,
        ultimoError: "",
        actualizado: 0,
      };
      fichas.set(clave, f);
      podar();
    }
    return f;
  }

  /** el libro no crece sin control: fuera las fichas más viejas */
  function podar(): void {
    while (fichas.size > topeFichas) {
      const masVieja = [...fichas.values()].sort((a, b) => a.actualizado - b.actualizado)[0];
      if (!masVieja) break;
      fichas.delete(masVieja.clave);
    }
  }

  return {
    anotarExito(clave, ms) {
      const f = ficha(clave);
      f.exitos += 1;
      f.fallosSeguidos = 0;
      f.enfriadoHasta = 0; // un éxito levanta el enfriamiento (como health.ts)
      f.ultimoMs = Math.max(0, Math.round(ms));
      f.latenciaMs =
        f.latenciaMs == null
          ? f.ultimoMs
          : Math.round(f.latenciaMs * (1 - ewmaAlpha) + f.ultimoMs * ewmaAlpha);
      f.actualizado = Date.now();
    },

    anotarFallo(clave, ms, motivo) {
      const f = ficha(clave);
      f.fallos += 1;
      f.fallosSeguidos += 1;
      if (ms != null) f.ultimoMs = Math.max(0, Math.round(ms));
      f.ultimoError = String(motivo ?? "").slice(0, 140);
      // backoff exponencial de enfriamiento: 15s, 30s, 60s… tope 5 min
      const msEnfriado = Math.min(
        enfriadoMaxMs,
        enfriadoBaseMs * Math.pow(2, f.fallosSeguidos - 1)
      );
      f.enfriadoHasta = Date.now() + msEnfriado;
      f.actualizado = Date.now();
    },

    estaEnfriado(clave, ahora = Date.now()) {
      const f = fichas.get(clave);
      return !!f && f.enfriadoHasta > ahora;
    },

    ordenar(cadena, ahora = Date.now()) {
      if (cadena.length <= 1) return [...cadena];
      const [primario, ...resto] = cadena;
      const restoOrdenado = [...resto].sort((a, b) => rango(a, ahora) - rango(b, ahora));
      return [primario, ...restoOrdenado];
    },

    instantanea() {
      const out: Record<string, FichaSalud> = {};
      for (const [k, f] of fichas) out[k] = { ...f };
      return out;
    },
  };

  /** menor = mejor: sanos por latencia, enfriados al final */
  function rango(m: ModeloDeRol, ahora: number): number {
    const f = fichas.get(`${m.providerId}:${m.modelId}`);
    if (!f) return Number.MAX_SAFE_INTEGER - 1; // sin datos: tras los sanos con datos, antes de enfriados
    const enfriado = f.enfriadoHasta > ahora;
    const latencia = f.latenciaMs ?? Number.MAX_SAFE_INTEGER - 2;
    return enfriado ? Number.MAX_SAFE_INTEGER : latencia;
  }
}

/* ══════════════════════════ persistencia ══════════════════════════ */

/** Serializa el libro (para que el host lo guarde donde quiera). */
export function saludAJSON(salud: SaludProveedores): string {
  return JSON.stringify(salud.instantanea());
}

/** Restaura un libro guardado (tolerante: si huele raro, libro limpio).
 * Los enfriamientos viejos no se restauran si ya caducaron. */
export function saludDesdeJSON(crudo: string | null | undefined, opciones: OpcionesSalud = {}): SaludProveedores {
  const salud = crearSaludProveedores(opciones);
  if (!crudo) return salud;
  try {
    const obj = JSON.parse(crudo) as Record<string, Partial<FichaSalud>>;
    for (const [clave, f] of Object.entries(obj)) {
      if (!f || typeof clave !== "string") continue;
      const exitos = Number(f.exitos) || 0;
      const fallos = Number(f.fallos) || 0;
      const latencia = Number(f.latenciaMs);
      if (exitos > 0 && Number.isFinite(latencia) && latencia > 0) {
        // reconstruye con la latencia media: la evidencia vale, el histórico
        // exacto no hace falta para ordenar
        for (let i = 0; i < Math.min(exitos, 10); i++) salud.anotarExito(clave, latencia);
      }
      const seguidos = Math.min(Number(f.fallosSeguidos) || 0, 2);
      if (fallos > 0 && seguidos > 0 && (f.enfriadoHasta ?? 0) > Date.now()) {
        for (let i = 0; i < seguidos; i++) salud.anotarFallo(clave, null, String(f.ultimoError ?? ""));
      }
    }
  } catch {
    // libro roto: se empieza de cero, nunca se rompe el pipeline
  }
  return salud;
}

/** Conveniencia: clave canónica de un modelo (la misma del adaptador). */
export function claveModelo(m: { providerId: string; modelId: string }): string {
  return `${m.providerId}:${m.modelId}`;
}
