"use client";
/** Forja IA — Panel del modelo local .gguf (Ajustes → Proveedores).
 *
 * Elegir el archivo, ver si está cargado y dónde corre, cambiar el contexto y
 * borrar lo que ya no se usa. Lo pesado (copiar, cargar, generar) vive en
 * `gguf-local.ts`; aquí solo se enseña y se pide. */
import { useEffect, useRef, useState } from "react";
import { Cpu, FileUp, Gauge, HardDrive, Loader2, Play, Power, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  borrarModelo,
  cargarModelo,
  descargarModelo,
  guardarModelos,
  refrescarModelos,
  useGgufAjustes,
  useGgufEstado,
} from "@/lib/forja/gguf-local";
import {
  GGUF_CONTEXTOS,
  GGUF_PROVIDER_ID,
  nombreVisible,
  tamanoLegible,
} from "@/lib/forja/gguf-mensajes";
import { useForja } from "@/lib/forja/store";
import { makeModelKey } from "@/lib/forja/types";
import { cn } from "@/lib/utils";

const FMT_TOKS = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

export function GgufPanel() {
  const est = useGgufEstado();
  const contexto = useGgufAjustes((s) => s.contexto);
  const setContexto = useGgufAjustes((s) => s.setContexto);
  const gpu = useGgufAjustes((s) => s.gpu);
  const setGpu = useGgufAjustes((s) => s.setGpu);
  const setProviderConfig = useForja((s) => s.setProviderConfig);
  const setSettings = useForja((s) => s.setSettings);
  const defaultModelKey = useForja((s) => s.settings.defaultModelKey);
  const inputRef = useRef<HTMLInputElement>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  // La lista del proveedor es la de los archivos guardados: si se borraron por
  // fuera (el navegador liberó espacio), el selector no debe seguir ofreciéndolos.
  const sincronizar = async () => {
    const nombres = await refrescarModelos();
    setProviderConfig(GGUF_PROVIDER_ID, { models: nombres, enabled: nombres.length > 0 });
    return nombres;
  };
  useEffect(() => {
    void sincronizar();
    // solo al abrir el panel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anadir = async (files: File[]) => {
    try {
      const nuevos = await guardarModelos(files);
      await sincronizar();
      if (nuevos[0]) {
        setSettings({ defaultModelKey: makeModelKey(GGUF_PROVIDER_ID, nuevos[0]) });
        toast.success(`«${nombreVisible(nuevos[0])}» listo`, {
          description: "Es tu modelo por defecto. Se carga en memoria con el primer mensaje.",
        });
      }
    } catch (e) {
      toast.error("No se pudo añadir el modelo", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const cargar = async (nombre: string) => {
    try {
      await cargarModelo(nombre);
    } catch (e) {
      toast.error("No se pudo cargar el modelo", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const borrar = async (nombre: string) => {
    setBorrando(null);
    await borrarModelo(nombre);
    const quedan = await sincronizar();
    if (defaultModelKey === makeModelKey(GGUF_PROVIDER_ID, nombre)) {
      setSettings({ defaultModelKey: quedan[0] ? makeModelKey(GGUF_PROVIDER_ID, quedan[0]) : null });
    }
    toast.success(`«${nombreVisible(nombre)}» borrado de este navegador`);
  };

  const pasaDelEntrenado = !!est.contextoEntrenado && contexto > est.contextoEntrenado;
  const webgpu = typeof navigator !== "undefined" && "gpu" in navigator;

  return (
    <div className="space-y-3.5">
      {/* Elegir archivo: botón y zona para soltar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          void anadir(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "rounded-xl border border-dashed px-3 py-4 text-center transition-colors",
          arrastrando ? "border-emerald-500 bg-emerald-500/5" : "border-border/70"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gguf"
          multiple
          className="hidden"
          aria-label="Archivo .gguf"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void anadir(files);
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-10 gap-1.5"
          disabled={!!est.copiando}
          onClick={() => inputRef.current?.click()}
        >
          {est.copiando ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {est.copiando ? "Copiando…" : "Elegir archivo .gguf"}
        </Button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          O suéltalo aquí. Se guarda en este navegador y no sale de tu equipo. Si el modelo viene partido
          (<span className="font-mono">-00001-of-0000N</span>), elige todos los trozos a la vez.
        </p>
        {est.copiando && (
          <div className="mx-auto mt-2 max-w-xs" role="status" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full w-full origin-left rounded-full bg-emerald-500 transition-transform"
                style={{ transform: `scaleX(${est.copiando.progreso})` }}
              />
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              Guardando {nombreVisible(est.copiando.nombre)} · {Math.round(est.copiando.progreso * 100)} %
            </p>
          </div>
        )}
      </div>

      {!est.persistente && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-400">
          Este navegador no deja guardar archivos grandes del sitio: el modelo dura hasta que cierres la
          pestaña y tendrás que volver a elegirlo.
        </p>
      )}

      {/* Modelos guardados */}
      {est.modelos.length > 0 && (
        <ul className="space-y-1.5" aria-label="Modelos locales guardados">
          {est.modelos.map((m) => {
            const cargado = est.cargado === m.nombre;
            const cargando = est.cargando === m.nombre;
            const porDefecto = defaultModelKey === makeModelKey(GGUF_PROVIDER_ID, m.nombre);
            return (
              <li
                key={m.nombre}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  cargado ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60"
                )}
              >
                <div className="flex items-center gap-2">
                  <HardDrive className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12.5px]" title={m.nombre}>
                      {nombreVisible(m.nombre)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {tamanoLegible(m.bytes)}
                      {m.archivos.length > 1 && ` · ${m.archivos.length} trozos`}
                      {cargado && " · en memoria"}
                      {porDefecto && " · por defecto"}
                    </p>
                    {m.faltan > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Faltan {m.faltan} {m.faltan === 1 ? "trozo" : "trozos"}: elígelos para poder usarlo.
                      </p>
                    )}
                  </div>
                  {!porDefecto && !m.faltan && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setSettings({ defaultModelKey: makeModelKey(GGUF_PROVIDER_ID, m.nombre) })}
                    >
                      Usar este modelo
                    </Button>
                  )}
                  {cargado ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Sacar ${nombreVisible(m.nombre)} de la memoria`}
                      title="Sacar de la memoria (sigue guardado)"
                      onClick={() => void descargarModelo()}
                    >
                      <Power className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={!!m.faltan || !!est.cargando}
                      aria-label={`Cargar ${nombreVisible(m.nombre)} en memoria`}
                      title="Cargar en memoria ahora (si no, se carga con el primer mensaje)"
                      onClick={() => void cargar(m.nombre)}
                    >
                      {cargando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    </Button>
                  )}
                  {borrando === m.nombre ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void borrar(m.nombre)}
                    >
                      ¿Borrar {tamanoLegible(m.bytes)}?
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Borrar ${nombreVisible(m.nombre)}`}
                      onClick={() => setBorrando(m.nombre)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {est.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive">
          {est.error}
        </p>
      )}

      {/* Dónde corre y a qué velocidad */}
      <div className="grid grid-cols-2 gap-2 text-[11.5px]">
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2">
          {est.aceleracion === "webgpu" || (!est.aceleracion && webgpu) ? (
            <Zap className="size-3.5 shrink-0 text-emerald-500" />
          ) : (
            <Cpu className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 truncate">
            {est.aceleracion === "webgpu"
              ? "En la GPU (WebGPU)"
              : est.aceleracion === "cpu"
                ? "En la CPU"
                : webgpu
                  ? "WebGPU disponible"
                  : "Sin WebGPU: irá en la CPU"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2">
          <Gauge className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate tabular-nums">
            {est.tokensPorSegundo ? `${FMT_TOKS.format(est.tokensPorSegundo)} tokens/s` : "Sin medir aún"}
          </span>
        </div>
      </div>

      {/* Dónde corre: GPU o CPU */}
      <div className="space-y-1.5">
        <Label htmlFor="gguf-gpu" className="text-xs">
          Aceleración
        </Label>
        <select
          id="gguf-gpu"
          value={gpu}
          onChange={(e) => setGpu(e.target.value as typeof gpu)}
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          <option value="auto">Automática: GPU en ordenador, CPU en móvil</option>
          <option value="no">Solo CPU (más lento, lo más estable)</option>
          <option value="si">Probar la GPU también en el móvil</option>
        </select>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          En los móviles la GPU suele quedarse corta para un modelo de lenguaje y puede colgar el
          navegador. Si falla, la app pasa sola a «Solo CPU». Se aplica al cargar el modelo.
        </p>
      </div>

      {/* Contexto */}
      <div className="space-y-1.5">
        <Label htmlFor="gguf-contexto" className="text-xs">
          Contexto (tokens)
        </Label>
        <select
          id="gguf-contexto"
          value={contexto}
          onChange={(e) => setContexto(Number(e.target.value))}
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          {GGUF_CONTEXTOS.map((n) => (
            <option key={n} value={n}>
              {new Intl.NumberFormat("es").format(n)}
            </option>
          ))}
        </select>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Cuánta conversación cabe. Más contexto usa más memoria; se aplica al cargar el modelo
          {est.cargado ? " (sácalo de la memoria y vuelve a cargarlo para cambiarlo)" : ""}.
          {pasaDelEntrenado &&
            ` Este modelo admite como mucho ${new Intl.NumberFormat("es").format(est.contextoEntrenado ?? 0)}: se usará ese.`}
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Qué elegir: un modelo «Instruct» de 1-4B en Q4_K_M (0,7-2,5 GB) va fluido en un portátil. Los de
        7-8B funcionan con WebGPU y bastante memoria. Para el modo agente, mejor uno que sepa usar
        herramientas (Qwen 2.5/3, Llama 3.x): con otros, el agente usa su modo de texto.
      </p>
    </div>
  );
}
