import { expect, test, type Page } from "./fixtures";

/** Prism AI — El QA por visión: `visual_review`.
 *
 * Hasta ahora el QA visual solo MEDÍA el DOM (scroll, texto pequeño,
 * contraste calculado, señas de página genérica) — nunca VIO la página,
 * así que ningún problema puramente visual (jerarquía, composición, "esto
 * se ve raro") podía cazarse.
 *
 * `visual_review` cierra eso: renderiza el proyecto en un sandbox oculto,
 * captura la página YA PINTADA de verdad (`screenshot.ts`, técnica
 * SVG+foreignObject+canvas — sin librería, sin red) y se la enseña al
 * MISMO modelo de la conversación (si admite imágenes) para que la
 * critique. Es una herramienta bajo demanda del agente, no un paso del
 * bucle de auto-revisión: informa, no reintenta sola.
 *
 * `mock-visual-review` escribe una página y pide la crítica; el mock
 * responde a la llamada de visión (interna, con la imagen adjunta) con un
 * texto fijo que se puede comprobar. `mock-visual-review-sin-vision` es la
 * misma escena pero el modelo "rechaza" la imagen, como haría un proveedor
 * real: comprueba que la herramienta lo dice en vez de fingir una crítica.
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
            settings: {
              defaultModelKey: `custom::${m}`,
              accessCode: "",
              agentModes: [],
              agentMode: true,
              agentMaxLoops: 4,
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

test("el agente captura la página y lee la crítica de un modelo con visión", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, "mock-visual-review");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("revisa visualmente el hero de mi tienda");
  await page.keyboard.press("Enter");

  const burbuja = page.locator("main p", { hasText: "Crítica visual" });
  await expect(burbuja).toBeVisible({ timeout: 90_000 });

  const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  // la crítica de verdad llegó al chat, no un hueco vacío
  expect(texto).toContain("El botón principal casi no se distingue del fondo");
});

test("si el modelo activo no admite imágenes, lo dice y no finge una crítica", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, "mock-visual-review-sin-vision");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("revisa visualmente el hero de mi tienda");
  await page.keyboard.press("Enter");

  const burbuja = page.locator("main p", { hasText: "Crítica visual" });
  await expect(burbuja).toBeVisible({ timeout: 90_000 });

  const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  expect(texto).toContain("no admite imágenes");
  expect(texto).not.toContain("El botón principal casi no se distingue del fondo");
});
