import { describe, expect, it } from "vitest";
import { apiError } from "./api-envelope";

describe("apiError envelope", () => {
  it("omits details when not provided", () => {
    expect(apiError("NOT_FOUND", "Resource not found")).toEqual({
      error: { code: "NOT_FOUND", message: "Resource not found" },
    });
  });

  it("includes details when provided", () => {
    const body = apiError("VALIDATION_ERROR", "Invalid input", { amount: "required" });
    expect(body.error.details).toEqual({ amount: "required" });
  });

  it("never leaks a stack or internal fields", () => {
    const body = apiError("INTERNAL", "boom", new Error("secret"));
    expect(JSON.stringify(body)).not.toContain('"stack"');
    expect(Object.keys(body.error).sort()).toEqual(["code", "details", "message"]);
  });
});
