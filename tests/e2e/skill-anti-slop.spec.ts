import { expect, test, type Page } from "./fixtures";

/** Prism AI — La skill «Antimuestrario + paletas listas» se activa desde
 * el diálogo de Skills y, activada, SÍ viaja al modelo; desactivada (el
 * default de fábrica), no.
 */

async function sembrar(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "prism-ai-v1",
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
              agentMode: false,
              ahorro: false,
              stream: false,
              piiShield: false,
            },
            providers: {
              custom: {
                apiKey: "k1",
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
    } catch {
      /* marco sin acceso a localStorage */
    }
  });
}

test("desactivada de fábrica: se activa desde Skills y entonces sí viaja", async ({ page }) => {
  await sembrar(page);
  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) {
      cuerpos.push(r.postData() ?? "");
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  const fila = page.getByText("Antimuestrario + paletas listas");
  await expect(fila).toBeVisible({ timeout: 10_000 });
  const interruptor = page.getByRole("switch", { name: "Activar Antimuestrario + paletas listas" });
  await expect(interruptor).not.toBeChecked();
  await interruptor.click();
  await expect(interruptor).toBeChecked();
  await page.keyboard.press("Escape");

  const compositor = page.locator("textarea").first();
  await expect(compositor).toBeVisible({ timeout: 30_000 });
  await compositor.fill("hazme una landing para mi spa");
  await page.keyboard.press("Enter");

  await expect
    .poll(() => cuerpos.filter((c) => c.includes("hazme una landing para mi spa")).length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);

  const enviado = cuerpos.filter((c) => c.includes("hazme una landing para mi spa"))[0];
  expect(enviado, "con la skill activada, el antimuestrario viaja").toContain("Antimuestrario");
});
