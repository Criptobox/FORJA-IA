import { expect, test } from "./fixtures";

/** Forja IA — El modelo devuelve el filtro de seguridad, no la respuesta.
 *
 * Caso real reportado por el usuario en FORJA WEB: pidió una web para una
 * barbería y la burbuja mostró literalmente "User Safety: safe" — y en el
 * turno siguiente, "User Safety: safeResponse Safety: safe" (dos avisos
 * pegados, sin separador visible). Nunca llegó ni una línea de HTML.
 *
 * La causa: eso no está vacío, así que el chequeo de "respuesta vacía" no
 * lo cogía — se contaba como éxito y se enseñaba tal cual, como si fuera
 * la web pedida.
 *
 * `mock-filtro-seguridad` devuelve exactamente ese texto.
 */

const PROVIDER_KEY = "test-key-123";
const MODEL_ID = "mock-filtro-seguridad";

async function seed(page: import("@playwright/test").Page) {
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
    { model: MODEL_ID, key: PROVIDER_KEY }
  );
}

test("un filtro de seguridad sin contenido se explica, no se enseña como si fuera la respuesta", async ({
  page,
}) => {
  await seed(page);
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
