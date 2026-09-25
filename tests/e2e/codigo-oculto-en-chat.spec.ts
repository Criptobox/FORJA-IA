import { expect, test, type Page } from "./fixtures";

/** Forja IA — El código no se vuelca crudo en el chat.
 *
 * Hallazgo de dogfooding: pedías una web y el bloque ```html entero —a veces
 * varias pantallas— pasaba por delante del texto, y mientras se escribía se
 * veía crecer la sopa de etiquetas token a token, sin ninguna señal de que
 * aquello era trabajo en marcha.
 *
 * Ahora: mientras escribe, el chat enseña el texto de antes de la cerca (el
 * «aquí tienes tu página») y un aviso de que está trabajando — la vista
 * previa en vivo es donde se ve crecer la página de verdad. Terminado, el
 * bloque de código nace colapsado con un botón «Ver código»: sigue estando
 * (se puede copiar, se cuenta para «Mostrar todo»), solo que no ocupa la
 * pantalla por defecto.
 */

const MODEL_ID = "mock-generica"; // entrega bastante HTML: por encima del umbral de colapso

async function seed(page: Page) {
  await page.addInitScript((model: string) => {
    try {
      localStorage.setItem("forja-preview-demo", "1");
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
              // estos specs prueban la CONSTRUCCIÓN; la propuesta de diseño tiene su propio spec
              propuestaDiseno: false,
              defaultModelKey: `custom::${model}`,
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: true,
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

test("mientras escribe, no se ve el HTML crudo creciendo: se ve el aviso de trabajo", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing");
  await page.keyboard.press("Enter");

  const respuesta = page.locator("[data-role='assistant']").last();
  // el aviso de trabajo aparece MIENTRAS se escribe…
  await expect(respuesta).toContainText("Escribiendo tu página", { timeout: 30_000 });
  // …y en ese mismo momento el HTML crudo NO está visible en el chat: ni
  // como texto suelto ni como un <pre> con el código a medio escribir
  await expect(respuesta).not.toContainText("<!DOCTYPE");
  expect(await respuesta.locator("pre").count()).toBe(0);

  // y termina bien: el aviso de trabajo desaparece cuando ya se puede tocar
  await expect(page.getByRole("button", { name: "Ver código" }).first()).toBeVisible({
    timeout: 90_000,
  });
  await expect(respuesta).not.toContainText("Escribiendo tu página");
});

test("terminado, el código nace colapsado con un botón «Ver código», y se puede abrir", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing");
  await page.keyboard.press("Enter");

  const respuesta = page.locator("[data-role='assistant']").last();
  const verCodigo = page.getByRole("button", { name: "Ver código" }).first();
  await expect(verCodigo).toBeVisible({ timeout: 90_000 });

  // colapsado: el texto del código NO está en pantalla…
  await expect(respuesta).not.toContainText("<!DOCTYPE");
  // …pero el resumen sí dice cuánto hay
  await expect(respuesta).toContainText(/líneas de código ocultas/);

  // al pulsar, se abre y el código aparece de verdad
  await verCodigo.click();
  await expect(respuesta).toContainText("<!DOCTYPE", { timeout: 5000 });
  await expect(page.getByRole("button", { name: "Ocultar código" }).first()).toBeVisible();
});
