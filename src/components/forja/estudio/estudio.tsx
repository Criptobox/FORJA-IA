"use client";
/** FORJA IA — Estudio de diseño (tipo Stitch, a nuestra medida).
 *
 * Proyecto = varias pantallas con UN sistema de diseño. Se planifican, se
 * generan de una en una con modelos gratis (cadena Auto con failover) y se
 * ven juntas en un lienzo con marcos de dispositivo. Cada pantalla se itera
 * con lenguaje natural, se critica con el motor (anti-genérico + auditoría),
 * guarda sus versiones y se descarga sola o todo el proyecto en ZIP. */

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  BookImage,
  Code2,
  Columns2,
  Download,
  FileArchive,
  ImageDown,
  Images,
  Loader2,
  Maximize2,
  Monitor,
  Plus,
  RefreshCw,
  Shuffle,
  Smartphone,
  Sparkles,
  Square,
  Tablet,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Chip } from "@/components/forja/ui-forja";
import { cn } from "@/lib/utils";
import { DIRECCIONES, type DireccionVisual } from "@/lib/forja/design-directions";
import { AUTO_MODEL_KEY } from "@/lib/forja/types";
import { nombreDescarga } from "@/lib/forja/answer-files";
import { useEstudio, proyectoActivo } from "@/lib/forja/estudio/store";
import { useGenerar } from "@/lib/forja/estudio/use-generar";
import { modelosDisponibles } from "@/lib/forja/estudio/generador";
import {
  agregarPantallas,
  cambiarDireccion,
  conReferencias,
  direccionDe,
  elegirVersion,
  eliminarPantalla,
  moverPantalla,
  actualizarPantalla,
  slug,
  versionActual,
} from "@/lib/forja/estudio/proyecto";
import { htmlDeVersion } from "@/lib/forja/estudio/html";
import { criticar, problemasParaCorregir } from "@/lib/forja/estudio/critica";
import { alternarSkill, MAX_SKILLS_PANTALLA, ORIGEN_SKILLS, SKILLS_PANTALLA, skillsDePantalla } from "@/lib/forja/estudio/skills";
import { zipProyecto } from "@/lib/forja/estudio/exportar";
import { capturarPng, dataUrlABytes } from "@/lib/forja/estudio/captura";
import { SelectorReferencias, VistaBiblioteca, ChipsReferencias, guardarEnBiblioteca } from "./biblioteca";
import { SelectorEstilo } from "./selector-estilo";
import type { Dispositivo, Pantalla, PantallaPlan, ProyectoDiseno, TipoProyecto, VersionPantalla } from "@/lib/forja/estudio/tipos";

/* ------------------------------ utilidades ------------------------------ */

const DISPOSITIVOS: Record<Dispositivo, { ancho: number; alto: number; base: number; nombre: string; Icono: typeof Monitor }> = {
  movil: { ancho: 390, alto: 844, base: 230, nombre: "Móvil", Icono: Smartphone },
  tablet: { ancho: 768, alto: 1024, base: 320, nombre: "Tablet", Icono: Tablet },
  escritorio: { ancho: 1280, alto: 800, base: 420, nombre: "Escritorio", Icono: Monitor },
};

function descargar(nombre: string, data: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([data], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function nombreModelo(key: string | undefined | null): string {
  if (!key) return "";
  if (key === AUTO_MODEL_KEY) return "Auto (gratis)";
  const i = key.indexOf("::");
  return i < 0 ? key : `${key.slice(i + 2)} · ${key.slice(0, i)}`;
}

function Muestras({ d, className }: { d: DireccionVisual; className?: string }) {
  const p = d.paleta;
  return (
    <span className={cn("inline-flex overflow-hidden rounded-full border border-border/60", className)} aria-hidden>
      {[p.fondo, p.superficie, p.texto, p.acento, p.acento2].map((c, i) => (
        <span key={i} className="size-3.5" style={{ background: c }} />
      ))}
    </span>
  );
}

/** Selector de modelo: Auto (cadena gratis con failover) o uno concreto. */
function SelectorModelo({ valor, onCambio }: { valor: string; onCambio: (k: string) => void }) {
  // Solo se monta en el cliente (ver `Estudio`): las claves ya están cargadas.
  const [lista] = useState<string[]>(() => modelosDisponibles());
  return (
    <select
      aria-label="Modelo"
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      className="h-8 max-w-[220px] rounded-lg border border-border/60 bg-background px-2 text-[12px]"
    >
      <option value={AUTO_MODEL_KEY}>Auto · el mejor gratis con failover</option>
      {lista.map((k) => (
        <option key={k} value={k}>
          {nombreModelo(k)}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------ marco de pantalla ------------------------------ */

function Marco({ html, dispositivo, ancho, vivo }: { html: string; dispositivo: Dispositivo; ancho: number; vivo?: boolean }) {
  const dim = DISPOSITIVOS[dispositivo];
  const escala = ancho / dim.ancho;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white shadow-sm ring-1 ring-border/70",
        dispositivo === "movil" ? "rounded-[22px]" : "rounded-lg"
      )}
      style={{ width: ancho, height: dim.alto * escala }}
    >
      {html ? (
        <iframe
          title="Pantalla"
          srcDoc={html}
          sandbox="allow-scripts allow-forms"
          className="pointer-events-none origin-top-left border-0"
          style={{ width: dim.ancho, height: dim.alto, transform: `scale(${escala})` }}
          tabIndex={-1}
        />
      ) : null}
      {vivo && <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 animate-pulse bg-orange-500" />}
    </div>
  );
}

/* ------------------------------ inicio: proyectos + nuevo ------------------------------ */

type Generador = ReturnType<typeof useGenerar>;

function InicioEstudio({ modelo, setModelo, gen }: { modelo: string; setModelo: (k: string) => void; gen: Generador }) {
  const proyectos = useEstudio((s) => s.proyectos);
  const crear = useEstudio((s) => s.crear);
  const cambiar = useEstudio((s) => s.cambiar);
  const abrir = useEstudio((s) => s.abrir);
  const borrar = useEstudio((s) => s.borrar);
  const { planificar, generar, ocupado } = gen;

  const [brief, setBrief] = useState("");
  const [tipo, setTipo] = useState<TipoProyecto>("app");
  const [direccion, setDireccion] = useState<string | null>(null);
  const [plan, setPlan] = useState<PantallaPlan[] | null>(null);
  const [aBorrar, setABorrar] = useState<string | null>(null);
  const [refs, setRefs] = useState<string[]>([]);
  const [vista, setVista] = useState<"proyectos" | "biblioteca">("proyectos");

  const pedirPlan = async () => {
    if (!brief.trim()) return toast.error("Describe qué quieres diseñar");
    try {
      setPlan(await planificar(brief, tipo));
    } catch (e) {
      toast.error("No se pudo planificar", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const crearYGenerar = (pantallas: PantallaPlan[]) => {
    const limpias = pantallas.filter((p) => p.nombre.trim());
    if (!limpias.length) return toast.error("Añade al menos una pantalla");
    const p = crear({ brief, tipo, direccionId: direccion, referencias: refs });
    cambiar(p.id, (x) => agregarPantallas(x, limpias));
    const ids = useEstudio.getState().proyectos.find((x) => x.id === p.id)?.pantallas.map((s) => s.id) ?? [];
    abrir(p.id);
    void generar(p.id, ids);
  };

  const pestanas = (
    <div className="inline-flex rounded-xl border border-border/60 p-0.5" role="tablist" aria-label="Estudio">
      {(
        [
          ["proyectos", "Proyectos", Sparkles],
          ["biblioteca", "Biblioteca", Images],
        ] as const
      ).map(([id, nombre, Icono]) => (
        <button
          key={id}
          role="tab"
          aria-selected={vista === id}
          onClick={() => setVista(id)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px]",
            vista === id ? "bg-orange-500 text-white" : "text-muted-foreground"
          )}
        >
          <Icono className="size-3.5" /> {nombre}
        </button>
      ))}
    </div>
  );

  if (vista === "biblioteca")
    return (
      <div className="space-y-4">
        {pestanas}
        <VistaBiblioteca />
      </div>
    );

  return (
    <div className="space-y-6">
      {pestanas}
      <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight">¿Qué diseñamos?</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Describe el producto. FORJA propone las pantallas, fija un sistema de diseño y las genera coherentes entre sí.
        </p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="Ej.: app de reservas para una peluquería de barrio, con servicios, horarios y perfil del cliente"
          className="mt-3 w-full resize-y rounded-xl border border-border/60 bg-background p-3 text-[13.5px] outline-none focus:ring-2 focus:ring-orange-500/40"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/60 p-0.5" role="radiogroup" aria-label="Tipo">
            {(["app", "web"] as const).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={tipo === t}
                onClick={() => setTipo(t)}
                className={cn("rounded-md px-3 py-1 text-[12.5px]", tipo === t ? "bg-orange-500 text-white" : "text-muted-foreground")}
              >
                {t === "app" ? "App móvil" : "Web"}
              </button>
            ))}
          </div>
          <SelectorModelo valor={modelo} onCambio={setModelo} />
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-medium">Estilo</p>
          <SelectorEstilo direcciones={DIRECCIONES} valor={direccion} onCambio={setDireccion} />
        </div>

        <details className="mt-3 rounded-xl border border-border/60 px-3 py-2" open={refs.length > 0 || undefined}>
          <summary className="cursor-pointer text-[12px] font-medium">
            Referencias visuales{refs.length ? ` · ${refs.length} elegida${refs.length > 1 ? "s" : ""}` : " (opcional)"}
          </summary>
          <div className="mt-2">
            <SelectorReferencias elegidas={refs} onCambio={setRefs} />
          </div>
        </details>

        {!plan ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={pedirPlan} disabled={ocupado} className="gap-1.5">
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Planificar pantallas
            </Button>
            <Button
              variant="outline"
              onClick={() => crearYGenerar([{ nombre: tipo === "app" ? "Inicio" : "Inicio", proposito: "pantalla principal del producto" }])}
              disabled={!brief.trim() || ocupado}
            >
              Solo una pantalla
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-[12.5px] font-medium">Pantallas propuestas (puedes editarlas)</p>
            {plan.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={p.nombre}
                  onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  className="h-8 w-40 text-[12.5px]"
                  aria-label="Nombre de la pantalla"
                />
                <Input
                  value={p.proposito}
                  onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, proposito: e.target.value } : x)))}
                  className="h-8 flex-1 text-[12.5px]"
                  aria-label="Para qué sirve"
                />
                <Button size="icon" variant="ghost" aria-label="Quitar" onClick={() => setPlan(plan.filter((_, j) => j !== i))}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setPlan([...plan, { nombre: "", proposito: "" }])}>
                <Plus className="size-3.5" /> Pantalla
              </Button>
              <Button size="sm" onClick={() => crearYGenerar(plan)} className="gap-1.5">
                <Sparkles className="size-3.5" /> Crear y generar {plan.filter((p) => p.nombre.trim()).length}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPlan(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </section>

      {proyectos.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13.5px] font-semibold">Tus proyectos</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {proyectos.map((p) => {
              const d = direccionDe(p);
              const listas = p.pantallas.filter((s) => s.versiones.length).length;
              return (
                <div key={p.id} className="group rounded-2xl border border-border/60 bg-card/50 p-3">
                  <button className="block w-full text-left" onClick={() => abrir(p.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-semibold">{p.nombre}</span>
                      <Muestras d={d} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{p.brief}</p>
                    <p className="mt-2 text-[11.5px] text-muted-foreground">
                      {p.tipo === "app" ? "App" : "Web"} · {d.nombre} · {listas}/{p.pantallas.length} pantallas ·{" "}
                      {new Date(p.actualizado).toLocaleDateString()}
                    </p>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn("h-7 text-[11.5px]", aBorrar === p.id && "text-red-500")}
                      onClick={() => {
                        if (aBorrar !== p.id) {
                          setABorrar(p.id);
                          setTimeout(() => setABorrar((x) => (x === p.id ? null : x)), 3000);
                          return;
                        }
                        borrar(p.id);
                        toast.success("Proyecto borrado");
                      }}
                    >
                      <Trash2 className="size-3.5" /> {aBorrar === p.id ? "¿Seguro?" : "Borrar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------ editor del proyecto ------------------------------ */

function EditorProyecto({ proyecto, modelo, setModelo, gen }: { proyecto: ProyectoDiseno; modelo: string; setModelo: (k: string) => void; gen: Generador }) {
  const cambiar = useEstudio((s) => s.cambiar);
  const abrir = useEstudio((s) => s.abrir);
  const { generar, detener, ocupado, parciales, modelos } = gen;
  const d = direccionDe(proyecto);

  const [dispositivo, setDispositivo] = useState<Dispositivo>(proyecto.tipo === "app" ? "movil" : "escritorio");
  const [zoom, setZoom] = useState(1);
  const [selId, setSelId] = useState<string | null>(proyecto.pantallas[0]?.id ?? null);
  const [nueva, setNueva] = useState<PantallaPlan | null>(null);
  const [completa, setCompleta] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [comparar, setComparar] = useState<string | null>(null);
  const [verRefs, setVerRefs] = useState(false);

  const sel = proyecto.pantallas.find((s) => s.id === selId) ?? proyecto.pantallas[0] ?? null;
  const pendientes = proyecto.pantallas.filter((s) => s.estado === "vacia" || s.estado === "error");
  const cambio = (f: (p: ProyectoDiseno) => ProyectoDiseno) => cambiar(proyecto.id, f);

  const anadir = () => {
    if (!nueva?.nombre.trim()) return toast.error("Pon nombre a la pantalla");
    cambio((p) => agregarPantallas(p, [nueva]));
    const ultima = useEstudio.getState().proyectos.find((p) => p.id === proyecto.id)?.pantallas.at(-1);
    setNueva(null);
    if (ultima) {
      setSelId(ultima.id);
      void generar(proyecto.id, [ultima.id]);
    }
  };

  const [empaquetando, setEmpaquetando] = useState(false);
  const descargarZip = async (conImagenes: boolean) => {
    const listas = proyecto.pantallas.filter((s) => versionActual(s));
    if (!listas.length) return toast.error("Aún no hay pantallas generadas");
    const imagenes = new Map<string, Uint8Array>();
    if (conImagenes) {
      // de una en una: cada captura monta su propio iframe aislado
      setEmpaquetando(true);
      const dim = DISPOSITIVOS[dispositivo];
      const aviso = toast.loading(`Capturando 0/${listas.length}…`);
      let fallos = 0;
      for (const [i, s] of listas.entries()) {
        toast.loading(`Capturando ${i + 1}/${listas.length}: ${s.nombre}`, { id: aviso });
        const v = versionActual(s);
        if (!v) continue;
        try {
          imagenes.set(s.id, dataUrlABytes(await capturarPng(htmlDeVersion(v, d), dim.ancho, dim.alto)));
        } catch {
          fallos++;
        }
      }
      toast.dismiss(aviso);
      setEmpaquetando(false);
      if (fallos) toast.warning(`${fallos} pantalla${fallos > 1 ? "s" : ""} sin imagen (van solo en HTML)`);
    }
    const zip = zipProyecto(proyecto, imagenes);
    descargar(nombreDescarga(proyecto.nombre, "zip"), new Uint8Array(zip).buffer as ArrayBuffer, "application/zip");
  };
  const conVersion = proyecto.pantallas.filter((s) => s.versiones.length).map((s) => s.id);

  return (
    <div className="space-y-3">
      {/* barra del proyecto */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => abrir(null)} className="gap-1">
          <ArrowLeft className="size-3.5" /> Proyectos
        </Button>
        <Input
          value={proyecto.nombre}
          onChange={(e) => cambio((p) => ({ ...p, nombre: e.target.value, actualizado: Date.now() }))}
          aria-label="Nombre del proyecto"
          className="h-8 w-56 text-[13px] font-semibold"
        />
        <label className="flex items-center gap-1.5 text-[12px]">
          <Muestras d={d} />
          <select
            aria-label="Dirección visual"
            value={proyecto.direccionId}
            onChange={(e) => {
              cambio((p) => cambiarDireccion(p, e.target.value));
              toast("Estilo cambiado", { description: "Se aplica a lo que generes desde ahora. Regenera las pantallas para actualizarlas." });
            }}
            className="h-8 rounded-lg border border-border/60 bg-background px-2 text-[12px]"
          >
            {DIRECCIONES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
        </label>
        <SelectorModelo valor={modelo} onCambio={setModelo} />
        <Button size="sm" variant="outline" onClick={() => setVerRefs(true)} className="gap-1.5" title="Imágenes de la Biblioteca que guían el diseño">
          <ChipsReferencias ids={proyecto.referencias ?? []} />
          <Images className="size-3.5" /> Referencias{proyecto.referencias?.length ? ` (${proyecto.referencias.length})` : ""}
        </Button>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {ocupado ? (
            <Button size="sm" variant="outline" onClick={detener} className="gap-1.5">
              <Square className="size-3.5" /> Detener
            </Button>
          ) : (
            pendientes.length > 0 && (
              <Button size="sm" onClick={() => void generar(proyecto.id, pendientes.map((s) => s.id))} className="gap-1.5">
                <Sparkles className="size-3.5" /> Generar {pendientes.length} pendiente{pendientes.length > 1 ? "s" : ""}
              </Button>
            )
          )}
          <Button size="sm" variant="outline" onClick={() => void descargarZip(false)} disabled={empaquetando} className="gap-1.5">
            <FileArchive className="size-3.5" /> ZIP del proyecto
          </Button>
          <Button size="sm" variant="outline" onClick={() => void descargarZip(true)} disabled={empaquetando} className="gap-1.5" title="Incluye cada pantalla en PNG">
            {empaquetando ? <Loader2 className="size-3.5 animate-spin" /> : <ImageDown className="size-3.5" />} ZIP + imágenes
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)_320px]">
        {/* pantallas */}
        <aside className="min-w-0 rounded-2xl border border-border/60 bg-card/50 p-2" aria-label="Pantallas">
          {/* en el móvil, una fila que se desliza: el lienzo queda más arriba */}
          <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:block lg:space-y-1">
            {proyecto.pantallas.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <div
                  className={cn(
                    "group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px]",
                    sel?.id === s.id ? "bg-orange-500/10 text-foreground" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      s.estado === "lista" && "bg-emerald-500",
                      s.estado === "generando" && "animate-pulse bg-orange-500",
                      s.estado === "error" && "bg-red-500",
                      s.estado === "vacia" && "bg-muted-foreground/40"
                    )}
                    aria-label={s.estado}
                  />
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => setSelId(s.id)}>
                    {s.nombre}
                  </button>
                  {/* táctil: siempre visibles; con ratón, al pasar por encima */}
                  <span className="flex gap-0.5 lg:hidden lg:group-hover:flex">
                    <button aria-label="Subir" disabled={i === 0} onClick={() => cambio((p) => moverPantalla(p, s.id, -1))}>
                      <ArrowUp className="size-3.5 text-muted-foreground" />
                    </button>
                    <button aria-label="Bajar" disabled={i === proyecto.pantallas.length - 1} onClick={() => cambio((p) => moverPantalla(p, s.id, 1))}>
                      <ArrowDown className="size-3.5 text-muted-foreground" />
                    </button>
                    <button aria-label="Eliminar pantalla" onClick={() => cambio((p) => eliminarPantalla(p, s.id))}>
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {nueva ? (
            <div className="mt-2 space-y-1.5 rounded-lg border border-border/60 p-2">
              <Input autoFocus placeholder="Nombre" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className="h-7 text-[12px]" />
              <Input placeholder="Para qué sirve" value={nueva.proposito} onChange={(e) => setNueva({ ...nueva, proposito: e.target.value })} className="h-7 text-[12px]" onKeyDown={(e) => e.key === "Enter" && anadir()} />
              <div className="flex gap-1">
                <Button size="sm" className="h-7 flex-1 text-[11.5px]" onClick={anadir}>
                  Crear
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11.5px]" onClick={() => setNueva(null)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="mt-1 justify-start gap-1.5 text-[12px] lg:w-full" onClick={() => setNueva({ nombre: "", proposito: "" })}>
              <Plus className="size-3.5" /> Pantalla
            </Button>
          )}
        </aside>

        {/* lienzo */}
        <section className="min-w-0 rounded-2xl border border-border/60 bg-muted/30" aria-label="Lienzo">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
            <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5">
              {(Object.keys(DISPOSITIVOS) as Dispositivo[]).map((k) => {
                const { Icono, nombre } = DISPOSITIVOS[k];
                return (
                  <button
                    key={k}
                    aria-label={nombre}
                    title={nombre}
                    onClick={() => setDispositivo(k)}
                    className={cn("rounded-md p-1.5", dispositivo === k ? "bg-orange-500 text-white" : "text-muted-foreground")}
                  >
                    <Icono className="size-3.5" />
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
              Zoom
              <input type="range" min={0.5} max={1.6} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
              {Math.round(zoom * 100)}%
            </label>
          </div>
          {/* En el móvil, un carrusel: las pantallas una junto a otra, se pasan
              con el dedo y encajan al centro — sin un scroll vertical metido
              dentro del de la página. En escritorio, la cuadrícula de siempre. */}
          <div
            data-testid="lienzo-pantallas"
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain p-4 [scrollbar-width:none] lg:max-h-[calc(100dvh-220px)] lg:min-h-[420px] lg:snap-none lg:flex-wrap lg:content-start lg:gap-5 lg:overflow-auto"
          >
            {proyecto.pantallas.length === 0 && (
              <p className="m-auto text-[13px] text-muted-foreground">Añade una pantalla para empezar.</p>
            )}
            {proyecto.pantallas.map((s) => (
              <div key={s.id} className="shrink-0 snap-center">
              <TarjetaPantalla
                s={s}
                d={d}
                dispositivo={dispositivo}
                ancho={DISPOSITIVOS[dispositivo].base * zoom}
                seleccionada={sel?.id === s.id}
                parcial={parciales[s.id]}
                modelo={modelos[s.id]}
                onSeleccionar={() => setSelId(s.id)}
                onAbrir={() => setCompleta(s.id)}
                onGenerar={() => void generar(proyecto.id, [s.id])}
              />
              </div>
            ))}
          </div>
        </section>

        {/* panel de la pantalla elegida */}
        {sel ? (
          <PanelPantalla
            proyecto={proyecto}
            s={sel}
            d={d}
            ocupado={ocupado}
            onIterar={(t) => void generar(proyecto.id, [sel.id], { tipo: "iterar", cambio: t })}
            onVariante={() => void generar(proyecto.id, [sel.id], { tipo: "variante" })}
            onCorregir={(pr) => void generar(proyecto.id, [sel.id], { tipo: "corregir", problemas: pr })}
            onRegenerar={() => void generar(proyecto.id, [sel.id])}
            onCompleta={() => setCompleta(sel.id)}
            onCodigo={() => setCodigo(sel.id)}
            onComparar={() => setComparar(sel.id)}
            onRenombrar={(nombre, proposito) => cambio((p) => actualizarPantalla(p, sel.id, (x) => ({ ...x, nombre, proposito })))}
            onVersion={(i) => cambio((p) => actualizarPantalla(p, sel.id, (x) => elegirVersion(x, i)))}
            onSkills={(skills) => cambio((p) => actualizarPantalla(p, sel.id, (x) => ({ ...x, skills })))}
            dispositivo={dispositivo}
          />
        ) : (
          <div />
        )}
      </div>

      <DialogoCompleta
        key={`${completa}-${dispositivo}`}
        proyecto={proyecto}
        pantallaId={completa}
        onClose={() => setCompleta(null)}
        inicial={dispositivo}
        recorrido={conVersion}
        onIr={setCompleta}
      />
      <DialogoCodigo proyecto={proyecto} pantallaId={codigo} onClose={() => setCodigo(null)} />
      <DialogoComparar key={comparar ?? "cerrado"} proyecto={proyecto} pantallaId={comparar} onClose={() => setComparar(null)} dispositivo={dispositivo} />
      <Dialog open={verRefs} onOpenChange={setVerRefs}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Referencias del proyecto</DialogTitle>
            <DialogDescription>
              FORJA sigue su paleta en cada pantalla y, con modelos que ven imágenes, también su composición. Se aplica a lo que generes desde
              ahora.
            </DialogDescription>
          </DialogHeader>
          <SelectorReferencias elegidas={proyecto.referencias ?? []} onCambio={(ids) => cambio((p) => conReferencias(p, ids))} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TarjetaPantalla(props: {
  s: Pantalla;
  d: DireccionVisual;
  dispositivo: Dispositivo;
  ancho: number;
  seleccionada: boolean;
  parcial?: string;
  modelo?: string;
  onSeleccionar: () => void;
  onAbrir: () => void;
  onGenerar: () => void;
}) {
  const { s, d, dispositivo, ancho } = props;
  const v = versionActual(s);
  const html = useMemo(() => (v ? htmlDeVersion(v, d) : ""), [v, d]);
  const vivo = s.estado === "generando";
  const mostrar = vivo && props.parcial ? props.parcial : html;
  return (
    <figure className="flex flex-col gap-1.5" style={{ width: ancho }}>
      <figcaption className="flex items-center justify-between gap-2 text-[12px]">
        <button onClick={props.onSeleccionar} className={cn("truncate font-medium", props.seleccionada && "text-orange-600 dark:text-orange-400")}>
          {s.nombre}
        </button>
        {v && (
          <button aria-label="Pantalla completa" onClick={props.onAbrir} className="text-muted-foreground hover:text-foreground">
            <Maximize2 className="size-3.5" />
          </button>
        )}
      </figcaption>
      <div
        role="button"
        tabIndex={0}
        onClick={props.onSeleccionar}
        onDoubleClick={props.onAbrir}
        onKeyDown={(e) => e.key === "Enter" && props.onAbrir()}
        className={cn("relative rounded-[24px] outline-none", props.seleccionada && "ring-2 ring-orange-500 ring-offset-2 ring-offset-background")}
      >
        <Marco html={mostrar} dispositivo={dispositivo} ancho={ancho} vivo={vivo} />
        {!mostrar && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-[12px] text-muted-foreground">
            {vivo ? (
              <>
                <Loader2 className="size-5 animate-spin text-orange-500" />
                Diseñando…
                {props.modelo && <span className="text-[11px]">{nombreModelo(props.modelo)}</span>}
              </>
            ) : s.estado === "error" ? (
              <>
                <span className="text-red-500">{s.error ?? "Falló"}</span>
                <Button size="sm" variant="outline" onClick={(e) => (e.stopPropagation(), props.onGenerar())}>
                  <RefreshCw className="size-3.5" /> Reintentar
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={(e) => (e.stopPropagation(), props.onGenerar())}>
                <Sparkles className="size-3.5" /> Generar
              </Button>
            )}
          </div>
        )}
      </div>
      {vivo && props.modelo && mostrar && <span className="text-[11px] text-muted-foreground">{nombreModelo(props.modelo)}</span>}
    </figure>
  );
}

function PanelPantalla(props: {
  proyecto: ProyectoDiseno;
  s: Pantalla;
  d: DireccionVisual;
  ocupado: boolean;
  onIterar: (cambio: string) => void;
  onVariante: () => void;
  onCorregir: (problemas: string[]) => void;
  onRegenerar: () => void;
  onCompleta: () => void;
  onCodigo: () => void;
  onComparar: () => void;
  onRenombrar: (nombre: string, proposito: string) => void;
  onVersion: (i: number) => void;
  /** skills elegidas a mano; `undefined` = automáticas */
  onSkills: (skills: string[] | undefined) => void;
  dispositivo: Dispositivo;
}) {
  const { s, d } = props;
  const tipo = props.proyecto.tipo;
  const v = versionActual(s);
  const html = useMemo(() => (v ? htmlDeVersion(v, d) : ""), [v, d]);
  const skills = useMemo(() => skillsDePantalla(s, tipo), [s, tipo]);
  const critica = useMemo(() => (html ? criticar(html, skills, tipo) : null), [html, skills, tipo]);
  const [cambio, setCambio] = useState("");
  const enviar = () => {
    const t = cambio.trim();
    if (!t) return;
    props.onIterar(t);
    setCambio("");
  };
  const actual = s.actual >= 0 ? s.actual : s.versiones.length - 1;
  const [capturando, setCapturando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const aBiblioteca = async () => {
    const dim = DISPOSITIVOS[props.dispositivo];
    setGuardando(true);
    try {
      const url = await capturarPng(html, dim.ancho, dim.alto);
      const r = await guardarEnBiblioteca(url, `${props.proyecto.nombre} · ${s.nombre}`, "pantalla", props.proyecto.id);
      if (r) toast.success("Guardada en la Biblioteca", { description: "Úsala como referencia en otros proyectos." });
      else toast.error("El navegador no dejó guardar la imagen");
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(false);
    }
  };
  const bajarPng = async () => {
    const dim = DISPOSITIVOS[props.dispositivo];
    setCapturando(true);
    try {
      const url = await capturarPng(html, dim.ancho, dim.alto);
      descargar(`${slug(props.proyecto.nombre)}-${slug(s.nombre)}.png`, new Uint8Array(dataUrlABytes(url)).buffer as ArrayBuffer, "image/png");
    } catch (e) {
      toast.error("No se pudo hacer la imagen", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCapturando(false);
    }
  };

  return (
    <aside className="min-w-0 space-y-3 rounded-2xl border border-border/60 bg-card/50 p-3" aria-label="Pantalla seleccionada">
      <div className="space-y-1.5">
        <Input value={s.nombre} onChange={(e) => props.onRenombrar(e.target.value, s.proposito)} aria-label="Nombre de la pantalla" className="h-8 text-[13px] font-semibold" />
        <Input value={s.proposito} onChange={(e) => props.onRenombrar(s.nombre, e.target.value)} aria-label="Para qué sirve" placeholder="Para qué sirve" className="h-8 text-[12px]" />
      </div>

      <div data-testid="skills-pantalla">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium" title={`Adaptadas de Open Design Agent Kit (${ORIGEN_SKILLS.licencia})`}>
            Patrones {s.skills ? "(a mano)" : "(automáticos)"}
          </p>
          {s.skills && (
            <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => props.onSkills(undefined)}>
              Automáticos
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {SKILLS_PANTALLA.map((k) => {
            const activa = skills.includes(k.id);
            const lleno = !activa && skills.length >= MAX_SKILLS_PANTALLA + 1;
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={activa}
                disabled={lleno}
                title={lleno ? `Máximo ${MAX_SKILLS_PANTALLA + 1}: quita otro antes` : k.texto.split("\n")[1]}
                onClick={() => props.onSkills(alternarSkill(s, tipo, k.id))}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[11px] disabled:opacity-40",
                  activa ? "border-orange-500 bg-orange-500/10" : "border-border/60 text-muted-foreground"
                )}
              >
                {k.nombre}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[10.5px] text-muted-foreground">Viajan con la pantalla al generarla y se comprueban en la crítica.</p>
      </div>

      <div>
        <p className="mb-1 text-[12px] font-medium">Pedir un cambio</p>
        <textarea
          value={cambio}
          onChange={(e) => setCambio(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={3}
          disabled={!v}
          placeholder={v ? "Ej.: más aire entre secciones, el botón principal más visible, tarjetas en horizontal" : "Primero genera la pantalla"}
          className="w-full resize-y rounded-xl border border-border/60 bg-background p-2.5 text-[12.5px] outline-none focus:ring-2 focus:ring-orange-500/40"
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Button size="sm" onClick={enviar} disabled={!v || !cambio.trim() || props.ocupado} className="gap-1">
            <Wand2 className="size-3.5" /> Aplicar
          </Button>
          <Button size="sm" variant="outline" onClick={props.onVariante} disabled={!v || props.ocupado} className="gap-1" title="Misma marca, otra composición">
            <Shuffle className="size-3.5" /> Variante
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onRegenerar} disabled={props.ocupado} className="gap-1">
            <RefreshCw className="size-3.5" /> Rehacer
          </Button>
        </div>
      </div>

      {v && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={props.onCompleta} className="gap-1">
            <Maximize2 className="size-3.5" /> Ver
          </Button>
          <Button size="sm" variant="outline" onClick={props.onCodigo} className="gap-1">
            <Code2 className="size-3.5" /> Código
          </Button>
          <Button size="sm" variant="outline" onClick={props.onComparar} disabled={s.versiones.length < 2} className="gap-1">
            <Columns2 className="size-3.5" /> Comparar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => descargar(`${slug(props.proyecto.nombre)}-${slug(s.nombre)}.html`, html, "text/html")}
          >
            <Download className="size-3.5" /> HTML
          </Button>
          <Button size="sm" variant="outline" className="gap-1" disabled={capturando} onClick={bajarPng} title={`Imagen a ${DISPOSITIVOS[props.dispositivo].nombre.toLowerCase()}`}>
            {capturando ? <Loader2 className="size-3.5 animate-spin" /> : <ImageDown className="size-3.5" />} PNG
          </Button>
          <Button size="sm" variant="outline" className="gap-1" disabled={guardando} onClick={aBiblioteca} title="Guardar esta pantalla como referencia">
            {guardando ? <Loader2 className="size-3.5 animate-spin" /> : <BookImage className="size-3.5" />} A biblioteca
          </Button>
        </div>
      )}

      {s.versiones.length > 0 && (
        <div>
          <p className="mb-1 text-[12px] font-medium">Versiones</p>
          <div className="flex flex-wrap gap-1">
            {s.versiones.map((x: VersionPantalla, i) => (
              <button
                key={x.id}
                title={`${x.pedido}${x.modelo ? ` · ${nombreModelo(x.modelo)}` : ""}`}
                onClick={() => props.onVersion(i)}
                className={cn(
                  "max-w-full truncate rounded-md border px-2 py-0.5 text-[11.5px]",
                  i === actual ? "border-orange-500 bg-orange-500/10" : "border-border/60 text-muted-foreground"
                )}
              >
                v{i + 1} · {x.pedido.slice(0, 22)}
              </button>
            ))}
          </div>
        </div>
      )}

      {critica && (
        <div className="space-y-2 rounded-xl border border-border/60 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium">Crítica de FORJA</p>
            <Chip tono={critica.nivelGenerico === "bajo" ? "ok" : critica.nivelGenerico === "medio" ? "aviso" : "fuego"}>
              identidad {critica.identidad}/100
            </Chip>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-orange-500" style={{ width: `${critica.identidad}%` }} />
          </div>
          <p className="text-[11.5px] text-muted-foreground">{critica.motivo}</p>
          {critica.patrones.length + critica.sintomas.length + critica.avisos.length > 0 ? (
            <>
              <ul className="space-y-1 text-[11.5px]">
                {critica.patrones.map((x, i) => (
                  <li key={`p${i}`} data-testid="fallo-patron">
                    <b>Patrón</b> — <span className="text-muted-foreground">{x}</span>
                  </li>
                ))}
                {critica.sintomas.map((x, i) => (
                  <li key={`s${i}`}>
                    <b>{x.nombre}</b> — <span className="text-muted-foreground">{x.alternativa}</span>
                  </li>
                ))}
                {critica.avisos.map((x, i) => (
                  <li key={`a${i}`} className="text-muted-foreground">
                    · {x}
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="outline" className="w-full gap-1" disabled={props.ocupado} onClick={() => props.onCorregir(problemasParaCorregir(critica))}>
                <Wand2 className="size-3.5" /> Corregir con IA
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-1 text-[11.5px] text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5" /> Sin problemas detectados
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

/* ------------------------------ diálogos ------------------------------ */

function usarPantalla(p: ProyectoDiseno, id: string | null) {
  return id ? p.pantallas.find((s) => s.id === id) ?? null : null;
}

/** Pantalla completa y modo presentación: flechas (o ← →) recorren las
 * pantallas del proyecto en orden, para enseñarlas como un prototipo. */
function DialogoCompleta(props: {
  proyecto: ProyectoDiseno;
  pantallaId: string | null;
  onClose: () => void;
  inicial: Dispositivo;
  recorrido: string[];
  onIr: (id: string) => void;
}) {
  const { proyecto, pantallaId, onClose, inicial, recorrido, onIr } = props;
  const s = usarPantalla(proyecto, pantallaId);
  const pos = pantallaId ? recorrido.indexOf(pantallaId) : -1;
  const ir = (delta: number) => {
    if (pos < 0 || !recorrido.length) return;
    onIr(recorrido[(pos + delta + recorrido.length) % recorrido.length]);
  };
  // Se reinicia con `key` desde fuera al abrir otra pantalla.
  const [disp, setDisp] = useState<Dispositivo>(inicial);
  const v = s ? versionActual(s) : null;
  const html = useMemo(() => (v ? htmlDeVersion(v, direccionDe(proyecto)) : ""), [v, proyecto]);
  const dim = DISPOSITIVOS[disp];
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex h-[92dvh] max-w-[96vw] flex-col gap-2 rounded-2xl p-3 sm:max-w-[96vw]"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") ir(1);
          else if (e.key === "ArrowLeft") ir(-1);
        }}
      >
        <DialogHeader className="flex-row items-center gap-2 space-y-0 pr-8">
          {recorrido.length > 1 && pos >= 0 && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="size-7" aria-label="Pantalla anterior" onClick={() => ir(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                {pos + 1}/{recorrido.length}
              </span>
              <Button size="icon" variant="outline" className="size-7" aria-label="Pantalla siguiente" onClick={() => ir(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
          <DialogTitle className="text-[14px]">{s?.nombre}</DialogTitle>
          <DialogDescription className="sr-only">Vista completa de la pantalla</DialogDescription>
          <div className="ml-auto inline-flex rounded-lg border border-border/60 p-0.5">
            {(Object.keys(DISPOSITIVOS) as Dispositivo[]).map((k) => {
              const { Icono, nombre } = DISPOSITIVOS[k];
              return (
                <button key={k} aria-label={nombre} onClick={() => setDisp(k)} className={cn("rounded-md p-1.5", disp === k ? "bg-orange-500 text-white" : "text-muted-foreground")}>
                  <Icono className="size-3.5" />
                </button>
              );
            })}
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-xl bg-muted/40 p-3">
          <iframe
            title={s?.nombre ?? "Pantalla"}
            srcDoc={html}
            sandbox="allow-scripts allow-forms"
            className={cn("h-full max-w-full border-0 bg-white shadow", disp === "movil" ? "rounded-[24px]" : "rounded-lg")}
            style={{ width: disp === "escritorio" ? "100%" : dim.ancho }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoCodigo({ proyecto, pantallaId, onClose }: { proyecto: ProyectoDiseno; pantallaId: string | null; onClose: () => void }) {
  const s = usarPantalla(proyecto, pantallaId);
  const v = s ? versionActual(s) : null;
  const html = useMemo(() => (v ? htmlDeVersion(v, direccionDe(proyecto)) : ""), [v, proyecto]);
  const copiar = () =>
    navigator.clipboard.writeText(html).then(
      () => toast.success("Código copiado"),
      () => toast.error("No se pudo copiar")
    );
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88dvh] flex-col rounded-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Código · {s?.nombre}</DialogTitle>
          <DialogDescription>HTML autónomo: CSS, tokens del proyecto y efectos incluidos.</DialogDescription>
        </DialogHeader>
        <pre className="min-h-0 flex-1 overflow-auto rounded-xl bg-muted/50 p-3 text-[11.5px] leading-relaxed">{html}</pre>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={copiar}>
            Copiar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoComparar({ proyecto, pantallaId, onClose, dispositivo }: { proyecto: ProyectoDiseno; pantallaId: string | null; onClose: () => void; dispositivo: Dispositivo }) {
  const s = usarPantalla(proyecto, pantallaId);
  const n = s?.versiones.length ?? 0;
  // Se reinicia con `key` desde fuera: arranca comparando las dos últimas.
  const [a, setA] = useState(() => Math.max(0, n - 2));
  const [b, setB] = useState(() => Math.max(0, n - 1));
  const d = direccionDe(proyecto);
  const htmlA = useMemo(() => (s?.versiones[a] ? htmlDeVersion(s.versiones[a], d) : ""), [s, a, d]);
  const htmlB = useMemo(() => (s?.versiones[b] ? htmlDeVersion(s.versiones[b], d) : ""), [s, b, d]);
  const ancho = dispositivo === "escritorio" ? 520 : dispositivo === "tablet" ? 380 : 300;
  const lado = (valor: number, set: (i: number) => void, html: string, etiqueta: string) => (
    <div className="flex flex-col items-center gap-2">
      <select aria-label={etiqueta} value={valor} onChange={(e) => set(Number(e.target.value))} className="h-8 rounded-lg border border-border/60 bg-background px-2 text-[12px]">
        {s?.versiones.map((x, i) => (
          <option key={x.id} value={i}>
            v{i + 1} · {x.pedido.slice(0, 40)}
          </option>
        ))}
      </select>
      <Marco html={html} dispositivo={dispositivo} ancho={ancho} />
    </div>
  );
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-auto rounded-2xl sm:max-w-[min(96vw,1200px)]">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Comparar versiones · {s?.nombre}</DialogTitle>
          <DialogDescription>Elige dos versiones; la actual se cambia desde el panel de versiones.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-center gap-6">
          {lado(a, setA, htmlA, "Versión A")}
          {lado(b, setB, htmlB, "Versión B")}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ raíz ------------------------------ */

const sinSuscripcion = () => () => {};

export function Estudio() {
  // Los proyectos y las claves viven en localStorage: en el servidor no hay
  // nada que pintar, y pintar algo distinto rompería la hidratación.
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const proyecto = useEstudio((s) => proyectoActivo(s));
  const [modelo, setModelo] = useState<string>(AUTO_MODEL_KEY);
  // El generador vive aquí: crear un proyecto cambia de vista mientras sus
  // pantallas se siguen generando, y el editor tiene que verlas en vivo.
  const gen = useGenerar(modelo);
  if (!enCliente) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" aria-busy="true" />;
  return proyecto ? (
    <EditorProyecto key={proyecto.id} proyecto={proyecto} modelo={modelo} setModelo={setModelo} gen={gen} />
  ) : (
    <InicioEstudio modelo={modelo} setModelo={setModelo} gen={gen} />
  );
}
