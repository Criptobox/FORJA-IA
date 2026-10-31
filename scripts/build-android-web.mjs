#!/usr/bin/env node
/** Forja IA — interfaz estática para la APK de Android.
 *
 * La APK lleva Forja dentro y no tiene servidor: las rutas de `src/app/api` y
 * `src/app/share` (proxy, GitHub, mocks…) no pueden ir en una exportación
 * estática y Next se niega a exportar con ellas presentes. Se apartan, se
 * construye con FORJA_ANDROID=1 (output: "export") y se devuelven SIEMPRE,
 * también si la build falla. El resultado queda en `out/`.
 *
 * Uso: node scripts/build-android-web.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = process.cwd();
const APARTAR = ["src/app/api", "src/app/share"];
const aparte = mkdtempSync(join(tmpdir(), "forja-android-"));
const movidos = [];

function devolver() {
  for (const { desde, hacia } of movidos.reverse()) {
    if (existsSync(hacia)) renameSync(hacia, desde);
  }
  movidos.length = 0;
}
process.on("SIGINT", () => {
  devolver();
  process.exit(130);
});

try {
  for (const rel of APARTAR) {
    const desde = join(RAIZ, rel);
    if (!existsSync(desde)) continue;
    const hacia = join(aparte, rel.replace(/\//g, "__"));
    renameSync(desde, hacia);
    movidos.push({ desde, hacia });
  }
  rmSync(join(RAIZ, "out"), { recursive: true, force: true });
  execSync("npx next build", {
    stdio: "inherit",
    env: { ...process.env, FORJA_ANDROID: "1", NEXT_PUBLIC_FORJA_ANDROID: "1" },
  });
} finally {
  devolver();
  rmSync(aparte, { recursive: true, force: true });
}
console.log("Interfaz estática para Android en out/");
