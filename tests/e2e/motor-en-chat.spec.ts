import { expect, test, type Page } from "./fixtures";

/** Forja IA — El motor en el chat: el plano de contenido viaja al crear una
 * página, y la página se audita contra él al terminar. */

async function seed(page: Page, modelo: string) {
  await page.addInitScript((m: string) => {
    try {
      if (sessionStorage.getItem("forja-e2e-sembrado")) return;
      sessionStorage.setItem("forja-e2e-sembrado", "1");
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [],
            settings: { defaultModelKey: `custom::${m}`, accessCode: "", agentModes: [], agentMode: false, ahorro: false, stream: false },
            providers: { custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: [m], useProxy: false } },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  }, modelo);
}

async function pedir(page: Page, modelo: string, texto: string) {
  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) cuerpos.push(r.postData() ?? "");
  });
  await seed(page, modelo);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea[data-compositor]");
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(texto);
  await page.keyboard.press("Enter");
  await expect.poll(() => cuerpos.length, { timeout: 30_000 }).toBeGreaterThan(0);
  return cuerpos;
}

test("al crear una página, el plano del motor viaja con los datos del encargo", async ({ page }) => {
  test.setTimeout(120_000);
  const cuerpos = await pedir(page, "mock-app", "hazme una landing para mi barbería en Valencia, corte 15€, barba 10€, tel 612 345 678");
  const primero = cuerpos[0];
  expect(primero).toContain("PLANO DE CONTENIDO");
  expect(primero).toContain("15€");
  expect(primero).toContain("612 345 678");
  expect(primero).toContain("# ICONOS");
});

test("en el Modo App no viaja: sus pantallas no son secciones de una landing", async ({ page }) => {
  test.setTimeout(120_000);
  const cuerpos = await pedir(page, "mock-app", "crea una app de lista de tareas");
  expect(cuerpos[0]).not.toContain("PLANO DE CONTENIDO");
});

test("una landing larga pero fina se audita contra el plano y se pide ampliarla", async ({ page }) => {
  test.setTimeout(180_000);
  const cuerpos = await pedir(page, "mock-fino", "hazme una landing para mi barbería en Valencia");
  await expect(page.getByText("A la página le falta contenido").first()).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => cuerpos.some((c) => c.includes("REPARACIÓN DE DETALLE")), { timeout: 60_000 }).toBe(true);
  const reparacion = cuerpos.find((c) => c.includes("REPARACIÓN DE DETALLE")) ?? "";
  expect(reparacion).toMatch(/menos secciones de las prometidas/);
  // y la página ampliada llega a la vista previa
  await expect(page.frameLocator('iframe[title="Vista previa de la página generada"]').locator("h1")).toHaveText("Barbería ampliada", { timeout: 60_000 });
});
