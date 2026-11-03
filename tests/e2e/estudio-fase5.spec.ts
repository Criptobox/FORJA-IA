import { expect, test, type Page, type Route } from "@playwright/test";

/** FORJA IA — Estudio, fase 5: revisor antes de mostrar, memoria de gustos
 * y modo autónomo «objetivo → N pantallas». Con un proveedor simulado: se
 * comprueba lo que viaja por el cable (cuántas llamadas, qué pide cada una)
 * y lo que se ve. */

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

/** Una pantalla «buena» (sin fallos de patrón ni plantilla) con esquinas
 * redondeadas: así el revisor no se activa y los votos tienen un rasgo claro. */
function pantallaBuena(nombre: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${nombre}</title><style>:root{--color-acento:#e5484d}body{margin:0;padding:24px;font-family:system-ui}.c{border-radius:20px;padding:16px;background:#fff}</style></head><body><main><h1>${nombre} de Peluquería Lola</h1><section class="c"><p>Corte de pelo con lavado: 18 € · 40 minutos</p></section></main></body></html>`;
}

async function proveedor(page: Page, cuerpos: Cuerpo[], plan: string) {
  await page.route("**/api/mock-llm/**", async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return route.continue();
    const body = JSON.parse(raw) as Cuerpo;
    cuerpos.push(body);
    const sys = body.messages.find((m) => m.role === "system")?.content ?? "";
    const usuario = body.messages.filter((m) => m.role === "user").pop()?.content ?? "";
    const nombre = usuario.match(/pantalla «([^»]+)»/)?.[1] ?? usuario.match(/HTML actual de la pantalla «([^»]+)»/)?.[1] ?? "Pantalla";
    const texto = sys.includes("diseñador de producto") ? plan : "```html\n" + pantallaBuena(nombre) + "\n```";
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse(texto) });
  });
}

const pantallas = (cuerpos: Cuerpo[]) => cuerpos.filter((c) => !(c.messages.find((m) => m.role === "system")?.content ?? "").includes("diseñador de producto"));

test("modo autónomo: objetivo → N pantallas de un toque, y una pantalla bien hecha no gasta una revisión", async ({ page }) => {
  await seed(page);
  const cuerpos: Cuerpo[] = [];
  // una web con páginas sin patrones de producto: si salen bien, el revisor no gasta nada
  await proveedor(page, cuerpos, "1. Inicio | portada de la peluquería\n2. Servicios | lo que hacemos\n3. Equipo | quiénes somos\n4. Extra | sobra");
  await page.goto("/forja");

  await page.getByRole("radio", { name: "Web" }).click();
  await page.getByPlaceholder(/app de reservas/).fill("Web de una peluquería de barrio");
  await page.getByLabel("Pantallas del modo autónomo").selectOption("3");
  await page.getByRole("button", { name: "Hazlo todo" }).click();

  const lienzo = page.getByRole("region", { name: "Lienzo" });
  await expect(lienzo.locator("iframe")).toHaveCount(3, { timeout: 30_000 });
  const plan = cuerpos.find((c) => (c.messages.find((m) => m.role === "system")?.content ?? "").includes("diseñador de producto"))!;
  expect(plan.messages.at(-1)!.content).toContain("exactamente 3");
  // tres páginas buenas = tres llamadas, sin correcciones
  await expect.poll(() => pantallas(cuerpos).length).toBe(3);
  await page.waitForTimeout(500);
  expect(pantallas(cuerpos)).toHaveLength(3);
  // y el system prompt de cada una va compacto
  for (const c of pantallas(cuerpos)) expect((c.messages.find((m) => m.role === "system")?.content ?? "").length).toBeLessThan(3_600);
});

test("los votos 👍 enseñan tus gustos y viajan, en una línea, en la siguiente pantalla", async ({ page }) => {
  await seed(page);
  const cuerpos: Cuerpo[] = [];
  // web con páginas sin patrones: el revisor no se mete y se ve solo el efecto de los votos
  await proveedor(page, cuerpos, "1. Inicio | portada de la peluquería\n2. Servicios | lo que hacemos");
  await page.goto("/forja");

  await page.getByRole("radio", { name: "Web" }).click();
  await page.getByPlaceholder(/app de reservas/).fill("Web de una peluquería");
  await page.getByRole("button", { name: "Planificar pantallas" }).click();
  await page.getByRole("button", { name: /Crear y generar 2/ }).click();
  const lienzo = page.getByRole("region", { name: "Lienzo" });
  await expect(lienzo.locator("iframe")).toHaveCount(2, { timeout: 30_000 });

  const panel = page.getByRole("complementary", { name: "Pantalla seleccionada" });
  await panel.getByRole("button", { name: "Me gusta", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Me gusta", exact: true })).toHaveAttribute("aria-pressed", "true");
  // la segunda pantalla
  await page.getByRole("complementary", { name: "Pantallas" }).getByText("Servicios").click();
  await panel.getByRole("button", { name: "Me gusta", exact: true }).click();

  // una pantalla nueva lleva la línea de gustos (esquinas redondeadas)
  const antes = pantallas(cuerpos).length;
  await page.getByRole("complementary", { name: "Pantallas" }).getByRole("button", { name: "Pantalla" }).click();
  await page.getByPlaceholder("Nombre").fill("Equipo");
  // crear la pantalla ya la genera
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect.poll(() => pantallas(cuerpos).length).toBeGreaterThan(antes);
  const pedido = pantallas(cuerpos)[antes].messages.at(-1)!.content;
  expect(pedido).toContain("Gustos de esta persona");
  expect(pedido).toContain("esquinas muy redondeadas");

  // y en la portada del Estudio se ve lo aprendido, con «Olvidar»
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  const gustos = page.getByTestId("gustos-aprendidos");
  await expect(gustos).toContainText("2 votos", { timeout: 30_000 });
  await expect(gustos).toContainText("esquinas muy redondeadas");
  await gustos.getByRole("button", { name: "Olvidar" }).click();
  await expect(gustos).toHaveCount(0);
});

test("el revisor corrige UNA vez lo que falla antes de enseñarlo, y se puede apagar", async ({ page }) => {
  await seed(page);
  const cuerpos: Cuerpo[] = [];
  // en una app, «Iniciar sesión» pide campos de acceso que la pantalla simulada no trae
  await proveedor(page, cuerpos, "1. Iniciar sesión | entrar con el correo");
  await page.goto("/forja");
  await page.getByPlaceholder(/app de reservas/).fill("App de reservas para una peluquería");
  await page.getByRole("button", { name: "Planificar pantallas" }).click();
  await page.getByRole("button", { name: /Crear y generar 1/ }).click();

  const panel = page.getByRole("complementary", { name: "Pantalla seleccionada" });
  await expect(panel.getByRole("button", { name: /^v2 · Revisión automática/ })).toBeVisible({ timeout: 30_000 });
  // dos llamadas exactas: la pantalla y UNA corrección con la lista corta
  await page.waitForTimeout(800);
  expect(pantallas(cuerpos)).toHaveLength(2);
  const correccion = pantallas(cuerpos)[1].messages.at(-1)!.content;
  expect(correccion).toContain("corrige estos problemas");
  expect(correccion).toContain("correo/contraseña");
  expect((correccion.match(/^- /gm) ?? []).length).toBeLessThanOrEqual(4);

  // apagado: «Rehacer» ya no lleva corrección automática
  await page.getByLabel("Revisar antes de mostrar").uncheck();
  await panel.getByRole("button", { name: "Rehacer" }).click();
  await expect(panel.getByRole("button", { name: /^v3 · Generada/ })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  expect(pantallas(cuerpos)).toHaveLength(3);
});
