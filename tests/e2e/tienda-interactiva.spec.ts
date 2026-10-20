import { expect, test, type Page } from "./fixtures";

/** Forja IA — Cuando piden una tienda o un menú, la instrucción de
 * funcionalidad real viaja en el prompt.
 *
 * Reportado por el usuario: al pedir una tienda o el menú de un
 * restaurante, la página salía "a medias" — bonita, pero con un carrito
 * decorativo y un botón de "Pedir" que no hacía nada. La skill de
 * desarrollador web (`skills-data.ts`) nunca pedía que el carrito sumara
 * de verdad, que una tarjeta de producto abriera su detalle, o que el
 * pedido terminara en algo. Se comprueba leyendo lo que VIAJA al modelo,
 * no lo que se ve — igual que `saludo-sin-agente.spec.ts`.
 */

async function sembrar(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            // la skill de desarrollador web va ENCENDIDA — es el default real
            // (skills-data.ts): la instrucción de tienda es una AMPLIACIÓN de
            // esa skill, así que sin ella activa no tiene sentido que viaje.
            skills: [
              {
                id: "skill-web-dev",
                name: "Desarrollador web experto",
                description: "",
                icon: "🌐",
                instructions: "Eres un desarrollador web senior.",
                builtin: true,
                enabled: true,
                kinds: ["web"],
              },
            ],
            settings: {
              // estos specs prueban la CONSTRUCCIÓN; la propuesta de diseño tiene su propio spec
              propuestaDiseno: false,
              defaultModelKey: "custom::mock-mini-free",
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
              piiShield: false,
            },
            providers: {
              custom: {
                apiKey: "k1",
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
    } catch {
      /* marco sin acceso a localStorage */
    }
  });
}

async function ultimoCuerpoEnviado(page: Page, texto: string) {
  const cuerpos: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/mock-llm/")) {
      cuerpos.push(r.postData() ?? "");
    }
  });

  await page.goto("/");
  const compositor = page.locator("textarea").first();
  await expect(compositor).toBeVisible({ timeout: 30_000 });
  await compositor.fill(texto);
  await page.keyboard.press("Enter");

  await expect
    .poll(() => cuerpos.filter((c) => c.includes(texto)).length, { timeout: 30_000 })
    .toBeGreaterThan(0);

  return cuerpos.filter((c) => c.includes(texto))[0];
}

test("pedir una tienda SÍ lleva la instrucción de carrito y detalle de producto que funcionan", async ({
  page,
}) => {
  await sembrar(page);
  const enviado = await ultimoCuerpoEnviado(page, "hazme una tienda online de zapatillas");

  expect(enviado, "exige el carrito funcional").toContain("carrito");
  expect(enviado, "exige checkout que termina").toMatch(/checkout/i);
  expect(enviado, "exige reseñas").toMatch(/rese/i);
});

test("pedir el menú de un restaurante también la lleva", async ({ page }) => {
  await sembrar(page);
  const enviado = await ultimoCuerpoEnviado(page, "quiero el menú de mi restaurante de comida italiana");

  expect(enviado).toMatch(/CLICABLE/);
});

test("una landing normal NO la lleva: pedir carrito a un portfolio sería ruido", async ({ page }) => {
  await sembrar(page);
  const enviado = await ultimoCuerpoEnviado(page, "hazme un portfolio para mi fotografía");

  expect(enviado, "sin la instrucción de tienda").not.toContain("Esto es una tienda");
});
