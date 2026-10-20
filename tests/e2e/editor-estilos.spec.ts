import { expect, test, type Page } from "./fixtures";

/** Forja IA — Editor de estilos: tocar un elemento de la vista previa y
 * cambiar su diseño, o cambiar un token de la página.
 *
 * Se comprueba lo que ve la persona (el estilo computado DENTRO del iframe),
 * antes de guardar —vista en vivo— y después —ya en el código, tras repintar.
 */

async function seed(page: Page) {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem("forja-e2e-sembrado")) return;
      sessionStorage.setItem("forja-e2e-sembrado", "1");
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: { defaultModelKey: "custom::mock-app", accessCode: "", agentModes: [], agentMode: false, ahorro: false, stream: false },
            providers: {
              custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-app"], useProxy: false },
            },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  });
}

async function abrirApp(page: Page) {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("crea una app de lista de tareas");
  await page.keyboard.press("Enter");
  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("#total")).toHaveText("0 tareas", { timeout: 90_000 });
  return marco;
}

const estiloDe = (page: Page, selector: string, prop: string) => async () => {
  const f = await (await page.locator('iframe[title="Vista previa de la página generada"]').elementHandle())?.contentFrame();
  return (await f?.evaluate(([s, p]) => {
    const el = document.querySelector(s);
    return el ? getComputedStyle(el).getPropertyValue(p) : "";
  }, [selector, prop] as const)) ?? "";
};

test("tocar el titular, cambiarle el tamaño y guardarlo en el código", async ({ page }) => {
  test.setTimeout(180_000);
  const marco = await abrirApp(page);

  await page.getByRole("button", { name: "Editar estilos de la vista previa" }).click();
  await marco.locator("h1").click();
  const panel = page.getByLabel("Editor de estilos");
  await expect(panel).toContainText("<h1>");

  await panel.getByLabel("Tamaño de letra").fill("60");
  // en vivo, antes de guardar
  await expect.poll(estiloDe(page, "h1", "font-size")).toBe("60px");
  // tocar el h1 en modo estilo no navega ni dispara nada de la página
  await expect(marco.locator("#total")).toHaveText("0 tareas");

  await panel.getByRole("button", { name: "Guardar en el código" }).click();
  await expect(page.getByText("Estilo guardado en el código")).toBeVisible();
  // tras guardar la página se repinta desde el código: el cambio sigue ahí
  await expect.poll(estiloDe(page, "h1", "font-size"), { timeout: 15_000 }).toBe("60px");
  await expect.poll(async () => {
    const f = await (await page.locator('iframe[title="Vista previa de la página generada"]').elementHandle())?.contentFrame();
    return (await f?.evaluate(() => !!document.querySelector("style[data-forja-ajustes]"))) ?? false;
  }).toBe(true);
});

test("cambiar un token de :root repinta todo lo que lo usa; descartar lo deshace", async ({ page }) => {
  test.setTimeout(180_000);
  await abrirApp(page);

  await page.getByRole("button", { name: "Editar estilos de la vista previa" }).click();
  const panel = page.getByLabel("Editor de estilos");
  const token = panel.getByLabel("Token --acento (valor)");
  await expect(token).toBeVisible({ timeout: 10_000 });

  await token.fill("#112233");
  await expect.poll(estiloDe(page, "h1", "color")).toBe("rgb(17, 34, 51)");

  await panel.getByRole("button", { name: "Descartar" }).click();
  await expect.poll(estiloDe(page, "h1", "color")).toBe("rgb(249, 115, 22)");
});
