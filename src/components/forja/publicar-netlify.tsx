"use client";
/** Forja IA — Diálogo «Publicar en Netlify» de la vista previa.
 *
 * Pide el token una vez (se guarda en este navegador, como las claves de
 * los modelos), sube el ZIP de lo que se ve y devuelve la URL pública. La
 * misma conversación vuelve a publicar en el MISMO sitio. */
import { useEffect, useState } from "react";
import { AlertTriangle, Check, CircleDashed, Copy, ExternalLink, Loader2, Rocket, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  URL_TOKEN_NETLIFY,
  guardarTokenNetlify,
  leerTokenNetlify,
  publicarEnNetlify,
  recordarSitio,
  sitioDeConversacion,
} from "@/lib/forja/netlify";
import { datosPendientes, puertaPublicacion, type EstadoEtapa, type PuertaPublicacion } from "@/lib/forja/pre-publicacion";
import { runProjectInMemory } from "@/lib/forja/sandbox-runner";
import { verifyWebProject } from "@/lib/forja/web-verifier";
import { pickEntryPath } from "@/lib/forja/sandbox";

/** Las comprobaciones antes de publicar (§41): ejecuta la página de verdad y
 *  pasa el verificador. `null` mientras se comprueba. */
async function comprobar(archivos: Record<string, string>): Promise<PuertaPublicacion> {
  const salida = await runProjectInMemory(archivos, { qa: true });
  const verificacion = verifyWebProject(archivos, {
    executed: salida.ejecutado,
    errors: salida.errors,
    errorLines: salida.errorLines,
    qa: salida.qa ?? null,
    htmlBytes: salida.htmlBytes,
  });
  const entrada = pickEntryPath(Object.keys(archivos));
  return puertaPublicacion(verificacion, entrada ? archivos[entrada] ?? null : null, datosPendientes(archivos));
}

const ICONO: Record<EstadoEtapa, { el: typeof Check; clase: string; texto: string }> = {
  ok: { el: Check, clase: "text-emerald-600 dark:text-emerald-400", texto: "bien" },
  aviso: { el: AlertTriangle, clase: "text-amber-600 dark:text-amber-400", texto: "aviso" },
  bloquea: { el: ShieldAlert, clase: "text-red-600 dark:text-red-400", texto: "bloquea" },
  "sin-dato": { el: CircleDashed, clase: "text-muted-foreground", texto: "sin dato" },
};

export function PublicarNetlify({
  open,
  onOpenChange,
  conversacionId,
  construirZip,
  archivos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversacionId?: string | null;
  /** el ZIP de lo que se publica, construido al pulsar (no antes) */
  construirZip: () => Uint8Array;
  /** los archivos que se van a publicar, para comprobarlos antes */
  archivos: Record<string, string>;
}) {
  const [token, setToken] = useState(() => leerTokenNetlify());
  const [recordar, setRecordar] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const sitio = sitioDeConversacion(conversacionId);
  // El resultado va atado a los archivos que se comprobaron: si cambian, no
  // vale y se vuelve a comprobar («comprobando…» mientras tanto).
  const [comprobado, setComprobado] = useState<{ para: Record<string, string>; puerta: PuertaPublicacion } | null>(null);
  const [forzar, setForzar] = useState(false);
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    void comprobar(archivos).then((p) => {
      if (!vivo) return;
      setComprobado({ para: archivos, puerta: p });
      setForzar(false);
    });
    return () => {
      vivo = false;
    };
  }, [open, archivos]);
  const puerta = comprobado?.para === archivos ? comprobado.puerta : null;
  const bloqueado = !puerta || (puerta.bloquea && !forzar);

  const publicar = async () => {
    setPublicando(true);
    setError(null);
    setUrl(null);
    const r = await publicarEnNetlify({ token, zip: construirZip(), siteId: sitio });
    setPublicando(false);
    if (!r.ok) {
      setError(r.motivo);
      return;
    }
    guardarTokenNetlify(recordar ? token : "");
    recordarSitio(conversacionId, r.siteId);
    setUrl(r.url);
    toast.success(r.nuevo ? "Sitio creado en Netlify" : "Sitio actualizado en Netlify", { description: r.url });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // «publicar igualmente» es una decisión de ESTA vez, no se arrastra
        if (!v) setForzar(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-primary" /> Publicar en Netlify
          </DialogTitle>
          <DialogDescription>
            {sitio
              ? "Esta conversación ya tiene sitio: se actualizará la misma URL."
              : "Se crea un sitio nuevo con URL pública (xxx.netlify.app). Gratis con tu cuenta de Netlify."}
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Token personal de Netlify
          <Input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="nfp_…"
            aria-label="Token de Netlify"
          />
        </label>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
            Recordarlo en este navegador
          </label>
          <a href={URL_TOKEN_NETLIFY} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            Crear un token
          </a>
        </div>

        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {url && (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">Publicado. Netlify tarda unos segundos en servirlo.</p>
            <div className="flex items-center gap-1.5">
              <code className="min-w-0 flex-1 truncate">{url}</code>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Copiar la URL"
                onClick={() => {
                  void navigator.clipboard?.writeText(url);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 1500);
                }}
              >
                {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="size-7" asChild aria-label="Abrir el sitio">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border/60 px-3 py-2" data-testid="puerta-publicacion">
          <p className="mb-1.5 text-xs font-medium">Antes de publicar</p>
          {!puerta ? (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Ejecutando la página y comprobándola…
            </p>
          ) : (
            <ul className="space-y-1">
              {puerta.etapas.map((e) => {
                const i = ICONO[e.estado];
                const Icono = i.el;
                return (
                  <li key={e.id} className="text-[11px]" data-estado={e.estado}>
                    <div className="flex items-center gap-1.5">
                      <Icono className={`size-3.5 shrink-0 ${i.clase}`} aria-hidden />
                      <span className="font-medium">{e.nombre}</span>
                      <span className="text-muted-foreground">· {i.texto}</span>
                    </div>
                    {e.estado !== "ok" && e.detalles.length > 0 && (
                      <p className="ml-5 text-muted-foreground">{e.detalles.slice(0, 2).join(" · ")}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {puerta?.bloquea && (
            <label className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
              <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
              Lo he revisado y quiero publicar igualmente
            </label>
          )}
        </div>

        <Button onClick={() => void publicar()} disabled={!token.trim() || publicando || bloqueado} className="gap-2">
          {publicando ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          {publicando ? "Publicando…" : sitio ? "Actualizar el sitio" : "Publicar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
