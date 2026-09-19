import { expect, test, type Page } from "./fixtures";

/** Forja IA — Knowledge Base Manager (Fase 2 del plan, §9.2).
 *
 * Ver y clasificar a mano los recursos que se eligieron desde Drive, y
 * añadir un archivo directo desde la lista de "archivos recientes" del
 * panel Drive sin pasar por el selector visual (el Picker en sí no se
 * puede ejercer en pruebas automáticas: necesita la ventana real de
 * Google).
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

test.describe("Knowledge Base", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("vacía, explica cómo añadir el primer recurso", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    await expect(page.getByText(/Todavía no hay ningún recurso en el índice/)).toBeVisible();
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
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Clasificado", { exact: true })).toBeVisible();
    await expect(page.getByText("landing", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Quitar del índice/ }).click();
    await expect(page.getByText(/Todavía no hay ningún recurso en el índice/)).toBeVisible();
  });

  test("añadir un archivo desde Drive → aparece en la Knowledge Base", async ({ page }) => {
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
    await page.getByRole("button", { name: "Drive" }).click();
    await page.getByText("Ver archivos").click();
    await expect(page.getByText("paleta-de-colores.pdf")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "+ Añadir" }).click();
    await expect(page.getByRole("button", { name: "Ya añadido" })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Conocimiento" }).click();
    await expect(page.getByText("paleta-de-colores.pdf")).toBeVisible();
    await expect(page.getByText("Nuevo", { exact: true })).toBeVisible();
  });
});
