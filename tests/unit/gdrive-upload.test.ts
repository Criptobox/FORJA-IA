import { describe, it, expect, beforeEach, vi } from "vitest";
import { findOrCreateFolder, pickAccountWithMostSpace, uploadFileToDrive } from "../../src/lib/forja/gdrive-upload";
import type { GDriveAccount, GDriveCreds } from "../../src/lib/forja/gdrive";

const creds: GDriveCreds = { clientId: "cid", apiKey: "key" };

function account(overrides: Partial<GDriveAccount> = {}): GDriveAccount {
  return {
    email: "ana@example.com",
    name: "Ana",
    avatar: "",
    accessToken: "ya29.fresh",
    expiresAt: Date.now() + 3600_000,
    quota: { limit: 100, usage: 40, usageInDrive: 40 },
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
});

describe("findOrCreateFolder", () => {
  it("si la carpeta ya existe, la reutiliza sin crear otra", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: [{ id: "folder-1", name: "componentes" }] }),
    });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    const { folderId } = await findOrCreateFolder(account(), creds, "componentes");
    expect(folderId).toBe("folder-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("https://www.googleapis.com/drive/v3/files?");
  });

  it("si no existe, la crea", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "folder-nuevo" }) });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    const { folderId } = await findOrCreateFolder(account(), creds, "visual");
    expect(folderId).toBe("folder-nuevo");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, createOpts] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(createOpts.method).toBe("POST");
    const body = JSON.parse(createOpts.body as string);
    expect(body).toMatchObject({ name: "visual", mimeType: "application/vnd.google-apps.folder", parents: ["root"] });
  });

  it("escapa comillas simples en el nombre para no romper la query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ files: [{ id: "x" }] }) });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    await findOrCreateFolder(account(), creds, "juan's docs");
    const [url] = fetchMock.mock.calls[0] as [string];
    // URLSearchParams codifica los espacios como "+", que decodeURIComponent
    // no revierte (no es su trabajo) — se normaliza aquí solo para leer la query.
    const decoded = decodeURIComponent(url.replace(/\+/g, " "));
    expect(decoded).toContain("juan\\'s docs");
  });

  it("si Drive falla al buscar, lanza un error legible", async () => {
    Object.defineProperty(globalThis, "fetch", {
      value: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
      configurable: true,
    });
    await expect(findOrCreateFolder(account(), creds, "x")).rejects.toThrow("No se pudo buscar la carpeta");
  });
});

describe("uploadFileToDrive", () => {
  it("sube el archivo como multipart y devuelve id + webViewLink", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "file-1", webViewLink: "https://drive.google.com/file/d/1" }),
    });
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
    const file = new File(["contenido"], "notas.txt", { type: "text/plain" });
    const acc = account();
    const res = await uploadFileToDrive(acc, creds, file, "folder-1");
    expect(res).toEqual({ id: "file-1", webViewLink: "https://drive.google.com/file/d/1", account: acc });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("uploadType=multipart");
    expect((opts.headers as Record<string, string>)["Content-Type"]).toMatch(/^multipart\/related; boundary=/);
  });

  it("si Drive rechaza la subida, lanza un error legible", async () => {
    Object.defineProperty(globalThis, "fetch", {
      value: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
      configurable: true,
    });
    const file = new File(["x"], "a.txt");
    await expect(uploadFileToDrive(account(), creds, file, "folder-1")).rejects.toThrow("No se pudo subir");
  });
});

describe("pickAccountWithMostSpace", () => {
  it("elige la cuenta con más espacio libre", () => {
    const a = account({ email: "llena@example.com", quota: { limit: 100, usage: 95, usageInDrive: 95 } });
    const b = account({ email: "libre@example.com", quota: { limit: 100, usage: 10, usageInDrive: 10 } });
    expect(pickAccountWithMostSpace([a, b])?.email).toBe("libre@example.com");
  });

  it("una cuenta sin límite (Workspace ilimitado) siempre gana", () => {
    const limitada = account({ email: "limitada@example.com", quota: { limit: 100, usage: 5, usageInDrive: 5 } });
    const ilimitada = account({ email: "ilimitada@example.com", quota: { limit: null, usage: 999999, usageInDrive: 999999 } });
    expect(pickAccountWithMostSpace([limitada, ilimitada])?.email).toBe("ilimitada@example.com");
  });

  it("sin cuentas, devuelve undefined", () => {
    expect(pickAccountWithMostSpace([])).toBeUndefined();
  });
});
