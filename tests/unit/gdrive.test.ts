import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  gdEnsureFreshToken,
  gdGetAccounts,
  gdIsTokenExpired,
  gdListRecentFiles,
  gdRemoveAccount,
  gdUpsertAccount,
  type GDriveAccount,
} from "../../src/lib/forja/gdrive";

const account: GDriveAccount = {
  email: "ana@example.com",
  name: "Ana",
  avatar: "https://x/a.png",
  accessToken: "ya29.old",
  refreshToken: "1//refresh",
  expiresAt: Date.now() + 3600_000,
  quota: { limit: 100, usage: 40, usageInDrive: 40 },
};

describe("cuentas de Google Drive (localStorage)", () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
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

  it("añade, actualiza y elimina cuentas por email", () => {
    expect(gdGetAccounts()).toEqual([]);
    gdUpsertAccount(account);
    expect(gdGetAccounts()).toEqual([account]);

    const actualizada = { ...account, quota: { limit: 100, usage: 90, usageInDrive: 90 } };
    gdUpsertAccount(actualizada);
    expect(gdGetAccounts()).toEqual([actualizada]);

    gdUpsertAccount({ ...account, email: "otra@example.com" });
    expect(gdGetAccounts()).toHaveLength(2);

    gdRemoveAccount("ana@example.com");
    expect(gdGetAccounts().map((a) => a.email)).toEqual(["otra@example.com"]);
  });

  it("localStorage con basura no rompe la lectura", () => {
    localStorage.setItem("forja-gdrive-accounts", "no-json");
    expect(gdGetAccounts()).toEqual([]);
  });
});

describe("gdIsTokenExpired", () => {
  it("token todavía vigente", () => {
    expect(gdIsTokenExpired({ ...account, expiresAt: Date.now() + 10 * 60_000 })).toBe(false);
  });
  it("token caducado o a punto de caducar (margen de 1 min)", () => {
    expect(gdIsTokenExpired({ ...account, expiresAt: Date.now() - 1000 })).toBe(true);
    expect(gdIsTokenExpired({ ...account, expiresAt: Date.now() + 10_000 })).toBe(true);
  });
});

describe("gdEnsureFreshToken", () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mem.set(k, v);
        },
        removeItem: (k: string) => mem.delete(k),
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: { dispatchEvent: () => true },
      configurable: true,
    });
  });

  it("token vigente: no llama a /refresh", async () => {
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    const fresh = { ...account, expiresAt: Date.now() + 10 * 60_000 };
    const out = await gdEnsureFreshToken(fresh);
    expect(out).toBe(fresh);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token caducado: pide uno nuevo y actualiza la cuenta guardada", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "ya29.new", expiresIn: 3600 }),
    });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    const expired = { ...account, expiresAt: Date.now() - 1000 };
    gdUpsertAccount(expired);
    const out = await gdEnsureFreshToken(expired);
    expect(out.accessToken).toBe("ya29.new");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gdrive/oauth/refresh",
      expect.objectContaining({ method: "POST" })
    );
    expect(gdGetAccounts()[0]?.accessToken).toBe("ya29.new");
  });

  it("si el servidor no puede renovar, lanza el error tal cual", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "invalid_grant" }),
    });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    const expired = { ...account, expiresAt: Date.now() - 1000 };
    await expect(gdEnsureFreshToken(expired)).rejects.toThrow("invalid_grant");
  });
});

describe("gdListRecentFiles", () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mem.set(k, v);
        },
        removeItem: (k: string) => mem.delete(k),
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: { dispatchEvent: () => true },
      configurable: true,
    });
  });

  it("pide los archivos a la API de Drive con el token vigente", async () => {
    const vigente = { ...account, expiresAt: Date.now() + 3600_000 };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [
          {
            id: "1",
            name: "diseño.png",
            mimeType: "image/png",
            size: "2048",
            modifiedTime: "2026-01-01T00:00:00Z",
            iconLink: "https://x/icon.png",
            webViewLink: "https://drive.google.com/1",
          },
        ],
      }),
    });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    const files = await gdListRecentFiles(vigente);
    expect(files).toEqual([
      {
        id: "1",
        name: "diseño.png",
        mimeType: "image/png",
        size: 2048,
        modifiedTime: "2026-01-01T00:00:00Z",
        iconLink: "https://x/icon.png",
        webViewLink: "https://drive.google.com/1",
      },
    ]);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://www.googleapis.com/drive/v3/files?");
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer ya29.old");
  });

  it("si Drive falla, lanza un error legible", async () => {
    const vigente = { ...account, expiresAt: Date.now() + 3600_000 };
    Object.defineProperty(globalThis, "fetch", {
      value: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
      configurable: true,
    });
    await expect(gdListRecentFiles(vigente)).rejects.toThrow("No se pudo leer los archivos de Drive");
  });
});
