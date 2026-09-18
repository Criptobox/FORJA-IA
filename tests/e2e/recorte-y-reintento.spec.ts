import { expect, test, type Page } from "./fixtures";

/** Forja IA — Si no cabe, se recorta y se reintenta con el MISMO modelo.
 *
 * Saltar a otro modelo estaba bien como último recurso, pero cuando el que no
 * puede es justo el que quieres, lo que sobra no es el modelo: es el historial
 * viejo. Aquí se comprueba que la app quita lo viejo, vuelve a probar con el
 * mismo, y **lo dice**.
 */

/** Historial largo a propósito: pasa de 7.000 tokens estimados, que es lo que
 *  el modelo del mock admite. */
function sesionLarga() {
  const gordo = (n: number, letra: string) => letra.repeat(n);
  const mensajes: { id: string; role: string; content: string; createdAt: number }[] = [];
  for (let i = 0; i < 8; i++) {
    mensajes.push({
      id: `u${i}`,
      role: "user",
      content: `pregunta vieja ${i} ${gordo(2000, "a")}`,
      createdAt: 1,
    });
    mensajes.push({
      id: `a${i}`,
      role: "assistant",
      content: `respuesta vieja ${i} ${gordo(2000, "b")}`,
      createdAt: 2,
    });
  }
  return {
    id: "s1",
    title: "larga",
    createdAt: 1,
    updatedAt: 2,
    modelKey: "custom::mock-limite-7000",
    messages: mensajes,
  };
}

async function seed(page: Page) {
  await page.addInitScript((sesion: unknown) => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [sesion],
            activeSessionId: "s1",
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            skills: [],
            settings: {
              defaultModelKey: "custom::mock-limite-7000",
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
              piiShield: false,
              onlyFree: false,
              contextWindow: 0,
            },
            providers: {
              custom: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: ["mock-limite-7000"],
                useProxy: false,
              },
            },
            version: 1,
          },
          version: 0,
        })
      );
      localStorage.removeItem("forja-limites-v1");
      localStorage.removeItem("forja-modelos-rotos-v1");
    } catch {
      /* marco sin acceso */
    }
  }, sesionLarga());
}

test("recorta el historial y responde el mismo modelo", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto("/");

  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("que hacemos");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  // Hay respuesta, y la da el modelo que antes no podía: eso es el recorte.
  await expect(page.locator("main").getByText("funcionando con tu API")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator("main")).toContainText("mock-limite-7000");
});

test("y lo dice: un recorte en silencio deja al modelo sin hilo", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("que hacemos");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  await expect(page.getByText(/Historial recortado/i)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/se quitaron .* del historial/i)).toBeVisible();
});
