import { describe, expect, it } from "vitest";

import {
  decryptMessage,
  encryptMessageForParticipants,
  generateKeyPair,
} from "../lib/encryption";

describe("TweetNaCl message encryption", () => {
  it("encrypts separate copies that both participants can decrypt", () => {
    const sender = generateKeyPair();
    const recipient = generateKeyPair();
    const encrypted = encryptMessageForParticipants("Meet at 7", recipient.publicKey, sender);

    expect(encrypted.recipient.ciphertext).not.toContain("Meet at 7");
    expect(
      decryptMessage(encrypted.recipient, sender.publicKey, recipient.secretKey),
    ).toBe("Meet at 7");
    expect(
      decryptMessage(encrypted.sender, sender.publicKey, sender.secretKey),
    ).toBe("Meet at 7");
  });

  it("rejects an envelope when the recipient private key is wrong", () => {
    const sender = generateKeyPair();
    const recipient = generateKeyPair();
    const unrelatedUser = generateKeyPair();
    const encrypted = encryptMessageForParticipants("Private", recipient.publicKey, sender);

    expect(() => decryptMessage(encrypted.recipient, sender.publicKey, unrelatedUser.secretKey)).toThrow(
      "Message authentication failed",
    );
  });
});
