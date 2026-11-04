import { expect, test, type Page, type Route } from "@playwright/test";

/** FORJA IA — Estudio: skills de pantalla (fase 4).
 *
 * Con un proveedor simulado: la pantalla «Iniciar sesión» lleva su skill de
 * acceso en el pedido, el panel la muestra como patrón activo, el revisor
 * corrige solo lo que la skill pide y el HTML no cumple (la crítica lo sigue
 * marcando en la v1), y cambiar los patrones a mano se guarda. */

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

function sse(texto: string): string {
  const trozos = texto.match(/[\s\S]{1,40}/g) ?? [];
  return (
    trozos.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`).join("") +
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`
  );
}

type Cuerpo = { messages: { role: string; content: string }[] };

/** Una pantalla de acceso SIN campo de contraseña: la skill de acceso debe
 * marcarlo. Al corregir, el simulador devuelve la versión buena. */
function pantalla(nombre: string, buena: boolean): string {
  const campos = buena
    ? '<label for="c">Correo</label><input id="c" type="email" autocomplete="email"><label for="p">Contraseña</label><input id="p" type="password" autocomplete="current-password"><a href="#">¿Has olvidado la contraseña?</a>'
    : "<p>Entra con tu cuenta del club.</p>";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${nombre}</title><style>:root{--color-acento:#e5484d}body{margin:0;padding:24px;font-family:system-ui}</style></head><body><main><h1>${nombre}</h1>${campos}<button>Entrar</button></main></body></html>`;
}

test("las skills viajan con la pantalla, se comprueban en la crítica y se pueden cambiar", async ({ page }) => {
  await seed(page);
  const cuerpos: Cuerpo[] = [];
  await page.route("**/api/mock-llm/**", async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return route.continue();
    const body = JSON.parse(raw) as Cuerpo;
    cuerpos.push(body);
    const sys = body.messages.find((m) => m.role === "system")?.content ?? "";
    const usuario = body.messages.filter((m) => m.role === "user").pop()?.content ?? "";
    const texto = sys.includes("diseñador de producto")
      ? "1. Iniciar sesión | entrar con el correo del club"
      : "```html\n" + pantalla("Iniciar sesión", usuario.includes("corrige estos problemas")) + "\n```";
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse(texto) });
  });
  await page.goto("/forja");

  await expect(page.getByRole("heading", { name: "¿Qué diseñamos?" })).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder(/app de reservas/).fill("App de reservas de pistas para un club de pádel");
  await page.getByRole("button", { name: "Planificar pantallas" }).click();
  await expect(page.getByLabel("Nombre de la pantalla").first()).toHaveValue("Iniciar sesión");
  await page.getByRole("button", { name: /Crear y generar 1/ }).click();
  await expect(page.getByRole("region", { name: "Lienzo" }).locator("iframe")).toHaveCount(1, { timeout: 20_000 });

  // el pedido de la pantalla lleva sus skills; el system prompt no
  const gen = cuerpos.find((c) => (c.messages.at(-1)?.content ?? "").includes("Diseña la pantalla"))!;
  expect(gen.messages.at(-1)!.content).toContain("[Skill: acceso]");
  expect(gen.messages.at(-1)!.content).toContain("[Skill: pantalla de producto]");
  expect(gen.messages.find((m) => m.role === "system")!.content).not.toContain("[Skill:");

  // el panel muestra los patrones activos
  const panel = page.getByRole("complementary", { name: "Pantalla seleccionada" });
  const skills = panel.getByTestId("skills-pantalla");
  await expect(skills.getByText("Patrones (automáticos)")).toBeVisible();
  await expect(skills.getByRole("button", { name: "Acceso y registro" })).toHaveAttribute("aria-pressed", "true");
  await expect(skills.getByRole("button", { name: "Listado / tabla" })).toHaveAttribute("aria-pressed", "false");

  // el revisor (fase 5) ve lo que pide la skill y lo corrige SOLO, una vez,
  // antes de enseñarla: v2 «Revisión automática» y la petición lleva el fallo
  await expect(panel.getByRole("button", { name: /^v2 · Revisión automática/ })).toBeVisible({ timeout: 20_000 });
  expect(cuerpos.at(-1)!.messages.at(-1)!.content).toContain("correo/contraseña");
  await expect(panel.getByTestId("fallo-patron")).toHaveCount(0);
  // y en la v1 la crítica sigue marcando lo que faltaba
  await panel.getByRole("button", { name: /^v1 · / }).click();
  await expect(panel.getByTestId("fallo-patron").first()).toContainText("correo/contraseña");

  // cambiar los patrones a mano se guarda y sobrevive a recargar
  await skills.getByRole("button", { name: "Acceso y registro" }).click();
  await expect(skills.getByText("Patrones (a mano)")).toBeVisible();
  await expect(skills.getByRole("button", { name: "Acceso y registro" })).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  const skills2 = page.getByRole("complementary", { name: "Pantalla seleccionada" }).getByTestId("skills-pantalla");
  await expect(skills2.getByText("Patrones (a mano)")).toBeVisible({ timeout: 30_000 });
  await skills2.getByRole("button", { name: "Automáticos" }).click();
  await expect(skills2.getByRole("button", { name: "Acceso y registro" })).toHaveAttribute("aria-pressed", "true");
});
