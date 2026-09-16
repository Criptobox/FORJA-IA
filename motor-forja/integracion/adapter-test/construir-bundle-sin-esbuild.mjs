import { mkdtempSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

// raiz: carpeta con el TS del módulo ya transpilado a CommonJS plano (un
// paso previo a este script, fuera de su alcance — no hay tsc de por medio
// aquí). Sin FORJA_CJS_DIR no hay manera segura de adivinar dónde vive esa
// salida en la máquina de quien lo ejecute.
const raiz = process.env.FORJA_CJS_DIR;
if (!raiz) {
  console.error("Falta FORJA_CJS_DIR: ruta a la carpeta con el módulo ya transpilado a CommonJS.");
  console.error('Uso: FORJA_CJS_DIR=/ruta/al/cjs node construir-bundle-sin-esbuild.mjs [salida.mjs]');
  process.exit(1);
}
const archivos = [];
(function walk(d){ for(const f of readdirSync(d)){ const p=join(d,f); if(statSync(p).isDirectory()) walk(p); else if(f.endsWith(".js")) archivos.push(p);} })(raiz);

const clave = (p) => "./" + relative(raiz, p).split("\\").join("/");
const partes = [];
for (const p of archivos) {
  const codigo = readFileSync(p, "utf8");
  partes.push(`__mods[${JSON.stringify(clave(p))}] = function(module, exports, require){\n${codigo}\n};`);
}

// entrada: la superficie pública, en el mismo orden que entrada.mjs (vive
// junto a este script, no en una ruta fija de una máquina concreta).
const entrada = readFileSync(join(aqui, "entrada.mjs"), "utf8");
const orden = [...entrada.matchAll(/src\/lib\/prism\/forja\/([a-z0-9/-]+)/g)].map(m=>`./${m[1]}.js`);
const entryCode = orden.map(m=>`Object.assign(exports, require(${JSON.stringify(m)}));`).join("\n");
partes.push(`__mods["./__entrada.js"] = function(module, exports, require){\n"use strict";\n${entryCode}\n};`);

const runtime = `
var __mods = {}, __cache = {};
function __resolver(desde, id){
  if (id.charAt(0) !== ".") throw new Error("dependencia externa no permitida: " + id);
  var base = desde.slice(0, desde.lastIndexOf("/"));
  var partes = (base + "/" + id).split("/"), pila = [];
  for (var i = 0; i < partes.length; i++) {
    var t = partes[i];
    if (t === "." || t === "") { if (pila.length === 0) pila.push("."); continue; }
    if (t === "..") { pila.pop(); continue; }
    pila.push(t);
  }
  var r = pila.join("/");
  if (r.indexOf("./") !== 0) r = "./" + r.replace(/^\\.?\\//, "");
  if (!__mods[r] && __mods[r + ".js"]) r = r + ".js";
  if (!__mods[r] && __mods[r + "/index.js"]) r = r + "/index.js";
  return r;
}
function __hacer(id){
  if (__cache[id]) return __cache[id].exports;
  var f = __mods[id];
  if (!f) throw new Error("módulo no encontrado en el bundle: " + id);
  var m = { exports: {} };
  __cache[id] = m;
  f(m, m.exports, function(sub){ return __hacer(__resolver(id, sub)); });
  return m.exports;
}
`;

const cabecera = `/** FORJA IA — BUNDLE DEL MOTOR (motor-forja.mjs) · v4.7.0
 * Generado por integracion/adapter-test/construir-bundle.mjs
 * ESM único, sin dependencias externas, sin Node builtins, sin red.
 */\n`;

let salida = cabecera + runtime + partes.join("\n") + `\nvar __api = __hacer("./__entrada.js");\n`;
// descubrir los nombres exportados ejecutando el bundle en bruto
const nombres = JSON.parse(process.env.NOMBRES ?? "[]");
if (nombres.length) {
  salida += nombres.map(n=>`export var ${n} = __api[${JSON.stringify(n)}];`).join("\n") + "\n";
}
// Sin ruta de salida explícita: un directorio temporal único (no un nombre
// fijo en /tmp compartido por todo el sistema, que cualquier otro proceso
// podría predecir o haber dejado como symlink).
const destino =
  process.argv[2] ?? join(mkdtempSync(join(tmpdir(), "forja-bundle-")), "motor-forja.mjs");
writeFileSync(destino, salida);
console.log("partes", partes.length);
console.log("salida:", destino);
