import { createFallbackPlan, createRiskState, departureFor, formatTime, isGwangyangPortDestination, timeToMinutes, type PlanInput, type PlanOptions, type PlanSummary, type RiskStatus } from "@shared/planner";
import { makeRouteOptions, plannerAdapters } from "./plannerAdapters";

const riskFrom = (weather: { windMps?: number; rainMm?: number; precipitationType?: number }, hasVmsAdvisory: boolean): { status: RiskStatus; reasons: string[] } => {
  const reasons: string[] = [];
  if ((weather.windMps ?? 0) >= 14 || (weather.rainMm ?? 0) >= 35) return { status: "high", reasons: ["강풍 또는 호우 관측값이 고위험 기준에 해당합니다."] };
  if ((weather.windMps ?? 0) >= 7 || (weather.rainMm ?? 0) > 0 || (weather.precipitationType ?? 0) > 0) reasons.push("기상 관측에서 강풍 또는 강수 신호가 확인되었습니다.");
  if (hasVmsAdvisory) reasons.push("고속도로 VMS 안내가 수집되었습니다.");
  return reasons.length > 0 ? { status: "caution", reasons } : { status: "normal", reasons: ["수집된 기상과 도로 안내에서 중대한 위험 신호가 확인되지 않았습니다."] };
};

export async function createPlan(input: PlanInput): Promise<{ summary: PlanSummary; options: PlanOptions }> {
  const fallback = createFallbackPlan(input);
  const [routes, weather, vms] = await Promise.all([plannerAdapters.hgvRoutes(input), plannerAdapters.weather(input), plannerAdapters.highwayVms()]);
  const port = plannerAdapters.portPattern(input);
  const sources = [routes.evidence, weather.evidence, vms.evidence, port.evidence];
  const liveReady = routes.available && weather.available;

  if (!liveReady) {
    return {
      summary: { ...fallback.summary, sources },
      options: { ...fallback.options, sources },
    };
  }

  const vmsData = vms.available ? vms.value : { hasAdvisory: false, messages: [] };
  const assessed = riskFrom(weather.value, vmsData.hasAdvisory);
  const routeOptions = makeRouteOptions(input, routes.value, isGwangyangPortDestination(input.destination)).map((option) => ({
    ...option,
    departure: departureFor(input, option.durationMinutes),
    status: assessed.status,
  }));
  const primary = routeOptions[0] ?? fallback.options.options[0];
  const start = primary.departure;
  const portBufferMinutes = isGwangyangPortDestination(input.destination) ? 15 : 0;
  const safetySlackMinutes = input.workload === "busy" ? 24 + portBufferMinutes : 36 + portBufferMinutes;
  const summary: PlanSummary = {
    planId: "live-jeonnam-v1",
    risk: createRiskState(assessed.status, assessed.reasons),
    departureWindow: { start, end: formatTime(timeToMinutes(start) + 20) },
    safetySlackMinutes,
    portBufferMinutes,
    fallbackMode: false,
    sources,
  };
  return { summary, options: { planId: summary.planId, fallbackMode: false, options: routeOptions, sources } };
}
