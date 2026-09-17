import { expect, test, type Page } from "./fixtures";

/** Forja IA — Los efectos 2D, solo donde su dirección los permite.
 *
 * La mitad 2D de la misma comprobación que ya existe para el motor 3D
 * (`efectos-3d-fuera-de-direccion.spec.ts`): `senasEfectosFueraDeDireccion`
 * (antes `senasEfectos3DFueraDeDireccion`) se generalizó para mirar también
 * `efectos2d`, no solo `efectos3d` — el prompt ya prohibía «marquee» en
 * «editorial», pero nadie comprobaba si el modelo le hacía caso.
 *
 * `mock-2d-mal-puesto` pone un `<div class="fx-marquee">` en una landing
 * pedida explícitamente "editorial de revista" (dirección "editorial", que
 * lo prohíbe). Forja lo mide en la página ya pintada y se lo devuelve al
 * modelo por el mismo camino que las señas de página genérica.
 */

const MODEL_ID = "mock-2d-mal-puesto";

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
              agentMode: false,
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

test("el marquee en una landing editorial se detecta y se le pide quitarlo", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, MODEL_ID);
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
  // "editorial de revista" fuerza la dirección "editorial" (capa 1 de
  // elegirDireccion): sin esto, la rotación determinista podría caer en
  // otra, y la prueba no probaría nada.
  await input.fill("hazme una landing editorial de revista para mi marca");
  await page.keyboard.press("Enter");

  // «marquee» a secas no sirve de marcador: el propio prompt de sistema de
  // "editorial" ya lo nombra en su lista de PROHIBIDOS (promptEfectos), así
  // que saldría en el primer turno aunque no se hubiera corregido nada — el
  // mismo colapso que ya se encontró con «motor 3D» en "experimental". El
  // marcador de una corrección de verdad es el encabezado que solo pone
  // `promptDeGenerico` al devolver algo medido en la página ya pintada.
  await expect
    .poll(() => cuerpos.filter((c) => c.includes("y la he medido")).length, { timeout: 90_000 })
    .toBeGreaterThan(0);

  const aviso = cuerpos.find((c) => c.includes("y la he medido")) ?? "";
  expect(aviso, "nombra el efecto 2D visto de verdad").toContain("marquee");
  expect(aviso, "nombra la dirección que lo prohíbe").toContain("editorial");

  // …y el modelo, corregido, entrega la página sin el marquee
  await expect(page.getByText("Quitado el marquee.").first()).toBeVisible({ timeout: 90_000 });
  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator(".fx-marquee")).toHaveCount(0);
});

test("en una dirección que sí lo permite (brutalista), el marquee NO se toca", async ({ page }) => {
  test.setTimeout(180_000);
  // Reutiliza `mock-2d` (sin lógica de corrección: siempre enlaza el
  // marquee) forzando la dirección "brutalista" por palabra clave — ahí el
  // marquee está permitido, así que no debería salir ninguna corrección.
  await seed(page, "mock-2d");
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
  await input.fill("hazme una landing brutalista para un festival punk");
  await page.keyboard.press("Enter");

  const marco = page.frameLocator('iframe[title="Vista previa de la página generada"]');
  await expect(marco.locator(".fx-marquee")).toBeAttached({ timeout: 90_000 });
  await page.waitForTimeout(3000);
  // el propio prompt de sistema de "brutalista" ya nombra «marquee» al
  // describirse a sí misma («marquee de texto si encaja»), así que esa
  // palabra sola no sirve de marcador — igual que en el test de arriba.
  expect(cuerpos.filter((c) => c.includes("y la he medido"))).toHaveLength(0);
});
