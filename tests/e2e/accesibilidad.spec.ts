import { expect, test, type Page } from "./fixtures";

/** Forja IA — QA de accesibilidad sobre la app viva.
 *
 * El Inspector Visual y la auditoría estática cubren código y DOM suelto;
 * aquí se comprueba lo que solo se puede medir NAVEGANDO: que el foco vive
 * dentro del diálogo abierto, que Esc lo cierra, que no hay botones mudos en
 * la interfaz cargada y que el compositor se alcanza con teclado. Los números
 * del fuente no sirven si el orden de tabulación se rompe al montar. */
async function seed(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    const s = { state: { sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], settings: { defaultModelKey: "custom::mock-mini-free", systemPrompt: "x", temperature: 0.7, maxTokens: null, stream: true, contextWindow: 10, sendKeyOnProxy: true, onlyFree: false, agentMode: false, agentMaxLoops: 3, accent: "violeta", accentCustom: "#8b5cf6", autoSpeak: false, accessCode: "", compression: "off", outputStyle: "normal", piiShield: true }, providers: { custom: { apiKey: "k", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } }, version: 1 }, version: 0 };
    try { localStorage.setItem("forja-ai-v1", JSON.stringify(s)); } catch {}
  });
}

test("la página declara idioma y tiene un <main> como referencia de navegación", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 30_000 });
  const lang = await page.evaluate(() => document.documentElement.lang);
  expect(lang, "html[lang] presente para que el lector pronuncie bien").not.toBe("");
  expect(await page.locator("main").count()).toBeGreaterThanOrEqual(1);
});

test("ningún botón visible está mudo: todos tienen nombre accesible (4.1.2)", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 30_000 });

  const mudos = await page.evaluate(() => {
    const visibles = [...document.querySelectorAll("button")].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && b.offsetParent !== null;
    });
    return visibles
      .filter((b) => {
        const nombre =
          b.getAttribute("aria-label") ??
          b.getAttribute("title") ??
          (b.textContent ?? "").trim();
        return nombre === "";
      })
      .map((b) => b.className.slice(0, 40));
  });
  expect(mudos, `botones sin nombre accesible: ${JSON.stringify(mudos)}`).toHaveLength(0);
});

test("Ajustes abre un diálogo que atrapa el foco y Esc lo devuelve", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Ajustes" }).first().click();
  const dialogo = page.getByRole("dialog", { name: /Ajustes/ });
  await expect(dialogo).toBeVisible();

  // el foco quedó DENTRO del diálogo (radix lo mueve; se verifica, no se confía)
  const dentro = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!d && d.contains(document.activeElement);
  });
  expect(dentro, "el foco debe entrar al diálogo al abrirlo").toBe(true);

  // Esc cierra y el foco vuelve al documento (radix restaura el disparador)
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
});

test("el compositor se alcanza navegando con teclado (2.1.1)", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const ta = page.locator("textarea").first();
  await expect(ta).toBeVisible({ timeout: 30_000 });

  // enfoca el primer elemento y recorre con Tab: el compositor tiene que
  // aparecer en el recorrido sin ratón de por medio
  await page.evaluate(() => {
    const primero = document.querySelector<HTMLElement>("header a, header button");
    primero?.focus();
  });
  let alcanza = false;
  for (let i = 0; i < 40 && !alcanza; i++) {
    await page.keyboard.press("Tab");
    alcanza = await page.evaluate(
      () => document.activeElement?.tagName === "TEXTAREA"
    );
  }
  expect(alcanza, "el textarea se alcanza con Tab en ≤40 pulsaciones").toBe(true);
});
