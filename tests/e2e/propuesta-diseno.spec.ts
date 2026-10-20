import { expect, test, type Page } from "@playwright/test";

/** Forja IA — Propuesta de diseño antes de construir (Plan Maestro 2026 §4).
 *
 * Lo que importa no es que salga una tarjeta bonita: es que la propuesta NO
 * gaste una llamada, y que al construir viaje de verdad lo elegido. Por eso
 * se cuentan las peticiones al proveedor y se lee lo que sale por el cable.
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
            settings: {
              defaultModelKey: "custom::mock-mini-free",
              accessCode: "",
              agentModes: [],
              ahorro: false,
            },
            providers: {
              custom: {
                apiKey: "k",
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
      localStorage.setItem("forja-preview-demo", "1");
    } catch {}
  });
}

test("una web nueva enseña la propuesta SIN llamar al modelo, y construye con lo elegido", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });

  const cuerpos: string[] = [];
  await page.route("**/api/mock-llm/**", async (route) => {
    const b = route.request().postData();
    if (b) cuerpos.push(b);
    await route.continue();
  });

  await page.getByPlaceholder("Escribe tu mensaje…").fill("hazme una landing para una cafetería en Cádiz");
  await page.keyboard.press("Enter");

  const card = page.getByTestId("propuesta-diseno");
  await expect(card).toBeVisible();
  await expect(card.getByRole("radio")).toHaveCount(3);
  await expect(card.getByText(/Pendientes \(no se inventarán\):/)).toBeVisible();
  // la propuesta es gratis: ni una petición al proveedor
  await page.waitForTimeout(800);
  expect(cuerpos).toHaveLength(0);

  // elegir la segunda dirección, con un ajuste
  const segunda = card.getByRole("radio").nth(1);
  const nombre = ((await segunda.locator("div.font-medium").textContent()) ?? "").trim();
  expect(nombre.length).toBeGreaterThan(2);
  await segunda.click();
  await card.getByLabel("Ajustes a la propuesta").fill("sin sección de precios");
  await card.getByRole("button", { name: "Construir con esta dirección" }).click();

  await expect.poll(() => cuerpos.length, { timeout: 20_000 }).toBeGreaterThan(0);
  const body = JSON.parse(cuerpos[0]) as { messages: { role: string; content: string }[] };
  const sys = body.messages.find((m) => m.role === "system")?.content ?? "";
  const usuario = body.messages.filter((m) => m.role === "user").pop()?.content ?? "";
  expect(sys, "la dirección elegida viaja").toContain(`Dirección: ${nombre}`);
  expect(sys, "los datos que faltan no se inventan").toContain("DATOS QUE EL USUARIO NO HA DADO");
  expect(usuario).toContain("Ajustes a la propuesta: sin sección de precios");
  expect(body.messages.some((m) => m.content.startsWith("Propuesta de diseño:")), "la tarjeta no viaja al modelo").toBe(false);

  await expect(card.getByText(`Construido con «${nombre}».`)).toBeVisible();
  if (process.env.CAPTURA_PROPUESTA) await card.screenshot({ path: process.env.CAPTURA_PROPUESTA });
});

test("«directo» en el encargo se salta la propuesta", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
  const cuerpos: string[] = [];
  await page.route("**/api/mock-llm/**", async (route) => {
    const b = route.request().postData();
    if (b) cuerpos.push(b);
    await route.continue();
  });
  await page.getByPlaceholder("Escribe tu mensaje…").fill("hazme una landing para una cafetería, directo");
  await page.keyboard.press("Enter");
  await expect.poll(() => cuerpos.length, { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(page.getByTestId("propuesta-diseno")).toHaveCount(0);
});
