/** Forja IA — Recipe Builder (V21).
 *
 * Convierte un bundle recuperado de la Knowledge Base en una receta reusable.
 * La receta guarda decisiones y referencias, no copia código remoto. Así el
 * Cerebro puede reutilizar una solución sin volver a descubrirla desde cero.
 */
import type { KBSmartQuery, KBSmartResult } from "./kb-smart-retrieval";

export interface ForjaRecipeComponent {
  name: string;
  resourceId?: string;
  path?: string;
  project?: string;
  pattern?: string;
  technology?: string;
}

export interface ForjaRecipe {
  id: string;
  version: 1;
  name: string;
  description: string;
  query: string;
  technology?: string;
  components: ForjaRecipeComponent[];
  patterns: string[];
  sources: string[];
  sourceProviders: string[];
  rules: string[];
  adaptation: string[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  quality?: number;
}

const STORAGE_KEY = "forja-recipes";
const EVENT_NAME = "forja-recipes";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "receta";
const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];

function read(): ForjaRecipe[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value as ForjaRecipe[] : [];
  } catch { return []; }
}

function persist(recipes: ForjaRecipe[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  try { window.dispatchEvent(new Event(EVENT_NAME)); } catch { /* SSR */ }
}

export function buildForjaRecipe(query: KBSmartQuery, results: KBSmartResult[], name?: string): ForjaRecipe {
  const components = results.map((hit) => ({
    name: hit.matchedComponent || hit.resource.name.replace(/\.(tsx?|jsx?|vue|svelte|astro)$/i, ""),
    resourceId: hit.resource.id,
    path: hit.matchedPath || hit.resource.relativePath || hit.resource.name,
    project: hit.matchedProject,
    pattern: hit.matchedPattern,
    technology: hit.resource.technology,
  })).filter((x, i, all) => all.findIndex((y) => norm(y.name) === norm(x.name)) === i);

  const patterns = unique(results.flatMap((hit) => [hit.matchedPattern || "", ...hit.reasons.filter((r) => r.startsWith("patrón:")).map((r) => r.slice(7))]));
  const sources = unique(results.map((hit) => hit.resource.relativePath || hit.resource.name));
  const providers = unique(results.map((hit) => hit.resource.sourceProvider || hit.resource.sourceKind || ""));
  const technologies = unique(results.map((hit) => hit.resource.technology));
  const recipeName = name?.trim() || `${query.component || "Web"}${query.pattern ? ` · ${query.pattern}` : " · bundle"}`;
  const now = new Date().toISOString();
  const id = `${slug(recipeName)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    version: 1,
    name: recipeName,
    description: `Receta reutilizable creada a partir de ${results.length} recurso(s) recuperados para «${query.text}».`,
    query: query.text,
    technology: query.technology || technologies[0],
    components,
    patterns,
    sources,
    sourceProviders: providers,
    rules: [
      "Mantener coherencia visual y de arquitectura entre los componentes de la receta.",
      "Adaptar nombres, contenido, colores y comportamiento al brief actual.",
      "No copiar código remoto sin revisar dependencias, licencia y compatibilidad.",
      "Verificar responsive, accesibilidad y estados antes de publicar.",
    ],
    adaptation: [
      "Reutilizar la estructura, no asumir que el negocio actual es igual al proyecto fuente.",
      "Resolver dependencias que no estén presentes en el proyecto destino.",
      "Permitir sustituir un componente si el entorno o el brief lo exige.",
    ],
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };
}

export function saveForjaRecipe(recipe: ForjaRecipe): void {
  const recipes = read();
  const index = recipes.findIndex((r) => r.id === recipe.id);
  if (index < 0) recipes.unshift(recipe); else recipes[index] = recipe;
  persist(recipes);
}

export function listForjaRecipes(): ForjaRecipe[] { return read(); }

export function getForjaRecipe(id: string): ForjaRecipe | undefined {
  return read().find((recipe) => recipe.id === id);
}

export function deleteForjaRecipe(id: string): void { persist(read().filter((recipe) => recipe.id !== id)); }

export function searchForjaRecipes(text: string, limit = 8): ForjaRecipe[] {
  const terms = norm(text).split(/[^a-z0-9]+/).filter((x) => x.length > 2);
  if (!terms.length) return [];
  return read().map((recipe) => {
    const haystack = norm([recipe.name, recipe.description, recipe.query, recipe.technology || "", ...recipe.components.map((c) => c.name), ...recipe.patterns].join(" "));
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 10 : 0), 0);
    return { recipe, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || b.recipe.updatedAt.localeCompare(a.recipe.updatedAt)).slice(0, limit).map((x) => x.recipe);
}

export function markForjaRecipeUsed(id: string): ForjaRecipe | undefined {
  const recipe = getForjaRecipe(id);
  if (!recipe) return undefined;
  const updated = { ...recipe, usageCount: recipe.usageCount + 1, updatedAt: new Date().toISOString() };
  saveForjaRecipe(updated);
  return updated;
}

export function recipeContext(recipe: ForjaRecipe, maxChars = 7000): string {
  const lines = [
    `[FORJA RECIPE — ${recipe.name}]`,
    `Descripción: ${recipe.description}`,
    recipe.technology ? `Tecnología: ${recipe.technology}` : "",
    `Componentes: ${recipe.components.map((c) => c.name).join(", ")}`,
    recipe.patterns.length ? `Patrones: ${recipe.patterns.join(", ")}` : "",
    `Fuentes: ${recipe.sources.join(" | ")}`,
    `Proveedores: ${recipe.sourceProviders.join(", ")}`,
    "Reglas:",
    ...recipe.rules.map((r) => `- ${r}`),
    "Adaptación:",
    ...recipe.adaptation.map((r) => `- ${r}`),
  ].filter(Boolean);
  return lines.join("\n").slice(0, maxChars);
}
