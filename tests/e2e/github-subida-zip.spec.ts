import { expect, test, type Page } from "./fixtures";

/** Forja IA — Subir un ZIP de verdad a GitHub, de punta a punta.
 *
 * Un ZIP como los que llegan de verdad: hecho en Windows (nombres en CP437,
 * con «ñ»), con la carpeta envolvente, la basura de macOS (`__MACOSX`) y un
 * `node_modules` dentro. Contra un GitHub simulado con estado, se comprueba
 * lo que importa:
 *   1. el «diseño.html» llega con su nombre bien escrito;
 *   2. node_modules y __MACOSX no se suben;
 *   3. TODO entra en un único commit;
 *   4. «reemplazar» (por defecto) quita lo que ya no está en el proyecto, y la
 *      pantalla lo dice.
 */

function zipCp437(archivos: { nombre: number[]; datos: string }[]): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let off = 0;
  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre);
    const datos = Buffer.from(a.datos, "utf8");
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt32LE(datos.length, 18);
    lfh.writeUInt32LE(datos.length, 22);
    lfh.writeUInt16LE(nombre.length, 26);
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt32LE(datos.length, 20);
    cdh.writeUInt32LE(datos.length, 24);
    cdh.writeUInt16LE(nombre.length, 28);
    cdh.writeUInt32LE(off, 42);
    partes.push(lfh, nombre, datos);
    central.push(cdh, nombre);
    off += 30 + nombre.length + datos.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(archivos.length, 8);
  eocd.writeUInt16LE(archivos.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...partes, cd, eocd]);
}

const bytes = (s: string) => [...Buffer.from(s, "latin1")];

/** GitHub simulado: un repo «web» que ya existe con dos archivos. */
async function githubSimulado(page: Page) {
  const estado = {
    ramas: { main: "c0" } as Record<string, string>,
    commits: { c0: { tree: "t0", parents: [] as string[] } } as Record<string, { tree: string; parents: string[] }>,
    arboles: { t0: { "README.md": "viejo", "viejo.js": "ya no está" } } as Record<string, Record<string, string>>,
    posts: [] as string[],
  };
  let n = 0;
  const ok = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("https://api.github.com/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const ruta = url.pathname + (url.search || "");
    const m = req.method();
    const cuerpo = req.postData() ? JSON.parse(req.postData() as string) : {};
    if (m !== "GET") estado.posts.push(`${m} ${url.pathname}`);
    if (ruta === "/user") return route.fulfill(ok({ login: "yo", name: "Yo", avatar_url: "" }));
    if (ruta.startsWith("/user/installations")) return route.fulfill(ok({ total_count: 0, installations: [] }));
    if (ruta === "/repos/yo/web") return route.fulfill(ok({ owner: { login: "yo" }, html_url: "https://github.com/yo/web", default_branch: "main" }));
    const ref = ruta.match(/^\/repos\/yo\/web\/git\/ref\/heads\/(.+)$/);
    if (ref && m === "GET") return route.fulfill(ok({ object: { sha: estado.ramas[ref[1]] } }));
    const com = ruta.match(/^\/repos\/yo\/web\/git\/commits\/(.+)$/);
    if (com && m === "GET") return route.fulfill(ok({ tree: { sha: estado.commits[com[1]].tree } }));
    const arb = ruta.match(/^\/repos\/yo\/web\/git\/trees\/([^?]+)\?recursive=1$/);
    if (arb) return route.fulfill(ok({ truncated: false, tree: Object.keys(estado.arboles[arb[1]] ?? {}).map((path) => ({ path, type: "blob" })) }));
    if (ruta === "/repos/yo/web/git/blobs") return route.fulfill(ok({ sha: `b${++n}` }));
    if (ruta === "/repos/yo/web/git/trees") {
      const base = cuerpo.base_tree ? { ...estado.arboles[cuerpo.base_tree] } : {};
      for (const e of cuerpo.tree) base[e.path] = e.content ?? `blob:${e.sha}`;
      const sha = `t${++n}`;
      estado.arboles[sha] = base;
      return route.fulfill(ok({ sha }));
    }
    if (ruta === "/repos/yo/web/git/commits") {
      const sha = `c${++n}`;
      estado.commits[sha] = { tree: cuerpo.tree, parents: cuerpo.parents };
      return route.fulfill(ok({ sha, tree: { sha: cuerpo.tree } }));
    }
    const patch = ruta.match(/^\/repos\/yo\/web\/git\/refs\/heads\/(.+)$/);
    if (patch && m === "PATCH") {
      estado.ramas[patch[1]] = cuerpo.sha;
      return route.fulfill(ok({ object: { sha: cuerpo.sha } }));
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: `sin ruta ${m} ${ruta}` }) });
  });
  return estado;
}

test("un ZIP de Windows con node_modules sube limpio, en un commit, reemplazando", async ({ page }) => {
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
            skills: [],
            settings: { defaultModelKey: "custom::mock-mini-free", accessCode: "", agentMode: false, stream: true },
            providers: { custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } },
            version: 1,
          },
          version: 0,
        })
      );
      localStorage.setItem("forja-github-token", "e2e-token-falso");
    } catch {
      /* marco sin acceso */
    }
  });
  const gh = await githubSimulado(page);

  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "GitHub" }).first().click();
  await expect(page.getByText("Paso 3 · Carpeta a subir")).toBeVisible();
  await page.getByPlaceholder("forja-ia").fill("web");

  const zip = zipCp437([
    { nombre: bytes("web/index.html"), datos: '<!doctype html><a href="diseño.html">x</a>' },
    // «diseño.html» en CP437: la ñ es 0xA4
    { nombre: [...bytes("web/dise"), 0xa4, ...bytes("o.html")], datos: "<p>diseño</p>" },
    { nombre: bytes("web/css/estilo.css"), datos: "body{margin:0}" },
    { nombre: bytes("web/node_modules/react/index.js"), datos: "module.exports={}" },
    { nombre: bytes("__MACOSX/web/._index.html"), datos: "mac" },
  ]);
  await page.getByRole("dialog").locator('input[type="file"]').first().setInputFiles({ name: "web.zip", mimeType: "application/zip", buffer: zip });

  // 3 archivos: sin node_modules ni __MACOSX
  await expect(page.getByText("3 archivos listos para subir")).toBeVisible({ timeout: 15_000 });
  // «reemplazar» viene marcado por defecto
  await expect(page.locator('[data-modo="reemplazar"]')).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: /Subir .* archivos a GitHub/ }).click();
  await expect(page.getByTestId("gh-resumen")).toContainText("1 commit", { timeout: 20_000 });
  await expect(page.getByTestId("gh-resumen")).toContainText("2 archivos que ya no estaban");

  // en GitHub: exactamente el proyecto, con la ñ bien, y un único commit nuevo
  const final = gh.arboles[gh.commits[gh.ramas.main].tree];
  expect(Object.keys(final).sort()).toEqual(["css/estilo.css", "diseño.html", "index.html"]);
  expect(gh.posts.filter((p) => p.endsWith("/git/commits"))).toHaveLength(1);
  expect(gh.commits[gh.ramas.main].parents).toEqual(["c0"]);
});
