import { expect, test, type Page } from "./fixtures";

/** «Subir a GitHub»: la lista de repos tiene que aparecer, o fallar con salida.
 *  Nunca quedarse en «Cargando…» (queja real desde un móvil con VPN). */
async function sembrar(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: {
            sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], skills: [],
            settings: { defaultModelKey: "custom::mock-mini-free", accessCode: "", agentMode: false, stream: true },
            providers: { custom: { apiKey: "test-key-123", baseUrl: "/api/mock-llm", enabled: true, models: ["mock-mini-free"], useProxy: false } },
            version: 1,
          },
          version: 0,
        })
      );
      localStorage.setItem("forja-github-token", "e2e-token-falso");
    } catch { /* marco sin acceso */ }
  });
}

const ok = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const repo = (n: string) => ({ name: n, full_name: `yo/${n}`, private: n === "secreto", default_branch: "main", html_url: `https://github.com/yo/${n}`, owner: { login: "yo" } });

test("los repos aparecen en la lista", async ({ page }) => {
  await sembrar(page);
  await page.route("https://api.github.com/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/user") return route.fulfill(ok({ login: "yo", name: "Yo", avatar_url: "" }));
    if (u.pathname === "/user/repos") return route.fulfill(ok([repo("web"), repo("secreto")]));
    if (u.pathname.startsWith("/user/installations")) return route.fulfill(ok({ total_count: 0, installations: [] }));
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "GitHub" }).first().click();
  await expect(page.getByRole("button", { name: /yo\/web/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /yo\/secreto/ })).toBeVisible();
  await expect(page.getByText("Cargando tus repositorios")).toHaveCount(0);
});

test("si GitHub no responde, sale un error con «Reintentar» en vez de cargar para siempre", async ({ page }) => {
  test.setTimeout(90_000);
  await sembrar(page);
  await page.route("https://api.github.com/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/user") return route.fulfill(ok({ login: "yo", name: "Yo", avatar_url: "" }));
    if (u.pathname === "/user/repos") return; // se queda colgada a propósito
    return route.fulfill(ok({ total_count: 0, installations: [] }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "GitHub" }).first().click();
  await expect(page.getByText("Cargando tus repositorios")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible({ timeout: 45_000 });
});
