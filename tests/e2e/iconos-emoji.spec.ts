import { expect, test, type Page } from "./fixtures";

/** Prism AI — Un emoji como icono se MIDE, no se confía en que el modelo
 * se autoevalúe.
 *
 * `skill-anti-slop` (v4.17.0) le pide al modelo que NO use emoji como
 * icono de interfaz — pero pedirlo no es lo mismo que comprobarlo.
 * `mock-iconos-emoji` entrega una página con dos botones cuyo único
 * contenido es un emoji (🛒, 🔍); Prism debe medirlo en la página pintada
 * (nueva seña `iconos-emoji` de `generico.ts`) y devolvérselo al modelo,
 * igual que ya hace con el resto de señas de «página genérica».
 */

const MODEL_ID = "mock-iconos-emoji";

async function seed(page: Page) {
  await page.addInitScript((model: string) => {
    try {
      localStorage.setItem("prism-preview-demo", "1");
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
              defaultModelKey: `custom::${model}`,
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
                models: [model],
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
  }, MODEL_ID);
}

test("botones con emoji como icono se detectan de verdad y se corrigen", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) {
      cuerpos.push(r.postData() ?? "");
    }
  });

  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing");
  await page.keyboard.press("Enter");

  await expect
    .poll(() => cuerpos.filter((c) => c.includes("y la he medido")).length, {
      timeout: 90_000,
    })
    .toBeGreaterThan(0);

  const aviso = cuerpos.find((c) => c.includes("y la he medido")) ?? "";
  expect(aviso, "cuenta los botones con emoji como icono").toMatch(/2 botones? o enlaces? usan un emoji/i);
  expect(aviso, "pide SVG propio, no el emoji").toMatch(/svg/i);

  await expect(page.getByText("Corregido tras medirla.").first()).toBeVisible({ timeout: 90_000 });
});
