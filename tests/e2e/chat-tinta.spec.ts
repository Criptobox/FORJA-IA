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

/** Envía lo escrito cuando el botón ya se activó (el chat ya tiene el texto). */
async function enviar(page: Page) {
  const boton = page.getByRole("button", { name: "Enviar mensaje" });
  await expect(boton).toBeEnabled();
  await boton.click();
}
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
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('"bloques"')).toHaveCount(0);
  await expect(page.getByText("mock-mini-free")).toHaveCount(0);
  await expect(vista(page).locator("body")).not.toBeEmpty({ timeout: 30_000 });
  await expect(vista(page).getByText("Café Brisa")).toHaveCount(0);
  // la primera versión la hace el equipo: sin gastar IA
  expect(cuerpos.filter((c) => c.includes(TINTA))).toHaveLength(0);
  await expect(page.locator("p", { hasText: "sin gastar IA" }).first()).toBeVisible();

  // un cambio en el mismo chat: se redibuja sin el equipo y la vista previa cambia
  await expect(page.getByPlaceholder("Pide cambios para la app… se verán en la vista previa")).toBeVisible();
  const chat = page.getByRole("textbox", { name: "Mensaje" });
  await chat.fill("ponla en modo oscuro y llama a la cafetería Café Brisa");
  await enviar(page);
  await expect(page.locator("p", { hasText: /Versión 2 · \d+ pantallas/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("p", { hasText: "Hecho, sin gastar IA: modo oscuro · nombre «Café Brisa»." })).toBeVisible();
  await expect(vista(page).getByText("Café Brisa")).not.toHaveCount(0, { timeout: 30_000 });
  // el cambio se entendió en local: tampoco gastó IA
  expect(cuerpos.filter((c) => c.includes(TINTA))).toHaveLength(0);

  // una pregunta no toca la app
  await chat.fill("¿qué paleta usaste?");
  await enviar(page);
  // eso no se entiende en local: va a la IA conectada, con la receta actual
  await expect(page.locator("p", { hasText: "Usa la paleta mandarina con tarjetas grandes" })).toBeVisible({ timeout: 30_000 });
  const pedidos = cuerpos.filter((c) => c.includes(TINTA));
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0]).toContain("PANTALLA ACTUAL");
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
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toBeVisible({ timeout: 30_000 });
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

test("FORJA WEB: «Editar con la biblioteca» abre el editor de Tinta con la app y al guardar vuelve como versión nueva", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app de tienda de ropa");
  await enviar(page);
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  // la pantalla sigue al agente que trabaja (antes se quedaba arriba)
  await expect(motor.locator(".ag.work")).toBeInViewport({ timeout: 15_000 });
  await motor.locator("[data-eq=speed]").click();
  await expect(motor.locator("#eqChoose.on")).toBeVisible({ timeout: 30_000 });
  await motor.locator("#eqGo").click();
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("editar-tinta").click();
  await expect(motor.locator("#motorEditBar")).toBeVisible({ timeout: 30_000 });
  // el editor de verdad: modo, letra y volver a la biblioteca de piezas
  await expect(motor.getByRole("button", { name: /Oscuro/ }).first()).toBeVisible();
  await motor.getByRole("button", { name: /Oscuro/ }).first().click();
  await motor.getByRole("button", { name: "Guardar y volver al chat" }).click();
  await expect(page.locator('iframe[title="Motor de diseño Tinta"]')).toHaveCSS("pointer-events", "none");
  await expect(page.locator("p", { hasText: "Cambios del editor guardados, sin gastar IA." })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("p", { hasText: /Versión 2/ })).toBeVisible();
  // solo la versión vigente ofrece editar
  await expect(page.getByTestId("editar-tinta")).toHaveCount(1);
});

test("Editor de Tinta: Letra y Barra inferior se eligen viendo una miniatura de cada opción", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app de tienda de ropa");
  await enviar(page);
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  await motor.locator("[data-eq=speed]").click();
  await expect(motor.locator("#eqChoose.on")).toBeVisible({ timeout: 30_000 });
  await motor.locator("#eqGo").click();
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("editar-tinta").click();
  await expect(motor.locator("#motorEditBar")).toBeVisible({ timeout: 30_000 });

  // Letra: una hoja con una muestra escrita con cada letra, no una lista de nombres
  const letra = motor.locator(".pick-btn[data-pick=fontPick]");
  await expect(letra).toBeVisible();
  await letra.click();
  const hoja = motor.locator("#pickerDialog");
  await expect(hoja).toBeVisible();
  await expect(hoja.locator(".pick-card")).toHaveCount(13); // las 12 letras + «Original de cada bloque»
  await expect(hoja.locator(".pick-card .pick-sample").first()).toBeVisible();
  await expect(hoja.locator(".pick-card.on")).toHaveCount(1);
  await hoja.getByRole("radio", { name: /Técnica/ }).click();
  await expect(hoja).toBeHidden();
  await expect(letra).toContainText("Técnica");

  // Barra inferior: la barra de verdad, dibujada con tu paleta y tu modo
  const barra = motor.locator(".pick-btn[data-pick=navPick]");
  await barra.click();
  await expect(hoja).toBeVisible();
  expect(await hoja.locator(".pick-card").count()).toBeGreaterThan(5);
  await expect(hoja.locator(".pick-card .pick-nav-inner").first()).toBeVisible();
  await hoja.getByRole("radio", { name: /Isla en grafito/ }).click();
  await expect(barra).toContainText("Isla en grafito");

  // Esc cierra la hoja sin cambiar nada
  await barra.click();
  await expect(hoja).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(hoja).toBeHidden();
  await expect(barra).toContainText("Isla en grafito");

  await motor.getByRole("button", { name: "Guardar y volver al chat" }).click();
  await expect(page.locator("p", { hasText: "Cambios del editor guardados, sin gastar IA." })).toBeVisible({ timeout: 30_000 });
});

test("Editor de Tinta: la Paleta se elige viendo cada paleta puesta, con filtro de claras y oscuras", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByPlaceholder("Escribe tu mensaje…");
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app de tienda de ropa");
  await enviar(page);
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  await motor.locator("[data-eq=speed]").click();
  await expect(motor.locator("#eqChoose.on")).toBeVisible({ timeout: 30_000 });
  await motor.locator("#eqGo").click();
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("editar-tinta").click();
  await expect(motor.locator("#motorEditBar")).toBeVisible({ timeout: 30_000 });

  const paleta = motor.locator(".pick-btn[data-pick=palPick]");
  await expect(paleta).toBeVisible();
  await paleta.click();
  const hoja = motor.locator("#pickerDialog");
  await expect(hoja).toBeVisible();
  // «Sin paleta» + las 90 paletas, cada una con su mini pantalla y la barra de la regla 60-30-10
  await expect(hoja.locator(".pick-card")).toHaveCount(91);
  await expect(hoja.locator(".pick-note")).toContainText("Regla 60-30-10");
  await expect(hoja.locator(".pick-card .pal-screen").first()).toBeVisible();
  const regla = hoja.locator(".pick-card .pal-rule").first();
  await expect(regla).toBeVisible();
  await expect(regla.locator("span")).toHaveText(["60", "30", "10"]);

  // las paletas de las referencias: las 20 profesionales, la regla 60-30-10 y Marple
  for (const nombre of ["Brisa marina", "Oro elegante", "Tormenta y naranja", "Desierto y señal", "Polar y racing", "Marple"]) {
    await expect(hoja.locator(".pick-card", { hasText: nombre })).toHaveCount(1);
  }

  // filtro: solo oscuras (24) o solo claras (66); «Sin paleta» siempre a mano
  await hoja.getByRole("button", { name: "Oscuras" }).click();
  await expect(hoja.locator(".pick-card:visible")).toHaveCount(25);
  await hoja.getByRole("button", { name: "Claras" }).click();
  await expect(hoja.locator(".pick-card:visible")).toHaveCount(67);
  await hoja.getByRole("button", { name: "Todas" }).click();
  await expect(hoja.locator(".pick-card:visible")).toHaveCount(91);

  // elegir una de las nuevas la aplica y el botón lo enseña
  await hoja.getByRole("radio", { name: /Tormenta y naranja/ }).click();
  await expect(hoja).toBeHidden();
  await expect(paleta).toContainText("Tormenta y naranja");
  await expect(motor.locator(".toast, #toast").filter({ hasText: "Paleta «Tormenta y naranja» aplicada" }).first()).toBeVisible({ timeout: 10_000 });

  // «Sin paleta» la quita
  await paleta.click();
  await hoja.getByRole("radio", { name: /Sin paleta/ }).click();
  await expect(paleta).toContainText("Sin paleta");

  await motor.getByRole("button", { name: "Guardar y volver al chat" }).click();
  await expect(page.locator("p", { hasText: "Cambios del editor guardados, sin gastar IA." })).toBeVisible({ timeout: 30_000 });
});

test("Biblioteca de diseño: se ve desde la bienvenida y el menú, y arma una app sin IA ni app previa", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /¿Qué quieres crear/ })).toBeVisible({ timeout: 60_000 });

  // a la vista en la bienvenida (no confundirla con la de prompts)
  await page.getByTestId("atajo-biblioteca").click();
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#motorEditBar")).toContainText("Biblioteca de diseño", { timeout: 30_000 });
  // la galería de la biblioteca: plantillas, paletas, tipografías…
  await expect(motor.getByRole("heading", { name: /Buen diseño/ })).toBeVisible();
  await expect(motor.getByText("Paletas de color").first()).toBeVisible();
  await expect(motor.getByText("90 diseños").first()).toBeVisible();

  // sin elegir nada no hay app que usar
  await motor.getByRole("button", { name: "Usar en mi chat" }).click();
  await expect(motor.locator("#toast, .toast").filter({ hasText: "Elige al menos un bloque" }).first()).toBeVisible({ timeout: 10_000 });

  // se elige una plantilla y se usa en el chat
  await motor.getByText("Plantillas").first().click();
  await motor.locator("[data-act=use-template]").nth(2).click();
  await motor.getByRole("button", { name: "Usar en mi chat" }).click();
  await expect(page.locator("p", { hasText: "Tu app, armada con los bloques que elegiste, sin gastar IA." })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toBeVisible();
  await expect(page.getByTestId("editar-tinta")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Ver el diseño a pantalla completa/i })).toBeVisible();
  await expect(page.locator('iframe[title="Motor de diseño Tinta"]')).toHaveCSS("pointer-events", "none");
});

test("Biblioteca de diseño: en el menú (Ecosistema) con su nombre, aparte de «Prompts»", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /¿Qué quieres crear/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Ecosistema" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("button", { name: "Biblioteca de diseño" })).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Prompts" })).toBeVisible();
  // ya no hay una «Biblioteca» sin apellidos que se confunda con la de diseño
  await expect(hoja.getByRole("button", { name: "Biblioteca", exact: true })).toHaveCount(0);
  await hoja.getByRole("button", { name: "Biblioteca de diseño" }).click();
  await expect(page.frameLocator('iframe[title="Motor de diseño Tinta"]').locator("#motorEditBar")).toBeVisible({ timeout: 30_000 });
});
