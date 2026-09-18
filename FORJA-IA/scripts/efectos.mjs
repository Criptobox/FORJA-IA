#!/usr/bin/env node
/** Forja IA — Empaquetar el kit de efectos dentro del bundle.
 *
 * El kit vive en `assets/prism-fx.css` y `assets/prism-fx.js` como archivos de
 * verdad: se editan con resaltado, se pueden abrir en un navegador y no hay
 * que pelearse con las comillas de una plantilla. Este script los mete en un
 * módulo TypeScript para que viajen con la app.
 *
 *   npm run efectos     → regenera src/lib/prism/efectos-datos.ts
 *
 * ——— Por qué no un CDN ———
 *
 * Porque la página generada acaba en el ZIP del usuario, en su GitHub Pages y
 * en un iframe sin `allow-same-origin`. Con un CDN, cualquiera de los tres
 * caminos se rompe en silencio el día que ese CDN no responde — y Forja no
 * sabría distinguir «tu código falla» de «no cargó la librería». Local no
 * tiene ese problema: lo que se ve en la vista previa es lo que se publica.
 *
 * Hay un unitario que compara este módulo con los archivos de `assets/`: si
 * editas el CSS y no regeneras, la prueba lo dice.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(raiz, "assets/prism-fx.css"), "utf8");
const js = readFileSync(join(raiz, "assets/prism-fx.js"), "utf8");
// El motor 3D es un archivo aparte: no toda dirección visual lo necesita, y
// separarlo evita que una landing tranquila cargue 6 KB de WebGL que nunca usa.
const js3d = readFileSync(join(raiz, "assets/prism-3d.js"), "utf8");

const salida = `/* GENERADO por \`npm run efectos\` — no editar a mano.
 * La fuente son \`assets/prism-fx.css\`, \`assets/prism-fx.js\` y
 * \`assets/prism-3d.js\`: edita ahí y vuelve a ejecutar el comando. Un unitario
 * comprueba que no se han separado.
 */

/** El CSS del kit, tal cual va a la página generada. */
export const FX_CSS = ${JSON.stringify(css)};

/** El JS del kit, tal cual va a la página generada. */
export const FX_JS = ${JSON.stringify(js)};

/** El motor 3D — WebGL propio, sin librería. Solo se añade al proyecto si
 * algo lo enlaza (ver \`efectos.ts\`): no toda página lo necesita. */
export const FX3D_JS = ${JSON.stringify(js3d)};
`;

writeFileSync(join(raiz, "src/lib/prism/efectos-datos.ts"), salida);
console.log(
  `prism-fx empaquetado: ${css.length} car. de CSS + ${js.length} car. de JS + ${js3d.length} car. de 3D`
);
