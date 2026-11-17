"use client";
/** Forja IA — Panel del motor OpenCode (solo dentro de la APK de Android).
 *
 * El OpenCode oficial corre dentro de la app (Alpine + PRoot), como en OpenCode
 * Mobile: se instala una vez, arranca solo y sus modelos gratis se cargan y se
 * usan sin API key ni contraseña. Lo pesado lo hace el lado nativo
 * (`android/forja-app`); esto pide y enseña lo que el puente avisa. */
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Play, Power, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { escucharAndroid, estadoOpenCodeNativo, puenteAndroid, type EstadoOpenCode } from "@/lib/forja/plataforma";
import { aplicarOpenCodeListo } from "@/lib/forja/opencode-nativo";
import { useForja } from "@/lib/forja/store";
import { MOTOR_PROVIDER_ID } from "@/lib/forja/opencode-motor";

export function OpenCodePanel() {
  const puente = puenteAndroid();
  const [oc, setOc] = useState<EstadoOpenCode | null>(null);
  const [recargando, setRecargando] = useState(false);
  const modelos = useForja((s) => s.providers[MOTOR_PROVIDER_ID]?.models ?? []);

  useEffect(() => {
    if (!puente) return;
    const releer = () => setOc(estadoOpenCodeNativo());
    releer();
    void puente.listo?.then(releer);
    return escucharAndroid((e) => {
      if (e.tipo === "estado") releer();
      if (e.tipo === "opencode") setOc(e.estado);
    });
  }, [puente]);

  if (!puente) return null;
  if (typeof puente.instalarOpenCode !== "function") {
    return (
      <div className="border-t border-border/50 px-3 py-3 text-xs text-muted-foreground">
        Esta versión de la app no incluye el motor OpenCode. Actualiza Forja IA desde Ajustes → Proveedores → Modelo nativo → Buscar actualización.
      </div>
    );
  }

  const estado = oc?.estado ?? "parado";
  const instalado = oc?.instalado ?? false;
  const pct = Math.max(0, Math.min(100, Math.round((oc?.progreso ?? 0) / 10)));

  const recargar = async () => {
    if (!oc || oc.estado !== "listo") return;
    setRecargando(true);
    try {
      const m = await aplicarOpenCodeListo(oc);
      toast[m.length ? "success" : "info"](m.length ? `${m.length} modelos gratis cargados` : "El motor no ofrece modelos gratis ahora mismo");
    } catch (e) {
      toast.error("No se pudieron cargar los modelos", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRecargando(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-border/50 px-3 py-3" data-testid="panel-opencode">
      <p className="text-xs leading-relaxed text-muted-foreground">
        El OpenCode oficial corre dentro de esta app. Sus modelos gratis se cargan y se usan <b>sin API key ni contraseña</b>.
      </p>

      {estado === "listo" && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" /> Motor activo{oc?.version ? ` · OpenCode ${oc.version}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {modelos.length
              ? `${modelos.length} modelos gratis disponibles en el selector.`
              : "Cargando los modelos gratis…"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={recargar} disabled={recargando}>
              {recargando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Recargar modelos
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => puente.detenerOpenCode?.()}>
              <Power className="size-3.5" /> Detener motor
            </Button>
          </div>
        </div>
      )}

      {(estado === "instalando" || estado === "arrancando") && (
        <div className="space-y-1.5" aria-live="polite">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Loader2 className="size-4 animate-spin" /> {estado === "instalando" ? "Instalando el motor" : "Arrancando el motor"}
          </p>
          {estado === "instalando" && (
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-forja-violet transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">{oc?.mensaje ?? "Un momento…"}{estado === "instalando" ? ` · ${pct}%` : ""}</p>
          {estado === "instalando" && (
            <p className="text-[11px] text-muted-foreground">Puedes seguir usando la app; si se corta, continúa donde quedó.</p>
          )}
        </div>
      )}

      {estado === "parado" && !instalado && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Descarga única de varios cientos de MB (Alpine Linux y OpenCode). Mejor con Wi-Fi y con batería. Si se corta, continúa donde quedó.
          </p>
          <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={() => puente.instalarOpenCode?.()} data-testid="instalar-opencode">
            <Download className="size-3.5" /> Instalar el motor
          </Button>
        </div>
      )}

      {estado === "parado" && instalado && (
        <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={() => puente.iniciarOpenCode?.()}>
          <Play className="size-3.5" /> Iniciar el motor
        </Button>
      )}

      {estado === "error" && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <TriangleAlert className="size-4" /> No se pudo arrancar el motor
          </p>
          <p className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">
            {oc?.mensaje ?? "Error desconocido"}
          </p>
          <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={() => (instalado ? puente.iniciarOpenCode?.() : puente.instalarOpenCode?.())}>
            <RefreshCw className="size-3.5" /> Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
