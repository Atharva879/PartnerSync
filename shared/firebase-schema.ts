/** Firestore document contracts used by the direct Firebase Partner Sync client. */
export type FirebaseUserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** Shareable QR/manual identifier. The Firebase UID is high-entropy and never an auth secret. */
  connectionCode: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type FirebasePartnershipStatus = "pending" | "active" | "disconnected";

export type FirebasePartnership = {
  id: string;
  participantIds: [string, string];
  requesterId: string;
  recipientId: string;
  status: FirebasePartnershipStatus;
  requesterPublicKey?: string | null;
  recipientPublicKey?: string | null;
  requesterTypingUntil?: number | null;
  recipientTypingUntil?: number | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type FirebaseEncryptedMessage = {
  id: string;
  senderId: string;
  clientMessageId: string;
  encryptedContent: string;
  nonce: string;
  senderPublicKey?: string | null;
  senderEncryptedContent?: string | null;
  senderNonce?: string | null;
  status: "sent" | "delivered" | "read";
  createdAt?: unknown;
  deliveredAt?: unknown;
  readAt?: unknown;
};

export type FirebaseTask = {
  id: string;
  createdBy: string;
  title: string;
  description?: string | null;
  priority: "low" | "medium" | "high";
  dueDate?: unknown;
  completed: boolean;
  completedBy?: string | null;
  completedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type FirebaseGoal = {
  id: string;
  title: string;
  targetRate: number;
  description?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type FirebaseNotificationPreferences = {
  notificationsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  timezone: string;
  updatedAt?: unknown;
};

export function createFirebaseConnectionCode(uid: string) {
  return `PSF1:${uid}`;
}

export function parseFirebaseConnectionCode(value: string) {
  const candidate = value.trim();
  return candidate.startsWith("PSF1:") && candidate.length > 8 ? candidate.slice(5) : null;
}

export function createPartnershipId(firstUid: string, secondUid: string) {
  return [firstUid, secondUid].sort().join("_");
}
