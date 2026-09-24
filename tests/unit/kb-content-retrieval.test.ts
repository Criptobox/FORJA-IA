import { describe, expect, it, vi, beforeEach } from "vitest";
import { readKBResource, retrieveKBContent, kbContentContext, interleaveByProvider } from "@/lib/forja/kb-content-retrieval";
import type { KBResource } from "@/lib/forja/kb-index";
import type { KBRetrievalResult } from "@/lib/forja/knowledge-retrieval";

const readMock = vi.fn();
const driveReadMock = vi.fn();

vi.mock("@/lib/forja/mega-provider", () => ({
  createMegaProvider: () => ({ read: readMock }),
}));

vi.mock("@/lib/forja/gdrive-kb", () => ({
  gdReadKBFile: (r: unknown) => driveReadMock(r),
}));

function megaResource(overrides: Partial<KBResource> = {}): KBResource {
  return {
    id: "mega:1",
    name: "ProductCard.tsx",
    mimeType: "text/plain",
    sizeBytes: 100,
    accountEmail: "dev@example.com",
    webViewLink: "",
    category: "codigo",
    tags: ["react"],
    technology: "React",
    license: "",
    status: "clasificado",
    indexedAt: new Date().toISOString(),
    relativePath: "shop/src/components/ProductCard.tsx",
    sourceKind: "mega",
    sourceProvider: "mega",
    remoteId: "1",
    ...overrides,
  };
}

function driveResource(overrides: Partial<KBResource> = {}): KBResource {
  return {
    id: "drive:1",
    name: "logo.png",
    mimeType: "image/png",
    sizeBytes: 2000,
    accountEmail: "ana@example.com",
    webViewLink: "",
    category: "assets",
    tags: [],
    technology: "",
    license: "",
    status: "clasificado",
    indexedAt: new Date().toISOString(),
    sourceKind: "drive",
    sourceProvider: "google-drive",
    ...overrides,
  };
}

function hitFor(resource: KBResource, score = 5): KBRetrievalResult {
  return { resource, score, reasons: ["nombre"] };
}

describe("readKBResource", () => {
  beforeEach(() => { readMock.mockReset(); driveReadMock.mockReset(); });

  it("un recurso sin proveedor remoto legible no finge tener un lector", async () => {
    const hit = await readKBResource(driveResource({ sourceProvider: "url", sourceKind: "url", name: "a.md", mimeType: "text/markdown" }));
    expect(hit.content).toBeUndefined();
    expect(hit.skipped).toMatch(/no tiene un lector remoto/);
    expect(readMock).not.toHaveBeenCalled();
    expect(driveReadMock).not.toHaveBeenCalled();
  });

  it("lee una ficha .md de Google Drive con su cuenta", async () => {
    driveReadMock.mockReset();
    driveReadMock.mockResolvedValue(new TextEncoder().encode("# Contraste\nMínimo 4.5:1"));
    const r = driveResource({ id: "d-md", name: "contraste.md", mimeType: "text/markdown", remoteId: "d-md" });
    const hit = await readKBResource(r);
    expect(driveReadMock).toHaveBeenCalledWith(r);
    expect(hit.content).toContain("4.5:1");
    expect(hit.reasons).toContain("contenido remoto Google Drive");
  });

  it("lee .jsonl de Drive (datasets) y recursos antiguos sin sourceProvider", async () => {
    driveReadMock.mockReset();
    driveReadMock.mockResolvedValue(new TextEncoder().encode('{"id":"dd-001"}'));
    const jsonl = await readKBResource(driveResource({ name: "design-decisions.jsonl", mimeType: "application/octet-stream" }));
    expect(jsonl.content).toContain("dd-001");
    const antiguo = await readKBResource(driveResource({ name: "notas.md", mimeType: "text/markdown", sourceProvider: undefined, sourceKind: "upload" }));
    expect(antiguo.content).toContain("dd-001");
  });

  it("un Google Doc nativo se considera texto", async () => {
    driveReadMock.mockReset();
    driveReadMock.mockResolvedValue(new TextEncoder().encode("texto del doc"));
    const hit = await readKBResource(driveResource({ name: "Guía", mimeType: "application/vnd.google-apps.document" }));
    expect(hit.content).toBe("texto del doc");
  });

  it("MEGA es solo código: un .txt o .csv de MEGA no se lee", async () => {
    const hit = await readKBResource(megaResource({ name: "notas.txt" }));
    expect(hit.skipped).toMatch(/solo para código/);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("un binario no se descarga como si fuera texto, venga de MEGA o de Drive", async () => {
    const hit = await readKBResource(megaResource({ name: "logo.js.png", mimeType: "image/png" }));
    expect(hit.skipped).toMatch(/binario|solo para código/);
    const img = await readKBResource(driveResource());
    expect(img.content).toBeUndefined();
    expect(img.skipped).toMatch(/binario/);
    expect(readMock).not.toHaveBeenCalled();
    expect(driveReadMock).not.toHaveBeenCalled();
  });

  it("respeta el límite de tamaño por metadato sin llegar a descargar", async () => {
    const hit = await readKBResource(megaResource({ sizeBytes: 10 * 1024 * 1024 }), { maxBytesPerFile: 5 * 1024 * 1024 });
    expect(hit.skipped).toMatch(/demasiado grande/);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("lee de verdad un archivo de texto de MEGA y recorta si excede el tope por archivo", async () => {
    readMock.mockResolvedValue(new TextEncoder().encode("a".repeat(20000)));
    const hit = await readKBResource(megaResource(), { maxCharsPerFile: 100, maxBytesPerFile: 5 * 1024 * 1024 });
    expect(readMock).toHaveBeenCalledWith("1");
    expect(hit.content).toBeDefined();
    expect(hit.content!.length).toBeLessThanOrEqual(100);
    expect(hit.content).toContain("recortado por Forja");
  });
});

describe("retrieveKBContent", () => {
  beforeEach(() => { readMock.mockReset(); driveReadMock.mockReset(); });

  it("alterna Drive y MEGA para que el código no se coma el cupo del conocimiento", async () => {
    readMock.mockResolvedValue(new TextEncoder().encode("codigo"));
    driveReadMock.mockResolvedValue(new TextEncoder().encode("ficha"));
    const results = [
      hitFor(megaResource({ id: "m1", name: "A.tsx" }), 9),
      hitFor(megaResource({ id: "m2", name: "B.tsx" }), 8),
      hitFor(megaResource({ id: "m3", name: "C.tsx" }), 7),
      hitFor(driveResource({ id: "d1", name: "jerarquia.md", mimeType: "text/markdown" }), 3),
    ];
    const hits = await retrieveKBContent(results, { maxFiles: 2 });
    expect(hits.filter((h) => h.content).map((h) => h.resource.id)).toEqual(["m1", "d1"]);
    const sinBalance = await retrieveKBContent(results, { maxFiles: 2, balanceProviders: false });
    expect(sinBalance.filter((h) => h.content).map((h) => h.resource.id)).toEqual(["m1", "m2"]);
  });

  it("interleaveByProvider conserva el orden dentro de cada proveedor", () => {
    const r = [hitFor(megaResource({ id: "m1" })), hitFor(megaResource({ id: "m2" })), hitFor(driveResource({ id: "d1" })), hitFor(driveResource({ id: "d2" }))];
    expect(interleaveByProvider(r).map((x) => x.resource.id)).toEqual(["m1", "d1", "m2", "d2"]);
    const solo = [hitFor(megaResource({ id: "m1" }))];
    expect(interleaveByProvider(solo)).toBe(solo);
  });

  it("no agota el cupo de `maxFiles` en candidatos sin lector remoto: sigue buscando hasta encontrar código real", async () => {
    readMock.mockResolvedValue(new TextEncoder().encode("export const x = 1;"));
    // Tres candidatos de Drive (sin lector remoto) por delante de uno de MEGA
    // en el ranking. Con el cupo mal aplicado, `maxFiles: 1` se habría
    // gastado en el primer Drive y nunca habría llegado al de MEGA.
    const results = [
      hitFor(driveResource({ id: "d1", name: "a.png" }), 9),
      hitFor(driveResource({ id: "d2", name: "b.png" }), 8),
      hitFor(driveResource({ id: "d3", name: "c.png" }), 7),
      hitFor(megaResource({ id: "mega:1", name: "Real.tsx" }), 6),
    ];
    const hits = await retrieveKBContent(results, { maxFiles: 1 });
    const conContenido = hits.filter((h) => h.content);
    expect(conContenido).toHaveLength(1);
    expect(conContenido[0]?.resource.name).toBe("Real.tsx");
  });

  it("se detiene tras `maxFiles` archivos con contenido real, no tras `maxFiles` intentos", async () => {
    readMock.mockResolvedValue(new TextEncoder().encode("codigo"));
    const results = [
      hitFor(megaResource({ id: "mega:1", name: "Uno.tsx" })),
      hitFor(megaResource({ id: "mega:2", name: "Dos.tsx" })),
      hitFor(megaResource({ id: "mega:3", name: "Tres.tsx" })),
    ];
    const hits = await retrieveKBContent(results, { maxFiles: 2 });
    expect(hits.filter((h) => h.content)).toHaveLength(2);
  });

  it("respeta el tope total de caracteres entre todos los archivos", async () => {
    readMock.mockResolvedValue(new TextEncoder().encode("x".repeat(500)));
    const results = [
      hitFor(megaResource({ id: "mega:1", name: "Uno.tsx" })),
      hitFor(megaResource({ id: "mega:2", name: "Dos.tsx" })),
    ];
    const hits = await retrieveKBContent(results, { maxFiles: 5, maxCharsPerFile: 500, maxTotalChars: 600 });
    const total = hits.reduce((n, h) => n + (h.content?.length ?? 0), 0);
    expect(total).toBeLessThanOrEqual(600);
  });

  it("un error real al leer se registra como omitido, no interrumpe el resto", async () => {
    readMock.mockRejectedValueOnce(new Error("MEGA no está conectado."));
    readMock.mockResolvedValueOnce(new TextEncoder().encode("ok"));
    const results = [
      hitFor(megaResource({ id: "mega:1", name: "Falla.tsx" })),
      hitFor(megaResource({ id: "mega:2", name: "Bien.tsx" })),
    ];
    const hits = await retrieveKBContent(results);
    expect(hits[0]?.skipped).toMatch(/no está conectado/);
    expect(hits[1]?.content).toBe("ok");
  });
});

describe("kbContentContext", () => {
  it("nombra la cuenta de Drive de la que sale cada ficha", () => {
    const ctx = kbContentContext([{ resource: driveResource({ name: "contraste.md" }), score: 5, reasons: [], content: "Mínimo 4.5:1" }]);
    expect(ctx).toContain("Fuente: Google Drive (ana@example.com)");
  });

  it("renderiza solo contenido recuperado, conserva la ruta y nombra el proveedor real", () => {
    const ctx = kbContentContext([
      { resource: megaResource(), score: 8, reasons: ["nombre"], content: "export function ProductCard() {}" },
    ]);
    expect(ctx).toContain("ProductCard.tsx");
    expect(ctx).toContain("shop/src/components/ProductCard.tsx");
    expect(ctx).toContain("export function ProductCard");
    expect(ctx).toContain("Fuente: MEGA");
  });

  it("no inserta un archivo que fue omitido", () => {
    const ctx = kbContentContext([{ resource: megaResource(), score: 2, reasons: [], skipped: "demasiado grande" }]);
    expect(ctx).toContain("no leído");
    expect(ctx).not.toContain("export function ProductCard");
  });
});
