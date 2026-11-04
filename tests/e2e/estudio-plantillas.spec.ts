import { expect, test, type Page, type Route } from "@playwright/test";

/** FORJA IA — Estudio: guardar un proyecto como plantilla y reutilizarlo.
 * Lo que importa se mide en el cable: «Abrir copia» no hace NINGUNA llamada
 * (los diseños ya están) y «Usar estructura» se salta la de planificar. */

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
            providers: { custom: { apiKey: "k", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } },
            version: 1,
          },
          version: 0,
        })
      );
    } catch {}
  });
}

function sse(texto: string): string {
  const trozos = texto.match(/[\s\S]{1,40}/g) ?? [];
  return (
    trozos.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`).join("") +
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`
  );
}

type Cuerpo = { messages: { role: string; content: string }[] };
const esPlan = (c: Cuerpo) => (c.messages.find((m) => m.role === "system")?.content ?? "").includes("diseñador de producto");

test("guardar como plantilla, abrir una copia sin gastar llamadas y usar su estructura sin planificar", async ({ page }) => {
  await seed(page);
  const cuerpos: Cuerpo[] = [];
  await page.route("**/api/mock-llm/**", async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return route.continue();
    const body = JSON.parse(raw) as Cuerpo;
    cuerpos.push(body);
    const usuario = body.messages.filter((m) => m.role === "user").pop()?.content ?? "";
    const nombre = usuario.match(/pantalla «([^»]+)»/)?.[1] ?? "Pantalla";
    const texto = esPlan(body)
      ? "1. Inicio | portada de la peluquería\n2. Servicios | lo que hacemos"
      : "```html\n<!doctype html><html lang=\"es\"><head><title>" + nombre + "</title><style>.c{border-radius:20px}</style></head><body><main><h1>" + nombre + " de Peluquería Lola</h1><p class=\"c\">Corte y lavado: 18 €</p></main></body></html>\n```";
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse(texto) });
  });
  await page.goto("/forja");

  // un proyecto web de dos páginas
  await page.getByRole("radio", { name: "Web" }).click();
  await page.getByPlaceholder(/app de reservas/).fill("Web de una peluquería de barrio");
  await page.getByRole("button", { name: "Planificar pantallas" }).click();
  await page.getByRole("button", { name: /Crear y generar 2/ }).click();
  await expect(page.getByRole("region", { name: "Lienzo" }).locator("iframe")).toHaveCount(2, { timeout: 30_000 });

  // guardarlo como plantilla, con sus diseños
  await page.getByRole("button", { name: "Guardar como plantilla" }).click();
  const dialogo = page.getByRole("dialog", { name: "Guardar como plantilla" });
  await dialogo.getByLabel("Nombre").fill("Web de peluquería");
  await expect(dialogo.getByRole("checkbox")).toBeChecked();
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Plantilla guardada")).toBeVisible();

  // en la portada sale la plantilla
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  const tarjeta = page.getByTestId("plantilla").filter({ hasText: "Web de peluquería" });
  await expect(tarjeta).toContainText("2 pantallas · con diseños");

  // «Abrir copia»: proyecto nuevo con sus diseños y CERO llamadas
  const antes = cuerpos.length;
  await tarjeta.getByRole("button", { name: "Abrir copia" }).click();
  await expect(page.getByRole("region", { name: "Lienzo" }).locator("iframe")).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByRole("complementary", { name: "Pantalla seleccionada" }).getByRole("button", { name: /^v1 · De plantilla/ })).toBeVisible();
  await page.waitForTimeout(600);
  expect(cuerpos.length).toBe(antes);

  // «Usar estructura»: el plan sale de la plantilla, sin llamada de planificar
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  await page.getByPlaceholder(/app de reservas/).fill("Web de una barbería en Sevilla");
  const planesAntes = cuerpos.filter(esPlan).length;
  await page.getByTestId("plantilla").filter({ hasText: "Web de peluquería" }).getByRole("button", { name: "Usar estructura" }).click();
  await expect(page.getByLabel("Nombre de la pantalla").first()).toHaveValue("Inicio");
  await expect(page.getByLabel("Nombre de la pantalla").nth(1)).toHaveValue("Servicios");
  await page.getByRole("button", { name: /Crear y generar 2/ }).click();
  await expect(page.getByRole("region", { name: "Lienzo" }).locator("iframe")).toHaveCount(2, { timeout: 30_000 });
  expect(cuerpos.filter(esPlan).length).toBe(planesAntes);
  // y genera con el encargo nuevo
  expect(cuerpos.at(-1)!.messages.at(-1)!.content).toContain("barbería en Sevilla");

  // borrar la plantilla
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  await page.getByRole("button", { name: "Borrar la plantilla Web de peluquería" }).click();
  await expect(page.getByTestId("plantilla")).toHaveCount(0);
});
