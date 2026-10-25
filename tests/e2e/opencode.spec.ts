import { expect, test } from "./fixtures";

/** «OpenCode» dentro de Forja: catálogo gratis vivo, conectar una vez y elegir.
 *  El catálogo y la comprobación de clave se simulan: no se toca la red real. */
test("OpenCode: veo los gratis de hoy, conecto mi clave y uso uno", async ({ page }) => {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: { sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], skills: [], settings: {}, version: 1 },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  });
  await page.route("**/api/opencode-catalog", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        live: true,
        fetchedAt: new Date().toISOString(),
        models: [
          { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free", context: 1_000_000 },
          { id: "mimo-v2.5-free", name: "MiMo V2.5 Free", context: 256_000 },
        ],
      }),
    })
  );
  // la comprobación de la clave lista modelos por el proxy de Forja
  await page.route("**/api/proxy**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "deepseek-v4-flash-free" }, { id: "mimo-v2.5-free" }] }) })
  );

  await page.goto("/");
  await page.getByRole("button", { name: "OpenCode", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: /OpenCode/ });
  await expect(dialogo.getByText("DeepSeek V4 Flash Free")).toBeVisible({ timeout: 15_000 });
  await expect(dialogo.getByText("MiMo V2.5 Free")).toBeVisible();
  // sin cuenta conectada no se puede usar todavía
  await expect(dialogo.getByRole("button", { name: "Usar mimo-v2.5-free" })).toBeDisabled();

  await dialogo.getByLabel("Clave de OpenCode").fill("clave-falsa-de-prueba-1234");
  await dialogo.getByRole("button", { name: "Conectar" }).click();
  await expect(dialogo.getByText("Cuenta de OpenCode conectada")).toBeVisible({ timeout: 15_000 });

  await dialogo.getByRole("button", { name: "Usar mimo-v2.5-free" }).click();
  await expect(page.getByRole("dialog", { name: /OpenCode/ })).toHaveCount(0);
  await expect(page.getByRole("combobox").first()).toContainText("mimo-v2.5-free");
});
