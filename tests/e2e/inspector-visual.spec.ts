import { expect, test, type Page } from "./fixtures";

/** Forja IA — El Inspector Visual en vivo (pestaña nueva del panel del sistema).
 *
 * La regla pura está probada en unit; aquí se verifica el CAMINO: abrir el
 * panel → pestaña Inspector → escaneo que termina (no queda «cargando» para
 * siempre) → o «Todo en orden» o hallazgos contados, y «Volver a analizar»
 * sigue funcionando con la página ya cargada. */
async function seed(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    const s = { state: { sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], settings: { defaultModelKey: "custom::mock-mini-free", systemPrompt: "x", temperature: 0.7, maxTokens: null, stream: true, contextWindow: 10, sendKeyOnProxy: true, onlyFree: false, agentMode: false, agentMaxLoops: 3, accent: "naranja", accentCustom: "#8b5cf6", autoSpeak: false, accessCode: "", compression: "off", outputStyle: "normal", piiShield: true }, providers: { custom: { apiKey: "k", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } }, version: 1 }, version: 0 };
    try { localStorage.setItem("prism-ai-v1", JSON.stringify(s)); } catch {}
  });
}

test("la pestaña Inspector escanea el DOM vivo y termina con veredicto", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 30_000 });

  // el panel vive en la barra lateral: primero se abre el sidebar
  await page.getByRole("button", { name: "Panel", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: /Panel del sistema/ });
  await expect(dialogo).toBeVisible();

  await dialogo.getByRole("tab", { name: /inspector/i }).click();
  const cuerpo = dialogo.getByRole("tabpanel");

  // el escaneo termina: o el botón deja de girar, o aparece un veredicto
  const boton = cuerpo.getByRole("button", { name: "Volver a analizar la interfaz" });
  await expect(boton).toBeVisible();

  const veredicto = cuerpo.getByText("Todo en orden");
  const hallazgos = cuerpo.locator("section");
  await expect
    .poll(
      async () =>
        (await veredicto.isVisible()) || (await hallazgos.count()) > 0 ? "listo" : "escaneando",
      { timeout: 15_000 }
    )
    .toBe("listo");

  // los hallazgos, si los hay, vienen con severidad escrita (alta/media/baja)
  const nSecciones = await hallazgos.count();
  if (nSecciones > 0) {
    const primera = hallazgos.first();
    await expect(primera.locator("h3")).toBeVisible();
  }

  // re-escanear con la página ya montada: el veredicto sigue siendo uno de los dos
  await boton.click();
  await expect
    .poll(
      async () =>
        (await veredicto.isVisible()) || (await hallazgos.count()) > 0 ? "listo" : "escaneando",
      { timeout: 15_000 }
    )
    .toBe("listo");
});

test("el Inspector no se audita a sí mismo: su cuerpo de resultados lleva skip", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Panel", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: /Panel del sistema/ });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole("tab", { name: /inspector/i }).click();
  await expect(
    dialogo.getByRole("button", { name: "Volver a analizar la interfaz" })
  ).toBeVisible();

  // contrato de exclusión: el cuerpo de resultados lleva data-inspector-skip
  // (elementosAuditables lo descarta), y el botón de escaneo queda FUERA del
  // skip porque él sí es un botón real que debe pasar las reglas como cualquiera
  const contrato = await page.evaluate(() => {
    const skip = document.querySelector("[data-inspector-skip]");
    const boton = [...document.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label") === "Volver a analizar la interfaz"
    );
    return {
      haySkip: !!skip,
      botonFueraDelSkip: !!boton && !!skip && !skip.contains(boton),
    };
  });
  expect(contrato.haySkip, "el cuerpo del inspector lleva data-inspector-skip").toBe(true);
  expect(contrato.botonFueraDelSkip, "el botón de escaneo sigue auditable").toBe(true);
});
