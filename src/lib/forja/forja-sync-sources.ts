/** Forja IA — adaptadores reales de fuentes para V30.
 *
 * Cada adaptador produce snapshots pequeños para ForjaSyncWatcher. No guarda
 * credenciales ni ejecuta código remoto. El contenido se limita a archivos de
 * texto útiles para búsqueda.
 */
import type { ForjaSearchDocument } from "./forja-search";
import type { ForjaSyncLoader, ForjaSyncSnapshot } from "./forja-sync-watcher";
import { createMegaProvider } from "./mega-provider";
import type { StorageItem } from "./storage-providers";

const MAX_FILE_BYTES = 512_000;
const MAX_TOTAL_BYTES = 8_000_000;
const TEXT_EXT = /\.(?:html?|css|scss|sass|less|js|jsx|mjs|cjs|ts|tsx|json|md|txt|xml|svg|vue|svelte|astro|py|rb|php|java|kt|go|rs|c|h|cpp|hpp|cs|swift|sh|sql|graphql|yml|yaml|toml|ini|cfg|conf|env|gitignore)$/i;

function isTextPath(path: string): boolean { return TEXT_EXT.test(path) || /(?:^|\/)dockerfile$/i.test(path); }
function asText(bytes: Uint8Array): string { return new TextDecoder().decode(bytes); }

async function walkStorage(provider: ReturnType<typeof createMegaProvider>, parentId: string | undefined, prefix: string, docs: ForjaSearchDocument[], budget: { bytes: number }, maxDepth = 8): Promise<void> {
  if (maxDepth < 0 || budget.bytes >= MAX_TOTAL_BYTES) return;
  const items = await provider.list(parentId);
  for (const item of items) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.kind === "folder") {
      await walkStorage(provider, item.id, path, docs, budget, maxDepth - 1);
      continue;
    }
    if (!isTextPath(path) || (item.sizeBytes ?? 0) > MAX_FILE_BYTES) continue;
    const remaining = MAX_TOTAL_BYTES - budget.bytes;
    if (remaining <= 0) break;
    try {
      const bytes = await provider.read(item.id);
      const clipped = bytes.byteLength > remaining ? bytes.subarray(0, remaining) : bytes;
      docs.push({ id: `mega:${item.id}`, path, text: asText(clipped), metadata: { provider: "mega", remoteId: item.id, sizeBytes: item.sizeBytes ?? 0 } });
      budget.bytes += clipped.byteLength;
    } catch { /* un archivo remoto ilegible no bloquea el snapshot */ }
  }
}

/** Snapshot real de MEGA usando la sesión MEGA ya conectada en Forja. */
export function createMegaSyncLoader(key = "mega-root"): ForjaSyncLoader {
  return async (): Promise<ForjaSyncSnapshot> => {
    const docs: ForjaSearchDocument[] = [];
    await walkStorage(createMegaProvider(), undefined, "", docs, { bytes: 0 });
    return { source: "mega", key, documents: docs, collectedAt: new Date().toISOString() };
  };
}

export interface GitHubSyncOptions {
  owner: string;
  repo: string;
  ref?: string;
  token?: string;
}

/** Snapshot real de un repositorio GitHub mediante la Git Trees/Blobs API. */
export function createGitHubSyncLoader(options: GitHubSyncOptions): ForjaSyncLoader {
  return async () => {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    const base = `https://api.github.com/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}`;
    const ref = encodeURIComponent(options.ref ?? "HEAD");
    const treeRes = await fetch(`${base}/git/trees/${ref}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error(`GitHub tree ${treeRes.status}`);
    const tree = await treeRes.json() as { tree?: Array<{ path: string; type: string; sha: string; size?: number }>; truncated?: boolean };
    const docs: ForjaSearchDocument[] = [];
    let budget = 0;
    for (const entry of tree.tree ?? []) {
      if (entry.type !== "blob" || !isTextPath(entry.path) || (entry.size ?? 0) > MAX_FILE_BYTES) continue;
      if (budget >= MAX_TOTAL_BYTES) break;
      try {
        const res = await fetch(`${base}/git/blobs/${encodeURIComponent(entry.sha)}`, { headers });
        if (!res.ok) continue;
        const blob = await res.json() as { content?: string; encoding?: string };
        if (!blob.content || blob.encoding !== "base64") continue;
        const bytes = Uint8Array.from(atob(blob.content.replace(/\n/g, "")), c => c.charCodeAt(0));
        const clipped = bytes.subarray(0, Math.min(bytes.byteLength, MAX_TOTAL_BYTES - budget));
        docs.push({ id: `github:${options.owner}/${options.repo}:${entry.path}`, path: entry.path, text: asText(clipped), metadata: { provider: "github", owner: options.owner, repo: options.repo, sha: entry.sha, truncated: Boolean(tree.truncated) } });
        budget += clipped.byteLength;
      } catch { /* sigue con el resto */ }
    }
    return { source: "github", key: `${options.owner}/${options.repo}@${options.ref ?? "HEAD"}`, documents: docs, collectedAt: new Date().toISOString() };
  };
}

export interface SandboxSyncFile { path: string; content: string; }
export function createSandboxSyncLoader(projectId: string, files: SandboxSyncFile[]): ForjaSyncLoader {
  return async () => ({
    source: "sandbox",
    key: `sandbox:${projectId}`,
    documents: files.filter(f => isTextPath(f.path)).slice(0, 2000).map(f => ({ id: `sandbox:${projectId}:${f.path}`, path: f.path, text: f.content.slice(0, 250_000), metadata: { provider: "sandbox", projectId } })),
    collectedAt: new Date().toISOString(),
  });
}

/** Construye loaders sin iniciar polling: el Orchestrator decide cuándo sincronizar. */
export function createForjaSourceLoaders(): { mega: (key?: string) => ForjaSyncLoader; github: (options: GitHubSyncOptions) => ForjaSyncLoader; sandbox: (projectId: string, files: SandboxSyncFile[]) => ForjaSyncLoader } {
  return { mega: createMegaSyncLoader, github: createGitHubSyncLoader, sandbox: createSandboxSyncLoader };
}
