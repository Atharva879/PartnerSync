import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";
import { notifyPartnerDevice } from "./push";
import { z } from "zod";
import { isValidTimezone } from "../shared/quiet-hours";

const notificationPreferencesSchema = z.object({
  notificationsEnabled: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.number().int().min(0).max(23),
  quietHoursEnd: z.number().int().min(0).max(23),
  timezone: z.string().trim().min(1).max(64).refine(isValidTimezone, "Use a valid IANA timezone"),
});

async function requireActivePartnership(partnershipId: number, userId: number) {
  const partnership = await db.getPartnershipForMember(partnershipId, userId);
  if (!partnership || partnership.status !== "active") {
    throw new Error("An active partner connection is required");
  }
  return partnership;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Partnership routes
  partnership: router({
    getActive: protectedProcedure.query(({ ctx }) =>
      db.getActivePartnership(ctx.user.id)
    ),
    getLatest: protectedProcedure.query(({ ctx }) =>
      db.getLatestPartnershipForMember(ctx.user.id)
    ),
    create: protectedProcedure
      .input(z.object({ partnerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id === input.partnerId) throw new Error("Choose a different partner ID");
        const partner = await db.getUserById(input.partnerId);
        if (!partner) throw new Error("Partner ID not found");
        return db.createOrRenewPartnershipRequest(ctx.user.id, input.partnerId);
      }),
    updateStatus: protectedProcedure
      .input(z.object({ partnershipId: z.number(), status: z.enum(["pending", "active", "disconnected"]) }))
      .mutation(({ ctx, input }) =>
        db.updatePartnershipStatus(input.partnershipId, ctx.user.id, input.status as "pending" | "active" | "disconnected")
      ),
    respondToRequest: protectedProcedure
      .input(z.object({ partnershipId: z.number(), action: z.enum(["approve", "decline"]) }))
      .mutation(async ({ ctx, input }) => {
        const partnership = await db.respondToPartnershipRequest(input.partnershipId, ctx.user.id, input.action);
        if (!partnership) throw new Error("Partnership request not found");
        if (input.action === "approve") {
          const requesterId = partnership.userId === ctx.user.id ? partnership.partnerId : partnership.userId;
          void notifyPartnerDevice(requesterId, "connection_approved", `connection-approved:${partnership.id}:${partnership.updatedAt.getTime()}`);
        }
        return partnership;
      }),
    reconnect: protectedProcedure
      .input(z.object({ partnershipId: z.number() }))
      .mutation(({ ctx, input }) =>
        db.reconnectPartnership(input.partnershipId, ctx.user.id)
      ),
    publishPublicKey: protectedProcedure
      .input(z.object({ partnershipId: z.number(), publicKey: z.string().min(40).max(128) }))
      .mutation(({ ctx, input }) =>
        db.setPartnershipPublicKey(input.partnershipId, ctx.user.id, input.publicKey)
      ),
    setTyping: protectedProcedure
      .input(z.object({ partnershipId: z.number(), typing: z.boolean() }))
      .mutation(({ ctx, input }) =>
        db.setTypingState(input.partnershipId, ctx.user.id, input.typing)
      ),
    getPartnerTyping: protectedProcedure
      .input(z.object({ partnershipId: z.number() }))
      .query(({ ctx, input }) =>
        db.getPartnerTypingState(input.partnershipId, ctx.user.id)
      ),
  }),

  // Message routes
  messages: router({
    list: protectedProcedure
      .input(z.object({ partnershipId: z.number() }))
      .query(async ({ ctx, input }) => {
        const partnership = await db.getPartnershipForMember(input.partnershipId, ctx.user.id);
        if (!partnership) throw new Error("Partnership not found");
        return db.getMessages(input.partnershipId);
      }),
    create: protectedProcedure
      .input(
        z.object({
          partnershipId: z.number(),
          clientMessageId: z.string().min(12).max(64),
          encryptedContent: z.string().min(1).max(16000),
          nonce: z.string().min(1).max(64),
          senderEncryptedContent: z.string().min(1).max(16000),
          senderNonce: z.string().min(1).max(64),
          senderPublicKey: z.string().min(40).max(128),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const partnership = await db.getPartnershipForMember(input.partnershipId, ctx.user.id);
        if (!partnership || partnership.status !== "active") throw new Error("Active partnership required");
        const registeredKey = partnership.userId === ctx.user.id
          ? partnership.userPublicKey
          : partnership.partnerPublicKey;
        const recipientKey = partnership.userId === ctx.user.id
          ? partnership.partnerPublicKey
          : partnership.userPublicKey;
        if (!registeredKey || !recipientKey || registeredKey !== input.senderPublicKey) {
          throw new Error("Encryption keys are not ready. Both partners must open Chat once.");
        }
        const message = await db.createMessage({
          partnershipId: input.partnershipId,
          senderId: ctx.user.id,
          clientMessageId: input.clientMessageId,
          encryptedContent: input.encryptedContent,
          nonce: input.nonce,
          senderEncryptedContent: input.senderEncryptedContent,
          senderNonce: input.senderNonce,
          senderPublicKey: input.senderPublicKey,
          iv: "nacl-box-v1",
          status: "sent",
        });
        const recipientId = partnership.userId === ctx.user.id ? partnership.partnerId : partnership.userId;
        void notifyPartnerDevice(recipientId, "encrypted_message", `encrypted-message:${message.id}`);
        return message;
      }),
    acknowledge: protectedProcedure
      .input(z.object({
        partnershipId: z.number(),
        messageIds: z.array(z.number().int().positive()).min(1).max(50),
        status: z.enum(["delivered", "read"]),
      }))
      .mutation(({ ctx, input }) =>
        db.acknowledgeMessages(input.partnershipId, ctx.user.id, input.messageIds, input.status)
      ),
  }),

  notifications: router({
    registerDevice: protectedProcedure
      .input(z.object({ token: z.string().min(10).max(255), platform: z.enum(["ios", "android"]), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const preferences = await db.getNotificationPreferences(ctx.user.id);
        return db.registerDevicePushToken(
          ctx.user.id,
          input.token,
          input.platform,
          input.enabled && preferences.notificationsEnabled === 1,
        );
      }),
    getPreferences: protectedProcedure.query(({ ctx }) =>
      db.getNotificationPreferences(ctx.user.id)
    ),
    setPreferences: protectedProcedure
      .input(notificationPreferencesSchema)
      .mutation(async ({ ctx, input }) => {
        const preferences = await db.upsertNotificationPreferences(ctx.user.id, {
          notificationsEnabled: input.notificationsEnabled ? 1 : 0,
          quietHoursEnabled: input.quietHoursEnabled ? 1 : 0,
          quietHoursStart: input.quietHoursStart,
          quietHoursEnd: input.quietHoursEnd,
          timezone: input.timezone,
        });
        await db.setPushNotificationsEnabled(ctx.user.id, input.notificationsEnabled);
        return preferences;
      }),
    setEnabled: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const current = await db.getNotificationPreferences(ctx.user.id);
        const preferences = await db.upsertNotificationPreferences(ctx.user.id, {
          notificationsEnabled: input.enabled ? 1 : 0,
          quietHoursEnabled: current.quietHoursEnabled ? 1 : 0,
          quietHoursStart: current.quietHoursStart,
          quietHoursEnd: current.quietHoursEnd,
          timezone: current.timezone,
        });
        await db.setPushNotificationsEnabled(ctx.user.id, input.enabled);
        return preferences;
      }),
  }),

  // Task routes
  tasks: router({
    list: protectedProcedure
      .input(z.object({ partnershipId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireActivePartnership(input.partnershipId, ctx.user.id);
        return db.getTasks(input.partnershipId);
      }),
    create: protectedProcedure
      .input(
        z.object({
          partnershipId: z.number().int().positive(),
          title: z.string().trim().min(1).max(240),
          description: z.string().optional(),
          priority: z.enum(["low", "medium", "high"]),
          dueDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireActivePartnership(input.partnershipId, ctx.user.id);
        return db.createTask({
          partnershipId: input.partnershipId,
          createdBy: ctx.user.id,
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          completed: z.union([z.literal(0), z.literal(1)]).optional(),
          title: z.string().trim().min(1).max(240).optional(),
          priority: z.enum(["low", "medium", "high"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task) throw new Error("Task not found");
        await requireActivePartnership(task.partnershipId, ctx.user.id);
        const updateData: any = {};
        if (input.completed !== undefined) {
          updateData.completed = input.completed;
          if (input.completed === 1) {
            updateData.completedBy = ctx.user.id;
            updateData.completedAt = new Date();
          }
        }
        if (input.title !== undefined) updateData.title = input.title;
        if (input.priority !== undefined) updateData.priority = input.priority;
        return db.updateTask(input.taskId, updateData);
      }),
    delete: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task) throw new Error("Task not found");
        await requireActivePartnership(task.partnershipId, ctx.user.id);
        return db.deleteTask(input.taskId);
      }),
    stats: protectedProcedure
      .input(z.object({ partnershipId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireActivePartnership(input.partnershipId, ctx.user.id);
        return db.getTaskStats(input.partnershipId);
      }),
  }),

  // Goal routes
  goals: router({
    list: protectedProcedure
      .input(z.object({ partnershipId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireActivePartnership(input.partnershipId, ctx.user.id);
        return db.getGoals(input.partnershipId);
      }),
    create: protectedProcedure
      .input(
        z.object({
          partnershipId: z.number().int().positive(),
          title: z.string().trim().min(1).max(240),
          targetRate: z.number().int().min(0).max(100),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireActivePartnership(input.partnershipId, ctx.user.id);
        return db.createGoal({
          partnershipId: input.partnershipId,
          title: input.title,
          targetRate: input.targetRate,
          description: input.description,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          goalId: z.number().int().positive(),
          title: z.string().trim().min(1).max(240).optional(),
          targetRate: z.number().int().min(0).max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const goal = await db.getGoalById(input.goalId);
        if (!goal) throw new Error("Goal not found");
        await requireActivePartnership(goal.partnershipId, ctx.user.id);
        return db.updateGoal(input.goalId, {
          title: input.title,
          targetRate: input.targetRate,
        });
      }),
    delete: protectedProcedure
      .input(z.object({ goalId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const goal = await db.getGoalById(input.goalId);
        if (!goal) throw new Error("Goal not found");
        await requireActivePartnership(goal.partnershipId, ctx.user.id);
        return db.deleteGoal(input.goalId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
