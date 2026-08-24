import { describe, expect, it } from "vitest";

import { getHourInTimezone, isInQuietHours } from "../shared/quiet-hours";

describe("quiet-hours windows", () => {
  it("includes the start and excludes the end of a same-day window", () => {
    expect(isInQuietHours(14, 16, 13)).toBe(false);
    expect(isInQuietHours(14, 16, 14)).toBe(true);
    expect(isInQuietHours(14, 16, 15)).toBe(true);
    expect(isInQuietHours(14, 16, 16)).toBe(false);
  });

  it("suppresses an overnight window across midnight", () => {
    expect(isInQuietHours(22, 8, 21)).toBe(false);
    expect(isInQuietHours(22, 8, 22)).toBe(true);
    expect(isInQuietHours(22, 8, 0)).toBe(true);
    expect(isInQuietHours(22, 8, 7)).toBe(true);
    expect(isInQuietHours(22, 8, 8)).toBe(false);
  });

  it("leaves notifications active for disabled or invalid windows", () => {
    expect(isInQuietHours(9, 9, 9)).toBe(false);
    expect(isInQuietHours(null, 8, 0)).toBe(false);
    expect(isInQuietHours(22, 24, 23)).toBe(false);
  });

  it("derives recipient-local hours from a UTC instant", () => {
    const instant = new Date("2026-01-01T20:30:00.000Z");
    expect(getHourInTimezone("Asia/Kolkata", instant)).toBe(2);
    expect(getHourInTimezone("not/a-real-timezone", instant)).toBeNull();
  });
});
