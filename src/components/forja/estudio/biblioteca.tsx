"use client";
/** FORJA IA — Estudio de diseño: la Biblioteca (interfaz).
 *
 * Imágenes que guían el diseño: inspiración subida, pantallas propias que
 * salieron bien y diseños guardados en Google Drive. Cada una lleva su paleta
 * extraída; al elegirlas en un proyecto viajan al modelo (paleta siempre,
 * imagen si el modelo ve). */

import { useEffect, useRef, useState } from "react";
import { Check, Cloud, ImagePlus, Loader2, Monitor, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GDrivePickerButton } from "@/components/forja/gdrive-picker-button";
import { gdGetAccounts, gdGetCreds } from "@/lib/forja/gdrive";
import { gdReadKBFile } from "@/lib/forja/gdrive-kb";
import { useBiblioteca, imagenDe } from "@/lib/forja/estudio/biblioteca-store";
import { nombreDeArchivo } from "@/lib/forja/estudio/biblioteca";
import { prepararImagen, leerArchivo } from "@/lib/forja/estudio/imagenes";
import { MAX_REFERENCIAS_PROYECTO } from "@/lib/forja/estudio/proyecto";
import type { OrigenReferencia, Referencia } from "@/lib/forja/estudio/tipos";

/* ------------------------------ miniaturas ------------------------------ */

// Cada imagen se lee de IndexedDB una vez por sesión: la rejilla y los
// selectores la piden muchas veces.
const cache = new Map<string, string | null>();

function Miniatura({ r, className }: { r: Referencia; className?: string }) {
  const [url, setUrl] = useState<string | null | undefined>(() => cache.get(r.blobId));
  useEffect(() => {
    if (cache.has(r.blobId)) return;
    let vivo = true;
    void imagenDe(r).then((u) => {
      cache.set(r.blobId, u);
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [r]);
  if (url === undefined) return <div className={cn("animate-pulse bg-muted/50", className)} />;
  if (url === null)
    return (
      <div className={cn("grid place-items-center bg-muted/40 text-[11px] text-muted-foreground", className)}>
        Imagen no disponible
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element -- data URL local, next/image no aporta nada
  return <img src={url} alt={r.nombre} className={cn("object-cover object-top", className)} />;
}

export function Paleta({ colores, className }: { colores: string[]; className?: string }) {
  if (!colores.length) return null;
  return (
    <span className={cn("inline-flex overflow-hidden rounded-md border border-border/60", className)} aria-label={`Paleta: ${colores.join(", ")}`}>
      {colores.map((c) => (
        <span key={c} className="size-3.5" style={{ background: c }} title={c} />
      ))}
    </span>
  );
}

const ORIGEN: Record<OrigenReferencia, { nombre: string; Icono: typeof Upload }> = {
  subida: { nombre: "Subida", Icono: Upload },
  pantalla: { nombre: "Pantalla", Icono: Monitor },
  drive: { nombre: "Drive", Icono: Cloud },
};

/* ------------------------------ añadir ------------------------------ */

/** Prepara (reduce + paleta) y guarda una imagen. null si algo falló. */
export async function guardarEnBiblioteca(
  src: string,
  nombre: string,
  origen: OrigenReferencia,
  proyectoId?: string
): Promise<Referencia | null> {
  const im = await prepararImagen(src);
  const r = await useBiblioteca.getState().agregar({ nombre, origen, proyectoId, ...im });
  if (r) cache.set(r.blobId, im.dataUrl);
  return r;
}

function useAnadir() {
  const [ocupado, setOcupado] = useState(false);
  const lote = async (items: { nombre: string; leer: () => Promise<string>; origen: OrigenReferencia }[]) => {
    if (!items.length) return;
    setOcupado(true);
    let ok = 0;
    const fallos: string[] = [];
    for (const it of items) {
      try {
        const src = await it.leer();
        const r = await guardarEnBiblioteca(src, it.nombre, it.origen);
        if (src.startsWith("blob:")) URL.revokeObjectURL(src);
        if (r) ok++;
        else fallos.push(`${it.nombre} (sin espacio en el navegador)`);
      } catch (e) {
        fallos.push(`${it.nombre}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setOcupado(false);
    if (ok) toast.success(`${ok} imagen${ok > 1 ? "es" : ""} en la Biblioteca`);
    if (fallos.length) toast.error(`No se pudieron añadir ${fallos.length}`, { description: fallos.slice(0, 3).join(" · ") });
  };
  return { ocupado, lote };
}

function BotonSubir({ onArchivos, ocupado, compacto }: { onArchivos: (f: File[]) => void; ocupado: boolean; compacto?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="biblioteca-archivo"
        onChange={(e) => {
          const fs = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/"));
          e.target.value = "";
          onArchivos(fs);
        }}
      />
      <Button size="sm" variant={compacto ? "outline" : "default"} disabled={ocupado} onClick={() => ref.current?.click()} className="gap-1.5">
        {ocupado ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
        Subir imágenes
      </Button>
    </>
  );
}

function BotonDrive({ onElegidos }: { onElegidos: (fs: { id: string; name: string; mimeType: string; email: string }[]) => void }) {
  const cuenta = gdGetAccounts()[0];
  const creds = gdGetCreds();
  if (!cuenta || !creds) return null;
  return (
    <span className="inline-flex items-center rounded-lg border border-border/60 px-1">
      <Cloud className="ml-1 size-3.5 text-muted-foreground" />
      <GDrivePickerButton
        creds={creds}
        accessToken={cuenta.accessToken}
        onPicked={(fs) => onElegidos(fs.map((f) => ({ ...f, email: cuenta.email })))}
      />
    </span>
  );
}

/** Subir + Drive, para la Biblioteca y para el selector del proyecto. */
function Anadir({ compacto }: { compacto?: boolean }) {
  const { ocupado, lote } = useAnadir();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BotonSubir
        compacto={compacto}
        ocupado={ocupado}
        onArchivos={(fs) =>
          void lote(fs.map((f) => ({ nombre: nombreDeArchivo(f.name), origen: "subida" as const, leer: () => leerArchivo(f) })))
        }
      />
      <BotonDrive
        onElegidos={(fs) => {
          const imgs = fs.filter((f) => f.mimeType.startsWith("image/"));
          if (imgs.length < fs.length) toast.warning("Solo se añaden imágenes (PNG, JPG, WebP…)");
          void lote(
            imgs.map((f) => ({
              nombre: nombreDeArchivo(f.name),
              origen: "drive" as const,
              leer: async () => {
                const bytes = await gdReadKBFile({ id: f.id, remoteId: f.id, accountEmail: f.email, mimeType: f.mimeType, name: f.name });
                return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: f.mimeType }));
              },
            }))
          );
        }}
      />
    </div>
  );
}

/* ------------------------------ vista de la Biblioteca ------------------------------ */

export function VistaBiblioteca() {
  const referencias = useBiblioteca((s) => s.referencias);
  const renombrar = useBiblioteca((s) => s.renombrar);
  const borrar = useBiblioteca((s) => s.borrar);
  const [aBorrar, setABorrar] = useState<string | null>(null);

  return (
    <section className="space-y-4" aria-label="Biblioteca">
      <div className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight">Biblioteca</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Diseños que te gustan, capturas y pantallas tuyas que salieron bien. Elígelas al crear un proyecto: FORJA usa su paleta y, si el
          modelo ve imágenes, también su composición.
        </p>
        <div className="mt-3">
          <Anadir />
        </div>
      </div>

      {referencias.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-[12.5px] text-muted-foreground">
          Aún no hay nada. Sube imágenes, elígelas de Drive o guarda una pantalla desde un proyecto con «A biblioteca».
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {referencias.map((r) => {
            const { nombre, Icono } = ORIGEN[r.origen];
            return (
              <figure key={r.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card/50" data-testid="referencia">
                <Miniatura r={r} className="aspect-[4/3] w-full" />
                <figcaption className="space-y-1.5 p-2">
                  <Input
                    value={r.nombre}
                    onChange={(e) => renombrar(r.id, e.target.value)}
                    aria-label="Nombre de la referencia"
                    className="h-7 text-[12px]"
                  />
                  <div className="flex items-center justify-between gap-1">
                    <Paleta colores={r.paleta} />
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Icono className="size-3" /> {nombre}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn("h-7 w-full text-[11.5px]", aBorrar === r.id && "text-red-500")}
                    onClick={() => {
                      if (aBorrar !== r.id) {
                        setABorrar(r.id);
                        setTimeout(() => setABorrar((x) => (x === r.id ? null : x)), 3000);
                        return;
                      }
                      cache.delete(r.blobId);
                      void borrar(r.id);
                    }}
                  >
                    <Trash2 className="size-3.5" /> {aBorrar === r.id ? "¿Seguro?" : "Borrar"}
                  </Button>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ selector para un proyecto ------------------------------ */

export function SelectorReferencias({ elegidas, onCambio }: { elegidas: readonly string[]; onCambio: (ids: string[]) => void }) {
  const referencias = useBiblioteca((s) => s.referencias);
  const lleno = elegidas.length >= MAX_REFERENCIAS_PROYECTO;
  const alternar = (id: string) => {
    if (elegidas.includes(id)) return onCambio(elegidas.filter((x) => x !== id));
    if (lleno) return toast.error(`Como mucho ${MAX_REFERENCIAS_PROYECTO} referencias por proyecto`);
    onCambio([...elegidas, id]);
  };
  return (
    <div className="space-y-2">
      {referencias.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Sube imágenes que te inspiren y FORJA seguirá su paleta y su estilo.</p>
      ) : (
        <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto" role="group" aria-label="Referencias">
          {referencias.map((r) => {
            const on = elegidas.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                title={r.nombre}
                onClick={() => alternar(r.id)}
                className={cn(
                  "relative w-24 overflow-hidden rounded-lg border-2 text-left",
                  on ? "border-orange-500" : "border-transparent opacity-80 hover:opacity-100"
                )}
              >
                <Miniatura r={r} className="h-16 w-full" />
                <span className="block truncate px-1 py-0.5 text-[10.5px]">{r.nombre}</span>
                {on && (
                  <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-orange-500 text-white">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <Anadir compacto />
    </div>
  );
}

/** Las referencias de un proyecto en pequeño (barra del editor). */
export function ChipsReferencias({ ids }: { ids: readonly string[] }) {
  const referencias = useBiblioteca((s) => s.referencias);
  const refs = ids.map((id) => referencias.find((r) => r.id === id)).filter((r): r is Referencia => !!r);
  if (!refs.length) return null;
  return (
    <span className="inline-flex -space-x-2">
      {refs.map((r) => (
        <Miniatura key={r.id} r={r} className="size-7 rounded-md border-2 border-background" />
      ))}
    </span>
  );
}
