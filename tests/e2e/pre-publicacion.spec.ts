import { expect, test, type Page } from "./fixtures";

/** Forja IA — Antes de publicar, se comprueba (Plan Maestro 2026 §41).
 *
 * Una página con una clave de API dentro del código no puede salir a una URL
 * pública sin que nadie lo diga: la seguridad BLOQUEA el botón de publicar, y
 * solo se desbloquea marcando a propósito «publicar igualmente». Los datos
 * pendientes («Teléfono: pendiente») avisan, pero no bloquean.
 */
async function seed(page: Page) {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem("forja-e2e-sembrado")) return;
      sessionStorage.setItem("forja-e2e-sembrado", "1");
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], skills: [],
            settings: { propuestaDiseno: false, defaultModelKey: "custom::mock-con-clave", accessCode: "", agentModes: [], agentMode: false, ahorro: false, stream: false },
            providers: { custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-con-clave"], useProxy: false } },
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

test("una clave en el código bloquea la publicación hasta que se decide a propósito", async ({ page }) => {
  test.setTimeout(180_000);
  const llamadas: string[] = [];
  await page.route("https://api.netlify.com/**", async (route) => {
    llamadas.push(route.request().url());
    await route.fulfill({ status: 500, body: "no debería llamarse" });
  });

  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing para mi cafetería");
  await page.keyboard.press("Enter");
  await expect(page.frameLocator('iframe[title="Vista previa de la página generada"]').locator("h1")).toHaveText(
    /Café de especialidad/,
    { timeout: 90_000 }
  );

  await page.getByRole("button", { name: "Publicar en Netlify" }).click();
  const dialogo = page.getByRole("dialog");
  const puerta = dialogo.getByTestId("puerta-publicacion");
  await expect(puerta.locator('[data-estado="bloquea"]', { hasText: "Seguridad" })).toBeVisible({ timeout: 30_000 });
  await expect(puerta.locator('[data-estado="aviso"]', { hasText: "Datos del negocio" })).toContainText("pendiente");

  await dialogo.getByLabel("Token de Netlify").fill("nfp_prueba");
  const publicar = dialogo.getByRole("button", { name: "Publicar", exact: true });
  await expect(publicar, "con un bloqueo, no se publica sin decidirlo").toBeDisabled();

  await puerta.getByLabel("Lo he revisado y quiero publicar igualmente").check();
  await expect(publicar).toBeEnabled();
  expect(llamadas, "hasta aquí no se ha mandado nada a Netlify").toEqual([]);
  if (process.env.CAPTURA_PUERTA) await dialogo.screenshot({ path: process.env.CAPTURA_PUERTA });
});
