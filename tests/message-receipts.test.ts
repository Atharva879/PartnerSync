import { describe, expect, it } from "vitest";

import { canAdvanceReceipt, receiptGlyph, receiptLabel } from "../shared/message-receipts";

describe("message receipts", () => {
  it("allows receipt progress without status regression", () => {
    expect(canAdvanceReceipt("sent", "delivered")).toBe(true);
    expect(canAdvanceReceipt("delivered", "read")).toBe(true);
    expect(canAdvanceReceipt("read", "delivered")).toBe(false);
    expect(canAdvanceReceipt("read", "sent")).toBe(false);
  });

  it("uses one check for sent and double checks for delivered or read", () => {
    expect(receiptGlyph("sent")).toBe("✓");
    expect(receiptGlyph("delivered")).toBe("✓✓");
    expect(receiptLabel("read")).toBe("Read");
  });
});
