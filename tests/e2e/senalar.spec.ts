import { expect, test, type Page } from "./fixtures";

/** Forja IA — Señalar a la IA: tocar un elemento de la vista previa y que
 * la petición del chat se refiera a ÉL, sin describirlo con palabras. */

async function seed(page: Page) {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem("forja-e2e-sembrado")) return;
      sessionStorage.setItem("forja-e2e-sembrado", "1");
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: { defaultModelKey: "custom::mock-app", accessCode: "", agentModes: [], agentMode: false, ahorro: false, stream: false },
            providers: { custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-app"], useProxy: false } },
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

test("tocar un botón lo lleva al chat y la IA recibe exactamente cuál es", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");
  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("#total")).toHaveText("0 tareas", { timeout: 90_000 });

  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) cuerpos.push(r.postData() ?? "");
  });

  await page.getByRole("button", { name: "Señalar un elemento a la IA" }).click();
  await marco.getByRole("button", { name: "Añadir" }).click();
  // señalar no pulsa el botón de verdad
  await expect(marco.locator("#total")).toHaveText("0 tareas");

  const chips = page.getByLabel("Elementos señalados");
  await expect(chips).toContainText("<button> «Añadir»");
  // el foco va a escribir, con una pista de a qué se refiere
  const compositor = page.locator("textarea[data-compositor]");
  await expect(compositor).toBeFocused();
  await expect(compositor).toHaveAttribute("placeholder", /Añadir/);

  await compositor.fill("hazlo más grande y verde");
  await page.keyboard.press("Enter");

  await expect(page.locator("main").getByText("Entendido: cambiaré el elemento")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("main code", { hasText: "#f > button" })).toBeVisible();
  // el HTML real del elemento viajó al modelo, no solo el texto del usuario
  expect(cuerpos.some((c) => c.includes('<button type=\\"submit\\">Añadir</button>'))).toBe(true);
  // en la conversación se ve la etiqueta, no el bloque técnico
  await expect(page.locator("main").getByText("<button> «Añadir»")).toBeVisible();
  await expect(page.locator("main").getByText("HTML actual en la página")).toHaveCount(0);
  await expect(chips).toHaveCount(0);
});

test("se puede ampliar al apartado que contiene lo tocado, y quitarlo", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");
  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("#total")).toHaveText("0 tareas", { timeout: 90_000 });

  await page.getByRole("button", { name: "Señalar un elemento a la IA" }).click();
  await marco.getByRole("button", { name: "Añadir" }).click();
  const chips = page.getByLabel("Elementos señalados");
  await chips.getByRole("button", { name: "↑ <form>" }).click();
  await expect(chips).toContainText("<form>");
  await chips.getByRole("button", { name: /^Quitar/ }).click();
  await expect(chips).toHaveCount(0);
});
