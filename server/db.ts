import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  goals,
  InsertGoal,
  InsertMessage,
  InsertPartnership,
  InsertTask,
  InsertUser,
  devicePushTokens,
  notificationDeliveries,
  notificationPreferences,
  messages,
  partnerships,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { createTypingExpiry, isTypingActive, TYPING_TTL_MS } from "../shared/typing";
import type { ReceiptStatus } from "../shared/message-receipts";
import { isRequestRecipient } from "../shared/partnership-request";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = values[field];
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function createPartnership(data: InsertPartnership) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(partnerships).values(data);
}

export async function createOrRenewPartnershipRequest(requesterId: number, recipientId: number) {
  const existing = await getPartnershipByUsers(requesterId, recipientId);
  if (existing?.status === "active") throw new Error("You are already connected to this partner");
  if (existing?.status === "pending") return existing;

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reset = {
    userId: requesterId,
    partnerId: recipientId,
    status: "pending" as const,
    encryptionKey: null,
    userPublicKey: null,
    partnerPublicKey: null,
    userTypingUntil: null,
    partnerTypingUntil: null,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(partnerships).set(reset).where(eq(partnerships.id, existing.id));
    return getPartnershipForMember(existing.id, requesterId);
  }

  await db.insert(partnerships).values({ userId: requesterId, partnerId: recipientId, status: "pending" });
  return getPartnershipByUsers(requesterId, recipientId);
}

export async function getPartnershipByUsers(userId: number, partnerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select()
      .from(partnerships)
      .where(
        or(
          and(eq(partnerships.userId, userId), eq(partnerships.partnerId, partnerId)),
          and(eq(partnerships.userId, partnerId), eq(partnerships.partnerId, userId)),
        ),
      )
      .limit(1)
  )[0];
}

export async function getLatestPartnershipForMember(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select()
      .from(partnerships)
      .where(or(eq(partnerships.userId, userId), eq(partnerships.partnerId, userId)))
      .orderBy(desc(partnerships.updatedAt))
      .limit(1)
  )[0];
}

export async function getActivePartnership(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select()
      .from(partnerships)
      .where(
        and(
          or(eq(partnerships.userId, userId), eq(partnerships.partnerId, userId)),
          eq(partnerships.status, "active"),
        ),
      )
      .limit(1)
  )[0];
}

export async function getPartnershipForMember(partnershipId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select()
      .from(partnerships)
      .where(
        and(
          eq(partnerships.id, partnershipId),
          or(eq(partnerships.userId, userId), eq(partnerships.partnerId, userId)),
        ),
      )
      .limit(1)
  )[0];
}

export async function updatePartnershipStatus(
  partnershipId: number,
  userId: number,
  status: "pending" | "active" | "disconnected",
) {
  const partnership = await getPartnershipForMember(partnershipId, userId);
  if (!partnership) throw new Error("Partnership not found");
  if (status !== "disconnected") throw new Error("Use the request response action to change connection status");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partnerships).set({ status, updatedAt: new Date() }).where(eq(partnerships.id, partnershipId));
  return getPartnershipForMember(partnershipId, userId);
}

export async function respondToPartnershipRequest(partnershipId: number, userId: number, action: "approve" | "decline") {
  const partnership = await getPartnershipForMember(partnershipId, userId);
  if (!partnership) throw new Error("Partnership not found");
  if (!isRequestRecipient(partnership, userId)) throw new Error("Only the invited partner can respond to this request");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(partnerships)
    .set({
      status: action === "approve" ? "active" : "disconnected",
      encryptionKey: null,
      userPublicKey: null,
      partnerPublicKey: null,
      userTypingUntil: null,
      partnerTypingUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(partnerships.id, partnershipId));
  return getPartnershipForMember(partnershipId, userId);
}

export async function reconnectPartnership(partnershipId: number, userId: number) {
  const partnership = await getPartnershipForMember(partnershipId, userId);
  if (!partnership) throw new Error("Partnership not found");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partnerships).set({
    userId,
    partnerId: partnership.userId === userId ? partnership.partnerId : partnership.userId,
    status: "pending",
    encryptionKey: null,
    userPublicKey: null,
    partnerPublicKey: null,
    userTypingUntil: null,
    partnerTypingUntil: null,
    updatedAt: new Date(),
  }).where(eq(partnerships.id, partnershipId));
  return getPartnershipForMember(partnershipId, userId);
}

/** Public keys are immutable for an established connection; rekeying requires an explicit reconnect. */
export async function setTypingState(partnershipId: number, userId: number, typing: boolean, ttlMs = TYPING_TTL_MS) {
  const partnership = await getPartnershipForMember(partnershipId, userId);
  if (!partnership) throw new Error("Partnership not found");
  if (partnership.status !== "active") throw new Error("Active partnership required");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const typingUntil = typing ? createTypingExpiry(Date.now(), ttlMs) : null;
  const update = { updatedAt: new Date() };

  if (partnership.userId === userId) {
    await db.update(partnerships).set({ ...update, userTypingUntil: typingUntil }).where(eq(partnerships.id, partnershipId));
  } else {
    await db.update(partnerships).set({ ...update, partnerTypingUntil: typingUntil }).where(eq(partnerships.id, partnershipId));
  }
  return { typing, typingUntil };
}

export async function getPartnerTypingState(partnershipId: number, userId: number) {
  const partnership = await getPartnershipForMember(partnershipId, userId);
  if (!partnership) throw new Error("Partnership not found");
  if (partnership.status !== "active") throw new Error("Active partnership required");

  const partnerTypingUntil = partnership.userId === userId
    ? partnership.partnerTypingUntil
    : partnership.userTypingUntil;
  const isTyping = isTypingActive(partnerTypingUntil);
  return { isTyping, expiresAt: isTyping ? partnerTypingUntil : null };
}

export async function setPartnershipPublicKey(partnershipId: number, userId: number, publicKey: string) {
  const partnership = await getPartnershipForMember(partnershipId, userId);
  if (!partnership) throw new Error("Partnership not found");
  if (partnership.status !== "active") throw new Error("Approve the partnership request before setting up encryption");
  const existing = partnership.userId === userId ? partnership.userPublicKey : partnership.partnerPublicKey;
  if (existing && existing !== publicKey) {
    throw new Error("Security key already registered. Reconnect your partner to rotate keys.");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (partnership.userId === userId) {
    await db.update(partnerships).set({ userPublicKey: publicKey, updatedAt: new Date() }).where(eq(partnerships.id, partnershipId));
  } else {
    await db.update(partnerships).set({ partnerPublicKey: publicKey, updatedAt: new Date() }).where(eq(partnerships.id, partnershipId));
  }
  return getPartnershipForMember(partnershipId, userId);
}

export async function createMessage(data: InsertMessage & { clientMessageId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(messages)
    .values(data)
    .onDuplicateKeyUpdate({ set: { clientMessageId: data.clientMessageId } });
  return (
    await db
      .select()
      .from(messages)
      .where(and(eq(messages.senderId, data.senderId), eq(messages.clientMessageId, data.clientMessageId)))
      .limit(1)
  )[0];
}

export async function getMessages(partnershipId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.partnershipId, partnershipId)).orderBy(desc(messages.createdAt)).limit(limit);
}

export async function acknowledgeMessages(
  partnershipId: number,
  recipientId: number,
  messageIds: number[],
  status: Exclude<ReceiptStatus, "sent">,
) {
  const partnership = await getPartnershipForMember(partnershipId, recipientId);
  if (!partnership || partnership.status !== "active") throw new Error("Active partnership required");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (messageIds.length === 0) return;

  const recipientMessages = and(
    eq(messages.partnershipId, partnershipId),
    inArray(messages.id, messageIds),
    ne(messages.senderId, recipientId),
  );
  const now = new Date();

  if (status === "delivered") {
    await db
      .update(messages)
      .set({ status: "delivered", deliveredAt: now })
      .where(and(recipientMessages, eq(messages.status, "sent")));
    return;
  }

  // Reading a sent message also records its delivery. Existing deliveredAt values remain intact.
  await db
    .update(messages)
    .set({ status: "read", deliveredAt: now, readAt: now })
    .where(and(recipientMessages, eq(messages.status, "sent")));
  await db
    .update(messages)
    .set({ status: "read", readAt: now })
    .where(and(recipientMessages, eq(messages.status, "delivered")));
}

export async function registerDevicePushToken(userId: number, token: string, platform: string, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(devicePushTokens).values({ userId, token, platform, enabled: enabled ? 1 : 0, lastSeenAt: new Date() })
    .onDuplicateKeyUpdate({ set: { userId, platform, enabled: enabled ? 1 : 0, lastSeenAt: new Date(), updatedAt: new Date() } });
}

export async function setPushNotificationsEnabled(userId: number, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(devicePushTokens).set({ enabled: enabled ? 1 : 0, updatedAt: new Date() }).where(eq(devicePushTokens.userId, userId));
}

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  notificationsEnabled: 1,
  quietHoursEnabled: 0,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  timezone: "UTC",
} as const;

export type NotificationPreferencesInput = {
  notificationsEnabled: 0 | 1;
  quietHoursEnabled: 0 | 1;
  quietHoursStart: number;
  quietHoursEnd: number;
  timezone: string;
};

export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return { userId, ...DEFAULT_NOTIFICATION_PREFERENCES };
  const preferences = (
    await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1)
  )[0];
  return preferences ?? { userId, ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export async function upsertNotificationPreferences(userId: number, preferences: NotificationPreferencesInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(notificationPreferences)
    .values({ userId, ...preferences })
    .onDuplicateKeyUpdate({ set: { ...preferences, updatedAt: new Date() } });
  return getNotificationPreferences(userId);
}

export async function getEnabledPushTokens(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devicePushTokens).where(and(eq(devicePushTokens.userId, userId), eq(devicePushTokens.enabled, 1)));
}

export async function claimNotificationDelivery(userId: number, deliveryKey: string, type: string) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ id: notificationDeliveries.id }).from(notificationDeliveries)
    .where(eq(notificationDeliveries.deliveryKey, deliveryKey)).limit(1);
  if (existing.length) return false;
  await db.insert(notificationDeliveries).values({ userId, deliveryKey, type, status: "queued" });
  return true;
}

export async function markNotificationDelivery(deliveryKey: string, status: "sent" | "failed" | "suppressed") {
  const db = await getDb();
  if (!db) return;
  await db.update(notificationDeliveries).set({ status, updatedAt: new Date() }).where(eq(notificationDeliveries.deliveryKey, deliveryKey));
}

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(tasks).values(data);
}

export async function getTasks(partnershipId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.partnershipId, partnershipId)).orderBy(desc(tasks.createdAt));
}

export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0];
}

export async function updateTask(taskId: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, taskId));
}

export async function deleteTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(tasks).where(eq(tasks.id, taskId));
}

export async function getTaskStats(partnershipId: number) {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0 };
  const allTasks = await db.select().from(tasks).where(eq(tasks.partnershipId, partnershipId));
  return { total: allTasks.length, completed: allTasks.filter((task) => task.completed === 1).length };
}

export async function createGoal(data: InsertGoal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(goals).values(data);
}

export async function getGoals(partnershipId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goals).where(eq(goals.partnershipId, partnershipId)).orderBy(desc(goals.createdAt));
}

export async function getGoalById(goalId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(goals).where(eq(goals.id, goalId)).limit(1))[0];
}

export async function updateGoal(goalId: number, data: Partial<InsertGoal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(goals).set({ ...data, updatedAt: new Date() }).where(eq(goals.id, goalId));
}

export async function deleteGoal(goalId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(goals).where(eq(goals.id, goalId));
}
