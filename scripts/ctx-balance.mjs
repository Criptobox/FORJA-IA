// Contexto original del { que el masker deja sin cerrar en motor-forja.mjs línea 1.
import { readFileSync } from "node:fs";
const { maskJs, findUnbalanced } = await import("../src/lib/forja/sandbox-review.ts");

const text = readFileSync("public/motor-forja.mjs", "utf8");
const line1 = text.split("\n")[0];
const bad = findUnbalanced(maskJs(line1));
console.log("bad:", JSON.stringify(bad));
const from = Math.max(0, bad.index - 220);
console.log("CONTEXTO ORIGINAL (…desde 220 chars antes del {):");
console.log(line1.slice(from, bad.index + 80));
console.log("----");
// y el trozo enmascarado, para ver qué se tragó
console.log("MASCARADO (mismo rango):");
console.log(maskJs(line1).slice(from, bad.index + 80));
