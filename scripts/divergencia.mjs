// Desalineación exacta: compara original vs enmascarado y muestra la estructura.
import { readFileSync } from "node:fs";
const { maskJs, findUnbalanced } = await import("../src/lib/forja/sandbox-review.ts");

const text = readFileSync("public/motor-forja.mjs", "utf8");
const line1 = text.split("\n")[0];
const bad = findUnbalanced(maskJs(line1));

// Busca hacia atrás los backticks y ${ para entender el anidamiento
const from = Math.max(0, bad.index - 900);
const seg = line1.slice(from, bad.index + 40);
const msk = maskJs(line1).slice(from, bad.index + 40);

// primer índice donde orig y mask divergen en "qué es código"
let primeraDivergencia = -1;
for (let i = 0; i < seg.length; i++) {
  const o = seg[i], m = msk[i];
  const oCodigo = o !== " ";
  const mCodigo = m !== " ";
  if (oCodigo !== mCodigo && o !== "\n") {
    primeraDivergencia = i;
    break;
  }
}
console.log("primera divergencia en offset", primeraDivergencia, "=> abs", from + primeraDivergencia);
console.log("ORIG :", JSON.stringify(seg.slice(Math.max(0, primeraDivergencia - 120), primeraDivergencia + 120)));
console.log("MASK :", JSON.stringify(msk.slice(Math.max(0, primeraDivergencia - 120), primeraDivergencia + 120)));
