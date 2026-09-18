import { expect, test, type Page } from "./fixtures";

/** Forja IA — Lo que la app ya sabía del modelo, dicho ANTES de elegirlo.
 *
 * El usuario lo describió así: «hay modelos que me los da como que están
 * buenos y al final no funcionan». Y era verdad: Forja medía el techo de
 * entrada de cada modelo la primera vez que lo rechazaba por tamaño, lo
 * guardaba, lo usaba para no volver a elegirlo… y no lo enseñaba en ninguna
 * parte. El selector los pintaba a todos iguales.
 */

async function seed(page: Page, limites: Record<string, unknown>) {
  await page.addInitScript((limites: Record<string, unknown>) => {
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
              defaultModelKey: "groq::mock-mini-free",
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
              piiShield: false,
              onlyFree: false,
            },
            providers: {
              groq: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: ["mock-mini-free", "mock-estrecho"],
                useProxy: false,
              },
            },
            version: 1,
          },
          version: 0,
        })
      );
      localStorage.setItem(
        "prism-limites-v1",
        JSON.stringify({ state: { limites }, version: 0 })
      );
    } catch {
      /* marco sin acceso */
    }
  }, limites);
}

test("el modelo con techo medido sale marcado en el selector", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, {
    "groq::mock-estrecho": { limite: 7000, rechazado: 21138, at: Date.now() },
  });
  await page.goto("/");

  await page.getByRole("combobox").first().click();
  const estrecho = page.getByRole("option").filter({ hasText: "mock-estrecho" }).first();
  await expect(estrecho).toBeVisible({ timeout: 20_000 });
  await expect(estrecho, "el que ya rechazó por tamaño lleva su marca").toContainText("techo");

  // y el que nunca falló no lleva ninguna: un aviso que sale siempre se deja de leer
  const sano = page.getByRole("option").filter({ hasText: "mock-mini-free" }).first();
  await expect(sano).toBeVisible();
  await expect(sano).not.toContainText("techo");
});

test("una medición caducada ya no marca el modelo", async ({ page }) => {
  test.setTimeout(120_000);
  // Los topes por minuto se reponen. Marcar para siempre por un pico de un
  // martes sería apartar un modelo que hoy iría bien.
  await seed(page, {
    "groq::mock-estrecho": {
      limite: 7000,
      rechazado: 21138,
      at: Date.now() - 7 * 60 * 60 * 1000,
    },
  });
  await page.goto("/");

  await page.getByRole("combobox").first().click();
  const estrecho = page.getByRole("option").filter({ hasText: "mock-estrecho" }).first();
  await expect(estrecho).toBeVisible({ timeout: 20_000 });
  await expect(estrecho).not.toContainText("techo");
});

test("el panel de Uso lista los modelos con pegas medidas", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, {
    "groq::mock-estrecho": { limite: 7000, rechazado: 21138, at: Date.now() },
  });
  await page.goto("/");

  // Panel del sistema → pestaña Uso (en móvil la barra vive tras el menú)
  const menu = page.getByRole("button", { name: /^Abrir conversaciones/ });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("button", { name: "Panel", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Panel del sistema", { timeout: 20_000 });
  await page.getByRole("tab", { name: "Uso" }).click();

  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Modelos con pegas medidas")).toBeVisible({ timeout: 20_000 });
  await expect(panel).toContainText("mock-estrecho");
  await expect(panel, "con el número que dio el proveedor").toContainText("7000");
});
