"use client";
/** Forja IA — Hoja «Cerebro» (pestaña del móvil): lo que Forja sabe del
 * proyecto, en un sitio.
 *
 *  · Mapa del proyecto: los archivos de la conversación como un grafo
 *    (`lib/forja/cerebro.ts`). Toca un nodo y ves qué usa y quién lo usa;
 *    «Preguntar por este archivo» lo pone en el compositor. Es el mismo grafo
 *    con el que Forja decide qué archivos manda al modelo en cada turno.
 *    También mapea un repo de GitHub: se descarga entero en una sola petición
 *    (el mismo zipball que usa «Todo el repo al Sandbox») y se dibujan sus
 *    archivos más conectados.
 *  · Memoria: decisiones, errores y reglas que ya guarda la app.
 *  · Conocimiento: la base de documentos propia.
 */
import { useEffect, useMemo, useState } from "react";
import { Brain, ChevronRight, Database, FolderGit2, Loader2, MessageSquarePlus, Network } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  disponerMapa,
  mapaDeArchivos,
  mapaDelProyecto,
  preguntaSobre,
  recortarMapa,
  TIPOS,
  type MapaProyecto,
  type NodoMapa,
} from "@/lib/forja/cerebro";
import { ghGetToken, ghListRepos, type GhRepoItem } from "@/lib/forja/github-upload";
import { fetchRepoInfo, fetchRepoZip, parseRepoInput } from "@/lib/forja/repo-cloud";
import { leerMemoria } from "@/lib/forja/memoria-proyecto";
import { cn } from "@/lib/utils";
import { Chispa } from "./chispa";

const ANCHO = 340;
/** El lienzo crece con el número de archivos para que quepan sus nombres. */
const altoPara = (n: number) => Math.min(720, Math.max(300, n * 22));
/** Archivos que se dibujan de un repo (los más conectados). */
const MAX_NODOS_REPO = 24;
/** Último repo mapeado: comodidad de este navegador, no dato del proyecto. */
const CLAVE_REPO = "forja-cerebro-repo";

const VACIO: MapaProyecto = { nodos: [], aristas: [] };

type Fuente = "chat" | "repo";
interface MapaRepo {
  nombre: string;
  mapa: MapaProyecto;
  total: number;
  omitidos: number;
}

export function CerebroSheet({
  open,
  onOpenChange,
  mensajes,
  sessionId,
  onPreguntar,
  onOpenMemoria,
  onOpenKnowledgeBase,
  onOpenRepos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensajes: readonly { role: string; content: string }[];
  sessionId: string | null;
  /** rellena el compositor con una pregunta sobre un archivo */
  onPreguntar: (texto: string) => void;
  onOpenMemoria: () => void;
  onOpenKnowledgeBase: () => void;
  /** abre Repos para conectar GitHub */
  onOpenRepos: () => void;
}) {
  const [fuente, setFuente] = useState<Fuente>("chat");
  const [elegido, setElegido] = useState<string | null>(null);
  const [repoMapa, setRepoMapa] = useState<MapaRepo | null>(null);
  const [repoTexto, setRepoTexto] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_REPO) ?? "";
    } catch {
      return "";
    }
  });
  const [misRepos, setMisRepos] = useState<GhRepoItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorRepo, setErrorRepo] = useState("");
  const token = open && fuente === "repo" ? ghGetToken() : "";

  // la lista de tus repos, para elegir sin teclear (solo con GitHub conectado)
  useEffect(() => {
    if (!token || misRepos.length) return;
    const ctl = new AbortController();
    ghListRepos(token, { signal: ctl.signal })
      .then(setMisRepos)
      .catch(() => {
        /* sin lista: se puede escribir owner/repo a mano */
      });
    return () => ctl.abort();
  }, [token, misRepos.length]);

  const mapear = async () => {
    const elegidoRepo = parseRepoInput(repoTexto);
    if (!elegidoRepo) {
      setErrorRepo("Escribe el repo como usuario/repo o pega su enlace de GitHub.");
      return;
    }
    if (!token) return;
    setCargando(true);
    setErrorRepo("");
    try {
      const deLista = misRepos.find(
        (r) => r.owner.toLowerCase() === elegidoRepo.owner.toLowerCase() && r.repo.toLowerCase() === elegidoRepo.repo.toLowerCase()
      );
      const rama = deLista?.defaultBranch ?? (await fetchRepoInfo(token, elegidoRepo.owner, elegidoRepo.repo)).defaultBranch;
      const { files, skipped } = await fetchRepoZip(token, elegidoRepo.owner, elegidoRepo.repo, rama);
      const completo = mapaDeArchivos(new Map(files.map((f) => [f.path, { text: f.content }])));
      const { mapa: recortado, total } = recortarMapa(completo, MAX_NODOS_REPO);
      const nombre = `${elegidoRepo.owner}/${elegidoRepo.repo}`;
      setRepoMapa({ nombre, mapa: recortado, total, omitidos: skipped });
      setElegido(null);
      try {
        localStorage.setItem(CLAVE_REPO, nombre);
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
    } catch (e) {
      setErrorRepo(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  };

  const mapaChat = useMemo(() => (open ? mapaDelProyecto(mensajes) : VACIO), [open, mensajes]);
  const mapa: MapaProyecto = useMemo(
    () => (fuente === "repo" ? (repoMapa?.mapa ?? VACIO) : mapaChat),
    [fuente, repoMapa, mapaChat]
  );
  const alto = altoPara(mapa.nodos.length);
  const pos = useMemo(() => disponerMapa(mapa, ANCHO, alto), [mapa, alto]);
  const nodo: NodoMapa | null = mapa.nodos.find((n) => n.id === elegido) ?? null;
  const memoria = useMemo(
    () => (open && sessionId ? leerMemoria(sessionId) : null),
    [open, sessionId]
  );
  const tiposUsados = [...new Set(mapa.nodos.map((n) => n.tipo))];
  // con muchas conexiones las líneas se aclaran para que se lean los nombres
  const denso = mapa.aristas.length > mapa.nodos.length * 1.5;
  // los archivos de los que depende todo (los que más se usan)
  const clave = useMemo(
    () =>
      [...mapa.nodos]
        .filter((n) => n.loUsan.length > 1)
        .sort((x, y) => y.loUsan.length - x.loUsan.length || x.id.localeCompare(y.id))
        .slice(0, 6),
    [mapa]
  );
  const vecinos = new Set(nodo ? [...nodo.usa, ...nodo.loUsan] : []);
  const ir = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 rounded-t-3xl border-border/60 p-0 lg:hidden">
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center gap-3 px-4 pb-1 pt-3">
          <Chispa estado="avatar" size={34} />
          <div className="min-w-0">
            <SheetTitle className="text-[15px]">Cerebro</SheetTitle>
            <SheetDescription className="text-[11.5px]">Lo que Forja sabe de tu proyecto</SheetDescription>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {/* ——— Mapa del proyecto ——— */}
          <section className="mt-3 rounded-2xl border border-border/60 bg-card p-3" aria-labelledby="cerebro-mapa">
            <div className="flex items-center justify-between gap-2">
              <h3 id="cerebro-mapa" className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Network className="size-4 text-forja-violet" /> Mapa del proyecto
              </h3>
              {mapa.nodos.length > 0 && (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {fuente === "repo" && repoMapa && repoMapa.total > mapa.nodos.length
                    ? `${mapa.nodos.length} de ${repoMapa.total} archivos`
                    : `${mapa.nodos.length} archivo${mapa.nodos.length === 1 ? "" : "s"}`}{" "}
                  · {mapa.aristas.length} conexi{mapa.aristas.length === 1 ? "ón" : "ones"}
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1" role="radiogroup" aria-label="Qué mapear">
              {(
                [
                  ["chat", "Esta conversación"],
                  ["repo", "Un repo de GitHub"],
                ] as const
              ).map(([id, texto]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={fuente === id}
                  onClick={() => {
                    setFuente(id);
                    setElegido(null);
                  }}
                  className={cn(
                    "min-h-9 rounded-lg text-[12.5px] font-medium transition",
                    fuente === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {texto}
                </button>
              ))}
            </div>

            {fuente === "repo" && (
              <div className="mt-2.5" data-testid="cerebro-repo">
                {!token ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-center">
                    <p className="text-[12.5px]">Conecta GitHub para mapear tus repos.</p>
                    <button
                      type="button"
                      onClick={ir(onOpenRepos)}
                      className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[12.5px] font-medium"
                    >
                      <FolderGit2 className="size-3.5" /> Conectar en Repos
                    </button>
                  </div>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void mapear();
                    }}
                  >
                    <label className="sr-only" htmlFor="cerebro-repo-input">
                      Repositorio
                    </label>
                    <input
                      id="cerebro-repo-input"
                      list="cerebro-mis-repos"
                      value={repoTexto}
                      onChange={(e) => setRepoTexto(e.target.value)}
                      placeholder="usuario/repo"
                      autoComplete="off"
                      className="min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-forja-violet/40"
                    />
                    <datalist id="cerebro-mis-repos">
                      {misRepos.map((r) => (
                        <option key={r.fullName} value={r.fullName} />
                      ))}
                    </datalist>
                    <button
                      type="submit"
                      disabled={cargando || !repoTexto.trim()}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#fb923c,#f97316_45%,#ef4444)] px-3.5 text-[12.5px] font-medium text-white disabled:opacity-50"
                    >
                      {cargando ? <Loader2 className="size-3.5 animate-spin" /> : <Network className="size-3.5" />} Mapear
                    </button>
                  </form>
                )}
                {errorRepo && (
                  <p role="alert" className="mt-1.5 text-[12px] text-destructive">
                    {errorRepo}
                  </p>
                )}
                {repoMapa && !cargando && (
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    {repoMapa.nombre}
                    {repoMapa.total > repoMapa.mapa.nodos.length && ` · se ven los ${repoMapa.mapa.nodos.length} más conectados`}
                    {repoMapa.omitidos > 0 && ` · ${repoMapa.omitidos} binarios o muy grandes fuera`}
                  </p>
                )}
              </div>
            )}

            {cargando ? (
              <div className="flex flex-col items-center py-5 text-center">
                <Chispa estado="forjando" size={70} />
                <p className="mt-2 text-[13px] font-medium">Leyendo el repo…</p>
              </div>
            ) : fuente === "repo" && !repoMapa ? null : mapa.nodos.length === 0 ? (
              <div className="flex flex-col items-center py-5 text-center" data-testid="cerebro-vacio">
                <Chispa estado="inicio" size={70} />
                <p className="mt-2 text-[13px] font-medium">Aún no hay nada que mapear</p>
                <p className="mt-0.5 max-w-[16rem] text-[12px] text-muted-foreground">
                  {fuente === "repo"
                    ? "Este repo no tiene archivos de texto que mapear."
                    : "Cuando Forja cree archivos en esta conversación, aquí verás cómo se conectan entre sí."}
                </p>
              </div>
            ) : (
              <>
                <svg
                  viewBox={`0 0 ${ANCHO} ${alto}`}
                  className="mt-2 block h-auto w-full touch-manipulation rounded-xl bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--forja-violet)_8%,transparent),transparent_70%)]"
                  role="group"
                  aria-label="Mapa de archivos del proyecto"
                  data-testid="cerebro-mapa"
                >
                  <defs>
                    <marker id="cerebro-flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M0 0 L10 5 L0 10 z" fill="currentColor" className="text-muted-foreground" />
                    </marker>
                  </defs>
                  {mapa.aristas.map((e) => {
                    const p = pos.get(e.de);
                    const q = pos.get(e.a);
                    if (!p || !q) return null;
                    // la línea acaba en el borde del círculo, no en su centro
                    const dx = q.x - p.x;
                    const dy = q.y - p.y;
                    const d = Math.max(1, Math.hypot(dx, dy));
                    const activa = !!nodo && (e.de === nodo.id || e.a === nodo.id);
                    return (
                      <line
                        key={`${e.de}>${e.a}`}
                        x1={p.x + (dx / d) * 14}
                        y1={p.y + (dy / d) * 14}
                        x2={q.x - (dx / d) * 16}
                        y2={q.y - (dy / d) * 16}
                        stroke="currentColor"
                        strokeWidth={activa ? 2 : denso ? 0.8 : 1.2}
                        className={activa ? "text-forja-violet" : denso ? "text-muted-foreground/25" : "text-muted-foreground/50"}
                        markerEnd="url(#cerebro-flecha)"
                      />
                    );
                  })}
                  {mapa.nodos.map((n) => {
                    const p = pos.get(n.id);
                    if (!p) return null;
                    const sel = n.id === elegido;
                    const atenuado = !!nodo && !sel && !vecinos.has(n.id);
                    return (
                      <g
                        key={n.id}
                        transform={`translate(${p.x} ${p.y})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Archivo ${n.id}`}
                        aria-pressed={sel}
                        onClick={() => setElegido(sel ? null : n.id)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            setElegido(sel ? null : n.id);
                          }
                        }}
                        className="cursor-pointer outline-none"
                        style={{ opacity: atenuado ? 0.35 : 1 }}
                      >
                        <circle r={sel ? 15 : 12} fill={TIPOS[n.tipo].color} opacity={0.18} />
                        <circle r={sel ? 9 : 7} fill={TIPOS[n.tipo].color} stroke="var(--card)" strokeWidth={2} />
                        <text y={24} textAnchor="middle" className="fill-foreground text-[9.5px] font-medium">
                          {n.nombre.length > 18 ? `${n.nombre.slice(0, 17)}…` : n.nombre}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {tiposUsados.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: TIPOS[t].color }} />
                      {TIPOS[t].nombre}
                    </span>
                  ))}
                </div>

                {clave.length >= 2 && (
                  <div className="mt-2.5" data-testid="cerebro-clave">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Los que más se usan</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {clave.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          aria-pressed={n.id === elegido}
                          onClick={() => setElegido(n.id === elegido ? null : n.id)}
                          title={n.id}
                          className={cn(
                            "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[12px]",
                            n.id === elegido ? "border-forja-violet bg-forja-violet/10" : "border-border/60 bg-card"
                          )}
                        >
                          <span className="size-2 shrink-0 rounded-full" style={{ background: TIPOS[n.tipo].color }} />
                          <span className="truncate">{n.nombre}</span>
                          <span className="tabular-nums text-muted-foreground">{n.loUsan.length}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {nodo ? (
                  <div className="mt-2.5 rounded-xl border border-border/60 bg-muted/40 p-2.5" data-testid="cerebro-nodo">
                    <p className="truncate font-mono text-[12.5px] font-semibold">{nodo.id}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {TIPOS[nodo.tipo].nombre} · {nodo.caracteres.toLocaleString("es")} caracteres
                    </p>
                    <dl className="mt-1.5 space-y-0.5 text-[12px]">
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-muted-foreground">Usa:</dt>
                        <dd className="min-w-0 truncate">{lista(nodo.usa, "nada")}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-muted-foreground">Lo usan:</dt>
                        <dd className="min-w-0 truncate">{lista(nodo.loUsan, "nadie")}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={ir(() =>
                        onPreguntar(
                          fuente === "repo" && repoMapa ? `En el repo ${repoMapa.nombre}, ${preguntaSobre(nodo).replace(/^Sobre/, "sobre")}` : preguntaSobre(nodo)
                        )
                      )}
                      className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#fb923c,#f97316_45%,#ef4444)] px-3.5 text-[12.5px] font-medium text-white shadow-sm"
                    >
                      <MessageSquarePlus className="size-3.5" /> Preguntar por este archivo
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    Toca un archivo para ver qué usa y quién lo usa. Cada línea sale del propio código: cuando pides un cambio,
                    Forja solo le manda al modelo los archivos conectados con lo que pides.
                  </p>
                )}
              </>
            )}
          </section>

          {/* ——— Memoria y conocimiento ——— */}
          <div className="mt-2.5 grid gap-2">
            <FilaCerebro
              icono={<Brain className="size-5" />}
              color="#f97316"
              titulo="Memoria del proyecto"
              detalle={
                memoria
                  ? `${memoria.decisiones.length} decisiones · ${memoria.errores.length} errores · ${memoria.reglas.length} reglas`
                  : "Decisiones, errores y reglas que recuerda"
              }
              onClick={ir(onOpenMemoria)}
            />
            <FilaCerebro
              icono={<Database className="size-5" />}
              color="#14b8a6"
              titulo="Base de conocimiento"
              detalle="Tus documentos, repos y Drive para consultar"
              onClick={ir(onOpenKnowledgeBase)}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** «a, b» o, si son muchos, «12 archivos: a, b, c…» (la fila se recorta). */
function lista(rutas: readonly string[], vacio: string): string {
  if (!rutas.length) return vacio;
  const nombres = rutas.map((r) => r.split("/").pop() || r);
  return rutas.length > 3 ? `${rutas.length} archivos: ${nombres.join(", ")}` : rutas.join(", ");
}

function FilaCerebro(p: { icono: React.ReactNode; color: string; titulo: string; detalle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      className={cn("raise flex min-h-14 items-center gap-3 rounded-2xl border border-border/60 bg-card p-2.5 text-left")}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ color: p.color, background: `color-mix(in srgb, ${p.color} 16%, transparent)` }}
      >
        {p.icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold leading-tight">{p.titulo}</span>
        <span className="block truncate text-[11.5px] text-muted-foreground">{p.detalle}</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}
