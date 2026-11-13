import { expect, test, type Page } from "@playwright/test";

/** Forja IA — Estudio ▸ «Con la biblioteca Tinta».
 *
 * El modelo solo devuelve una receta corta (bloques del catálogo de Tinta); el
 * motor Tinta (public/tinta/motor.html, en un iframe del mismo origen) la
 * convierte en la app completa después de que el equipo de 8 agentes la trabaje
 * a la vista. Se comprueba lo que viaja por el cable y lo que entra al proyecto. */
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

test("crea la app completa con Tinta: una llamada, el equipo a la vista y la app en el proyecto", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page);
  const cuerpos: string[] = [];
  await page.route("**/api/mock-llm/**", async (route) => {
    const b = route.request().postData();
    if (b) cuerpos.push(b);
    await route.continue();
  });
  await page.goto("/forja?tab=estudio");
  const brief = page.getByPlaceholder(/app de reservas para una peluquería/);
  await expect(brief).toBeVisible({ timeout: 60_000 });
  await brief.fill("Una app para mi cafetería con pedidos y barra inferior");
  await page.getByTestId("crear-con-tinta").click();

  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  await expect(motor.locator("#equipoDialog .ag")).toHaveCount(8);
  await motor.locator("[data-eq=speed]").click();
  await expect(motor.locator("#eqChoose.on")).toBeVisible({ timeout: 30_000 });
  await expect(motor.locator(".ag.disagree .say")).toContainText("No estoy de acuerdo");
  await motor.locator('#eqSeg [data-idx="0"]').click();
  await motor.locator("#eqGo").click();

  await expect(page.getByText("App creada con Tinta")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("App completa (Tinta)").first()).toBeVisible();
  // el iframe vuelve a quedar invisible y sin capturar toques
  await expect(page.locator('iframe[title="Motor de diseño Tinta"]')).toHaveCSS("pointer-events", "none");

  const alModelo = cuerpos.filter((c) => c.includes("asistente de diseño de Estilos Tinta"));
  expect(alModelo).toHaveLength(1); // UNA llamada: el modelo no escribe HTML

  const proyecto = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("forja-estudio-v1") || "{}");
    const p = e.state?.proyectos?.[0];
    const s = p?.pantallas?.[0];
    const v = s?.versiones?.[s.actual];
    return { pantallas: p?.pantallas?.length, nombre: s?.nombre, archivos: v?.archivos?.map((a: { path: string; text: string }) => [a.path, a.text.length]), modelo: v?.modelo, html: v?.archivos?.[0]?.text.slice(0, 40) };
  });
  expect(proyecto.pantallas).toBe(1);
  expect(proyecto.nombre).toBe("App completa (Tinta)");
  expect(proyecto.modelo).toBe("custom::mock-mini-free");
  expect(proyecto.archivos?.map((a: [string, number]) => a[0])).toEqual(["index.html", "tinta-proyecto.json"]);
  expect((proyecto.archivos?.[0]?.[1] as number) > 20_000).toBe(true);
  expect(proyecto.html).toMatch(/<!doctype html>/i);
});
