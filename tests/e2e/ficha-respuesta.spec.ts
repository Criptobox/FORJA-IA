import { expect, test, type Page } from "./fixtures";

/** Forja IA — «¿Por qué me contestó esto?»
 *
 * Forja ya medía casi todo, pero repartido: un chip aquí, un panel allá, y el
 * failover en un aviso que desaparece a los seis segundos. Cuando una
 * respuesta salía rara no había forma de reconstruir qué había pasado.
 *
 * Esta prueba abre el expediente de una respuesta que SÍ tuvo historia: el
 * primer modelo no existe, respondió el segundo. Eso tiene que quedar escrito
 * en el mensaje, no en un toast.
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
      localStorage.removeItem("forja-modelos-rotos-v1");
    } catch {
      /* marco sin acceso */
    }
  });
}

test("el expediente cuenta qué falló antes de la respuesta que ves", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto("/");

  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hola");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  await expect(page.locator("main").getByText("funcionando con tu API")).toBeVisible({
    timeout: 90_000,
  });

  // el botón existe solo cuando hay algo que contar
  const boton = page.locator("main").getByRole("button", { name: "por qué" }).first();
  await expect(boton).toBeVisible({ timeout: 30_000 });
  await boton.click();

  const main = page.locator("main");
  // el titular dice de una que respondió el segundo
  await expect(main).toContainText("2º modelo");
  // y el detalle nombra al que falló, con su código
  await expect(main).toContainText("Antes fallaron");
  await expect(main).toContainText("modelo-retirado-que-no-existe");
  await expect(main).toContainText("404");
  // el que respondió también está
  await expect(main).toContainText("Respondió");

  // se cierra
  await boton.click();
  await expect(main).not.toContainText("Antes fallaron");
});

test("el dinero del expediente nunca sale sin decir de cuándo es el precio", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hola");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.locator("main").getByText("funcionando con tu API")).toBeVisible({
    timeout: 90_000,
  });
  await page.locator("main").getByRole("button", { name: "por qué" }).first().click();

  const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const linea = texto.match(/Coste estimado: ([^\n]*?)(?: Tardó|$)/)?.[1] ?? "";
  expect(linea.length).toBeGreaterThan(0);
  // o hay importe CON fecha de precios, o se dice qué mitad falta. Nunca un
  // número suelto.
  const conFecha = /precios de \d{4}-\d{2}-\d{2}/.test(linea);
  const sinDato = linea.includes("sin dato");
  expect(conFecha || sinDato).toBe(true);
});
