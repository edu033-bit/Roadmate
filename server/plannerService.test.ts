import { describe, expect, it } from "vitest";
import { defaultPlanInput } from "@shared/planner";
import { createPlan } from "./plannerService";

describe("planner API service", () => {
  it("always returns usable fallback candidates when live evidence is incomplete", async () => {
    const plan = await createPlan({ ...defaultPlanInput, destination: "광양항 GWCT" });
    expect(plan.options.options).toHaveLength(3);
    expect(plan.summary.portBufferMinutes).toBe(15);
    expect(plan.summary.departureWindow.start).toMatch(/^\d{2}:\d{2}$/);
  }, 20_000);
});
