import { readFileSync } from "node:fs";
import { maskJs } from "../src/lib/forja/sandbox-review.ts";

const text = readFileSync("public/motor-forja.mjs", "utf8");
const code = text;
const m: string = maskJs(code);

const pila: number[] = [];
const anomalias: { tipo: string; index: number }[] = [];
for (let i = 0; i < m.length; i++) {
  const c = m[i];
  if (c === "{" || c === "(" || c === "[") pila.push(i);
  else if (c === "}" || c === ")" || c === "]") {
    if (!pila.length) anomalias.push({ tipo: "cierre sin apertura", index: i });
    else pila.pop();
  }
}
for (const idx of pila) anomalias.push({ tipo: "apertura sin cierre", index: idx });

console.log("anomalías {}:", anomalias.length);
const primer = anomalias[0];
console.log("PRIMERA:", primer);
// retrocede hasta el último char de código visible antes de la anomalía
let ultimoCodigo = primer.index;
for (let i = primer.index - 1; i >= 0; i--) {
  const oc = code[i], mc = m[i];
  if (mc !== " " || oc === " " || oc === "\n") continue; // mc no-blank = código
  if (mc === " ") { /* blanked */ }
  ultimoCodigo = i; break;
}
// busca el último char VISIBLE en el mask antes de primer.index
let vis = -1;
for (let i = primer.index - 1; i >= 0; i--) {
  if (m[i] !== " " && m[i] !== "\n") { vis = i; break; }
}
const visibles: number[] = [];
for (let i = 0; i < primer.index; i++) if (m[i] === "/") visibles.push(i);
const ult = visibles.slice(-4);
for (const v of ult) console.log("visible / en", v, "orig:", JSON.stringify(code.slice(Math.max(0,v-40), v+40)));
console.log("último char visible en mask:", vis, JSON.stringify(code.slice(vis - 60, vis + 10)));
const from = Math.max(0, primer.index - 260);
console.log("--- ORIGINAL alrededor ---");
console.log(code.slice(from, primer.index + 120));
console.log("--- MASCARADO alrededor ---");
console.log(m.slice(from, primer.index + 120));
