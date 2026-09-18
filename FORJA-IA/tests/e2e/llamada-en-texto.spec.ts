import { expect, test, type Page } from "./fixtures";

/** Forja IA — Cuando el modelo pide la herramienta como TEXTO, no tool_calls.
 *
 * Reportado por un usuario dos veces seguidas en la misma conversación real:
 * con nvidia/nemotron vía OpenRouter en modo agente, la burbuja del chat
 * enseñaba literal `<function=write_file> <parameter=path>...` en vez de
 * escribir la página. El modelo SÍ intentaba llamar a la herramienta, con
 * la plantilla de function-calling de su propio entrenamiento en vez del
 * campo `tool_calls` de la API — y Forja no tenía dónde reconocerla.
 *
 * `mock-llamada-en-texto` reproduce exactamente eso: nunca llama a
 * `onToolCalls`, todo lo que manda es el texto crudo de la plantilla.
 */

async function seed(page: Page) {
  await page.addInitScript(() => {
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
            settings: {
              defaultModelKey: "custom::mock-llamada-en-texto",
              accessCode: "",
              agentModes: [],
              agentMode: true,
              agentMaxLoops: 4,
              ahorro: false,
              stream: false,
            },
            providers: {
              custom: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: ["mock-llamada-en-texto"],
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
  });
}

test("la plantilla de function-calling en texto se ejecuta, no se enseña literal", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing para mi tienda");
  await page.keyboard.press("Enter");

  // Responde tras ejecutar la herramienta, no se queda con el texto crudo
  await expect(page.locator("main p", { hasText: "Página escrita." })).toBeVisible({
    timeout: 90_000,
  });

  // La plantilla NUNCA aparece literal en el chat
  const texto = await page.locator("main").innerText();
  expect(texto).not.toContain("<function=");
  expect(texto).not.toContain("<parameter=");

  // Y queda anotado para este modelo (llamadas-texto-medidas.ts, v4.18.0):
  // el probe por sí solo dijo "soporta tools" (200 OK) — esto es lo que
  // el probe NUNCA podría haber sabido, solo una generación real lo prueba.
  const guardado = await page.evaluate(() => localStorage.getItem("prism-llamadas-texto-v1"));
  const medidas = JSON.parse(guardado ?? "{}").state?.medidas ?? {};
  expect(medidas["custom::mock-llamada-en-texto"]?.veces).toBeGreaterThan(0);
});
