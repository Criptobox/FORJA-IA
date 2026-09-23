"use client";
/** Forja IA — Panel de vista previa en vivo + mapa del proyecto */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Code2,
  DatabaseZap,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileText,
  Map as MapIcon,
  Monitor,
  MousePointerClick,
  Paintbrush,
  Pencil,
  RefreshCw,
  ScanSearch,
  Smartphone,
  Tablet,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectMapView } from "./project-map-view";
import { cn } from "@/lib/utils";
import { bundlePreview, filesFromAnswer, nombreDescarga } from "@/lib/forja/answer-files";
import { encodeText } from "@/lib/forja/sandbox";
import { writeZip } from "@/lib/forja/zip";
import {
  injectVisualQA,
  onQAAutoResult,
  QA_LABEL,
  QA_WIDTHS,
  reglaDeQA,
  runVisualQA,
  type QAResult,
} from "@/lib/forja/visual-qa";
import { useFailures } from "@/lib/forja/failures";
import { SANDBOX_ORIGIN, injectConsoleBridge } from "@/lib/forja/sandbox";
import { borrarAlmacen, guardarAlmacen, leerAlmacen, sembrarAlmacen } from "@/lib/forja/preview-storage";
import { injectEditPilot } from "@/lib/forja/editar-preview";
import { normalizarSenalado, type ElementoSenalado } from "@/lib/forja/senalar";
import { aHex, cssDeCambios, injectEstiloPilot, type CambioEstilo, type SeleccionEstilo } from "@/lib/forja/editor-estilos";
import { toast } from "sonner";
import {
  registrarError,
  resumenErroresVivos,
  promptDeErroresVivos,
  type ErrorEnVivo,
} from "@/lib/forja/errores-en-vivo";
import type { ProjectMap } from "@/lib/forja/types";
import { RUTA_REGLAS_PROYECTO, serializarReglas } from "@/lib/forja/reglas-no";

/** Tamaños de la vista previa. Los mismos anchos que mide Visual QA
 *  (320/390/768), para que lo que se ve y lo que se mide coincidan. */
type Dispositivo = "desktop" | "tablet" | "mobile" | "mobile-s";
const DISPOSITIVOS: readonly { id: Dispositivo; nombre: string; aria: string; ancho: number | null; Icono: typeof Monitor }[] = [
  { id: "desktop", nombre: "Escritorio", aria: "Vista escritorio", ancho: null, Icono: Monitor },
  { id: "tablet", nombre: "Tablet", aria: "Vista tablet", ancho: 768, Icono: Tablet },
  { id: "mobile", nombre: "Móvil", aria: "Vista móvil", ancho: 390, Icono: Smartphone },
  { id: "mobile-s", nombre: "Móvil pequeño", aria: "Vista móvil pequeño", ancho: 320, Icono: Smartphone },
];

export interface PreviewPanelProps {
  code: string | null;
  /** respuesta completa de la que salió el HTML: de ahí salen los DEMÁS archivos
   *  (styles.css, app.js…) que la vista previa no pinta pero sí se pueden guardar */
  source?: string | null;
  /** título de la conversación, para nombrar la descarga */
  title?: string | null;
  /** true mientras la IA está escribiendo (refresco con debounce) */
  streaming?: boolean;
  onClose?: () => void;
  className?: string;
  /** mapa del proyecto construido en la conversación */
  map?: ProjectMap | null;
  onClearMap?: () => void;
  /** notas de memoria y historial (edición Obsidian) */
  reglas?: readonly import("@/lib/forja/reglas-no").ReglaNo[];
  archivosDelProyecto?: readonly string[];
  onAddNote?: (text: string) => void;
  onRemoveNote?: (index: number) => void;
  onAddRegla?: (patron: string, motivo: string) => void;
  onRemoveRegla?: (id: string) => void;
  onRestoreSnapshot?: (index: number) => void;
  /** Manda al chat los errores que salieron usando la página, para que el
   *  modelo los corrija. Sin esto el aviso solo informa. */
  onFixLive?: (prompt: string) => void;
  /** Aplica un cambio de texto tocado en la vista previa al código fuente de
   *  la respuesta. Devuelve por qué no se pudo, si no se pudo — el motivo se
   *  enseña tal cual, no se traga. */
  onEditText?: (original: string, nuevo: string) => { ok: boolean; motivo?: string };
  /** Identifica la conversación: lo que la página guarde en localStorage se
   *  conserva bajo este id y vuelve al recargar. Sin él, no persiste. */
  almacenId?: string | null;
  /** Guarda en el código de la respuesta los estilos tocados en la vista
   *  previa (bloque `data-forja-ajustes`). Devuelve por qué no, si no. */
  onEditStyle?: (cambios: CambioEstilo[]) => { ok: boolean; motivo?: string };
  /** Tocaste un elemento en modo «señalar»: va al chat como referencia para
   *  que la IA sepa exactamente qué cambiar. */
  onSenalar?: (e: ElementoSenalado) => void;
}

/** Lo que un padre puede pedirle a un PreviewPanel montado, por ref. Hoy
 *  solo el QA visual: dejar que Web Studio mida el iframe EN VIVO que el
 *  usuario ya está viendo, en vez de renderizar la página una segunda vez
 *  en un iframe oculto aparte (que además la ejecutaría dos veces). */
export interface PreviewPanelHandle {
  runVisualQA: () => Promise<QAResult[]>;
}

export const PreviewPanel = forwardRef<PreviewPanelHandle, PreviewPanelProps>(function PreviewPanel({
  code,
  source,
  title,
  streaming,
  onClose,
  className,
  map,
  onClearMap,
  reglas,
  archivosDelProyecto,
  onAddNote,
  onRemoveNote,
  onAddRegla,
  onRemoveRegla,
  onRestoreSnapshot,
  onFixLive,
  onEditText,
  almacenId,
  onEditStyle,
  onSenalar,
}, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<Dispositivo>("desktop");
  const [tab, setTab] = useState<"preview" | "code" | "map">("preview");
  const anchoDispositivo = DISPOSITIVOS.find((d) => d.id === device)?.ancho ?? null;
  /** ancho útil del lienzo, para escalar un dispositivo que no cabe */
  const lienzoRef = useRef<HTMLDivElement>(null);
  const [anchoLienzo, setAnchoLienzo] = useState(0);
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const cs = getComputedStyle(el);
      setAnchoLienzo(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
    // el lienzo solo existe en la pestaña de vista previa: se vuelve a
    // observar cuando reaparece
  }, [tab]);
  const escala = anchoDispositivo && anchoLienzo > 0 && anchoDispositivo > anchoLienzo ? anchoLienzo / anchoDispositivo : 1;
  const [reloadKey, setReloadKey] = useState(0);
  const [painted, setPainted] = useState(code);

  // Durante streaming se repinta con debounce para no recargar el iframe letra a letra
  useEffect(() => {
    const t = setTimeout(() => setPainted(code), streaming ? 400 : 0);
    return () => clearTimeout(t);
  }, [code, streaming]);

  /** Todo lo que la respuesta creó, no solo lo que se pinta. Si hay reglas de
   *  memoria negativa, viajan como archivo real del proyecto: quien lo abra
   *  en otra máquina —o lo reciba por GitHub— ve qué está protegido y por
   *  qué, no solo quien tenía esta sesión de chat abierta. */
  const archivosRespuesta = useMemo(() => filesFromAnswer(source), [source]);
  const archivos = useMemo(
    () =>
      reglas?.length
        ? [
            ...archivosRespuesta,
            { path: RUTA_REGLAS_PROYECTO, text: serializarReglas(reglas), inferido: true },
          ]
        : archivosRespuesta,
    [archivosRespuesta, reglas]
  );

  /** Con el CSS y el JS hermanos ya metidos dentro: si no, la página se pinta
   *  a medias porque esos archivos no existen dentro del iframe. */
  const bundle = useMemo(
    () => (painted ? bundlePreview(painted, archivos) : ""),
    [painted, archivos]
  );
  /** Lo que se pinta lleva DENTRO el medidor de QA visual: el sandbox no deja
   *  leer su DOM desde fuera (sin allow-same-origin), pero postMessage sí cruza.
   *  Descargas y «abrir en pestaña» van con el bundle LIMPIO, sin el medidor. */
  /** …y el puente de consola: sin él, un error al pulsar un botón moría dentro
   *  del iframe sin que se enterara nadie. Solo en lo que se PINTA; lo que se
   *  descarga o se abre en pestaña sigue yendo limpio. */
  const paraPintar = useMemo(
    () => (bundle ? injectEstiloPilot(injectEditPilot(injectConsoleBridge(injectVisualQA(bundle)))) : ""),
    [bundle]
  );

  /* ------- tocar un texto y editarlo ahí mismo ------- */
  const [editando, setEditando] = useState(false);
  // se apaga solo al cambiar de respuesta: editar la anterior y aparecer ya
  // en la siguiente sería tocar algo que ni se está mirando
  useEffect(() => setEditando(false), [source]);

  const enviarComandoEdicion = (on: boolean) => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ source: "forja-edit-cmd", op: "toggle", on }, "*");
    } catch {
      /* el iframe puede no estar listo todavía; el aviso de «listo» reintenta */
    }
  };

  useEffect(() => {
    enviarComandoEdicion(editando);
  }, [editando]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; original?: string; nuevo?: string } | null;
      if (!d || d.source !== "forja-edit") return;
      if (d.type === "listo") {
        // el iframe acaba de cargar un documento NUEVO (cada `srcdoc` es una
        // recarga): si el modo edición seguía activo, hay que decírselo otra
        // vez, o quien estaba editando se encuentra con que dejó de funcionar
        // sin que nadie se lo avisara.
        if (editando) enviarComandoEdicion(true);
        return;
      }
      if (d.type === "cambio" && typeof d.original === "string" && typeof d.nuevo === "string") {
        const r = onEditText?.(d.original, d.nuevo);
        if (r && !r.ok) {
          toast.error("No se pudo aplicar el cambio", { description: r.motivo });
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [editando, onEditText]);

  /* ------- tocar un elemento y cambiar su estilo ------- */
  const [estilando, setEstilando] = useState(false);
  const [senalando, setSenalando] = useState(false);
  const [seleccion, setSeleccion] = useState<SeleccionEstilo | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  /** cambios sin guardar: selector → propiedad → valor */
  const [borrador, setBorrador] = useState<Record<string, Record<string, string>>>({});
  const cambiosBorrador = useMemo<CambioEstilo[]>(
    () => Object.entries(borrador).map(([selector, props]) => ({ selector, props })),
    [borrador]
  );

  const enviarAEstilo = (m: Record<string, unknown>) => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ source: "forja-estilo-cmd", ...m }, "*");
    } catch {
      /* iframe sin cargar: el «listo» reintenta */
    }
  };
  // el mismo piloto sirve a los dos modos: estilo y señalar
  useEffect(() => {
    enviarAEstilo({ op: "toggle", on: estilando || senalando, modo: senalando ? "senalar" : "estilo" });
    if (!estilando) setSeleccion(null);
  }, [estilando, senalando]);
  // lo que llevas tocado se ve YA, antes de guardarlo
  useEffect(() => {
    enviarAEstilo({ op: "vivo", css: cssDeCambios(cambiosBorrador) });
  }, [cambiosBorrador]);
  // otra respuesta, otro documento: lo pendiente de la anterior no aplica
  useEffect(() => {
    setBorrador({});
    setSeleccion(null);
  }, [source]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { source?: string; type?: string; tokens?: Record<string, string> } & Partial<SeleccionEstilo> | null;
      if (!d || d.source !== "forja-estilo") return;
      if (d.type === "listo") {
        if (estilando || senalando) enviarAEstilo({ op: "toggle", on: true, modo: senalando ? "senalar" : "estilo" });
        if (cambiosBorrador.length) enviarAEstilo({ op: "vivo", css: cssDeCambios(cambiosBorrador) });
      } else if (d.type === "tokens" && d.tokens && typeof d.tokens === "object") {
        setTokens(d.tokens);
      } else if (d.type === "senalado") {
        const el = normalizarSenalado(d, `sen-${Date.now().toString(36)}`);
        if (el) onSenalar?.(el);
      } else if (d.type === "seleccion" && typeof d.selector === "string" && d.estilos) {
        setSeleccion({ selector: d.selector, etiqueta: String(d.etiqueta ?? ""), estilos: d.estilos });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [estilando, senalando, cambiosBorrador, onSenalar]);

  const cambiarEstilo = (selector: string, prop: string, valor: string) =>
    setBorrador((b) => ({ ...b, [selector]: { ...(b[selector] ?? {}), [prop]: valor } }));
  const valorActual = (selector: string, prop: string, delPiloto?: string) =>
    borrador[selector]?.[prop] ?? delPiloto ?? "";

  const guardarEstilos = () => {
    if (!cambiosBorrador.length) return;
    const r = onEditStyle?.(cambiosBorrador);
    if (!r) return;
    if (!r.ok) {
      toast.error("No se pudo guardar el estilo", { description: r.motivo });
      return;
    }
    setBorrador({});
    setSeleccion(null);
    toast.success("Estilo guardado en el código", { description: "Va en un bloque «data-forja-ajustes» al final de la página." });
  };

  /* ------- errores mientras TÚ la usas ------- */
  const [erroresVivos, setErroresVivos] = useState<ErrorEnVivo[]>([]);
  /** lo último que se tocó dentro del iframe, para dar contexto al error */
  const ultimoGesto = useRef<string | undefined>(undefined);

  // se limpian al repintar: los errores de la versión anterior ya no aplican
  useEffect(() => {
    setErroresVivos([]);
    ultimoGesto.current = undefined;
  }, [paraPintar]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; level?: string; text?: string; gesto?: string } | null;
      if (!d || d.source !== SANDBOX_ORIGIN) return;
      if (typeof d.gesto === "string") {
        ultimoGesto.current = d.gesto || undefined;
        return;
      }
      if (d.level !== "error" || typeof d.text !== "string") return;
      setErroresVivos((prev) => registrarError(prev, d.text as string, ultimoGesto.current));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  /* ------- QA visual: la batería móvil medida sobre el DOM real ------- */
  const [qaAbierto, setQaAbierto] = useState(false);
  const [qaCorriendo, setQaCorriendo] = useState(false);
  const [qaResultados, setQaResultados] = useState<QAResult[]>([]);
  const [qaAuto, setQaAuto] = useState<QAResult | null>(null);

  // el medidor manda una medida al cargar (token 0): se enseña bajo demanda
  useEffect(() => onQAAutoResult(setQaAuto), []);

  const correrQA = async () => {
    setQaAbierto(true);
    setQaCorriendo(true);
    try {
      const resultados = await runVisualQA(iframeRef.current, QA_WIDTHS);
      setQaResultados(resultados);
      registrarQAFallos(resultados);
    } finally {
      setQaCorriendo(false);
    }
  };

  useImperativeHandle(ref, () => ({
    runVisualQA: () => runVisualQA(iframeRef.current, QA_WIDTHS),
  }), []);

  /** los problemas verificados alimentan la memoria de fallos (reglas dedup) */
  const registrarQAFallos = (resultados: QAResult[]) => {
    const store = useFailures.getState();
    for (const r of resultados) {
      if (r.noRespondio || r.ok) continue;
      for (const item of r.items) {
        store.record(
          "vista",
          `Vista previa a ${r.width}px: ${item.detalle.slice(0, 140)}`,
          reglaDeQA(item.tipo),
          item.tipo === "scroll" || item.tipo === "fuera" || item.tipo === "sin-nombre" || item.tipo === "sin-alt"
            ? "error"
            : "warn"
        );
      }
    }
  };

  const qaProblemas = qaResultados.reduce((n, r) => n + (r.noRespondio || r.ok ? 0 : r.items.length), 0);

  /* ------- datos de la app que sobreviven a recargar ------- */
  const [hayDatos, setHayDatos] = useState(false);
  const avisoLleno = useRef(false);
  useEffect(() => {
    setHayDatos(Object.keys(leerAlmacen(almacenId)).length > 0);
    avisoLleno.current = false;
  }, [almacenId]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // solo del iframe que pintamos: otra ventana no escribe aquí
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { source?: string; almacen?: unknown } | null;
      if (!d || d.source !== SANDBOX_ORIGIN || !("almacen" in d) || !almacenId) return;
      const r = guardarAlmacen(almacenId, d.almacen);
      if (r.ok) setHayDatos(!r.vacio);
      else if (!avisoLleno.current) {
        avisoLleno.current = true;
        toast.warning("Los datos de la vista previa no se guardaron", { description: r.motivo });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [almacenId]);

  const borrarDatos = () => {
    borrarAlmacen(almacenId);
    setHayDatos(false);
    setReloadKey((k) => k + 1);
    toast.success("Datos de la vista previa borrados");
  };

  // Pintado imperativo en el iframe (evita re-montajes de React). Los datos
  // guardados se leen AQUÍ, al pintar, y no en el useMemo: si no, cada
  // escritura de la página recargaría el iframe.
  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    el.srcdoc = almacenId && paraPintar ? sembrarAlmacen(paraPintar, leerAlmacen(almacenId)) : paraPintar;
  }, [paraPintar, reloadKey, almacenId]);

  const openExternal = () => {
    const blob = new Blob([bundle], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const guardar = (data: BlobPart, nombre: string, tipo: string) => {
    const url = URL.createObjectURL(new Blob([data], { type: tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  // el .html suelto lleva el CSS y el JS dentro; si no, se abriría sin estilos
  const descargarHtml = () =>
    guardar(bundle, nombreDescarga(title, "html"), "text/html");

  const descargarUno = (path: string, text: string) =>
    guardar(text, path.split("/").pop() || "archivo.txt", "text/plain");

  /** El proyecto entero en un ZIP: es lo que hace falta cuando la respuesta
   *  trae index.html + styles.css + app.js y solo se veía el primero. */
  const descargarZip = () => {
    const zip = writeZip(archivos.map((f) => ({ path: f.path, data: encodeText(f.text) })));
    guardar(
      new Uint8Array(zip).buffer as ArrayBuffer,
      nombreDescarga(title, "zip"),
      "application/zip"
    );
  };

  return (
    <div className={cn("panel-in flex h-full min-w-0 flex-col bg-background", className)}>
      {/* Barra de herramientas */}
      {/* En un móvil no caben todos los botones: la barra se desplaza de lado
          (sin barra de scroll visible) y «Cerrar» queda fijo a la derecha. */}
      <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 bg-card/60 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Eye className="ml-1 size-3.5 shrink-0 text-forja-cyan" />
        <span className="hidden whitespace-nowrap text-xs font-medium sm:inline">
          {tab === "map" ? "Mapa del proyecto" : "Vista previa"}
        </span>
        {streaming && tab !== "map" && (
          <span className="ml-1.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-forja-cyan/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-forja-cyan">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-forja-cyan opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-forja-cyan" />
            </span>
            en vivo
          </span>
        )}
        <div className="flex-1" />
        <div className="flex shrink-0 rounded-lg border border-border/60 p-0.5" role="group" aria-label="Tamaño de pantalla">
          {DISPOSITIVOS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDevice(d.id)}
              aria-label={d.aria}
              aria-pressed={device === d.id}
              title={d.ancho ? `${d.nombre} (${d.ancho}px)` : d.nombre}
              className={cn(
                "rounded-md p-1 transition",
                d.id === "tablet" || d.id === "mobile-s" ? "hidden sm:block" : "",
                device === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <d.Icono className={cn("size-3.5", d.id === "mobile-s" && "scale-90")} />
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative size-8 shrink-0", qaAbierto && "bg-muted text-foreground")}
          onClick={() => (qaAbierto ? setQaAbierto(false) : void correrQA())}
          title={`QA visual: mide la página a ${QA_WIDTHS.join(", ")} px (desbordes, texto pequeño, contraste, accesibilidad)`}
          aria-label="QA visual"
        >
          <ScanSearch className="size-3.5" />
          {qaProblemas > 0 && !qaAbierto && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
              {qaProblemas}
            </span>
          )}
        </Button>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setReloadKey((k) => k + 1)} title="Recargar" aria-label="Recargar vista previa">
          <RefreshCw className="size-3.5" />
        </Button>
        {hayDatos && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-forja-cyan"
            onClick={borrarDatos}
            title="La app de la vista previa tiene datos guardados en este dispositivo. Pulsa para borrarlos y empezar de cero."
            aria-label="Borrar datos guardados de la vista previa"
          >
            <DatabaseZap className="size-3.5" />
          </Button>
        )}
        {onSenalar && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8 shrink-0", senalando && "bg-primary text-primary-foreground hover:bg-primary/90")}
            onClick={() => {
              setEditando(false);
              setEstilando(false);
              setSenalando((v) => !v);
            }}
            title={senalando ? "Dejar de señalar" : "Señalar a la IA: toca un botón o un apartado y escribe en el chat qué cambiar"}
            aria-label={senalando ? "Dejar de señalar" : "Señalar un elemento a la IA"}
            aria-pressed={senalando}
          >
            <MousePointerClick className="size-3.5" />
          </Button>
        )}
        {/* Tocar un texto de la vista previa y editarlo ahí mismo. El cambio
            se busca en el código de la respuesta y se guarda ahí — por eso
            sigue estando cuando descargas o subes a GitHub, no es un retoque
            que se pierde al repintar. */}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8 shrink-0", editando && "bg-muted text-foreground")}
          onClick={() => {
            setEstilando(false);
            setSenalando(false);
            setEditando((v) => !v);
          }}
          title={editando ? "Dejar de editar" : "Editar: toca un texto de la vista previa para cambiarlo"}
          aria-label={editando ? "Dejar de editar la vista previa" : "Editar la vista previa"}
          aria-pressed={editando}
        >
          <Pencil className="size-3.5" />
        </Button>
        {onEditStyle && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8 shrink-0", estilando && "bg-muted text-foreground")}
            onClick={() => {
              setEditando(false);
              setSenalando(false);
              setEstilando((v) => !v);
            }}
            title={estilando ? "Dejar de editar estilos" : "Estilos: toca un elemento para cambiar color, tamaño, espaciado… o cambia los tokens de la página"}
            aria-label={estilando ? "Dejar de editar estilos" : "Editar estilos de la vista previa"}
            aria-pressed={estilando}
          >
            <Paintbrush className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8 shrink-0", tab === "code" && "bg-muted text-foreground")}
          onClick={() => setTab((t) => (t === "code" ? "preview" : "code"))}
          title="Ver código"
          aria-label="Alternar código"
        >
          <Code2 className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8 shrink-0", tab === "map" && "bg-muted text-foreground")}
          onClick={() => setTab((t) => (t === "map" ? "preview" : "map"))}
          title="Mapa del proyecto (memoria que ahorra tokens)"
          aria-label="Mapa del proyecto"
        >
          <MapIcon className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={openExternal} title="Abrir en pestaña nueva" aria-label="Abrir en pestaña nueva">
          <ExternalLink className="size-3.5" />
        </Button>
        {archivos.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                title={`Descargar (${archivos.length} archivos)`}
                aria-label="Descargar lo creado"
              >
                <Download className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-[11px]">
                Esta respuesta creó {archivos.length} archivos
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={descargarZip}>
                <FileArchive className="size-3.5" /> Descargar todo (.zip)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {archivos.map((f) => (
                <DropdownMenuItem
                  key={f.path}
                  onClick={() => descargarUno(f.path, f.text)}
                  className="text-xs"
                >
                  <FileText className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{f.path}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={descargarHtml}
            title="Descargar .html"
            aria-label="Descargar HTML"
          >
            <Download className="size-3.5" />
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="icon" className="sticky right-0 size-8 shrink-0 bg-card" onClick={onClose} title="Cerrar vista previa" aria-label="Cerrar vista previa">
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Contenido */}
      {estilando && tab === "preview" && (
        <PanelEstilos
          seleccion={seleccion}
          tokens={tokens}
          valor={valorActual}
          onCambio={cambiarEstilo}
          pendientes={cambiosBorrador.length}
          onGuardar={guardarEstilos}
          onDescartar={() => setBorrador({})}
        />
      )}

      {qaAbierto && tab !== "map" && (
        <div className="shrink-0 border-b border-border/60 bg-muted/30 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-foreground/80">
              {qaCorriendo
                ? `Midiendo la página a ${QA_WIDTHS.join(", ")} px…`
                : qaProblemas === 0
                  ? qaResultados.length
                    ? "Sin problemas medidos en ningún ancho."
                    : qaAuto && !qaAuto.ok
                      ? `Medida automática a ${qaAuto.width}px: ${qaAuto.items.length} ${qaAuto.items.length === 1 ? "aviso" : "avisos"}.`
                      : `Pulsa el icono de lupa para medir la página a ${QA_WIDTHS.join(", ")} px.`
                  : `${qaProblemas} ${qaProblemas === 1 ? "problema medido" : "problemas medidos"}`}
            </p>
            <button
              onClick={() => void correrQA()}
              disabled={qaCorriendo}
              className="shrink-0 rounded-md border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Repetir
            </button>
          </div>
          <div className="space-y-1.5">
            {qaResultados.map((r) => (
              <div key={r.width} className="text-[11px] leading-snug">
                <span
                  className={cn(
                    "mr-1.5 inline-block w-9 rounded px-1 text-center font-semibold",
                    r.noRespondio
                      ? "bg-muted text-muted-foreground"
                      : r.ok
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/15 text-red-600 dark:text-red-400"
                  )}
                >
                  {r.width}
                </span>
                {r.noRespondio ? (
                  <span className="text-muted-foreground">El medidor no respondió a este ancho.</span>
                ) : r.ok ? (
                  <span className="text-muted-foreground">Sin desbordes, texto pequeño ni contraste pobre.</span>
                ) : (
                  <ul className="ml-0 list-none space-y-0.5">
                    {r.items.map((it, i) => (
                      <li key={i} className="text-foreground/85">
                        <span className="mr-1 font-medium text-red-600 dark:text-red-400">{QA_LABEL[it.tipo]}:</span>
                        {it.detalle}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {qaResultados.length === 0 && qaAuto && !qaAuto.ok && (
              <p className="text-[11px] text-foreground/85">
                <span className="mr-1 font-medium text-amber-600 dark:text-amber-400">Medido a {qaAuto.width}px:</span>
                {qaAuto.items.map((it) => it.detalle).join(" ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Contenido (vista previa / código / mapa) */}
      {tab === "map" ? (
        <ProjectMapView
          map={map ?? null}
          onClear={onClearMap}
          reglas={reglas}
          archivosDelProyecto={archivosDelProyecto}
          onAddNote={onAddNote}
          onRemoveNote={onRemoveNote}
          onAddRegla={onAddRegla}
          onRemoveRegla={onRemoveRegla}
          onRestoreSnapshot={onRestoreSnapshot}
        />
      ) : tab === "code" ? (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {painted}
        </pre>
      ) : (
        <div ref={lienzoRef} className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-0 sm:p-3">
          {/* Con un ancho de dispositivo mayor que el panel, la página se
              pinta a su ancho REAL y se escala para caber (como las DevTools):
              recortarla mostraría la maqueta de un ancho que no es el pedido. */}
          <div className="mx-auto h-full" style={{ width: anchoDispositivo ? anchoDispositivo * escala : "100%" }}>
            <div
              className="bg-white shadow-sm sm:rounded-lg sm:ring-1 sm:ring-border/60"
              style={{
                width: anchoDispositivo ?? "100%",
                height: `${100 / escala}%`,
                transform: escala < 1 ? `scale(${escala})` : undefined,
                transformOrigin: "0 0",
              }}
            >
              <iframe
                ref={iframeRef}
                title="Vista previa de la página generada"
                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock"
                className="size-full border-0"
              />
            </div>
          </div>
          {anchoDispositivo && escala < 1 && (
            <span className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-background/90 px-2 py-0.5 font-mono text-[10px] text-muted-foreground shadow-sm">
              {anchoDispositivo}px · {Math.round(escala * 100)}%
            </span>
          )}

          {senalando && (
            <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-2">
              <div className="rounded-full border border-primary/40 bg-background/95 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur">
                Toca lo que quieras cambiar · aparece en el chat para que le digas a la IA qué hacer
              </div>
            </div>
          )}
          {editando && (
            <div className="pointer-events-none sticky top-2 z-10 flex justify-center px-2">
              <div className="pointer-events-none rounded-full border border-primary/40 bg-background/95 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur">
                Toca un texto para editarlo · Enter para guardar, Esc para deshacer
              </div>
            </div>
          )}

          {/* Lo que falla mientras TÚ la usas. El barrido automático pulsa a
              ciegas y sin datos; esto recoge tu orden real y tus datos. */}
          {erroresVivos.length > 0 && (
            <div className="pointer-events-none sticky bottom-2 z-10 mt-2 flex justify-center px-2">
              <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-destructive/40 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur">
                <TriangleAlert className="size-3.5 shrink-0 text-destructive" />
                <span
                  className="min-w-0 truncate text-[11.5px]"
                  title={erroresVivos.map((e) => e.texto).join("\n")}
                >
                  {resumenErroresVivos(erroresVivos)}
                </span>
                {onFixLive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 px-2 text-[11px]"
                    onClick={() => {
                      onFixLive(promptDeErroresVivos(erroresVivos, "index.html"));
                      setErroresVivos([]);
                    }}
                  >
                    Arreglar
                  </Button>
                )}
                <button
                  onClick={() => setErroresVivos([])}
                  aria-label="Descartar los errores"
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Panel del editor de estilos                                         */
/* ------------------------------------------------------------------ */

const PESOS = ["300", "400", "500", "600", "700", "800", "900"];

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-[10px] text-muted-foreground">
      {etiqueta}
      {children}
    </label>
  );
}

const claseInput = "h-7 w-full min-w-0 rounded-md border border-border/60 bg-background px-1.5 text-[11px] text-foreground";

function ColorCampo({ valor, onCambio, etiqueta }: { valor: string; onCambio: (v: string) => void; etiqueta: string }) {
  const hex = aHex(valor);
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        aria-label={etiqueta}
        value={hex ?? "#ffffff"}
        onChange={(e) => onCambio(e.target.value)}
        title={hex ? hex : "Transparente o en otro espacio de color: elige uno para fijarlo"}
        className={cn(
          "h-7 w-8 shrink-0 cursor-pointer rounded border border-border/60 bg-transparent p-0.5",
          !hex && "opacity-40 [background:repeating-conic-gradient(#ccc_0_25%,transparent_0_50%)_0_0/8px_8px]"
        )}
      />
      <input aria-label={`${etiqueta} (valor)`} value={valor} onChange={(e) => onCambio(e.target.value)} className={claseInput} />
    </div>
  );
}

function PanelEstilos({
  seleccion,
  tokens,
  valor,
  onCambio,
  pendientes,
  onGuardar,
  onDescartar,
}: {
  seleccion: SeleccionEstilo | null;
  tokens: Record<string, string>;
  valor: (selector: string, prop: string, delPiloto?: string) => string;
  onCambio: (selector: string, prop: string, valor: string) => void;
  pendientes: number;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  const sel = seleccion?.selector;
  const px = (v: string) => (v ? String(Math.round(parseFloat(v))) : "");
  const listaTokens = Object.entries(tokens);
  return (
    <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-border/60 bg-muted/30 px-3 py-2" aria-label="Editor de estilos">
      {sel && seleccion ? (
        <>
          <p className="mb-1.5 truncate font-mono text-[10px] text-muted-foreground" title={sel}>
            &lt;{seleccion.etiqueta}&gt; · {sel}
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-4">
            <Campo etiqueta="Color">
              <ColorCampo etiqueta="Color del texto" valor={valor(sel, "color", seleccion.estilos.color)} onCambio={(v) => onCambio(sel, "color", v)} />
            </Campo>
            <Campo etiqueta="Fondo">
              <ColorCampo etiqueta="Color de fondo" valor={valor(sel, "background-color", seleccion.estilos["background-color"])} onCambio={(v) => onCambio(sel, "background-color", v)} />
            </Campo>
            <Campo etiqueta="Tamaño (px)">
              <input
                type="number"
                min={8}
                max={200}
                aria-label="Tamaño de letra"
                value={px(valor(sel, "font-size", seleccion.estilos["font-size"]))}
                onChange={(e) => onCambio(sel, "font-size", e.target.value ? `${e.target.value}px` : "")}
                className={claseInput}
              />
            </Campo>
            <Campo etiqueta="Peso">
              <select
                aria-label="Peso de la letra"
                value={valor(sel, "font-weight", seleccion.estilos["font-weight"])}
                onChange={(e) => onCambio(sel, "font-weight", e.target.value)}
                className={claseInput}
              >
                {[...new Set([valor(sel, "font-weight", seleccion.estilos["font-weight"]), ...PESOS])].filter(Boolean).map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Relleno">
              <input aria-label="Relleno" value={valor(sel, "padding", seleccion.estilos.padding)} onChange={(e) => onCambio(sel, "padding", e.target.value)} className={claseInput} />
            </Campo>
            <Campo etiqueta="Radio (px)">
              <input
                type="number"
                min={0}
                max={200}
                aria-label="Radio de las esquinas"
                value={px(valor(sel, "border-radius", seleccion.estilos["border-radius"]))}
                onChange={(e) => onCambio(sel, "border-radius", e.target.value ? `${e.target.value}px` : "")}
                className={claseInput}
              />
            </Campo>
            <Campo etiqueta="Alineación">
              <select
                aria-label="Alineación del texto"
                value={valor(sel, "text-align", seleccion.estilos["text-align"])}
                onChange={(e) => onCambio(sel, "text-align", e.target.value)}
                className={claseInput}
              >
                {[...new Set([valor(sel, "text-align", seleccion.estilos["text-align"]), "left", "center", "right", "justify"])].filter(Boolean).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Interletrado">
              <input aria-label="Interletrado" value={valor(sel, "letter-spacing", seleccion.estilos["letter-spacing"])} onChange={(e) => onCambio(sel, "letter-spacing", e.target.value)} className={claseInput} />
            </Campo>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">Toca un elemento de la página para cambiar su estilo, o ajusta los tokens de abajo.</p>
      )}

      {listaTokens.length > 0 && (
        <details className="mt-2" open={!sel}>
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Tokens de la página ({listaTokens.length})
          </summary>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {listaTokens.map(([nombre, v]) => (
              <Campo key={nombre} etiqueta={nombre}>
                <ColorCampo etiqueta={`Token ${nombre}`} valor={valor(":root", nombre, v)} onCambio={(nv) => onCambio(":root", nombre, nv)} />
              </Campo>
            ))}
          </div>
        </details>
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        {pendientes > 0 && <span className="mr-auto text-[10px] text-muted-foreground">{pendientes} elemento(s) con cambios sin guardar</span>}
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" disabled={!pendientes} onClick={onDescartar}>
          Descartar
        </Button>
        <Button size="sm" className="h-7 text-[11px]" disabled={!pendientes} onClick={onGuardar}>
          Guardar en el código
        </Button>
      </div>
    </div>
  );
}
