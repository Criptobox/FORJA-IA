import { expect, test, type Page } from "./fixtures";

/** Forja IA — Publicar en Netlify desde la vista previa. La API de Netlify
 * se simula con page.route: se comprueba lo que Forja le manda (token, ZIP
 * real, mismo sitio al volver a publicar) y lo que enseña. */

async function seed(page: Page) {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem("forja-e2e-sembrado")) return;
      sessionStorage.setItem("forja-e2e-sembrado", "1");
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [],
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

test("publica el ZIP con el token y la segunda vez actualiza el mismo sitio", async ({ page }) => {
  test.setTimeout(180_000);
  const llamadas: { url: string; auth: string; tipo: string; pk: boolean }[] = [];
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST" };
  await page.route("https://api.netlify.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const cuerpo = req.postDataBuffer();
    llamadas.push({
      url: req.url(),
      auth: req.headers()["authorization"] ?? "",
      tipo: req.headers()["content-type"] ?? "",
      pk: !!cuerpo && cuerpo[0] === 0x50 && cuerpo[1] === 0x4b,
    });
    if (req.url().endsWith("/sites")) {
      return route.fulfill({ status: 201, headers: cors, contentType: "application/json", body: JSON.stringify({ id: "sitio-1", ssl_url: "https://forja-demo.netlify.app" }) });
    }
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ ssl_url: "https://forja-demo.netlify.app" }) });
  });

  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");
  await expect(page.frameLocator('iframe[title="Vista previa de la página generada"]').locator("#total")).toHaveText("0 tareas", { timeout: 90_000 });

  await page.getByRole("button", { name: "Publicar en Netlify" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Token de Netlify").fill("nfp_prueba");
  await dialogo.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(dialogo.getByText("https://forja-demo.netlify.app")).toBeVisible({ timeout: 15_000 });

  expect(llamadas.map((l) => l.url)).toEqual(["https://api.netlify.com/api/v1/sites", "https://api.netlify.com/api/v1/sites/sitio-1/deploys"]);
  expect(llamadas.every((l) => l.auth === "Bearer nfp_prueba")).toBe(true);
  expect(llamadas[1].tipo).toBe("application/zip");
  expect(llamadas[1].pk).toBe(true); // un ZIP de verdad («PK…»)

  // segunda vez: el token se recordó y se actualiza el MISMO sitio
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Publicar en Netlify" }).click();
  await expect(page.getByRole("dialog").getByLabel("Token de Netlify")).toHaveValue("nfp_prueba");
  await page.getByRole("dialog").getByRole("button", { name: "Actualizar el sitio" }).click();
  await expect.poll(() => llamadas.length).toBe(3);
  expect(llamadas[2].url).toBe("https://api.netlify.com/api/v1/sites/sitio-1/deploys");
});

test("un token rechazado se explica y no se guarda", async ({ page }) => {
  test.setTimeout(180_000);
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
  await page.route("https://api.netlify.com/**", (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 401, headers: cors, contentType: "application/json", body: JSON.stringify({ message: "Access Denied" }) })
  );
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");
  await expect(page.frameLocator('iframe[title="Vista previa de la página generada"]').locator("#total")).toHaveText("0 tareas", { timeout: 90_000 });

  await page.getByRole("button", { name: "Publicar en Netlify" }).click();
  await page.getByRole("dialog").getByLabel("Token de Netlify").fill("malo");
  await page.getByRole("dialog").getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/rechazó el token/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("forja-netlify-token"))).toBeNull();
});
