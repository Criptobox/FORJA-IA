import { expect, test, type Page } from "./fixtures";

/** Prism AI — `verify_project` (v4.24.0): verificación INDEPENDIENTE del
 * proyecto. No acepta que el modelo se autodeclare aprobado: ejecuta el
 * proyecto de verdad (el mismo camino sandboxed del navegador que ya usa
 * `run_project`, nunca un runtime en el servidor) y combina esa evidencia
 * con comprobaciones estáticas de HTML/accesibilidad/secretos.
 *
 * El modelo simulado `mock-verifica` escribe una página con hallazgos
 * reales (falta alt, falta lang, falta viewport), pide `verify_project`
 * (debe salir NO PASS), la arregla y vuelve a pedirlo (debe salir PASS).
 */

const MODEL_ID = "mock-verifica";

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
              agentMode: true,
              agentMaxLoops: 6,
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

test("verify_project mide de verdad: no aprueba con hallazgos y sí cuando quedan limpios", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una página y verifícala de verdad");
  await page.keyboard.press("Enter");

  const burbuja = page.locator("main p", { hasText: "Esto es lo que dijo la verificación" });
  await expect(burbuja).toBeVisible({ timeout: 60_000 });

  const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");

  // primera verificación: la página tiene hallazgos reales, no aprueba
  expect(texto).toContain("NO PASS");
  expect(texto).toMatch(/no tiene atributo alt|Referencia local no encontrada/);

  // segunda verificación, ya con la página arreglada: aprueba
  expect(texto).toContain("Verificación independiente: PASS");
  expect(texto).toContain("Evidencia: runtime=sí, visual=sí");
});
