import { expect, test } from "@playwright/test";

/** Forja IA — Cabecera del chat en el móvil con FORJA WEB.
 *
 * Con FORJA WEB puesto y «Ver diseño» a la vista, el selector se encogía y
 * «Auto» se pintaba encima de «FORJA WEB» (captura del usuario en un móvil de
 * ~410 px). Ahora: en el móvil «Auto» no sale con FORJA WEB, y el selector
 * dice «Web» (o solo el icono en los más estrechos) sin pisar nada. */
for (const ancho of [320, 360, 412]) {
  test(`a ${ancho} px nada se pisa en la cabecera`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 860 });
    await page.addInitScript(() => {
      if (window.top !== window.self || localStorage.getItem("forja-ai-v1")) return;
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: { sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], settings: { defaultModelKey: "forja::web", accessCode: "" }, providers: {}, version: 1 },
          version: 0,
        })
      );
    });
    await page.goto("/?demo=preview");
    const ver = page.getByRole("button", { name: /Ver el diseño a pantalla completa/i });
    await expect(ver).toBeVisible({ timeout: 60_000 });
    await expect(ver).toContainText("Ver diseño");
    await expect(page.getByRole("button", { name: /Activar Auto|Desactivar Auto/ })).toBeHidden();
    const selector = page.getByRole("combobox").first();
    const caja = (await selector.boundingBox())!;
    const botonVer = (await ver.boundingBox())!;
    expect(caja.x + caja.width).toBeLessThanOrEqual(botonVer.x);
    // el texto del selector cabe en su caja (no se sale por encima de lo de al lado)
    const sale = await selector.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(sale).toBe(false);
    if (ancho >= 360) await expect(selector).toContainText("Web");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
  });
}
