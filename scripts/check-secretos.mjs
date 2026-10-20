#!/usr/bin/env node
/* Forja IA — guard de secretos en el código fuente.
 *
 * Escanea el repo buscando patrones que los escáneres estáticos externos
 * (GitHub, plataformas de subida) confunden con credenciales reales. Si algo
 * entra en el repo con pinta de clave, este guard falla ANTES de subir.
 *
 * Los fixtures de test que necesitan una credencial con forma real deben
 * ensamblarse en tiempo de ejecución (ver tests/unit/sandbox-review.test.ts,
 * helper `sec`): el detector de la app la ve en runtime, pero el código
 * fuente queda limpio y este guard también.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const RAIZ = process.cwd();

/** Reglas = las mismas heurísticas que usan los escáneres externos. */
export const REGLAS = [
  { nombre: "clave OpenAI/Anthropic (sk-…)", re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { nombre: "clave OpenRouter (sk-or-v1-…)", re: /\bsk-or-v1-[A-Za-z0-9]{20,}/ },
  { nombre: "clave de Google (AIza…)", re: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { nombre: "token de GitHub (ghp_…)", re: /\bgh[pousr]_[A-Za-z0-9]{25,}/ },
  { nombre: "token fino de GitHub (github_pat_…)", re: /\bgithub_pat_[A-Za-z0-9_]{35,}/ },
  { nombre: "clave de acceso de AWS (AKIA…)", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { nombre: "token de Slack (xox…)", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { nombre: "token de Hugging Face (hf_…)", re: /\bhf_[A-Za-z0-9]{30,}/ },
  { nombre: "clave privada PEM", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { nombre: "prefijo de clave DER (MIIE…)", re: /\bMIIE[A-Za-z0-9+/]{40,}/ },
  // keywords de redacción, construidos por partes para no marcarse a sí mismos
  { nombre: "keyword de redacción (AWS)", re: new RegExp(["aws", "_access_", "key"].join("")) },
  { nombre: "keyword de redacción (GitHub)", re: new RegExp(["github", "_token"].join("")) },
  { nombre: "keyword de redacción (SSH)", re: new RegExp(["ssh", "_private_", "key"].join("")) },
];

const EXCLUIDAS = ["node_modules", ".git", ".next", "coverage", "test-results", "playwright-report", "dist", "build"];
const EXTENSIONES = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".css", ".html", ".json", ".md", ".txt", ".svg", ".sh", ".yml", ".yaml"]);

/** Recorre el repo y devuelve los hallazgos {archivo, linea, regla, muestra}. */
export function escanear(raiz = RAIZ, archivosExtra = []) {
  const hallazgos = [];
  const visita = (dir) => {
    for (const nombre of readdirSync(dir)) {
      if (EXCLUIDAS.includes(nombre)) continue;
      const ruta = join(dir, nombre);
      let st;
      try {
        st = statSync(ruta);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        visita(ruta);
      } else if (EXTENSIONES.has(extname(nombre))) {
        examinar(ruta, hallazgos);
      }
    }
  };
  const examinar = (ruta, out) => {
    let texto;
    try {
      texto = readFileSync(ruta, "utf8");
    } catch {
      return;
    }
    const lineas = texto.split("\n");
    for (let i = 0; i < lineas.length; i++) {
      for (const regla of REGLAS) {
        if (regla.re.test(lineas[i])) {
          out.push({
            archivo: ruta.startsWith(raiz) ? ruta.slice(raiz.length + 1) : ruta,
            linea: i + 1,
            regla: regla.nombre,
            muestra: lineas[i].trim().slice(0, 80),
          });
        }
      }
    }
  };
  visita(raiz);
  return hallazgos;
}

/* --- CLI --- */
const esCLI = process.argv[1] && process.argv[1].endsWith("check-secretos.mjs");
if (esCLI) {
  const hallazgos = escanear(RAIZ);
  if (hallazgos.length) {
    console.error(`✗ ${hallazgos.length} hallazgo(s) con pinta de credencial:\n`);
    for (const h of hallazgos.slice(0, 40)) {
      console.error(`  ${h.archivo}:${h.linea} — ${h.regla}\n    > ${h.muestra}`);
    }
    process.exit(1);
  }
  console.log("✓ Sin patrones de credenciales en el código fuente.");
}
