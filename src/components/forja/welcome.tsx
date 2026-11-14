"use client";
/** Forja IA — Empty state del chat: saludo, Chispa, una pregunta y atajos en
 * píldora junto al cuadro de escribir (calmado, el compositor manda). */
import type { LucideIcon } from "lucide-react";
import {
  Bug,
  Coffee,
  Dumbbell,

  Globe,
  History,

  Puzzle,
  ShoppingBag,
  Sparkles,
  Telescope,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Chispa } from "./chispa";
import { useForja } from "@/lib/forja/store";
import { PROVIDERS } from "@/lib/forja/providers";
import { makeModelKey } from "@/lib/forja/types";
import { cn } from "@/lib/utils";

/** Un solo camino: ejemplos que se envían tal cual y funcionan SIN IA (con
 * FORJA WEB los arma el equipo con la biblioteca). Nada de abrir paneles. */
const ATAJOS: { icon: LucideIcon; color: string; label: string; text: string }[] = [
  { icon: Coffee, color: "#c2410c", label: "App para mi cafetería", text: "Hazme una app para mi cafetería con pedidos" },
  { icon: Globe, color: "#2563eb", label: "Web para mi barbería", text: "Hazme una web para mi barbería" },
  { icon: Dumbbell, color: "#16a34a", label: "App de gimnasio", text: "Hazme una app de rutinas para mi gimnasio" },
  { icon: ShoppingBag, color: "#db2777", label: "Tienda de ropa", text: "Hazme una app de tienda de ropa" },
];

/** «Buenos días / tardes / noches» según la hora del dispositivo. En el
 * servidor (y en la hidratación) dice «Hola», así no hay desajuste. */
export function saludoPorHora(hora: number): string {
  if (hora >= 6 && hora < 14) return "Buenos días";
  if (hora >= 14 && hora < 21) return "Buenas tardes";
  return "Buenas noches";
}
const sinSuscripcion = () => () => {};
function useSaludo(): string {
  return useSyncExternalStore(
    sinSuscripcion,
    () => saludoPorHora(new Date().getHours()),
    () => "Hola"
  );
}

const PILDORA =
  "lift-card inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border/50 bg-muted/60 px-3.5 py-2 text-[13px] font-medium text-foreground/90 backdrop-blur-sm hover:border-forja-violet/40 hover:bg-card";

export function Welcome({
  onPick,
  onOpenSettings,
  onOpenSkills,
  recent,
  onResume,
  onOpenRadar,
  onFill,
}: {
  onPick: (text: string) => void;
  onOpenSettings: () => void;
  onOpenSkills?: () => void;
  /** última conversación con mensajes, para «Continuar» (D3, PLAN-V7) */
  recent?: { id: string; title: string } | null;
  /** reanudar esa conversación (la activa, con su contexto delante) */
  onResume?: (id: string) => void;
  /** abrir el radar de modelos gratis (su nombre accesible no puede
   * contener «Radar»: hay E2E que localizan el botón de la cabecera por
   * ese nombre sin scope y el modo estricto los mataría) */
  onOpenRadar?: () => void;
  /** rellenar el compositor SIN enviar (para el arrancador de errores) */
  onFill?: (text: string) => void;
}) {
  const providers = useForja((s) => s.providers);
  const settings = useForja((s) => s.settings);
  const setSettings = useForja((s) => s.setSettings);
  const anyProvider = PROVIDERS.some((p) => {
    const c = providers[p.id];
    return c?.enabled && (!!c.apiKey.trim() || !!p.keyless || !!p.keyOptional);
  });
  const firstReady = PROVIDERS.find((p) => {
    const c = providers[p.id];
    return c?.enabled && (!!c.apiKey.trim() || !!p.keyless || !!p.keyOptional) && c.models.length > 0;
  });

  const useFirstDefault = () => {
    if (!firstReady) return;
    setSettings({ defaultModelKey: makeModelKey(firstReady.id, providers[firstReady.id].models[0]) });
  };

  const saludo = useSaludo();

  return (
    <div className="relative flex min-h-full flex-col items-center overflow-hidden px-4 pb-4 pt-5 sm:pt-8">
      {/* El velo de color de arriba ya no va aquí: lo pinta la columna entera
          (chat-app.tsx) para que empiece detrás de la cabecera y no deje una
          franja de otro tono alrededor de la cápsula. */}
      <div className="relative flex w-full max-w-[34rem] flex-1 flex-col items-center justify-center text-center">
        <p
          className="stagger-in text-[13px] text-muted-foreground"
          style={{ "--stagger": 0 } as React.CSSProperties}
          data-testid="saludo"
        >
          {saludo}
        </p>

        <div className="stagger-in mt-4 mb-5 flex flex-col items-center sm:mt-6 sm:mb-7" style={{ "--stagger": 1 } as React.CSSProperties}>
          <p className="chispa-bocadillo mb-2" aria-hidden>
            ¿Encendemos algo? 🔥
          </p>
          <Chispa estado="inicio" size={124} titulo="Chispa, la llama de Forja, te saluda" />
          <div className="chispa-suelo" aria-hidden />
        </div>

        <h2
          className="stagger-in text-balance text-[1.6rem] font-semibold tracking-tight sm:text-[1.9rem]"
          style={{ "--stagger": 2 } as React.CSSProperties}
        >
          ¿Qué quieres crear <span className="forja-gradient-text">hoy</span>?
        </h2>
        <p
          className="stagger-in mx-auto mt-1.5 max-w-xs text-pretty text-[13px] leading-relaxed text-muted-foreground"
          style={{ "--stagger": 3 } as React.CSSProperties}
        >
          Describe tu app o tu web y la ves nacer al lado. No hace falta ninguna IA: la diseña el equipo de Forja.
        </p>

        {!anyProvider && (
          <p
            className="stagger-in mt-4 text-[12px] text-muted-foreground"
            style={{ "--stagger": 4 } as React.CSSProperties}
          >
            ¿Tienes una clave de IA?{" "}
            <button type="button" onClick={onOpenSettings} className="font-medium text-foreground underline underline-offset-2">
              Conéctala (opcional)
            </button>{" "}
            para pedir cambios con tus palabras.
          </p>
        )}

        {anyProvider && !settings.defaultModelKey && firstReady && (
          <div className="mt-5">
            <Button size="sm" className="forja-gradient-bg h-8 border-0 text-white" onClick={useFirstDefault}>
              <Sparkles className="size-3.5" /> Activar {providers[firstReady.id].models[0]}
            </Button>
          </div>
        )}
      </div>

      {/* Abajo, pegado al cuadro de escribir: los atajos y, si hay algo real
          que retomar, la fila contextual (D3, PLAN-V7). */}
      <div className="relative mt-6 w-full max-w-[34rem] space-y-2.5">
        <div
          className="stagger-in flex flex-wrap justify-center gap-2"
          style={{ "--stagger": 5 } as React.CSSProperties}
          aria-label="Atajos para empezar"
          role="group"
        >
          {ATAJOS.map((a) => (
            <button key={a.label} type="button" className={PILDORA} onClick={() => onPick(a.text)} title={a.text}>
              <a.icon className="size-4" style={{ color: a.color }} aria-hidden />
              {a.label}
            </button>
          ))}
        </div>

        {recent && onResume && (
          <div
            className="stagger-in flex flex-wrap justify-center gap-2"
            style={{ "--stagger": 6 } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={() => onResume(recent.id)}
              title={`Volver a «${recent.title}», con su contexto delante`}
              className={cn(PILDORA, "max-w-full bg-card/70")}
            >
              <History className="size-4 shrink-0 text-orange-500" aria-hidden />
              <span className="truncate">Continuar «{recent.title}»</span>
            </button>
            {onOpenRadar && (
              <button type="button" onClick={onOpenRadar} title="Ofertas y novedades de modelos gratis" className={cn(PILDORA, "bg-card/70")}>
                <Telescope className="size-4 text-cyan-500" aria-hidden />
                Modelos gratis de hoy
              </button>
            )}
            {onFill && (
              <button
                type="button"
                onClick={() =>
                  onFill(
                    "Tengo este error, ¿qué significa y cómo lo arreglo?\n\n```\n(pégalo aquí)\n```"
                  )
                }
                title="Pega un stack trace y te lo traduce"
                className={cn(PILDORA, "bg-card/70")}
              >
                <Bug className="size-4 text-red-500" aria-hidden />
                Descifrar un error
              </button>
            )}
          </div>
        )}

        {onOpenSkills && anyProvider && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onOpenSkills}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] text-muted-foreground transition hover:text-foreground"
            >
              <Puzzle className="size-3.5 text-forja-violet" />
              Skills · desarrollador, mentor, traductor…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
