import { readFileSync } from "node:fs";
import { maskJs } from "../src/lib/forja/sandbox-review.ts";
const code = readFileSync("public/motor-forja.mjs", "utf8");
const m = maskJs(code);
console.log("ORIG:", JSON.stringify(code.slice(213180, 213430)));
console.log("MASK:", JSON.stringify(m.slice(213180, 213430)));
