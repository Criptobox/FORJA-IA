/**
 * FORJA IA — ENTRADA DEL BUNDLE DEL MOTOR (motor-forja.mjs).
 *
 * Fichero referido por la documentación desde v4.3 («entrada del bundle:
 * adapter-test/entrada.mjs (esbuild, ESM único)») pero que faltaba en el
 * ZIP — v4.4 lo incluye. Es la superficie pública que el Estudio del host
 * importa en runtime (new Function + import, fuera del bundler de Next).
 *
 * Construir el bundle (desde la carpeta del MÓDULO):
 *
 *   node integracion/adapter-test/construir-bundle.mjs <salida.mjs>
 *
 * o con esbuild a mano:
 *
 *   npx esbuild integracion/adapter-test/entrada.mjs \
 *     --bundle --format=esm --platform=browser --target=es2020 \
 *     --outfile=public/motor-forja.mjs
 *
 * Reglas: ESM único, sin Node builtins, sin red — el Estudio lo ejecuta
 * en el navegador y el Lab en el servidor con el mismo fichero.
 */

/* v4.68 — el motor vive ahora dentro de la app, en src/lib/forja/motor/, y
 * la app lo importa tipado (ya no usa public/motor-forja.mjs). Esta entrada
 * se conserva para quien quiera seguir generando un paquete suelto (el Lab):
 * re-exporta la misma superficie pública. */
export * from "../../../src/lib/forja/motor/index.ts";
