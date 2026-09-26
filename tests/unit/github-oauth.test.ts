import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  githubAuthorizeUrl,
  githubInstallUrl,
  githubManifestPayload,
  nombreDeApp,
  isGithubAppClientId,
  parseAppCredsJson,
  parseOAuthTokenResponse,
} from "../../src/lib/forja/github-oauth";
import { ghGetAccount, ghGetToken, ghSetAccount, ghSetToken } from "../../src/lib/forja/github-upload";

describe("parseOAuthTokenResponse", () => {
  it("lee JSON", () => {
    const r = parseOAuthTokenResponse(
      JSON.stringify({ access_token: "gho_abc", token_type: "bearer", scope: "repo" }),
      "application/json"
    );
    expect(r.access_token).toBe("gho_abc");
    expect(r.scope).toBe("repo");
  });
  it("lee form-urlencoded", () => {
    const r = parseOAuthTokenResponse("access_token=gho_x&scope=repo%2Cgist&token_type=bearer");
    expect(r.access_token).toBe("gho_x");
    expect(r.scope).toBe("repo,gist");
  });
  it("propaga error de GitHub", () => {
    const r = parseOAuthTokenResponse(
      JSON.stringify({ error: "bad_verification_code", error_description: "The code passed is incorrect." }),
      "application/json"
    );
    expect(r.error).toBe("bad_verification_code");
    expect(r.access_token).toBeUndefined();
  });
  it("cuerpo vacío", () => {
    expect(parseOAuthTokenResponse("").error).toBe("empty");
  });
});

describe("githubAuthorizeUrl", () => {
  it("OAuth App pide scope repo", () => {
    const u = new URL(
      githubAuthorizeUrl({
        clientId: "0123456789abcdef0123",
        redirectUri: "https://app.example/api/github/oauth/callback",
        state: "abc",
        challenge: "chal",
      })
    );
    expect(u.searchParams.get("scope")).toBe("repo");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe("abc");
  });
  it("GitHub App no manda scope=repo", () => {
    const u = new URL(
      githubAuthorizeUrl({
        clientId: "Iv1.1234567890abcdef",
        redirectUri: "https://app.example/cb",
        state: "s",
      })
    );
    expect(u.searchParams.get("scope")).toBeNull();
    expect(isGithubAppClientId("Iv23.xxxx")).toBe(true);
    expect(isGithubAppClientId("abc")).toBe(false);
  });
});

describe("githubManifestPayload", () => {
  it("apunta al origen actual y pide escritura en contenidos", () => {
    const m = githubManifestPayload("https://forja.example");
    expect(m.redirect_url).toBe("https://forja.example/api/github/manifest/callback");
    expect(m.callback_urls).toEqual(["https://forja.example/api/github/oauth/callback"]);
    expect(m.request_oauth_on_install).toBe(true);
    expect((m.default_permissions as { contents: string }).contents).toBe("write");
    expect(githubInstallUrl("forja-ai")).toContain("/apps/forja-ai/installations/new");
  });

  it("el nombre de la App es único (GitHub no deja repetirlo en TODO GitHub)", () => {
    // Con «Forja IA» fijo, la segunda conexión —otra cuenta, o la misma al
    // caducar la cookie— se quedaba en «Name is already in use».
    const a = githubManifestPayload("https://forja.example").name as string;
    const b = githubManifestPayload("https://forja.example").name as string;
    expect(a).toMatch(/^Forja IA \w+$/);
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(34);
    expect(nombreDeApp("abc123")).toBe("Forja IA abc123");
  });

  it("pide permiso para CREAR repos: una cuenta nueva no tiene ninguno donde subir", () => {
    const m = githubManifestPayload("https://forja.example");
    expect((m.default_permissions as { administration: string }).administration).toBe("write");
  });
});

describe("conectar otra cuenta", () => {
  it("el enlace de autorización deja elegir cuenta en GitHub", () => {
    const u = new URL(githubAuthorizeUrl({ clientId: "Iv23.x", redirectUri: "https://f/cb", state: "s", elegirCuenta: true }));
    expect(u.searchParams.get("prompt")).toBe("select_account");
    const normal = new URL(githubAuthorizeUrl({ clientId: "Iv23.x", redirectUri: "https://f/cb", state: "s" }));
    expect(normal.searchParams.get("prompt")).toBeNull();
  });
});

describe("parseAppCredsJson", () => {
  it("exige clientId y secret", () => {
    expect(parseAppCredsJson("{}")).toBeNull();
    expect(parseAppCredsJson("no-json")).toBeNull();
    expect(parseAppCredsJson(JSON.stringify({ clientId: "Iv1.x", clientSecret: "s", slug: "forja" }))).toEqual({
      clientId: "Iv1.x",
      clientSecret: "s",
      slug: "forja",
    });
  });
});

describe("gh account storage", () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    const ls = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };
    Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true });
    Object.defineProperty(globalThis, "window", {
      value: { dispatchEvent: () => true },
      configurable: true,
    });
  });
  afterEach(() => {
    // restaurar no hace falta: el siguiente test redefine
  });

  it("roundtrip OAuth", () => {
    ghSetAccount({
      token: "gho_test",
      login: "ana",
      name: "Ana",
      avatar: "https://github.com/ana.png",
      source: "oauth",
    });
    expect(ghGetToken()).toBe("gho_test");
    expect(ghGetAccount()).toEqual({
      token: "gho_test",
      login: "ana",
      name: "Ana",
      avatar: "https://github.com/ana.png",
      source: "oauth",
    });
  });

  it("desconectar borra token y perfil", () => {
    ghSetToken("gho_x");
    ghSetAccount(null);
    expect(ghGetToken()).toBe("");
    expect(ghGetAccount()).toBeNull();
  });
});
