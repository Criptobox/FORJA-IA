import { expect, test, type Page } from "./fixtures";

/** Prism AI — «No te cabe» no es «ríndete».
 *
 * De una captura: Groq contestó 413 «Request too large … ITPM: Limit 7000,
 * Requested 21138» y la conversación se quedó ahí, en rojo. El modelo estaba
 * perfecto y la clave también: lo que sobraba era la conversación. Con otro
 * proveedor conectado al lado.
 */

async function seed(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    try {
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
              defaultModelKey: "custom::mock-limite-7000",
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
              piiShield: false,
              onlyFree: false,
            },
            providers: {
              custom: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: ["mock-limite-7000"],
                useProxy: false,
              },
              groq: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: ["mock-mini-free"],
                useProxy: false,
              },
            },
            version: 1,
          },
          version: 0,
        })
      );
      localStorage.removeItem("prism-limites-v1");
      localStorage.removeItem("prism-modelos-rotos-v1");
    } catch {
      /* marco sin acceso */
    }
  });
}

async function enviar(page: Page, texto: string) {
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(texto);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
}

test("un 413 por tamaño sigue con otro modelo en vez de pararse", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto("/");
  await enviar(page, "hola");

  await expect(page.locator("main").getByText("funcionando con tu API")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator("main")).toContainText("mock-mini-free");
});

test("y recuerda el límite que el proveedor dijo, para no repetir el error", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto("/");
  await enviar(page, "hola");

  const medido = await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            const raw = localStorage.getItem("prism-limites-v1") ?? "{}";
            return JSON.parse(raw).state?.limites ?? {};
          } catch {
            return {};
          }
        }),
      { timeout: 90_000 }
    )
    .toHaveProperty("custom::mock-limite-7000")
    .then(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("prism-limites-v1") ?? "{}";
        return JSON.parse(raw).state.limites["custom::mock-limite-7000"];
      })
    );

  // el número es el que dijo el proveedor, no uno estimado por nosotros
  expect(medido.limite).toBe(7000);
  expect(medido.rechazado).toBe(21138);
});
