"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, FileCode2, Folder, FolderOpen, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { createMegaProvider, megaConnectionState } from "@/lib/forja/mega-provider";
import type { StorageItem } from "@/lib/forja/storage-providers";
import { kbFindByHash, kbGetResources, kbHashBytes, kbUpsertResource } from "@/lib/forja/kb-index";
import { analyzeZipRepository } from "@/lib/forja/kb-repo-analyzer";
import { kbSaveProjectManifest } from "@/lib/forja/kb-projects";

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function roleForPath(path: string): { category: string; tags: string[]; technology: string } {
  const lower = path.toLowerCase();
  const tags = ["mega", "codigo"];
  // La tecnología detectada aquí también alimenta `technology` — dejarlo
  // vacío (como en la versión recibida) rompía cualquier búsqueda o filtro
  // por tecnología sobre un recurso importado de MEGA, aunque la etiqueta
  // ya la nombrara.
  let technology = "";
  if (/\.tsx?$/.test(lower)) { tags.push("typescript", "react"); technology = "TypeScript"; }
  else if (/\.jsx?$/.test(lower)) { tags.push("javascript"); technology = "JavaScript"; }
  else if (/\.(css|scss|sass)$/.test(lower)) { tags.push("estilos"); technology = "CSS"; }
  else if (/\.(vue)$/.test(lower)) { tags.push("vue"); technology = "Vue"; }
  else if (/\.(svelte)$/.test(lower)) { tags.push("svelte"); technology = "Svelte"; }
  else if (/\.(astro)$/.test(lower)) { tags.push("astro"); technology = "Astro"; }
  else if (/\.(py)$/.test(lower)) { tags.push("python"); technology = "Python"; }
  else if (/\.(go)$/.test(lower)) { tags.push("go"); technology = "Go"; }
  else if (/\.(rs)$/.test(lower)) { tags.push("rust"); technology = "Rust"; }
  else if (/\.json$/.test(lower)) { tags.push("json"); }
  else if (/\.md$/.test(lower)) { tags.push("documentacion"); }
  else tags.push("recurso");

  if (lower.includes("component")) return { category: "componentes", tags, technology };
  if (lower.includes("template") || lower.includes("starter")) return { category: "templates", tags, technology };
  if (lower.includes("recipe") || lower.includes("forja")) return { category: "forja-recipes", tags, technology };
  if (lower.includes("repo") || lower.includes("project")) return { category: "repositorios", tags, technology };
  if (/\.tsx?$/.test(lower) || /\.jsx?$/.test(lower)) return { category: "codigo", tags, technology };
  return { category: "recursos-code", tags, technology };
}

async function bytesToFile(bytes: Uint8Array, name: string, mimeType = "application/octet-stream"): Promise<File> {
  const copy = bytes.slice().buffer as ArrayBuffer;
  return new File([copy], name, { type: mimeType });
}

async function collectFiles(provider: ReturnType<typeof createMegaProvider>, folderId: string | undefined, prefix: string): Promise<Array<{ item: StorageItem; path: string }>> {
  const items = await provider.list(folderId);
  const out: Array<{ item: StorageItem; path: string }> = [];
  for (const item of items) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.kind === "folder") out.push(...(await collectFiles(provider, item.id, path)));
    else out.push({ item, path });
  }
  return out;
}

export function MegaKBImport({ onImported }: { onImported?: () => void }) {
  const [connected, setConnected] = useState(false);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [folderId, setFolderId] = useState<string | undefined>();
  const [path, setPath] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const provider = useMemo(() => createMegaProvider(), []);

  const refresh = async (nextFolderId = folderId) => {
    const state = megaConnectionState();
    setConnected(state.connected);
    if (!state.connected) {
      setItems([]);
      return;
    }
    try {
      setItems(await provider.list(nextFolderId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const connectedRef = useRef(false);
  useEffect(() => {
    void refresh();
    connectedRef.current = megaConnectionState().connected;
    // El login pasa por `MegaPanel`, un componente aparte sin estado
    // compartido — este sondeo es lo único que entera a este panel de que
    // la conexión cambió. Detectar el cambio no bastaba (versión recibida):
    // hacía falta también volver a pedir el listado, o la carpeta se
    // quedaba vacía en pantalla aunque MEGA ya tuviera sesión.
    const timer = window.setInterval(() => {
      const nowConnected = megaConnectionState().connected;
      if (nowConnected !== connectedRef.current) {
        connectedRef.current = nowConnected;
        void refresh();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const openFolder = async (item: StorageItem) => {
    setFolderId(item.id);
    setPath((prev) => [...prev, item.name]);
    setSelected(new Set());
    await refresh(item.id);
  };

  const goRoot = async () => {
    setFolderId(undefined);
    setPath([]);
    setSelected(new Set());
    await refresh(undefined);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importSelection = async (recursive: boolean) => {
    if (!connected || busy) return;
    const chosen = items.filter((item) => selected.has(item.id));
    if (!chosen.length) return;
    setBusy(true);
    let imported = 0;
    let skipped = 0;
    try {
      const all: Array<{ item: StorageItem; path: string }> = [];
      for (const item of chosen) {
        if (item.kind === "folder") {
          if (!recursive) continue;
          all.push(...(await collectFiles(provider, item.id, [...path, item.name].join("/"))));
        } else {
          all.push({ item, path: [...path, item.name].join("/") });
        }
      }

      for (const entry of all) {
        setStatus(`Indexando ${entry.path}`);
        const meta = roleForPath(entry.path);
        let hash: string | undefined;
        let projectManifestId: string | undefined;
        const size = entry.item.sizeBytes ?? 0;
        // No descargamos archivos enormes solo para construir el índice. Esto permite
        // trabajar con bibliotecas MEGA de decenas de GB sin convertir la indexación
        // en una descarga masiva. Los archivos pequeños sí reciben hash exacto.
        if (size <= 8 * 1024 * 1024) {
          const bytes = await provider.read(entry.item.id);
          hash = await kbHashBytes(bytes);
          if (kbFindByHash(hash)) {
            skipped++;
            continue;
          }
          if (/\.zip$/i.test(entry.item.name) && size <= 100 * 1024 * 1024) {
            try {
              const file = await bytesToFile(bytes, entry.item.name, "application/zip");
              const analysis = await analyzeZipRepository(file);
              kbSaveProjectManifest(analysis);
              projectManifestId = analysis.id;
            } catch {
              // El ZIP queda indexado aunque el análisis estructural no pueda completarse.
            }
          }
        }
        kbUpsertResource({
          id: `mega:${entry.item.id}`,
          name: entry.item.name,
          mimeType: entry.item.mimeType || "application/octet-stream",
          sizeBytes: entry.item.sizeBytes ?? 0,
          accountEmail: megaConnectionState().email || "MEGA",
          webViewLink: entry.item.webUrl || "",
          category: meta.category,
          tags: Array.from(new Set([...meta.tags, ...path.map((part) => part.toLowerCase()).filter((part) => part.length > 2)])),
          technology: meta.technology,
          license: "",
          status: "clasificado",
          indexedAt: new Date().toISOString(),
          contentHash: hash,
          relativePath: entry.path,
          sourceKind: "mega",
          sourceProvider: "mega",
          remoteId: entry.item.id,
          projectManifestId,
        });
        imported++;
      }
      setSelected(new Set());
      setStatus(`Listo: ${imported} indexado(s), ${skipped} ya existía(n).`);
      onImported?.();
      toast.success(`MEGA: ${imported} recurso(s) indexado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setStatus("La indexación se detuvo por un error.");
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/30 p-3 text-[11px] text-muted-foreground">
        Conecta MEGA arriba para explorar e indexar su biblioteca de código.
      </div>
    );
  }

  const files = items.filter((item) => item.kind === "file");
  const folders = items.filter((item) => item.kind === "folder");

  return (
    <div className="space-y-2.5 rounded-xl border border-border/60 bg-card/20 p-3">
      <div className="flex items-center gap-2">
        <UploadCloud className="size-4 text-forja-violet" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Indexar desde MEGA</p>
          <p className="truncate text-[10.5px] text-muted-foreground">{path.length ? `MEGA / ${path.join(" / ")}` : "MEGA / raíz"}</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-md p-1.5 hover:bg-muted" title="Actualizar">
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {path.length > 0 && (
        <button type="button" onClick={() => void goRoot()} className="text-[10.5px] text-forja-violet hover:underline">
          ← Volver a raíz
        </button>
      )}

      <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/50 p-1.5">
        {folders.map((item) => (
          <button key={item.id} type="button" onClick={() => toggle(item.id)} onDoubleClick={() => void openFolder(item)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-muted">
            <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${selected.has(item.id) ? "border-forja-violet bg-forja-violet text-white" : "border-border"}`}>
              {selected.has(item.id) ? <Check className="size-3" /> : <Folder className="size-2.5 text-amber-500" />}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            <ChevronRight className="size-3 text-muted-foreground" />
          </button>
        ))}
        {files.map((item) => (
          <button key={item.id} type="button" onClick={() => toggle(item.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-muted">
            <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${selected.has(item.id) ? "border-forja-violet bg-forja-violet text-white" : "border-border"}`}>
              {selected.has(item.id) ? <Check className="size-3" /> : <FileCode2 className="size-2.5 text-muted-foreground" />}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            <span className="shrink-0 text-[9.5px] text-muted-foreground">{formatBytes(item.sizeBytes)}</span>
          </button>
        ))}
        {!folders.length && !files.length && <p className="p-3 text-center text-[10.5px] text-muted-foreground">Esta carpeta está vacía.</p>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy || selected.size === 0} onClick={() => void importSelection(false)} className="rounded-lg border border-border/70 px-2.5 py-1.5 text-[10.5px] font-medium disabled:opacity-40">
          Indexar seleccionados
        </button>
        <button type="button" disabled={busy || selected.size === 0} onClick={() => void importSelection(true)} className="rounded-lg bg-forja-violet px-2.5 py-1.5 text-[10.5px] font-medium text-white disabled:opacity-40">
          Indexar carpetas completas
        </button>
        {busy && <Loader2 className="ml-1 mt-1 size-3.5 animate-spin text-forja-violet" />}
      </div>
      {status && <p className="text-[10px] text-muted-foreground">{status}</p>}
      <p className="text-[9.5px] text-muted-foreground/80">El índice guarda metadatos; el código permanece en MEGA y se recupera cuando Forja lo necesita.</p>
    </div>
  );
}
