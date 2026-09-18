import { expect, test, type Page } from "./fixtures";

/** Forja IA — El puente de consola tiene que ganar la carrera con los
 * scripts del propio proyecto que viven en `<head>`.
 *
 * Hallazgo del dogfooding de v4.10.0 ("pruébalo tú mismo y dime qué
 * falta"): con una generación REAL (no una demo simulada), la vista previa
 * soltaba un `pageerror` de verdad —
 * «Failed to read the 'localStorage' property from 'Window': The document
 * is sandboxed and lacks the 'allow-same-origin' flag» — que ningún test
 * anterior detectaba porque ninguno escuchaba `page.on('pageerror')`
 * durante una generación real.
 *
 * La causa: `injectConsoleBridge` metía el puente justo antes de
 * `</head>`, así que un script del proyecto que vive ANTES en el `<head>`
 * —el patrón más común en webs generadas: leer el tema guardado antes del
 * primer pintado— tocaba el `localStorage` real del iframe sandboxed
 * primero, y reventaba antes de que el puente pudiera sustituirlo por el
 * de mentira.
 */

const MODEL_ID = "mock-tema-en-head";

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

test("una página con detección de tema en <head> no revienta el iframe con un pageerror de localStorage", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(String(e)));

  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una página con detección de tema");
  await page.keyboard.press("Enter");

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("h1")).toHaveText("Hola", { timeout: 90_000 });
  // Un margen tras la carga: el error, si lo hay, sale en la primera línea
  // del script — pero se espera igual por si algo lo retrasa.
  await page.waitForTimeout(1000);

  expect(errores).toEqual([]);
});
