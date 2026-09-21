/** FORJA IA Lab — Guardar la ConfigForja desde el panel de Ajustes. */

import type { ConfigForja, PerfilRecursos, RolForja } from "@/lib/prism/forja/tipos";
import { ROLES_FORJA, sanearTokensRol } from "@/lib/prism/forja/tipos";
import { cargarConfig, guardarConfig } from "../_base";

const PERFILES_VALIDOS: PerfilRecursos[] = ["ligero", "equilibrado", "profundo"];

export async function POST(req: Request): Promise<Response> {
  const cuerpo = (await req.json().catch(() => null)) as Partial<ConfigForja> | null;
  if (!cuerpo) return Response.json({ error: "Cuerpo vacío." }, { status: 400 });

  const actual = await cargarConfig();

  // v4.2 — presupuesto de salida por rol: solo roles conocidos y valores
  // con sentido (sanearTokensRol: 256..65536, entero). Sin valores válidos
  // no se guarda el bloque: los defectos del adaptador mandan.
  let maxTokensPorRol: ConfigForja["maxTokensPorRol"];
  if (cuerpo.maxTokensPorRol && typeof cuerpo.maxTokensPorRol === "object") {
    const bloque: NonNullable<ConfigForja["maxTokensPorRol"]> = {};
    for (const rol of ROLES_FORJA) {
      const v = sanearTokensRol((cuerpo.maxTokensPorRol as Partial<Record<RolForja, number>>)[rol]);
      if (v != null) bloque[rol] = v;
    }
    if (Object.keys(bloque).length) maxTokensPorRol = bloque;
  }

  const config: ConfigForja = {
    porRol: actual.porRol,
    habilidades: Array.isArray(cuerpo.habilidades)
      ? cuerpo.habilidades.filter((h): h is string => typeof h === "string").slice(0, 12)
      : actual.habilidades,
    perfil: PERFILES_VALIDOS.includes(cuerpo.perfil as PerfilRecursos)
      ? (cuerpo.perfil as PerfilRecursos)
      : actual.perfil,
    maquetaPrimero: typeof cuerpo.maquetaPrimero === "boolean" ? cuerpo.maquetaPrimero : actual.maquetaPrimero,
    maxRondas:
      cuerpo.maxRondas == null
        ? undefined
        : Math.max(1, Math.min(5, Math.round(Number(cuerpo.maxRondas)))),
    maxTokensPorRol: cuerpo.maxTokensPorRol === undefined ? actual.maxTokensPorRol : maxTokensPorRol,
  };

  await guardarConfig(config);
  return Response.json({ config });
}
