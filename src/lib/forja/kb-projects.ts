/** Persistencia local de manifiestos estructurales de proyectos importados. */
import type { KBRepoAnalysis } from "./kb-repo-analyzer";

const KEY = "forja-kb-project-manifests";
export function kbGetProjectManifests(): KBRepoAnalysis[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v as KBRepoAnalysis[] : [];
  } catch { return []; }
}
export function kbSaveProjectManifest(manifest: KBRepoAnalysis): void {
  if (typeof localStorage === "undefined") return;
  const all = kbGetProjectManifests().filter(x => x.id !== manifest.id);
  all.unshift(manifest);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 100)));
}
export function kbGetProjectManifest(id: string): KBRepoAnalysis | undefined {
  return kbGetProjectManifests().find(x => x.id === id);
}
