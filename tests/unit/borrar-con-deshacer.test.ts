/** Forja IA — Borrar una conversación o un mensaje se puede deshacer.
 *
 * Antes era de un toque e irreversible: el store purgaba al instante los
 * binarios de IndexedDB, así que ni siquiera restaurando el JSON volvían las
 * imágenes. Ahora la purga espera a que caduque la ventana de deshacer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ChatMessage, Session } from "../../src/lib/forja/types";

const borrados: string[] = [];
vi.mock("../../src/lib/forja/attachment-blob", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/forja/attachment-blob")>()),
  deleteBlob: async (id: string) => {
    borrados.push(id);
  },
}));

const { useForja } = await import("../../src/lib/forja/store");

function msg(id: string, role: "user" | "assistant", blobId?: string): ChatMessage {
  return {
    id,
    role,
    content: `contenido ${id}`,
    createdAt: 0,
    ...(blobId ? { attachments: [{ id: `a-${id}`, name: "foto.png", mediaType: "image/png", blobId }] } : {}),
  } as ChatMessage;
}

function sesion(id: string, messages: ChatMessage[]): Session {
  return { id, title: id, createdAt: 0, updatedAt: 0, messages };
}

beforeEach(() => {
  vi.useFakeTimers();
  borrados.length = 0;
  useForja.setState({
    sessions: [
      sesion("s1", [msg("m1", "user", "blob-1"), msg("m2", "assistant")]),
      sesion("s2", [msg("m3", "user", "blob-2")]),
      sesion("s3", []),
    ],
    activeSessionId: "s2",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("deleteSessionUndoable", () => {
  it("deshacer devuelve la conversación a su sitio, activa y sin purgar binarios", () => {
    const deshacer = useForja.getState().deleteSessionUndoable("s2", 6000);
    expect(useForja.getState().sessions.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(useForja.getState().activeSessionId).toBe("s1");

    deshacer();
    expect(useForja.getState().sessions.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(useForja.getState().activeSessionId).toBe("s2");

    vi.advanceTimersByTime(10_000);
    expect(borrados, "la imagen sigue en IndexedDB").toEqual([]);
  });

  it("sin deshacer, los binarios se purgan al caducar la ventana, no antes", () => {
    useForja.getState().deleteSessionUndoable("s2", 6000);
    vi.advanceTimersByTime(5999);
    expect(borrados).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(borrados).toEqual(["blob-2"]);
  });

  it("deshacer tarde no resucita nada", () => {
    const deshacer = useForja.getState().deleteSessionUndoable("s2", 6000);
    vi.advanceTimersByTime(6000);
    deshacer();
    expect(useForja.getState().sessions.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("borrar una conversación que no está no hace nada", () => {
    const deshacer = useForja.getState().deleteSessionUndoable("no-existe", 6000);
    deshacer();
    expect(useForja.getState().sessions).toHaveLength(3);
  });
});

describe("deleteMessageUndoable", () => {
  it("deshacer devuelve el mensaje y no purga su imagen", () => {
    const deshacer = useForja.getState().deleteMessageUndoable("s1", "m1", 6000);
    expect(useForja.getState().sessions[0].messages.map((m) => m.id)).toEqual(["m2"]);

    deshacer();
    expect(useForja.getState().sessions[0].messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    vi.advanceTimersByTime(10_000);
    expect(borrados).toEqual([]);
  });

  it("si el hilo siguió, deshacer reinserta el mensaje sin pisar lo nuevo", () => {
    const deshacer = useForja.getState().deleteMessageUndoable("s1", "m1", 6000);
    useForja.getState().addMessage("s1", msg("m9", "user"));

    deshacer();
    expect(useForja.getState().sessions[0].messages.map((m) => m.id)).toEqual(["m1", "m2", "m9"]);
  });

  it("sin deshacer, la imagen del mensaje se purga al caducar", () => {
    useForja.getState().deleteMessageUndoable("s1", "m1", 6000);
    vi.advanceTimersByTime(6000);
    expect(borrados).toEqual(["blob-1"]);
  });
});
