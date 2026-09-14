import { expect, test, type Page } from "./fixtures";

/** Prism AI — «Proyecto para un repo» pide varios archivos, no un HTML solo.
 *
 * Hallazgo de dogfooding: la skill «Desarrollador web experto» manda
 * SIEMPRE un único archivo HTML autónomo, sin excepción — ni cuando se pide
 * explícitamente «un proyecto para un repo». `pideVariosArchivos` detecta
 * esa intención y `INSTRUCCION_VARIOS_ARCHIVOS` amplía la skill SOLO en ese
 * caso; el resto de encargos (landing, app, juego) se quedan en un solo
 * archivo, que es lo que hace que la vista previa en vivo funcione sin
 * fricción.
 */

async function seed(page: Page, model: string) {
  await page.addInitScript((m: string) => {
    try {
      localStorage.setItem("prism-preview-demo", "1");
      localStorage.setItem(
        "prism-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            // Sin «skills» aquí a propósito: las demás pruebas seedean `[]`
            // porque no les importa, pero ESTA depende de que la skill
            // integrada «Desarrollador web experto» siga activa (como en un
            // usuario real recién instalado) para poder comprobar que la
            // excepción se le añade de verdad. El `merge` del store solo
            // sustituye lo que el JSON persistido trae — omitir la clave
            // deja los valores por defecto (las builtin, activas) tal cual.
            settings: {
              defaultModelKey: `custom::${m}`,
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
            },
            providers: {
              custom: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: [m],
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
  }, model);
}

test("«un proyecto para un repo» entrega index.html, styles.css y app.js separados", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page, "mock-proyecto-repo");
  await page.setViewportSize({ width: 1440, height: 900 });

  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) {
      cuerpos.push(r.postData() ?? "");
    }
  });

  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme un proyecto para un repo de una cafetería");
  await page.keyboard.press("Enter");

  // la instrucción de excepción viaja de verdad en el prompt…
  await expect
    .poll(() => cuerpos.some((c) => c.includes("Excepción: aquí se pide un PROYECTO")), {
      timeout: 30_000,
    })
    .toBe(true);

  // …y el modelo, al seguirla, entrega los tres archivos separados
  const descargar = page.getByRole("button", { name: "Descargar lo creado" });
  await expect(descargar).toBeVisible({ timeout: 90_000 });
  await descargar.click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("index.html");
  await expect(menu).toContainText("styles.css");
  await expect(menu).toContainText("app.js");
  await page.keyboard.press("Escape");
});

test("una landing normal NO dispara la excepción: sigue siendo un único archivo", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page, "mock-proyecto-repo");
  await page.setViewportSize({ width: 1440, height: 900 });

  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) {
      cuerpos.push(r.postData() ?? "");
    }
  });

  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing para mi cafetería");
  await page.keyboard.press("Enter");

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("h1")).toHaveText("Todo en uno", { timeout: 90_000 });

  expect(cuerpos.some((c) => c.includes("Excepción: aquí se pide un PROYECTO"))).toBe(false);
});
