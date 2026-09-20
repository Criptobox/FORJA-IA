import { describe, expect, it } from "vitest";
import { findVisualDuplicateCandidates, hammingDistance, similarityFromDistance } from "@/lib/forja/visual-similarity";

describe("visual similarity", () => {
  it("calcula distancia Hamming entre hashes hex", () => {
    expect(hammingDistance("0000", "0000")).toBe(0);
    expect(hammingDistance("ffff", "0000")).toBe(16);
  });

  it("convierte distancia en similitud", () => {
    expect(similarityFromDistance(0)).toBe(1);
    expect(similarityFromDistance(64)).toBe(0);
  });

  it("devuelve candidatos ordenados y descarta los lejanos", () => {
    const result = findVisualDuplicateCandidates("0000000000000000", [
      { id: "close", visualHash: "0000000000000001" },
      { id: "far", visualHash: "ffffffffffffffff" },
      { id: "none" },
    ], 8);
    expect(result.map((r) => r.id)).toEqual(["close"]);
    expect(result[0]?.similarity).toBeGreaterThan(0.9);
  });
});
