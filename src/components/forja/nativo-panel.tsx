"use client";
/** Forja IA — Panel del motor nativo (solo dentro de la APK de Android).
 *
 * llama.cpp compilado para el móvil, servido por la propia app en 127.0.0.1.
 * Aquí se importan los .gguf, se arranca y se para el motor, y se actualiza la
 * app. Lo pesado lo hace el lado nativo (`android/forja-app`); esto solo pide
 * y enseña lo que el puente avisa. */
import { useEffect, useState } from "react";
import { Cpu, Download, FileUp, HardDrive, Loader2, Play, Power, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  escucharAndroid,
  leerJson,
  puenteAndroid,
  type EstadoMotor,
  type InfoAndroid,
  type ModeloNativo,
} from "@/lib/forja/plataforma";
import { useNativoAjustes, aplicarMotorListo } from "@/lib/forja/nativo";
import { nombreVisible, tamanoLegible } from "@/lib/forja/gguf-mensajes";
import { cn } from "@/lib/utils";

const CONTEXTOS = [4096, 8192, 16384, 32768] as const;
const FMT = new Intl.NumberFormat("es");

export function NativoPanel() {
  const puente = puenteAndroid();
  const [info, setInfo] = useState<InfoAndroid | null>(null);
  const [modelos, setModelos] = useState<ModeloNativo[]>([]);
  const [motor, setMotor] = useState<EstadoMotor | null>(null);
  const [importando, setImportando] = useState<{ nombre: string; progreso: number } | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [actualizacion, setActualizacion] = useState<string | null>(null);
  const [descarga, setDescarga] = useState<number | null>(null);
  const aj = useNativoAjustes();

  useEffect(() => {
    if (!puente) return;
    const releer = () => {
      setInfo(leerJson<InfoAndroid | null>(puente.info(), null));
      setModelos(leerJson<ModeloNativo[]>(puente.modelos(), []));
      setMotor(leerJson<EstadoMotor | null>(puente.estadoMotor(), null));
    };
    releer();
    void puente.listo?.then(releer);
    return escucharAndroid((e) => {
      if (e.tipo === "estado") releer();
      if (e.tipo === "importando") setImportando({ nombre: e.nombre, progreso: e.progreso });
      if (e.tipo === "importado") {
        setImportando(null);
        aj.set({ modelo: e.nombre });
        releer();
      }
      if (e.tipo === "motor") {
        setMotor(e.estado);
        if (e.estado.estado === "listo") aplicarMotorListo(e.estado);
      }
      if (e.tipo === "actualizacion") {
        setActualizacion(
          e.error
            ? `No se pudo comprobar: ${e.error}`
            : e.disponible
              ? `Hay una versión nueva: ${e.version}`
              : "Tienes la última versión."
        );
      }
      if (e.tipo === "descarga") setDescarga(e.error ? null : e.progreso);
      if (e.tipo === "error") {
        setImportando(null);
        setActualizacion(e.mensaje);
      }
    });
    // el puente no cambia mientras la página vive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!puente) {
    return (
      <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
        El motor nativo solo existe dentro de la app Android de Forja. En el navegador usa «Modelo local
        (.gguf)», que corre aquí mismo con WebAssembly.
      </p>
    );
  }

  const elegido = aj.modelo && modelos.some((m) => m.nombre === aj.modelo) ? aj.modelo : modelos[0]?.nombre ?? null;
  const activo = motor?.estado === "listo" || motor?.estado === "cargando";

  return (
    <div className="space-y-3.5">
      {info && (
        <p className="text-[11.5px] text-muted-foreground">
          Forja {info.version} · RAM libre {FMT.format(Math.round(info.ramDisponibleMB / 1024))} de{" "}
          {FMT.format(Math.round(info.ramTotalMB / 1024))} GB · {info.nucleos} núcleos
        </p>
      )}

      <div className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center">
        <Button type="button" size="sm" className="h-10 gap-1.5" disabled={!!importando} onClick={() => puente.elegirModelo()}>
          {importando ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {importando ? "Importando…" : "Importar modelo .gguf"}
        </Button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Se copia dentro de la app (no hace falta mantener el archivo original).
        </p>
        {importando && (
          <div className="mx-auto mt-2 max-w-xs" role="status" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full w-full origin-left rounded-full bg-emerald-500 transition-transform"
                style={{ transform: `scaleX(${importando.progreso})` }}
              />
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {nombreVisible(importando.nombre)} · {Math.round(importando.progreso * 100)} %
            </p>
          </div>
        )}
      </div>

      {modelos.length > 0 && (
        <ul className="space-y-1.5" aria-label="Modelos nativos">
          {modelos.map((m) => (
            <li
              key={m.nombre}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                elegido === m.nombre ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60"
              )}
            >
              <HardDrive className="size-4 shrink-0 text-muted-foreground" />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => aj.set({ modelo: m.nombre })}
                aria-pressed={elegido === m.nombre}
              >
                <span className="block truncate font-mono text-[12.5px]">{nombreVisible(m.nombre)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {tamanoLegible(m.bytes)}
                  {motor?.modelo === m.nombre && motor.estado === "listo" && " · en marcha"}
                </span>
              </button>
              {borrando === m.nombre ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setBorrando(null);
                    puente.borrarModelo(m.nombre);
                    setModelos(leerJson<ModeloNativo[]>(puente.modelos(), []));
                  }}
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
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="nativo-contexto" className="text-xs">
            Contexto (tokens)
          </Label>
          <select
            id="nativo-contexto"
            value={aj.contexto}
            onChange={(e) => aj.set({ contexto: Number(e.target.value) })}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {CONTEXTOS.map((n) => (
              <option key={n} value={n}>
                {FMT.format(n)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nativo-hilos" className="text-xs">
            Hilos de CPU
          </Label>
          <select
            id="nativo-hilos"
            value={aj.hilos}
            onChange={(e) => aj.set({ hilos: Number(e.target.value) })}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {[2, 4, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Con 16.384 de contexto caben las herramientas del agente. Más hilos no siempre es más rápido: los
        núcleos pequeños frenan a los grandes; 4 suele ir bien.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {activo ? (
          <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={() => puente.detener()}>
            <Power className="size-4" /> Parar motor
          </Button>
        ) : (
          <Button
            type="button"
            className="h-10 gap-1.5"
            disabled={!elegido}
            onClick={() => elegido && puente.iniciar(elegido, aj.contexto, aj.hilos)}
          >
            <Play className="size-4" /> Arrancar con este modelo
          </Button>
        )}
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground" role="status" aria-live="polite">
          {motor?.estado === "cargando" && <Loader2 className="size-3.5 animate-spin" />}
          {motor?.estado === "listo" && <Cpu className="size-3.5 text-emerald-500" />}
          {motor?.estado === "listo"
            ? `En marcha: ${nombreVisible(motor.modelo ?? "")}`
            : motor?.estado === "cargando"
              ? "Cargando el modelo…"
              : motor?.estado === "error"
                ? "No arrancó"
                : "Parado"}
        </span>
      </div>
      {motor?.estado === "error" && motor.detalle && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive">
          {motor.detalle}
        </p>
      )}

      <div className="space-y-1.5 border-t border-border/50 pt-3">
        <p className="text-xs font-medium">Actualizar la app</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => {
              setActualizacion("Comprobando…");
              puente.buscarActualizacion();
            }}
          >
            <RefreshCw className="size-3.5" /> Buscar actualización
          </Button>
          {actualizacion?.startsWith("Hay una versión nueva") && (
            <Button type="button" size="sm" className="h-9 gap-1.5" disabled={descarga != null} onClick={() => puente.instalarActualizacion()}>
              <Download className="size-3.5" />
              {descarga != null ? `Descargando ${Math.round(descarga * 100)} %` : "Actualizar ahora"}
            </Button>
          )}
        </div>
        {actualizacion && (
          <p className="text-[11.5px] text-muted-foreground" role="status" aria-live="polite">
            {actualizacion}
          </p>
        )}
      </div>
    </div>
  );
}
