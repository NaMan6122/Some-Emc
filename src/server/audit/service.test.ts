import { describe, expect, it } from "vitest";
import { diffChangedKeys, normalizeForAudit } from "./service";

describe("normalizeForAudit", () => {
  it("sorts keys deterministically regardless of insertion order", () => {
    const a = JSON.stringify(normalizeForAudit({ b: 1, a: 2 }));
    const b = JSON.stringify(normalizeForAudit({ a: 2, b: 1 }));
    expect(a).toBe(b);
  });

  it("drops undefined values and recurses", () => {
    const out = normalizeForAudit({ x: undefined, y: { k2: 1, k1: undefined } });
    expect(JSON.stringify(out)).toBe(JSON.stringify({ y: { k2: 1 } }));
  });
});

describe("diffChangedKeys", () => {
  it("keeps only changed top-level keys (spec AC1)", () => {
    const before = { id: 5, name: "Old Name", aliases: [] };
    const after = { id: 5, name: "New Name", aliases: [] };
    expect(diffChangedKeys(before, after)).toEqual({
      before: { name: "Old Name" },
      after: { name: "New Name" },
    });
  });

  it("detects nested changes as changed parents", () => {
    const out = diffChangedKeys({ meta: { v: 1 }, keep: "x" }, { meta: { v: 2 }, keep: "x" });
    expect(out.before).toEqual({ meta: { v: 1 } });
    expect(out.after).toEqual({ meta: { v: 2 } });
  });

  it("returns empty objects for no-op diffs", () => {
    expect(diffChangedKeys({ a: 1 }, { a: 1 })).toEqual({ before: {}, after: {} });
  });

  it("passes through null/non-object payloads verbatim (CREATE/DELETE)", () => {
    expect(diffChangedKeys(null, { a: 1 })).toEqual({ before: null, after: { a: 1 } });
    expect(diffChangedKeys([1, 2], [3])).toEqual({ before: [1, 2], after: [3] });
  });

  it("is deterministic across runs (JSON-comparable)", () => {
    const run = () => JSON.stringify(diffChangedKeys({ b: 1, a: 0 }, { b: 2, a: 0 }));
    expect(run()).toBe(run());
  });
});
