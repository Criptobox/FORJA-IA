// Compara el masker con el tokenizador real (acorn) y muestra la PRIMERA
// divergencia: dónde el masker cree «código» y acorn dice «cadena/template».
import { readFileSync } from "node:fs";
import acorn from "acorn";
import { maskJs } from "../src/lib/forja/sandbox-review.ts";

const code = readFileSync("public/motor-forja.mjs", "utf8");
const masked = maskJs(code);

// tokens reales de acorn sobre la línea 1 (todo el archivo menos lo demás)
const linea1 = code;
const ast = acorn.parse(linea1, { ecmaVersion: "latest", sourceType: "module", allowReturnOutsideFunction: true });

// construye el mapa «posición → dentro de string/template/regex» con los tokens
const enLiteral = new Uint8Array(linea1.length); // 1 = literal (debe estar enmascarado)
const visita = (node: any) => {
  if (!node || typeof node !== "object") return;
  if (node.type === "Literal" && typeof node.value === "string" && node.raw) {
    const raw = node.raw;
    if (raw[0] === '"' || raw[0] === "'" || raw[0] === "`") {
      for (let i = node.start + 1; i < node.end - 1; i++) enLiteral[i] = 1;
    }
  }
  if (node.type === "TemplateLiteral") {
    // los quasis son texto literal; las expressions son código
    let pos = node.start + 1;
    for (let q = 0; q < node.quasis.length; q++) {
      const quasi = node.quasis[q];
      const finTexto = pos + quasi.value.raw.length;
      for (let i = pos; i < finTexto; i++) enLiteral[i] = 1;
      pos = finTexto;
      if (q < node.expressions.length) {
        const expr = node.expressions[q];
        pos = expr.end; // la expresión es código
      }
      pos += 2; // saltar `}` y quizá backtick
    }
  }
  if (node.type === "RegExpLiteral" && node.raw) {
    for (let i = node.start + 1; i < node.end - 1; i++) enLiteral[i] = 1;
  }
  for (const k in node) {
    const v = (node as any)[k];
    if (Array.isArray(v)) v.forEach(visita);
    else if (v && typeof v === "object" && v.type) visita(v);
  }
};
visita(ast);

// primera divergencia: acorn dice literal (debe ir enmascarado) pero el masker
// lo dejó «código» (no espacio, no backtick/comillas de borde)
let divergencias = 0;
for (let i = 0; i < linea1.length; i++) {
  if (!enLiteral[i]) continue;
  const c = linea1[i];
  if (c === "\n") continue;
  if (masked[i] !== " ") {
    divergencias++;
    if (divergencias <= 3) {
      console.log(`DIVERGENCIA en ${i}: acorn=literal, masker=código`);
      console.log("  orig :", JSON.stringify(linea1.slice(Math.max(0, i - 120), i + 40)));
      console.log("  char :", JSON.stringify(c));
    }
  }
}
console.log("total divergencias:", divergencias);
