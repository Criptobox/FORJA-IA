"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowRight, CheckCircle2, CircleAlert, Code2, Gauge,
  LockKeyhole, Play, Plus, RefreshCw, Rocket, ScanSearch, ShieldCheck,
  Sparkles, Terminal, Trash2
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ProjectMap } from "@/lib/forja/types";
import { buildWebStudioPrompt, WEB_STUDIO_STAGES } from "@/lib/forja/web-studio";
import { calculateProjectHealth, type ProjectHealth } from "@/lib/forja/project-health";
import { scanSecurity, type SecurityReport } from "@/lib/forja/security-center";
import { useProjectTasks } from "@/lib/forja/project-tasks";
import { useFailures } from "@/lib/forja/failures";
import { injectVisualQA, runVisualQA, QA_WIDTHS, type QAResult } from "@/lib/forja/visual-qa";

function Score({ value }: { value: number | null }) {
  return <span className={cn("font-mono text-2xl font-semibold", value == null ? "text-muted-foreground" : value >= 85 ? "text-emerald-500" : value >= 65 ? "text-amber-500" : "text-red-500")}>{value == null ? "—" : value}</span>;
}

export function ForjaStudioDialog({
  open, onOpenChange, map, html, onStart, onRunVisualQA
}: {
  open: boolean; onOpenChange: (open: boolean) => void;
  map?: ProjectMap | null; html?: string | null;
  onStart?: (prompt: string) => void;
  /** Si la vista previa en vivo está montada, mide SU iframe (postura del
   *  usuario y JS ya en marcha) en vez de crear uno oculto aparte y volver a
   *  ejecutar la página desde cero. Cuando no hay vista previa abierta,
   *  runQA cae al iframe propio de este diálogo. */
  onRunVisualQA?: () => Promise<QAResult[]>;
}) {
  const [brief, setBrief] = useState("");
  const [direction, setDirection] = useState("");
  const [stage, setStage] = useState<"brief"|"plan"|"build"|"qa"|"fix"|"regression"|"publish">("brief");
  const [qa, setQa] = useState<QAResult[] | null>(null);
  const [qaRunning, setQaRunning] = useState(false);
  const [security, setSecurity] = useState<SecurityReport | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const tasks = useProjectTasks();
  const failures = useFailures((s) => s.entries);

  const health: ProjectHealth = useMemo(
    () => calculateProjectHealth({ map, qa, failures, html }),
    [map, qa, failures, html]
  );

  const runQA = async () => {
    if (!html) return;
    setQaRunning(true);
    try {
      // Vacío = la vista previa en vivo no está montada (el usuario la
      // cerró, o nunca la abrió): cae al iframe propio de este diálogo en
      // vez de dejar el QA sin resultado.
      let r = onRunVisualQA ? await onRunVisualQA() : [];
      if (!r.length) r = await runVisualQA(frame.current, QA_WIDTHS);
      setQa(r);
      const bad = r.filter(x => !x.noRespondio && !x.ok).flatMap(x => x.items.map(i => `Visual QA ${x.width}px: ${i.detalle}`));
      bad.slice(0, 8).forEach(item => tasks.add(item, "qa"));
      setStage("qa");
    } finally { setQaRunning(false); }
  };

  const doSecurity = () => {
    const report = scanSecurity(html ?? "");
    setSecurity(report);
    report.findings.filter(f => f.severity !== "low").slice(0, 8).forEach(f => tasks.add(`Security: ${f.detail}`, "system"));
  };
  const startWebStudio = () => {
    const prompt = buildWebStudioPrompt({
      brief: brief || "Construye o mejora la interfaz web del proyecto actual según el contexto disponible.",
      visualDirection: direction,
      useExistingProject: true,
    });
    onStart?.(prompt);
    setStage("plan");
    onOpenChange(false);
  };

  const todo = tasks.tasks.filter(t => t.status === "todo");
  const doing = tasks.tasks.filter(t => t.status === "doing");
  const done = tasks.tasks.filter(t => t.status === "done");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(1120px,96vw)] overflow-hidden border-border/70 bg-background/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><Sparkles className="size-5 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <DialogTitle>Forja Web Studio</DialogTitle>
              <DialogDescription>Construye → ejecuta → mide → corrige → publica. Con evidencia cuando exista.</DialogDescription>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[10px] font-medium">LOCAL-FIRST</span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-medium text-emerald-500">VERIFICABLE</span>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-5">
          <div className="mb-5 grid gap-3 md:grid-cols-[1.6fr_1fr]">
            <div className="min-w-0 rounded-2xl border border-border/60 bg-card/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-xs font-medium text-muted-foreground">Workflow</p><p className="text-sm font-semibold">Proyecto → resultado</p></div>
                <span className="font-mono text-[10px] text-muted-foreground">{stage.toUpperCase()}</span>
              </div>
              {/* min-w-0 en el padre de arriba es lo que deja que ESTA fila
                  se quede dentro del ancho del diálogo en móvil: sin él, un
                  hijo grid/flex no se encoge por debajo del contenido de sus
                  descendientes aunque tengan overflow-x-auto, y los 7 botones
                  de etapa empujaban todo el diálogo fuera de la pantalla. */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {WEB_STUDIO_STAGES.map((s, i) => (
                  <button key={s.id} onClick={() => setStage(s.id)} className={cn("flex min-w-max items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] transition", stage === s.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                    {i > 0 && <ArrowRight className="size-3 opacity-40" />}{s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-border/60 bg-card/60 p-4">
              <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Project Health</p><p className="text-sm font-semibold">Solo evidencia disponible</p></div><Score value={health.score} /></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">{health.score != null && <div className={cn("h-full rounded-full", health.score >= 85 ? "bg-emerald-500" : health.score >= 65 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${health.score}%` }} />}</div>
            </div>
          </div>

          <Tabs defaultValue="studio">
            {/* text-[11px] y px-1: con las cuatro en una fila («Web Studio»
                es la más larga) el tamaño de fuente de por defecto de Tabs
                (text-sm) las dejaba pegadas sin separación visible en
                320-390px. */}
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="studio" className="px-1 text-[11px]">Web Studio</TabsTrigger>
              <TabsTrigger value="health" className="px-1 text-[11px]">Health</TabsTrigger>
              <TabsTrigger value="security" className="px-1 text-[11px]">Security</TabsTrigger>
              <TabsTrigger value="tasks" className="px-1 text-[11px]">Tasks</TabsTrigger>
            </TabsList>

            <TabsContent value="studio" className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <div className="mb-3 flex items-center gap-2"><Code2 className="size-4 text-primary" /><h3 className="text-sm font-semibold">Brief del trabajo</h3></div>
                  <Input value={brief} onChange={e => setBrief(e.target.value)} placeholder="Ej.: mejora el hero sin cambiar la identidad…" className="mb-3" />
                  <Input value={direction} onChange={e => setDirection(e.target.value)} placeholder="Dirección visual opcional: premium, sobrio…" />
                  <Button onClick={startWebStudio} className="mt-3 w-full gap-2"><Play className="size-4" />Iniciar con agente</Button>
                  <p className="mt-2 text-[10px] text-muted-foreground">El prompt obliga a inspeccionar primero y a declarar pruebas reales.</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <div className="mb-3 flex items-center gap-2"><ScanSearch className="size-4 text-primary" /><h3 className="text-sm font-semibold">Visual QA</h3></div>
                  <p className="text-xs text-muted-foreground">Mide el DOM real de la vista previa en los anchos que Forja ya utiliza.</p>
                  <Button variant="outline" disabled={!html || qaRunning} onClick={runQA} className="mt-4 w-full gap-2">{qaRunning ? <RefreshCw className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}{qaRunning ? "Midiendo…" : "Ejecutar Visual QA"}</Button>
                  {!html && <p className="mt-2 text-[10px] text-muted-foreground">Abre una vista previa primero.</p>}
                </div>
              </div>
              {qa && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{qa.map(r => <div key={r.width} className="rounded-xl border border-border/60 p-3"><div className="flex justify-between text-xs"><b>{r.width}px</b>{r.noRespondio ? <span className="text-muted-foreground">sin dato</span> : r.ok ? <span className="text-emerald-500">PASS</span> : <span className="text-red-500">{r.items.length} hallazgo(s)</span>}</div>{r.items.slice(0,2).map((x,i)=><p key={i} className="mt-1 text-[10px] text-muted-foreground">{x.tipo}: {x.detalle}</p>)}</div>)}</div>}
              <iframe
                ref={frame}
                title="Forja QA"
                className="pointer-events-none absolute -left-[99999px] h-1 w-1 opacity-0"
                srcDoc={html ? injectVisualQA(html) : ""}
                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock"
              />
            </TabsContent>

            <TabsContent value="health" className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {health.metrics.map(m => <div key={m.id} className="rounded-2xl border border-border/60 bg-card/50 p-4"><div className="flex items-center justify-between"><span className="text-sm font-medium">{m.label}</span><Score value={m.score} /></div><p className="mt-1 text-xs text-muted-foreground">{m.detail}</p></div>)}
              </div>
              <div className="mt-4 rounded-2xl border border-border/60 bg-card/50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><CircleAlert className="size-4 text-amber-500" />Bloqueos / pendientes verificados</div>
                {health.blockers.length ? <ul className="mt-2 space-y-1">{health.blockers.map((b,i)=><li key={i} className="text-xs text-muted-foreground">• {b}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-500">No hay bloqueos detectados con la evidencia disponible.</p>}
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-4">
              <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><div><p className="text-sm font-semibold">Security Center</p><p className="text-[11px] text-muted-foreground">Análisis estático conservador del código visible</p></div></div><Score value={security?.score ?? null} /></div>
                <Button variant="outline" onClick={doSecurity} className="mt-4 gap-2"><LockKeyhole className="size-4" />Analizar código</Button>
                {security && <div className="mt-4 space-y-2">{security.findings.length ? security.findings.map((f,i)=><div key={i} className="rounded-xl border border-border/60 p-3"><div className="flex items-center gap-2 text-xs font-semibold"><span className={cn("rounded px-1.5 py-0.5 text-[9px]", f.severity==="high" ? "bg-red-500/10 text-red-500" : f.severity==="medium" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground")}>{f.severity}</span>{f.rule}</div><p className="mt-1 text-xs text-muted-foreground">{f.detail}</p><code className="mt-2 block truncate rounded bg-muted/50 p-2 text-[10px]">{f.evidence}</code></div>) : <p className="text-sm text-emerald-500">No se detectaron estos patrones básicos.</p>}<p className="mt-3 text-[10px] text-muted-foreground">{security.disclaimer}</p></div>}
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <Input
                  id="forja-task-input"
                  placeholder="Nueva tarea…"
                  className="min-w-0 flex-1 basis-40"
                  onKeyDown={e => { if(e.key==="Enter"){ const v=e.currentTarget.value; tasks.add(v); e.currentTarget.value=""; }}}
                />
                <Button onClick={() => { const el=document.getElementById("forja-task-input") as HTMLInputElement | null; if(el){tasks.add(el.value);el.value="";}}}><Plus className="size-4" /></Button>
                <Button variant="outline" onClick={tasks.clearDone}>Limpiar hechas</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {(
                  [
                    ["todo", "Pendientes", todo],
                    ["doing", "En curso", doing],
                    ["done", "Hechas", done],
                  ] as const
                ).map(([status, label, list]) => (
                  <div key={status} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                    <p className="mb-2 text-xs font-semibold">
                      {label} <span className="text-muted-foreground">({list.length})</span>
                    </p>
                    <div className="space-y-2">
                      {list.slice(0, 20).map((t) => (
                        <div key={t.id} className="rounded-xl border border-border/60 p-2.5">
                          <p className="text-xs">{t.title}</p>
                          <div className="mt-2 flex gap-1">
                            {status !== "done" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => tasks.setStatus(t.id, status === "todo" ? "doing" : "done")}
                              >
                                <CheckCircle2 className="size-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => tasks.remove(t.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-5 grid gap-2 text-[10px] text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/50 p-2.5"><Gauge className="size-3.5" />Sin datos = sin puntuación inventada</div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 p-2.5"><Terminal className="size-3.5" />QA y seguridad se ejecutan localmente</div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 p-2.5"><Rocket className="size-3.5" />Publicación sigue bajo control del usuario</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
