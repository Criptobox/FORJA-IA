import { expect, test, type Page } from "./fixtures";

/** Forja IA — "Conocimiento": un solo panel con Drive y la Knowledge Base
 * juntos (Fase 1 + Fase 2 del plan). Antes eran dos diálogos separados
 * ("Drive" y "Conocimiento"); el usuario pidió explícito que fuera "un
 * panel con todo... todo los datos de ese tipo en 1 solo lugar" — este
 * archivo cubre ambas mitades desde el mismo diálogo.
 *
 * La conexión usa Google Identity Services (Client ID + API Key, sin
 * secret) en vez del intercambio OAuth de servidor de antes — ese flujo le
 * dio a un usuario real un "Error 400: redirect_uri_mismatch" sin ninguna
 * pista dentro de Forja.
 */

async function seed(page: Page) {
  await page.addInitScript(() => {
    try {
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
            settings: { defaultModelKey: "custom::mock-mini-free", accessCode: "" },
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

test.describe("Conocimiento (Drive + Knowledge Base en un solo panel)", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("vacío, explica cómo añadir el primer recurso y cómo crear las credenciales de Google", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    // Mitad Knowledge Base.
    await expect(page.getByText(/Todavía no hay ningún recurso en el índice/)).toBeVisible();
    // Mitad Drive, en el MISMO diálogo — ya no hay que abrir otro panel.
    await expect(page.getByRole("dialog").getByText("Google Cloud Console")).toBeVisible();
    await expect(page.getByLabel("Client Secret")).toHaveCount(0);
    await expect(page.getByLabel("API Key")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Authorized JavaScript origins/)).toBeVisible();
    await expect(page.getByText("Todavía no hay ninguna cuenta de Google Drive conectada.")).toBeVisible();
  });

  test("con recursos, se ven las estadísticas reales y se puede clasificar y quitar", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "forja-kb-index",
        JSON.stringify([
          {
            id: "f1",
            name: "landing-referencia.png",
            mimeType: "image/png",
            sizeBytes: 2458624,
            accountEmail: "ana@example.com",
            webViewLink: "https://drive.google.com/file/d/1",
            category: "",
            tags: [],
            technology: "",
            license: "",
            status: "nuevo",
            indexedAt: "2026-01-01T00:00:00.000Z",
          },
        ])
      );
    });

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    // Estadísticas reales, no inventadas: 1 total, 1 nuevo, 0 clasificados.
    await expect(page.getByText("landing-referencia.png")).toBeVisible();
    await expect(page.getByText("Total").locator("..")).toContainText("1");
    await expect(page.getByText("Nuevos").locator("..")).toContainText("1");
    await expect(page.getByText("Clasificados").locator("..")).toContainText("0");

    await page.getByText("Categoría / etiquetas").click();
    await page.getByPlaceholder("ej. componentes-ui").fill("visual");
    await page.getByPlaceholder("dashboard, oscuro, tarjetas").fill("landing, oscuro");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(page.getByText("Clasificado", { exact: true })).toBeVisible();
    await expect(page.getByText("landing", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Quitar del índice/ }).click();
    await expect(page.getByText(/Todavía no hay ningún recurso en el índice/)).toBeVisible();
  });

  test("con una cuenta conectada, se ve su almacenamiento y sus archivos, y se puede añadir uno a la Knowledge Base", async ({
    page,
  }) => {
    await page.route("https://www.googleapis.com/drive/v3/files**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          files: [
            {
              id: "f9",
              name: "paleta-de-colores.pdf",
              mimeType: "application/pdf",
              size: "184320",
              modifiedTime: "2026-09-08T09:30:00Z",
              iconLink: "",
              webViewLink: "https://drive.google.com/file/d/9",
            },
          ],
        }),
      })
    );
    await page.addInitScript(() => {
      localStorage.setItem("forja-gdrive-creds", JSON.stringify({ clientId: "test-cid", apiKey: "test-key" }));
      localStorage.setItem(
        "forja-gdrive-accounts",
        JSON.stringify([
          {
            email: "ana@example.com",
            name: "Ana Torres",
            avatar: "",
            accessToken: "ya29.fake",
            expiresAt: Date.now() + 3600_000,
            quota: { limit: 16106127360, usage: 13153337344, usageInDrive: 13153337344 },
          },
        ])
      );
    });

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    // Mitad Drive: cuenta, almacenamiento, Picker disponible.
    await expect(page.getByText("ana@example.com")).toBeVisible();
    await expect(page.getByText(/12 GB \/ 15 GB/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar cuenta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Elegir en Drive" })).toBeVisible();

    // "+ Añadir" cruza al lado de la Knowledge Base sin salir del diálogo.
    await page.getByText("Ver archivos").click();
    await expect(page.getByText("paleta-de-colores.pdf")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "+ Añadir" }).click();
    await expect(page.getByRole("button", { name: "Ya añadido" })).toBeVisible();
    await expect(page.getByText("Nuevo", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Desconectar" }).click();
    await expect(page.getByText("Todavía no hay ninguna cuenta de Google Drive conectada.")).toBeVisible();
  });

  test("la cola de revisión visual enseña el par y sus tres acciones, y «Conservar ambos» la cierra sin tocar el original", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "forja-kb-index",
        JSON.stringify([
          {
            id: "o", name: "hero-original.png", mimeType: "image/png", sizeBytes: 1000,
            accountEmail: "ana@example.com", webViewLink: "https://drive.google.com/file/d/o",
            category: "ui", tags: [], technology: "", license: "", status: "clasificado",
            indexedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "n", name: "hero-parecido.png", mimeType: "image/png", sizeBytes: 1000,
            accountEmail: "ana@example.com", webViewLink: "https://drive.google.com/file/d/n",
            category: "", tags: [], technology: "", license: "", status: "revision-duplicado",
            indexedAt: "2026-01-02T00:00:00.000Z", duplicateOf: "o", visualSimilarity: 0.93,
          },
        ])
      );
    });

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    await expect(page.getByText("Revisión visual")).toBeVisible();
    await expect(page.getByText("Nuevo: hero-parecido.png")).toBeVisible();
    await expect(page.getByText("Similitud: 93%")).toBeVisible();
    await expect(page.getByText("Relacionado: hero-original.png")).toBeVisible();

    await page.getByRole("button", { name: "Conservar ambos" }).click();

    // La cola desaparece (ya no queda ningún "revision-duplicado")...
    await expect(page.getByText("Revisión visual")).toHaveCount(0);
    // ...y el recurso pasa a "Clasificado" en la lista de abajo, sin que el
    // original se haya tocado ni se haya perdido ningún recurso.
    await expect(page.getByText("hero-parecido.png")).toBeVisible();
    await expect(page.getByText("hero-original.png")).toBeVisible();
    await expect(page.getByText("Clasificado", { exact: true })).toHaveCount(2);
  });

  test("«Quitar del índice» en la cola de revisión borra solo el recurso local, no el original", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "forja-kb-index",
        JSON.stringify([
          {
            id: "o", name: "logo-original.png", mimeType: "image/png", sizeBytes: 1000,
            accountEmail: "ana@example.com", webViewLink: "https://drive.google.com/file/d/o",
            category: "branding", tags: [], technology: "", license: "", status: "clasificado",
            indexedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "n", name: "logo-casi-igual.png", mimeType: "image/png", sizeBytes: 1000,
            accountEmail: "ana@example.com", webViewLink: "https://drive.google.com/file/d/n",
            category: "", tags: [], technology: "", license: "", status: "revision-duplicado",
            indexedAt: "2026-01-02T00:00:00.000Z", duplicateOf: "o", visualSimilarity: 0.88,
          },
        ])
      );
    });

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    await expect(page.getByText("Revisión visual")).toBeVisible();
    await page.getByRole("button", { name: "Quitar del índice" }).first().click();

    await expect(page.getByText("Revisión visual")).toHaveCount(0);
    await expect(page.getByText("logo-casi-igual.png")).toHaveCount(0);
    await expect(page.getByText("logo-original.png")).toBeVisible();
  });

  test("el panel MEGA vive junto a Drive, sin correo/contraseña no deja conectar, y no toca localStorage con la contraseña", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    // Mismo panel que Drive, no un diálogo aparte.
    await expect(page.getByRole("dialog").getByText("Google Cloud Console")).toBeVisible();
    await expect(page.getByText("Conectar MEGA").first()).toBeVisible();
    await expect(page.getByText(/código, repositorios, componentes y recetas/i)).toBeVisible();

    const conectar = page.getByRole("button", { name: "Conectar MEGA" });
    await expect(conectar).toBeDisabled();

    await page.getByPlaceholder("tu@email.com").fill("ana@example.com");
    // Solo el correo no basta: sigue deshabilitado hasta que también haya
    // contraseña — el formulario no deja intentarlo con datos a medias.
    await expect(conectar).toBeDisabled();
    await page.getByLabel("Contraseña").fill("una-clave-cualquiera");
    await expect(conectar).toBeEnabled();

    // El aviso de seguridad es real, no solo un texto de relleno: nunca se
    // escribe la contraseña en localStorage, se escriba o no "Conectar"
    // (aquí no se pulsa: un login real llamaría a la red de MEGA, fuera de
    // lo que una prueba automática puede o debe hacer).
    await expect(page.getByText(/Forja no la guarda en localStorage/)).toBeVisible();
    const guardadoEnStorage = await page.evaluate(() =>
      Object.keys(localStorage).some((k) => localStorage.getItem(k)?.includes("una-clave-cualquiera"))
    );
    expect(guardadoEnStorage).toBe(false);
  });
});
