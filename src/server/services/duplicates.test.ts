import { describe, expect, it } from "vitest";
import { findDuplicatePairs, levenshtein, similarity } from "./duplicates";
import { normalizeSupplierName } from "./suppliers";

describe("normalizeSupplierName", () => {
  it("uppercases and collapses whitespace", () => {
    expect(normalizeSupplierName("  m/s unigulf   development LLC ")).toBe(
      "M/S UNIGULF DEVELOPMENT LLC",
    );
  });
});

describe("levenshtein", () => {
  it("measures single-char typos", () => {
    expect(levenshtein("DEVELOPMENT", "DEVELOPMWNT")).toBe(1);
    expect(levenshtein("ELECTRICAL", "ELECRICAL")).toBe(1);
    expect(levenshtein("ABC", "ABC")).toBe(0);
  });
});

describe("similarity / findDuplicatePairs", () => {
  const fixtures = [
    { id: 1, name: "UNIGULF DEVELOPMENT LLC" },
    { id: 2, name: "UNIGULF DEVELOPMWNT LLC" }, // known source typo
    { id: 3, name: "ELECTRICAL CENTER" },
    { id: 4, name: "ELECRICAL CENTER" }, // known source typo
    { id: 5, name: "GULF DUCT INDUSTRIES" },
    { id: 6, name: "AL WASL TRADING GROUP" },
    { id: 7, name: "BIN BAY METAL INDUSTRIES" },
  ];

  it("flags the known typo variants as duplicate candidates", () => {
    const pairs = findDuplicatePairs(fixtures);
    const ids = pairs.map((p) => [p.aId, p.bId].sort((a, b) => a - b).join("-"));
    expect(ids).toContain("1-2");
    expect(ids).toContain("3-4");
  });

  it("does not flag genuinely different vendors", () => {
    const ids = findDuplicatePairs(fixtures).map((p) => [p.aId, p.bId].join("-"));
    expect(ids).not.toContain("5-6");
    expect(ids).not.toContain("6-7");
  });

  it("penalizes one-token containment but rejects larger size gaps", () => {
    // LLC filtered as stop-token → 2 vs 3 tokens: allowed containment, reduced score.
    const contained = similarity("GULF DUCT INDUSTRIES LLC", "GULF DUCT");
    expect(contained).not.toBeNull();
    expect(contained!).toBeLessThanOrEqual(2 / 3);
    // Same token count, but no near partner for each token → null.
    expect(similarity("GULF DUCT INDUSTRIES", "AL WASL TRADING")).toBeNull();
    expect(similarity("GULF DUCT INDUSTRIES LLC", "AL WASL TRADING GROUP FZE")).toBeNull();
  });

  it("scores are sorted descending and capped at 20 pairs", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      name: `VENDOR NAME ${i % 2 === 0 ? "ALPHA" : "ALPHA"}`,
    }));
    const pairs = findDuplicatePairs(many);
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i - 1].score).toBeGreaterThanOrEqual(pairs[i].score);
    }
    expect(pairs.length).toBeLessThanOrEqual(20);
  });
});
