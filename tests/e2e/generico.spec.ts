import { expect, test, type Page } from "./fixtures";

/** Prism AI — Que «no parezca hecha por una IA» se MIDA.
 *
 * Prism traía una checklist anti-slop de cinco puntos que se autoevaluaba el
 * propio modelo. La nota era siempre buena, claro. Es el mismo fallo de fondo
 * que el resto del proyecto: un dato que nadie comprueba.
 *
 * `mock-generica` entrega la página de manual de un generador —Lorem ipsum,
 * tres tarjetas clonadas, un solo tamaño de letra, la fuente del sistema y un
 * hero centrado con su botón—. Prism la abre, la mide y se la devuelve.
 */

const MODEL_ID = "mock-generica";

async function seed(page: Page) {
  await page.addInitScript((model: string) => {
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
            skills: [],
            settings: {
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

test("una página genérica se mide y vuelve al modelo con qué arreglar", async ({ page }) => {
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
  await input.fill("hazme una landing");
  await page.keyboard.press("Enter");

  // Prism se lo devuelve al modelo sin que nadie pulse nada…
  await expect
    .poll(() => cuerpos.filter((c) => c.includes("señas de página genérica")).length, {
      timeout: 90_000,
    })
    .toBeGreaterThan(0);

  const aviso = cuerpos.find((c) => c.includes("señas de página genérica")) ?? "";
  // …citando lo que ha visto de verdad en la página pintada
  expect(aviso, "el relleno, citado").toContain("Lorem ipsum");
  expect(aviso, "las tarjetas clonadas").toMatch(/tarjetas idénticas/i);
  expect(aviso, "y qué hacer con cada cosa").toContain("→");

  // y la página termina pulida
  await expect(page.getByText("Corregido tras medirla.").first()).toBeVisible({ timeout: 90_000 });
});

test("si se acaban los intentos y SIGUE genérica, se dice en vez de callarse", async ({ page }) => {
  test.setTimeout(180_000);
  // Dogfooding v4.10.x: en la última pasada permitida (revisiones al tope de
  // MAX_REVISIONES) la respuesta final ni se llegaba a comprobar — el bucle
  // se rendía en silencio y la página quedaba genérica sin que nadie lo
  // dijera. `mock-generica-terca` nunca mejora, así que agota el tope.
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
            skills: [],
            settings: {
              defaultModelKey: "custom::mock-generica-terca",
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
                models: ["mock-generica-terca"],
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
  await input.fill("hazme una landing");
  await page.keyboard.press("Enter");

  // el aviso final tiene que aparecer — antes de este arreglo, no salía nada
  await expect(page.getByText("Sigue pareciendo genérica")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/se acabaron los intentos autom/i)).toBeVisible();

  // y el bucle se paró de verdad: exactamente 2 correcciones pedidas, no 3
  // (que sería seguir intentando) ni 1 (que sería no haber llegado al tope)
  await page.waitForTimeout(1000);
  const correcciones = cuerpos.filter((c) => c.includes("señas de página genérica")).length;
  expect(correcciones).toBe(2);
});

test("una página que ya está bien no se toca", async ({ page }) => {
  test.setTimeout(180_000);
  // Un medidor que siempre encuentra algo gasta una vuelta de corrección en
  // cada entrega y acaba ignorándose. `mock-efectos` entrega una página
  // pequeña y sin señas: no puede disparar la corrección.
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
            skills: [],
            settings: {
              defaultModelKey: "custom::mock-efectos",
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
                models: ["mock-efectos"],
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

  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) {
      cuerpos.push(r.postData() ?? "");
    }
  });

  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("hazme una landing");
  await page.keyboard.press("Enter");

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator("h1").first()).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(4000);
  expect(cuerpos.filter((c) => c.includes("señas de página genérica"))).toHaveLength(0);
});
