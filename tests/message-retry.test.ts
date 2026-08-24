import { describe, expect, it } from "vitest";

import { buildRetryInput, createClientMessageId, type EncryptedMessagePayload } from "../shared/message-retry";

describe("failed message retry payloads", () => {
  it("keeps the original client id and encrypted envelope on retry", () => {
    const payload: EncryptedMessagePayload = {
      clientMessageId: createClientMessageId(1000, 0.5),
      encryptedContent: "recipient-envelope",
      nonce: "recipient-nonce",
      senderEncryptedContent: "sender-envelope",
      senderNonce: "sender-nonce",
      senderPublicKey: "sender-public-key",
    };

    expect(buildRetryInput(42, payload)).toEqual({ partnershipId: 42, ...payload });
    expect(buildRetryInput(42, payload).clientMessageId).toBe("msg_rs_i");
  });
});
