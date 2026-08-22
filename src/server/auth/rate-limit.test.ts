import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearFailures, recordFailure, rateLimitKey, _constants, _resetForTests } from "./rate-limit";

describe("login rate limiter", () => {
  beforeEach(() => _resetForTests());

  it("allows up to MAX_FAILURES then limits with Retry-After", () => {
    const key = rateLimitKey("1.2.3.4", "User@Example.com ");
    for (let i = 0; i < _constants.MAX_FAILURES; i++) {
      expect(checkRateLimit(key).limited).toBe(false);
      recordFailure(key);
    }
    const after = checkRateLimit(key);
    expect(after.limited).toBe(true);
    expect(after.retryAfterSeconds).toBeGreaterThan(0);
    expect(after.retryAfterSeconds).toBeLessThanOrEqual(_constants.WINDOW_MS / 1000);
  });

  it("keys are case/whitespace-insensitive on email, distinct per ip", () => {
    const a = rateLimitKey("ip1", "A@x.com");
    const b = rateLimitKey("ip1", "  a@X.com");
    const c = rateLimitKey("ip2", "a@x.com");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("clearFailures resets the counter (successful login)", () => {
    const key = rateLimitKey("ip", "a@x.com");
    for (let i = 0; i < _constants.MAX_FAILURES; i++) recordFailure(key);
    clearFailures(key);
    expect(checkRateLimit(key).limited).toBe(false);
  });
});
