/** Forja IA — Timeline de progreso de un mensaje en curso.
 *
 * Mismo lenguaje visual que el timeline del mockup de marca: un icono
 * grande del yunque animado (el único sitio donde ese dibujo se lee bien;
 * a tamaño de spinner se vuelve una mancha) junto a una lista de fases con
 * círculos de estado simples (pendiente/en marcha/hecho), como
 * `.task-status` en el mockup. SOLO fases reales: nada de duraciones
 * fijas simuladas — cada fila cambia cuando de verdad ocurre lo que
 * describe, igual que el resto de la app ("se mide, no se mira").
 */
import type { ForjaGenerandoVariant, ForjaLoaderState } from "./forja-state-loader";
import { ForjaStateLoader } from "./forja-state-loader";

export type ForjaTimelineStepStatus = "pending" | "running" | "done";

export interface ForjaTimelineStep {
  id: string;
  label: string;
  status: ForjaTimelineStepStatus;
}

export function ForjaProgressTimeline({
  heroState,
  heroVariant,
  steps,
}: {
  /** Estado del yunque grande que representa la fase activa. */
  heroState: ForjaLoaderState;
  heroVariant?: ForjaGenerandoVariant;
  steps: ForjaTimelineStep[];
}) {
  return (
    <div className="fj-timeline-wrap">
      <ForjaStateLoader state={heroState} variant={heroVariant} size={36} className="shrink-0" />
      <ul className="fj-timeline" aria-live="polite">
        {steps.map((step) => (
          <li key={step.id} className={`fj-timeline-row fj-timeline-row--${step.status}`}>
            <span className="fj-timeline-status" aria-hidden />
            <span className="fj-timeline-label">{step.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
