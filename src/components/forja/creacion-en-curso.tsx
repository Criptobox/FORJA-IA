"use client";
/** Forja IA — Panel «Creando…»: cómo va de verdad la creación de una página o app.
 *
 * Sustituye, SOLO en los encargos que crean algo, al yunque genérico con
 * «Pensando / Generando». Cada paso y cada dato salen del stream real
 * (`progreso-creacion.ts`): qué archivo se está escribiendo, cuántas
 * secciones van de las previstas, tokens y tiempo. Mismo lenguaje visual que
 * la maqueta de marca «Forja IA · Creando algo». Al terminar se pliega en
 * una línea de resumen.
 */
import { Check } from "lucide-react";
import type { ProgresoCreacion } from "@/lib/forja/progreso-creacion";
import { ForjaStateLoader } from "./forja-state-loader";

export function CreacionEnCurso({ progreso, titulo = "Creando tu página" }: { progreso: ProgresoCreacion; titulo?: string }) {
  const { pasos, actual, loader, terminado } = progreso;
  const hechos = pasos.filter((p) => p.estado === "done").length;

  if (terminado) {
    const escribiendo = pasos.find((p) => p.id === "escribiendo")?.meta;
    const entrega = pasos.find((p) => p.id === "entrega")?.meta;
    return (
      <div className="fj-creacion-resumen" data-testid="creacion-resumen">
        <span className="fj-creacion-check" aria-hidden>
          <Check className="size-3" />
        </span>
        <span className="font-medium">Creado</span>
        {[escribiendo, entrega].filter(Boolean).map((t) => (
          <span key={t} className="fj-creacion-mono">
            · {t}
          </span>
        ))}
      </div>
    );
  }

  const paso = pasos[actual];
  return (
    <div className="fj-timeline-card fj-creacion" aria-live="polite" data-testid="creacion-en-curso">
      <div className="fj-creacion-cabecera">
        <span className="fj-creacion-marca">
          <span className="fj-creacion-punto" aria-hidden />
          Forja IA
        </span>
        {pasos[1].meta && <span className="fj-creacion-badge">{pasos[1].meta}</span>}
      </div>
      <div className="fj-timeline-stage">
        <p className="fj-creacion-titulo">{titulo}</p>
        <p className="fj-creacion-sub">
          Paso <strong>{actual + 1}</strong> de <strong>{pasos.length}</strong> · {paso.titulo.toLowerCase()}
        </p>
        <ForjaStateLoader state={loader} size={88} />
        <span className="fj-timeline-state-label">estado: {loader}</span>
      </div>
      <ul className="fj-timeline">
        {pasos.map((p) => (
          <li key={p.id} className={`fj-timeline-row fj-timeline-row--${p.estado}`} data-paso={p.id} data-estado={p.estado}>
            <span className="fj-timeline-status" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="fj-timeline-label">{p.titulo}</span>
              {p.meta && <span className="fj-creacion-meta">{p.meta}</span>}
              {p.estado === "running" && <span className="fj-creacion-barra" aria-hidden />}
            </span>
          </li>
        ))}
      </ul>
      <p className="fj-creacion-pie">
        procesando · {hechos}/{pasos.length} completados
      </p>
    </div>
  );
}
