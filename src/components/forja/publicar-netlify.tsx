"use client";
/** Forja IA — Diálogo «Publicar en Netlify» de la vista previa.
 *
 * Pide el token una vez (se guarda en este navegador, como las claves de
 * los modelos), sube el ZIP de lo que se ve y devuelve la URL pública. La
 * misma conversación vuelve a publicar en el MISMO sitio. */
import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Rocket } from "lucide-react";
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

export function PublicarNetlify({
  open,
  onOpenChange,
  conversacionId,
  construirZip,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversacionId?: string | null;
  /** el ZIP de lo que se publica, construido al pulsar (no antes) */
  construirZip: () => Uint8Array;
}) {
  const [token, setToken] = useState(() => leerTokenNetlify());
  const [recordar, setRecordar] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const sitio = sitioDeConversacion(conversacionId);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        <Button onClick={() => void publicar()} disabled={!token.trim() || publicando} className="gap-2">
          {publicando ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          {publicando ? "Publicando…" : sitio ? "Actualizar el sitio" : "Publicar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
