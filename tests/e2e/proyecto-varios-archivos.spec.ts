import { expect, test, type Page } from "./fixtures";
import { readFileSync } from "node:fs";
import { readZip } from "../../src/lib/forja/zip";

/** Forja IA — Una app de varios archivos funciona en la vista previa y se
 *  descarga lista para abrir y editar.
 *
 * «Convertir en app completa» pide a la IA un proyecto con módulos ES (Modo
 * App): index.html + styles.css + js/app.js + js/store.js. Esto comprueba la
 * mitad que no depende del modelo: que la vista previa EJECUTA esos archivos
 * (la hoja de estilos se aplica y los import entre módulos se resuelven) y que
 * el ZIP lleva todos los archivos y el README para abrirlo fuera. */

const PROYECTO = [
  "Aquí tienes la app con varios archivos.",
  "```html — index.html",
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"><title>Tareas</title></head><body><h1 id="t">Cargando…</h1><ul id="l"></ul><script type="module" src="js/app.js"></script></body></html>',
  "```",
  "```css — styles.css",
  "h1{color:rgb(200, 40, 30)}",
  "```",
  "```js — js/app.js",
  'import { titulo, tareas } from "./store.js";',
  'document.getElementById("t").textContent = titulo();',
  'document.getElementById("l").innerHTML = tareas().map((t) => `<li>${t}</li>`).join("");',
  "```",
  "```js — js/store.js",
  'export const tareas = () => ["Comprar pan", "Llamar a Ana", "Pagar la luz"];',
  "export const titulo = () => `Mis tareas (${tareas().length})`;",
  "```",
].join("\n");

async function preparar(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            skills: [],
            settings: { defaultModelKey: "custom::mock-mini-free", accessCode: "", agentModes: [], agentMode: false, ahorro: false },
            providers: { custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  });
  await page.route("**/api/mock-llm/**", async (route) => {
    if (route.request().method() !== "POST" || !/chat\/completions/.test(route.request().url())) return route.continue();
    const body = `data: ${JSON.stringify({ choices: [{ delta: { content: PROYECTO } }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`;
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body });
  });
}

test("una app de varios archivos funciona en la vista previa y el ZIP trae todo y el README", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  await preparar(page);
  await page.goto("/");
  const caja = page.locator("textarea").first();
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("Crea una app de lista de tareas con varios archivos");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  // la vista previa ejecuta los módulos: el import de store.js se resolvió y el CSS se aplicó
  const vista = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(vista.locator("#t")).toHaveText("Mis tareas (3)", { timeout: 60_000 });
  await expect(vista.locator("li")).toHaveCount(3);
  await expect(vista.locator("#t")).toHaveCSS("color", "rgb(200, 40, 30)");

  // el ZIP lleva los cuatro archivos y un README para abrirlo fuera de Forja
  await page.getByRole("button", { name: "Descargar lo creado" }).click();
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByText("Descargar todo (.zip)").click()]);
  const ruta = await descarga.path();
  const buf = readFileSync(ruta);
  const entradas = await readZip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const nombres = entradas.map((e) => e.path).sort();
  for (const f of ["index.html", "styles.css", "js/app.js", "js/store.js", "README.md"]) expect(nombres).toContain(f);
  const readme = new TextDecoder().decode(entradas.find((e) => e.path === "README.md")!.data);
  expect(readme).toContain("npx serve");
  expect(readme).toContain("`js/store.js`");
});

test("los archivos del proyecto se editan en la pestaña de código y la vista previa se repinta", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  await preparar(page);
  await page.goto("/");
  const caja = page.locator("textarea").first();
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("Crea una app de lista de tareas con varios archivos");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  const vista = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(vista.locator("#t")).toHaveText("Mis tareas (3)", { timeout: 60_000 });

  await page.getByRole("button", { name: "Alternar código" }).click();
  const editor = page.getByTestId("editor-archivos");
  await expect(editor.getByRole("tab")).toHaveCount(4);
  await editor.getByRole("tab", { name: "styles.css" }).click();
  await expect(page.getByTestId("editor-codigo")).toHaveValue("h1{color:rgb(200, 40, 30)}");
  await page.getByTestId("editor-codigo").fill("h1{color:rgb(10, 120, 60)}");
  await page.getByTestId("guardar-archivo").click();
  await expect(editor.getByRole("status")).toContainText("Guardado");

  // de vuelta a la vista previa: el cambio está pintado, sin pedir nada a la IA
  await page.getByRole("button", { name: "Alternar código" }).click();
  await expect(vista.locator("#t")).toHaveCSS("color", "rgb(10, 120, 60)", { timeout: 20_000 });
  await expect(vista.locator("#t")).toHaveText("Mis tareas (3)");
});
