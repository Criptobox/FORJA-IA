import { expect, test, type Page } from "./fixtures";

/** Forja IA — Un «hola» con una página ya hecha no la reescribe.
 *
 * Caso real (captura del usuario): la página anterior se había cortado, el
 * usuario escribió «Hola» y el modelo contestó rehaciéndola entera —miles de
 * tokens, cortados otra vez en el mismo sitio— con el contexto al 106 %.
 *
 * Por el cable, en el turno del saludo:
 *   1. el código del historial NO viaja (va un marcador de una línea);
 *   2. el prompt lleva la orden expresa de contestar sin código.
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
              defaultModelKey: "custom::mock-parche",
              accessCode: "",
              agentModes: [],
              agentMode: true,
              ahorro: false,
              stream: false,
            },
            providers: {
              custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-parche"], useProxy: false },
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

async function asistentes(page: Page): Promise<number> {
  return page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("forja-ai-v1") ?? "{}").state;
    const s = st?.sessions?.find((x: { id: string }) => x.id === st.activeSessionId);
    return (s?.messages ?? []).filter((m: { role: string }) => m.role === "assistant").length;
  });
}

test("en un saludo no viaja el código y se pide contestar sin él", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  const caja = page.locator("textarea").first();
  await expect(caja).toBeVisible({ timeout: 30_000 });

  const cuerpos: string[] = [];
  await page.route("**/api/mock-llm/**", async (route) => {
    const b = route.request().postData();
    if (b) cuerpos.push(b);
    await route.continue();
  });

  await caja.fill("hazme una landing para mi cafetería");
  await page.keyboard.press("Enter");
  await expect.poll(() => asistentes(page), { timeout: 20_000 }).toBe(1);
  await page.waitForTimeout(1500);

  await caja.fill("Hola");
  await page.keyboard.press("Enter");
  await expect.poll(() => asistentes(page), { timeout: 20_000 }).toBe(2);

  const delSaludo = cuerpos
    .map((c) => JSON.parse(c) as { messages: { role: string; content: unknown }[] })
    .filter((c) => c.messages.some((m) => m.role === "user" && m.content === "Hola"));
  expect(delSaludo.length).toBeGreaterThan(0);
  const cuerpo = delSaludo[delSaludo.length - 1];
  const sistema = String(cuerpo.messages.find((m) => m.role === "system")?.content ?? "");
  expect(sistema).toContain("TURNO DE SALUDO");
  const historial = cuerpo.messages.filter((m) => m.role !== "system").map((m) => String(m.content)).join("\n");
  expect(historial, "la página del turno anterior no viaja").not.toMatch(/<!DOCTYPE/i);
  expect(historial).toContain("código omitido");
});
