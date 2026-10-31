import { join } from "node:path";
import { expect, test, type Page } from "./fixtures";

/** Forja IA — Modelo local .gguf que corre DENTRO del navegador.
 *
 * Con un .gguf de verdad (tests/fixtures/forja-diminuto.gguf, 0,5 MB, pesos
 * aleatorios: responde sin sentido, pero es un modelo llama completo que
 * llama.cpp carga y ejecuta): se elige en Ajustes, se guarda en el
 * almacenamiento del sitio, responde en streaming sin una sola petición a un
 * proveedor, sobrevive a recargar la página y funciona con el modo agente.
 * Se regenera con `python scripts/gguf-de-prueba.py`.
 */
// Playwright carga los specs como CommonJS: la ruta, desde la raíz del repo.
const GGUF = join(process.cwd(), "tests/fixtures/forja-diminuto.gguf");
const MODELO = "gguf::forja-diminuto.gguf";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    if (sessionStorage.getItem("sembrado")) return;
    sessionStorage.setItem("sembrado", "1");
    localStorage.setItem(
      "forja-ai-v1",
      JSON.stringify({ state: { sessions: [], activeSessionId: null, onboardingDone: true, settings: { stream: true }, version: 1 }, version: 0 })
    );
  });
});

/** Registra cada anuncio de la región viva del chat (inicio y fin de respuesta). */
async function escucharAnuncios(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('main [role="status"].sr-only');
    const w = window as unknown as { __an: string[] };
    w.__an = [];
    if (el) new MutationObserver(() => w.__an.push(el.textContent ?? "")).observe(el, { childList: true, characterData: true, subtree: true });
  });
}

async function enviar(page: Page, texto: string): Promise<string[]> {
  const desde = await page.evaluate(() => (window as unknown as { __an: string[] }).__an.length);
  await page.getByRole("textbox", { name: "Mensaje" }).fill(texto);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (d) => (window as unknown as { __an: string[] }).__an.slice(d).some((t) => /lista|error/.test(t)),
    desde,
    { timeout: 120_000 }
  );
  return page.evaluate((d) => (window as unknown as { __an: string[] }).__an.slice(d), desde);
}

async function ultimaRespuesta(page: Page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("forja-ai-v1") ?? "{}").state;
    const ses = s.sessions.find((x: { id: string }) => x.id === s.activeSessionId);
    const a = ses?.messages.filter((m: { role: string }) => m.role === "assistant").pop();
    return { modelo: s.settings.defaultModelKey as string, contenido: (a?.content ?? "") as string, error: !!a?.error };
  });
}

test("elegir un .gguf y chatear con él sin servidor ni red", async ({ page }) => {
  const aProveedores: string[] = [];
  page.on("request", (r) => {
    if (/chat\/completions|\/api\/proxy/.test(r.url())) aProveedores.push(r.url());
  });
  await page.goto("/");
  await page.locator("textarea").first().waitFor({ timeout: 60_000 });

  await page.getByRole("button", { name: "Ajustes", exact: true }).first().click();
  const dialogo = page.getByRole("dialog");
  const tab = dialogo.getByRole("tab", { name: /Proveedores|Modelos/ }).first();
  if (await tab.count()) await tab.click();
  await dialogo.getByRole("button", { name: "Abrir Modelo local (.gguf)" }).click();
  await dialogo.locator('input[aria-label="Archivo .gguf"]').setInputFiles(GGUF);
  await expect(page.getByText(/«forja-diminuto» listo/)).toBeVisible({ timeout: 30_000 });
  await expect(dialogo.getByRole("list", { name: "Modelos locales guardados" }).getByText("forja-diminuto")).toBeVisible();
  await page.keyboard.press("Escape");

  await escucharAnuncios(page);
  const anuncios = await enviar(page, "hola");
  expect(anuncios.at(-1)).toBe("Respuesta lista.");
  const r = await ultimaRespuesta(page);
  expect(r.modelo).toBe(MODELO);
  expect(r.error).toBe(false);
  expect(r.contenido.length).toBeGreaterThan(0);
  expect(aProveedores, "ninguna petición a un proveedor").toEqual([]);

  // Sigue ahí al recargar: el archivo vive en el almacenamiento del sitio.
  await page.reload();
  await page.locator("textarea").first().waitFor({ timeout: 60_000 });
  await escucharAnuncios(page);
  expect((await enviar(page, "otra vez")).at(-1)).toBe("Respuesta lista.");
  expect((await ultimaRespuesta(page)).error).toBe(false);
});

test("el modo agente funciona con el modelo local", async ({ page }) => {
  await page.goto("/");
  await page.locator("textarea").first().waitFor({ timeout: 60_000 });
  // Cada test tiene su propio contexto de navegador (almacenamiento vacío):
  // el archivo se vuelve a elegir.
  await page.getByRole("button", { name: "Ajustes", exact: true }).first().click();
  const dialogo = page.getByRole("dialog");
  const tab = dialogo.getByRole("tab", { name: /Proveedores|Modelos/ }).first();
  if (await tab.count()) await tab.click();
  await dialogo.getByRole("button", { name: "Abrir Modelo local (.gguf)" }).click();
  await dialogo.locator('input[aria-label="Archivo .gguf"]').setInputFiles(GGUF);
  await expect(page.getByText(/«forja-diminuto» listo/)).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Más opciones" }).click();
  await page.getByRole("button", { name: "Modo agente" }).click();
  await escucharAnuncios(page);
  expect((await enviar(page, "crea un archivo hola.txt")).at(-1)).toBe("Respuesta lista.");
  expect((await ultimaRespuesta(page)).error).toBe(false);
});

test("un encargo de página con el agente cabe en el contexto del modelo local", async ({ page }) => {
  // El caso de la captura: «Crea una página…» con el agente puesto mandaba
  // ~10.000 tokens (prompt de sistema + 24 herramientas) a un modelo con
  // 8.192, y el error salía como «no está respondiendo».
  await page.goto("/");
  await page.locator("textarea").first().waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Ajustes", exact: true }).first().click();
  const dialogo = page.getByRole("dialog");
  const tab = dialogo.getByRole("tab", { name: /Proveedores|Modelos/ }).first();
  if (await tab.count()) await tab.click();
  await dialogo.getByRole("button", { name: "Abrir Modelo local (.gguf)" }).click();
  await dialogo.locator('input[aria-label="Archivo .gguf"]').setInputFiles(GGUF);
  await expect(page.getByText(/«forja-diminuto» listo/)).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Más opciones" }).click();
  await page.getByRole("button", { name: "Modo agente" }).click();
  await escucharAnuncios(page);
  await page.getByRole("textbox", { name: "Mensaje" }).fill(
    "Crea una página de aterrizaje para una cafetería de especialidad en Madrid"
  );
  await page.keyboard.press("Enter");
  // primero llega la propuesta de diseño; construir lanza la generación
  await page.getByRole("button", { name: "Construir sin elegir" }).click({ timeout: 30_000 });
  await page.waitForFunction(
    () => (window as unknown as { __an: string[] }).__an.some((t) => /lista|error/.test(t)),
    null,
    { timeout: 180_000 }
  );
  const r = await ultimaRespuesta(page);
  expect(r.contenido, "sin el error de contexto").not.toMatch(/no cabe|ocupa \d+ tokens/);
  expect(r.error).toBe(false);
  await expect(page.getByText(/no está respondiendo/)).toHaveCount(0);

  // El contador ya no dice «≈83»: cuenta también las instrucciones fijas.
  const ctx = await page.getByText(/^ctx ≈/).textContent();
  expect(ctx).toMatch(/ctx ≈\d+(,\d)?k/);
});
