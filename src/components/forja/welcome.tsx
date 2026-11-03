"use client";
/** Forja IA — Empty state del chat: saludo, Chispa, una pregunta y atajos en
 * píldora junto al cuadro de escribir (calmado, el compositor manda). */
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bug,
  ChartColumn,
  ClipboardPaste,
  Gamepad2,
  GitBranch,
  Globe,
  History,
  KeyRound,
  PenLine,
  Puzzle,
  Smartphone,
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

const START = [
  { name: "NVIDIA", color: "#76B900" },
  { name: "Kimi", color: "#2563EB" },
  { name: "TokenRouter", color: "#22D3EE" },
];

/** Atajos en píldora: cada uno rellena y envía un encargo, abre Repo Studio
 * o lleva al Estudio de diseño. Pocos y con icono de color, como en un
 * lanzador: la pantalla respira y el cuadro de escribir manda. */
const ATAJOS: {
  icon: LucideIcon;
  color: string;
  label: string;
  text?: string;
  openRepos?: boolean;
  href?: string;
}[] = [
  {
    icon: Globe,
    color: "#2563eb",
    label: "Web",
    text: "Crea una página de aterrizaje para una cafetería de especialidad, en un solo archivo HTML con diseño moderno y animaciones",
  },
  { icon: Smartphone, color: "#8b5cf6", label: "Diseñar app", href: "/forja" },
  {
    icon: Gamepad2,
    color: "#06b6d4",
    label: "Juego",
    text: "Crea el juego de la serpiente en un solo archivo HTML con controles táctiles, puntuación y diseño pulido",
  },
  {
    icon: ChartColumn,
    color: "#ec4899",
    label: "Panel de datos",
    text: "Crea un panel de gastos mensuales en HTML con gráficos animados y guardado en el navegador",
  },
  { icon: PenLine, color: "#10b981", label: "Escribir", text: "Ayúdame a redactar un correo profesional para mi jefe" },
  { icon: GitBranch, color: "#f59e0b", label: "Repositorio", openRepos: true },
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
  onQuickSetup,
  onOpenRepos,
  recent,
  onResume,
  onOpenRadar,
  onFill,
}: {
  onPick: (text: string) => void;
  onOpenSettings: () => void;
  onOpenSkills?: () => void;
  onQuickSetup: (providerId: "aihubmix") => void;
  onOpenRepos?: () => void;
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
  const featured = PROVIDERS.find((p) => p.featured)!;
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
      {/* Velo de color arriba (como el cielo de la referencia), solo en la
          bienvenida: no ensucia el chat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55%] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--forja-cyan)_16%,transparent),transparent)] dark:opacity-60"
      />

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
          Escribe tu idea abajo y la ves nacer al lado.
        </p>

        {!anyProvider && (
          <div
            className="stagger-in glow-accent mt-6 w-full rounded-2xl border border-border/70 bg-card/80 p-4 text-left shadow-sm backdrop-blur-sm"
            style={{ "--stagger": 4 } as React.CSSProperties}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl forja-gradient-bg text-white shadow-md shadow-violet-500/20">
                <KeyRound className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13.5px] font-semibold tracking-tight">Conecta un modelo</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {START.map((s) => (
                    <span
                      key={s.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[11px] font-medium"
                    >
                      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  Pega el snippet de Build o el cliente OpenAI. Forja saca clave, URL y modelo.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={onOpenSettings}
                    className="forja-gradient-bg h-8 border-0 text-white shadow-md shadow-violet-500/15 hover:opacity-90"
                  >
                    <ClipboardPaste className="size-3.5" /> Pegar snippet
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-border/70 text-xs"
                    onClick={() => onQuickSetup("aihubmix")}
                  >
                    AiHubMix
                  </Button>
                  {/* Un solo control: un enlace con aspecto de botón (antes era un
                      <button> dentro de un <a>, dos paradas de Tab y un clic ambiguo). */}
                  <Button asChild size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground">
                    <a href={featured.keyUrl} target="_blank" rel="noreferrer">
                      Obtener clave
                      <ArrowUpRight className="size-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
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
          {ATAJOS.map((a) => {
            const icono = <a.icon className="size-4" style={{ color: a.color }} aria-hidden />;
            if (a.href)
              return (
                <a key={a.label} href={a.href} className={PILDORA} title="Estudio de diseño: pantallas de app y webs">
                  {icono}
                  {a.label}
                </a>
              );
            return (
              <button
                key={a.label}
                type="button"
                className={PILDORA}
                onClick={() => {
                  if (a.openRepos) {
                    onOpenRepos?.();
                    return;
                  }
                  if (anyProvider) onPick(a.text ?? "");
                  else onOpenSettings();
                }}
                title={a.openRepos ? "Abrir Repo Studio" : anyProvider ? a.text : "Primero conecta un proveedor"}
              >
                {icono}
                {a.label}
              </button>
            );
          })}
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
