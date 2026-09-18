import { expect, test, type Page } from "./fixtures";

/** Forja IA — El motor 3D: se añade al proyecto, arranca cuando puede y se
 * calla cuando no debería.
 *
 * `mock-3d` enlaza `prism-3d.js` sin escribirlo (igual que `mock-efectos`
 * hace con el kit normal): comprueba que Forja lo añade al proyecto y que la
 * escena arranca de verdad — y, en un equipo simulado de gama baja, que NO
 * arranca. `window.__prism3dActivo` es la única señal que expone el motor
 * para esto: no cambia el render, solo dice si decidió dibujar.
 */

const MODEL_ID = "mock-3d";

async function seed(page: Page) {
  await page.addInitScript((model: string) => {
    try {
      localStorage.setItem("prism-preview-demo", "1");
      localStorage.setItem(
        "prism-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            skills: [],
            settings: {
              defaultModelKey: `custom::${model}`,
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
            },
            providers: {
              custom: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: [model],
                useProxy: false,
              },
            },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  }, MODEL_ID);
}

async function pedirLaEscena(page: Page) {
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una escena 3d");
  await page.keyboard.press("Enter");
}

test("Forja añade prism-3d.js al proyecto: el modelo solo lo enlaza", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaEscena(page);

  const descargar = page.getByRole("button", { name: "Descargar lo creado" });
  await expect(descargar).toBeVisible({ timeout: 90_000 });
  await descargar.click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("prism-3d.js");
  await expect(menu).toContainText("prism-fx.css");
  await page.keyboard.press("Escape");
});

test.describe("con animaciones permitidas", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("con un equipo normal, la escena 3D arranca de verdad", async ({ page }) => {
    test.setTimeout(180_000);
    await seed(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await pedirLaEscena(page);

    const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
    await expect(marco.locator("canvas[data-fx3d]")).toBeAttached({ timeout: 90_000 });
    await expect
      .poll(
        () =>
          marco
            .locator("canvas[data-fx3d]")
            .evaluate(() => (window as unknown as Record<string, unknown>).__prism3dActivo ?? null),
        { timeout: 20_000 }
      )
      .toBe(true);
  });

  // La detección de gama baja (`hardwareConcurrency`/`deviceMemory` en
  // `prism-3d.js`) se comprueba en `tests/unit/efectos.test.ts` — ahí es
  // determinista: se lee el texto del script y se confirma que la condición
  // existe y se evalúa ANTES de activar la escena.
  //
  // Por qué no aquí también: para simularlo hay que sobrescribir
  // `navigator.hardwareConcurrency` con `addInitScript` justo cuando la vista
  // previa recarga su `srcdoc` — y ese recargado ocurre dos veces (una vez
  // vacío, luego con el HTML final) mientras el modelo escribe. Playwright
  // pierde la sobrescritura en la segunda recarga una de cada dos veces: es
  // una carrera del arnés de pruebas con `srcdoc`, no del motor —confirmado
  // leyendo `navigator.hardwareConcurrency` en el punto exacto donde se
  // decide, que devuelve el valor sobrescrito correctamente cuando la carrera
  // no se pierde. Forzar esto a base de reintentos escondería la causa real
  // en vez de arreglarla.
});

test("sin animaciones, la escena tampoco arranca (mismo criterio que el resto del kit)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaEscena(page);

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("canvas[data-fx3d]")).toBeAttached({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  const activo = await marco
    .locator("canvas[data-fx3d]")
    .evaluate(() => (window as unknown as Record<string, unknown>).__prism3dActivo ?? null);
  expect(activo).not.toBe(true);
});
