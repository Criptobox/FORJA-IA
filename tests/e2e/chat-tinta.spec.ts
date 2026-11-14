import { expect, test, type Page } from "@playwright/test";

/** Forja IA — FORJA WEB diseña las apps con Tinta, dentro del chat.
 *
 * Con FORJA WEB elegido en el selector, pedir una app la diseña la biblioteca
 * Tinta: el modelo solo escribe una receta corta, el equipo de agentes trabaja
 * a la vista y la app sale en la vista previa del chat. Luego se le piden
 * cambios en el mismo chat y la vista previa se actualiza. Sin botones aparte. */
async function seed(page: Page, modelo = "forja::web") {
  await page.addInitScript((defaultModelKey) => {
    if (window.top !== window.self) return;
    try {
      if (localStorage.getItem("forja-ai-v1")) return;
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: { defaultModelKey, accessCode: "", agentModes: [], ahorro: false },
            providers: { custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {}
  }, modelo);
}

async function contarLlamadas(page: Page) {
  const cuerpos: string[] = [];
  await page.route("**/api/mock-llm/**", async (route) => {
    const b = route.request().postData();
    if (b) cuerpos.push(b);
    await route.continue();
  });
  return cuerpos;
}

const TINTA = "asistente de diseño de Estilos Tinta";
const vista = (page: Page) => page.frameLocator('iframe[title="Vista previa de la página generada"]');

test("FORJA WEB: pedir una app la diseña Tinta con el equipo, sale en la vista previa y se cambia en el chat", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  await seed(page);
  const cuerpos = await contarLlamadas(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("combobox").first()).toContainText("FORJA WEB");
  // Sin botones de Tinta: es FORJA WEB
  await expect(page.getByTestId("boton-tinta")).toHaveCount(0);

  await caja.fill("hazme una app para mi cafetería con pedidos");
  await page.keyboard.press("Enter");

  // el panel de pasos de la creación, en la burbuja de Forja IA
  await expect(page.getByTestId("creacion-en-curso")).toContainText("Creando tu app", { timeout: 20_000 });

  // el equipo de agentes trabaja a la vista
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  await motor.locator("[data-eq=speed]").click();
  await expect(motor.locator("#eqChoose.on")).toBeVisible({ timeout: 30_000 });
  await motor.locator("#eqGo").click();
  await expect(page.locator('iframe[title="Motor de diseño Tinta"]')).toHaveCSS("pointer-events", "none");

  // la respuesta es de Forja IA, sin la receta, y la app está en la vista previa
  await expect(page.locator("p", { hasText: /App lista: \d+ pantallas/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("p", { hasText: "¡Buena idea!" })).toBeVisible();
  await expect(page.getByText('"bloques"')).toHaveCount(0);
  await expect(page.getByText("mock-mini-free")).toHaveCount(0);
  await expect(vista(page).locator("body")).not.toBeEmpty({ timeout: 30_000 });
  await expect(vista(page).getByText("Café Brisa")).toHaveCount(0);
  expect(cuerpos.filter((c) => c.includes(TINTA))).toHaveLength(1);

  // un cambio en el mismo chat: se redibuja sin el equipo y la vista previa cambia
  await expect(page.getByPlaceholder("Pide cambios para la app… se verán en la vista previa")).toBeVisible();
  const chat = page.getByRole("textbox", { name: "Mensaje" });
  await chat.fill("ponla en modo oscuro y llama a la cafetería Café Brisa");
  await page.keyboard.press("Enter");
  await expect(page.locator("p", { hasText: /Versión 2 · \d+ pantallas/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("p", { hasText: "Hecho: la paso a modo oscuro." })).toBeVisible();
  await expect(vista(page).getByText("Café Brisa")).not.toHaveCount(0, { timeout: 30_000 });
  const pedidos = cuerpos.filter((c) => c.includes(TINTA));
  expect(pedidos).toHaveLength(2);
  // el modelo recibió la receta actual para partir de ella
  expect(pedidos[1]).toContain("PANTALLA ACTUAL");
  expect(pedidos[1]).toContain("c-coffee");

  // una pregunta no toca la app
  await chat.fill("¿qué paleta usaste?");
  await page.keyboard.press("Enter");
  await expect(page.locator("p", { hasText: "Usa la paleta mandarina con tarjetas grandes" })).toBeVisible({ timeout: 30_000 });
  await expect(vista(page).getByText("Café Brisa")).not.toHaveCount(0);
  await page.screenshot({ path: "test-results/forja-web-tinta.png" });
  await expect(page.locator("p", { hasText: /Versión 3/ })).toHaveCount(0);
});

test("FORJA WEB: una landing sigue con el sistema de siempre, no con Tinta", async ({ page }) => {
  await seed(page);
  const cuerpos = await contarLlamadas(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una landing para una cafetería en Cádiz, directo");
  await page.keyboard.press("Enter");
  await expect.poll(() => cuerpos.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(cuerpos.some((c) => c.includes(TINTA))).toBe(false);
});

test("FORJA WEB: una app de gestión de datos va por código", async ({ page }) => {
  await seed(page);
  const cuerpos = await contarLlamadas(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");
  await expect.poll(() => cuerpos.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(cuerpos.some((c) => c.includes(TINTA))).toBe(false);
  await expect.poll(() => cuerpos.some((c) => c.includes("crea una app de lista de tareas")), { timeout: 30_000 }).toBe(true);
  expect(cuerpos.some((c) => c.includes(TINTA))).toBe(false);
});

test("con otro modelo, una app se pide como siempre (sin Tinta ni tarjetas)", async ({ page }) => {
  await seed(page, "custom::mock-mini-free");
  const cuerpos = await contarLlamadas(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app para mi cafetería con pedidos");
  await page.keyboard.press("Enter");
  await expect.poll(() => cuerpos.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(cuerpos.some((c) => c.includes(TINTA))).toBe(false);
  await expect(page.getByTestId("oferta-tinta")).toHaveCount(0);
});

test("en el móvil, la app de Tinta se abre en la vista previa", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app para mi gimnasio con rutinas");
  await page.keyboard.press("Enter");
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  await motor.locator("[data-eq=speed]").click();
  await expect(motor.locator("#eqChoose.on")).toBeVisible({ timeout: 30_000 });
  await motor.locator("#eqGo").click();
  await expect(page.locator("p", { hasText: /App lista: \d+ pantallas/ })).toBeVisible({ timeout: 30_000 });
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(390);
});

test("FORJA WEB: «Detener» mientras diseña el equipo lo para y lo quita de la vista", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app para mi cafetería con pedidos");
  await page.keyboard.press("Enter");
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  // el equipo tapa la pantalla: se detiene desde su propio diálogo (Esc) o con «Detener»
  await page.keyboard.press("Escape");
  await expect(page.locator("p", { hasText: "Diseño detenido" })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('iframe[title="Motor de diseño Tinta"]')).toHaveCSS("pointer-events", "none");
  await expect(page.getByLabel("Detener generación")).toHaveCount(0);
  // y se puede volver a pedir
  await caja.fill("hazme una app para mi cafetería con pedidos");
  await page.keyboard.press("Enter");
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
});
