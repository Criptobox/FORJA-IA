// Localiza la PRIMERA línea del archivo donde el balance (según maskJs) se rompe.
import { readFileSync } from "node:fs";
const { maskJs, findUnbalanced } = await import("../src/lib/forja/sandbox-review.ts");

const file = "public/motor-forja.mjs";
const text = readFileSync(file, "utf8");
const lines = text.split("\n");

let prevOk = "";
for (let k = 0; k < lines.length; k++) {
  const prefijo = lines.slice(0, k + 1).join("\n");
  const bad = findUnbalanced(maskJs(prefijo));
  if (bad) {
    const line = prefijo.slice(0, bad.index).split("\n").length;
    console.log(`PRIMER desequilibrio al incluir línea ${k + 1} (reportada en línea ${line}):`);
    console.log(`  expected=${JSON.stringify(bad.expected)} found=${JSON.stringify(bad.found)}`);
    const lt = (lines[line - 1] ?? "").slice(0, 300);
    const col = bad.index - (prefijo.lastIndexOf("\n", bad.index - 1) + 1);
    console.log(`  contexto línea ${line} col ${col}: …${lt.slice(Math.max(0, col - 120), col + 30)}…`);
    // la línea que ACABAMOS de añadir es la sospechosa si line === k+1
    if (line === k + 1) {
      console.log(`  >> línea culpable ${k + 1}: ${lines[k].slice(0, 260)}`);
    } else {
      console.log(`  >> la corrupción venía de antes; línea añadida ${k + 1}: ${lines[k].slice(0, 160)}`);
    }
    break;
  }
  prevOk = prefijo;
}
console.log("fin");
