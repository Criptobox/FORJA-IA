import { readFileSync } from "node:fs";
import acorn from "acorn";
const code = readFileSync("public/motor-forja.mjs", "utf8");
console.log("ORIG 950-1050:", JSON.stringify(code.slice(950, 1050)));
const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
// busca el nodo que contiene 968
const hits: string[] = [];
const visita = (node: any, prof: number) => {
  if (!node || typeof node !== "object") return;
  if (typeof node.start === "number" && typeof node.end === "number") {
    if (node.start <= 968 && node.end >= 1010) {
      hits.push(`${"  ".repeat(prof)}${node.type} [${node.start},${node.end}] raw=${JSON.stringify(String(node.raw ?? "").slice(0, 60))}`);
    }
  }
  for (const k in node) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((n: any) => visita(n, prof + 1));
    else if (v && typeof v === "object" && v.type) visita(v, prof + 1);
  }
};
visita(ast, 0);
console.log(hits.join("\n"));
