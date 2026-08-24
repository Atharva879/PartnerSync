import { describe, expect, it } from "vitest";

const requiredConfigKeys = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
] as const;

describe("Firebase public client configuration", () => {
  it("authenticates the configured project key against the Firebase Authentication API", async () => {
    const missing = requiredConfigKeys.filter((key) => !process.env[key]);
    expect(missing).toEqual([]);

    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY!;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    const body = await response.text();

    // Firebase Authentication returns MISSING_ID_TOKEN for an authenticated
    // project key with no user token. An invalid or restricted key reports a
    // key-specific error instead.
    expect(response.status).toBe(400);
    expect(body).toMatch(/MISSING_ID_TOKEN/i);
    expect(body).not.toMatch(/API key not valid|API_KEY_INVALID/i);
  }, 15_000);
});
