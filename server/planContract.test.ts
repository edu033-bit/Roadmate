import { describe, expect, it } from "vitest";
import { defaultPlanInput } from "@shared/planner";
import { createPlan } from "./plannerService";

describe("plan API contract", () => {
  it("returns a complete summary and three non-zero route candidates", async () => {
    const result = await createPlan({ ...defaultPlanInput, destination: "광양항 GWCT" });

    expect(result.summary).toMatchObject({
      planId: expect.any(String),
      risk: { status: expect.any(String), title: expect.any(String), message: expect.any(String) },
      departureWindow: { start: expect.stringMatching(/^\d{2}:\d{2}$/), end: expect.stringMatching(/^\d{2}:\d{2}$/) },
      portBufferMinutes: 15,
    });
    expect(result.options.options).toHaveLength(3);
    for (const option of result.options.options) {
      expect(option.durationMinutes).toBeGreaterThan(0);
      expect(option.directCostKrw).toBeGreaterThan(0);
      expect(option.departure).toMatch(/^\d{2}:\d{2}$/);
    }
  }, 20_000);
});
