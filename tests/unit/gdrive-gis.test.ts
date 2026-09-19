import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadGis, requestGoogleToken } from "../../src/lib/forja/gdrive-gis";

/** `google.accounts.oauth2` no existe en node: se simula tal cual la
 * documenta Google (initTokenClient devuelve un objeto con
 * requestAccessToken, que dispara callback o error_callback). */
function stubGis(behavior: (cfg: {
  callback: (r: unknown) => void;
  error_callback: (e: unknown) => void;
}) => void) {
  const initTokenClient = vi.fn((cfg: Parameters<typeof behavior>[0]) => ({
    requestAccessToken: () => behavior(cfg),
  }));
  Object.defineProperty(globalThis, "window", {
    value: {
      google: { accounts: { oauth2: { initTokenClient } } },
      document: { querySelector: () => null, head: { appendChild: () => {} } },
    },
    configurable: true,
  });
  return initTokenClient;
}

beforeEach(() => {
  Object.defineProperty(globalThis, "document", {
    value: { querySelector: () => null, head: { appendChild: () => {} }, createElement: () => ({}) },
    configurable: true,
  });
});

describe("loadGis", () => {
  it("si google.accounts.oauth2 ya existe, no inyecta nada", async () => {
    stubGis(() => {});
    await expect(loadGis()).resolves.toBeUndefined();
  });
});

describe("requestGoogleToken", () => {
  it("resuelve con el token cuando Google responde bien", async () => {
    stubGis((cfg) => cfg.callback({ access_token: "ya29.x", expires_in: 3599 }));
    const res = await requestGoogleToken({ clientId: "cid", scope: "drive", interactive: true });
    expect(res).toEqual({ accessToken: "ya29.x", expiresIn: 3599 });
  });

  it("sin expires_in, usa 3600 por defecto", async () => {
    stubGis((cfg) => cfg.callback({ access_token: "ya29.x" }));
    const res = await requestGoogleToken({ clientId: "cid", scope: "drive", interactive: false });
    expect(res.expiresIn).toBe(3600);
  });

  it("rechaza si la respuesta trae error", async () => {
    stubGis((cfg) => cfg.callback({ error: "access_denied", error_description: "El usuario canceló" }));
    await expect(requestGoogleToken({ clientId: "cid", scope: "drive", interactive: true })).rejects.toThrow(
      "El usuario canceló"
    );
  });

  it("rechaza si Google dispara error_callback", async () => {
    stubGis((cfg) => cfg.error_callback({ type: "popup_closed" }));
    await expect(requestGoogleToken({ clientId: "cid", scope: "drive", interactive: true })).rejects.toThrow(
      "popup_closed"
    );
  });

  it("pide select_account cuando es interactivo, y prompt vacío cuando es silencioso", async () => {
    const calls: string[] = [];
    const initTokenClient = vi.fn((cfg: { prompt?: string; callback: (r: unknown) => void }) => {
      calls.push(cfg.prompt ?? "");
      return { requestAccessToken: () => cfg.callback({ access_token: "x", expires_in: 10 }) };
    });
    Object.defineProperty(globalThis, "window", {
      value: { google: { accounts: { oauth2: { initTokenClient } } } },
      configurable: true,
    });
    await requestGoogleToken({ clientId: "cid", scope: "drive", interactive: true });
    await requestGoogleToken({ clientId: "cid", scope: "drive", interactive: false });
    expect(calls).toEqual(["select_account", ""]);
  });
});
