import { expect, test, type Page, type Route } from "@playwright/test";

/** FORJA IA — Estudio en el móvil: estilos que se ven, sin desbordes y
 * lienzo en carrusel (sin un scroll vertical dentro del de la página). */

test.use({ viewport: { width: 390, height: 844 } });

async function seed(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
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
          settings: { defaultModelKey: "custom::mock-mini-free", accessCode: "", agentModes: [], ahorro: false },
          providers: { custom: { apiKey: "k", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } },
          version: 1,
        },
        version: 0,
      })
    );
  });
}

function sse(texto: string): string {
  const trozos = texto.match(/[\s\S]{1,40}/g) ?? [];
  return (
    trozos.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`).join("") +
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`
  );
}

test("en el móvil: los estilos se eligen por su vista previa, nada desborda y el lienzo es un carrusel", async ({ page }) => {
  await seed(page);
  await page.route("**/api/mock-llm/**", async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return route.continue();
    const body = JSON.parse(raw) as { messages: { role: string; content: string }[] };
    const sys = body.messages.find((m) => m.role === "system")?.content ?? "";
    const usuario = body.messages.filter((m) => m.role === "user").pop()?.content ?? "";
    const nombre = usuario.match(/pantalla «([^»]+)»/)?.[1] ?? "Pantalla";
    const texto = sys.includes("diseñador de producto")
      ? "1. Inicio | servicios\n2. Reservar | hora\n3. Perfil | datos"
      : "```html\n<!doctype html><html lang=\"es\"><head><title>" + nombre + "</title></head><body><h1>" + nombre + "</h1></body></html>\n```";
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse(texto) });
  });
  await page.goto("/forja");

  // estilos: tarjetas con vista previa, «Que elija FORJA» por defecto
  const estilos = page.getByRole("radiogroup", { name: "Estilo" });
  await expect(estilos.getByRole("radio")).toHaveCount(7, { timeout: 30_000 });
  await expect(estilos.getByRole("radio", { name: /Que elija FORJA/ })).toHaveAttribute("aria-checked", "true");
  await estilos.getByRole("radio", { name: /Minimal cálido/ }).click();
  await expect(estilos.getByRole("radio", { name: /Minimal cálido/ })).toHaveAttribute("aria-checked", "true");
  await expect(estilos.getByRole("radio", { name: /Que elija FORJA/ })).toHaveAttribute("aria-checked", "false");

  await page.getByPlaceholder(/app de reservas/).fill("App de reservas para una peluquería");
  await page.getByRole("button", { name: "Planificar pantallas" }).click();
  await page.getByRole("button", { name: /Crear y generar 3/ }).click();
  const lienzo = page.getByRole("region", { name: "Lienzo" });
  await expect(lienzo.locator("iframe")).toHaveCount(3, { timeout: 30_000 });

  // la página no se sale por la derecha y los paneles caben en pantalla
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  for (const panel of [page.getByRole("complementary", { name: "Pantallas" }), lienzo, page.getByRole("complementary", { name: "Pantalla seleccionada" })]) {
    const caja = await panel.boundingBox();
    expect(caja && caja.x + caja.width).toBeLessThanOrEqual(390);
  }

  // carrusel: las pantallas van en fila (se desliza en horizontal, no en vertical)
  const carrusel = page.getByTestId("lienzo-pantallas");
  const medidas = await carrusel.evaluate((el) => ({
    horizontal: el.scrollWidth > el.clientWidth,
    vertical: el.scrollHeight > el.clientHeight + 1,
  }));
  expect(medidas).toEqual({ horizontal: true, vertical: false });
});
