import { expect, test } from "./fixtures";

/** Forja IA — FORJA WEB: el preset seleccionable (como Auto) que activa el
 * sistema completo (Cerebro + Knowledge Base + Research + Diseño + Código +
 * QA) para construir webs. Dos cosas se prueban aquí:
 *   1. Aparece en el selector, se activa con un clic y responde (igual que
 *      la prueba de Auto en `router.spec.ts`).
 *   2. Fuerza el catálogo de herramientas (con `kb_search`, la Research en
 *      la Knowledge Base) AUNQUE el interruptor de Ajustes esté apagado:
 *      seleccionarlo ya es la señal de que se quiere el sistema completo.
 */

const PROVIDER_KEY = "test-key-123";

test.describe("FORJA WEB (preset seleccionable)", () => {
  test("aparece en el selector, se activa con un clic y responde con el mock", async ({ page }) => {
    await page.addInitScript(() => {
      const seed = {
        state: {
          sessions: [],
          activeSessionId: null,
          onboardingDone: true,
          favorites: [],
          radarSeenIds: [],
          settings: {
            defaultModelKey: "custom::mock-mini-free",
            systemPrompt: "Eres Forja IA (test).",
            temperature: 0.7,
            maxTokens: null,
            stream: true,
            contextWindow: 10,
            sendKeyOnProxy: true,
            onlyFree: false,
            agentMode: false,
            agentMaxLoops: 3,
            accent: "violeta",
            accentCustom: "#8b5cf6",
            autoSpeak: false,
            accessCode: "",
            compression: "off",
            outputStyle: "normal",
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
      };
      localStorage.setItem("forja-ai-v1", JSON.stringify(seed));
    });

    await page.goto("/");
    const input = page.getByPlaceholder("Escribe tu mensaje…");
    await expect(input).toBeVisible({ timeout: 30_000 });
    await page.getByRole("combobox").first().click();
    await expect(page.getByText(/busca en tu Knowledge Base, diseña/)).toBeVisible();
    await page.getByRole("switch", { name: "Activar FORJA WEB" }).click();
    // el botón del picker muestra FORJA WEB
    await expect(page.getByRole("combobox").first()).toContainText("FORJA WEB");
    await input.fill("Hola FORJA WEB");
    await input.press("Enter");
    await expect(page.getByText(/mock-mini-free/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("fuerza el catálogo de herramientas (con kb_search) aunque el modo agente esté apagado", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key }: { key: string }) => {
        const seed = {
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: {
              defaultModelKey: "forja::web",
              systemPrompt: "Eres Forja IA (test).",
              temperature: 0.7,
              maxTokens: null,
              stream: false,
              contextWindow: 10,
              sendKeyOnProxy: true,
              onlyFree: false,
              agentMode: false, // ← apagado a propósito: FORJA WEB lo fuerza igual
              agentMaxLoops: 3,
              accent: "violeta",
              accentCustom: "#8b5cf6",
              autoSpeak: false,
              accessCode: "",
              compression: "off",
              outputStyle: "normal",
            },
            providers: {
              custom: {
                apiKey: key,
                baseUrl: "/api/mock-llm",
                enabled: true,
                // «-free»: la cadena de candidatos de FORJA WEB (igual que
                // Auto) descarta lo que no pase el filtro de gratis.
                models: ["mock-tools-free"],
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
      { key: PROVIDER_KEY }
    );

    const cuerpos: { messages: { role: string }[]; tools?: unknown; model?: string }[] = [];
    page.on("request", (r) => {
      if (r.method() !== "POST") return;
      if (!r.url().includes("/api/mock-llm/")) return;
      const raw = r.postData();
      if (!raw) return;
      try {
        cuerpos.push(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    });

    await page.goto("/");
    const input = page.locator("textarea").first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill("Construye una landing");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    await expect.poll(() => cuerpos.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);

    const primera = cuerpos.find((c) =>
      c.messages?.some(
        (m) =>
          m.role === "user" &&
          typeof (m as unknown as { content: unknown }).content === "string" &&
          (m as unknown as { content: string }).content.includes("Construye una landing")
      )
    ) ?? cuerpos[0];
    expect(primera.model).toBe("mock-tools-free");
    expect(primera.tools, "FORJA WEB pasa el catálogo aunque agentMode esté apagado").toBeDefined();
    const tools = primera.tools as { type: string; function: { name: string } }[];
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("kb_search");
  });
});
