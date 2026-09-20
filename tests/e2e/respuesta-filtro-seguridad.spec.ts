import { expect, test } from "./fixtures";

/** Forja IA — El modelo devuelve el filtro de seguridad, no la respuesta.
 *
 * Caso real reportado por el usuario en FORJA WEB, en tres capturas
 * seguidas: pidió una web para una barbería y la burbuja mostró
 * literalmente "User Safety: safe" — luego "User Safety:
 * safeResponse Safety: safe" (dos avisos pegados, sin separador) — y
 * tras el primer arreglo, SIGUIÓ colando en una tercera forma:
 * `{"User Safety": "safe", "Response Safety": "safe"}` en JSON. Nunca
 * llegó ni una línea de HTML en ninguna de las tres.
 *
 * La causa de fondo: eso no está vacío, así que el chequeo de
 * "respuesta vacía" no lo cogía — se contaba como éxito y se enseñaba
 * tal cual, como si fuera la web pedida. La variante JSON coló en el
 * primer arreglo porque la comilla de cierre justo después de "Safety"
 * (antes de los dos puntos) rompía el patrón, que solo esperaba texto
 * plano.
 *
 * `mock-filtro-seguridad` y `mock-filtro-seguridad-json` devuelven,
 * cada uno, una de las formas reales vistas.
 */

const PROVIDER_KEY = "test-key-123";

async function seed(page: import("@playwright/test").Page, model: string) {
  await page.addInitScript(
    ({ model, key }: { model: string; key: string }) => {
      const seed = {
        state: {
          sessions: [],
          activeSessionId: null,
          onboardingDone: true,
          favorites: [],
          radarSeenIds: [],
          settings: {
            defaultModelKey: `custom::${model}`,
            systemPrompt: "Eres Forja IA (test).",
            temperature: 0.7,
            maxTokens: null,
            stream: false,
            contextWindow: 10,
            sendKeyOnProxy: true,
            onlyFree: false,
            agentMode: false,
            agentMaxLoops: 3,
            accent: "violeta",
            accentCustom: "#8b5cf6",
            autoSpeak: false,
            accessCode: "",
          },
          providers: {
            custom: {
              apiKey: key,
              baseUrl: "/api/mock-llm",
              enabled: true,
              models: [model],
              useProxy: false,
            },
          },
          version: 1,
        },
        version: 0,
      };
      try {
        localStorage.setItem("forja-ai-v1", JSON.stringify(seed));
        localStorage.setItem("forja-preview-demo", "1");
      } catch {
        /* frame sin acceso */
      }
    },
    { model, key: PROVIDER_KEY }
  );
}

for (const model of ["mock-filtro-seguridad", "mock-filtro-seguridad-json"]) {
  test(`un filtro de seguridad sin contenido (${model}) se explica, no se enseña como si fuera la respuesta`, async ({
    page,
  }) => {
    await seed(page, model);
    await page.goto("/");

    const input = page.locator("textarea").first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill("Crea una web para una barbería");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    // El usuario tiene que enterarse de qué pasó de verdad, no leer "User
    // Safety: safe" sin más como si fuera su página. El aviso SÍ puede citar
    // el texto exacto entre comillas (para que se reconozca la próxima vez):
    // lo que no puede pasar es que la burbuja sea solo eso, sin explicación.
    await expect(
      page.getByText("solo la comprobación de seguridad", { exact: false }).first()
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Prueba otro modelo", { exact: false }).first()).toBeVisible();
  });
}
