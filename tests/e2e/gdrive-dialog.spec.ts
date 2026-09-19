import { expect, test, type Page } from "./fixtures";

/** Forja IA — Panel "Drive" (Fase 1 del plan de Knowledge Base).
 *
 * Conectar cuentas de Google Drive, ver su almacenamiento y una vista
 * previa de sus archivos, desde un diálogo propio en la barra lateral.
 *
 * La conexión usa Google Identity Services (Client ID + API Key, sin
 * secret) en vez del intercambio OAuth de servidor de antes — ese flujo le
 * dio a un usuario real un "Error 400: redirect_uri_mismatch" sin ninguna
 * pista dentro de Forja. Este test cubre las dos pantallas: sin
 * credenciales, y con una cuenta ya conectada (con la API de Drive
 * mockeada, sin red real — GIS en sí no se ejerce aquí, solo la lectura de
 * cuentas ya guardadas).
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

  test("sin credenciales, muestra cómo crearlas en Google Cloud (Client ID + API Key, sin secret)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Drive" }).click();

    await expect(page.getByRole("dialog").getByText("Google Cloud Console")).toBeVisible();
    // Ya no pide Client Secret ni un "redirect URI" con ruta exacta.
    await expect(page.getByLabel("Client Secret")).toHaveCount(0);
    await expect(page.getByLabel("API Key")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Authorized JavaScript origins/)).toBeVisible();
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

    await expect(page.getByText("ana@example.com")).toBeVisible();
    await expect(page.getByText(/12 GB \/ 15 GB/)).toBeVisible();
    // Con credenciales guardadas, el botón de conectar SÍ aparece.
    await expect(page.getByRole("button", { name: "Conectar cuenta" })).toBeVisible();
    // Y el selector visual de Drive (Picker) está disponible por cuenta.
    await expect(page.getByRole("button", { name: "Elegir en Drive" })).toBeVisible();

    await page.getByText("Ver archivos").click();
    await expect(page.getByText("referencia.png")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("1 MB")).toBeVisible();

    await page.getByRole("button", { name: "Desconectar" }).click();
    await expect(page.getByText("Todavía no hay ninguna cuenta de Google Drive conectada.")).toBeVisible();
  });
});
