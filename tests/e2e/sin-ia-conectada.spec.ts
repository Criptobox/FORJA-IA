import { expect, test, type Page } from "@playwright/test";

/** Forja IA — Sin ninguna IA conectada, el chat lo dice EN el chat.
 *
 * Antes solo salía un aviso flotante que se iba solo (y en el móvil quedaba
 * tapado por otro): elegías el diseño, ponía «Construido con…» y no pasaba
 * nada más. Ahora queda un mensaje con el botón para conectar una IA. */
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

test("una landing sin IA conectada deja el aviso en el chat con el botón para conectarla", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByRole("textbox", { name: "Mensaje" });
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("Hazme una landing para mi barbería");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Construir/ }).first().click();
  await expect(page.locator("p", { hasText: "Para crear necesito una IA conectada" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Conectar una IA gratis" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("una app con FORJA WEB sin IA conectada también lo dice, con el botón", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await seed(page);
  await page.goto("/");
  const caja = page.getByRole("textbox", { name: "Mensaje" });
  await expect(caja).toBeVisible({ timeout: 60_000 });
  await caja.fill("hazme una app para mi cafetería con pedidos");
  await page.keyboard.press("Enter");
  await expect(page.locator("p", { hasText: /No pude diseñar la app: No hay modelos conectados/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Conectar una IA gratis" })).toBeVisible();
});
