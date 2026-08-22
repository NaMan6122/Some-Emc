import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "./money";

describe("parseMoney", () => {
  it("parses the spec-002 acceptance example to the fils", () => {
    expect(parseMoney("3,832,500.00")).toBe(383250000n);
  });

  it("accepts plain integers, decimals, AED prefix and spacing", () => {
    expect(parseMoney("3832500")).toBe(383250000n);
    expect(parseMoney("1234.5")).toBe(123450n);
    expect(parseMoney("AED 18,786,625.00")).toBe(1878662500n);
    expect(parseMoney(" 1 234.55 ")).toBe(123455n);
  });

  it("supports accounting negatives", () => {
    expect(parseMoney("-12.5")).toBe(-1250n);
    expect(parseMoney("(1,000.00)")).toBe(-100000n);
  });

  it("rejects values that cannot represent exact fils", () => {
    expect(() => parseMoney("1.234")).toThrow();
    expect(() => parseMoney("abc")).toThrow();
    expect(() => parseMoney("")).toThrow();
  });
});

describe("formatMoney", () => {
  it("formats the spec-002 acceptance example", () => {
    expect(formatMoney(383250000n)).toBe("AED 3,832,500.00");
  });

  it("round-trips through parse exactly", () => {
    const samples = [0n, 5n, 47200n, -1250n, 937687162n];
    for (const s of samples) expect(parseMoney(formatMoney(s))).toBe(s);
  });

  it("handles negatives and sub-fils-free padding", () => {
    expect(formatMoney(-1250n)).toBe("-AED 12.50");
    expect(formatMoney(5n)).toBe("AED 0.05");
  });
});
