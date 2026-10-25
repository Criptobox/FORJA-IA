"use client";
/** Forja IA — «OpenCode» dentro de Forja: el catálogo de modelos gratis, vivo.
 *
 * No hay URL ni servidor que montar: el proveedor ya viene configurado. Aquí
 * se ve lo que OpenCode ofrece gratis HOY (se actualiza solo), se conecta la
 * clave gratuita de tu cuenta una vez y se elige un modelo con un toque.
 */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, RefreshCw, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForja } from "@/lib/forja/store";
import { fetchModels } from "@/lib/forja/chat-client";
import { makeModelKey } from "@/lib/forja/types";
import {
  cargarCatalogoOpenCode,
  catalogoGuardado,
  sincronizarModelos,
  type CatalogoOpenCode,
} from "@/lib/forja/opencode-client";
import { cn } from "@/lib/utils";

function contexto(n?: number): string | null {
  if (!n) return null;
  return n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M ctx` : `${Math.round(n / 1000)}K ctx`;
}

function hace(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

export function OpenCodeDialog({
  open,
  onOpenChange,
  onUseModel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** elige el modelo en el chat: llega la clave «proveedor::modelo» */
  onUseModel: (modelKey: string) => void;
}) {
  const cfg = useForja((s) => s.providers.opencode);
  const setProviderConfig = useForja((s) => s.setProviderConfig);
  const conectado = !!cfg?.apiKey?.trim();

  const [catalogo, setCatalogo] = useState<CatalogoOpenCode | null>(null);
  const [cargando, setCargando] = useState(false);
  const [clave, setClave] = useState("");
  const [conectando, setConectando] = useState(false);
  const [errorClave, setErrorClave] = useState<string | null>(null);

  const cargar = useCallback(async (forzar: boolean) => {
    setCargando(true);
    try {
      setCatalogo(await cargarCatalogoOpenCode(forzar));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setCatalogo((actual) => actual ?? catalogoGuardado());
    void cargar(false);
  }, [open, cargar]);

  const conectar = async () => {
    const k = clave.trim();
    if (k.length < 8) {
      setErrorClave("Pega la clave completa que te da opencode.ai/auth.");
      return;
    }
    setConectando(true);
    setErrorClave(null);
    try {
      // comprobar la clave de verdad antes de guardarla: lista los modelos con ella
      await fetchModels("opencode", { ...cfg, apiKey: k, useProxy: true });
      const vivos = (catalogo?.models ?? []).map((m) => m.id);
      setProviderConfig("opencode", {
        apiKey: k,
        enabled: true,
        useProxy: true,
        models: sincronizarModelos(cfg?.models ?? [], vivos),
      });
      setClave("");
      toast.success("OpenCode conectado");
    } catch (e) {
      setErrorClave(e instanceof Error ? e.message : "No se pudo comprobar la clave.");
    } finally {
      setConectando(false);
    }
  };

  const usar = (id: string) => {
    const actuales = cfg?.models ?? [];
    if (!actuales.includes(id)) setProviderConfig("opencode", { models: [...actuales, id] });
    setProviderConfig("opencode", { enabled: true });
    onUseModel(makeModelKey("opencode", id));
    onOpenChange(false);
    toast.success(`Usando ${id}`);
  };

  const lista = catalogo?.models ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-border/70 bg-background/95 p-0 backdrop-blur-xl sm:h-auto sm:max-h-[88vh] sm:w-[min(640px,96vw)] sm:max-w-none sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12 text-left sm:px-5 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-500 ring-1 ring-sky-500/25">
              <Terminal className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">OpenCode · modelos gratis</DialogTitle>
              <DialogDescription className="line-clamp-2 text-xs">
                El catálogo gratuito de OpenCode Zen, al día. Elige uno y úsalo en el chat.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-5">
          {/* Conexión */}
          <section className="raise rounded-2xl border border-border/60 bg-card p-3.5">
            {conectado ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="font-medium">Cuenta de OpenCode conectada</span>
                <button
                  type="button"
                  className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setProviderConfig("opencode", { apiKey: "", enabled: false })}
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="size-4 text-sky-500" /> Conecta tu cuenta (una sola vez)
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  OpenCode pide una clave de tu cuenta para dejar usar sus modelos desde otra app. Créala en{" "}
                  <a className="inline-flex items-center gap-0.5 text-sky-500 underline-offset-2 hover:underline" href="https://opencode.ai/auth" target="_blank" rel="noreferrer">
                    opencode.ai/auth <ExternalLink className="size-3" />
                  </a>{" "}
                  y pégala aquí. Se guarda solo en este dispositivo.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder="Clave de OpenCode"
                    type="password"
                    autoComplete="off"
                    aria-label="Clave de OpenCode"
                    className="h-10"
                  />
                  <Button type="button" className="h-10 shrink-0" onClick={() => void conectar()} disabled={conectando}>
                    {conectando ? <Loader2 className="size-4 animate-spin" /> : "Conectar"}
                  </Button>
                </div>
                {errorClave && <p className="text-xs text-destructive">{errorClave}</p>}
              </div>
            )}
          </section>

          {/* Catálogo */}
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Gratis ahora{lista.length ? ` · ${lista.length}` : ""}
            </h3>
            <button
              type="button"
              onClick={() => void cargar(true)}
              disabled={cargando}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-label="Actualizar el catálogo de OpenCode"
            >
              <RefreshCw className={cn("size-3.5", cargando && "animate-spin")} />
              {catalogo ? (catalogo.live ? `Actualizado ${hace(catalogo.fetchedAt)}` : "Sin conexión · lista guardada") : "Cargando…"}
            </button>
          </div>

          {!catalogo && cargando ? (
            <p className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando los modelos gratis de hoy…
            </p>
          ) : (
            <ul className="space-y-2">
              {lista.map((m) => (
                <li key={m.id} className="raise flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold leading-tight">{m.name}</p>
                    <p className="break-all font-mono text-[11px] leading-tight text-muted-foreground">{m.id}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Gratis</span>
                      {contexto(m.context) && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{contexto(m.context)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0"
                    disabled={!conectado}
                    onClick={() => usar(m.id)}
                    aria-label={`Usar ${m.id}`}
                  >
                    Usar
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!conectado && lista.length > 0 && (
            <p className="px-1 text-xs text-muted-foreground">Conecta tu cuenta arriba para poder usar estos modelos.</p>
          )}
          <p className="px-1 pt-1 text-[11px] leading-relaxed text-muted-foreground">
            Los modelos gratuitos de terceros pueden usar tus mensajes para mejorar: no envíes datos sensibles. La lista
            y los límites cambian a menudo; por eso se actualiza sola.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
