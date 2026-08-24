import * as db from "./db";
import { createPartnerPushPayload, type PartnerPushType } from "../shared/push-notification";
import { getHourInTimezone, isInQuietHours } from "../shared/quiet-hours";

export type { PartnerPushType } from "../shared/push-notification";

/** Sends generic, content-free alerts only; encrypted message text never leaves the device. */
export async function notifyPartnerDevice(userId: number, type: PartnerPushType, deliveryKey: string) {
  if (!(await db.claimNotificationDelivery(userId, deliveryKey, type))) return;
  const preferences = await db.getNotificationPreferences(userId);
  if (!preferences.notificationsEnabled) {
    await db.markNotificationDelivery(deliveryKey, "suppressed");
    return;
  }
  if (preferences.quietHoursEnabled) {
    const localHour = getHourInTimezone(preferences.timezone);
    if (localHour !== null && isInQuietHours(preferences.quietHoursStart, preferences.quietHoursEnd, localHour)) {
      await db.markNotificationDelivery(deliveryKey, "suppressed");
      return;
    }
  }
  const tokens = await db.getEnabledPushTokens(userId);
  const payload = createPartnerPushPayload(type);
  if (!tokens.length) {
    await db.markNotificationDelivery(deliveryKey, "failed");
    return;
  }
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(tokens.map(({ token }) => ({ to: token, sound: "default", title: payload.title, body: payload.body, data: { route: payload.route, type: payload.type } }))),
    });
    await db.markNotificationDelivery(deliveryKey, response.ok ? "sent" : "failed");
  } catch (error) {
    console.warn("[Push] Failed to dispatch partner notification", error);
    await db.markNotificationDelivery(deliveryKey, "failed");
  }
}
