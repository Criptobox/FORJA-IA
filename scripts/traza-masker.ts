// Traza las decisiones del masker en un rango de índices concretos.
import { readFileSync } from "node:fs";

const text = readFileSync("public/motor-forja.mjs", "utf8");
const code = text.split("\n")[0];
const RANGO = [35350, 35700];

const eventos = [];
const log = (m) => eventos.push(m);

const cierreRegex = (from: number, to: number): number => {
  let j = from + 1;
  let enClase = false;
  while (j < to) {
    const d = code[j];
    if (d === "\\") { j += 2; continue; }
    if (d === "\n") return -1;
    if (d === "[") enClase = true;
    else if (d === "]") enClase = false;
    else if (d === "/" && !enClase) return j;
    j++;
  }
  return -1;
};
const posibleRegex = (prev: string): boolean =>
  prev === "" || /[(,=:[!&|?{};+\-*%~^<>]/.test(prev);
const saltoCadena = (i: number, to: number): number => {
  const q = code[i];
  let j = i + 1;
  while (j < to) {
    if (code[j] === "\\") { j += 2; continue; }
    if (code[j] === q || code[j] === "\n") break;
    j++;
  }
  return Math.min(j + 1, to);
};
function matchingBrace(from: number, to: number, prof: number): number {
  let depth = 0;
  let prev = "{";
  let i = from;
  while (i < to) {
    const c = code[i];
    if (c === '"' || c === "'") { log(`${" ".repeat(prof)}cadena ${i}→${saltoCadena(i, to)}`); i = saltoCadena(i, to); continue; }
    if (c === "`") { log(`${" ".repeat(prof)}template-salto ${i}→`); i = saltoTemplate(i, to, prof + 1); continue; }
    if (c === "/" && code[i + 1] === "/") { const j = code.indexOf("\n", i); i = j < 0 ? to : j; continue; }
    if (c === "/" && code[i + 1] === "*") { const j = code.indexOf("*/", i + 2); i = j < 0 ? to : j + 2; continue; }
    if (c === "/" && posibleRegex(prev)) { const end = cierreRegex(i, to); if (end > 0) { log(`${" ".repeat(prof)}regex ${i}→${end}`); prev = "/"; i = end + 1; continue; } }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { log(`${" ".repeat(prof)}brace ${from} cierra en ${i}`); return i; } }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  log(`${" ".repeat(prof)}brace ${from} SIN CERRAR`);
  return -1;
}
function saltoTemplate(i: number, to: number, prof: number): number {
  let j = i + 1;
  while (j < to) {
    if (code[j] === "\\") { j += 2; continue; }
    if (code[j] === "`") return j + 1;
    if (code[j] === "$" && code[j + 1] === "{") {
      const close = matchingBrace(j + 1, to, prof);
      if (close < 0) return to;
      j = close + 1;
      continue;
    }
    j++;
  }
  return to;
}

function procesar(from: number, to: number, prevIn: string, prof: number): void {
  let prevSignificant = prevIn;
  let i = from;
  while (i < to) {
    const c = code[i];
    const next = code[i + 1];
    if (c === "/" && next === "/") { let j = i + 2; while (j < to && code[j] !== "\n") j++; i = j; continue; }
    if (c === "/" && next === "*") { const j = code.indexOf("*/", i + 2); i = j < 0 ? to : j + 2; continue; }
    if (c === '"' || c === "'") {
      const j = saltoCadena(i, to);
      if (i >= RANGO[0] && i <= RANGO[1]) log(`${" ".repeat(prof)}cadena ${i}→${j}: ${JSON.stringify(code.slice(i, Math.min(j, i + 40)))}`);
      i = j; prevSignificant = c; continue;
    }
    if (c === "`") {
      if (i >= RANGO[0] - 200 && i <= RANGO[1]) log(`${" ".repeat(prof)}TEMPLATE abre en ${i}: ${JSON.stringify(code.slice(i, i + 50))}`);
      let j = i + 1;
      while (j < to) {
        if (code[j] === "\\") { j += 2; continue; }
        if (code[j] === "`") { if (i >= RANGO[0] - 200 && i <= RANGO[1]) log(`${" ".repeat(prof)}TEMPLATE cierra en ${j}`); break; }
        if (code[j] === "$" && code[j + 1] === "{") {
          const close = matchingBrace(j + 1, to, prof + 1);
          if (close < 0) { if (i >= RANGO[0] - 200 && i <= RANGO[1]) log(`${" ".repeat(prof)}${j} ${'{'} SIN CERRAR → traga el resto`); j = to; break; }
          if (i >= RANGO[0] - 200 && i <= RANGO[1]) log(`${" ".repeat(prof)}interp ${j}→${close}`);
          procesar(j + 2, close, "{", prof + 1);
          j = close + 1;
          continue;
        }
        j++;
      }
      i = Math.min(j + 1, to);
      prevSignificant = "`";
      continue;
    }
    if (c === "/" && posibleRegex(prevSignificant)) {
      const end = cierreRegex(i, to);
      if (end > 0) {
        if (i >= RANGO[0] && i <= RANGO[1]) log(`regex ${i}→${end}: ${JSON.stringify(code.slice(i, Math.min(end + 2, i + 40)))}`);
        i = end + 1; prevSignificant = "/"; continue;
      }
    }
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
}

procesar(0, code.length, "", 0);
console.log(eventos.slice(-40).join("\n"));
