"use client";
/** Forja IA — Knowledge Base Manager (Fase 2 del plan, §9.2).
 *
 * Ver y gestionar lo que se ha elegido con "Elegir en Drive" (panel
 * Drive): categoría, etiquetas, tecnología y licencia se ponen a mano —
 * el análisis automático (Fase 3) y la deduplicación (Fase 4) llegan
 * después. Nada de fingir aquí una clasificación que todavía no existe.
 */
import { useState } from "react";
import { Database, ExternalLink, FileText, Trash2 } from "lucide-react";
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
import type { KBResource, KBResourceStatus } from "@/lib/forja/kb-index";
import { useKbIndex } from "./kb-connect";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<KBResourceStatus, string> = {
  nuevo: "Nuevo",
  clasificado: "Clasificado",
  pendiente: "Pendiente",
};

const STATUS_DOT: Record<KBResourceStatus, string> = {
  nuevo: "bg-sky-500",
  clasificado: "bg-emerald-500",
  pendiente: "bg-amber-500",
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

export function KBDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { resources, stats, remove, update } = useKbIndex();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-4 py-3 pr-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" /> Knowledge Base
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Recursos elegidos desde Drive: categoría y etiquetas se ponen a mano por ahora.
          </DialogDescription>
          {resources.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <StatChip label="Total" value={stats.total} />
              <StatChip label="Nuevos" value={stats.nuevo} />
              <StatChip label="Clasificados" value={stats.clasificado} />
              <StatChip label="Pendientes" value={stats.pendiente} />
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          {resources.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Todavía no hay ningún recurso en el índice. Abre <strong>Drive</strong> en la barra lateral →
              «Elegir en Drive» en una cuenta conectada para añadir el primero.
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
      </DialogContent>
    </Dialog>
  );
}
