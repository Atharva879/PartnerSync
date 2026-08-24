const CONNECTION_CODE_PREFIX = "partner-sync:connect:v1:";

export function createConnectionCode(userId: number) {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("A valid user ID is required");
  return `${CONNECTION_CODE_PREFIX}${userId}`;
}

export function parseConnectionCode(value: string | null | undefined): number | null {
  const match = value?.trim().match(/^partner-sync:connect:v1:([1-9]\d*)$/);
  if (!match) return null;
  const userId = Number(match[1]);
  return Number.isSafeInteger(userId) ? userId : null;
}
