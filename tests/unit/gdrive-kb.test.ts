import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  categoryFromFolder,
  driveFileToKBResource,
  enrichFromForjaIndex,
  gdListFolderTree,
  gdReadKBFile,
  parseDriveId,
  type GDriveTreeFile,
} from "../../src/lib/forja/gdrive-kb";
import type { GDriveAccount } from "../../src/lib/forja/gdrive";

const FOLDER = "application/vnd.google-apps.folder";

function account(email: string, token: string): GDriveAccount {
  return { email, name: email, avatar: "", accessToken: token, expiresAt: Date.now() + 3600_000, quota: { limit: null, usage: 0, usageInDrive: 0 } };
}

function stubStorage(accounts: GDriveAccount[]) {
  const mem = new Map<string, string>([["forja-gdrive-accounts", JSON.stringify(accounts)]]);
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) },
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
}

function stubFetch(handler: (url: string, token: string) => { status?: number; json?: unknown; text?: string }) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const token = String((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "");
    const r = handler(url, token);
    const status = r.status ?? 200;
    const body = r.text ?? JSON.stringify(r.json ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(body),
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    } as unknown as Response;
  });
  Object.defineProperty(globalThis, "fetch", { value: fn, configurable: true });
  return fn;
}

const file = (path: string, over: Partial<GDriveTreeFile> = {}): GDriveTreeFile => ({
  id: over.id ?? path,
  name: path.split("/").pop()!,
  mimeType: "text/markdown",
  size: 10,
  modifiedTime: "",
  webViewLink: "",
  path,
  ...over,
});

describe("parseDriveId", () => {
  it("acepta enlaces de carpeta, de archivo, ?id= y el id suelto", () => {
    expect(parseDriveId("https://drive.google.com/drive/folders/1lNEdV7I18_zq3nVomjok76LwIr9P87uv?usp=sharing")).toBe("1lNEdV7I18_zq3nVomjok76LwIr9P87uv");
    expect(parseDriveId("https://drive.google.com/file/d/1X5YEpqjWrqCHlXcBJ1x22IDyokoJEgDy/view")).toBe("1X5YEpqjWrqCHlXcBJ1x22IDyokoJEgDy");
    expect(parseDriveId("https://drive.google.com/open?id=1X5YEpqjWrqCHlXcBJ1x22IDyokoJEgDy")).toBe("1X5YEpqjWrqCHlXcBJ1x22IDyokoJEgDy");
    expect(parseDriveId("  1X5YEpqjWrqCHlXcBJ1x22IDyokoJEgDy ")).toBe("1X5YEpqjWrqCHlXcBJ1x22IDyokoJEgDy");
  });
  it("rechaza lo que no es un id", () => {
    expect(parseDriveId("")).toBeNull();
    expect(parseDriveId("DISEÑO")).toBeNull();
    expect(parseDriveId("https://example.com/algo")).toBeNull();
  });
});

describe("driveFileToKBResource", () => {
  it("la carpeta de primer nivel es la categoría; área y subcarpetas, etiquetas", () => {
    expect(categoryFromFolder("07-COLOR")).toBe("color");
    expect(categoryFromFolder("23-PATRONES-A-EVITAR")).toBe("patrones-a-evitar");
    const r = driveFileToKBResource(file("DISEÑO/07-COLOR/contraste/contraste.md", { id: "abc" }), "vez@x.com", "2026-01-01");
    expect(r).toMatchObject({
      id: "abc",
      remoteId: "abc",
      accountEmail: "vez@x.com",
      category: "color",
      status: "clasificado",
      sourceProvider: "google-drive",
      sourceKind: "drive",
      relativePath: "DISEÑO/07-COLOR/contraste/contraste.md",
    });
    expect(r.tags).toEqual(expect.arrayContaining(["diseno", "contraste", "md"]));
  });
  it("un archivo suelto en la raíz queda pendiente, sin categoría inventada", () => {
    const r = driveFileToKBResource(file("DISEÑO/notas.md"), "vez@x.com");
    expect(r.category).toBe("");
    expect(r.status).toBe("pendiente");
  });
});

describe("enrichFromForjaIndex", () => {
  const base = [driveFileToKBResource(file("DISEÑO/07-COLOR/contraste/contraste.md", { id: "d1" }), "a@x.com"), driveFileToKBResource(file("DISEÑO/01-X/y.md", { id: "d2" }), "a@x.com")];
  it("suma etiquetas y licencia del INDEX.json de la cuenta, por drive_id", () => {
    const index = JSON.stringify({
      _schema: "Por defecto license=original-forja y status=approved",
      resources: [{ drive_id: "d1", tags: ["WCAG", "accesibilidad"], aliases: ["legibilidad"] }],
    });
    const { resources, enriched } = enrichFromForjaIndex(base, index);
    expect(enriched).toBe(1);
    expect(resources[0]!.tags).toEqual(expect.arrayContaining(["wcag", "accesibilidad", "legibilidad"]));
    expect(resources[0]!.license).toBe("original-forja");
    expect(resources[1]).toBe(base[1]);
  });
  it("un índice roto o con otra forma no cambia nada", () => {
    expect(enrichFromForjaIndex(base, "{no es json").enriched).toBe(0);
    expect(enrichFromForjaIndex(base, JSON.stringify({ otra: 1 })).resources).toBe(base);
  });
});

describe("gdListFolderTree", () => {
  beforeEach(() => stubStorage([]));

  it("recorre subcarpetas, pagina y se salta 99-INBOX", async () => {
    stubFetch((url) => {
      if (url.includes("/files/rootFolder01?")) return { json: { id: "rootFolder01", name: "DISEÑO", mimeType: FOLDER } };
      const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
      const token = new URL(url).searchParams.get("pageToken");
      if (q.includes("'rootFolder01'") && !token)
        return { json: { nextPageToken: "p2", files: [{ id: "c07", name: "07-COLOR", mimeType: FOLDER }, { id: "inbox", name: "99-INBOX", mimeType: FOLDER }] } };
      if (q.includes("'rootFolder01'") && token === "p2") return { json: { files: [{ id: "r", name: "README.md", mimeType: "text/markdown", size: "5" }] } };
      if (q.includes("'c07'")) return { json: { files: [{ id: "k", name: "contraste.md", mimeType: "text/markdown", size: "7" }] } };
      if (q.includes("'inbox'")) throw new Error("no debería listar la bandeja");
      return { json: { files: [] } };
    });
    const tree = await gdListFolderTree(account("a@x.com", "t"), null, "rootFolder01");
    expect(tree.rootName).toBe("DISEÑO");
    expect(tree.files.map((f) => f.path).sort()).toEqual(["DISEÑO/07-COLOR/contraste.md", "DISEÑO/README.md"]);
    expect(tree.files.find((f) => f.id === "k")?.size).toBe(7);
    expect(tree.truncated).toBe(false);
  });

  it("un enlace a un archivo (no carpeta) se rechaza con un mensaje claro", async () => {
    stubFetch(() => ({ json: { id: "x", name: "a.md", mimeType: "text/markdown" } }));
    await expect(gdListFolderTree(account("a@x.com", "t"), null, "fileNotFolder1")).rejects.toThrow(/no es una carpeta/);
  });

  it("respeta el tope de archivos y lo avisa", async () => {
    stubFetch((url) => {
      if (url.includes("/files/rootFolder01?")) return { json: { id: "rootFolder01", name: "R", mimeType: FOLDER } };
      return { json: { files: [1, 2, 3].map((i) => ({ id: `f${i}`, name: `${i}.md`, mimeType: "text/markdown" })) } };
    });
    const tree = await gdListFolderTree(account("a@x.com", "t"), null, "rootFolder01", { maxFiles: 2 });
    expect(tree.files).toHaveLength(2);
    expect(tree.truncated).toBe(true);
  });
});

describe("gdReadKBFile — varias cuentas", () => {
  const res = { id: "f1", remoteId: "f1", accountEmail: "diseno@x.com", mimeType: "text/markdown", name: "contraste.md" };

  it("lee con la cuenta que indexó el archivo", async () => {
    stubStorage([account("codigo@x.com", "tok-b"), account("diseno@x.com", "tok-a")]);
    const f = stubFetch((url, token) => (token === "tok-a" && url.includes("/files/f1?alt=media") ? { text: "# Contraste" } : { status: 404 }));
    const bytes = await gdReadKBFile(res);
    expect(new TextDecoder().decode(bytes)).toBe("# Contraste");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("si la cuenta dueña no puede, prueba con las demás conectadas", async () => {
    stubStorage([account("diseno@x.com", "tok-a"), account("otra@x.com", "tok-b")]);
    stubFetch((_url, token) => (token === "tok-b" ? { text: "compartido" } : { status: 403 }));
    expect(new TextDecoder().decode(await gdReadKBFile(res))).toBe("compartido");
  });

  it("si la cuenta dueña no está conectada y nadie puede leerlo, lo dice", async () => {
    stubStorage([account("otra@x.com", "tok-b")]);
    stubFetch(() => ({ status: 404 }));
    await expect(gdReadKBFile(res)).rejects.toThrow(/diseno@x.com, que no está conectada/);
  });

  it("sin cuentas conectadas falla con un mensaje claro", async () => {
    stubStorage([]);
    await expect(gdReadKBFile(res)).rejects.toThrow(/ninguna cuenta/);
  });

  it("exporta los documentos nativos de Google a texto", async () => {
    stubStorage([account("diseno@x.com", "tok-a")]);
    const f = stubFetch((url) => (url.includes("/export?mimeType=text%2Fplain") ? { text: "doc" } : { status: 400 }));
    const bytes = await gdReadKBFile({ ...res, mimeType: "application/vnd.google-apps.document" });
    expect(new TextDecoder().decode(bytes)).toBe("doc");
    expect(String(f.mock.calls[0]![0])).toContain("/files/f1/export");
  });

  it("un tipo nativo sin versión en texto no se intenta descargar", async () => {
    stubStorage([account("diseno@x.com", "tok-a")]);
    const f = stubFetch(() => ({ text: "" }));
    await expect(gdReadKBFile({ ...res, mimeType: "application/vnd.google-apps.form" })).rejects.toThrow(/sin versión en texto/);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("gdListFolderTree — id", () => {
  it("rechaza un id con caracteres que no son de Drive sin llamar a la API", async () => {
    stubStorage([]);
    const f = stubFetch(() => ({ json: {} }));
    await expect(gdListFolderTree(account("a@x.com", "t"), null, "abc' or '1'='1")).rejects.toThrow(/no válido/);
    expect(f).not.toHaveBeenCalled();
  });
});
