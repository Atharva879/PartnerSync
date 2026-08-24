/**
 * Returns whether an hour is inside the configured daily quiet-hours window.
 * Start is inclusive and end is exclusive. Equal hours disable the window,
 * preventing an accidental 24-hour mute.
 */
export function isInQuietHours(
  startHour: number | null | undefined,
  endHour: number | null | undefined,
  localHour: number,
): boolean {
  const isValidHour = (hour: unknown): hour is number =>
    typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour <= 23;

  if (!isValidHour(startHour) || !isValidHour(endHour) || !isValidHour(localHour) || startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return localHour >= startHour && localHour < endHour;
  }

  return localHour >= startHour || localHour < endHour;
}

/** Converts a UTC instant to a local hour without relying on the server's own timezone. */
export function getHourInTimezone(timezone: string, now = new Date()): number | null {
  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .find((part) => part.type === "hour")?.value;
    const parsed = hour === undefined ? Number.NaN : Number(hour);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
  } catch {
    return null;
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}
