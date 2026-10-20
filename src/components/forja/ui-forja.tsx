"use client";
/** FORJA IA — piezas de interfaz compartidas del Estudio (/forja).
 * Usan los tokens del host (bg-card, border, muted…) para heredar el tema
 * claro/oscuro y el acento FORJA sin CSS propio de marca. */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bloque de código/salida con botón de copiar. */
export function CodeBlock({
  texto,
  className,
  maxAlto = "22rem",
}: {
  texto: string;
  className?: string;
  maxAlto?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* clipboard bloqueado: sin drama, el texto sigue visible */
    }
  };
  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={copiar}
        className="absolute right-1.5 top-1.5 size-8 sm:size-7 opacity-60 hover:opacity-100"
        title="Copiar"
      >
        {copiado ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      </Button>
      <pre
        className="overflow-auto rounded-xl border border-border/60 bg-muted/40 p-3 pr-10 text-[12px] sm:text-[11.5px] leading-relaxed text-foreground/90"
        style={{ maxHeight: maxAlto }}
      >
        {texto}
      </pre>
    </div>
  );
}

/** Salida de consola estilo taller (pre monoespaciada con fondo hundido). */
export function Salida({ texto, maxAlto = "16rem" }: { texto: string; maxAlto?: string }) {
  return (
    <pre
      className="overflow-auto rounded-xl border border-border/60 bg-background/60 p-3 font-mono text-[12px] sm:text-[11.5px] leading-relaxed text-foreground/85"
      style={{ maxHeight: maxAlto }}
    >
      {texto || "—"}
    </pre>
  );
}

/** Chip pequeño de estado. */
export function Chip({
  children,
  tono = "neutral",
}: {
  children: React.ReactNode;
  tono?: "neutral" | "ok" | "fuego" | "aviso";
}) {
  const tonos: Record<string, string> = {
    neutral: "border-border/60 bg-muted/50 text-muted-foreground",
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    fuego: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    aviso: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        tonos[tono]
      )}
    >
      {children}
    </span>
  );
}

/** Descarga un texto como fichero (para DESIGN.md, tokens.css…). */
export function descargar(nombre: string, texto: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([texto], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
