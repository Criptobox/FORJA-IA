import { deflateSync } from "node:zlib";
import { expect, test, type Page, type Route } from "@playwright/test";

/** FORJA IA — Estudio: la Biblioteca de referencias.
 *
 * Subir una imagen → ver su paleta → elegirla al crear un proyecto → que su
 * paleta viaje en el system prompt y la imagen en el mensaje (modo Auto) →
 * guardar una pantalla generada en la Biblioteca. */

async function seed(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
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
            settings: { defaultModelKey: "custom::mock-mini-free", accessCode: "", agentModes: [], ahorro: false },
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

/** PNG de verdad: mitad izquierda roja, mitad derecha azul. */
function png(ancho = 40, alto = 20): Buffer {
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const x of b) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const trozo = (tipo: string, datos: Buffer) => {
    const t = Buffer.concat([Buffer.from(tipo), datos]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(t));
    return Buffer.concat([len, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 2; // RGB
  const filas: number[] = [];
  for (let y = 0; y < alto; y++) {
    filas.push(0);
    for (let x = 0; x < ancho; x++) filas.push(...(x < ancho / 2 ? [255, 0, 0] : [0, 0, 255]));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(Buffer.from(filas))),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

function sse(texto: string): string {
  const trozos = texto.match(/[\s\S]{1,40}/g) ?? [];
  return (
    trozos.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`).join("") +
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`
  );
}

type Parte = { type: string; text?: string; image_url?: { url: string } };
type Cuerpo = { messages: { role: string; content: string | Parte[] }[] };

const texto = (c: string | Parte[]) => (typeof c === "string" ? c : c.map((p) => p.text ?? "").join("\n"));

test("sube una referencia, guía un proyecto con ella y guarda una pantalla en la Biblioteca", async ({ page }) => {
  await seed(page);
  const cuerpos: Cuerpo[] = [];
  await page.route("**/api/mock-llm/**", async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return route.continue();
    const body = JSON.parse(raw) as Cuerpo;
    cuerpos.push(body);
    const usuario = texto(body.messages.filter((m) => m.role === "user").pop()?.content ?? "");
    const nombre = usuario.match(/pantalla «([^»]+)»/)?.[1] ?? "Pantalla";
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#ff0000;color:#fff;font-family:system-ui}</style></head><body><h1>${nombre}</h1></body></html>`;
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse("Hecho.\n```html\n" + html + "\n```") });
  });
  await page.goto("/forja");

  // 1) Biblioteca: subir una imagen
  await page.getByRole("tab", { name: "Biblioteca" }).click({ timeout: 30_000 });
  await expect(page.getByText(/Aún no hay nada/)).toBeVisible();
  await page.getByTestId("biblioteca-archivo").setInputFiles({ name: "moodboard-rojo_azul.png", mimeType: "image/png", buffer: png() });
  const tarjetas = page.getByTestId("referencia");
  await expect(tarjetas).toHaveCount(1, { timeout: 15_000 });
  await expect(tarjetas.first().getByLabel("Nombre de la referencia")).toHaveValue("moodboard rojo azul");
  const paleta = tarjetas.first().getByLabel(/^Paleta:/);
  await expect(paleta).toHaveAttribute("aria-label", /#ff0000/);
  await expect(paleta).toHaveAttribute("aria-label", /#0000ff/);
  await expect(tarjetas.first().locator("img")).toBeVisible();

  // sobrevive a una recarga (metadatos en localStorage, imagen en IndexedDB)
  await page.reload();
  await page.getByRole("tab", { name: "Biblioteca" }).click({ timeout: 30_000 });
  await expect(page.getByTestId("referencia").first().locator("img")).toBeVisible({ timeout: 15_000 });

  // 2) Proyecto nuevo con esa referencia
  await page.getByRole("tab", { name: "Proyectos" }).click();
  await page.getByPlaceholder(/app de reservas/).fill("Web de una tienda de bicicletas");
  await page.getByText("Referencias visuales").click();
  await page.getByRole("group", { name: "Referencias" }).getByRole("button", { name: /moodboard rojo azul/i }).click();
  await expect(page.getByText(/1 elegida/)).toBeVisible();
  await page.getByRole("button", { name: "Solo una pantalla" }).click();

  const lienzo = page.getByRole("region", { name: "Lienzo" });
  await expect(lienzo.locator("iframe")).toHaveCount(1, { timeout: 20_000 });
  const pedido = cuerpos.at(-1)!;
  const sys = texto(pedido.messages.find((m) => m.role === "system")?.content ?? "");
  expect(sys).toContain("Referencias visuales del usuario");
  expect(sys).toContain("«moodboard rojo azul»: paleta");
  expect(sys).toContain("#ff0000");
  const usuario = pedido.messages.filter((m) => m.role === "user").pop()!.content;
  expect(Array.isArray(usuario), "en modo Auto la imagen viaja con el pedido").toBe(true);
  expect((usuario as Parte[]).some((p) => p.type === "image_url" && p.image_url?.url.startsWith("data:image/jpeg"))).toBe(true);
  await expect(page.getByRole("button", { name: /Referencias \(1\)/ })).toBeVisible();

  // 3) Guardar la pantalla generada en la Biblioteca
  const panel = page.getByRole("complementary", { name: "Pantalla seleccionada" });
  await panel.getByRole("button", { name: "A biblioteca" }).click();
  await expect(page.getByText("Guardada en la Biblioteca")).toBeVisible({ timeout: 25_000 });

  // 4) Quitar la referencia desde el editor
  await page.getByRole("button", { name: /Referencias \(1\)/ }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByRole("button", { name: /moodboard rojo azul/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Referencias$/ })).toBeVisible();

  // 5) De vuelta en la Biblioteca hay dos: la subida y la pantalla
  await page.getByRole("button", { name: "Proyectos" }).first().click();
  await page.getByRole("tab", { name: "Biblioteca" }).click();
  await expect(page.getByTestId("referencia")).toHaveCount(2);
  await expect(page.getByTestId("referencia").first()).toContainText("Pantalla");
  await expect(page.getByTestId("referencia").first().getByLabel("Nombre de la referencia")).toHaveValue(/Inicio$/);
});
