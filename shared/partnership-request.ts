export type PartnershipRequestStatus = "pending" | "active" | "disconnected";

export interface PartnershipRequestLike {
  userId: number;
  partnerId: number;
  status: PartnershipRequestStatus;
}

export function isRequestRecipient(partnership: PartnershipRequestLike, userId: number) {
  return partnership.status === "pending" && partnership.partnerId === userId;
}

export function isRequestSender(partnership: PartnershipRequestLike, userId: number) {
  return partnership.status === "pending" && partnership.userId === userId;
}
