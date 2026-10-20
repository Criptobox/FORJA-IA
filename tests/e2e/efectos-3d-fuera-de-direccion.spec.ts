import { expect, test, type Page } from "./fixtures";

/** Forja IA — El motor 3D, solo donde su dirección lo permite.
 *
 * Quedó anotado en el worklog de v4.10.0: "Nadie comprueba que el modelo
 * use el motor 3D solo en «experimental». Igual que con la lista negra de
 * efectos 2D: el prompt lo prohíbe en las otras cinco direcciones, pero si
 * un modelo lo mete igual, la página se publica tal cual."
 *
 * `mock-3d-mal-puesto` enlaza el motor 3D en una landing pedida
 * explícitamente "minimalista" (dirección "minimal", que lo prohíbe).
 * Forja lo mide en la página ya pintada y se lo devuelve al modelo por el
 * mismo camino que las señas de página genérica.
 */

const MODEL_ID = "mock-3d-mal-puesto";

async function seed(page: Page) {
  await page.addInitScript((model: string) => {
    try {
      localStorage.setItem("forja-preview-demo", "1");
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: {
              // estos specs prueban la CONSTRUCCIÓN; la propuesta de diseño tiene su propio spec
              propuestaDiseno: false,
              defaultModelKey: `custom::${model}`,
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
                models: [model],
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
  }, MODEL_ID);
}

test("el motor 3D en una landing minimalista se detecta y se le pide quitarlo", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
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
  // "minimalista" fuerza la dirección "minimal" (capa 1 de elegirDireccion):
  // sin esto, la rotación determinista podría caer en "experimental", que sí
  // permite el motor 3D, y la prueba no probaría nada.
  await input.fill("hazme una landing minimalista para mi tienda");
  await page.keyboard.press("Enter");

  // Forja se lo devuelve al modelo sin que nadie pulse nada… «motor 3D» ya
  // no sirve de marcador: `senasEfectosFueraDeDireccion` se generalizó para
  // 2D y 3D a la vez (v4.12.0) y el texto ahora es neutro, solo nombra los
  // ids reales — el marcador fiable es la apertura de `promptDeGenerico`.
  await expect
    .poll(() => cuerpos.filter((c) => c.includes("y la he medido")).length, { timeout: 90_000 })
    .toBeGreaterThan(0);

  const aviso = cuerpos.find((c) => c.includes("y la he medido")) ?? "";
  expect(aviso, "nombra el efecto 3D visto de verdad").toContain("3d-malla");
  expect(aviso, "nombra la dirección que lo prohíbe").toContain("minimal");

  // …y el modelo, corregido, entrega la página sin el motor 3D
  await expect(page.getByText("Quitado el motor 3D.").first()).toBeVisible({ timeout: 90_000 });
  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("canvas[data-fx3d]")).toHaveCount(0);
});

test("en una dirección experimental, el motor 3D NO se toca", async ({ page }) => {
  test.setTimeout(180_000);
  // Reutiliza `mock-3d` (ya existente, sin lógica de corrección: siempre
  // enlaza el motor 3D) forzando la dirección "experimental" por palabra
  // clave — ahí el motor 3D está permitido, así que no debería salir
  // ninguna corrección.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("forja-preview-demo", "1");
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: {
              // estos specs prueban la CONSTRUCCIÓN; la propuesta de diseño tiene su propio spec
              propuestaDiseno: false,
              defaultModelKey: "custom::mock-3d",
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
                models: ["mock-3d"],
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
  });
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
  await input.fill("hazme una landing experimental para una agencia premiada");
  await page.keyboard.press("Enter");

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("canvas[data-fx3d]")).toBeAttached({ timeout: 90_000 });
  await page.waitForTimeout(3000);
  // «motor 3D» a secas no sirve de marcador aquí: el propio prompt de
  // sistema de la dirección "experimental" ya menciona esas palabras al
  // describirse a sí misma («El motor 3D solo si el encargo lo pide de
  // verdad…»), así que aparecería aunque no se hubiera corregido nada. El
  // marcador de una corrección de verdad es el encabezado que solo pone
  // `promptDeGenerico` al devolver algo medido en la página ya pintada.
  expect(cuerpos.filter((c) => c.includes("y la he medido"))).toHaveLength(0);
});
