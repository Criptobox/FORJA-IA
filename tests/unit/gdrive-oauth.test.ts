import { describe, it, expect } from "vitest";
import {
  formatBytes,
  googleAuthorizeUrl,
  parseGoogleTokenResponse,
  quotaPercent,
} from "../../src/lib/forja/gdrive-oauth";

describe("parseGoogleTokenResponse", () => {
  it("lee JSON con access_token y refresh_token", () => {
    const r = parseGoogleTokenResponse(
      JSON.stringify({ access_token: "ya29.x", refresh_token: "1//abc", expires_in: 3599 })
    );
    expect(r.access_token).toBe("ya29.x");
    expect(r.refresh_token).toBe("1//abc");
    expect(r.expires_in).toBe(3599);
  });
  it("propaga error de Google", () => {
    const r = parseGoogleTokenResponse(JSON.stringify({ error: "invalid_grant", error_description: "Bad Request" }));
    expect(r.error).toBe("invalid_grant");
    expect(r.access_token).toBeUndefined();
  });
  it("cuerpo vacío", () => {
    expect(parseGoogleTokenResponse("").error).toBe("empty");
  });
  it("JSON ilegible", () => {
    expect(parseGoogleTokenResponse("no-json").error).toBe("invalid_json");
  });
});

describe("googleAuthorizeUrl", () => {
  it("pide acceso offline y refresh_token siempre (prompt=consent)", () => {
    const u = new URL(
      googleAuthorizeUrl({
        clientId: "123.apps.googleusercontent.com",
        redirectUri: "https://app.example/api/gdrive/oauth/callback",
        state: "abc",
      })
    );
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive");
    expect(u.searchParams.get("state")).toBe("abc");
    expect(u.searchParams.get("code_challenge")).toBeNull();
  });
  it("con challenge, manda PKCE", () => {
    const u = new URL(
      googleAuthorizeUrl({
        clientId: "123",
        redirectUri: "https://app.example/cb",
        state: "s",
        challenge: "chal",
      })
    );
    expect(u.searchParams.get("code_challenge")).toBe("chal");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("formatBytes", () => {
  it("formatea unidades crecientes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
    expect(formatBytes(15 * 1024 ** 3)).toBe("15 GB");
  });
  it("valores no finitos o negativos caen a 0 B", () => {
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
  });
});

describe("quotaPercent", () => {
  it("calcula porcentaje con límite", () => {
    expect(quotaPercent({ limit: 100, usage: 40, usageInDrive: 40 })).toBe(40);
  });
  it("sin límite (Workspace ilimitado) devuelve null", () => {
    expect(quotaPercent({ limit: null, usage: 999, usageInDrive: 999 })).toBeNull();
  });
  it("no supera 100", () => {
    expect(quotaPercent({ limit: 10, usage: 999, usageInDrive: 999 })).toBe(100);
  });
});
