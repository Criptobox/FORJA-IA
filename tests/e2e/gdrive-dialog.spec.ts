import { expect, test, type Page } from "./fixtures";

/** Forja IA — Panel "Drive" (Fase 1 del plan de Knowledge Base).
 *
 * Conectar cuentas de Google Drive, ver su almacenamiento y una vista
 * previa de sus archivos, desde un diálogo propio en la barra lateral.
 * Google no tiene un registro automático como el manifiesto de GitHub
 * Apps, así que primero hace falta pegar un Client ID/Secret — este test
 * cubre las dos pantallas: sin credenciales, y con una cuenta ya
 * conectada (con la API de Drive mockeada, sin red real).
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

test.describe("Panel Drive", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("sin credenciales, muestra cómo crearlas en Google Cloud", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Drive" }).click();

    await expect(page.getByRole("dialog").getByText("Google Cloud Console")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/api\/gdrive\/oauth\/callback/)).toBeVisible();
    await expect(page.getByText("Todavía no hay ninguna cuenta de Google Drive conectada.")).toBeVisible();
  });

  test("con una cuenta conectada, se ve el almacenamiento y sus archivos", async ({ page }) => {
    await page.route("https://www.googleapis.com/drive/v3/files**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          files: [
            {
              id: "1",
              name: "referencia.png",
              mimeType: "image/png",
              size: "1048576",
              modifiedTime: "2026-09-10T12:00:00Z",
              iconLink: "",
              webViewLink: "https://drive.google.com/file/d/1",
            },
          ],
        }),
      })
    );
    await page.addInitScript(() => {
      localStorage.setItem(
        "forja-gdrive-accounts",
        JSON.stringify([
          {
            email: "ana@example.com",
            name: "Ana Torres",
            avatar: "",
            accessToken: "ya29.fake",
            refreshToken: "1//fake",
            expiresAt: Date.now() + 3600_000,
            quota: { limit: 16106127360, usage: 13153337344, usageInDrive: 13153337344 },
          },
        ])
      );
    });

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Drive" }).click();

    await expect(page.getByText("ana@example.com")).toBeVisible();
    await expect(page.getByText(/de 15 GB usados/)).toBeVisible();

    await page.getByText("Ver archivos de esta cuenta").click();
    await expect(page.getByText("referencia.png")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("1 MB")).toBeVisible();

    await page.getByRole("button", { name: "Desconectar" }).click();
    await expect(page.getByText("Todavía no hay ninguna cuenta de Google Drive conectada.")).toBeVisible();
  });
});
