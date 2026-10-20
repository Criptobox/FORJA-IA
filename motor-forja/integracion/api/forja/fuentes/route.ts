/** FORJA IA — Ruta de gestión del Apartado de Aprendizaje.
 * Cópiala a app/api/forja/fuentes/route.ts de tu FORJA IA.
 *
 *   GET     → { fuentes, ultimoCiclo }
 *   POST    → alta: { entrada, nota?, calidad? }   (dictamen server-side)
 *   PATCH   → { id, activa?: boolean, cambios?: { nombre?, nota?, calidad? } }
 *   DELETE  → { id, olvidarReglas?: boolean }  o  { todo: true }
 *
 * Seguridad (SEGURIDAD.md): guardia de dueño en TODOS los métodos y el
 * dictamen se repite EN EL SERVIDOR aunque el panel ya lo haya hecho:
 * nunca confíes en el cliente.
 */

import {
  anadirFuente,
  alternarFuente,
  deserializarFuentes,
  editarFuente,
  olvidarReglasDeFuente,
  olvidarTodoElConocimiento,
  quitarFuente,
  serializarFuentes,
  MAX_FUENTES_USUARIO,
  type FuenteUsuario,
} from "@/lib/prism/forja/fuentes-usuario";
import { dictamenFuente } from "@/lib/prism/forja/fuentes-usuario";
import {
  deserializarConocimiento,
  serializarConocimiento,
  CLAVE_CONOCIMIENTO_GLOBAL,
} from "@/lib/prism/forja/conocimiento-global";
import { CLAVE_FUENTES_USUARIO } from "@/lib/prism/forja/fuentes-usuario";
import { esElDuenio, noAutorizado, leerAlmacen, guardarAlmacen } from "../_base";

async function cargarFuentes(): Promise<FuenteUsuario[]> {
  return deserializarFuentes(await leerAlmacen(CLAVE_FUENTES_USUARIO));
}

export async function GET(req: Request): Promise<Response> {
  if (!esElDuenio(req)) return noAutorizado();
  const [fuentes, almacen] = await Promise.all([
    cargarFuentes(),
    leerAlmacen(CLAVE_CONOCIMIENTO_GLOBAL),
  ]);
  return Response.json({
    fuentes,
    ultimoCiclo: deserializarConocimiento(almacen).ultimoCiclo ?? null,
    totalReglas: deserializarConocimiento(almacen).reglas.length,
    tope: MAX_FUENTES_USUARIO,
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!esElDuenio(req)) return noAutorizado();
  const cuerpo = (await req.json().catch(() => null)) as
    | { entrada?: string; nota?: string; calidad?: 1 | 2 | 3 }
    | null;
  if (!cuerpo?.entrada) return Response.json({ error: "Falta la URL de la fuente." }, { status: 400 });

  // dictamen EN SERVIDOR (el del cliente es solo para la UX)
  const d = dictamenFuente(cuerpo.entrada);
  if (!d.ok) return Response.json({ error: d.motivos.join(" "), motivos: d.motivos }, { status: 400 });

  const r = anadirFuente(await cargarFuentes(), cuerpo.entrada, {
    nota: cuerpo.nota,
    calidad: cuerpo.calidad,
  });
  if (r.error) return Response.json({ error: r.error }, { status: 400 });

  await guardarAlmacen(CLAVE_FUENTES_USUARIO, serializarFuentes(r.lista));
  return Response.json({ fuente: r.fuente, lista: r.lista }, { status: 201 });
}

export async function PATCH(req: Request): Promise<Response> {
  if (!esElDuenio(req)) return noAutorizado();
  const cuerpo = (await req.json().catch(() => null)) as
    | { id?: string; activa?: boolean; cambios?: { nombre?: string; nota?: string; calidad?: 1 | 2 | 3 } }
    | null;
  if (!cuerpo?.id) return Response.json({ error: "Falta el id de la fuente." }, { status: 400 });

  let lista = await cargarFuentes();
  lista =
    cuerpo.cambios !== undefined
      ? editarFuente(lista, cuerpo.id, cuerpo.cambios)
      : alternarFuente(lista, cuerpo.id, cuerpo.activa);
  await guardarAlmacen(CLAVE_FUENTES_USUARIO, serializarFuentes(lista));
  return Response.json({ lista });
}

export async function DELETE(req: Request): Promise<Response> {
  if (!esElDuenio(req)) return noAutorizado();
  const cuerpo = (await req.json().catch(() => null)) as
    | { id?: string; olvidarReglas?: boolean; todo?: boolean }
    | null;
  if (!cuerpo) return Response.json({ error: "Cuerpo vacío." }, { status: 400 });

  if (cuerpo.todo) {
    const almacen = deserializarConocimiento(await leerAlmacen(CLAVE_CONOCIMIENTO_GLOBAL));
    await guardarAlmacen(CLAVE_CONOCIMIENTO_GLOBAL, serializarConocimiento(olvidarTodoElConocimiento(almacen)));
    return Response.json({ ok: true, todo: true });
  }
  if (!cuerpo.id) return Response.json({ error: "Falta el id de la fuente." }, { status: 400 });

  let lista = quitarFuente(await cargarFuentes(), cuerpo.id);
  await guardarAlmacen(CLAVE_FUENTES_USUARIO, serializarFuentes(lista));

  if (cuerpo.olvidarReglas) {
    const almacen = deserializarConocimiento(await leerAlmacen(CLAVE_CONOCIMIENTO_GLOBAL));
    await guardarAlmacen(CLAVE_CONOCIMIENTO_GLOBAL, serializarConocimiento(olvidarReglasDeFuente(almacen, cuerpo.id)));
  }
  return Response.json({ ok: true, lista });
}
