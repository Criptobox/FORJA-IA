import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  gdCredsSource,
  gdClearCreds,
  gdEnsureFreshToken,
  gdGetAccounts,
  gdGetCreds,
  gdIsTokenExpired,
  gdListRecentFiles,
  gdRemoveAccount,
  gdSetCreds,
  gdUpsertAccount,
  type GDriveAccount,
  type GDriveCreds,
} from "../../src/lib/forja/gdrive";

const account: GDriveAccount = {
  email: "ana@example.com",
  name: "Ana",
  avatar: "https://x/a.png",
  accessToken: "ya29.old",
  expiresAt: Date.now() + 3600_000,
  quota: { limit: 100, usage: 40, usageInDrive: 40 },
};

const creds: GDriveCreds = { clientId: "cid-123", apiKey: "AIza-x" };

function stubLocalStorage() {
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
  return ls;
}

/** Simula `google.accounts.oauth2.initTokenClient(...).requestAccessToken()`
 * respondiendo de inmediato con el token indicado. */
function stubGisSuccess(accessToken: string, expiresIn = 3600) {
  const initTokenClient = vi.fn((cfg: { callback: (r: unknown) => void }) => ({
    requestAccessToken: () => cfg.callback({ access_token: accessToken, expires_in: expiresIn }),
  }));
  Object.defineProperty(globalThis, "window", {
    value: { google: { accounts: { oauth2: { initTokenClient } } }, dispatchEvent: () => true },
    configurable: true,
  });
  return initTokenClient;
}

describe("cuentas de Google Drive (localStorage)", () => {
  beforeEach(() => {
    stubLocalStorage();
    Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
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

describe("credenciales de Google (localStorage, sin secretos que proteger)", () => {
  const ENV_KEYS = ["NEXT_PUBLIC_GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_API_KEY"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    stubLocalStorage();
    Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("sin nada guardado, no hay credenciales", () => {
    expect(gdGetCreds()).toBeNull();
    expect(gdCredsSource()).toBeNull();
  });

  it("guarda y olvida credenciales pegadas a mano", () => {
    gdSetCreds(creds);
    expect(gdGetCreds()).toEqual(creds);
    expect(gdCredsSource()).toBe("local");
    gdClearCreds();
    expect(gdGetCreds()).toBeNull();
  });

  it("las variables de entorno del despliegue ganan sobre lo pegado a mano", () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "env-cid";
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY = "env-key";
    gdSetCreds(creds);
    expect(gdGetCreds()).toEqual({ clientId: "env-cid", apiKey: "env-key", appId: undefined });
    expect(gdCredsSource()).toBe("env");
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
    stubLocalStorage();
  });

  it("token vigente: no pide uno nuevo a Google", async () => {
    const initTokenClient = stubGisSuccess("ya29.new");
    const fresh = { ...account, expiresAt: Date.now() + 10 * 60_000 };
    const out = await gdEnsureFreshToken(fresh, creds);
    expect(out).toBe(fresh);
    expect(initTokenClient).not.toHaveBeenCalled();
  });

  it("token caducado: pide uno nuevo en silencio y actualiza la cuenta guardada", async () => {
    stubGisSuccess("ya29.new", 1800);
    const expired = { ...account, expiresAt: Date.now() - 1000 };
    gdUpsertAccount(expired);
    const out = await gdEnsureFreshToken(expired, creds);
    expect(out.accessToken).toBe("ya29.new");
    expect(gdGetAccounts()[0]?.accessToken).toBe("ya29.new");
  });

  it("si Google no puede renovar en silencio, lanza el error tal cual", async () => {
    const initTokenClient = vi.fn((cfg: { error_callback: (e: unknown) => void }) => ({
      requestAccessToken: () => cfg.error_callback({ type: "interaction_required" }),
    }));
    Object.defineProperty(globalThis, "window", {
      value: { google: { accounts: { oauth2: { initTokenClient } } }, dispatchEvent: () => true },
      configurable: true,
    });
    const expired = { ...account, expiresAt: Date.now() - 1000 };
    await expect(gdEnsureFreshToken(expired, creds)).rejects.toThrow("interaction_required");
  });
});

describe("gdListRecentFiles", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("pide los archivos a la API de Drive con el token vigente", async () => {
    const vigente = { ...account, expiresAt: Date.now() + 3600_000 };
    Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
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
    const files = await gdListRecentFiles(vigente, creds);
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
    Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
    Object.defineProperty(globalThis, "fetch", {
      value: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
      configurable: true,
    });
    await expect(gdListRecentFiles(vigente, creds)).rejects.toThrow("No se pudo leer los archivos de Drive");
  });
});
