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
});
