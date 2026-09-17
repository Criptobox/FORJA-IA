import { expect, test, type Page } from "./fixtures";

/** Forja IA — La ventana de referencia usa un dato REAL cuando ya lo hay.
 *
 * `recorte-proactivo.spec.ts` prueba el recorte con una ventana CONFIGURADA
 * pequeña (`ventanaCtx: 1000`). Esto prueba el caso distinto: la ventana
 * configurada es la de siempre (32k, generosa), pero `limites-medidos.ts`
 * YA aprendió —de un rechazo real del proveedor, no de una suposición— que
 * ESTE modelo admite mucho menos. Sin `ventanaReferencia()`, el recorte
 * proactivo (v4.14.0) seguiría confiando en la ventana genérica y no
 * dispararía hasta muy tarde, aunque Forja ya supiera que este modelo
 * no llega ahí.
 */

function sesionMediana() {
  const gordo = (n: number, letra: string) => letra.repeat(n);
  const mensajes: { id: string; role: string; content: string; createdAt: number }[] = [];
  for (let i = 0; i < 6; i++) {
    mensajes.push({
      id: `u${i}`,
      role: "user",
      content: `pregunta vieja ${i} ${gordo(400, "a")}`,
      createdAt: 1,
    });
    mensajes.push({
      id: `a${i}`,
      role: "assistant",
      content: `respuesta vieja ${i} ${gordo(400, "b")}`,
      createdAt: 2,
    });
  }
  return {
    id: "s1",
    title: "mediana",
    createdAt: 1,
    updatedAt: 2,
    modelKey: "custom::mock-mini-free",
    messages: mensajes,
  };
}

async function seed(page: Page) {
  await page.addInitScript((sesion: unknown) => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "prism-ai-v1",
        JSON.stringify({
          state: {
            sessions: [sesion],
            activeSessionId: "s1",
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            skills: [],
            settings: {
              defaultModelKey: "custom::mock-mini-free",
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
              piiShield: false,
              onlyFree: false,
              contextWindow: 0,
              // la ventana CONFIGURADA es la genérica de siempre: con ella
              // sola, los ~950 tokens estimados de esta sesión (misma
              // conversación que usa recorte-proactivo.spec.ts) no llegan ni
              // de lejos a zona roja (95% de 32.000 = 30.400).
              ventanaCtx: 0,
            },
            providers: {
              custom: {
                apiKey: "test-key-123",
                baseUrl: "/api/mock-llm",
                enabled: true,
                models: ["mock-mini-free"],
                useProxy: false,
              },
            },
            version: 1,
          },
          version: 0,
        })
      );
      // Lo que Forja YA sabe de este modelo por un rechazo real anterior:
      // admite 1.000 tokens de entrada. Con eso, los ~950 estimados de la
      // conversación sembrada SÍ caen en zona roja (95% de 1.000 = 950).
      localStorage.setItem(
        "prism-limites-v1",
        JSON.stringify({
          state: { limites: { "custom::mock-mini-free": { limite: 1000, rechazado: 1000, at: Date.now() } } },
          version: 0,
        })
      );
      localStorage.removeItem("prism-modelos-rotos-v1");
    } catch {
      /* marco sin acceso */
    }
  }, sesionMediana());
}

test("con un tope real ya aprendido para el modelo, el recorte proactivo usa ESE, no la ventana genérica", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page);

  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) {
      cuerpos.push(r.postData() ?? "");
    }
  });

  await page.goto("/");
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill("que hacemos");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  // Se dispara con el tope APRENDIDO (1.000), no con el genérico (32.000):
  // con el genérico esta conversación nunca habría llegado a zona roja.
  await expect(page.getByText("Historial recortado antes de enviar")).toBeVisible({
    timeout: 30_000,
  });

  await expect(page.locator("main").getByText("funcionando con tu API")).toBeVisible({
    timeout: 90_000,
  });

  expect(cuerpos.length).toBeGreaterThan(0);
  const primera = JSON.parse(cuerpos[0]) as { messages?: { content?: unknown }[] };
  const totalChars = (primera.messages ?? []).reduce(
    (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
    0
  );
  // 1.000 tokens del tope aprendido × 4 chars/token, con margen de sobra.
  expect(totalChars).toBeLessThan(1000 * 4);
});
