// Ground truth v2: rangos exactos de acorn + detección en ambas direcciones.
import { readFileSync } from "node:fs";
import acorn from "acorn";
import { maskJs } from "../src/lib/forja/sandbox-review.ts";

const code = readFileSync("public/motor-forja.mjs", "utf8");
const masked = maskJs(code);

// 0 = código, 1 = literal (texto), 2 = delimitador (backtick, ${, })
const tipo = new Uint8Array(code.length);
const marca = (from: number, to: number, t: number) => {
  for (let i = Math.max(0, from); i < Math.min(to, code.length); i++) tipo[i] = t;
};

const visita = (node: any) => {
  if (!node || typeof node !== "object") return;
  if (node.type === "Literal" && typeof node.value === "string" && typeof node.raw === "string") {
    const r = node.raw;
    if (r[0] === '"' || r[0] === "'" || r[0] === "`") marca(node.start + 1, node.end - 1, 1);
  }
  if (node.type === "RegExpLiteral" || (node.type === "Literal" && (node as any).regex)) {
    const flags = ((node as any).regex?.flags as string | undefined)?.length ?? 0;
    marca(node.start + 1, node.end - 1 - flags, 1); // cuerpo sin el «/» final ni flags
  }
  if (node.type === "TemplateLiteral") {
    marca(node.start, node.start + 1, 2); // backtick de apertura
    marca(node.end - 1, node.end, 2);     // backtick de cierre
    for (const q of node.quasis) {
      if (q.value.raw.length) marca(q.start, q.end, 1);
    }
  }
  for (const k in node) {
    const v = (node as any)[k];
    if (Array.isArray(v)) v.forEach(visita);
    else if (v && typeof v === "object" && v.type) visita(v);
  }
};
visita(acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" }));

const esCodigoMask = (i: number) => masked[i] !== " " && masked[i] !== "\n";
let falsoCodigo = 0; // acorn=literal-texto, masker=código  → paréntesis fantasma
let codigoTragado = 0; // acorn=código real, masker=espacio → código desaparecido
const ejemplos = { falsoCodigo: [] as number[], codigoTragado: [] as number[] };
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  if (c === "\n") continue;
  if (/\s/.test(c)) continue;
  if (tipo[i] === 1 && esCodigoMask(i)) {
    falsoCodigo++;
    if (ejemplos.falsoCodigo.length < 2) ejemplos.falsoCodigo.push(i);
  }
  if (tipo[i] === 0 && !esCodigoMask(i)) {
    codigoTragado++;
    if (ejemplos.codigoTragado.length < 2) ejemplos.codigoTragado.push(i);
  }
}
console.log("falso código (texto tratado como código):", falsoCodigo);
console.log("código tragado (código enmascarado):", codigoTragado);
const ctx = (i: number) => JSON.stringify(code.slice(Math.max(0, i - 350), i + 60));
for (const i of ejemplos.falsoCodigo) {
  console.log(`\nFALSO CÓDIGO en ${i} (char ${JSON.stringify(code[i])}):\n  ${ctx(i)}`);
}
for (const i of ejemplos.codigoTragado) {
  console.log(`\nCÓDIGO TRAGADO en ${i} (char ${JSON.stringify(code[i])}):\n  ${ctx(i)}`);
}
