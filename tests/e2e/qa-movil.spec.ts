import { expect, test, type Page } from "./fixtures";

/** Forja IA — Lo que el QA visual mide en móvil vuelve al modelo como corrección (Plan Maestro 2026 §38).
 *
 * El medidor ya corría a 390 px en la revisión automática, pero solo se usaban
 * las señas de página genérica. Aquí: una página que se sale por la derecha en
 * el móvil vuelve al modelo con lo MEDIDO, y la versión corregida deja de fallar.
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
            skills: [],
            settings: {
              propuestaDiseno: false,
              defaultModelKey: "custom::mock-movil-roto",
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
            },
            providers: {
              custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-movil-roto"], useProxy: false },
            },
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

/** Los mensajes guardados de la conversación activa. */
async function mensajes(page: Page): Promise<{ role: string; content: string }[]> {
  return page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("forja-ai-v1") ?? "{}").state;
    const s = st?.sessions?.find((x: { id: string }) => x.id === st.activeSessionId);
    return (s?.messages ?? []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
  });
}

async function enviar(page: Page, texto: string) {
  // con una página ya hecha el compositor cambia de rótulo («Pide cambios para la página…»)
  await page.getByPlaceholder(/Escribe tu mensaje…|Pide cambios para la página/).fill(texto);
  await page.keyboard.press("Enter");
}

test("una página con scroll horizontal en móvil se corrige sola con lo medido", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });

  await enviar(page, "hazme una landing para mi cafetería");
  await expect(page.getByText("Falla en el móvil")).toBeVisible({ timeout: 30_000 });

  // la corrección viaja como mensaje de instrucción, con lo medido dentro
  await expect
    .poll(async () => (await mensajes(page)).find((m) => m.role === "user" && m.content.includes("390 px de ancho"))?.content ?? "", {
      timeout: 20_000,
    })
    .toMatch(/Scroll horizontal/);

  // y la segunda entrega ya no se sale
  await expect
    .poll(async () => (await mensajes(page)).filter((m) => m.role === "assistant").pop()?.content ?? "", { timeout: 30_000 })
    .toContain("max-width: 100%");
  await page.waitForTimeout(4000);
  await expect(page.getByText("La página sigue fallando en el móvil")).toHaveCount(0);
});
