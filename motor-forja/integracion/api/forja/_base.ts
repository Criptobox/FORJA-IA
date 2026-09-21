/** FORJA IA — Almacén y guardia para las rutas /api/forja/* (código de
 * integración, cópialo a app/api/forja/_base.ts de tu FORJA IA).
 *
 * Dos responsabilidades mínimas:
 *
 *  1. ALMACÉN: las rutas necesitan persistir fuentes y conocimiento DEL
 *     LADO DEL SERVIDOR (el cron no tiene localStorage). Este helper guarda
 *     un JSON por clave en un directorio local. Si tu FORJA IA ya tiene un
 *     store de servidor (DB, redis, zustand-hidratado), sustituye las dos
 *     funciones por tu store — las rutas no cambian.
 *
 *  2. GUARDIA DE DUEÑO: el Apartado de Aprendizaje es tarea del PROPIETARIO
 *     del proyecto, no de cualquier visitante. Este guardia acepta dos
 *     formas (adaptándolas a tu auth real):
 *       · cabecera `Authorization: Bearer <FORJA_ADMIN_SECRET>` (cron, curl);
 *       · cookie `forja_admin=<FORJA_ADMIN_SECRET>` (tu propio panel).
 *     Define FORJA_ADMIN_SECRET en tu .env. Si usas una sesión real, cambia
 *     esElDuenio() por tu comprobación — el resto no toca nada de esto.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConfigForja } from "@/lib/prism/forja/tipos";
import { ROLES_FORJA, sanearTokensRol } from "@/lib/prism/forja/tipos";

/* ------------------------------- almacén -------------------------------- */

const DIR = process.env.FORJA_STORE_DIR ?? ".forja-ia";

/** Claves actuales (rebrand v4.1). Las LEGACY se leen si la nueva no existe:
 * así la memoria, las fuentes y el conocimiento del Lab de la vida PRISMA-D1
 * se conservan sin migración manual. Se escribe SIEMPRE en la clave nueva. */
const CLAVES: Record<string, { legacy?: string }> = {
  "forja.fuentes-usuario": { legacy: "prism.d1.fuentes-usuario" },
  "forja.conocimiento-global": { legacy: "prism.d1.conocimiento-global" },
  "forja.memoria": { legacy: "prism.d1.memoria" },
  "forja.config": { legacy: "prism.d1.config" },
};
const CLAVES_PERMITIDAS = new Set(Object.keys(CLAVES));

const memoria: Map<string, string> = new Map();

export async function leerAlmacen(clave: string): Promise<string | null> {
  if (!CLAVES_PERMITIDAS.has(clave)) throw new Error(`Clave de almacén no permitida: ${clave}`);
  const legacy = CLAVES[clave]?.legacy;
  try {
    const nuevo = await fs.readFile(path.join(process.cwd(), DIR, `${clave}.json`), "utf8");
    if (nuevo !== null && nuevo !== undefined) return nuevo;
  } catch {
    // sin fichero nuevo: caemos a la clave legacy y luego a memoria
  }
  if (legacy) {
    try {
      const viejo = await fs.readFile(
        path.join(process.cwd(), ".prism-d1", `${legacy}.json`),
        "utf8"
      );
      if (viejo) return viejo; // dato de la vida PRISMA-D1, aún válido
    } catch {
      // no había nada legacy tampoco
    }
  }
  return memoria.get(clave) ?? null; // runtime sin fs (edge) → memoria
}

export async function guardarAlmacen(clave: string, valor: string): Promise<void> {
  if (!CLAVES_PERMITIDAS.has(clave)) throw new Error(`Clave de almacén no permitida: ${clave}`);
  memoria.set(clave, valor);
  try {
    const dir = path.join(process.cwd(), DIR);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${clave}.json`), valor, "utf8");
  } catch {
    // sin fs disponible: la copia en memoria aguanta el proceso
  }
}

/* --------------------------- guardia de dueño ---------------------------- */

export function esElDuenio(req: Request): boolean {
  const secreto = process.env.FORJA_ADMIN_SECRET;
  if (!secreto) {
    // Sin secreto configurado NO hay panel: falla cerrado, nunca abierto.
    return false;
  }
  const cabecera = req.headers.get("authorization") ?? "";
  if (cabecera === `Bearer ${secreto}`) return true;
  const cookie = req.headers.get("cookie") ?? "";
  return cookie.split(/;\s*/).some((c) => c === `forja_admin=${secreto}`);
}

export function noAutorizado(): Response {
  return new Response("Solo el propietario del proyecto puede usar el Apartado de Aprendizaje.", {
    status: 403,
  });
}

/* ----------------------------- configuración ----------------------------- */

/** ConfigForja por defecto: todo al modelo activo del chat, perfil
 *  equilibrado. Es lo que cargaConfig() devuelve si aún no hay nada
 *  guardado — el Lab funciona desde el primer segundo sin tocar Ajustes. */
export function configPorDefecto(): ConfigForja {
  const porRol = {} as ConfigForja["porRol"];
  for (const rol of ROLES_FORJA) porRol[rol] = null;
  return { porRol, habilidades: [], perfil: "equilibrado", maquetaPrimero: true };
}

/** Deserializa la ConfigForja guardada con validación mínima: si algo
 *  huele raro, devuelve defecto en vez de romper el pipeline. */
function configDesde(crudo: string | null): ConfigForja {
  const base = configPorDefecto();
  if (!crudo) return base;
  try {
    const p = JSON.parse(crudo) as Partial<ConfigForja>;
    const porRol = base.porRol;
    if (p.porRol && typeof p.porRol === "object") {
      for (const rol of ROLES_FORJA) {
        const m = (p.porRol as Record<string, unknown>)[rol];
        if (
          m &&
          typeof m === "object" &&
          typeof (m as { providerId?: unknown }).providerId === "string" &&
          typeof (m as { modelId?: unknown }).modelId === "string"
        ) {
          porRol[rol] = m as { providerId: string; modelId: string };
        }
      }
    }
    return {
      porRol,
      habilidades: Array.isArray(p.habilidades)
        ? p.habilidades.filter((h): h is string => typeof h === "string")
        : base.habilidades,
      perfil: p.perfil ?? base.perfil,
      maquetaPrimero: typeof p.maquetaPrimero === "boolean" ? p.maquetaPrimero : base.maquetaPrimero,
      maxRondas: typeof p.maxRondas === "number" ? Math.max(1, Math.min(5, Math.round(p.maxRondas))) : undefined,
      // v4.2: presupuesto de salida por rol, saneado (256..65536)
      maxTokensPorRol: sanearTokensConfig(p.maxTokensPorRol),
    };
  } catch {
    return base;
  }
}

/** v4.2 — Sanea el bloque maxTokensPorRol guardado: por rol, solo enteros
 * con sentido (sanearTokensRol), y sin roles inválidos. */
function sanearTokensConfig(
  crudo: Partial<Record<string, number>> | undefined
): ConfigForja["maxTokensPorRol"] {
  if (!crudo || typeof crudo !== "object") return undefined;
  const out: NonNullable<ConfigForja["maxTokensPorRol"]> = {};
  let conAlgo = false;
  for (const rol of ROLES_FORJA) {
    const v = sanearTokensRol(
      typeof (crudo as Record<string, unknown>)[rol] === "number"
        ? ((crudo as Record<string, number>)[rol] as number)
        : undefined
    );
    if (v != null) {
      out[rol] = v;
      conAlgo = true;
    }
  }
  return conAlgo ? out : undefined;
}

/** Carga la ConfigForja del almacén (o defecto). Exportada porque las
 *  rutas chat/config/estado la importan de aquí — era un agujero del ZIP
 *  v4.0.1: las rutas la importaban y _base nunca la definió. */
export async function cargarConfig(): Promise<ConfigForja> {
  const crudo = await leerAlmacen("forja.config");
  return configDesde(crudo);
}

/** Guarda la ConfigForja validada. La validación fina de perfil/maxRondas
 *  la hace la ruta de config; aquí solo se persiste. */
export async function guardarConfig(cfg: ConfigForja): Promise<void> {
  await guardarAlmacen("forja.config", JSON.stringify(cfg));
}
