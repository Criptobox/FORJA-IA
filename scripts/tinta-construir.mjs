#!/usr/bin/env node
/** Forja IA — Construir el motor Tinta.
 *
 * Tinta (la biblioteca de diseño: bloques, plantillas, paletas, recetas y el
 * equipo de agentes) vive en `tinta/web/` como scripts clásicos del navegador.
 * Esto la empaqueta en UN HTML autónomo, `public/tinta/motor.html`, que el
 * chat y el Estudio cargan en un iframe del mismo origen (`?motor=1`):
 *
 *   · los CSS van dentro, con la fuente Jakarta en data: URI;
 *   · los 59 scripts, en el orden de `crear.html`, van juntos en un solo bloque
 *     base64 (sin etiquetas HTML literales dentro del script);
 *   · se escribe `src/lib/forja/tinta/version.ts` con un hash del resultado,
 *     que va en la dirección del iframe para que una copia nueva no salga de caché.
 *
 *   npm run tinta            → reconstruye
 *   npm run tinta -- --check → falla si public/tinta/motor.html no está al día
 *
 * Es determinista: mismas fuentes, mismo archivo. Un test lo comprueba, así
 * que tocar `tinta/web/` sin reconstruir se nota en CI. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RAIZ = new URL("../", import.meta.url);
const WEB = new URL("tinta/web/", RAIZ);
export const SALIDA = new URL("public/tinta/motor.html", RAIZ);
export const VERSION_TS = new URL("src/lib/forja/tinta/version.ts", RAIZ);

const uri = (ruta, mime) => `data:${mime};base64,${readFileSync(new URL(ruta, WEB)).toString("base64")}`;

/** Las etiquetas <script src="…"></script> de crear.html, recorriendo el texto
 *  (sin expresiones regulares sobre HTML): devuelve sus rutas y el HTML sin ellas. */
export function separarScripts(html) {
  const rutas = [];
  let salida = "";
  let desde = 0;
  const bajo = html.toLowerCase();
  for (;;) {
    const ini = bajo.indexOf("<script", desde);
    if (ini < 0) break;
    const finApertura = html.indexOf(">", ini);
    if (finApertura < 0) throw new Error("crear.html tiene una etiqueta <script sin cerrar");
    const apertura = html.slice(ini, finApertura + 1);
    const i = apertura.indexOf('src="');
    if (i < 0) {
      // un <script> en línea se queda tal cual
      salida += html.slice(desde, finApertura + 1);
      desde = finApertura + 1;
      continue;
    }
    const ruta = apertura.slice(i + 5, apertura.indexOf('"', i + 5));
    const cierre = bajo.indexOf("</script", finApertura);
    const finCierre = cierre < 0 ? -1 : html.indexOf(">", cierre);
    if (!ruta || finCierre < 0) throw new Error("crear.html enlaza un script que el empaquetador no entiende");
    rutas.push(ruta);
    salida += html.slice(desde, ini);
    desde = finCierre + 1;
  }
  return { rutas, html: salida + html.slice(desde) };
}

/** Devuelve { html, version, versionTs } sin escribir nada. */
export function construir() {
  let html = readFileSync(new URL("crear.html", WEB), "utf8");
  const css = readFileSync(new URL("css/crear.css", WEB), "utf8").replace("../fonts/plus-jakarta-sans.woff2", uri("fonts/plus-jakarta-sans.woff2", "font/woff2"));
  const equipo = readFileSync(new URL("css/equipo.css", WEB), "utf8");
  const separado = separarScripts(html);
  const rutas = separado.rutas;
  html = separado.html;
  if (!rutas.length) throw new Error("crear.html no enlaza ningún script");
  const js = Buffer.concat(rutas.flatMap((r, i) => (i ? [Buffer.from("\n;\n"), readFileSync(new URL(r, WEB))] : [readFileSync(new URL(r, WEB))])));
  if (!js.includes("tinta:pedir")) throw new Error("Los scripts no traen el modo motor (tinta:pedir)");
  const arranque =
    "(()=>{const s=document.createElement('script');s.textContent=new TextDecoder().decode(Uint8Array.from(atob('" +
    js.toString("base64") +
    "'),c=>c.charCodeAt(0)));document.body.appendChild(s);})();";
  html = html.replace('<link rel="stylesheet" href="css/crear.css">', () => "<style>" + css + "</style>");
  html = html.replace('<link rel="stylesheet" href="css/equipo.css">', () => "<style>" + equipo + "</style>");
  html = html.replace("</body>", () => "<script>" + arranque + "</script></body>");
  html = html.replace("images/tinta-avatar.webp", () => uri("images/tinta-avatar.webp", "image/webp"));
  html = html.replace("icons/icon-192.png", () => uri("icons/icon-192.png", "image/png"));
  // Dentro de FORJA el editor es de Forja: su marca, no la de Estilos.
  html = html
    .replace('<button class="wordmark" data-act="go" data-page="home" aria-label="Estilos, inicio">estilos<span>®</span></button>', '<button class="wordmark wordmark-forja" data-act="go" data-page="home" aria-label="Forja IA, inicio">Forja<span>IA</span></button>')
    .replace("<title>Estilos — Dale forma a tu idea</title>", "<title>Forja IA — Editor de diseño</title>")
    .replace('content="Estilos"><meta name="apple-mobile-web-app-status-bar-style"', 'content="Forja IA"><meta name="apple-mobile-web-app-status-bar-style"');
  for (const marca of ['class="wordmark wordmark-forja"', "<title>Forja IA — Editor de diseño</title>"]) {
    if (!html.includes(marca)) throw new Error(`No se pudo poner la marca de Forja en el editor (falta: ${marca})`);
  }
  // Dentro de FORJA no existen el editor clásico ni la biblioteca de Estilos.
  html = html.replaceAll('<a href="biblioteca.html">Biblioteca completa</a>', "").replaceAll('<a href="agente.html">Editor clásico y proyectos</a>', "");
  const version = createHash("sha256").update(html).digest("hex").slice(0, 12);
  const versionTs = `/** Huella del motor Tinta construido (la escribe scripts/tinta-construir.mjs; no se edita a mano). */\nexport const TINTA_VERSION = ${JSON.stringify(version)};\n`;
  return { html, version, versionTs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { html, version, versionTs } = construir();
  if (process.argv.includes("--check")) {
    const actual = (() => { try { return readFileSync(SALIDA, "utf8"); } catch { return ""; } })();
    const ver = (() => { try { return readFileSync(VERSION_TS, "utf8"); } catch { return ""; } })();
    if (actual !== html || ver !== versionTs) {
      console.error("public/tinta/motor.html no está al día con tinta/web/. Ejecuta: npm run tinta");
      process.exit(1);
    }
    console.log(`Motor Tinta al día (${version}).`);
  } else {
    mkdirSync(new URL("public/tinta/", RAIZ), { recursive: true });
    writeFileSync(SALIDA, html);
    writeFileSync(VERSION_TS, versionTs);
    console.log(`Motor Tinta construido: ${version} (${Math.round(html.length / 1024)} KB).`);
  }
}
