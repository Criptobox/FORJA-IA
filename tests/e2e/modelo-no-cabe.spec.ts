import { expect, test, type Page } from "./fixtures";

/** Forja IA — «No te cabe» no es «ríndete».
 *
 * Este caso es el del proveedor que NO dice cuánto admite: sin ese número no
 * hay a qué recortar (ver `recorte-y-reintento.spec.ts` para el que sí lo
 * dice), así que lo único sensato es cambiar de modelo.
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
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            skills: [],
            settings: {
              defaultModelKey: "custom::mock-413-sin-numeros",
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
                models: ["mock-413-sin-numeros"],
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
      localStorage.removeItem("forja-limites-v1");
      localStorage.removeItem("forja-modelos-rotos-v1");
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

test("y recuerda que rechazó un mensaje de este tamaño, sin inventarse el tope", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto("/");
  await enviar(page, "hola");

  const medido = await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            const raw = localStorage.getItem("forja-limites-v1") ?? "{}";
            return JSON.parse(raw).state?.limites ?? {};
          } catch {
            return {};
          }
        }),
      { timeout: 90_000 }
    )
    .toHaveProperty("custom::mock-413-sin-numeros")
    .then(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("forja-limites-v1") ?? "{}";
        return JSON.parse(raw).state.limites["custom::mock-413-sin-numeros"];
      })
    );

  // Sin número del proveedor NO se inventa uno: se guarda `null` y lo que se
  // le pidió, que es lo único que se sabe de verdad.
  expect(medido.limite, "nadie dijo el tope: no se inventa").toBeNull();
  expect(medido.rechazado).toBeGreaterThan(0);
});
