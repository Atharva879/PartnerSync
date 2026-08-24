import { describe, expect, it } from "vitest";

import { createTypingExpiry, isTypingActive, TYPING_TTL_MS } from "../shared/typing";

describe("typing indicator state", () => {
  it("stays active during the TTL and expires afterward", () => {
    const startedAt = 1_000_000;
    const expiresAt = createTypingExpiry(startedAt);

    expect(expiresAt.getTime()).toBe(startedAt + TYPING_TTL_MS);
    expect(isTypingActive(expiresAt, startedAt + TYPING_TTL_MS - 1)).toBe(true);
    expect(isTypingActive(expiresAt, startedAt + TYPING_TTL_MS)).toBe(false);
  });

  it("treats a cleared typing state as inactive", () => {
    expect(isTypingActive(null, Date.now())).toBe(false);
    expect(isTypingActive(undefined, Date.now())).toBe(false);
  });
});
