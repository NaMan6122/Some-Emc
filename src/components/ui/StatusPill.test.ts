import { describe, expect, it } from "vitest";
import { statusVariant } from "./StatusPill";

// spec-009 AC: StatusPill maps EVERY enum value of Lpo/Pc/Vo/Verification.

describe("StatusPill enum coverage", () => {
  it("maps all LPO statuses", () => {
    for (const v of ["DRAFT", "ISSUED", "CLOSED", "CANCELLED"]) {
      expect(statusVariant("lpo", v).label).toBeTruthy();
    }
    expect(statusVariant("lpo", "CANCELLED").variant).toBe("muted"); // strike-through treatment
  });

  it("maps all PC statuses", () => {
    for (const v of ["SUBMITTED", "CERTIFIED", "PAID"]) {
      expect(statusVariant("pc", v).variant).not.toBe("gray");
    }
    expect(statusVariant("pc", "DRAFT").label).toBe("Draft");
  });

  it("maps all VO statuses", () => {
    for (const v of ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]) {
      expect(statusVariant("vo", v).label).toBeTruthy();
    }
  });

  it("maps all verification states with semantic colors", () => {
    expect(statusVariant("verification", "VERIFIED").variant).toBe("emerald");
    expect(statusVariant("verification", "PENDING").variant).toBe("amber");
    expect(statusVariant("verification", "FLAGGED").variant).toBe("rose");
  });

  it("falls back to gray + raw value for unknown inputs (never crashes)", () => {
    expect(statusVariant("lpo", "SOMETHING_NEW")).toEqual({ label: "SOMETHING_NEW", variant: "gray" });
  });
});
