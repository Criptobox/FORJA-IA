import { expect, test } from "./fixtures";
import { writeZip } from "../../src/lib/forja/zip";

/** Forja IA — Los botones de la vista previa tienen que RESPONDER.
 *
 * Reportado con la app en la mano: «en los preview los botones se tocan pero
 * no ejecutan función; si necesito entrar a ajustes para ver cómo quedó el
 * diseño, lo toco y no entra».
 *
 * La causa no está en los botones. El iframe corre SIN `allow-same-origin` —y
 * tiene que seguir así, porque con él la página generada sería del mismo
 * origen que Forja y podría leer tus claves del `localStorage`—. En ese modo,
 * **tocar `localStorage` lanza una excepción**. Y como media web generada
 * guarda ahí el tema o el estado, el script de la página revienta en su
 * primera línea… y los `addEventListener` que venían detrás nunca llegan a
 * ejecutarse. La página se ve perfecta y no hace nada.
 *
 * Esta prueba es esa página: un botón que abre un panel de ajustes, con un
 * `localStorage` por delante.
 */

const texto = (s: string) => new TextEncoder().encode(s);

const PAGINA = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Diseño</title></head>
<body>
  <button id="abrir">Ajustes</button>
  <div id="panel" hidden>PANEL DE AJUSTES ABIERTO</div>
  <script>
    // Como media web generada: guarda el tema antes de nada.
    var tema = localStorage.getItem('tema') || 'oscuro';
    localStorage.setItem('tema', tema);
    document.getElementById('abrir').addEventListener('click', function () {
      document.getElementById('panel').hidden = false;
    });
  </script>
</body></html>`;

function zipDePrueba(): Buffer {
  return Buffer.from(writeZip([{ path: "index.html", data: texto(PAGINA) }]));
}

test("un botón detrás de un localStorage sigue funcionando en la vista previa", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    if (window.top !== window.self) return; // no dentro del iframe del Sandbox
    try {
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            version: 1,
          },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  });
  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Sandbox", exact: false }).first().click();
  await page
    .getByRole("dialog")
    .locator('input[type="file"]')
    .setInputFiles({ name: "web.zip", mimeType: "application/zip", buffer: zipDePrueba() });

  const marco = page.frameLocator('iframe[title="Vista previa del Sandbox"]');
  await expect(marco.locator("#abrir")).toBeVisible({ timeout: 20_000 });

  // Lo que fallaba: se toca y no pasa nada.
  await marco.locator("#abrir").click();
  await expect(
    marco.locator("#panel"),
    "el manejador nunca se registró porque el script murió en el localStorage"
  ).toBeVisible({ timeout: 10_000 });
});
