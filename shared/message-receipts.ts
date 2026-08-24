export const RECEIPT_STATUSES = ["sent", "delivered", "read"] as const;

export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

const receiptRank: Record<ReceiptStatus, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
};

/** Receipt state is monotonic: a message must never move backwards. */
export function canAdvanceReceipt(current: ReceiptStatus, target: ReceiptStatus) {
  return receiptRank[target] >= receiptRank[current];
}

export function receiptGlyph(status: ReceiptStatus) {
  return status === "sent" ? "✓" : "✓✓";
}

export function receiptLabel(status: ReceiptStatus) {
  return status === "sent" ? "Sent" : status === "delivered" ? "Delivered" : "Read";
}
