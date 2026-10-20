/** Forja IA — El progreso REAL de una creación, para el panel «Creando…».
 *
 * Antes, cualquier respuesta en curso —también un «hola»— enseñaba el yunque
 * grande con «Pensando / Generando», y en los encargos de web la prosa del
 * modelo salía ENCIMA de la animación. Ni lo uno ni lo otro contaba cómo iba
 * de verdad el trabajo.
 *
 * Aquí se calcula, solo con lo que ya llega por el stream (cero tokens de más):
 *
 *   1. Entendiendo el encargo  — nivel del turno y secciones previstas del plano
 *   2. Eligiendo modelo        — el que está respondiendo
 *   3. Pensando                — hasta que llega el primer carácter
 *   4. Escribiendo archivos    — qué archivos van saliendo, secciones escritas
 *                                de las previstas y tokens aproximados
 *   5. Entrega                 — tiempo y tokens reales del proveedor
 *
 * Nada de duraciones inventadas: cada paso cambia cuando ocurre lo que dice.
 *
 * Funciones puras: se prueban sin navegador.
 */
import { bloquesConNombre } from "./answer-files";
import { esEncargoUINueva } from "./design-directions";
import { esEncargoDeApp } from "./modo-app";
import { aplicaPlanoContenido, planoDelEncargo } from "./motor-chat";
import { ETIQUETA_NIVEL, nivelDeContexto } from "./nivel-contexto";
import { esTurnoTrivial } from "./turno-trivial";

export type EstadoPaso = "pending" | "running" | "done";

export interface PasoCreacion {
  id: "encargo" | "modelo" | "pensando" | "escribiendo" | "entrega";
  titulo: string;
  estado: EstadoPaso;
  /** dato real del paso (vacío si todavía no hay) */
  meta: string;
}

export interface ProgresoCreacion {
  pasos: PasoCreacion[];
  /** índice (0-based) del paso en marcha, o el último si ya terminó */
  actual: number;
  /** estado del yunque para el paso en marcha */
  loader: "pensando" | "buscando" | "trabajando" | "finalizado";
  /** archivos que ya han salido, en orden */
  archivos: string[];
  terminado: boolean;
}

/** ¿Este encargo CREA algo (página, app) y merece el panel de creación?
 *  Un saludo, una pregunta o un retoque llevan el indicador ligero. */
export function esEncargoDeCreacion(encargo: string): boolean {
  const t = (encargo ?? "").trim();
  if (!t || esTurnoTrivial(t)) return false;
  return esEncargoUINueva(t) || esEncargoDeApp(t);
}

const fmtMiles = (n: number) => n.toLocaleString("es");

export interface EntradaProgreso {
  /** lo que pidió el usuario */
  encargo: string;
  /** lo que lleva escrito el modelo */
  contenido: string;
  /** razonamiento visible, si lo manda */
  razonamiento?: string;
  streaming: boolean;
  /** «proveedor::modelo» o el nombre a enseñar */
  modelo?: string;
  /** FORJA WEB no nombra al proveedor real */
  ocultarModelo?: boolean;
  /** al terminar: lo que dijo el proveedor */
  final?: { ms?: number; tokensSalida?: number };
}

export function progresoCreacion(e: EntradaProgreso): ProgresoCreacion {
  const nivel = nivelDeContexto({ texto: e.encargo, trivial: esTurnoTrivial(e.encargo) });
  const plano = aplicaPlanoContenido(e.encargo) ? planoDelEncargo(e.encargo) : null;
  const previstas = plano?.secciones.length ?? 0;
  const hay = e.contenido.trim().length > 0;
  const terminado = !e.streaming;

  const archivos = bloquesConNombre(e.contenido).map((b) => b.path).filter((p, i, a) => a.indexOf(p) === i);
  const secciones = (e.contenido.match(/<section\b/gi) ?? []).length;
  const tokens = Math.round(e.contenido.length / 4);

  const modelo = e.ocultarModelo ? "Forja IA" : (e.modelo ?? "").split("::").pop() ?? "";

  const escribiendoMeta = [
    archivos.length ? archivos.map((a, i) => (!terminado && i === archivos.length - 1 ? `${a} ✎` : a)).join(" · ") : "",
    previstas && secciones ? `${Math.min(secciones, previstas)} de ${previstas} secciones` : "",
    hay ? `~${fmtMiles(tokens)} tokens` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const entregaMeta = terminado
    ? [
        e.final?.ms ? `${(e.final.ms / 1000).toLocaleString("es", { maximumFractionDigits: 1 })} s` : "",
        e.final?.tokensSalida != null ? `${fmtMiles(e.final.tokensSalida)} tokens` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const pasos: PasoCreacion[] = [
    {
      id: "encargo",
      titulo: "Entendiendo el encargo",
      estado: "done",
      meta: [ETIQUETA_NIVEL[nivel], previstas ? `${previstas} secciones previstas` : ""].filter(Boolean).join(" · "),
    },
    { id: "modelo", titulo: "Eligiendo modelo", estado: "done", meta: modelo },
    {
      id: "pensando",
      titulo: "Pensando",
      estado: hay || terminado ? "done" : "running",
      meta: e.razonamiento ? `${fmtMiles(e.razonamiento.length)} car. de razonamiento` : "",
    },
    {
      id: "escribiendo",
      titulo: "Escribiendo archivos",
      estado: terminado ? "done" : hay ? "running" : "pending",
      meta: escribiendoMeta,
    },
    { id: "entrega", titulo: "Entrega", estado: terminado ? "done" : "pending", meta: entregaMeta },
  ];

  const actual = terminado ? pasos.length - 1 : pasos.findIndex((p) => p.estado === "running");
  const loader: ProgresoCreacion["loader"] = terminado ? "finalizado" : hay ? "trabajando" : "pensando";
  return { pasos, actual: Math.max(0, actual), loader, archivos, terminado };
}
