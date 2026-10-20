import { expect, test, type Page } from "./fixtures";
import { writeZip } from "../../src/lib/forja/zip";

/** Forja IA — "Importar recursos": subir un archivo del dispositivo,
 * clasificarlo con el modelo activo y subirlo a Drive sin que el usuario
 * elija a mano la cuenta ni la carpeta.
 *
 * Todo lo externo va mockeado (Drive real y el modelo real no están
 * disponibles en pruebas automáticas): la API de Drive por `page.route`,
 * y el modelo reutilizando el proveedor `custom` con `baseUrl` apuntando
 * al propio `/api/mock-llm` de la app, pero interceptado aquí para
 * devolver una clasificación fija y comprobable.
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
            settings: {
              defaultModelKey: "custom::mock-mini-free",
              accessCode: "",
              stream: false,
              temperature: 0.7,
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
            quota: { limit: 16106127360, usage: 1000000000, usageInDrive: 1000000000 },
          },
        ])
      );
    } catch {}
  });
}

async function mockDrive(page: Page) {
  await page.route("https://www.googleapis.com/drive/v3/files**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ files: [] }) });
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "folder-nueva" }) });
  });
  await page.route("https://www.googleapis.com/upload/drive/v3/files**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "file-subido-1", webViewLink: "https://drive.google.com/file/d/subido-1" }),
    })
  );
}

test.describe("Importar recursos (Knowledge Base)", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("un archivo se clasifica con el modelo activo y aparece en el índice", async ({ page }) => {
    await mockDrive(page);
    await page.route("**/api/mock-llm/chat/completions", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: '{"category": "componentes-ui", "technology": "React", "tags": ["dashboard", "oscuro"]}',
              },
            },
          ],
        }),
      })
    );

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    await page.getByLabel("Seleccionar archivos").setInputFiles({
      name: "boton.tsx",
      mimeType: "text/plain",
      buffer: Buffer.from("export function Boton() { return null; }"),
    });

    await expect(page.getByText(/Guardado en «componentes-ui»/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("boton.tsx").first()).toBeVisible();
    await expect(page.getByText("dashboard")).toBeVisible();
    await expect(page.getByText("Clasificado", { exact: true })).toBeVisible();
  });

  test("si el modelo no da JSON válido, el recurso queda pendiente en vez de fingir una categoría", async ({
    page,
  }) => {
    await mockDrive(page);
    await page.route("**/api/mock-llm/chat/completions", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ choices: [{ message: { content: "No puedo clasificar esto." } }] }),
      })
    );

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    await page.getByLabel("Seleccionar archivos").setInputFiles({
      name: "sin-clasificar.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("datos binarios"),
    });

    await expect(page.getByText(/Guardado sin clasificar/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("sin-clasificar.bin").first()).toBeVisible();
    await expect(page.getByText("Pendiente", { exact: true })).toBeVisible();
  });

  test("un archivo con el mismo contenido ya indexado se marca como duplicado y no se sube", async ({ page }) => {
    let uploadCalled = false;
    await page.route("https://www.googleapis.com/upload/drive/v3/files**", (route) => {
      uploadCalled = true;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "x", webViewLink: "" }) });
    });

    // El hash SHA-256 de "contenido duplicado" se calcula aparte (Node) y se
    // siembra ya indexado, para no depender de una subida real primero.
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update("contenido duplicado").digest("hex");
    await page.addInitScript((h: string) => {
      localStorage.setItem(
        "forja-kb-index",
        JSON.stringify([
          {
            id: "ya-existe",
            name: "original.txt",
            mimeType: "text/plain",
            sizeBytes: 10,
            accountEmail: "ana@example.com",
            webViewLink: "https://drive.google.com/file/d/ya-existe",
            category: "visual",
            tags: [],
            technology: "",
            license: "",
            status: "clasificado",
            indexedAt: "2026-01-01T00:00:00.000Z",
            contentHash: h,
          },
        ])
      );
    }, hash);

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();
    await expect(page.getByText("original.txt")).toBeVisible();

    await page.getByLabel("Seleccionar archivos").setInputFiles({
      name: "copia-con-otro-nombre.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("contenido duplicado"),
    });

    // El aviso de duplicado aparece en la fila de progreso del archivo que se
    // acaba de soltar (no se sube, así que nunca llega a la lista de abajo).
    await expect(page.getByText(/Ya está en la Knowledge Base como «original\.txt»/)).toBeVisible({ timeout: 10_000 });
    expect(uploadCalled).toBe(false);
    // Sigue habiendo un solo recurso en el índice: el original, no una copia.
    await expect(page.getByRole("button", { name: "Quitar del índice" })).toHaveCount(1);
  });

  test("subir un ZIP también analiza su estructura, y el resumen del stack queda visible en el recurso", async ({
    page,
  }) => {
    await mockDrive(page);
    await page.route("**/api/mock-llm/chat/completions", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          choices: [{ message: { content: '{"category": "proyectos", "technology": "React", "tags": ["repo"]}' } }],
        }),
      })
    );

    const enc = new TextEncoder();
    const zipBytes = writeZip([
      { path: "package.json", data: enc.encode('{"name":"demo"}') },
      { path: "package-lock.json", data: enc.encode("{}") },
      { path: "next.config.ts", data: enc.encode("export default {}") },
      { path: "src/app/page.tsx", data: enc.encode("export default function Page() { return <div>hola</div>; }") },
      { path: "node_modules/paquete/index.js", data: enc.encode("module.exports = 1;") },
    ]);

    await page.goto("/");
    await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Conocimiento" }).click();

    await page.getByLabel("Seleccionar archivos").setInputFiles({
      name: "mi-proyecto.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zipBytes),
    });

    await expect(page.getByText(/Proyecto analizado: 5 archivos.*React.*TypeScript/).first()).toBeVisible({
      timeout: 15_000,
    });
    // El resumen del stack no es solo el aviso de progreso que se acaba de
    // soltar: también queda en la fila del recurso más abajo, en un
    // párrafo aparte — comprobado por selector, no solo por texto repetido.
    const resumenEnLaFila = page.locator("p", { hasText: "Proyecto analizado: 5 archivos" });
    await expect(resumenEnLaFila).toBeVisible();
    await expect(resumenEnLaFila).toContainText("Next.js");
  });
});
