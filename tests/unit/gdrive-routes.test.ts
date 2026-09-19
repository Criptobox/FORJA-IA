import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* Las rutas se prueban llamando a los handlers directamente (como
 * api-health.test.ts): no hace falta levantar un servidor, y el
 * intercambio real con Google se sustituye por un `fetch` de mentira. */

const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

function req(url: string, init: RequestInit = {}): Request {
  return new Request(url, { headers: { host: "app.example" }, ...init });
}

describe("/api/gdrive/oauth/creds", () => {
  it("GET sin credenciales: configured=false", async () => {
    const { GET } = await import("../../src/app/api/gdrive/oauth/creds/route");
    const res = await GET(req("https://app.example/api/gdrive/oauth/creds"));
    const j = (await res.json()) as { configured: boolean; source: string | null };
    expect(j).toEqual({ configured: false, source: null });
  });

  it("GET con GOOGLE_CLIENT_ID/SECRET: configured=true, source=env", async () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    const { GET } = await import("../../src/app/api/gdrive/oauth/creds/route");
    const res = await GET(req("https://app.example/api/gdrive/oauth/creds"));
    const j = (await res.json()) as { configured: boolean; source: string | null };
    expect(j).toEqual({ configured: true, source: "env" });
  });

  it("POST sin clientId/clientSecret: 400", async () => {
    const { POST } = await import("../../src/app/api/gdrive/oauth/creds/route");
    const res = await POST(req("https://app.example/api/gdrive/oauth/creds", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("POST con credenciales válidas: 200 y guarda la cookie", async () => {
    const { POST } = await import("../../src/app/api/gdrive/oauth/creds/route");
    const res = await POST(
      req("https://app.example/api/gdrive/oauth/creds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: "abc", clientSecret: "xyz" }),
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("forja_gd_app=");
  });
});

describe("/api/gdrive/oauth/start", () => {
  it("sin credenciales: 409 con instrucciones", async () => {
    const { GET } = await import("../../src/app/api/gdrive/oauth/start/route");
    const res = await GET(req("https://app.example/api/gdrive/oauth/start"));
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("credenciales de Google");
  });

  it("con credenciales de entorno: redirige a Google con scope de Drive", async () => {
    process.env.GOOGLE_CLIENT_ID = "cid";
    process.env.GOOGLE_CLIENT_SECRET = "csecret";
    const { GET } = await import("../../src/app/api/gdrive/oauth/start/route");
    const res = await GET(req("https://app.example/api/gdrive/oauth/start"));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.hostname).toBe("accounts.google.com");
    expect(loc.searchParams.get("client_id")).toBe("cid");
    expect(loc.searchParams.get("redirect_uri")).toBe("https://app.example/api/gdrive/oauth/callback");
    expect(loc.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive");
    expect(res.headers.get("set-cookie")).toContain("forja_gd_state=");
  });
});

describe("/api/gdrive/oauth/callback", () => {
  it("propaga el error que manda Google", async () => {
    const { GET } = await import("../../src/app/api/gdrive/oauth/callback/route");
    const res = await GET(req("https://app.example/api/gdrive/oauth/callback?error=access_denied"));
    expect(await res.text()).toContain("access_denied");
  });

  it("sin code: 400", async () => {
    const { GET } = await import("../../src/app/api/gdrive/oauth/callback/route");
    const res = await GET(req("https://app.example/api/gdrive/oauth/callback"));
    expect(res.status).toBe(400);
  });

  it("state que no coincide con la cookie: 400", async () => {
    const { GET } = await import("../../src/app/api/gdrive/oauth/callback/route");
    const res = await GET(
      req("https://app.example/api/gdrive/oauth/callback?code=abc&state=x", {
        headers: { host: "app.example", cookie: "forja_gd_state=y.verifier" },
      })
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("no coincide");
  });

  it("intercambio correcto: entrega token y datos de la cuenta", async () => {
    process.env.GOOGLE_CLIENT_ID = "cid";
    process.env.GOOGLE_CLIENT_SECRET = "csecret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({ access_token: "ya29.x", refresh_token: "1//r", expires_in: 3600 }),
            { status: 200 }
          );
        }
        if (String(url).includes("drive/v3/about")) {
          return new Response(
            JSON.stringify({
              user: { emailAddress: "ana@example.com", displayName: "Ana", photoLink: "https://x/a.png" },
              storageQuota: { limit: "100", usage: "40", usageInDrive: "40" },
            }),
            { status: 200 }
          );
        }
        throw new Error(`fetch no mockeado: ${url}`);
      })
    );
    const { GET } = await import("../../src/app/api/gdrive/oauth/callback/route");
    const state = "a-state-with-more-than-eight-chars";
    const res = await GET(
      req(`https://app.example/api/gdrive/oauth/callback?code=abc&state=${state}`, {
        headers: { host: "app.example", cookie: `forja_gd_state=${state}.verifier` },
      })
    );
    const body = await res.text();
    expect(body).toContain("ya29.x");
    expect(body).toContain("ana@example.com");
    expect(body).toContain("Cuenta conectada");
  });
});

describe("/api/gdrive/oauth/refresh", () => {
  it("sin credenciales: 400", async () => {
    const { POST } = await import("../../src/app/api/gdrive/oauth/refresh/route");
    const res = await POST(
      req("https://app.example/api/gdrive/oauth/refresh", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(400);
  });

  it("con credenciales y refreshToken: entrega un accessToken nuevo", async () => {
    process.env.GOOGLE_CLIENT_ID = "cid";
    process.env.GOOGLE_CLIENT_SECRET = "csecret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ access_token: "ya29.new", expires_in: 3600 }), { status: 200 }))
    );
    const { POST } = await import("../../src/app/api/gdrive/oauth/refresh/route");
    const res = await POST(
      req("https://app.example/api/gdrive/oauth/refresh", {
        method: "POST",
        headers: { host: "app.example", "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: "1//r" }),
      })
    );
    const j = (await res.json()) as { accessToken?: string };
    expect(j.accessToken).toBe("ya29.new");
  });
});
