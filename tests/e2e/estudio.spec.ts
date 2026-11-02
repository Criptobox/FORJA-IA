import { expect, test, type Page, type Route } from "@playwright/test";

/** FORJA IA — Estudio de diseño (tipo Stitch).
 *
 * El flujo entero con un proveedor simulado: planificar → crear el proyecto →
 * generar las pantallas de una en una → verlas en el lienzo → pedir un cambio
 * (nueva versión) → comparar → descargar el ZIP. Lo que se comprueba es lo que
 * viaja por el cable (el sistema de diseño en cada pantalla, el HTML actual al
 * pedir un cambio) y lo que se ve, no solo que no explote. */

async function seed(page: Page) {
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
            settings: { defaultModelKey: "custom::mock-mini-free", accessCode: "", agentModes: [], ahorro: false },
            providers: {
              custom: { apiKey: "k", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false },
            },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {}
  });
}

function html(titulo: string, extra = ""): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>:root{--color-acento:red}</style></head><body><h1>${titulo}</h1>${extra}</body></html>`;
}

/** Respuesta SSE estilo OpenAI con el texto troceado (como un streaming real). */
function sse(texto: string): string {
  const trozos = texto.match(/[\s\S]{1,40}/g) ?? [];
  return (
    trozos.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`).join("") +
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`
  );
}

type Cuerpo = { messages: { role: string; content: string }[]; stream?: boolean };

async function proveedorSimulado(page: Page, cuerpos: Cuerpo[]) {
  await page.route("**/api/mock-llm/**", async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return route.continue();
    const body = JSON.parse(raw) as Cuerpo;
    cuerpos.push(body);
    const sys = body.messages.find((m) => m.role === "system")?.content ?? "";
    const usuario = body.messages.filter((m) => m.role === "user").pop()?.content ?? "";
    let texto: string;
    if (sys.includes("diseñador de producto")) {
      texto = "1. Inicio | resumen de citas del día\n2. Reservar | elegir servicio y hora";
    } else {
      const nombre = usuario.match(/pantalla «([^»]+)»/)?.[1] ?? "Pantalla";
      const cambio = usuario.match(/Aplica SOLO este cambio: (.+)/)?.[1];
      texto = "Hecho.\n```html\n" + html(nombre, cambio ? `<p class="cambio">${cambio}</p>` : "") + "\n```";
    }
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse(texto) });
  });
}

test("planifica, genera las pantallas con el sistema de diseño, itera, compara y descarga", async ({ page }) => {
  await seed(page);
  const cuerpos: Cuerpo[] = [];
  await proveedorSimulado(page, cuerpos);
  await page.goto("/forja");

  await expect(page.getByRole("heading", { name: "¿Qué diseñamos?" })).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder(/app de reservas/).fill("App de reservas para una peluquería de barrio");
  await page.getByRole("button", { name: "Planificar pantallas" }).click();

  // el plan llega editable
  await expect(page.getByLabel("Nombre de la pantalla").first()).toHaveValue("Inicio");
  await expect(page.getByLabel("Nombre de la pantalla").nth(1)).toHaveValue("Reservar");
  await page.getByRole("button", { name: /Crear y generar 2/ }).click();

  // se generan las dos, de una en una, y se ven en el lienzo
  const lienzo = page.getByRole("region", { name: "Lienzo" });
  await expect(lienzo.locator("iframe")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.frameLocator('section[aria-label="Lienzo"] iframe').first().getByRole("heading", { name: "Inicio" })).toBeVisible();

  const pantallas = cuerpos.filter((c) => !(c.messages.find((m) => m.role === "system")?.content ?? "").includes("diseñador de producto"));
  expect(pantallas).toHaveLength(2);
  for (const c of pantallas) {
    const sys = c.messages.find((m) => m.role === "system")?.content ?? "";
    expect(sys, "el sistema de diseño viaja en cada pantalla").toContain("--color-acento:");
    expect(sys, "cada pantalla sabe qué otras hay").toContain("Reservar");
  }

  // pedir un cambio sobre la pantalla seleccionada (la primera)
  const panel = page.getByRole("complementary", { name: "Pantalla seleccionada" });
  await panel.getByPlaceholder(/más aire entre secciones/).fill("el botón principal más grande");
  await panel.getByRole("button", { name: "Aplicar" }).click();
  await expect(panel.getByRole("button", { name: /^v2 · Cambio/ })).toBeVisible({ timeout: 20_000 });
  const iterar = cuerpos.at(-1)!;
  const pedido = iterar.messages.filter((m) => m.role === "user").pop()?.content ?? "";
  expect(pedido, "el modelo recibe el HTML actual para editarlo").toContain("<h1>Inicio</h1>");
  expect(pedido).toContain("el botón principal más grande");

  // la crítica de FORJA aparece con su puntuación
  await expect(panel.getByText(/identidad \d+\/100/)).toBeVisible();

  // comparar las dos versiones
  await panel.getByRole("button", { name: "Comparar" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByText(/Comparar versiones/)).toBeVisible();
  await expect(dialogo.locator("iframe")).toHaveCount(2);
  await page.keyboard.press("Escape");

  // el ZIP del proyecto se descarga
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: "ZIP del proyecto" }).click();
  expect((await descarga).suggestedFilename()).toMatch(/\.zip$/);

  // y el proyecto sobrevive a recargar
  await page.reload();
  await expect(page.getByRole("region", { name: "Lienzo" }).locator("iframe")).toHaveCount(2, { timeout: 30_000 });
  if (process.env.CAPTURA_ESTUDIO) await page.screenshot({ path: process.env.CAPTURA_ESTUDIO, fullPage: true });
});
