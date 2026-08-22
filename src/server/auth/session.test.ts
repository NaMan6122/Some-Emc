import { describe, expect, it } from "vitest";
import { serializeSetCookie, signSessionToken, verifySessionToken, SESSION_COOKIE } from "./jwt";

describe("session tokens", () => {
  it("round-trips claims", async () => {
    const token = await signSessionToken({ uid: 7, role: "ADMIN", tv: 2 });
    expect(await verifySessionToken(token)).toEqual({ uid: 7, role: "ADMIN", tv: 2 });
  });

  it("rejects garbage tokens", async () => {
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("rejects tampered payloads", async () => {
    const token = await signSessionToken({ uid: 1, role: "VIEWER", tv: 0 });
    const [h, p] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: 1, role: "ADMIN", tv: 0 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forged}.${p}`)).toBeNull();
  });
});

describe("cookie serialization", () => {
  it("emits HttpOnly SameSite=Lax with Max-Age", () => {
    const c = serializeSetCookie("tok123");
    expect(c).toContain(`${SESSION_COOKIE}=tok123`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Max-Age=");
  });

  it("clearing sets Max-Age=0 and empty value", () => {
    const c = serializeSetCookie("", 0);
    expect(c).toContain(`${SESSION_COOKIE}=`);
    expect(c).toContain("Max-Age=0");
  });
});
