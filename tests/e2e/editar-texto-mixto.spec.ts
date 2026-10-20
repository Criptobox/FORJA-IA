import { expect, test, type Page } from "./fixtures";

/** Forja IA — Editar un nodo de texto SUELTO junto a otros elementos.
 *
 * Hallazgo del dogfooding de v4.10.0/.1: `<h1>El café,<em>despacio.</em></h1>`
 * no es una hoja del árbol —tiene un `<em>` dentro—, así que la regla
 * original de «solo hojas» lo dejaba fuera ENTERO: se podía tocar
 * «despacio.» (que sí es hoja) pero nunca «El café,», sin ninguna señal de
 * por qué.
 *
 * Esto prueba que ahora también se puede tocar el texto suelto —sin volver
 * editable el `<h1>` como contenedor, y sin tocar el `<em>` de al lado— y
 * que hay una marca visual mientras se pasa por encima, que antes no
 * existía en absoluto.
 */

const MODEL_ID = "mock-texto-mixto";

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
  await input.fill("hazme una página con un titular con énfasis");
  await page.keyboard.press("Enter");
}

test("el texto suelto junto a un <em> se marca al pasar por encima y se edita sin tocar al vecino", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaPagina(page);

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  const titular = marco.locator('[data-testid="titular"]');
  const hoja = marco.locator('[data-testid="hoja"]');
  await expect(titular).toBeVisible({ timeout: 90_000 });
  await expect(titular).toHaveText("El café,despacio.");

  await page.getByRole("button", { name: "Editar la vista previa" }).click();
  await expect(page.getByText("Toca un texto para editarlo")).toBeVisible();

  const caja = await titular.boundingBox();
  if (!caja) throw new Error("el titular no tiene caja");
  // un punto DENTRO del <h1> pero ANTES del <em> — sobre «El café,» suelto
  const xSuelto = caja.x + 8;
  const ySuelto = caja.y + caja.height / 2;

  // antes de tocar nada, pasar el ratón por encima del texto suelto ya
  // tiene que dejar una marca visual — es justo lo que faltaba: se podía
  // tocar «despacio.» sin ninguna pista de que «El café,» también se podía
  // (ahora) o no se podía (antes) editar.
  await page.mouse.move(xSuelto, ySuelto);
  await expect(marco.locator(".forja-texto-hover-caja")).toBeAttached({ timeout: 5000 });

  await page.mouse.click(xSuelto, ySuelto);
  // se editó envolviendo el nodo de texto en un <span> de usar y tirar —
  // NUNCA el <h1> ni el <em>, que siguen intactos mientras se edita
  const span = titular.locator("span[contenteditable='true']");
  await expect(span).toBeAttached();
  await expect(hoja).not.toHaveAttribute("contenteditable", "true");

  await page.keyboard.press("Control+A");
  // sin espacio final: igual que en la edición de una hoja, el texto se
  // recorta con `.trim()` al confirmar — el <em> vecino queda pegado justo
  // detrás en el código fuente, así que el espacio hay que escribirlo DENTRO
  // del texto, no al final.
  await page.keyboard.type("Saboréalo,");
  await page.keyboard.press("Enter");

  // el <span> desechable ya no está: el nodo de texto volvió a quedar
  // suelto, tal cual estaba, y el <em> vecino nunca se tocó
  await expect(titular.locator("span[contenteditable]")).toHaveCount(0);
  await expect(hoja).toHaveText("despacio.");
  await expect(titular).toHaveText("Saboréalo,despacio.");

  // …y el cambio quedó en el CÓDIGO de la respuesta, no solo en el DOM
  await page.getByRole("button", { name: "Alternar código" }).click();
  await expect(page.locator("main")).toContainText("Saboréalo,");
  await expect(page.locator("main")).toContainText("<em");
});

test("la hoja de al lado (<em>) se sigue pudiendo editar igual que siempre", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaPagina(page);

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  const hoja = marco.locator('[data-testid="hoja"]');
  await expect(hoja).toBeVisible({ timeout: 90_000 });

  await page.getByRole("button", { name: "Editar la vista previa" }).click();
  await hoja.click();
  await expect(hoja).toHaveAttribute("contenteditable", "true");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("con calma.");
  await page.keyboard.press("Enter");

  await expect(hoja).toHaveText("con calma.");
  const titular = marco.locator('[data-testid="titular"]');
  await expect(titular).toHaveText("El café,con calma.");
});
