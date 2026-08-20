export type RiskStatus = "normal" | "caution" | "high" | "insufficient";
export type SourceReliability = "sufficient" | "partial" | "insufficient";
export type VehiclePreset = "two-axle" | "three-axle" | "special";
export type Workload = "busy" | "relaxed";

export type VehicleSpecs = {
  lengthM: number;
  widthM: number;
  heightM: number;
  weightTons: number;
  axleLoadTons: number;
  fuelEfficiencyKmPerL: number;
  hazmat: boolean;
};

export type PlanInput = {
  origin: string;
  destination: string;
  arrivalTime: string;
  workload: Workload;
  vehiclePreset: VehiclePreset;
  vehicle: VehicleSpecs;
};

export type EvidenceSource = {
  provider: "ORS HGV" | "기상청" | "한국도로공사" | "여수광양항만공사";
  label: string;
  sourceType: "realtime" | "estimated" | "historical";
  reliability: SourceReliability;
  observedAt: string;
  detail: string;
  failureReason?: string;
};

export type RiskState = {
  status: RiskStatus;
  title: string;
  message: string;
  reasons: string[];
};

export type RouteOption = {
  id: "balanced" | "fastest" | "lowest-cost";
  label: string;
  description: string;
  departure: string;
  durationMinutes: number;
  distanceKm: number;
  directCostKrw: number;
  costReliability: SourceReliability;
  status: RiskStatus;
  portBufferApplied: boolean;
  geometry?: [number, number][];
};

export type PlanSummary = {
  planId: string;
  risk: RiskState;
  departureWindow: { start: string; end: string };
  safetySlackMinutes: number;
  portBufferMinutes: number;
  fallbackMode: boolean;
  sources: EvidenceSource[];
};

export type PlanOptions = {
  planId: string;
  fallbackMode: boolean;
  options: RouteOption[];
  sources: EvidenceSource[];
};

export const defaultVehicleSpecs = (preset: VehiclePreset): VehicleSpecs => {
  if (preset === "two-axle") {
    return { lengthM: 12, widthM: 2.5, heightM: 4, weightTons: 25, axleLoadTons: 10, fuelEfficiencyKmPerL: 3.8, hazmat: false };
  }
  if (preset === "special") {
    return { lengthM: 19, widthM: 2.5, heightM: 4.2, weightTons: 44, axleLoadTons: 11, fuelEfficiencyKmPerL: 2.6, hazmat: false };
  }
  return { lengthM: 16.7, widthM: 2.5, heightM: 4, weightTons: 40, axleLoadTons: 10, fuelEfficiencyKmPerL: 3.2, hazmat: false };
};

export const defaultPlanInput: PlanInput = {
  origin: "광양항 GWCT",
  destination: "여수국가산단",
  arrivalTime: "15:30",
  workload: "busy",
  vehiclePreset: "three-axle",
  vehicle: defaultVehicleSpecs("three-axle"),
};

export const isGwangyangPortDestination = (destination: string) => /광양항|gwangyang\s*port|gwct/i.test(destination);

export const timeToMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 15 * 60 + 30;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : 15 * 60 + 30;
};

export const formatTime = (minutes: number) => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
};

export const safetySlackFor = (input: Pick<PlanInput, "workload" | "destination">) => {
  const base = input.workload === "busy" ? 24 : 36;
  const portBuffer = isGwangyangPortDestination(input.destination) ? 15 : 0;
  return { base, portBuffer, total: base + portBuffer };
};

export const departureFor = (input: Pick<PlanInput, "arrivalTime" | "workload" | "destination">, durationMinutes: number) => {
  const safety = safetySlackFor(input);
  return formatTime(timeToMinutes(input.arrivalTime) - durationMinutes - safety.total);
};

export const formatDuration = (durationMinutes: number) => `${Math.floor(durationMinutes / 60)}시간 ${durationMinutes % 60}분`;

const riskCopy: Record<RiskStatus, Omit<RiskState, "status">> = {
  normal: { title: "정상 운행 가능", message: "확인된 위험 신호가 낮습니다. 출발 전 현장 안내를 다시 확인하세요.", reasons: ["기상과 도로 안내에서 중대한 위험 신호가 확인되지 않았습니다."] },
  caution: { title: "주의 운행", message: "기상 또는 도로 안내에 주의 요인이 있습니다. 추천 시간대 안에서 여유 있게 출발하세요.", reasons: ["일부 데이터가 주의 수준을 가리킵니다."] },
  high: { title: "고위험: 출발 보류 권장", message: "위험 요인이 해소될 때까지 출발을 보류하고 통제기관 안내를 우선 확인하세요.", reasons: ["기상 또는 도로 위험 신호가 높습니다."] },
  insufficient: { title: "근거 부족: 현장 확인 필요", message: "실시간 데이터가 충분하지 않아 안전한 확정 추천을 제공할 수 없습니다. 대체 후보는 참고용으로만 사용하세요.", reasons: ["일부 외부 데이터 공급자를 확인하지 못했습니다."] },
};

export const createRiskState = (status: RiskStatus, reasons?: string[]): RiskState => ({
  status,
  ...riskCopy[status],
  reasons: reasons && reasons.length > 0 ? reasons : riskCopy[status].reasons,
});

const fallbackSources = (): EvidenceSource[] => {
  const observedAt = new Date().toISOString();
  return [
    { provider: "ORS HGV", label: "대형차 경로", sourceType: "estimated", reliability: "partial", observedAt, detail: "대체 후보 경로 추정치", failureReason: "실시간 경로 공급자 연결이 확인되지 않았습니다." },
    { provider: "기상청", label: "기상 관측", sourceType: "realtime", reliability: "insufficient", observedAt, detail: "실시간 기상 확인 필요", failureReason: "기상 관측값을 수신하지 못했습니다." },
    { provider: "한국도로공사", label: "도로·VMS 안내", sourceType: "realtime", reliability: "insufficient", observedAt, detail: "고속도로 통행·안내 확인 필요", failureReason: "도로 데이터 공급자 연결이 확인되지 않았습니다." },
    { provider: "여수광양항만공사", label: "광양항 과거 패턴", sourceType: "historical", reliability: "partial", observedAt, detail: "실시간 게이트 대기시간이 아닌 과거 시간대 패턴입니다." },
  ];
};

export const createFallbackPlan = (input: PlanInput): { summary: PlanSummary; options: PlanOptions } => {
  const safety = safetySlackFor(input);
  const sources = fallbackSources();
  const options: RouteOption[] = [
    { id: "balanced", label: "기본 추천", description: "시간과 예상 직접비의 균형", departure: departureFor(input, 124), durationMinutes: 124, distanceKm: 126.4, directCostKrw: 27800, costReliability: "partial", status: "insufficient", portBufferApplied: safety.portBuffer > 0 },
    { id: "fastest", label: "시간 우선", description: "예상 소요시간이 가장 짧은 후보", departure: departureFor(input, 112), durationMinutes: 112, distanceKm: 132.8, directCostKrw: 31200, costReliability: "partial", status: "insufficient", portBufferApplied: safety.portBuffer > 0 },
    { id: "lowest-cost", label: "비용 우선", description: "예상 유류비가 가장 낮은 후보", departure: departureFor(input, 133), durationMinutes: 133, distanceKm: 119.2, directCostKrw: 23600, costReliability: "partial", status: "insufficient", portBufferApplied: safety.portBuffer > 0 },
  ];
  const leadOption = options[0];
  const summary: PlanSummary = {
    planId: "fallback-jeonnam-v1",
    risk: createRiskState("insufficient"),
    departureWindow: { start: leadOption.departure, end: formatTime(timeToMinutes(leadOption.departure) + 20) },
    safetySlackMinutes: safety.total,
    portBufferMinutes: safety.portBuffer,
    fallbackMode: true,
    sources,
  };
  return { summary, options: { planId: summary.planId, fallbackMode: true, options, sources } };
};
