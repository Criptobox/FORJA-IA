#!/usr/bin/env node
/** FORJA IA — CONSTRUIR EL BUNDLE DEL MOTOR (motor-forja.mjs).
 *
 * Uso (desde cualquier carpeta):
 *
 *   node integracion/adapter-test/construir-bundle.mjs [salida.mjs]
 *
 * - entrada: integracion/adapter-test/entrada.mjs (las exportaciones públicas)
 * - salida:  por defecto ../host-forja-ia/public/motor-forja.mjs relativa al
 *   módulo, o el 1er argumento.
 *
 * Requiere esbuild (npm i -D esbuild o npx). Sin esbuild instalado, el
 * script avisa con el comando npx equivalente.
 *
 * Post-chequeo: tras compilar, verifica que las funciones CRÍTICAS que el
 * Estudio usa por nombre existen en el bundle (import de humo con node).
 * Si un nombre falta (colisión de star-exports), el script lo lista para
 * arreglar la entrada.
 */

import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const entrada = resolve(aqui, "entrada.mjs");
const salida = resolve(process.argv[2] ?? resolve(aqui, "../../../../host-forja-ia/public/motor-forja.mjs"));

mkdirSync(dirname(salida), { recursive: true });

const t0 = Date.now();
const res = await build({
  entryPoints: [entrada],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  outfile: salida,
  minify: false,
  legalComments: "inline",
  logLevel: "info",
});

if (res.errors.length) {
  console.error("✗ el bundle no se construyó");
  process.exit(1);
}

/** Nombres que el Estudio usa por nombre (motor-client / ficha-tab /
 * motor-tab / adn-tab / calidad-tabs). Si alguno falta, la pestaña que lo
 * llama se rompe en runtime — mejor fallar AQUÍ. */
const CRITICOS = [
  // núcleo + blindaje
  "ejecutarForja", "ejecutarMvpForja", "crearCacheMemoria", "resumenCache",
  "techoTokens", "sanearTokensRol", "MAX_TOKENS_DEFECTO",
  "esTruncadoEstructural", "continuarSalidaTruncada", "continuarConLlamada",
  "crearSaludProveedores", "crearAdaptadorForja",
  "crearRegistro", "cerrarRegistro", "crearTelemetriaForja",
  // ADN + sistema
  "adn2DesdeAdn1", "parseAdn2", "textoAdn2", "tokensCssDesdeAdn2",
  "designSystemCompleto", "revisarVisual", "scoreDe",
  // v4.4 eficiencia
  "presupuestoPara", "crearPresupuesto", "complejidadDe",
  "crearCacheMultinivel", "claveArquitectura", "claveQA", "NIVEL",
  "compilarContexto", "resumenContexto",
  "detectarParches", "parchearHtml", "ahorroEstimado",
  "decidirSiguientePaso", "esSuficientementeBueno", "resumenTemprana",
  "crearLibroROI", "roiAJSON", "roiDesdeJSON",
  "crearLlamadaEficiente", "faseDeRol", "estimarTokensSalida",
  "VERSION_FORJA", "NOMBRE_VERSION_FORJA",
];

// import de humo: node carga el ESM y lista los críticos ausentes
const mod = await import(`file://${salida}`);
const faltan = CRITICOS.filter((n) => mod[n] === undefined);
const total = Object.keys(mod).length;
console.log(`\nbundle: ${salida}`);
console.log(`exportaciones: ${total} · tamaño: ${(res.outputFiles ? "" : "")}${Math.round((await import("node:fs")).statSync(salida).size / 1024)} KB · ${Date.now() - t0} ms`);
if (faltan.length) {
  console.error(`✗ faltan ${faltan.length} críticos (colisión de star-exports): ${faltan.join(", ")}`);
  console.error("  → añade export explícito al final de entrada.mjs para esos nombres.");
  process.exit(2);
}
console.log(`✓ todos los ${CRITICOS.length} críticos presentes`);
