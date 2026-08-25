import { describe, expect, it } from "vitest";
import { canAccess, filterNav } from "./nav";

describe("spec-009-v1 role-aware navigation", () => {
  it("ADMIN sees all three groups incl. Administration", () => {
    const nav = filterNav("ADMIN");
    expect(nav.map((g) => g.group)).toEqual(["Analytics", "Governance", "Cost Control", "Administration"]);
    const adminItems = nav.find((g) => g.group === "Administration")!.items.map((i) => i.label);
    expect(adminItems).toEqual(["Projects", "Suppliers", "Users", "Audit Log"]);
  });

  it("VIEWER sees Analytics + Governance but no Administration", () => {
    const groups = filterNav("VIEWER").map((g) => g.group);
    expect(groups).toEqual(["Analytics", "Governance", "Cost Control"]);
  });

  it("PROCUREMENT sees no Administration entries either (admin batch is ADMIN-only)", () => {
    expect(filterNav("PROCUREMENT").map((g) => g.group)).toEqual(["Analytics", "Governance", "Cost Control"]);
  });

  it("unknown role yields empty nav", () => {
    expect(filterNav(null)).toEqual([]);
  });

  it("canAccess guards admin routes and allows analytics for every role", () => {
    expect(canAccess("ADMIN", "/audit")).toBe(true);
    expect(canAccess("VIEWER", "/audit")).toBe(false);
    expect(canAccess("VIEWER", "/overview")).toBe(true);
    expect(canAccess(null, "/overview")).toBe(false);
    // Nested paths inherit the parent rule:
    expect(canAccess("FINANCE", "/admin/projects/3/budget")).toBe(false);
    expect(canAccess("ADMIN", "/vendors")).toBe(true);
  });
});
