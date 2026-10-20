"use client";
/** Forja IA — "Conocimiento": un solo panel con todo lo de la Knowledge
 * Base (Fase 2 del plan, §9.2), no un apartado por un lado y otro por
 * otro — el usuario lo pidió explícito tras ver Drive y Conocimiento como
 * dos diálogos separados: "la idea era un panel con todo... todo los
 * datos de ese tipo en 1 solo lugar".
 *
 * Dos columnas: a la izquierda, importar y ver los recursos indexados; a
 * la derecha, las cuentas de Google Drive conectadas (`gdrive-dialog.tsx`,
 * como `<DriveAccountsPanel>` — ya no es su propio diálogo). En móvil se
 * apilan.
 *
 * Formas de llenar el índice: "Importar recursos" (sube del dispositivo,
 * `kb-import.tsx` clasifica con el modelo activo y decide cuenta/carpeta
 * de Drive), "Elegir en Drive" (el Picker, sobre archivos que ya
 * existían) y "+ Añadir" en los archivos recientes de cada cuenta —
 * las tres viven ahora en el mismo sitio.
 */
import { useState } from "react";
import { Check, Database, ExternalLink, FileText, GitCompareArrows, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes } from "@/lib/forja/gdrive-oauth";
import { gdGetCreds } from "@/lib/forja/gdrive";
import type { KBResource, KBResourceStatus } from "@/lib/forja/kb-index";
import { acceptAsRelated, discardDuplicateFromIndex, getVisualReviewPair, getVisualReviewQueue, keepBothVisualResources } from "@/lib/forja/kb-review";
import { kbGetProjectManifest } from "@/lib/forja/kb-projects";
import { useKbIndex } from "./kb-connect";
import { useGdriveAccounts } from "./gdrive-connect";
import { DriveAccountsPanel } from "./gdrive-dialog";
import { MegaPanel } from "./mega-dialog";
import { MegaKBImport } from "./mega-kb-import";
import { KBImport } from "./kb-import";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<KBResourceStatus, string> = {
  nuevo: "Nuevo",
  clasificado: "Clasificado",
  pendiente: "Pendiente",
  "revision-duplicado": "Revisar similitud",
};

const STATUS_DOT: Record<KBResourceStatus, string> = {
  nuevo: "bg-sky-500",
  clasificado: "bg-emerald-500",
  pendiente: "bg-amber-500",
  "revision-duplicado": "bg-orange-500",
};

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5 text-center">
      <p className="text-sm font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[10px] leading-none text-muted-foreground">{label}</p>
    </div>
  );
}

function ResourceRow({
  resource,
  onUpdate,
  onRemove,
}: {
  resource: KBResource;
  onUpdate: (patch: Partial<Pick<KBResource, "category" | "tags" | "technology" | "license" | "status">>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState(resource.category);
  const [technology, setTechnology] = useState(resource.technology);
  const [license, setLicense] = useState(resource.license);
  const [tagsText, setTagsText] = useState(resource.tags.join(", "));

  const save = () => {
    onUpdate({
      category: category.trim(),
      technology: technology.trim(),
      license: license.trim(),
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: "clasificado",
    });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <FileText className="size-8 shrink-0 rounded-lg bg-muted p-1.5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{resource.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {resource.accountEmail} · {formatBytes(resource.sizeBytes)}
            {resource.category ? ` · ${resource.category}` : ""}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("size-2 rounded-full", STATUS_DOT[resource.status])} />
          {STATUS_LABEL[resource.status]}
        </span>
      </div>

      {resource.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {resource.tags.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}

      {resource.projectManifestId && (() => {
        const manifest = kbGetProjectManifest(resource.projectManifestId);
        if (!manifest) return null;
        return (
          <p className="mt-1.5 text-[10.5px] text-muted-foreground">
            Proyecto analizado: {manifest.totalFiles} archivos ·{" "}
            {manifest.technologies.join(", ") || "stack no detectado"}
            {manifest.frameworks.length ? ` · ${manifest.frameworks.join(", ")}` : ""}
            {manifest.components.length ? ` · ${manifest.components.length} componentes` : ""}
          </p>
        );
      })()}

      <div className="mt-1.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-forja-violet underline underline-offset-2"
        >
          {expanded ? "Ocultar" : "Categoría / etiquetas"}
        </button>
        <a
          href={resource.webViewLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3" /> Abrir en Drive
        </a>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500"
        >
          <Trash2 className="size-3" /> Quitar del índice
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10.5px]">Categoría</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="ej. componentes-ui"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10.5px]">Tecnología</Label>
              <Input
                value={technology}
                onChange={(e) => setTechnology(e.target.value)}
                placeholder="ej. React"
                className="h-7 text-xs"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10.5px]">Etiquetas (separadas por coma)</Label>
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="dashboard, oscuro, tarjetas"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10.5px]">Licencia / fuente</Label>
              <Input
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                placeholder="ej. propio, MIT, captura personal"
                className="h-7 text-xs"
              />
            </div>
          </div>
          <Button type="button" size="sm" className="h-7 text-[11px]" onClick={save}>
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}

/** `resources` viene de `useKbIndex()`, que ya escucha `KB_INDEX_EVENT` y se
 * refresca solo tras cada `kbUpdateResource`/`kbRemoveResource` — las tres
 * acciones de abajo llaman a esas funciones, así que no hace falta ningún
 * `refresh()` manual aparte: duplicaría un mecanismo que ya existe. */
function VisualReviewQueue({ resources }: { resources: KBResource[] }) {
  const queue = getVisualReviewQueue(resources);
  if (!queue.length) return null;
  return (
    <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <GitCompareArrows className="size-4 text-orange-500" />
        <div>
          <p className="text-xs font-semibold">Revisión visual</p>
          <p className="text-[10.5px] text-muted-foreground">Forja encontró recursos visualmente parecidos. Ningún archivo remoto se borra automáticamente.</p>
        </div>
      </div>
      <div className="space-y-2">
        {queue.map((item) => {
          const pair = getVisualReviewPair(item, resources);
          const original = pair.original;
          return (
            <div key={item.id} className="rounded-lg border border-border/60 bg-background/60 p-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="min-w-0 rounded-md border border-border/50 p-2">
                  <p className="truncate text-[11px] font-medium">Nuevo: {item.name}</p>
                  <p className="text-[10px] text-muted-foreground">Similitud: {Math.round((item.visualSimilarity ?? 0) * 100)}%</p>
                  {item.webViewLink && <a className="mt-1 inline-flex items-center gap-1 text-[10px] text-forja-violet" href={item.webViewLink} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Ver</a>}
                </div>
                <div className="min-w-0 rounded-md border border-border/50 p-2">
                  <p className="truncate text-[11px] font-medium">Relacionado: {original?.name ?? "No encontrado"}</p>
                  {original?.webViewLink && <a className="mt-1 inline-flex items-center gap-1 text-[10px] text-forja-violet" href={original.webViewLink} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Ver</a>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" className="h-7 text-[10.5px]" onClick={() => keepBothVisualResources(item.id)}><Check className="mr-1 size-3" /> Conservar ambos</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10.5px]" onClick={() => acceptAsRelated(item.id)}><Link2 className="mr-1 size-3" /> Relacionarlos</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10.5px] text-muted-foreground" onClick={() => discardDuplicateFromIndex(item.id)}><Trash2 className="mr-1 size-3" /> Quitar del índice</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KBDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { resources, stats, remove, update } = useKbIndex();
  const { accounts } = useGdriveAccounts();
  const creds = gdGetCreds();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 px-4 py-3 pr-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" /> Conocimiento
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Sube o elige recursos desde Drive: Forja los clasifica y decide dónde van — todo en un solo lugar.
          </DialogDescription>
          {resources.length > 0 && (
            <div className="mt-2 grid grid-cols-5 gap-1.5 sm:max-w-md">
              <StatChip label="Total" value={stats.total} />
              <StatChip label="Nuevos" value={stats.nuevo} />
              <StatChip label="Clasificados" value={stats.clasificado} />
              <StatChip label="Pendientes" value={stats.pendiente} />
              <StatChip label="Similares" value={stats.revisionDuplicado} />
            </div>
          )}
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-4 py-3 lg:grid-cols-[1fr_320px] lg:overflow-hidden">
          <div className="space-y-2.5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <KBImport accounts={accounts} creds={creds} />
            <VisualReviewQueue resources={resources} />

            {resources.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                Todavía no hay ningún recurso en el índice. Sube uno arriba, o elige uno con «Elegir en Drive» en
                una cuenta conectada, a la derecha.
              </p>
            ) : (
              resources.map((r) => (
                <ResourceRow
                  key={r.id}
                  resource={r}
                  onUpdate={(patch) => update(r.id, patch)}
                  onRemove={() => remove(r.id)}
                />
              ))
            )}
          </div>

          <div className="space-y-3 border-t border-border/60 pt-3 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <DriveAccountsPanel />
            <MegaPanel />
            <MegaKBImport />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
