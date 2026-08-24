import { describe, expect, it } from "vitest";

import { createConnectionCode, parseConnectionCode } from "../shared/connection-code";

describe("QR connection codes", () => {
  it("creates and reads a valid partner connection code", () => {
    const code = createConnectionCode(180001);
    expect(code).toBe("partner-sync:connect:v1:180001");
    expect(parseConnectionCode(code)).toBe(180001);
  });

  it("rejects malformed, non-positive, and unsafe IDs", () => {
    expect(parseConnectionCode(undefined)).toBeNull();
    expect(parseConnectionCode(null)).toBeNull();
    expect(parseConnectionCode("180001")).toBeNull();
    expect(parseConnectionCode("partner-sync:connect:v1:0")).toBeNull();
    expect(parseConnectionCode("partner-sync:connect:v1:9007199254740992")).toBeNull();
  });
});
