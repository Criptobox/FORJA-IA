// Reproduce los falsos positivos del revisor de Forja sobre su propio código.
import { readFileSync } from "node:fs";
import { findUnbalanced } from "../src/lib/forja/sandbox-review.ts";

const files = [
  "motor-forja/integracion/adapter-test/verificacion-v47.mjs",
  "public/motor-forja.mjs",
];

// maskJs no está exportado; replico la importación vía tsx/vitest no vale aquí.
// Uso transpilación mínima: importo con un loader simple.
const mod = await import("../src/lib/forja/sandbox-review.ts").catch(() => null);
if (!mod) {
  console.error("No se pudo importar sandbox-review.ts directamente");
  process.exit(2);
}
const { maskJs } = mod;

for (const f of files) {
  const text = readFileSync(f, "utf8");
  const bad = findUnbalanced(maskJs(text));
  if (!bad) {
    console.log(`${f}: SIN desequilibrio (¿ya arreglado?)`);
    continue;
  }
  const line = text.slice(0, bad.index).split("\n").length;
  const col = bad.index - (text.lastIndexOf("\n", bad.index - 1) + 1);
  const lineText = text.split("\n")[line - 1] ?? "";
  console.log(`\n=== ${f} ===`);
  console.log(`reportado: línea ${line}, col ${col}, expected=${JSON.stringify(bad.expected)} found=${JSON.stringify(bad.found)}`);
  console.log(`contexto: ${lineText.slice(Math.max(0, col - 90), col + 40)}`);
}
