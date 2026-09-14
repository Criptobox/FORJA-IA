import { expect, test, type Page } from "./fixtures";

/** Prism AI — Recorte PROACTIVO: no esperar a que el proveedor se queje.
 *
 * `recorte-y-reintento.spec.ts` prueba el camino REACTIVO: un proveedor
 * contesta «no cabe» (413) y la app recorta y reintenta. Pero un contexto
 * casi lleno no siempre falla así de limpio — puede devolver un 200 con el
 * stream VACÍO, sin queja ninguna (el caso real reportado por el usuario:
 * nvidia/nemotron vía OpenRouter al 92,5% de la ventana, 182s de espera y
 * respuesta en blanco). El camino reactivo nunca se dispara ahí, porque no
 * hay error que lo dispare.
 *
 * Esto prueba que el recorte pasa ANTES de mandar nada, en cuanto el HUD de
 * contexto ya está en zona roja — con un modelo (`mock-mini-free`) que NUNCA
 * falla por tamaño, para dejar claro que el disparo es el nivel de contexto,
 * no una respuesta vacía ni un error del proveedor.
 */

/** Historial largo a propósito, con una ventana de referencia pequeña
 *  (`ventanaCtx: 1000`) para no necesitar miles de caracteres: pasa de 950
 *  tokens estimados (95 % de 1000), que es la zona roja del HUD. */
function sesionLarga() {
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
    title: "larga",
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
              ventanaCtx: 1000,
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
      localStorage.removeItem("prism-limites-v1");
      localStorage.removeItem("prism-modelos-rotos-v1");
    } catch {
      /* marco sin acceso */
    }
  }, sesionLarga());
}

test("con el contexto en zona roja, recorta ANTES de enviar — sin esperar a que el proveedor falle", async ({
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

  // Lo dice ANTES de que llegue ninguna respuesta: el aviso es del recorte
  // proactivo ("antes de enviar"), no del reactivo ("Historial recortado
  // para <modelo>", que solo sale tras un 413).
  await expect(page.getByText("Historial recortado antes de enviar")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/contexto estaba casi lleno/i)).toBeVisible();

  // Y responde bien, a la primera, con el mismo modelo — no hubo error que
  // disparara un salto de modelo ni un reintento.
  await expect(page.locator("main").getByText("funcionando con tu API")).toBeVisible({
    timeout: 90_000,
  });

  // La PRIMERA petición que salió ya iba recortada: no hay una petición
  // grande previa que fallara y otra más pequeña después.
  expect(cuerpos.length).toBeGreaterThan(0);
  const primera = JSON.parse(cuerpos[0]) as { messages?: { content?: unknown }[] };
  const totalChars = (primera.messages ?? []).reduce(
    (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
    0
  );
  // 1000 tokens de referencia × 4 chars/token × el margen de recortar() (85%):
  // con margen de sobra para el prompt de sistema y el formateo del protocolo.
  expect(totalChars).toBeLessThan(1000 * 4);
});
