#!/usr/bin/env node
/** Forja IA — Actualizar la copia del motor Tinta.
 *
 * La biblioteca Tinta (bloques, plantillas, paletas, recetas y el equipo de
 * agentes) vive en el repositorio de Estilos y se trae aquí ya construida,
 * como un único HTML que corre en un iframe del mismo origen
 * (public/tinta/motor.html?motor=1). Para actualizarla:
 *
 *   1. En Estilos:  python3 tools/build-tinta.py --output /ruta/Estilos-Tinta.html
 *   2. Aquí:        node scripts/tinta-actualizar.mjs /ruta/Estilos-Tinta.html 12.68
 *
 * Comprueba que el archivo es de verdad el motor (que trae el modo motor) antes
 * de copiarlo, y anota la versión de Estilos en src/lib/forja/tinta/version.ts. */
import { copyFileSync, readFileSync, statSync, writeFileSync } from "node:fs";

const [origen, version] = process.argv.slice(2);
if (!origen || !version) {
  console.error("Uso: node scripts/tinta-actualizar.mjs <Estilos-Tinta.html> <versión de Estilos, p. ej. 12.68>");
  process.exit(1);
}
const html = readFileSync(origen, "utf8");
const payload = html.match(/atob\('([A-Za-z0-9+/=]+)'\)/);
const js = payload ? Buffer.from(payload[1], "base64").toString("utf8") : "";
if (!/<!doctype html>/i.test(html) || !js.includes("tinta:pedir") || !js.includes("MOTOR_API")) {
  console.error("Ese archivo no parece el motor Tinta (falta el modo motor). ¿Es una versión de Estilos anterior a la 12.68?");
  process.exit(1);
}
copyFileSync(origen, new URL("../public/tinta/motor.html", import.meta.url));
writeFileSync(
  new URL("../src/lib/forja/tinta/version.ts", import.meta.url),
  `/** Versión de Estilos de la que sale public/tinta/motor.html (la escribe scripts/tinta-actualizar.mjs). */\nexport const TINTA_ESTILOS_VERSION = ${JSON.stringify(version)};\n`
);
console.log(`Motor Tinta actualizado a Estilos ${version} (${Math.round(statSync(origen).size / 1024)} KB).`);
