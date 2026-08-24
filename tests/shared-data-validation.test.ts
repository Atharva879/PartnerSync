import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";

const caller = appRouter.createCaller({
  req: {} as never,
  res: {} as never,
  user: { id: 1 } as never,
});

describe("shared task and goal validation", () => {
  it("rejects blank shared task titles before any database write", async () => {
    await expect(
      caller.tasks.create({ partnershipId: 1, title: "   ", priority: "medium" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects completion targets outside the supported 0–100 range", async () => {
    await expect(
      caller.goals.create({ partnershipId: 1, title: "Weekly plan", targetRate: 101 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.goals.create({ partnershipId: 1, title: "Weekly plan", targetRate: -1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
