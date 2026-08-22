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

  it("converts Dates to ISO strings; primitives pass through untouched", () => {
    const d = new Date("2026-08-23T00:00:00Z");
    const out = jsonSafe({ d, n: 1.5, s: "x", b: true });
    expect(out.d).toBe("2026-08-23T00:00:00.000Z");
    expect(out.n).toBe(1.5);
  });

  it("converts toJSON-bearing objects (Prisma Decimal) to their JSON form", () => {
    const decimalLike = { s: 1, e: -2, d: [500000], toJSON: () => "0.05" };
    expect(jsonSafe({ vatRate: decimalLike })).toEqual({ vatRate: "0.05" });
  });
});
