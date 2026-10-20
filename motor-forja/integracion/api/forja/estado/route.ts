/** FORJA IA Lab — Estado completo para hidratar la UI del preview. */

import { VERSION_FORJA, NOMBRE_VERSION_FORJA, NOVEDADES_FORJA } from "@/lib/prism/forja/version";
import { FORJA_ID, FORJA_NOMBRE, FORJA_RESUMEN, CAPACIDADES_FORJA } from "@/lib/prism/forja/modelo";
import { EQUIPO_FORJA } from "@/lib/prism/forja/equipo";
import { HABILIDADES_FORJA } from "@/lib/prism/forja/habilidades";
import { PERFILES } from "@/lib/prism/forja/tipos";
import { MAX_AJUSTES_MAQUETA, MAX_RONDAS_LIMITE } from "@/lib/prism/forja/tipos";
import {
  deserializarConocimiento,
  reglasGlobalesParaPrompt,
  MAX_REGLAS_GLOBALES,
  CLAVE_CONOCIMIENTO_GLOBAL,
} from "@/lib/prism/forja/conocimiento-global";
import { deserializarFuentes, MAX_FUENTES_USUARIO, CLAVE_FUENTES_USUARIO } from "@/lib/prism/forja/fuentes-usuario";
import { FUENTES_SEMILLA } from "@/lib/prism/forja/fuentes";
import { PRESUPUESTO_APRENDIZAJE } from "@/lib/prism/forja/seguridad-web";
import { CRITERIOS_ARENA } from "@/lib/prism/forja/arena";
import { cargarConfig, leerAlmacen } from "../_base";

export async function GET(): Promise<Response> {
  const [cfg, rawAlmacen, rawFuentes] = await Promise.all([
    cargarConfig(),
    leerAlmacen(CLAVE_CONOCIMIENTO_GLOBAL),
    leerAlmacen(CLAVE_FUENTES_USUARIO),
  ]);
  const almacen = deserializarConocimiento(rawAlmacen);
  const fuentes = deserializarFuentes(rawFuentes);

  return Response.json({
    modelo: { id: FORJA_ID, nombre: FORJA_NOMBRE, resumen: FORJA_RESUMEN, capacidades: CAPACIDADES_FORJA },
    version: { numero: VERSION_FORJA, nombre: NOMBRE_VERSION_FORJA, novedades: NOVEDADES_FORJA },
    config: cfg,
    memoria: { total: almacen.reglas.length + 0 },
    conocimiento: {
      total: almacen.reglas.length,
      tope: MAX_REGLAS_GLOBALES,
      ultimoCiclo: almacen.ultimoCiclo ?? null,
      ejemplos: reglasGlobalesParaPrompt(almacen, 6),
    },
    fuentes: { lista: fuentes, tope: MAX_FUENTES_USUARIO },
    catalogo: {
      equipo: EQUIPO_FORJA,
      habilidades: HABILIDADES_FORJA.map((h) => ({ id: h.id, nombre: h.nombre })),
      perfiles: PERFILES,
      semillas: FUENTES_SEMILLA.map((f) => ({ id: f.id, nombre: f.nombre, calidad: f.calidad })),
      criteriosArena: CRITERIOS_ARENA,
      presupuesto: PRESUPUESTO_APRENDIZAJE,
      maxAjustes: MAX_AJUSTES_MAQUETA,
      maxRondasLimite: MAX_RONDAS_LIMITE,
    },
  });
}
