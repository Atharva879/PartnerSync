import nacl from "tweetnacl";
import { Base64 } from "js-base64";

/**
 * TweetNaCl looks for `self.crypto`, which is not consistently exposed by the
 * React Native runtime. Bind it explicitly to the native crypto polyfill so
 * key generation and per-message nonces always use secure randomness.
 */
function configureNativeRandomness(): void {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) return;

  nacl.setPRNG((output, length) => {
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    output.set(randomBytes);
  });
}

configureNativeRandomness();

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface CipherEnvelope {
  ciphertext: string;
  nonce: string;
}

export interface EncryptedMessage {
  recipient: CipherEnvelope;
  sender: CipherEnvelope;
  senderPublicKey: string;
}

function toBytes(value: string): Uint8Array {
  return Base64.toUint8Array(value);
}

function encryptEnvelope(message: Uint8Array, recipientPublicKey: Uint8Array, senderSecretKey: Uint8Array): CipherEnvelope {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(message, nonce, recipientPublicKey, senderSecretKey);
  return {
    ciphertext: Base64.fromUint8Array(ciphertext),
    nonce: Base64.fromUint8Array(nonce),
  };
}

/** Creates a Curve25519 key pair held only on the user's device. */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: Base64.fromUint8Array(keyPair.publicKey),
    secretKey: Base64.fromUint8Array(keyPair.secretKey),
  };
}

/**
 * Encrypts one copy for the partner and a second copy for the sender. The
 * service stores ciphertext and public metadata only; neither private key nor
 * plaintext is ever included in the API request.
 */
export function encryptMessageForParticipants(
  plaintext: string,
  recipientPublicKey: string,
  senderKeyPair: KeyPair,
): EncryptedMessage {
  const message = new TextEncoder().encode(plaintext);
  const senderPublicKey = toBytes(senderKeyPair.publicKey);
  const senderSecretKey = toBytes(senderKeyPair.secretKey);

  return {
    recipient: encryptEnvelope(message, toBytes(recipientPublicKey), senderSecretKey),
    sender: encryptEnvelope(message, senderPublicKey, senderSecretKey),
    senderPublicKey: senderKeyPair.publicKey,
  };
}

/** Decrypts one envelope with the current device's private key. */
export function decryptMessage(
  envelope: CipherEnvelope,
  senderPublicKey: string,
  recipientSecretKey: string,
): string {
  const plaintext = nacl.box.open(
    toBytes(envelope.ciphertext),
    toBytes(envelope.nonce),
    toBytes(senderPublicKey),
    toBytes(recipientSecretKey),
  );

  if (!plaintext) throw new Error("Message authentication failed");
  return new TextDecoder().decode(plaintext);
}

export function isValidPublicKey(publicKey: string): boolean {
  try {
    return toBytes(publicKey).length === nacl.box.publicKeyLength;
  } catch {
    return false;
  }
}

/** Confirms a locally stored Curve25519 secret key is structurally usable. */
export function isValidSecretKey(secretKey: string): boolean {
  try {
    return toBytes(secretKey).length === nacl.box.secretKeyLength;
  } catch {
    return false;
  }
}

/** Prevents malformed or partial SecureStore values from blocking chat setup. */
export function isValidKeyPair(keyPair: KeyPair | null | undefined): keyPair is KeyPair {
  return Boolean(keyPair && isValidPublicKey(keyPair.publicKey) && isValidSecretKey(keyPair.secretKey));
}

/** A short public safety number for partners to compare out of band. */
export function createSafetyNumber(firstPublicKey: string, secondPublicKey: string): string {
  const ordered = [firstPublicKey, secondPublicKey].sort().join(":");
  const digest = nacl.hash(new TextEncoder().encode(ordered));
  return Base64.fromUint8Array(digest).replace(/[^A-Z0-9]/gi, "").slice(0, 20).toUpperCase();
}
