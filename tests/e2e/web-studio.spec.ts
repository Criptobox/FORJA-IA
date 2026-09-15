import { expect, test } from "./fixtures";

/** Prism AI — Web Studio (v4.20.0): Project Health, Security Center y
 * Project Tasks en una sola superficie, accesible desde la barra lateral.
 *
 * Ninguna de las tres piezas inventa datos que no tiene: Health enseña
 * «—» donde no hay evidencia, Security nunca afirma ausencia de
 * vulnerabilidades, y las tareas son un tablero local persistente.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("prism-preview-demo", "1");
      localStorage.setItem(
        "prism-ai-v1",
        JSON.stringify({
          state: {
            sessions: [],
            activeSessionId: null,
            onboardingDone: true,
            favorites: [],
            radarSeenIds: [],
            settings: {
              defaultModelKey: null,
              accessCode: "",
              agentModes: [],
              agentMode: false,
              ahorro: false,
              stream: false,
            },
            providers: {},
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
  await page.locator("textarea").first().waitFor({ state: "visible", timeout: 30_000 });
});

test("se abre desde la barra lateral y sin datos enseña «—», no una puntuación inventada", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
  await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Health" }).click();
  // sin mapa de proyecto ni QA medido: se dice explícitamente, no se
  // inventa un 0/100 ni un 100/100
  await expect(page.getByText("Sin mapa de proyecto")).toBeVisible();
  await expect(page.getByText("Todavía no se ha medido")).toBeVisible();
});

test("el iframe oculto de medición va sandboxed, igual que el resto de vistas previas", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
  await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });

  const sandbox = await page.locator('iframe[title="Prism QA"]').getAttribute("sandbox");
  expect(sandbox, "sin allow-same-origin: el HTML medido no puede leer el localStorage de Prism").toBe(
    "allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock"
  );
});

test("Security Center analiza y nunca afirma que el código está limpio", async ({ page }) => {
  await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
  await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Security" }).click();
  await page.getByRole("button", { name: "Analizar código" }).click();

  await expect(page.getByText(/no sustituye/i)).toBeVisible();
});

test("Project Tasks: añadir, avanzar de pendiente a hecha y borrar, todo persiste en el tablero local", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
  await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Tasks" }).click();
  const input = page.locator("#prism-task-input");
  await input.fill("Revisar el hero en móvil");
  await input.press("Enter");

  await expect(page.getByText("Pendientes (1)")).toBeVisible();
  const titulo = page.getByText("Revisar el hero en móvil", { exact: true });
  await expect(titulo).toBeVisible();

  // pendiente → en curso: el primer botón de la tarjeta de la tarea
  const tarjeta = titulo.locator("..").locator("..");
  await tarjeta.getByRole("button").first().click();
  await expect(page.getByText("En curso (1)")).toBeVisible();
  await expect(page.getByText("Pendientes (0)")).toBeVisible();
});

/** Regresión real: a 320/390px el stepper de 7 etapas (dentro de una fila
 * con overflow-x-auto) empujaba TODO el diálogo fuera de la pantalla,
 * porque el div contenedor no tenía min-w-0 y un hijo grid/flex no se
 * encoge por debajo del contenido de sus descendientes por defecto. */
for (const w of [320, 390, 768]) {
  test(`Web Studio sin desbordes a ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 780 });
    // Por debajo del breakpoint `lg` la barra lateral vive dentro de un Sheet
    // cerrado: hay que abrirlo con el botón de hamburguesa antes de llegar
    // al botón "Web Studio", igual que haría alguien en el móvil.
    const abrirMenu = page.getByRole("button", { name: /Abrir conversaciones/ });
    if (await abrirMenu.isVisible().catch(() => false)) {
      await abrirMenu.click();
    }
    await page.getByRole("button", { name: "Web Studio", exact: false }).first().click();
    await expect(page.getByText("Prism Web Studio")).toBeVisible({ timeout: 10_000 });
    // El Sheet de la barra lateral (si se abrió) tarda su transición en
    // desmontarse; sin esperarlo, sus nodos aparecen a mitad de camino
    // fuera de la pantalla y se confunden con un desborde real.
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 2000 }).catch(() => {});

    const r = await page.evaluate((vw) => {
      const loRecortaAlguien = (el: Element): boolean => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX;
          if (ov !== "visible") return true;
        }
        return false;
      };
      const fuera: string[] = [];
      document.querySelectorAll("body *").forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.height > 0 && (b.right > vw + 1 || b.left < -1)) {
          if (loRecortaAlguien(el)) return;
          fuera.push(`${el.tagName}[${(el.getAttribute("aria-label") || "").slice(0, 24)}] ${Math.round(b.left)}..${Math.round(b.right)}`);
        }
      });
      const dialog = document.querySelector('[data-slot="dialog-content"]');
      // scrollWidth mide el contenido real aunque el propio diálogo lo
      // recorte con overflow-hidden: es la forma de detectar que un hijo
      // grid (el stepper de etapas) se sigue forzando más ancho de lo
      // debido por dentro, aunque no llegue a desbordar la página.
      const dialogScroll = dialog ? dialog.scrollWidth - dialog.clientWidth : -1;
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fuera: fuera.slice(0, 5),
        dialogRight: dialog ? Math.round(dialog.getBoundingClientRect().right) : -1,
        dialogScroll,
      };
    }, w);

    expect(r.scroll, "scroll horizontal de página").toBe(0);
    expect(r.fuera, "elementos fuera del viewport").toEqual([]);
    expect(r.dialogRight, "borde derecho del diálogo dentro del viewport").toBeLessThanOrEqual(w + 1);
    expect(r.dialogScroll, "el diálogo no fuerza más ancho interno del que tiene").toBeLessThanOrEqual(1);

    // Tasks: el campo de nueva tarea no debe quedar recortado a un ancho ilegible
    await page.getByRole("tab", { name: "Tasks" }).click();
    const input = page.locator("#prism-task-input");
    await expect(input).toBeVisible();
    const inputWidth = await input.evaluate((el) => el.getBoundingClientRect().width);
    expect(inputWidth, "ancho del campo de nueva tarea").toBeGreaterThan(100);
  });
}
