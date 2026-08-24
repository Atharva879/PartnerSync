import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Partnership table - stores partner connections between two users
 */
export const partnerships = mysqlTable("partnerships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  partnerId: int("partnerId").notNull(),
  status: mysqlEnum("status", ["pending", "active", "disconnected"]).default("pending").notNull(),
  encryptionKey: text("encryptionKey"), // Shared encryption key (encrypted)
  userPublicKey: text("userPublicKey"), // User's public key for E2E encryption
  partnerPublicKey: text("partnerPublicKey"), // Partner's public key for E2E encryption
  userTypingUntil: timestamp("userTypingUntil"), // Transient typing indicator expiry for the owner
  partnerTypingUntil: timestamp("partnerTypingUntil"), // Transient typing indicator expiry for the partner
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Partnership = typeof partnerships.$inferSelect;
export type InsertPartnership = typeof partnerships.$inferInsert;

/**
 * Messages table - stores end-to-end encrypted messages between partners
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  partnershipId: int("partnershipId").notNull(),
  senderId: int("senderId").notNull(),
  clientMessageId: varchar("clientMessageId", { length: 64 }).unique(), // Client-generated idempotency key for retrying a send
  encryptedContent: text("encryptedContent").notNull(), // Encrypted message (TweetNaCl box)
  nonce: varchar("nonce", { length: 64 }).notNull(), // Nonce for TweetNaCl encryption
  senderPublicKey: text("senderPublicKey"), // Sender's public key for decryption
  senderEncryptedContent: text("senderEncryptedContent"), // Sender's encrypted copy
  senderNonce: varchar("senderNonce", { length: 64 }), // Nonce for sender's encrypted copy
  iv: varchar("iv", { length: 64 }).notNull(), // Sender's public key (for backward compatibility)
  status: mysqlEnum("status", ["sent", "delivered", "read"]).default("sent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Tasks table - shared to-do list items between partners
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  partnershipId: int("partnershipId").notNull(),
  createdBy: int("createdBy").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  dueDate: timestamp("dueDate"),
  completed: int("completed").default(0).notNull(), // 0 = false, 1 = true
  completedBy: int("completedBy"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Goals table - tracks goal completion rates
 */
export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  partnershipId: int("partnershipId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  targetRate: int("targetRate").notNull(), // Target completion percentage (0-100)
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

/** Device-scoped notification registrations. Tokens are never exposed to other users. */
export const devicePushTokens = mysqlTable("devicePushTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  platform: varchar("platform", { length: 24 }).notNull(),
  enabled: int("enabled").default(1).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const notificationDeliveries = mysqlTable("notificationDeliveries", {
  id: int("id").autoincrement().primaryKey(),
  deliveryKey: varchar("deliveryKey", { length: 160 }).notNull().unique(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 40 }).notNull(),
  status: varchar("status", { length: 24 }).default("queued").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Per-user notification controls applied before any recipient device receives a push alert. */
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  notificationsEnabled: int("notificationsEnabled").default(1).notNull(),
  quietHoursEnabled: int("quietHoursEnabled").default(0).notNull(),
  quietHoursStart: int("quietHoursStart").default(22).notNull(),
  quietHoursEnd: int("quietHoursEnd").default(8).notNull(),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
