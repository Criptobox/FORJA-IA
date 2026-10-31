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

  test("el panel Proyectos solo trae conversaciones, sin herramientas duplicadas ni doble X", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pestaña Proyectos" }).click();
    const panel = page.getByRole("dialog", { name: "Conversaciones" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: /Nueva conversación/ })).toBeVisible();
    // las herramientas viven solo en Ecosistema
    for (const n of ["Sandbox", "Web Studio", "Panel", "Radar", "Ajustes"]) {
      await expect(panel.getByRole("button", { name: n, exact: true })).toHaveCount(0);
    }
    // un único botón de cerrar
    await expect(panel.getByRole("button", { name: /cerrar|close/i })).toHaveCount(1);
  });

  test("Web Studio en móvil va por páginas, a pantalla completa y sin desbordes", async ({ page }) => {
    await page.getByRole("button", { name: "Pestaña Ecosistema" }).click();
    await page.getByRole("button", { name: "Web Studio", exact: true }).click();
    const dialogo = page.getByRole("dialog", { name: /Forja Web Studio/ });
    await expect(dialogo).toBeVisible();
    // El diálogo entra con zoom (95 % → 100 %): medido de una vez salía 384-389
    // según el fotograma. Se espera a que el ancho se asiente, sin aflojar el 390.
    await expect
      .poll(async () => Math.round((await dialogo.boundingBox())?.width ?? 0))
      .toBe(390);
    // el brief está a la vista sin apilar antes las tarjetas de estado
    await expect(dialogo.getByText("Brief del trabajo")).toBeInViewport();
    // el flujo es su propia página
    await dialogo.getByRole("tab", { name: "Flujo" }).click();
    await expect(dialogo.getByText("Proyecto → resultado").locator("visible=true")).toHaveCount(1);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });
});

test("en escritorio la barra inferior no existe", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
});
