import { expect, test, type Page } from "./fixtures";

/** Forja IA — Un retoque viaja como parche, no como la página entera (Plan Maestro 2026 §63).
 *
 * Se comprueba lo que importa por el cable y en lo guardado:
 *   1. En un retoque, el prompt pide SEARCH/REPLACE.
 *   2. El parche se aplica sobre la última versión y la página resultante
 *      queda completa en la respuesta (la vista previa la lee de ahí).
 *   3. Si el parche no casa, el archivo NO se toca y se pide completo.
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
              agentMode: false,
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

test("el retoque pide un parche, se aplica y la página queda completa", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });

  const cuerpos: string[] = [];
  await page.route("**/api/mock-llm/**", async (route) => {
    const b = route.request().postData();
    if (b) cuerpos.push(b);
    await route.continue();
  });

  await enviar(page, "hazme una landing para mi cafetería");
  await expect.poll(async () => (await mensajes(page)).filter((m) => m.role === "assistant").length, { timeout: 20_000 }).toBe(1);
  const primerSistema = JSON.parse(cuerpos.find((c) => c.includes("hazme una landing")) ?? "{}").messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
  expect(primerSistema, "una web nueva NO se pide como parche").not.toContain("RETOQUE POR PARCHE");

  await page.waitForTimeout(1500);
  await enviar(page, "cambia el botón a verde");
  await expect.poll(async () => (await mensajes(page)).filter((m) => m.role === "assistant").length, { timeout: 20_000 }).toBe(2);

  // el cuerpo del envío del chat (hay otras llamadas al mismo modelo, como el título)
  const delRetoque = cuerpos.filter((c) => c.includes("cambia el botón a verde") && c.includes('"system"'));
  expect(delRetoque.length).toBeGreaterThan(0);
  const ultimoCuerpo = JSON.parse(delRetoque[delRetoque.length - 1]);
  const sistema = ultimoCuerpo.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
  expect(sistema).toContain("RETOQUE POR PARCHE");

  const respuesta = (await mensajes(page)).filter((m) => m.role === "assistant").pop()?.content ?? "";
  expect(respuesta).toContain("<<<<<<< SEARCH");
  expect(respuesta, "el archivo completo, ya parcheado, se añade localmente").toContain("resultado del parche");
  expect(respuesta).toContain("background: green");
  expect(respuesta, "y el resto de la página sigue ahí").toContain("Párrafo de la carta número 59");
});

test("si el parche no casa, el archivo no se toca y se pide completo", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });

  await enviar(page, "hazme una landing para mi cafetería");
  await expect.poll(async () => (await mensajes(page)).filter((m) => m.role === "assistant").length, { timeout: 20_000 }).toBe(1);
  await page.waitForTimeout(1500);

  await enviar(page, "cambia el botón a verde, fallar");
  await expect(page.getByText("El parche no casó")).toBeVisible({ timeout: 20_000 });

  // se pidió el archivo completo, y el modelo lo entregó entero ya en verde
  await expect
    .poll(async () => (await mensajes(page)).some((m) => m.role === "user" && m.content.includes("COMPLETOS")), { timeout: 20_000 })
    .toBe(true);
  await expect
    .poll(async () => (await mensajes(page)).filter((m) => m.role === "assistant").pop()?.content ?? "", { timeout: 20_000 })
    .toContain("Aquí va el archivo completo.");
  const penultima = (await mensajes(page)).filter((m) => m.role === "assistant").slice(-2)[0].content;
  expect(penultima, "el parche fallido no dejó un archivo a medias").not.toContain("resultado del parche");
});
