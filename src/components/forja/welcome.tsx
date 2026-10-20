"use client";
/** Forja IA — Empty state del chat: hero compacto, un CTA y atajos para construir. */
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bug,
  ChartColumn,
  ClipboardPaste,
  Eye,
  FolderGit2,
  Gamepad2,
  History,
  Infinity as InfinityIcon,
  KeyRound,
  LayoutTemplate,
  PenLine,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Telescope,
} from "lucide-react";
import { ForjaLogo } from "./logo";
import { Button } from "@/components/ui/button";
import { useForja } from "@/lib/forja/store";
import { PROVIDERS } from "@/lib/forja/providers";
import { makeModelKey } from "@/lib/forja/types";
import { cn } from "@/lib/utils";

const START = [
  { name: "NVIDIA", color: "#76B900" },
  { name: "Kimi", color: "#2563EB" },
  { name: "TokenRouter", color: "#22D3EE" },
];

const PILLS: { icon: LucideIcon; label: string; className: string }[] = [
  { icon: ShieldCheck, label: "Claves locales", className: "text-forja-violet" },
  { icon: InfinityIcon, label: "Sin cuotas", className: "text-forja-cyan" },
  { icon: Eye, label: "Vista previa", className: "text-forja-pink" },
];

const SUGGESTIONS: {
  icon: LucideIcon;
  tint: string;
  title: string;
  hint: string;
  text: string;
  openRepos?: boolean;
}[] = [
  {
    icon: LayoutTemplate,
    tint: "bg-forja-violet/12 text-forja-violet",
    title: "Página de aterrizaje",
    hint: "HTML de una pieza",
    text: "Crea una página de aterrizaje para una cafetería de especialidad, en un solo archivo HTML con diseño moderno y animaciones",
  },
  {
    icon: Gamepad2,
    tint: "bg-forja-cyan/12 text-forja-cyan",
    title: "Un juego",
    hint: "Serpiente táctil",
    text: "Crea el juego de la serpiente en un solo archivo HTML con controles táctiles, puntuación y diseño pulido",
  },
  {
    icon: ChartColumn,
    tint: "bg-forja-pink/12 text-forja-pink",
    title: "Panel de datos",
    hint: "Gastos y gráficos",
    text: "Crea un panel de gastos mensuales en HTML con gráficos animados y guardado en el navegador",
  },
  {
    icon: PenLine,
    tint: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    title: "Escribe por mí",
    hint: "Correo profesional",
    text: "Ayúdame a redactar un correo profesional para mi jefe",
  },
  {
    icon: FolderGit2,
    tint: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    title: "Un repositorio",
    hint: "Pega un enlace de GitHub",
    text: "",
    openRepos: true,
  },
];

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
    return c?.enabled && (!!c.apiKey.trim() || !!p.keyless);
  });
  const featured = PROVIDERS.find((p) => p.featured)!;
  const firstReady = PROVIDERS.find((p) => {
    const c = providers[p.id];
    return c?.enabled && (!!c.apiKey.trim() || !!p.keyless) && c.models.length > 0;
  });

  const useFirstDefault = () => {
    if (!firstReady) return;
    setSettings({ defaultModelKey: makeModelKey(firstReady.id, providers[firstReady.id].models[0]) });
  };

  return (
    <div className="relative flex min-h-full flex-col items-center justify-start overflow-hidden px-4 py-6 sm:justify-center sm:py-8">
      {/* Halo de color: solo en el empty state, no ensucia el chat. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-8%] size-[min(28rem,100vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--forja-violet)_42%,transparent),transparent_68%)] opacity-50 blur-3xl dark:opacity-30" />
        <div className="absolute right-[8%] top-[28%] size-[min(18rem,70vw)] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--forja-cyan)_38%,transparent),transparent_70%)] opacity-40 blur-3xl dark:opacity-25" />
        <div className="absolute bottom-[8%] left-[12%] size-[min(14rem,60vw)] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--forja-pink)_32%,transparent),transparent_70%)] opacity-30 blur-3xl dark:opacity-20" />
      </div>

      <div className="relative w-full max-w-[34rem] text-center">
        <div className="stagger-in mb-4 flex justify-center" style={{ "--stagger": 0 } as React.CSSProperties}>
          <div className="relative">
            <div className="absolute inset-[-18%] -z-10 rounded-full forja-gradient-bg opacity-20 blur-2xl" />
            <ForjaLogo size={56} glow />
          </div>
        </div>

        <p
          className="stagger-in text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80"
          style={{ "--stagger": 1 } as React.CSSProperties}
        >
          Forja
        </p>
        <h2
          className="stagger-in mt-1 text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]"
          style={{ "--stagger": 2 } as React.CSSProperties}
        >
          ¿Qué construimos{" "}
          <span className="forja-gradient-text">hoy</span>?
        </h2>
        <p
          className="stagger-in mx-auto mt-2 max-w-sm text-pretty text-[13px] leading-relaxed text-muted-foreground sm:text-sm"
          style={{ "--stagger": 3 } as React.CSSProperties}
        >
          Todos tus modelos, forjados en uno. Pide una página y la ves nacer al lado.
        </p>

        <div
          className="stagger-in mt-4 flex flex-wrap items-center justify-center gap-1.5"
          style={{ "--stagger": 4 } as React.CSSProperties}
        >
          {PILLS.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-sm"
            >
              <p.icon className={cn("size-3", p.className)} />
              {p.label}
            </span>
          ))}
        </div>

        {!anyProvider && (
          <div
            className="stagger-in glow-accent mt-6 rounded-2xl border border-border/70 bg-card/80 p-4 text-left shadow-sm backdrop-blur-sm"
            style={{ "--stagger": 5 } as React.CSSProperties}
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
                  <a href={featured.keyUrl} target="_blank" rel="noreferrer" className="inline-flex">
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground">
                      Obtener clave
                      <ArrowUpRight className="size-3" />
                    </Button>
                  </a>
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

        {/* Fila contextual (D3, PLAN-V7): acciones nacidas de TU estado —
            lo último que dejaste a medias y las ofertas del momento — no
            sugerencias genéricas. Solo si hay algo real que retomar. */}
        {recent && onResume && (
          <div
            className="stagger-in mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-3"
            style={{ "--stagger": 5 } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={() => onResume(recent.id)}
              title={`Volver a «${recent.title}», con su contexto delante`}
              className="lift-card group flex items-center gap-2.5 rounded-xl border border-forja-violet/25 bg-forja-violet/[0.06] px-2.5 py-2 text-left backdrop-blur-sm hover:border-forja-violet/50 hover:bg-forja-violet/10"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-forja-violet/15 text-forja-violet">
                <History className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight text-foreground">
                  Continuar «{recent.title}»
                </span>
                <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                  Retoma donde lo dejaste
                </span>
              </span>
            </button>
            {onOpenRadar && (
              <button
                type="button"
                onClick={onOpenRadar}
                title="Ofertas y novedades de modelos gratis"
                className="lift-card group flex items-center gap-2.5 rounded-xl border border-forja-cyan/25 bg-forja-cyan/[0.06] px-2.5 py-2 text-left backdrop-blur-sm hover:border-forja-cyan/50 hover:bg-forja-cyan/10"
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-forja-cyan/15 text-forja-cyan">
                  <Telescope className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-tight text-foreground">
                    Modelos gratis de hoy
                  </span>
                  <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                    Lo fresco, sin gastar
                  </span>
                </span>
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
                className="lift-card group flex items-center gap-2.5 rounded-xl border border-forja-pink/25 bg-forja-pink/[0.06] px-2.5 py-2 text-left backdrop-blur-sm hover:border-forja-pink/50 hover:bg-forja-pink/10"
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-forja-pink/15 text-forja-pink">
                  <Bug className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-tight text-foreground">
                    Descifrar un error
                  </span>
                  <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                    Pega el stack trace
                  </span>
                </span>
              </button>
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              style={{ "--stagger": 6 + i } as React.CSSProperties}
              onClick={() => {
                if (s.openRepos) {
                  onOpenRepos?.();
                  return;
                }
                if (anyProvider) onPick(s.text);
                else onOpenSettings();
              }}
              title={s.openRepos ? "Abrir Repo Studio" : anyProvider ? s.text : "Primero conecta un proveedor"}
              className="stagger-in lift-card group flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/50 px-2.5 py-2 text-left backdrop-blur-sm hover:border-forja-violet/35 hover:bg-card"
            >
              <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-lg", s.tint)}>
                <s.icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight text-foreground">{s.title}</span>
                <span className="block truncate text-[11px] leading-tight text-muted-foreground">{s.hint}</span>
              </span>
              <ArrowUpRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-50" />
            </button>
          ))}
        </div>

        {onOpenSkills && anyProvider && (
          <button
            type="button"
            onClick={onOpenSkills}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-[11.5px] text-muted-foreground transition hover:border-forja-violet/30 hover:text-foreground"
          >
            <Puzzle className="size-3.5 text-forja-violet" />
            Skills · desarrollador, mentor, traductor…
          </button>
        )}
      </div>
    </div>
  );
}
