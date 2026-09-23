import { expect, test, type Page } from "./fixtures";

/** Forja IA — Una captura adjunta en un encargo de diseño se trata como
 * REFERENCIA: el modelo recibe el contrato del Vision Designer (leer como
 * sistema, no copiar, tokens en :root) en vez de una dirección rotatoria. */

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

// PNG 1×1 válido
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function enviar(page: Page, texto: string, conImagen: boolean) {
  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) cuerpos.push(r.postData() ?? "");
  });
  await seed(page);
  await page.goto("/");
  const input = page.locator("textarea[data-compositor]");
  await expect(input).toBeVisible({ timeout: 30_000 });
  if (conImagen) {
    await page.locator('input[type="file"]').first().setInputFiles({ name: "referencia.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("img", { name: /referencia/i }).first()).toBeVisible({ timeout: 10_000 });
  }
  await input.fill(texto);
  await page.keyboard.press("Enter");
  await expect.poll(() => cuerpos.length, { timeout: 30_000 }).toBeGreaterThan(0);
  return cuerpos;
}

test("con una captura adjunta, «una landing como esta» viaja como referencia de diseño", async ({ page }) => {
  test.setTimeout(120_000);
  const cuerpos = await enviar(page, "hazme una landing como esta para mi estudio de yoga", true);
  const c = cuerpos.join("\n");
  expect(c).toContain("Diseño a partir de la referencia adjunta");
  expect(c).toContain("[FORJA VISION DESIGNER]");
});

test("sin imagen, el mismo encargo usa la dirección de diseño de siempre", async ({ page }) => {
  test.setTimeout(120_000);
  const cuerpos = await enviar(page, "hazme una landing como esta para mi estudio de yoga", false);
  expect(cuerpos.join("\n")).not.toContain("Diseño a partir de la referencia adjunta");
});
