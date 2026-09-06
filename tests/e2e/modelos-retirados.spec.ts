import { expect, test, type Page } from "./fixtures";

/** Prism AI — Que un modelo muerto se vea muerto ANTES del 404.
 *
 * La app llegó a ofrecer ocho modelos que sus proveedores ya habían retirado
 * —uno desde diciembre de 2025— sin ninguna señal: elegías uno, la petición
 * volvía con un 404 y parecía culpa de tu clave.
 */

async function seed(page: Page, modelos: string[]) {
  await page.addInitScript((modelos: string[]) => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "prism-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            skills: [],
            settings: {
              defaultModelKey: `xai::${modelos[0]}`,
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
              piiShield: false,
              onlyFree: false,
            },
            providers: {
              xai: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: modelos,
                useProxy: false,
              },
            },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  }, modelos);
}

test("un modelo retirado sale marcado en el selector", async ({ page }) => {
  test.setTimeout(120_000);
  // «grok-3» consta retirado el 2026-05-15 en el catálogo que trae la app.
  await seed(page, ["grok-3", "grok-4.6"]);
  await page.goto("/");

  await page.getByRole("combobox").first().click();
  const opcion = page.getByRole("option").filter({ hasText: "grok-3" }).first();
  await expect(opcion).toBeVisible({ timeout: 20_000 });
  await expect(opcion, "el muerto lleva su marca").toContainText("retirado");

  // y el vivo no lleva ninguna: un aviso que sale siempre se deja de leer
  const vivo = page.getByRole("option").filter({ hasText: "grok-4.6" }).first();
  await expect(vivo).toBeVisible();
  await expect(vivo).not.toContainText("retirado");
});

/* La segunda comprobación —«ninguna lista de fábrica ofrece un modelo
 * muerto»— vivía aquí y se ha quitado a propósito. Necesitaba arrancar la app
 * sin modelo elegido, y así el selector ni se pinta: la prueba acababa
 * midiendo la siembra en vez de la lista. Esa invariante la comprueba
 * `tests/unit/modelos-viejos.test.ts` recorriendo PROVIDERS de verdad, y es la
 * que destapó `qwen/qwen3-32b`, retirado el 2026-07-17, que ni mi propio
 * script de auditoría había visto. Una prueba que hay que retorcer para que
 * corra vale menos que la de al lado que ya falla cuando toca.
 */
