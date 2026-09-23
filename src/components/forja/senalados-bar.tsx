"use client";
/** Forja IA — Los elementos señalados en la vista previa, encima del
 *  compositor: se ven, se amplían al apartado que los contiene o se quitan
 *  antes de enviar (ver `senalar.ts`). */
import { MousePointerClick, X } from "lucide-react";
import { ampliarASeccion, etiquetaCorta, type ElementoSenalado } from "@/lib/forja/senalar";

export function SenaladosBar({
  senalados,
  onChange,
}: {
  senalados: ElementoSenalado[];
  onChange: (f: (l: ElementoSenalado[]) => ElementoSenalado[]) => void;
}) {
  if (!senalados.length) return null;
  return (
    <div className="mx-auto mb-1.5 flex w-full max-w-3xl flex-wrap items-center gap-1.5 px-3 sm:px-4" aria-label="Elementos señalados">
      <MousePointerClick className="size-3.5 shrink-0 text-primary" />
      {senalados.map((e) => (
        <span
          key={e.id}
          className="flex max-w-full items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 py-0.5 pl-2 pr-0.5 text-[11px]"
          title={`${e.selector}\n\n${e.html.slice(0, 400)}`}
        >
          <span className="truncate font-mono">{etiquetaCorta(e)}</span>
          {e.seccion && (
            <button
              type="button"
              className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onChange((l) => l.map((x) => (x.id === e.id ? ampliarASeccion(x) : x)))}
              title={`Ampliar al apartado que lo contiene: <${e.seccion.etiqueta}>`}
            >
              ↑ {`<${e.seccion.etiqueta}>`}
            </button>
          )}
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onChange((l) => l.filter((x) => x.id !== e.id))}
            aria-label={`Quitar ${etiquetaCorta(e)}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
