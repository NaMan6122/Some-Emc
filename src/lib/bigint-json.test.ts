import { describe, expect, it } from "vitest";
import { jsonSafe } from "./bigint-json";

describe("jsonSafe BigInt serialization convention", () => {
  it("serializes BigInt as decimal strings at any depth", () => {
    const input = {
      id: 12n,
      amountFils: 383250000n,
      nested: { stated: [1n, null, "x"] },
    };
    expect(JSON.parse(JSON.stringify(jsonSafe(input)))).toEqual({
      id: "12",
      amountFils: "383250000",
      nested: { stated: ["1", null, "x"] },
    });
  });

  it("guarantees JSON.stringify never throws on API payloads", () => {
    // Raw JSON.stringify throws on BigInt; jsonSafe output must not.
    expect(() => JSON.stringify(jsonSafe({ v: 42n }))).not.toThrow();
    expect(() => JSON.stringify({ v: 42n })).toThrow();
  });

  it("preserves non-BigInt values untouched", () => {
    const d = new Date("2026-08-23T00:00:00Z");
    expect(jsonSafe({ d, n: 1.5, s: "x", b: true }).d).toBe(d);
    expect(jsonSafe({ n: 1.5 })).toEqual({ n: 1.5 });
  });
});
