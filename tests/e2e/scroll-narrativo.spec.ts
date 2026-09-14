import { expect, test, type Page } from "./fixtures";

/** Prism AI — Scrollytelling: anclar y deslizar en horizontal.
 *
 * `mock-scroll` entrega una sección `pin` con tres pasos y una sección
 * `horizontal` con tres paneles. Se comprueba lo que de verdad importa:
 * que el avance (`--fx-p`) sigue al scroll de verdad, que los pasos se
 * revelan en orden, y que sin animación el contenido no se queda pegado a
 * un `position: sticky` que nadie va a mover 300vh a mano.
 */

const MODEL_ID = "mock-scroll";

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
  await input.fill("hazme una página con scroll narrativo");
  await page.keyboard.press("Enter");
}

test("sin animaciones, el contenido no se queda anclado a 300vh vacíos", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pedirLaPagina(page);

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  const seccion = marco.locator('[data-fx="pin"]').first();
  await expect(seccion).toBeAttached({ timeout: 90_000 });
  // sin `.fx-on` la altura de 300vh se anula: quien pidió menos movimiento no
  // desplaza cientos de píxeles de página vacía por un efecto apagado.
  const alto = await seccion.evaluate((el) => getComputedStyle(el).height);
  const vh = await page.evaluate(() => window.innerHeight);
  expect(parseFloat(alto)).toBeLessThan(vh * 1.5);
});

test.describe("con animaciones permitidas", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("el avance del pin sigue al scroll y revela los pasos en orden", async ({ page }) => {
    test.setTimeout(180_000);
    await seed(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await pedirLaPagina(page);

    const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
    const seccion = marco.locator('[data-fx="pin"]').first();
    await expect(seccion).toBeAttached({ timeout: 90_000 });

    // al principio, el primer paso es el activo
    await expect
      .poll(() => seccion.locator('[data-fx-step]').nth(0).evaluate((el) => el.classList.contains("fx-active")))
      .toBe(true);
    await expect(seccion.locator('[data-fx-step]').nth(2)).not.toHaveClass(/fx-active/);

    // El avance (0 a 1) se reparte en lo que de verdad se puede desplazar:
    // la altura de la sección MENOS la ventana — no la altura entera, que
    // sería el mismo error que el propio kit evita en `--fx-p`.
    const [alturaSeccion, arriba, vh] = await Promise.all([
      seccion.evaluate((el) => el.getBoundingClientRect().height),
      seccion.evaluate((el) => el.getBoundingClientRect().top),
      page.evaluate(() => window.innerHeight),
    ]);
    const desplazable = alturaSeccion - vh;

    // a mitad de la sección, el paso del medio manda
    await marco
      .locator("body")
      .evaluate((_el, y) => window.scrollTo(0, y), Math.round(arriba + desplazable * 0.5));
    await expect
      .poll(() => seccion.locator('[data-fx-step]').nth(1).evaluate((el) => el.classList.contains("fx-active")))
      .toBe(true);

    // al final, el último
    await marco
      .locator("body")
      .evaluate((_el, y) => window.scrollTo(0, y), Math.round(arriba + desplazable));
    await expect
      .poll(() => seccion.locator('[data-fx-step]').nth(2).evaluate((el) => el.classList.contains("fx-active")))
      .toBe(true);
  });

  test("el carril horizontal se desplaza con el scroll vertical, sin generar scroll real de página", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await seed(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await pedirLaPagina(page);

    const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
    const envoltura = marco.locator('[data-fx="horizontal"]');
    await expect(envoltura).toBeAttached({ timeout: 90_000 });
    const carril = marco.locator('[data-fx="horizontal-track"]');

    const antes = await carril.evaluate((el) => getComputedStyle(el).transform);
    const [alturaSeccion, arriba, vh] = await Promise.all([
      envoltura.evaluate((el) => el.getBoundingClientRect().height),
      envoltura.evaluate((el) => el.getBoundingClientRect().top),
      page.evaluate(() => window.innerHeight),
    ]);
    const desplazable = alturaSeccion - vh;
    await marco
      .locator("body")
      .evaluate((_el, y) => window.scrollTo(0, y), Math.round(arriba + desplazable * 0.6));
    await expect
      .poll(() => carril.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe(antes);

    // y el documento del iframe no se sale por la derecha: lo esconde el
    // `overflow:hidden` del carril, no un límite que se cumple de milagro
    const scroll = await marco
      .locator("html")
      .evaluate((el) => (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth);
    expect(scroll).toBeLessThanOrEqual(1);
  });
});
