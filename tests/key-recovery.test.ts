import { describe, expect, it } from "vitest";
import { generateKeyPair, isValidKeyPair, isValidPublicKey, isValidSecretKey } from "../lib/encryption";

describe("Encrypted Chat Key Recovery", () => {
  it("generates valid key pairs on demand", () => {
    const pair = generateKeyPair();
    expect(isValidPublicKey(pair.publicKey)).toBe(true);
    expect(isValidSecretKey(pair.secretKey)).toBe(true);
    expect(isValidKeyPair(pair)).toBe(true);
  });

  it("handles missing or malformed stored keys by generating a fresh valid pair", () => {
    const storedPublic = null;
    const storedSecret = "corrupted";

    const recovered = storedPublic && storedSecret && isValidKeyPair({ publicKey: storedPublic, secretKey: storedSecret })
      ? { publicKey: storedPublic, secretKey: storedSecret }
      : generateKeyPair();

    expect(isValidPublicKey(recovered.publicKey)).toBe(true);
    expect(isValidSecretKey(recovered.secretKey)).toBe(true);
  });

  it("rejects partial or malformed locally stored key pairs", () => {
    expect(isValidKeyPair({ publicKey: "invalid", secretKey: "corrupted" })).toBe(false);
    expect(isValidKeyPair(null)).toBe(false);
  });
});
