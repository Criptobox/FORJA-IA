import { expect, test, type Page } from "@playwright/test";

/** Forja IA — Sin ninguna IA conectada, el chat lo dice EN el chat.
 *
 * Antes solo salía un aviso flotante que se iba solo (y en el móvil quedaba
 * tapado por otro): elegías el diseño, ponía «Construido con…» y no pasaba
 * nada más. Ahora queda un mensaje con el botón para conectar una IA. */
/** Envía lo escrito cuando el botón ya se activó (el chat ya tiene el texto). */
async function enviar(page: Page) {
  const boton = page.getByRole("button", { name: "Enviar mensaje" });
  await expect(boton).toBeEnabled();
  await boton.click();
}

async function seed(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self || localStorage.getItem("forja-ai-v1")) return;
    localStorage.setItem(
      "forja-ai-v1",
      JSON.stringify({
        state: { sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], settings: { defaultModelKey: "forja::web", accessCode: "" }, providers: {}, version: 1 },
        version: 0,
      })
    );
    localStorage.setItem("forja-preview-demo", "1");
  });
}

test("sin IA conectada, una página web sale como web de escritorio completa (no como app de móvil)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1300, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByRole("textbox", { name: "Mensaje" });
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("Hazme una landing para mi barbería llamada Navaja");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("propuesta-diseno")).toHaveCount(0);
  await expect(page.locator("p", { hasText: "sin gastar IA" }).first()).toBeVisible({ timeout: 30_000 });
  // no es una app de Tinta: es una web con sus secciones, en la vista previa
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toHaveCount(0);
  const vista = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(vista.locator("h1")).toBeVisible({ timeout: 30_000 });
  await expect(vista.locator(".logo")).toContainText("Navaja");
  for (const id of ["#catalogo", "#ofertas", "#opiniones", "#contacto"]) await expect(vista.locator(id)).toHaveCount(1);
  // el formulario funciona sin servidor
  await vista.locator("form input").first().fill("Ana");
  const resto = vista.locator("form input");
  const n = await resto.count();
  for (let i = 1; i < n; i++) {
    const tipo = await resto.nth(i).getAttribute("type");
    await resto.nth(i).fill(tipo === "email" ? "ana@correo.com" : tipo === "date" ? "2026-12-01" : tipo === "number" ? "2" : tipo === "tel" ? "600000000" : "algo");
  }
  await vista.locator("form button").click();
  await expect(vista.locator("form .ok")).toContainText("Recibido");
});

test("sin IA conectada, una charla deja el aviso en el chat con el botón para conectarla", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByRole("textbox", { name: "Mensaje" });
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("¿Qué es una API?");
  await page.keyboard.press("Enter");
  await expect(page.locator("p", { hasText: "Para responder eso necesito una IA conectada" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Conectar una IA gratis" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("primera visita: sin ejemplo ni guía encima, FORJA WEB puesta y la bienvenida dice que no hace falta IA", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 860 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /¿Qué quieres crear/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("No hace falta ninguna IA")).toBeVisible();
  await expect(page.getByRole("combobox").first()).toContainText("FORJA WEB");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-role="user"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Activar Auto|Desactivar Auto/ })).toBeHidden();
  await expect(page.locator("aside").getByRole("button", { name: "Más herramientas" })).toHaveAttribute("aria-expanded", "false");
});

test("sin IA, con una app hecha, pedir otra web es un encargo nuevo (sale el equipo), no un cambio", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1300, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByRole("textbox", { name: "Mensaje" });
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app de tienda de ropa");
  await enviar(page);
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toBeVisible({ timeout: 30_000 });

  // otra web: el equipo vuelve a trabajar; no se trata como cambio ni sale el texto de ayuda
  const chat = page.getByRole("textbox", { name: "Mensaje" });
  await chat.fill("Crea una web para una panadería");
  await enviar(page);
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toHaveCount(2, { timeout: 30_000 });
  await expect(page.locator("p", { hasText: "Sin IA conectada entiendo cambios como" })).toHaveCount(0);
  // sin IA no hay modelo escribiendo código: ni avisos de skills ni del modo agente
  await expect(page.getByText(/suele ir mejor con|¿Activar el modo agente\?/)).toHaveCount(0);
  // solo la última app ofrece editar
  await expect(page.getByTestId("editar-tinta")).toHaveCount(1);
});
