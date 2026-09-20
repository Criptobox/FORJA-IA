/**
 * Forja IA — recuperación selectiva de Knowledge Base.
 *
 * La KB puede vivir en Drive/MEGA/u otro provider. El Cerebro nunca debería
 * recorrer el almacenamiento completo: primero filtra por metadatos locales
 * y solo después pide contenido de los candidatos.
 */
import { kbGetResources, type KBResource } from "./kb-index";

export interface KBRetrievalQuery {
  text: string;
  category?: string;
  technology?: string;
  tags?: string[];
  limit?: number;
}

export interface KBRetrievalResult {
  resource: KBResource;
  score: number;
  reasons: string[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function retrieveKB(q: KBRetrievalQuery, resources = kbGetResources()): KBRetrievalResult[] {
  const text = norm(q.text);
  const wantedTags = (q.tags ?? []).map(norm);
  return resources
    .map((resource) => {
      let score = 0;
      const reasons: string[] = [];
      const name = norm(resource.name);
      const category = norm(resource.category);
      const technology = norm(resource.technology);
      const tags = resource.tags.map(norm);

      if (q.category && category === norm(q.category)) { score += 5; reasons.push("categoría"); }
      if (q.technology && technology === norm(q.technology)) { score += 4; reasons.push("tecnología"); }
      for (const tag of wantedTags) {
        if (tags.includes(tag)) { score += 3; reasons.push(`tag:${tag}`); }
      }
      for (const token of text.split(/\s+/).filter((x) => x.length > 2).slice(0, 12)) {
        if (name.includes(token)) { score += 2; reasons.push("nombre"); }
        if (category.includes(token) || technology.includes(token) || tags.some((t) => t.includes(token))) {
          score += 1;
          reasons.push("metadatos");
        }
      }
      // Solo desempata ENTRE recursos que ya aportaron alguna señal real: si
      // no, cualquier recurso "clasificado" pasaría el filtro `score > 0` sin
      // haber coincidido en nada, y "recuperación selectiva" dejaría de
      // significar algo con una KB grande.
      if (resource.status === "clasificado" && reasons.length) score += 0.25;
      return { resource, score, reasons: [...new Set(reasons)] };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(q.limit ?? 12, 50)));
}

export function kbContext(results: KBRetrievalResult[], maxChars = 3500): string {
  let out = "[FORJA KNOWLEDGE RETRIEVAL]\n";
  for (const r of results) {
    const line = `- ${r.resource.name} | ${r.resource.category} | ${r.resource.technology} | tags:${r.resource.tags.join(",")} | ${r.resource.webViewLink}`;
    if ((out + line + "\n").length > maxChars) break;
    out += line + "\n";
  }
  return out;
}
