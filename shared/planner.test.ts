import { describe, expect, it } from "vitest";
import { defaultPlanInput, departureFor, safetySlackFor } from "./planner";

describe("Gwangyang Port departure buffers", () => {
  it("adds the mandatory 15-minute port buffer for Gwangyang Port destinations", () => {
    const input = { ...defaultPlanInput, destination: "광양항 GWCT", arrivalTime: "15:30", workload: "busy" as const };
    expect(safetySlackFor(input)).toEqual({ base: 24, portBuffer: 15, total: 39 });
    expect(departureFor(input, 124)).toBe("13:27");
  });

  it("does not add the port buffer to non-port destinations", () => {
    const input = { ...defaultPlanInput, destination: "여수국가산단", arrivalTime: "15:30", workload: "busy" as const };
    expect(safetySlackFor(input)).toEqual({ base: 24, portBuffer: 0, total: 24 });
    expect(departureFor(input, 124)).toBe("13:42");
  });
});
