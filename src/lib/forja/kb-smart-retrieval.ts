/** Forja IA — recuperación inteligente por componente/patrón.
 *
 * V18 usa los Project Manifest como una capa de conocimiento estructural:
 * primero descubre qué componente, patrón o tecnología existe realmente en
 * la biblioteca y después puntúa los recursos remotos que pueden contenerlo.
 * No descarga contenido durante el ranking.
 */
import { kbGetResources, type KBResource } from "./kb-index";
import { kbGetProjectManifests } from "./kb-projects";
import { retrieveKB, type KBRetrievalQuery, type KBRetrievalResult } from "./knowledge-retrieval";
import { retrieveKBContent, type KBContentHit, type KBContentOptions } from "./kb-content-retrieval";
import type { KBRepoAnalysis, KBRepoFile } from "./kb-repo-analyzer";

export interface KBSmartQuery extends KBRetrievalQuery {
  component?: string;
  /** Componentes relacionados que deben recuperarse como un conjunto coherente. */
  components?: string[];
  pattern?: string;
  /** Prioriza código y recursos de MEGA cuando el objetivo es reutilizar código. */
  codeFirst?: boolean;
}

export interface KBSmartResult extends KBRetrievalResult {
  matchedComponent?: string;
  matchedPattern?: string;
  matchedProject?: string;
  matchedPath?: string;
}

export interface KBSmartBundle {
  results: KBSmartResult[];
  content: KBContentHit[];
  component?: string;
  components?: string[];
  pattern?: string;
  technology?: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const compact = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "");
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((x) => x.length > 2).slice(0, 24);

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function findMention(query: string, candidates: string[]): string | undefined {
  const q = norm(query);
  const qc = compact(query);
  return candidates
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => {
      const c = norm(candidate);
      return q.includes(c) || (c.length >= 6 && qc.includes(compact(candidate)));
    });
}

function inferQuery(q: KBSmartQuery, manifests: KBRepoAnalysis[], resources: KBResource[]) {
  const allComponents = unique(manifests.flatMap((m) => m.components));
  const allPatterns = unique(manifests.flatMap((m) => m.patterns));
  const allTechnologies = unique([
    ...manifests.flatMap((m) => [...m.technologies, ...m.frameworks]),
    ...resources.map((r) => r.technology),
  ]);

  const explicitComponents = unique((q.components ?? []).map((x) => x.trim()).filter(Boolean));
  const inferredComponent = q.component || findMention(q.text, allComponents);
  const mentionedComponents = unique([
    ...explicitComponents,
    ...(inferredComponent ? [inferredComponent] : []),
    ...allComponents.filter((candidate) => {
      const c = norm(candidate);
      return c.length >= 5 && norm(q.text).includes(c);
    }).slice(0, 12),
  ]);

  return {
    component: inferredComponent,
    components: mentionedComponents,
    pattern: q.pattern || findMention(q.text, allPatterns),
    technology: q.technology || findMention(q.text, allTechnologies),
  };
}

function fileMatches(file: KBRepoFile, inferred: ReturnType<typeof inferQuery>, textWords: string[]) {
  const filePath = norm(file.path);
  const component = inferred.component && norm(inferred.component);
  const pattern = inferred.pattern && norm(inferred.pattern);
  let score = 0;
  const reasons: string[] = [];
  let matchedPath: string | undefined;

  if (component && file.componentNames.some((x) => norm(x) === component || norm(x).includes(component))) {
    score += 14;
    reasons.push(`componente:${inferred.component}`);
  }
  if (component && filePath.includes(norm(inferred.component!))) {
    score += 10;
    matchedPath = file.path;
    reasons.push("ruta-componente");
  }
  if (pattern && file.patterns.some((x) => norm(x) === pattern || norm(x).includes(pattern))) {
    score += 8;
    reasons.push(`patrón:${inferred.pattern}`);
  }
  if (inferred.technology && file.technology.some((x) => norm(x) === norm(inferred.technology!))) {
    score += 5;
    reasons.push("tecnología");
  }
  for (const word of textWords) {
    if (filePath.includes(word)) score += 2;
    if (file.componentNames.some((x) => norm(x).includes(word))) score += 2;
    if (file.patterns.some((x) => norm(x).includes(word))) score += 1;
  }

  return { score, reasons, matchedPath };
}

export function retrieveSmartKB(q: KBSmartQuery, resources = kbGetResources(), manifests = kbGetProjectManifests()): KBSmartResult[] {
  const inferred = inferQuery(q, manifests, resources);
  const textWords = words(q.text);
  const base = retrieveKB({ ...q, technology: inferred.technology, limit: 50 }, resources);
  const baseById = new Map(base.map((x) => [x.resource.id, x]));
  const manifestById = new Map(manifests.map((m) => [m.id, m]));
  const scored = new Map<string, KBSmartResult>();

  for (const resource of resources) {
    if (q.sourceKind && resource.sourceKind !== q.sourceKind) continue;
    if (q.includePending === false && resource.status === "pendiente") continue;

    const baseline = baseById.get(resource.id);
    let score = baseline?.score ?? 0;
    const reasons = [...(baseline?.reasons ?? [])];
    const manifest = resource.projectManifestId ? manifestById.get(resource.projectManifestId) : undefined;
    let matchedComponent: string | undefined;
    let matchedPattern: string | undefined;
    let matchedPath: string | undefined;

    if (manifest) {
      const projectText = norm([manifest.name, ...manifest.components, ...manifest.patterns, ...manifest.technologies, ...manifest.frameworks].join(" "));
      if (inferred.component && projectText.includes(norm(inferred.component))) {
        score += 5;
        reasons.push("manifest-componente");
        matchedComponent = inferred.component;
      }
      if (inferred.pattern && projectText.includes(norm(inferred.pattern))) {
        score += 4;
        reasons.push("manifest-patrón");
        matchedPattern = inferred.pattern;
      }
      if (inferred.technology && projectText.includes(norm(inferred.technology))) {
        score += 3;
        reasons.push("manifest-tecnología");
      }

      // Si la consulta pide varias piezas, premia proyectos que contienen varias
      // de ellas. Esto hace que el conjunto Navbar + ProductCard + CartDrawer,
      // por ejemplo, tienda a salir del mismo proyecto y no de fuentes mezcladas.
      if (inferred.components.length > 1) {
        const projectComponents = manifest.components.map(norm);
        const bundleMatches = inferred.components.filter((component) =>
          projectComponents.some((candidate) => candidate.includes(norm(component)) || norm(component).includes(candidate)),
        );
        if (bundleMatches.length > 1) {
          score += Math.min(18, bundleMatches.length * 4);
          reasons.push(`bundle:${bundleMatches.length}/${inferred.components.length}`);
        }
      }

      const candidates = manifest.files
        .map((file) => ({ file, match: fileMatches(file, inferred, textWords) }))
        .filter((x) => x.match.score > 0)
        .sort((a, b) => b.match.score - a.match.score);
      const best = candidates[0];
      if (best) {
        score += Math.min(24, best.match.score);
        reasons.push(...best.match.reasons);
        matchedPath = best.match.matchedPath || best.file.path;
        matchedComponent = matchedComponent || inferred.component && best.file.componentNames.find((x) => norm(x).includes(norm(inferred.component!)));
        matchedPattern = matchedPattern || inferred.pattern && best.file.patterns.find((x) => norm(x).includes(norm(inferred.pattern!)));
      }
    }

    // Solo desempata ENTRE recursos que ya tenían alguna coincidencia real
    // (texto/componente/patrón/tecnología/manifiesto): si no, con
    // `codeFirst` (que `buildCerebroPlanWithKnowledge` activa SIEMPRE por
    // defecto) cualquier archivo de código servido desde MEGA pasaría el
    // filtro `score > 0` sin haber coincidido en nada con el brief — en
    // cuanto hubiera algo indexado en MEGA, cada encargo web arrastraría
    // código irrelevante al prompt del Cerebro.
    if (q.codeFirst && reasons.length) {
      const code = /\.(tsx?|jsx?|vue|svelte|astro|css|scss|sass|less|html?)$/i.test(resource.name);
      if (code) { score += 2; reasons.push("código"); }
      if (resource.sourceProvider === "mega") { score += 1.5; reasons.push("MEGA"); }
    }

    if (score > 0) {
      scored.set(resource.id, {
        resource,
        score,
        reasons: unique(reasons),
        matchedComponent,
        matchedPattern,
        matchedProject: manifest?.name,
        matchedPath,
      });
    }
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(q.limit ?? 12, 50)));
}

/**
 * Recupera varios componentes relacionados como un conjunto coherente: intenta
 * cubrir cada pieza pedida con al menos un resultado y completa el resto con
 * las coincidencias globales de `retrieveSmartKB`.
 *
 * La cobertura no puede comprobar solo `matchedComponent`: ese campo viene del
 * único archivo "mejor" del manifiesto para el `component` singular inferido
 * (ver `inferQuery`/`fileMatches`), así que TODOS los recursos de un mismo
 * proyecto terminan con el mismo `matchedComponent` aunque cada uno sea en
 * realidad un componente distinto. Con eso solo, pedir "Navbar + ProductCard +
 * FilterDrawer" nunca encontraría el recurso `Navbar.tsx` en la fase de
 * cobertura —quedaría cubierto solo si el recorte por `limit` lo dejaba pasar
 * de rebote en el relleno final—, justo el escenario que esta fase promete
 * resolver. Por eso también se compara contra el nombre/ruta propios del
 * recurso.
 */
export function retrieveSmartKBBundle(
  q: KBSmartQuery,
  resources = kbGetResources(),
  manifests = kbGetProjectManifests(),
): KBSmartResult[] {
  const inferred = inferQuery(q, manifests, resources);
  const base = retrieveSmartKB({ ...q, component: inferred.component, components: inferred.components, limit: 50 }, resources, manifests);
  if (inferred.components.length < 2) return base.slice(0, q.limit ?? 12);

  const selected: KBSmartResult[] = [];
  const used = new Set<string>();
  for (const component of inferred.components) {
    const label = norm(component);
    const match = base.find((hit) => {
      if (used.has(hit.resource.id)) return false;
      return (
        (hit.matchedComponent && norm(hit.matchedComponent).includes(label)) ||
        norm(hit.resource.name).includes(label) ||
        norm(hit.resource.relativePath || "").includes(label)
      );
    });
    if (match) { selected.push(match); used.add(match.resource.id); }
  }
  for (const hit of base) {
    if (selected.length >= Math.min(q.limit ?? 12, 20)) break;
    if (!used.has(hit.resource.id)) { selected.push(hit); used.add(hit.resource.id); }
  }
  return selected;
}

export async function retrieveSmartKBWithContent(
  q: KBSmartQuery,
  contentOptions: KBContentOptions = {},
  resources = kbGetResources(),
  manifests = kbGetProjectManifests(),
): Promise<KBSmartBundle> {
  const results = retrieveSmartKBBundle(q, resources, manifests);
  const content = await retrieveKBContent(results, {
    maxFiles: contentOptions.maxFiles ?? 6,
    maxCharsPerFile: contentOptions.maxCharsPerFile ?? 12000,
    maxTotalChars: contentOptions.maxTotalChars ?? 30000,
    maxBytesPerFile: contentOptions.maxBytesPerFile,
  });
  const inferred = inferQuery(q, manifests, resources);
  return { results, content, ...inferred };
}

export function smartKBContext(results: KBSmartResult[], maxChars = 5000): string {
  const lines = ["[FORJA SMART KNOWLEDGE RETRIEVAL]"];
  for (const hit of results) {
    const details = [
      hit.resource.relativePath || hit.resource.name,
      hit.matchedProject && `proyecto:${hit.matchedProject}`,
      hit.matchedComponent && `componente:${hit.matchedComponent}`,
      hit.matchedPattern && `patrón:${hit.matchedPattern}`,
      hit.resource.technology,
      hit.resource.sourceProvider,
    ].filter(Boolean).join(" | ");
    const line = `- ${details}`;
    if ((lines.join("\n") + "\n" + line).length > maxChars) break;
    lines.push(line);
  }
  return lines.join("\n");
}
