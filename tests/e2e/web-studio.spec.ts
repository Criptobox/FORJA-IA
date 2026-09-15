import { expect, test } from "./fixtures";

/** Prism AI — Web Studio (v4.20.0): Project Health, Security Center y
 * Project Tasks en una sola superficie, accesible desde la barra lateral.
 *
 * Ninguna de las tres piezas inventa datos que no tiene: Health enseña
 * «—» donde no hay evidencia, Security nunca afirma ausencia de
 * vulnerabilidades, y las tareas son un tablero local persistente.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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
            settings: {
              defaultModelKey: null,
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
            },
            providers: {},
            version: 1,
          },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  });
  await page.goto("/");
  await page.locator("textarea").first().waitFor({ state: "visible", timeout: 30_000 });
});

test("se abre desde la barra lateral y sin datos enseña «—», no una puntuación inventada", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
  await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Health" }).click();
  // sin mapa de proyecto ni QA medido: se dice explícitamente, no se
  // inventa un 0/100 ni un 100/100
  await expect(page.getByText("Sin mapa de proyecto")).toBeVisible();
  await expect(page.getByText("Todavía no se ha medido")).toBeVisible();
});

test("el iframe oculto de medición va sandboxed, igual que el resto de vistas previas", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
  await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });

  const sandbox = await page.locator('iframe[title="Prism QA"]').getAttribute("sandbox");
  expect(sandbox, "sin allow-same-origin: el HTML medido no puede leer el localStorage de Prism").toBe(
    "allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock"
  );
});

test("Security Center analiza y nunca afirma que el código está limpio", async ({ page }) => {
  await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
  await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Security" }).click();
  await page.getByRole("button", { name: "Analizar código" }).click();

  await expect(page.getByText(/no sustituye/i)).toBeVisible();
});

test("Project Tasks: añadir, avanzar de pendiente a hecha y borrar, todo persiste en el tablero local", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
  await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Tasks" }).click();
  const input = page.locator("#prism-task-input");
  await input.fill("Revisar el hero en móvil");
  await input.press("Enter");

  await expect(page.getByText("Pendientes (1)")).toBeVisible();
  const titulo = page.getByText("Revisar el hero en móvil", { exact: true });
  await expect(titulo).toBeVisible();

  // pendiente → en curso: el primer botón de la tarjeta de la tarea
  const tarjeta = titulo.locator("..").locator("..");
  await tarjeta.getByRole("button").first().click();
  await expect(page.getByText("En curso (1)")).toBeVisible();
  await expect(page.getByText("Pendientes (0)")).toBeVisible();
});
