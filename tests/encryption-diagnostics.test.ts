import { describe, expect, it } from "vitest";
import { deriveEncryptionDiagnostic } from "../shared/encryption-diagnostics";

const readyInput = {
  hasActivePartnership: true,
  isLoadingKey: false,
  hasLocalKey: true,
  localPublicKey: "local-key",
  publishedOwnKey: "local-key",
  publishedPartnerKey: "partner-key",
  keyError: null,
};

describe("encryption diagnostics", () => {
  it("explains that an inactive connection must be approved first", () => {
    const diagnostic = deriveEncryptionDiagnostic({ ...readyInput, hasActivePartnership: false });
    expect(diagnostic).toMatchObject({ stage: "connect", action: "open-home", step: 1 });
  });

  it("tells a user when their partner needs to open Chat", () => {
    const diagnostic = deriveEncryptionDiagnostic({ ...readyInput, publishedPartnerKey: null });
    expect(diagnostic).toMatchObject({ stage: "partner-key", action: "none", step: 3 });
  });

  it("directs a mismatched device key through reconnect approval", () => {
    const diagnostic = deriveEncryptionDiagnostic({ ...readyInput, keyError: "This device has a new encryption key. Reconnect from Home and have your partner approve the request." });
    expect(diagnostic).toMatchObject({ stage: "reconnect", action: "open-home" });
  });

  it("only reports ready when both public keys are available", () => {
    expect(deriveEncryptionDiagnostic(readyInput).stage).toBe("ready");
  });
});
