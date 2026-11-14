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

test("sin IA conectada, una landing la hace Tinta con el equipo y se cambia en el chat", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1300, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByRole("textbox", { name: "Mensaje" });
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("Hazme una landing para mi barbería");
  await page.keyboard.press("Enter");
  // sin propuesta que luego no se puede construir: directo al equipo
  await expect(page.getByTestId("propuesta-diseno")).toHaveCount(0);
  const motor = page.frameLocator('iframe[title="Motor de diseño Tinta"]');
  await expect(motor.locator("#equipoDialog[open] .ag").first()).toBeVisible({ timeout: 60_000 });
  await motor.locator("[data-eq=speed]").click();
  await expect(motor.locator("#eqChoose.on")).toBeVisible({ timeout: 30_000 });
  await motor.locator("#eqGo").click();
  await expect(page.locator("p", { hasText: /Listo: \d+ pantallas?/ })).toBeVisible({ timeout: 30_000 });
  // un cambio que se entiende sin IA
  const chat = page.getByRole("textbox", { name: "Mensaje" });
  await chat.fill("ponla en azul y en modo oscuro");
  await enviar(page);
  await expect(page.locator("p", { hasText: /Hecho, sin gastar IA: modo oscuro · paleta/ })).toBeVisible({ timeout: 30_000 });
  // uno que no: dice qué se puede pedir, con el botón para conectar una IA
  await chat.fill("hazla más divertida para niños");
  await enviar(page);
  await expect(page.locator("p", { hasText: "Sin IA conectada entiendo cambios como" })).toBeVisible({ timeout: 30_000 });
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
