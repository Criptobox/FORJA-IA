import { expect, test, type Page } from "./fixtures";

/** Forja IA — Modo App: una aplicación se entrega en módulos y sus datos
 * sobreviven a recargar la vista previa.
 *
 * Tres cosas que ningún unitario puede comprobar juntas:
 * 1. «crea una app de lista de tareas» añade la instrucción del Modo App.
 * 2. La vista previa monta los módulos ES (js/app.js importa js/store.js).
 * 3. Lo que la app guarda en localStorage —simulado dentro del iframe sin
 *    origen propio— vuelve al recargar, y el botón de borrar lo vacía.
 */

async function seed(page: Page, model: string) {
  await page.addInitScript((m: string) => {
    try {
      if (sessionStorage.getItem("forja-e2e-sembrado")) return; // solo la primera carga
      sessionStorage.setItem("forja-e2e-sembrado", "1");
      localStorage.setItem("forja-preview-demo", "1");
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: {
              // estos specs prueban la CONSTRUCCIÓN; la propuesta de diseño tiene su propio spec
              propuestaDiseno: false,
              defaultModelKey: `custom::${m}`,
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
                models: [m],
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
  }, model);
}

test("una app de tareas llega en módulos y conserva sus datos al recargar la vista previa", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "mock-app");
  await page.setViewportSize({ width: 1440, height: 900 });

  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) cuerpos.push(r.postData() ?? "");
  });

  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");

  await expect
    .poll(() => cuerpos.some((c) => c.includes("Modo App: esto es una aplicación")), { timeout: 30_000 })
    .toBe(true);

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  // el h1 lo pinta el HTML; «0 tareas» solo aparece si js/app.js cargó js/store.js
  await expect(marco.locator("h1")).toHaveText("Tareas", { timeout: 90_000 });
  await expect(marco.locator("#total")).toHaveText("0 tareas");

  await marco.getByLabel("Nueva tarea").fill("Comprar café");
  await marco.getByRole("button", { name: "Añadir" }).click();
  await expect(marco.locator("#lista li")).toHaveText(["Comprar café"]);

  // el botón de datos guardados aparece cuando la app escribió algo
  const borrar = page.getByRole("button", { name: "Borrar datos guardados de la vista previa" });
  await expect(borrar).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Recargar vista previa" }).click();
  await expect(marco.locator("#lista li")).toHaveText(["Comprar café"], { timeout: 15_000 });

  // y sobrevive también a recargar Forja entera
  await page.reload();
  await expect(marco.locator("#lista li")).toHaveText(["Comprar café"], { timeout: 30_000 });

  await page.getByRole("button", { name: "Borrar datos guardados de la vista previa" }).click();
  await expect(marco.locator("#total")).toHaveText("0 tareas", { timeout: 15_000 });
  await expect(borrar).toBeHidden();
});

test("la vista previa ofrece tablet y móvil con los anchos que mide el QA", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "mock-app");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");

  await expect(page.frameLocator('iframe[title="Vista previa de la página generada"]').locator("h1")).toHaveText("Tareas", { timeout: 90_000 });
  // el iframe de la vista previa, no los ocultos de la revisión automática
  const anchoVisto = async () => {
    const f = await (await page.locator('iframe[title="Vista previa de la página generada"]').elementHandle())?.contentFrame();
    return (await f?.evaluate(() => window.innerWidth)) ?? 0;
  };

  // lo que cuenta es el ancho que VE la página (sus media queries), aunque el
  // panel sea más estrecho y el dispositivo se muestre escalado
  for (const [nombre, ancho] of [["Vista tablet", 768], ["Vista móvil", 390], ["Vista móvil pequeño", 320]] as const) {
    await page.getByRole("button", { name: nombre, exact: true }).click();
    await expect.poll(anchoVisto, { timeout: 5_000 }).toBe(ancho);
  }
  // a 768 en un panel más estrecho se avisa de la escala
  await page.getByRole("button", { name: "Vista tablet", exact: true }).click();
  await expect(page.getByText(/^768px · \d+%$/)).toBeVisible();
});
