/** Forja IA — similitud visual local para Knowledge Base.
 *
 * No envía imágenes a ningún servicio: calcula un aHash de 8x8 en el navegador.
 * Sirve para detectar capturas/exportaciones visualmente muy parecidas antes de
 * duplicarlas. La decisión de borrar/conservar siempre queda en manos del usuario.
 */
export interface VisualFingerprint {
  algorithm: "ahash-8x8";
  hash: string;
}

export interface VisualDuplicateCandidate {
  id: string;
  distance: number;
  similarity: number;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length || !a || !b) return Number.POSITIVE_INFINITY;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    n += x.toString(2).split("1").length - 1;
  }
  return n;
}

export function similarityFromDistance(distance: number, bits = 64): number {
  if (!Number.isFinite(distance)) return 0;
  return Math.max(0, Math.min(1, 1 - distance / bits));
}

export function findVisualDuplicateCandidates(
  fingerprint: string,
  indexed: Array<{ id: string; visualHash?: string }>,
  maxDistance = 8,
): VisualDuplicateCandidate[] {
  return indexed
    .filter((r) => r.visualHash)
    .map((r) => {
      const distance = hammingDistance(fingerprint, r.visualHash!);
      return { id: r.id, distance, similarity: similarityFromDistance(distance) };
    })
    .filter((r) => r.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
}

/** aHash de 64 bits serializado como 16 hex chars. */
export async function computeVisualFingerprint(file: File): Promise<VisualFingerprint | null> {
  if (!file.type.startsWith("image/")) return null;
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, 8, 8);
    const pixels = ctx.getImageData(0, 0, 8, 8).data;
    const gray: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      gray.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }
    const average = gray.reduce((a, b) => a + b, 0) / gray.length;
    const bits = gray.map((value) => (value >= average ? 1 : 0));
    let hex = "";
    for (let i = 0; i < bits.length; i += 4) {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit++) nibble |= (bits[i + bit] ?? 0) << (3 - bit);
      hex += nibble.toString(16);
    }
    return { algorithm: "ahash-8x8", hash: hex.slice(0, 16) };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
