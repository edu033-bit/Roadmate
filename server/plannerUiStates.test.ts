import { describe, expect, it } from "vitest";
import { createFallbackPlan, createRiskState, defaultPlanInput } from "@shared/planner";

const dashboardState = (status: "normal" | "caution" | "high" | "insufficient") => {
  const fallback = createFallbackPlan(defaultPlanInput);
  const risk = createRiskState(status);
  return {
    badge: risk.status,
    headline: risk.title,
    canStart: status !== "high",
    fallbackCandidateCount: fallback.options.options.length,
    departurePattern: fallback.summary.departureWindow.start,
  };
};

describe("planner dashboard UI states", () => {
  it.each(["normal", "caution", "high", "insufficient"] as const)("preserves the %s state contract", (status) => {
    expect(dashboardState(status)).toMatchSnapshot();
  });
});
