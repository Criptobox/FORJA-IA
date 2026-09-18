import { expect, test, type Page } from "./fixtures";

/** Forja IA — Los diálogos también caben: QA responsive de los paneles.
 *
 * responsive.spec vigila la PÁGINA a 320 px; aquí van los DIÁLOGOS: Ajustes y
 * Panel del sistema, abiertos en el ancho donde la gente sostiene un móvil.
 * Un diálogo que se sale del viewport no se arregla haciendo scroll: se
 * arregla midiendo. La medición es la misma que usa responsive.spec (rect vs
 * viewport, tolerancia 1 px) para que ambos tests mientan igual de poco. */
async function seed(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    const s = { state: { sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], settings: { defaultModelKey: "custom::mock-mini-free", systemPrompt: "x", temperature: 0.7, maxTokens: null, stream: true, contextWindow: 10, sendKeyOnProxy: true, onlyFree: false, agentMode: false, agentMaxLoops: 3, accent: "violeta", accentCustom: "#8b5cf6", autoSpeak: false, accessCode: "", compression: "off", outputStyle: "normal", piiShield: true }, providers: { custom: { apiKey: "k", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } }, version: 1 }, version: 0 };
    try { localStorage.setItem("prism-ai-v1", JSON.stringify(s)); } catch {}
  });
}

/** Medida de página: el documento no desborda horizontalmente. */
function medirPagina(page: Page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}

/** Medida del diálogo ABIERTO: entre varios [role="dialog"] coexistiendo en el
 *  DOM (el drawer del sidebar cerrado queda aparcado a -195px), se mide el que
 *  está data-state="open". Medir el primero sería fotografiar el cajón. */
function medirDialogo(page: Page) {
  return page.evaluate(() => {
    const abiertos = [...document.querySelectorAll('[role="dialog"]')].filter(
      (d) => d.getAttribute("data-state") === "open"
    );
    if (abiertos.length === 0) return { presente: false, fuera: [] as string[] };
    const d = abiertos[0];
    const r = d.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fuera: string[] = [];
    if (r.width === 0 && r.height === 0) return { presente: false, fuera: [] };
    if (r.left < -1) fuera.push(`izquierda ${Math.round(r.left)}`);
    if (r.right > vw + 1) fuera.push(`derecha ${Math.round(r.right)}/${vw}`);
    if (r.top < -1) fuera.push(`arriba ${Math.round(r.top)}`);
    if (r.bottom > vh + 1) fuera.push(`abajo ${Math.round(r.bottom)}/${vh}`);
    return { presente: true, fuera };
  });
}

for (const [ancho, alto] of [[320, 780], [390, 780], [768, 1024]] as const) {
  test(`el diálogo de Ajustes cabe a ${ancho}px`, async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 30_000 });

    // en móvil la barra lateral es un drawer: se abre con la hamburguesa
    if (ancho < 1024) {
      await page.getByRole("button", { name: /Abrir conversaciones/ }).click();
    }
    await page.getByRole("button", { name: "Ajustes" }).first().click();
    const dialogo = page.getByRole("dialog", { name: /Ajustes/ });
    await expect(dialogo).toBeVisible();

    const m = await medirDialogo(page);
    expect(m.presente, "hay un diálogo abierto").toBe(true);
    expect(m.fuera, `el diálogo no se sale del viewport: ${JSON.stringify(m.fuera)}`).toHaveLength(0);

    // y al cerrar, la página tampoco queda desbordada por el intento
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    expect((await medirPagina(page)).scroll, "sin scroll horizontal en la página").toBeLessThanOrEqual(0);
  });

  test(`el Panel del sistema (con Inspector) cabe a ${ancho}px`, async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 30_000 });

    if (ancho < 1024) {
      await page.getByRole("button", { name: /Abrir conversaciones/ }).click();
    }
    await page.getByRole("button", { name: "Panel", exact: true }).click();
    const dialogo = page.getByRole("dialog", { name: /Panel del sistema/ });
    await expect(dialogo).toBeVisible();

    const m = await medirDialogo(page);
    expect(m.presente, "hay un diálogo abierto").toBe(true);
    expect(m.fuera, `el panel no se sale del viewport: ${JSON.stringify(m.fuera)}`).toHaveLength(0);

    // la pestaña Inspector (5ª) también existe a 320: grid-cols-5 apretado pero legible
    await dialogo.getByRole("tab", { name: /inspector/i }).click();
    await expect(
      dialogo.getByRole("button", { name: "Volver a analizar la interfaz" })
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
  });
}
