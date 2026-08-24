import { describe, expect, it } from "vitest";

import { isRequestRecipient, isRequestSender } from "../shared/partnership-request";

describe("partnership request roles", () => {
  const pendingRequest = { userId: 1, partnerId: 180001, status: "pending" as const };

  it("only allows the addressed partner to approve or decline a pending request", () => {
    expect(isRequestRecipient(pendingRequest, 180001)).toBe(true);
    expect(isRequestRecipient(pendingRequest, 1)).toBe(false);
  });

  it("identifies the sender without granting response rights", () => {
    expect(isRequestSender(pendingRequest, 1)).toBe(true);
    expect(isRequestSender(pendingRequest, 180001)).toBe(false);
  });
});
