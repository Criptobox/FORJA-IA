import { expect, test } from "./fixtures";

/** Forja IA — Barra de 4 pestañas del kit móvil (solo < lg).
 *
 * Vigila lo que un test unitario no ve: que la barra existe en el móvil, que
 * desaparece en escritorio, que cada pestaña abre lo que promete y que nada se
 * sale por la derecha a 390 px.
 */
test.describe("barra inferior móvil", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (window.top !== window.self) return;
      try {
        localStorage.setItem(
          "forja-ai-v1",
          JSON.stringify({
            state: { sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], skills: [], settings: {}, providers: {}, version: 1 },
            version: 0,
          })
        );
      } catch {
        /* marco sin acceso */
      }
    });
    await page.goto("/");
  });

  test("muestra las cuatro pestañas y no desborda a 390 px", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav).toBeVisible();
    for (const n of ["Crear", "Proyectos", "Modelos", "Ecosistema"]) {
      await expect(nav.getByRole("button", { name: `Pestaña ${n}` })).toBeVisible();
    }
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });

  test("Ecosistema abre la hoja con las herramientas y el selector de tema", async ({ page }) => {
    await page.getByRole("button", { name: "Pestaña Ecosistema" }).click();
    const hoja = page.getByRole("dialog", { name: "Ecosistema Forja IA" });
    await expect(hoja).toBeVisible();
    await expect(hoja.getByRole("button", { name: /Sandbox/ })).toBeVisible();
    await expect(hoja.getByRole("radiogroup", { name: "Tema de la aplicación" })).toBeVisible();
  });

  test("Proyectos abre las conversaciones", async ({ page }) => {
    await page.getByRole("button", { name: "Pestaña Proyectos" }).click();
    await expect(page.getByRole("dialog", { name: "Conversaciones" })).toBeVisible();
  });
});

test("en escritorio la barra inferior no existe", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
});
