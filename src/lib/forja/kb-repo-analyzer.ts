/** Forja IA — análisis estructural local de ZIP/repositorios para Knowledge Base.
 *
 * No envía el repositorio completo al modelo. Lee el ZIP en el navegador,
 * elimina carpetas generadas/dependencias, detecta stack, componentes,
 * patrones y licencia, y produce un manifiesto compacto que el Cerebro puede
 * consultar después. El contenido completo sigue siendo opcional.
 */
import { dropWrapperFolder, readZip, type ZipEntry } from "./zip";

export interface KBRepoFile {
  path: string;
  sizeBytes: number;
  kind: "source" | "style" | "config" | "documentation" | "asset" | "test" | "generated" | "binary";
  technology: string[];
  componentNames: string[];
  patterns: string[];
}

export interface KBRepoAnalysis {
  version: 1;
  id: string;
  name: string;
  analyzedAt: string;
  totalFiles: number;
  indexedFiles: number;
  ignoredFiles: number;
  totalBytes: number;
  technologies: string[];
  frameworks: string[];
  packageManagers: string[];
  components: string[];
  patterns: string[];
  licenses: string[];
  entryPoints: string[];
  importantFiles: string[];
  files: KBRepoFile[];
}

const MAX_INDEXED_FILES = 3000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const IGNORE = /(^|\/)(node_modules|\.git|dist|build|\.next|coverage|vendor|__pycache__|\.venv)(\/|$)|\.(map|min\.js|min\.css)$/i;
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|mp4|webm|mov|zip|gz|tar|7z|exe|dll|dylib|so)$/i;
const TECH: Array<[RegExp, string]> = [
  [/\.(tsx|jsx)$/i, "React"],
  [/\.tsx$/i, "TypeScript"],
  [/\.ts$/i, "TypeScript"],
  [/\.jsx$/i, "JavaScript"],
  [/\.js$/i, "JavaScript"],
  [/\.vue$/i, "Vue"],
  [/\.svelte$/i, "Svelte"],
  [/\.astro$/i, "Astro"],
  [/\.css$/i, "CSS"],
  [/\.(scss|sass)$/i, "Sass"],
  [/\.html?$/i, "HTML"],
  [/\.py$/i, "Python"],
  [/\.go$/i, "Go"],
  [/\.rs$/i, "Rust"],
];

function basename(path: string): string { return path.split("/").pop() || path; }
function uniq(xs: string[]): string[] { return [...new Set(xs)].sort((a, b) => a.localeCompare(b)); }
function kind(path: string): KBRepoFile["kind"] {
  const p = path.toLowerCase();
  if (IGNORE.test(p)) return "generated";
  if (BINARY.test(p)) return "binary";
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(p) || /(^|\/)(__tests__|tests?)\//.test(p)) return "test";
  if (/\.(md|mdx|txt|rst)$/i.test(p)) return "documentation";
  if (/\.(css|scss|sass|less)$/.test(p)) return "style";
  if (/^(package|tsconfig|vite|next|astro|tailwind|eslint|prettier|components)\./i.test(basename(p)) || /(^|\/)\.env/.test(p)) return "config";
  if (/\.(tsx?|jsx?|vue|svelte|astro|py|go|rs|html?)$/i.test(p)) return "source";
  return "asset";
}

function patternsFor(path: string, text: string): string[] {
  const out: string[] = [];
  const p = path.toLowerCase();
  if (/components?\//.test(p) || /ui\//.test(p)) out.push("component-library");
  if (/hooks?\//.test(p) || /use[A-Z]/.test(text)) out.push("custom-hooks");
  if (/layout|page|route/.test(p)) out.push("page-routing");
  if (/tailwind/.test(text) || /className\s*=/.test(text)) out.push("utility-css");
  if (/createContext|useContext/.test(text)) out.push("context-state");
  if (/zustand|redux|recoil|jotai/.test(text)) out.push("state-management");
  if (/framer-motion|motion\./.test(text)) out.push("motion");
  if (/aria-|role=|<label/.test(text)) out.push("accessibility");
  if (/fetch\(|axios|graphql|trpc/.test(text)) out.push("data-fetching");
  if (/zod|yup|valibot/.test(text)) out.push("schema-validation");
  return uniq(out);
}

function componentsFrom(path: string, text: string): string[] {
  const out = new Set<string>();
  const base = basename(path);
  const fileName = base.replace(/\.(tsx|jsx|vue|svelte)$/i, "");
  if (/^(Button|Card|Modal|Dialog|Drawer|Sheet|Navbar|Header|Footer|Sidebar|Hero|Form|Input|Select|Tabs|Table|Badge|Avatar|Tooltip)/i.test(fileName)) out.add(fileName);
  for (const m of text.matchAll(/(?:export\s+(?:default\s+)?function|function|const)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    if (m[1] && m[1].length < 80) out.add(m[1]);
  }
  for (const m of text.matchAll(/<([A-Z][A-Za-z0-9_.]*)[\s/>]/g)) if (m[1]!.length < 80) out.add(m[1]!);
  return [...out].slice(0, 50);
}

function readText(entry: ZipEntry): string | null {
  if (entry.data.length > MAX_FILE_BYTES || BINARY.test(entry.path)) return null;
  try { return new TextDecoder().decode(entry.data); } catch { return null; }
}

function detectPackageManagers(paths: string[]): string[] {
  const p = new Set(paths.map(x => basename(x).toLowerCase()));
  return uniq([p.has("package-lock.json") ? "npm" : "", p.has("pnpm-lock.yaml") ? "pnpm" : "", p.has("yarn.lock") ? "yarn" : "", p.has("bun.lockb") || p.has("bun.lock") ? "bun" : "", p.has("poetry.lock") ? "poetry" : "", p.has("cargo.lock") ? "cargo" : ""].filter(Boolean));
}

function detectFrameworks(paths: string[], technologies: string[], texts: string[]): string[] {
  const joined = `${paths.join("\n")}\n${texts.join("\n").slice(0, 250000)}`;
  const out: string[] = [];
  if (/next\.config|from ['"]next\//.test(joined)) out.push("Next.js");
  if (/vite\.config|from ['"]vite['"]/.test(joined)) out.push("Vite");
  if (/astro\.config|from ['"]astro/.test(joined)) out.push("Astro");
  if (/nuxt\.config|from ['"]nuxt/.test(joined)) out.push("Nuxt");
  if (technologies.includes("Vue")) out.push("Vue");
  if (technologies.includes("Svelte")) out.push("Svelte");
  if (technologies.includes("React")) out.push("React");
  return uniq(out);
}

export async function analyzeZipRepository(file: File): Promise<KBRepoAnalysis> {
  const entries = dropWrapperFolder(await readZip(await file.arrayBuffer()));
  const paths = entries.map(e => e.path);
  const files: KBRepoFile[] = [];
  const technologies: string[] = [];
  const components: string[] = [];
  const patterns: string[] = [];
  const licenses: string[] = [];
  const entryPoints: string[] = [];
  const importantFiles: string[] = [];
  const texts: string[] = [];
  let totalBytes = 0;
  let ignoredFiles = 0;

  for (const e of entries) {
    totalBytes += e.size;
    if (IGNORE.test(e.path) || files.length >= MAX_INDEXED_FILES) { ignoredFiles++; continue; }
    const text = readText(e);
    const tech = TECH.filter(([rx]) => rx.test(e.path)).map(([, name]) => name);
    const patternsHere = text ? patternsFor(e.path, text) : [];
    const componentsHere = text ? componentsFrom(e.path, text) : [];
    technologies.push(...tech);
    patterns.push(...patternsHere);
    components.push(...componentsHere);
    if (text && texts.length < 120) texts.push(text.slice(0, 6000));
    if (/^(license|licence)(\.|$)|(^|\/)license(\.|$)/i.test(e.path)) licenses.push(basename(e.path));
    if (/^(src\/)?(main|index|app)\.(tsx?|jsx?|vue|svelte|html)$/i.test(e.path) || /(^|\/)(page|layout)\.(tsx?|jsx?)$/i.test(e.path)) entryPoints.push(e.path);
    if (/^(package\.json|README(?:\.md)?|tsconfig\.json|next\.config\.(js|ts)|vite\.config\.(js|ts)|tailwind\.config\.(js|ts))$/i.test(e.path)) importantFiles.push(e.path);
    files.push({ path: e.path, sizeBytes: e.size, kind: kind(e.path), technology: uniq(tech), componentNames: componentsHere, patterns: patternsHere });
  }

  return {
    version: 1,
    id: `kb-project-${crypto.randomUUID()}`,
    name: file.name.replace(/\.zip$/i, ""),
    analyzedAt: new Date().toISOString(),
    totalFiles: entries.length,
    indexedFiles: files.length,
    ignoredFiles,
    totalBytes,
    technologies: uniq(technologies),
    frameworks: detectFrameworks(paths, uniq(technologies), texts),
    packageManagers: detectPackageManagers(paths),
    components: uniq(components).slice(0, 300),
    patterns: uniq(patterns),
    licenses: uniq(licenses),
    entryPoints: uniq(entryPoints).slice(0, 50),
    importantFiles: uniq(importantFiles).slice(0, 80),
    files,
  };
}

export function renderKBRepoAnalysis(a: KBRepoAnalysis, maxChars = 7000): string {
  const lines = [
    `[FORJA PROJECT KNOWLEDGE] ${a.name}`,
    `Archivos: ${a.totalFiles} | indexados: ${a.indexedFiles} | ignorados: ${a.ignoredFiles}`,
    `Tecnologías: ${a.technologies.join(", ") || "no detectadas"}`,
    `Frameworks: ${a.frameworks.join(", ") || "no detectados"}`,
    `Package managers: ${a.packageManagers.join(", ") || "no detectados"}`,
    `Componentes detectados: ${a.components.slice(0, 80).join(", ") || "ninguno"}`,
    `Patrones: ${a.patterns.join(", ") || "ninguno"}`,
    `Licencias: ${a.licenses.join(", ") || "no detectadas"}`,
    `Entradas: ${a.entryPoints.join(", ") || "no detectadas"}`,
    `Archivos importantes: ${a.importantFiles.join(", ") || "ninguno"}`,
  ];
  const text = lines.join("\n");
  return text.length <= maxChars ? text : text.slice(0, maxChars - 1) + "…";
}
