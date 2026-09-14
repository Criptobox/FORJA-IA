import { expect, test, type Page } from "./fixtures";

/** Prism AI — Tocar un texto de la vista previa y editarlo ahí mismo.
 *
 * El botón «Editar» activa el piloto inyectado: el texto que pasas por
 * encima se marca, lo tocas, escribes y confirmas con Enter. El cambio se
 * localiza en el CÓDIGO de la respuesta y se persiste ahí — se comprueba
 * mirando el código (pestaña «Ver código»), no solo el DOM del iframe, que
 * es justo lo que se perdía antes de este cambio.
 */

const MODEL_ID = "mock-efectos"; // entrega un <h1> simple, perfecto para tocarlo

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

async function pedirLaPagina(page: Page) {
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing");
  await page.keyboard.press("Enter");
}

test("tocar el titular en la vista previa lo cambia, y el cambio queda en el código", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaPagina(page);

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  const titular = marco.locator('[data-fx="reveal"] h1');
  await expect(titular).toBeVisible({ timeout: 90_000 });

  // sin activar «Editar», tocar el titular no hace nada
  await titular.click();
  await expect(titular).not.toHaveAttribute("contenteditable", "true");

  await page.getByRole("button", { name: "Editar la vista previa" }).click();
  await expect(page.getByText("Toca un texto para editarlo")).toBeVisible();

  await titular.click();
  await expect(titular).toHaveAttribute("contenteditable", "true");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Mi titular nuevo");
  await page.keyboard.press("Enter");

  // el DOM ya lo dice…
  await expect(marco.locator('[data-fx="reveal"] h1')).toHaveText("Mi titular nuevo");

  // …y el CÓDIGO de la respuesta también: es la prueba de que se guardó
  // donde hace falta, no solo en la pantalla.
  await page.getByRole("button", { name: "Alternar código" }).click();
  await expect(page.locator("main")).toContainText("Mi titular nuevo");
});

test("un texto que aparece dos veces se rechaza con el motivo, no se adivina", async ({ page }) => {
  test.setTimeout(180_000);
  // reutiliza `mock-generica`, que entrega tres tarjetas con el mismo botón
  // implícito — aquí basta con un texto duplicado real: "Empezar" solo
  // aparece una vez ahí, así que se prueba con un modelo que sí repite texto.
  await page.addInitScript(() => {
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
              defaultModelKey: "custom::mock-generica",
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
                models: ["mock-generica"],
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
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaPagina(page);

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  // «Lorem ipsum dolor sit amet, consectetur adipiscing elit.» aparece en
  // los tres <p> de las tarjetas: exactamente el caso ambiguo.
  const parrafo = marco.locator("p", { hasText: "Lorem ipsum" }).first();
  await expect(parrafo).toBeVisible({ timeout: 90_000 });

  await page.getByRole("button", { name: "Editar la vista previa" }).click();
  await parrafo.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Texto nuevo");
  await page.keyboard.press("Enter");

  await expect(page.getByText("No se pudo aplicar el cambio")).toBeVisible();
  await expect(page.getByText(/aparece \d+ veces/)).toBeVisible();
});
