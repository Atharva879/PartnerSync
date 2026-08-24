export type EncryptionDiagnosticAction = "none" | "retry" | "open-home";

export interface EncryptionDiagnosticInput {
  hasActivePartnership: boolean;
  isLoadingKey: boolean;
  hasLocalKey: boolean;
  localPublicKey: string | null;
  publishedOwnKey: string | null;
  publishedPartnerKey: string | null;
  keyError: string | null;
}

export interface EncryptionDiagnostic {
  stage: "connect" | "device-key" | "publish" | "partner-key" | "reconnect" | "retry" | "ready";
  step: number;
  title: string;
  detail: string;
  action: EncryptionDiagnosticAction;
  actionLabel?: string;
}

/**
 * Produces user-facing setup information without exposing cryptographic key material.
 */
export function deriveEncryptionDiagnostic(input: EncryptionDiagnosticInput): EncryptionDiagnostic {
  if (!input.hasActivePartnership) {
    return {
      stage: "connect",
      step: 1,
      title: "Connect your partner",
      detail: "Send or approve a connection request from Home before private chat can start.",
      action: "open-home",
      actionLabel: "Open Home",
    };
  }

  if (input.keyError?.includes("Reconnect from Home")) {
    return {
      stage: "reconnect",
      step: 1,
      title: "Approve this device’s new key",
      detail: "This device has a new security key. Reconnect from Home and have your partner approve the request.",
      action: "open-home",
      actionLabel: "Open Home",
    };
  }

  if (input.keyError) {
    return {
      stage: "retry",
      step: 1,
      title: "Secure setup needs attention",
      detail: input.keyError,
      action: "retry",
      actionLabel: "Try again",
    };
  }

  if (input.isLoadingKey) {
    return {
      stage: "device-key",
      step: 1,
      title: "Preparing this device",
      detail: "Loading this device’s private key from secure storage.",
      action: "none",
    };
  }

  if (!input.hasLocalKey || !input.localPublicKey) {
    return {
      stage: "device-key",
      step: 1,
      title: "Preparing this device",
      detail: "Creating a private key protected by this device’s secure storage.",
      action: "retry",
      actionLabel: "Try again",
    };
  }

  if (!input.publishedOwnKey || input.publishedOwnKey !== input.localPublicKey) {
    return {
      stage: "publish",
      step: 2,
      title: "Registering your security key",
      detail: "Saving your public key to the shared connection. Your private key stays only on this device.",
      action: "none",
    };
  }

  if (!input.publishedPartnerKey) {
    return {
      stage: "partner-key",
      step: 3,
      title: "Waiting for your partner",
      detail: "Ask your partner to open Chat once so their security key can be registered.",
      action: "none",
    };
  }

  return {
    stage: "ready",
    step: 3,
    title: "End-to-end encryption is ready",
    detail: "Only you and your partner can read new messages in this chat.",
    action: "none",
  };
}
