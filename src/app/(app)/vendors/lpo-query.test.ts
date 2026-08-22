import { describe, expect, it } from "vitest";
import { buildQuery } from "./LpoLogClient";

describe("buildQuery (spec-010 filter serialization)", () => {
  it("emits only active filters", () => {
    const p = buildQuery({ trade: "ELECTRICAL", q: "musandam", limit: 50 });
    expect(p.get("trade")).toBe("ELECTRICAL");
    expect(p.get("q")).toBe("musandam");
    expect(p.get("limit")).toBe("50");
    expect(p.has("status")).toBe(false);
    expect(p.has("includeSuperseded")).toBe(false);
  });

  it("always sends limit and honors cursor for Load more", () => {
    const p = buildQuery({ limit: 50, cursor: "123" });
    expect(p.get("cursor")).toBe("123");
  });

  it("serializes date range as ISO instants covering the whole days", () => {
    const p = buildQuery({ from: "2025-06-01", to: "2025-06-30" });
    expect(p.get("from")).toBe("2025-06-01T00:00:00.000Z");
    expect(p.get("to")).toBe("2025-06-30T23:59:59.000Z");
  });

  it("defaults sort/dir are omitted so server defaults apply", () => {
    const p = buildQuery({});
    expect(p.has("sort")).toBe(false);
    expect(p.has("dir")).toBe(false);
  });
});
