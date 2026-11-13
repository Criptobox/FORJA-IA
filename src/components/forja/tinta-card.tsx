"use client";
/** Forja IA — La tarjeta «¿Cómo construimos la app?» del chat (`tinta/chat.ts`).
 *
 * Dos caminos antes de gastar nada: diseño con la biblioteca Tinta (el equipo
 * de agentes la trabaja a la vista) o app funcional con código (lo de siempre).
 * Aquí solo se pinta; las acciones las hace el chat. */
import Link from "next/link";
import { Code2, Layers, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OfertaTinta } from "@/lib/forja/tinta/chat";

function nombreCorto(key?: string): string {
  if (!key) return "el modelo";
  const i = key.indexOf("::");
  return i >= 0 ? key.slice(i + 2) : key;
}

export function TintaCard({
  oferta,
  deshabilitada,
  onTinta,
  onCodigo,
}: {
  oferta: OfertaTinta;
  deshabilitada?: boolean;
  onTinta: () => void;
  onCodigo: () => void;
}) {
  const { estado } = oferta;
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4" data-testid="oferta-tinta" data-estado={estado}>
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Layers className="h-4 w-4 text-orange-500" />
        ¿Cómo construimos la app?
        <span className="ml-auto text-[10.5px] font-normal text-muted-foreground">
          {estado === "pendiente" ? "0 tokens · aún no se ha construido nada" : estado === "hecha" ? `${oferta.llamadas ?? 1} llamada${(oferta.llamadas ?? 1) > 1 ? "s" : ""} al modelo` : ""}
        </span>
      </div>

      {estado === "pendiente" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-3">
            <p className="text-[12.5px] font-medium">Diseño con la biblioteca Tinta</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              El modelo elige piezas de 300+ bloques y el equipo de 8 agentes arma la app completa, con todas sus pantallas. Muy pocos tokens. Es diseño navegable: no guarda datos.
            </p>
            <Button size="sm" className="mt-2 w-full gap-1.5" onClick={onTinta} disabled={deshabilitada} data-testid="oferta-tinta-si">
              <Layers className="size-4" /> Diseñar con Tinta
            </Button>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-[12.5px] font-medium">App funcional con código</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              La IA escribe los módulos: estado, rutas, guardar y editar datos. Gasta más tokens.
            </p>
            <Button size="sm" variant="outline" className="mt-2 w-full gap-1.5" onClick={onCodigo} disabled={deshabilitada} data-testid="oferta-tinta-codigo">
              <Code2 className="size-4" /> Escribir el código
            </Button>
          </div>
        </div>
      )}

      {estado === "creando" && (
        <p className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> {oferta.paso ?? "Creando con Tinta…"}
        </p>
      )}

      {estado === "hecha" && (
        <div className="mt-2 space-y-2">
          <p className="text-[12.5px]" role="status">
            App creada con Tinta: {oferta.pantallas ?? 0} pantallas, hecha por {nombreCorto(oferta.modelo)}.
          </p>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/forja?tab=estudio" data-testid="oferta-tinta-abrir">
              <Layers className="size-4" /> Abrir en el Estudio
            </Link>
          </Button>
        </div>
      )}

      {estado === "descartada" && <p className="mt-2 text-[12px] text-muted-foreground">Se construye con código.</p>}

      {estado === "error" && (
        <div className="mt-2 space-y-2">
          <p className="text-[12.5px] text-red-600 dark:text-red-400" role="alert">
            {oferta.error ?? "No se pudo crear con Tinta."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onTinta} disabled={deshabilitada}>
              <RotateCcw className="size-4" /> Reintentar con Tinta
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={onCodigo} disabled={deshabilitada}>
              <Code2 className="size-4" /> Mejor con código
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
