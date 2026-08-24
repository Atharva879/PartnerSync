export interface EncryptedMessagePayload {
  clientMessageId: string;
  encryptedContent: string;
  nonce: string;
  senderEncryptedContent: string;
  senderNonce: string;
  senderPublicKey: string;
}

export function createClientMessageId(now = Date.now(), random = Math.random()): string {
  return `msg_${now.toString(36)}_${random.toString(36).slice(2, 14)}`;
}

/** Reuses the original encrypted envelope and idempotency key when retrying a send. */
export function buildRetryInput(partnershipId: number, payload: EncryptedMessagePayload) {
  return { partnershipId, ...payload };
}
