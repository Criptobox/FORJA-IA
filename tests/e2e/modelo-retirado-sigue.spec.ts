import { expect, test, type Page } from "./fixtures";

/** Forja IA — Un modelo que ya no existe no puede ser el final del camino.
 *
 * Caso real, con captura: Auto eligió un modelo retirado de OpenRouter, llegó
 * «404 No endpoints found» y la app se paró en seco — en rojo, con otros
 * cuatro proveedores conectados y sin intentar ninguno. Un 404 no es un fallo
 * pasajero, pero es justo el que se arregla probando otro modelo: la petición
 * estaba bien; lo que falta es el modelo.
 */

async function seed(page: Page) {
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
            skills: [],
            settings: {
              // el modelo elegido NO existe en el proveedor: el mock contesta
              // 404 «does not exist», igual que OpenRouter con los retirados
              defaultModelKey: "custom::modelo-retirado-que-no-existe",
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
              piiShield: false,
              onlyFree: false,
            },
            providers: {
              custom: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: ["modelo-retirado-que-no-existe"],
                useProxy: false,
              },
              // el otro proveedor conectado al que DEBE saltar
              groq: {
                apiKey: "test-key-123",
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
      localStorage.removeItem("prism-modelos-rotos-v1");
    } catch {
      /* marco sin acceso */
    }
  });
}

test("con un modelo retirado, sigue con otro en vez de pararse", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto("/");

  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hola");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  // Lo que importa: acaba habiendo RESPUESTA, no un error rojo y punto.
  await expect(page.locator("main").getByText("funcionando con tu API")).toBeVisible({
    timeout: 90_000,
  });
  // y respondió el otro modelo, no el muerto
  await expect(page.locator("main")).toContainText("mock-mini-free");
});

test("el modelo retirado queda marcado para que Auto deje de elegirlo", async ({ page }) => {
  test.setTimeout(180_000);
  // Antes esto solo lo marcaba «Probar modelos» desde Ajustes, así que un
  // modelo muerto seguía saliendo elegido turno tras turno.
  await seed(page);
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hola");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            const raw = localStorage.getItem("prism-modelos-rotos-v1") ?? "{}";
            return Object.keys(JSON.parse(raw).state?.rotos ?? {});
          } catch {
            return [];
          }
        }),
      { timeout: 90_000 }
    )
    .toContain("custom::modelo-retirado-que-no-existe");
});
