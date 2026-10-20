"use client";
/** Forja IA — La tarjeta de la propuesta de diseño (Plan Maestro 2026 §4).
 *
 * Se enseña en lugar de construir cuando se pide una web nueva: tres
 * direcciones para comparar, las secciones de la página y los datos que
 * faltan. Elegir una (con ajustes opcionales) es lo que lanza la
 * construcción. La lógica vive en `propuesta-diseno.ts`; aquí solo se pinta.
 */
import { useState } from "react";
import { Check, Hammer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PropuestaDiseno, VarianteDireccion } from "@/lib/forja/propuesta-diseno";

function Muestra({ v }: { v: VarianteDireccion }) {
  const p = v.paleta;
  return (
    <div
      className="overflow-hidden rounded-lg border border-border/60"
      style={{ background: p.fondo, color: p.texto }}
      aria-hidden
    >
      <div className="px-3 pb-2 pt-3">
        <div
          className="text-[15px] font-semibold leading-tight"
          style={{ fontFamily: `"${v.fuentes.display}", serif` }}
        >
          Titular con carácter
        </div>
        <div className="mt-1 text-[11px] leading-snug" style={{ color: p.textoSuave, fontFamily: `"${v.fuentes.cuerpo}", sans-serif` }}>
          Así se lee el texto de la página.
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className="px-2 py-0.5 text-[10px] font-medium"
            style={{ background: p.acento, color: p.fondo, borderRadius: 6 }}
          >
            Acción
          </span>
          <span className="px-2 py-0.5 text-[10px]" style={{ background: p.superficie, borderRadius: 6 }}>
            Tarjeta
          </span>
        </div>
      </div>
      <div className="flex h-2">
        {[p.fondo, p.superficie, p.texto, p.textoSuave, p.acento, p.acento2].map((c, i) => (
          <span key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

export function PropuestaCard({
  propuesta,
  onConstruir,
  deshabilitada,
}: {
  propuesta: PropuestaDiseno;
  /** `id` null = construir directo con la recomendada, sin fijar elección */
  onConstruir: (id: string | null, ajustes: string) => void;
  deshabilitada?: boolean;
}) {
  const recomendada = propuesta.variantes.find((v) => v.recomendada)?.id ?? propuesta.variantes[0]?.id;
  const [sel, setSel] = useState<string | undefined>(propuesta.elegida ?? recomendada);
  const [ajustes, setAjustes] = useState("");
  const resuelta = !!propuesta.resuelta;
  const faltan = propuesta.datos.filter((d) => !d.valor);
  const dados = propuesta.datos.filter((d) => d.valor);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4" data-testid="propuesta-diseno">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Sparkles className="h-4 w-4 text-forja-violet" />
        Propuesta de diseño
        <span className="ml-auto text-[10.5px] font-normal text-muted-foreground">
          {resuelta ? "0 tokens · decidida" : "0 tokens · aún no se ha construido nada"}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Elige la dirección visual antes de construir. La que elijas queda fijada para el resto del proyecto.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Dirección visual">
        {propuesta.variantes.map((v) => {
          const activa = sel === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={activa}
              disabled={resuelta || deshabilitada}
              onClick={() => setSel(v.id)}
              className={cn(
                "rounded-xl border p-2 text-left transition-colors",
                activa ? "border-forja-violet ring-1 ring-forja-violet" : "border-border/60 hover:border-border",
                (resuelta || deshabilitada) && !activa && "opacity-50"
              )}
            >
              <Muestra v={v} />
              <div className="mt-2 flex items-center gap-1 text-[12px] font-medium">
                {activa && <Check className="h-3.5 w-3.5 text-forja-violet" />}
                {v.nombre}
              </div>
              <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                {v.fuentes.display} + {v.fuentes.cuerpo}
                {v.recomendada && (v.pedidaPorElUsuario ? " · la que pediste" : " · recomendada")}
              </div>
              <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground/80">{v.cuando}</div>
            </button>
          );
        })}
      </div>

      {propuesta.secciones.length > 0 && (
        <div className="mt-3 text-[11.5px]">
          <span className="font-medium">Secciones:</span>{" "}
          <span className="text-muted-foreground">{propuesta.secciones.join(" · ")}</span>
        </div>
      )}
      <div className="mt-1 text-[11.5px]">
        {dados.length > 0 && (
          <div>
            <span className="font-medium">Datos que diste:</span>{" "}
            <span className="text-muted-foreground">{dados.map((d) => `${d.campo}: ${d.valor}`).join(" · ")}</span>
          </div>
        )}
        {faltan.length > 0 && (
          <div>
            <span className="font-medium">Pendientes (no se inventarán):</span>{" "}
            <span className="text-muted-foreground">{faltan.map((d) => d.campo).join(", ")}</span>
          </div>
        )}
      </div>

      {resuelta ? (
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          {propuesta.resuelta === "directo"
            ? "Construido sin fijar dirección."
            : `Construido con «${propuesta.variantes.find((v) => v.id === propuesta.elegida)?.nombre ?? propuesta.elegida}».`}
        </p>
      ) : (
        <>
          <textarea
            value={ajustes}
            onChange={(e) => setAjustes(e.target.value)}
            disabled={deshabilitada}
            placeholder="Ajustes opcionales: «más oscuro», «sin sección de precios», «añade galería»…"
            aria-label="Ajustes a la propuesta"
            rows={2}
            className="mt-3 w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-[12px] outline-none focus:border-forja-violet"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!sel || deshabilitada} onClick={() => sel && onConstruir(sel, ajustes.trim())}>
              <Hammer className="mr-1.5 h-3.5 w-3.5" />
              Construir con esta dirección
            </Button>
            <Button size="sm" variant="ghost" disabled={deshabilitada} onClick={() => onConstruir(null, ajustes.trim())}>
              Construir sin elegir
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
