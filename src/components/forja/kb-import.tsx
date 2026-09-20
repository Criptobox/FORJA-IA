"use client";
/** Forja IA — "Importar recursos": subir un archivo del dispositivo y que
 * quede clasificado y guardado en la cuenta/carpeta de Drive correcta sin
 * tener que elegirla a mano.
 *
 * Lo que de verdad pasa, en orden, para cada archivo:
 * 1. Se calcula su hash (SHA-256) y se compara contra el índice — si ya
 *    existe un recurso con ese contenido exacto, se avisa y no se sube.
 * 2. Se clasifica con el modelo activo de la conversación (`kb-classify.ts`).
 *    Si no hay modelo configurado o la llamada falla, sigue sin categoría,
 *    como "pendiente" — nunca se inventa una.
 * 3. Se elige la cuenta de Drive con más espacio libre entre las
 *    conectadas (criterio simple y explicable; no hay otra señal más
 *    fuerte todavía, como una carpeta ya existente para esa categoría en
 *    otra cuenta — eso queda para una vuelta futura).
 * 4. Se busca o crea, EN esa cuenta, una carpeta con el nombre de la
 *    categoría (o "sin-categoria" si no se pudo clasificar) y se sube ahí.
 * 5. Se añade al índice de la Knowledge Base.
 */
import { useState } from "react";
import { CircleCheck, CircleX, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { streamChat } from "@/lib/forja/chat-client";
import { classifyFile, isTextLike, readTextExcerpt } from "@/lib/forja/kb-classify";
import { findOrCreateFolder, pickAccountWithMostSpace, uploadFileToDrive } from "@/lib/forja/gdrive-upload";
import { kbExistingCategories, kbFindByHash, kbGetResources, kbHashFile, kbUpsertResource } from "@/lib/forja/kb-index";
import { computeVisualFingerprint, findVisualDuplicateCandidates } from "@/lib/forja/visual-similarity";
import type { GDriveAccount, GDriveCreds } from "@/lib/forja/gdrive";
import { splitModelKey } from "@/lib/forja/types";
import { useForja } from "@/lib/forja/store";
import { cn } from "@/lib/utils";

type ImportStage = "hash" | "clasificando" | "subiendo" | "listo" | "duplicado" | "error";

interface ImportItem {
  key: string;
  name: string;
  stage: ImportStage;
  detail?: string;
}

async function importOneFile(
  file: File,
  accounts: GDriveAccount[],
  creds: GDriveCreds,
  onStage: (stage: ImportStage, detail?: string) => void
): Promise<void> {
  onStage("hash");
  const hash = await kbHashFile(file);
  const dup = kbFindByHash(hash);
  if (dup) {
    onStage("duplicado", `Ya está en la Knowledge Base como «${dup.name}».`);
    return;
  }

  onStage("clasificando");
  const visual = await computeVisualFingerprint(file);
  const visualCandidates = visual
    ? findVisualDuplicateCandidates(visual.hash, kbGetResources(), 8)
    : [];
  const visualDuplicateOf = visualCandidates[0]?.id;
  let category = "";
  let technology = "";
  let tags: string[] = [];
  const st = useForja.getState();
  const parsed = st.settings.defaultModelKey ? splitModelKey(st.settings.defaultModelKey) : null;
  if (parsed) {
    const config = st.providers[parsed.providerId];
    if (config?.apiKey || config?.useProxy) {
      const excerpt = isTextLike(file.type, file.name) ? await readTextExcerpt(file) : undefined;
      const result = await classifyFile(
        {
          providerId: parsed.providerId,
          modelId: parsed.modelId,
          config,
          settings: st.settings,
          signal: new AbortController().signal,
          stream: streamChat,
        },
        {
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          textExcerpt: excerpt,
          existingCategories: kbExistingCategories(kbGetResources()),
        }
      );
      if (result) {
        category = result.category;
        technology = result.technology;
        tags = result.tags;
      }
    }
  }

  onStage("subiendo", category ? `Enviando a «${category}»…` : "Sin clasificar — se sube igual.");
  const account = pickAccountWithMostSpace(accounts);
  if (!account) {
    onStage("error", "No hay ninguna cuenta de Drive conectada.");
    return;
  }
  try {
    const { folderId, account: freshAccount } = await findOrCreateFolder(account, creds, category || "sin-categoria");
    const uploaded = await uploadFileToDrive(freshAccount, creds, file, folderId);
    kbUpsertResource({
      id: uploaded.id,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      accountEmail: uploaded.account.email,
      webViewLink: uploaded.webViewLink,
      category,
      tags,
      technology,
      license: "",
      status: visualDuplicateOf ? "revision-duplicado" : (category ? "clasificado" : "pendiente"),
      indexedAt: new Date().toISOString(),
      contentHash: hash,
      visualHash: visual?.hash,
      visualHashAlgorithm: visual?.algorithm,
      relativePath: getRelativePath(file),
      sourceKind: getSourceKind(file),
      duplicateOf: visualDuplicateOf,
    });
    if (visualDuplicateOf) {
      onStage("listo", `Guardado para revisión: visualmente parecido a otro recurso (${uploaded.account.email}).`);
    } else {
      onStage("listo", category ? `Guardado en «${category}» (${uploaded.account.email}).` : `Guardado sin clasificar (${uploaded.account.email}).`);
    }
  } catch (e) {
    onStage("error", e instanceof Error ? e.message : String(e));
  }
}

const FOLDER_INPUT_PROPS: Record<string, string> = { webkitdirectory: "", directory: "" };

function getRelativePath(file: File): string | undefined {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relative || undefined;
}

function getSourceKind(file: File): "upload" | "folder" | "zip" {
  const relative = getRelativePath(file);
  if (relative) return "folder";
  if (/\.zip$/i.test(file.name)) return "zip";
  return "upload";
}

function StageIcon({ stage }: { stage: ImportStage }) {
  if (stage === "listo") return <CircleCheck className="size-4 text-emerald-500" />;
  if (stage === "duplicado") return <CircleCheck className="size-4 text-amber-500" />;
  if (stage === "error") return <CircleX className="size-4 text-red-500" />;
  return <Loader2 className="size-4 animate-spin text-forja-violet" />;
}

const STAGE_LABEL: Record<ImportStage, string> = {
  hash: "Comprobando si ya existe…",
  clasificando: "Clasificando con IA…",
  subiendo: "Subiendo a Drive…",
  listo: "Listo",
  duplicado: "Ya estaba en la Knowledge Base",
  error: "Falló",
};

export function KBImport({ accounts, creds }: { accounts: GDriveAccount[]; creds: GDriveCreds | null }) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!creds) {
      toast.error("Conecta Google Drive primero (panel Drive)");
      return;
    }
    if (accounts.length === 0) {
      toast.error("Conecta al menos una cuenta de Drive primero (panel Drive)");
      return;
    }
    const files = Array.from(fileList);
    for (const file of files) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const newItem: ImportItem = { key, name: file.name, stage: "hash" };
      setItems((prev) => [newItem, ...prev].slice(0, 20));
      void importOneFile(file, accounts, creds, (stage, detail) => {
        setItems((prev) => prev.map((it) => (it.key === key ? { ...it, stage, detail } : it)));
      });
    }
  };

  return (
    <div className="space-y-2.5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragOver ? "border-forja-violet bg-forja-violet/5" : "border-border/60"
        )}
      >
        <Upload className="size-6 text-muted-foreground" />
        <p className="text-[12.5px] text-muted-foreground">
          Arrastra archivos aquí — Forja los clasifica con IA y decide en qué cuenta y carpeta de Drive van.
        </p>
        <label className="cursor-pointer rounded-lg bg-forja-violet px-3 py-1.5 text-[11.5px] font-medium text-white hover:opacity-90">
          Seleccionar archivos
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="cursor-pointer rounded-lg border border-border/70 px-3 py-1.5 text-[11.5px] font-medium hover:bg-muted">
          Importar carpeta / repositorio
          <input
            type="file"
            multiple
            // Chromium/Edge/Chrome exponen la ruta relativa sin enviar nada al navegador.
            {...FOLDER_INPUT_PROPS}
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className="flex items-center gap-1 text-[10.5px] text-muted-foreground/80">
          <Sparkles className="size-3" /> También acepta ZIP. Las similitudes visuales quedan en revisión; Forja nunca borra automáticamente.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5 text-[11.5px]">
              <StageIcon stage={it.stage} />
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              <span className="shrink-0 text-[10.5px] text-muted-foreground">{it.detail ?? STAGE_LABEL[it.stage]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
