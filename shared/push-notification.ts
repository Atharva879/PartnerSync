export type PartnerPushType = "connection_approved" | "encrypted_message";

export type PartnerPushPayload = {
  title: "Partner Sync";
  body: string;
  route: "/(tabs)/chat";
  type: PartnerPushType;
};

/** Payloads deliberately exclude sender identity and encrypted/plaintext message content. */
export function createPartnerPushPayload(type: PartnerPushType): PartnerPushPayload {
  return {
    title: "Partner Sync",
    body: type === "connection_approved"
      ? "Your partner approved the connection request."
      : "You received a new encrypted message.",
    route: "/(tabs)/chat",
    type,
  };
}

export function notificationDeliveryKey(type: PartnerPushType, recordId: number) {
  return `${type}:${recordId}`;
}
