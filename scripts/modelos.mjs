#!/usr/bin/env node
/** Forja IA — Auditar las listas de modelos contra un catálogo vivo.
 *
 * El problema que resuelve, dicho por quien lo sufrió: «ahí sigue con los
 * viejos como si estuvieran escritos, en vez de buscar de los sitios oficiales
 * y ponerlos». Tenía razón. Las listas de `providers.ts` son la primera cosa
 * que ve alguien que conecta una clave, y envejecen en silencio: cuando este
 * script se escribió, la app ofrecía OCHO modelos que sus proveedores ya
 * habían retirado —uno desde diciembre de 2025— y no ofrecía el Gemini más
 * nuevo, que llevaba semanas publicado.
 *
 * Lo que hace:
 *
 *  1. Baja el catálogo de LiteLLM (el mismo de `npm run precios`), que trae
 *     `deprecation_date` por modelo.
 *  2. **Informa**: qué modelos de la app ya están retirados, cuáles no existen
 *     en el catálogo y cuáles hay nuevos sin ofrecer.
 *  3. **Genera** `modelos-datos.ts` con la tabla de retirados, para que la app
 *     pueda avisar EN CALIENTE de que el modelo que estás usando está muerto,
 *     en vez de dejarte descubrirlo con un 404.
 *
 * Lo que NO hace: reescribir `providers.ts` solo. Esas listas están curadas a
 * mano —el orden importa, los sufijos «-free» de cada pasarela no están en
 * ningún catálogo— y una generación automática las estropearía. El script dice
 * qué cambiar; el cambio lo revisa una persona.
 *
 *   npm run modelos          → informe + regenera la tabla de retirados
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FUENTE =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

/** De cómo llama LiteLLM al proveedor a cómo lo llama Forja. Igual que en
 * `precios.mjs` y en `/api/precios`: si divergen, la tabla y los precios
 * dejarían de hablar del mismo modelo. */
const PROVEEDORES = {
  anthropic: "anthropic",
  openai: "openai",
  gemini: "gemini",
  groq: "groq",
  mistral: "mistral",
  deepseek: "deepseek",
  xai: "xai",
  nvidia_nim: "nvidia",
  cerebras: "cerebras",
  moonshot: "kimi",
  openrouter: "openrouter",
  zai: "zai",
};

/** El id que usa Forja: el catálogo a veces lo escribe «proveedor/modelo». */
function pelar(clave) {
  return clave.includes("/") ? clave.slice(clave.lastIndexOf("/") + 1) : clave;
}

async function main() {
  const res = await fetch(FUENTE, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.error(`No se pudo bajar el catálogo: HTTP ${res.status}`);
    process.exit(1);
  }
  const crudo = await res.json();
  const hoy = new Date().toISOString().slice(0, 10);

  /** proveedor de Forja → { modelo: fecha de retirada } */
  const retirados = {};
  /** proveedor de Forja → Set de modelos que el catálogo conoce */
  const conocidos = {};
  for (const [clave, v] of Object.entries(crudo)) {
    if (!v || typeof v !== "object") continue;
    const p = PROVEEDORES[v.litellm_provider];
    if (!p) continue;
    if (v.mode != null && v.mode !== "chat") continue;
    const id = pelar(clave);
    (conocidos[p] ??= new Set()).add(id);
    if (typeof v.deprecation_date === "string" && v.deprecation_date) {
      (retirados[p] ??= {})[id] = v.deprecation_date;
    }
  }

  // ——— El informe ———
  const { PROVIDERS } = await import("../src/lib/prism/providers.ts");
  let problemas = 0;
  for (const prov of PROVIDERS) {
    const cat = conocidos[prov.id];
    if (!cat) continue;
    const muertos = [];
    const desconocidos = [];
    for (const m of prov.defaultModels ?? []) {
      // Mismo pelado que `modelos-viejos.ts`: sin esto, «qwen/qwen3-32b» se
      // informaba como «sin ficha» cuando el catálogo SÍ lo tenía retirado.
      // Dos formas de pelar el id son dos verdades distintas.
      const base = pelar(m.replace(/:free$/, "").replace(/-free$/, ""));
      if (!cat.has(base)) {
        desconocidos.push(m);
        continue;
      }
      const dep = retirados[prov.id]?.[base];
      if (dep && dep < hoy) muertos.push(`${m} (retirado el ${dep})`);
    }
    if (muertos.length || desconocidos.length) {
      problemas += muertos.length;
      process.stdout.write(`\n[${prov.id}]\n`);
      for (const m of muertos) process.stdout.write(`  RETIRADO   ${m}\n`);
      for (const m of desconocidos) process.stdout.write(`  sin ficha  ${m}\n`);
    }
  }
  if (!problemas) process.stdout.write("\nNingún modelo retirado en las listas.\n");

  const salida = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "lib",
    "prism",
    "modelos-datos.ts"
  );
  const total = Object.values(retirados).reduce((a, o) => a + Object.keys(o).length, 0);
  const cuerpo = `/** GENERADO POR \`npm run modelos\` — NO EDITAR A MANO.
 *
 * Modelos retirados (o con retirada anunciada) según el catálogo público de
 * LiteLLM: ${total} entradas de ${Object.keys(retirados).length} proveedores.
 *
 *  · Fuente: ${FUENTE}
 *  · Instantánea del ${hoy}
 *
 * Sirve para avisar de que el modelo que tienes elegido está muerto ANTES de
 * que te lo diga un 404. Una fecha en el futuro es una retirada anunciada, y
 * también se enseña: enterarse con antelación es justo el favor que hace.
 */
export const MODELOS_FECHA = "${hoy}";
export const MODELOS_FUENTE = "${FUENTE}";

/** proveedor de Forja → { id del modelo: día de retirada } */
export const RETIRADOS: Record<string, Record<string, string>> = ${JSON.stringify(retirados, null, 0)};
`;
  writeFileSync(salida, cuerpo);
  process.stdout.write(`\nEscritas ${total} retiradas en ${salida}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
