import { expect, test, type Page } from "@playwright/test";

/** Forja IA — Chat ▸ «¿Cómo construimos la app?».
 *
 * Al pedir una app nueva, el chat ofrece (sin gastar nada) diseño con la
 * biblioteca Tinta o app funcional con código. Con Tinta, el modelo solo
 * escribe una receta corta, el equipo de agentes trabaja a la vista y la app
 * completa queda como proyecto del Estudio. */
async function seed(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    try {
      if (localStorage.getItem("forja-ai-v1")) return;
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: { defaultModelKey: "custom::mock-mini-free", accessCode: "", agentModes: [], ahorro: false },
            providers: { custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {}
  });
}

async function contarLlamadas(page: Page) {
  const cuerpos: string[] = [];
  await page.route("**/api/mock-llm/**", async (route) => {
    const b = route.request().postData();
    if (b) cuerpos.push(b);
    await route.continue();
  });
  return cuerpos;
}

test("pedir una app ofrece Tinta sin gastar, y con Tinta sale el equipo y la app al Estudio", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page);
  const cuerpos = await contarLlamadas(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app para mi cafetería con pedidos");
  await page.keyboard.press("Enter");

  const oferta = page.getByTestId("oferta-tinta");
  await expect(oferta).toBeVisible({ timeout: 15_000 });
  await expect(oferta).toHaveAttribute("data-estado", "pendiente");
  expect(cuerpos.filter((c) => c.includes("chat/completions") || c.includes('"messages"'))).toHaveLength(0); // 0 tokens

  await page.getByTestId("oferta-tinta-si").click();
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  await motor.locator("[data-eq=speed]").click();
  await expect(motor.locator("#eqChoose.on")).toBeVisible({ timeout: 30_000 });
  await motor.locator("#eqGo").click();

  await expect(oferta).toHaveAttribute("data-estado", "hecha", { timeout: 30_000 });
  await expect(oferta).toContainText(/App creada con Tinta: \d+ pantallas/);
  await expect(page.locator('iframe[title="Motor de diseño Tinta"]')).toHaveCSS("pointer-events", "none");
  expect(cuerpos.filter((c) => c.includes("asistente de diseño de Estilos Tinta"))).toHaveLength(1);

  await page.getByTestId("oferta-tinta-abrir").click();
  await expect(page).toHaveURL(/\/forja\?tab=estudio/);
  await expect(page.getByText("App completa (Tinta)").first()).toBeVisible({ timeout: 60_000 });
});

test("«Escribir el código» sigue el camino de siempre", async ({ page }) => {
  test.setTimeout(90_000);
  await seed(page);
  const cuerpos = await contarLlamadas(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app de rutinas para mi gimnasio");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("oferta-tinta")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("oferta-tinta-codigo").click();
  await expect(page.getByTestId("oferta-tinta")).toHaveAttribute("data-estado", "descartada");
  await expect.poll(() => cuerpos.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(cuerpos.some((c) => c.includes("asistente de diseño de Estilos Tinta"))).toBe(false);
  expect(cuerpos.some((c) => c.includes("hazme una app de rutinas"))).toBe(true);
});

test("una app de gestión de datos va directa al código, sin la tarjeta", async ({ page }) => {
  await seed(page);
  const cuerpos = await contarLlamadas(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");
  await expect.poll(() => cuerpos.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(page.getByTestId("oferta-tinta")).toHaveCount(0);
});

test("una landing sigue con la propuesta de diseño, no con Tinta", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una landing para una cafetería en Cádiz");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("propuesta-diseno")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("oferta-tinta")).toHaveCount(0);
});
