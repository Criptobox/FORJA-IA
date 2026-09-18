import { expect, test } from "./fixtures";

/** Forja IA — El código se ejecuta aunque el modo agente esté apagado.
 *
 * Forja ya ejecutaba lo que entregaba… dentro del modo agente. Y el modo
 * agente viene apagado: el caso más común —abres la app, escribes «hazme una
 * página» y te llega el HTML— salía sin ejecutarse ni una vez, y el fallo lo
 * descubrías tú al abrirlo. La comprobación estaba escrita, probada y puesta
 * detrás de un interruptor que casi nadie toca.
 *
 * `mock-codigo-roto` entrega una página que llama a una función inexistente:
 * la consola del iframe suelta un ReferenceError de verdad.
 */

const MODEL_ID = "mock-codigo-roto";

async function seed(page: import("@playwright/test").Page) {
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
            skills: [],
            settings: {
              defaultModelKey: `custom::${model}`,
              accessCode: "",
              agentModes: [],
              // ——— apagado a propósito: es el valor de fábrica ———
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
      /* frame sin acceso */
    }
  }, MODEL_ID);
}

test("sin modo agente, el código también se ejecuta y se corrige solo", async ({ page }) => {
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
  await input.fill("hazme una página");
  await page.keyboard.press("Enter");

  // Los errores de consola vuelven al modelo sin que nadie pulse nada…
  await expect
    .poll(() => cuerpos.filter((c) => c.includes("He ejecutado tu código en el navegador")).length, {
      timeout: 90_000,
    })
    .toBeGreaterThan(0);
  // …con el error tal cual, que es el dato
  expect(cuerpos.find((c) => c.includes("He ejecutado tu código en el navegador"))).toContain(
    "pintarTodo"
  );

  // y la página termina arreglada
  await expect(page.getByText("Corregido tras ejecutarlo.").first()).toBeVisible({
    timeout: 90_000,
  });
});
