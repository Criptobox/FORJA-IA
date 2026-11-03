"use client";
/** Forja IA — Estudio: elegir el estilo visual viendo cómo es.
 *
 * Antes era una fila de botones con cinco manchitas de color: había que
 * imaginarse el resto. Cada tarjeta es ahora una mini-pantalla pintada con la
 * dirección de verdad —su fondo, su superficie, su tipografía display, su
 * acento en un botón y su radio de esquinas—, más la tira de la paleta.
 * En el móvil van en dos columnas; las fuentes se cargan recortadas a las
 * pocas letras que se enseñan (`text=`), así que pesan casi nada. */
import { Check } from "lucide-react";
import type { DireccionVisual } from "@/lib/forja/design-directions";
import { cn } from "@/lib/utils";
import { Chispa } from "../chispa";

/** Lo único que se escribe con la fuente display en la vista previa. */
const MUESTRA = "Aa Titular";

/** Una hoja de Google Fonts con las fuentes display de todas las
 * direcciones, solo con las letras de la muestra. */
function urlMuestras(direcciones: readonly DireccionVisual[]): string {
  const familias = [...new Set(direcciones.map((d) => d.fuentes.display))]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${familias}&text=${encodeURIComponent(MUESTRA)}&display=swap`;
}

/** Si la fuente no llega a cargar, que al menos caiga en su familia. */
export function respaldo(fuente: string): string {
  if (/mono/i.test(fuente)) return "ui-monospace, monospace";
  return /serif|playfair|fraunces|garamond|lora|merriweather/i.test(fuente) && !/sans/i.test(fuente) ? "Georgia, serif" : "system-ui, sans-serif";
}

/** «0px (bordes rectos…)» → 0; «14px …» → 14. Sin número, un radio suave. */
export function radioDe(d: Pick<DireccionVisual, "radios">): number {
  const m = d.radios.match(/(\d+(?:\.\d+)?)\s*px/);
  return m ? Math.min(18, Number(m[1])) : 8;
}

export function SelectorEstilo({
  direcciones,
  valor,
  onCambio,
}: {
  direcciones: readonly DireccionVisual[];
  /** id elegido; null = que elija FORJA */
  valor: string | null;
  onCambio: (id: string | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Estilo" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      <link rel="stylesheet" href={urlMuestras(direcciones)} precedence="default" />
      <button
        type="button"
        role="radio"
        aria-checked={valor === null}
        onClick={() => onCambio(null)}
        className={cn(
          "relative flex min-h-[148px] flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border p-2 text-center transition",
          valor === null ? "border-orange-500 ring-2 ring-orange-500/30" : "border-border/60 bg-card/50 hover:border-orange-500/40"
        )}
      >
        <Chispa estado="inicio" size={54} />
        <span className="text-[13px] font-semibold">Que elija FORJA</span>
        <span className="text-[11px] leading-tight text-muted-foreground">La que mejor encaje con tu encargo</span>
        {valor === null && <Marca />}
      </button>

      {direcciones.map((d) => {
        const p = d.paleta;
        const r = radioDe(d);
        const activo = valor === d.id;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(d.id)}
            title={d.cuando}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
              activo ? "border-orange-500 ring-2 ring-orange-500/30" : "border-border/60 hover:border-orange-500/40"
            )}
          >
            {/* mini-pantalla con la dirección de verdad */}
            <span aria-hidden className="relative block h-[92px] p-2.5" style={{ background: p.fondo, color: p.texto }}>
              <span className="block text-[21px] leading-none" style={{ fontFamily: `"${d.fuentes.display}", ${respaldo(d.fuentes.display)}` }}>
                Aa
              </span>
              <span className="mt-1.5 block h-1.5 w-[62%] rounded-full opacity-70" style={{ background: p.textoSuave }} />
              <span className="mt-1 block h-1.5 w-[40%] rounded-full opacity-40" style={{ background: p.textoSuave }} />
              <span
                className="mt-2 inline-block px-2 py-[3px] text-[9.5px] font-semibold"
                style={{ background: p.acento, color: p.fondo, borderRadius: r }}
              >
                Botón
              </span>
              <span
                className="absolute bottom-2.5 right-2.5 top-2.5 w-[34%] border"
                style={{ background: p.superficie, borderColor: `color-mix(in oklab, ${p.texto} 12%, transparent)`, borderRadius: r }}
              >
                <span className="m-1.5 block h-6 rounded-[3px]" style={{ background: p.acento2, opacity: 0.85 }} />
                <span className="mx-1.5 block h-1 rounded-full opacity-50" style={{ background: p.textoSuave }} />
              </span>
            </span>
            {/* tira de la paleta */}
            <span aria-hidden className="flex h-1.5">
              {[p.fondo, p.superficie, p.texto, p.textoSuave, p.acento, p.acento2].map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </span>
            <span className="block bg-card px-2.5 py-2">
              <span className="block truncate text-[12.5px] font-semibold">{d.nombre}</span>
              <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{d.cuando}</span>
            </span>
            {activo && <Marca />}
          </button>
        );
      })}
    </div>
  );
}

function Marca() {
  return (
    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-orange-500 text-white shadow">
      <Check className="size-3" />
    </span>
  );
}
