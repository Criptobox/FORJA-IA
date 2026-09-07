import { expect, test, type Page } from "./fixtures";

/** Prism AI — El kit de efectos: local, y que no rompa nada.
 *
 * La pregunta de la que salió esto era «¿podemos añadir una librería de
 * efectos para que las páginas queden más pro?». La respuesta fue que sí pero
 * NO por CDN: la página generada acaba en un iframe sin `allow-same-origin`,
 * en un ZIP y en un GitHub Pages, y en los tres un CDN caído la rompe en
 * silencio.
 *
 * Aquí se comprueba lo que eso significa de verdad:
 *  · el modelo solo ENLAZA el kit, y Prism lo añade al proyecto;
 *  · sin JavaScript no se esconde nada (la regla de oro del kit);
 *  · con JavaScript, lo que entra por scroll acaba entrando igual.
 */

const MODEL_ID = "mock-efectos";

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

async function pedirLaPagina(page: Page) {
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing");
  await page.keyboard.press("Enter");
}

test("el modelo solo enlaza el kit y Prism lo añade al proyecto", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaPagina(page);

  // Ojo con lo que se mide: el nombre `prism-fx.css` sale igualmente en el
  // chat porque el HTML del modelo lo ENLAZA. Eso no prueba nada. Lo que
  // prueba que Prism añadió los archivos es el menú de descarga, que cuenta
  // los archivos REALES del proyecto: uno solo ni siquiera abre menú.
  const descargar = page.getByRole("button", { name: "Descargar lo creado" });
  await expect(descargar).toBeVisible({ timeout: 90_000 });
  await descargar.click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("Esta respuesta creó 3 archivos");
  await expect(menu).toContainText("prism-fx.css");
  await expect(menu).toContainText("prism-fx.js");
  await page.keyboard.press("Escape");

  // y no los escribió el modelo: su respuesta solo los enlaza
  await expect(page.locator("main"), "el kit no se escribe en el chat").not.toContainText(
    "--fx-ease"
  );
});

test("sin JavaScript no se esconde nada: el titular se ve igual", async ({ page }) => {
  test.setTimeout(180_000);
  // Playwright corre con `reducedMotion: reduce` (playwright.config.ts), así
  // que el script del kit se planta y no añade `.fx-on`. Es el mismo caso que
  // un visitante con las animaciones desactivadas — y ahí la página tiene que
  // verse ENTERA, no en blanco.
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaPagina(page);

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  const titular = marco.locator('[data-fx="reveal"] h1');
  await expect(titular).toBeVisible({ timeout: 90_000 });
  // lo de abajo del todo, que ningún observer habría revelado, también
  await expect(marco.locator('[data-fx="stagger"] p').first()).toBeVisible();
});

test.describe("con animaciones permitidas", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("lo que entra por scroll acaba entrando aunque nadie haga scroll", async ({ page }) => {
    test.setTimeout(180_000);
    // La red de seguridad del kit: si el observer no llega a disparar —un
    // iframe que no se desplaza, una pestaña en segundo plano—, a los 1,2 s se
    // revela todo. Un efecto perdido es una molestia; contenido invisible es
    // un fallo.
    await seed(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await pedirLaPagina(page);

    const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
    const abajo = marco.locator('[data-fx="stagger"]');
    await expect(abajo).toBeAttached({ timeout: 90_000 });
    // el JS sí corrió: la clase que solo pone el script
    await expect(marco.locator("html")).toHaveClass(/fx-on/, { timeout: 30_000 });
    // y aun así termina revelado
    await expect(abajo).toHaveClass(/fx-in/, { timeout: 30_000 });
    await expect(marco.locator('[data-fx="stagger"] p').first()).toBeVisible();
  });
});
