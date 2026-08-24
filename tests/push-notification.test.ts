import { describe, expect, it } from "vitest";

import { createPartnerPushPayload, notificationDeliveryKey } from "../shared/push-notification";

describe("partner push payloads", () => {
  it("uses generic content for encrypted message notifications", () => {
    const payload = createPartnerPushPayload("encrypted_message");
    expect(payload).toEqual({
      title: "Partner Sync",
      body: "You received a new encrypted message.",
      route: "/(tabs)/chat",
      type: "encrypted_message",
    });
    expect(JSON.stringify(payload)).not.toContain("ciphertext");
    expect(JSON.stringify(payload)).not.toContain("message text");
  });

  it("routes approval alerts to the chat setup screen", () => {
    expect(createPartnerPushPayload("connection_approved")).toMatchObject({
      route: "/(tabs)/chat",
      type: "connection_approved",
    });
  });

  it("creates stable, type-scoped idempotency keys", () => {
    expect(notificationDeliveryKey("encrypted_message", 42)).toBe("encrypted_message:42");
    expect(notificationDeliveryKey("connection_approved", 42)).not.toBe(notificationDeliveryKey("encrypted_message", 42));
  });
});
