/** FORJA IA — Ruta del ciclo de aprendizaje (el botón «Aprender ahora» y
 * el cron diario). Cópiala a app/api/forja/aprender/route.ts de tu FORJA IA.
 *
 *   POST → { informe } | 429 { error: "descanso" }
 *
 * Todas las guardas del lado servidor (el detalle y el porqué, en
 * SEGURIDAD.md):
 *   0. guardia de dueño (o secreto de cron vía Authorization Bearer);
 *   1. descanso mínimo entre ciclos, server-side;
 *   2. dictamen de URL repetido ANTES y DESPUÉS del fetch (redirects
 *      traidores incluidos);
 *   3. content-type comestible y tope de bytes (2 MB);
 *   4. timeout por página (12 s) con AbortController;
 *   5. HTML → texto plano seguro (textoDesdeHtml) antes de nada más.
 */

import {
  cicloAprendizaje,
  intervaloSuficiente,
  type LectorWeb,
} from "@/lib/prism/forja/autoaprendizaje";
import { fuentesActivas, registrarLecturasFuentes, serializarFuentes, deserializarFuentes, CLAVE_FUENTES_USUARIO } from "@/lib/prism/forja/fuentes-usuario";
import {
  deserializarConocimiento,
  serializarConocimiento,
  CLAVE_CONOCIMIENTO_GLOBAL,
} from "@/lib/prism/forja/conocimiento-global";
import {
  PRESUPUESTO_APRENDIZAJE,
  textoDesdeHtml,
  tipoContenidoAceptado,
  urlAptaparaAprendizaje,
} from "@/lib/prism/forja/seguridad-web";
import type { LlamadaModelo } from "@/lib/prism/forja/tipos";
import { esElDuenio, noAutorizado, leerAlmacen, guardarAlmacen } from "../_base";

/* --------- conecta AQUÍ tu chat-client real (el del resto de la app) ----- */
const llamarModelo: LlamadaModelo = async () => {
  throw new Error("Conecta aquí tu chat-client real (ver LEEME-INTEGRACION.md §3).");
};
/* modelo destilador: por defecto el rol Diseñador de tu config (cárgala) */
const MODELO_DESTILADOR = { providerId: "gemini", modelId: "gemini-2.5-flash" };

/* ----------------------- lector del lado servidor ------------------------ */

const lectorDelServidor: LectorWeb = {
  async leer(url: string): Promise<string> {
    if (!urlAptaparaAprendizaje(url).ok) throw new Error("URL rechazada por el dictamen de seguridad.");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PRESUPUESTO_APRENDIZAJE.timeoutSegundos * 1000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
      // un redirect puede haber llevado la petición a un host prohibido:
      // el destino FINAL pasa el dictamen otra vez
      if (res.ok && !urlAptaparaAprendizaje(res.url).ok) {
        throw new Error("El redirect lleva a un host prohibido.");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!tipoContenidoAceptado(res.headers.get("content-type") ?? "")) {
        throw new Error("Tipo de contenido no comestible (solo texto).");
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > PRESUPUESTO_APRENDIZAJE.maxBytesPorPagina) {
        throw new Error("Página demasiado grande (tope 2 MB).");
      }
      const html = new TextDecoder().decode(buf.slice(0, PRESUPUESTO_APRENDIZAJE.maxBytesPorPagina));
      return textoDesdeHtml(html);
    } finally {
      clearTimeout(t);
    }
  },
};

/* --------------------------------- ruta ---------------------------------- */

export async function POST(req: Request): Promise<Response> {
  if (!esElDuenio(req)) return noAutorizado();

  const [rawAlmacen, rawFuentes] = await Promise.all([
    leerAlmacen(CLAVE_CONOCIMIENTO_GLOBAL),
    leerAlmacen(CLAVE_FUENTES_USUARIO),
  ]);
  const almacen = deserializarConocimiento(rawAlmacen);
  const fuentes = deserializarFuentes(rawFuentes);

  // descanso server-side: el módulo también lo comprueba, pero así la UI
  // recibe un 429 claro en vez de un informe de «pausa»
  if (!intervaloSuficiente(almacen.ultimoCiclo)) {
    return Response.json(
      { error: "descanso", minutos: PRESUPUESTO_APRENDIZAJE.minutosEntreCiclos },
      { status: 429 }
    );
  }

  const informe = await cicloAprendizaje(
    lectorDelServidor,
    almacen,
    llamarModelo,
    MODELO_DESTILADOR,
    fuentesActivas(fuentes)
  );

  if (!informe.ejecutado) {
    return Response.json({ error: "descanso", minutos: PRESUPUESTO_APRENDIZAJE.minutosEntreCiclos }, { status: 429 });
  }

  await guardarAlmacen(CLAVE_CONOCIMIENTO_GLOBAL, serializarConocimiento(informe.almacen));
  const fuentesActualizadas = registrarLecturasFuentes(fuentes, informe.reglasPorFuente);
  await guardarAlmacen(CLAVE_FUENTES_USUARIO, serializarFuentes(fuentesActualizadas));

  return Response.json({
    informe: informe.informe,
    leidas: informe.leidas.length,
    reglasNuevas: informe.reglasNuevas.length,
    descartadas: informe.descartadas,
    fuentes: fuentesActualizadas,
  });
}
