import { expect, test, type Page } from "./fixtures";

/** Prism AI — `diagnose_project` (v4.25.0): la misma verificación
 * INDEPENDIENTE que `verify_project`, pero convertida en un diagnóstico
 * accionable — causa observada, acción recomendada, archivo candidato y
 * criterio de cierre — en vez de solo PASS/NO PASS. No inventa líneas
 * exactas: el agente sigue teniendo que leer el archivo antes de tocarlo.
 *
 * El modelo simulado `mock-diagnostica` escribe una página con un hallazgo
 * real (una imagen sin `alt`), pide `diagnose_project` (debe salir BLOCKED,
 * con «index.html» como candidato), la arregla y vuelve a pedirlo (debe
 * salir READY).
 */

const MODEL_ID = "mock-diagnostica";

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

test("diagnose_project convierte los hallazgos en causa, acción y archivo candidato", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una página y diagnostica lo que encuentres");
  await page.keyboard.press("Enter");

  const burbuja = page.locator("main p", { hasText: "Esto es lo que dijo el diagnóstico" });
  await expect(burbuja).toBeVisible({ timeout: 60_000 });

  const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");

  // primer diagnóstico: la imagen sin alt deja hallazgos, y señala el archivo
  expect(texto).toContain("Diagnóstico accionable: NEEDS-FIX");
  expect(texto).toContain("index.html");

  // segundo diagnóstico, ya con la página arreglada: queda listo
  expect(texto).toContain("Diagnóstico accionable: READY");
});
