export const TYPING_TTL_MS = 5_000;

export function createTypingExpiry(now = Date.now(), ttlMs = TYPING_TTL_MS) {
  return new Date(now + ttlMs);
}

export function isTypingActive(expiresAt: Date | null | undefined, now = Date.now()) {
  return Boolean(expiresAt && expiresAt.getTime() > now);
}
