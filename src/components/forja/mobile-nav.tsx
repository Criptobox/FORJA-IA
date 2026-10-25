"use client";
/** Forja IA — Kit de optimización móvil: barra de 4 pestañas y hoja de Ecosistema.
 *
 * Sale del prototipo «Fusión Definitiva»: el menú hamburguesa deja de ser la
 * única puerta en el móvil. Las pestañas reutilizan las pantallas que ya
 * existen (conversaciones, selector de modelo, herramientas); aquí solo vive
 * la presentación. En escritorio (≥ lg) no se pinta: ahí manda la barra lateral.
 *
 * Los nombres accesibles llevan el prefijo «Pestaña» a propósito: hay E2E que
 * buscan botones por el nombre exacto «Crear» o por «modelo» y no deben chocar.
 */
import type { ReactNode } from "react";
import {
  Activity,
  BookOpen,
  Box,
  Brain,
  BrainCircuit,
  Database,
  FlaskConical,
  FolderGit2,
  FolderKanban,
  GraduationCap,
  Github,
  Hammer,
  LayoutDashboard,
  Puzzle,
  Radar,
  Settings,
  Sparkles,
  Swords,
  Ticket,
  Wand2,
  Cpu,
  Layers,
  Terminal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ThemeSegmented, VersionLine } from "./sidebar";
import { InstallButton } from "./pwa";
import { cn } from "@/lib/utils";

export type PestanaMovil = "crear" | "proyectos" | "modelos" | "ecosistema";

const TABS: { id: PestanaMovil; label: string; icon: ReactNode }[] = [
  { id: "crear", label: "Crear", icon: <Wand2 className="size-[18px]" /> },
  { id: "proyectos", label: "Proyectos", icon: <FolderKanban className="size-[18px]" /> },
  { id: "modelos", label: "Modelos", icon: <Cpu className="size-[18px]" /> },
  { id: "ecosistema", label: "Ecosistema", icon: <Layers className="size-[18px]" /> },
];

export function MobileNav({
  activa,
  onSelect,
}: {
  activa: PestanaMovil;
  onSelect: (id: PestanaMovil) => void;
}) {
  return (
    <nav className="forja-tabs lg:hidden" aria-label="Navegación principal">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="forja-tab"
          aria-label={`Pestaña ${t.label}`}
          aria-current={activa === t.id ? "page" : undefined}
          onClick={() => onSelect(t.id)}
        >
          <i>{t.icon}</i>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

interface Herramienta {
  label: string;
  hint: string;
  icon: ReactNode;
  /** matiz del icono: cada herramienta tiene el suyo, para reconocerla sin leer */
  color: string;
  onClick?: () => void;
  badge?: number;
}

export interface EcosistemaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenSandbox?: () => void;
  onOpenStudio?: () => void;
  onOpenRepos?: () => void;
  onOpenGithub?: () => void;
  onOpenPanel?: () => void;
  onOpenRadar?: () => void;
  onOpenArena?: () => void;
  onOpenOpenCode?: () => void;
  onOpenLibrary?: () => void;
  onOpenKnowledgeBase?: () => void;
  onOpenSkills?: () => void;
  onOpenFailures?: () => void;
  onOpenUsage?: () => void;
  onOpenRepaso?: () => void;
  repasoVencidas?: number;
  onOpenOfertas?: () => void;
  ofertasNuevas?: number;
  onOpenGuide?: () => void;
}

export function EcosistemaSheet(p: EcosistemaProps) {
  const router = useRouter();
  /** cierra la hoja y luego abre la pantalla elegida */
  const ir = (fn?: () => void) => () => {
    p.onOpenChange(false);
    fn?.();
  };

  const grupos: { titulo: string; cols: 2 | 3; items: Herramienta[] }[] = [
    {
      titulo: "Proyectos",
      cols: 2,
      items: [
        { label: "Sandbox", hint: "Ejecuta un ZIP", icon: <Box className="size-5" />, color: "#f97316", onClick: ir(p.onOpenSandbox) },
        { label: "Web Studio", hint: "Construir y medir", icon: <Sparkles className="size-5" />, color: "#a855f7", onClick: ir(p.onOpenStudio) },
        { label: "Repos", hint: "Edita y haz push", icon: <FolderGit2 className="size-5" />, color: "#10b981", onClick: ir(p.onOpenRepos) },
        { label: "GitHub", hint: "Sube una carpeta", icon: <Github className="size-5" />, color: "#64748b", onClick: ir(p.onOpenGithub) },
      ],
    },
    {
      titulo: "Forja Lab",
      cols: 2,
      items: [
        { label: "Estudio", hint: "Generación sin API", icon: <Hammer className="size-5" />, color: "#f59e0b", onClick: ir(() => router.push("/forja")) },
        { label: "Ficha → Maqueta", hint: "De ficha a página", icon: <FlaskConical className="size-5" />, color: "#ec4899", onClick: ir(() => router.push("/forja?tab=ficha")) },
      ],
    },
    {
      titulo: "Modelos",
      cols: 2,
      items: [
        { label: "Panel", hint: "Gasto y uso", icon: <LayoutDashboard className="size-5" />, color: "#06b6d4", onClick: ir(p.onOpenPanel) },
        { label: "Radar", hint: "Gratis de hoy", icon: <Radar className="size-5" />, color: "#10b981", onClick: ir(p.onOpenRadar) },
        { label: "Arena", hint: "Compara 2-3", icon: <Swords className="size-5" />, color: "#ef4444", onClick: ir(p.onOpenArena) },
        { label: "OpenCode", hint: "Gratis, al día", icon: <Terminal className="size-5" />, color: "#0ea5e9", onClick: ir(p.onOpenOpenCode) },
      ],
    },
    {
      titulo: "Herramientas",
      cols: 3,
      items: [
        { label: "Biblioteca", hint: "Prompts", icon: <BookOpen className="size-5" />, color: "#3b82f6", onClick: ir(p.onOpenLibrary) },
        { label: "Conocimiento", hint: "Tu base", icon: <Database className="size-5" />, color: "#14b8a6", onClick: ir(p.onOpenKnowledgeBase) },
        { label: "Skills", hint: "Instrucciones", icon: <Puzzle className="size-5" />, color: "#a855f7", onClick: ir(p.onOpenSkills) },
        { label: "Memoria", hint: "Fallos", icon: <BrainCircuit className="size-5" />, color: "#f97316", onClick: ir(p.onOpenFailures) },
        { label: "Uso", hint: "Local", icon: <Activity className="size-5" />, color: "#06b6d4", onClick: ir(p.onOpenUsage) },
        { label: "Repaso", hint: "Tarjetas", icon: <Brain className="size-5" />, color: "#ec4899", onClick: ir(p.onOpenRepaso), badge: p.repasoVencidas },
        { label: "Ofertas", hint: "Créditos", icon: <Ticket className="size-5" />, color: "#f59e0b", onClick: ir(p.onOpenOfertas), badge: p.ofertasNuevas },
        { label: "Guía", hint: "Primeros pasos", icon: <GraduationCap className="size-5" />, color: "#22c55e", onClick: ir(p.onOpenGuide) },
      ],
    },
  ];

  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[86dvh] gap-0 rounded-t-3xl border-border/60 p-0 lg:hidden"
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <div>
            <SheetTitle className="text-[15px]">Ecosistema Forja IA</SheetTitle>
            <SheetDescription className="text-[11.5px]">Todo lo que Forja puede hacer por ti</SheetDescription>
          </div>
          <button
            type="button"
            onClick={ir(p.onOpenSettings)}
            aria-label="Abrir ajustes"
            className="raise mr-8 flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground"
          >
            <Settings className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {grupos.map((g) => (
            <section key={g.titulo} className="mt-3">
              <h3 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {g.titulo}
              </h3>
              <div className={cn("grid gap-2", g.cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
                {g.items.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    aria-label={t.label}
                    onClick={t.onClick}
                    className="raise relative flex min-w-0 flex-col items-start gap-1.5 rounded-2xl border border-border/60 bg-card p-2.5 text-left"
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-xl"
                      style={{
                        color: t.color,
                        background: `color-mix(in srgb, ${t.color} 16%, transparent)`,
                      }}
                    >
                      {t.icon}
                    </span>
                    <span className="block w-full min-w-0">
                      <span className="block truncate text-[13px] font-semibold leading-tight">{t.label}</span>
                      <span className="block truncate text-[11px] leading-tight text-muted-foreground">{t.hint}</span>
                    </span>
                    {!!t.badge && t.badge > 0 && (
                      <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                        {t.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="border-t border-border/60 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2.5">
          <div className="mb-1.5 flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
            <InstallButton compact />
          </div>
          <ThemeSegmented />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Sin cuentas · solo en tu dispositivo</p>
          <VersionLine />
        </div>
      </SheetContent>
    </Sheet>
  );
}
