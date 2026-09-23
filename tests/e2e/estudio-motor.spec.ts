import { expect, test } from "./fixtures";

/** Forja IA — El Estudio (/forja) con el motor integrado en la app.
 *
 * El motor ya no llega como paquete precompilado sin tipos: se importa desde
 * src/lib/forja/motor. Al tiparlo salieron demos que llamaban a la API vieja
 * (una leía `.texto` de una promesa sin esperarla y enseñaba «undefined»).
 * Aquí se abre cada pestaña y se pulsa cada demo de la pestaña Motor: nada
 * puede lanzar y las dos demos arregladas enseñan su resultado real. */

test("cada pestaña del Estudio carga el motor sin errores", async ({ page }) => {
  test.setTimeout(120_000);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  for (const tab of ["inicio", "ficha", "adn", "jueces", "antigenerico", "motor"]) {
    await page.goto(`/forja?tab=${tab}`);
    await expect(page.getByText(/v\d+\.\d+\.\d+ · motor/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("No se pudo cargar el motor")).toHaveCount(0);
  }
  expect(errores).toEqual([]);
});

test("las demos de la pestaña Motor corren contra la API real del motor", async ({ page }) => {
  test.setTimeout(180_000);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/forja?tab=motor");
  await expect(page.getByRole("button", { name: "Página cortada a mitad" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Página cortada a mitad" }).click();
  await expect(page.getByText(/resultado: página completa, sigue al Revisor SANA/)).toBeVisible();
  await expect(page.getByText(/undefined/)).toHaveCount(0);

  await page.getByRole("button", { name: "Simular un día malo" }).click();
  await expect(page.getByText(/1\. deepseek:chat {2}← primario, intocable/)).toBeVisible();
  // el suplente sano y rápido va antes que el que falló dos veces
  await expect(page.getByText(/2\. zai:glm-4\.7-flash/)).toBeVisible();

  // el resto de demos: ninguna puede lanzar
  const panel = page.getByRole("tabpanel");
  const botones = panel.getByRole("button");
  const n = await botones.count();
  for (let i = 0; i < n; i++) {
    await botones.nth(i).click();
  }
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});
