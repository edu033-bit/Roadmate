import type { EvidenceSource, PlanInput, RouteOption, SourceReliability } from "@shared/planner";

type Available<T> = { available: true; value: T; evidence: EvidenceSource };
type Unavailable = { available: false; reason: string; evidence: EvidenceSource };
export type AdapterResult<T> = Available<T> | Unavailable;

type HgvRoute = { durationMinutes: number; distanceKm: number; geometry?: [number, number][] };
type WeatherReading = { windMps?: number; rainMm?: number; precipitationType?: number };
type VmsReading = { hasAdvisory: boolean; messages: string[] };

const observedAt = () => new Date().toISOString();

const unavailable = <T>(provider: EvidenceSource["provider"], label: string, sourceType: EvidenceSource["sourceType"], reason: string): AdapterResult<T> => ({
  available: false,
  reason,
  evidence: { provider, label, sourceType, reliability: "insufficient", observedAt: observedAt(), detail: "실시간 데이터를 사용할 수 없습니다.", failureReason: reason },
});

const available = <T>(provider: EvidenceSource["provider"], label: string, sourceType: EvidenceSource["sourceType"], reliability: SourceReliability, detail: string, value: T): AdapterResult<T> => ({
  available: true,
  value,
  evidence: { provider, label, sourceType, reliability, observedAt: observedAt(), detail },
});

const fetchJson = async (url: string, headers?: HeadersInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`공급자 응답 ${response.status}`);
    return await response.json() as unknown;
  } finally {
    clearTimeout(timeout);
  }
};

const locationCoordinates: Record<string, [number, number]> = {
  "광양항 GWCT": [127.7188, 34.8806],
  "여수국가산단": [127.7006, 34.8186],
  "광양항 컨테이너터미널": [127.7188, 34.8806],
};

const fallbackCoordinates: [number, number] = [127.7158, 34.8665];
const coordinatesFor = (location: string) => locationCoordinates[location] ?? fallbackCoordinates;

const kmaGrid = ([longitude, latitude]: [number, number]) => {
  const rad = Math.PI / 180;
  const earthRadius = 6371.00877 / 5;
  const standardLat1 = 30 * rad;
  const standardLat2 = 60 * rad;
  const originLon = 126 * rad;
  const originLat = 38 * rad;
  const scale = Math.tan(Math.PI * 0.25 + standardLat2 * 0.5) / Math.tan(Math.PI * 0.25 + standardLat1 * 0.5);
  const sn = Math.log(Math.cos(standardLat1) / Math.cos(standardLat2)) / Math.log(scale);
  const sf = Math.pow(Math.tan(Math.PI * 0.25 + standardLat1 * 0.5), sn) * Math.cos(standardLat1) / sn;
  const ro = earthRadius * sf / Math.pow(Math.tan(Math.PI * 0.25 + originLat * 0.5), sn);
  const ra = earthRadius * sf / Math.pow(Math.PI * 0.25 + latitude * rad * 0.5, -sn);
  let theta = longitude * rad - originLon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + 43.5), ny: Math.floor(ro - ra * Math.cos(theta) + 136.5) };
};

const latestKmaBase = () => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const ref = new Date(kst.getTime() - (kst.getUTCMinutes() < 45 ? 60 * 60 * 1000 : 0));
  const pad = (value: number) => String(value).padStart(2, "0");
  return { baseDate: `${ref.getUTCFullYear()}${pad(ref.getUTCMonth() + 1)}${pad(ref.getUTCDate())}`, baseTime: `${pad(ref.getUTCHours())}00` };
};

export const plannerAdapters = {
  async hgvRoutes(input: PlanInput): Promise<AdapterResult<HgvRoute[]>> {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) return unavailable("ORS HGV", "대형차 경로", "estimated", "ORS API 키가 구성되지 않았습니다.");
    const start = coordinatesFor(input.origin);
    const end = coordinatesFor(input.destination);
    const query = new URLSearchParams({ start: start.join(","), end: end.join(","), alternative_routes: "true" });
    try {
      const response = await fetchJson(`https://api.openrouteservice.org/v2/directions/driving-hgv?${query}`, { Authorization: apiKey }) as { features?: Array<{ properties?: { summary?: { duration?: number; distance?: number } }; geometry?: { coordinates?: [number, number][] } }> };
      const routes = (response.features ?? []).flatMap((feature) => {
        const summary = feature.properties?.summary;
        if (!summary?.duration || !summary.distance) return [];
        return [{ durationMinutes: Math.ceil(summary.duration / 60), distanceKm: Number((summary.distance / 1000).toFixed(1)), geometry: feature.geometry?.coordinates }];
      });
      if (routes.length === 0) return unavailable("ORS HGV", "대형차 경로", "estimated", "대형차 경로 후보를 받지 못했습니다.");
      return available("ORS HGV", "대형차 경로", "estimated", "sufficient", "대형차 제약을 반영한 경로 후보", routes);
    } catch (error) {
      return unavailable("ORS HGV", "대형차 경로", "estimated", error instanceof Error ? error.message : "ORS 호출 실패");
    }
  },

  async weather(input: PlanInput): Promise<AdapterResult<WeatherReading>> {
    const apiKey = process.env.DATA_GO_KR_SERVICE_KEY;
    if (!apiKey) return unavailable("기상청", "기상 관측", "realtime", "공공데이터 서비스 키가 구성되지 않았습니다.");
    const grid = kmaGrid(coordinatesFor(input.origin));
    const query = new URLSearchParams({ serviceKey: apiKey, dataType: "JSON", numOfRows: "60", ...latestKmaBase(), nx: String(grid.nx), ny: String(grid.ny) });
    try {
      const response = await fetchJson(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?${query}`) as { response?: { body?: { items?: { item?: Array<{ category?: string; obsrValue?: string }> } } } };
      const items = response.response?.body?.items?.item;
      if (!items?.length) return unavailable("기상청", "기상 관측", "realtime", "기상청 관측 항목이 비어 있습니다.");
      const reading = Object.fromEntries(items.map((item) => [item.category, Number(item.obsrValue)]));
      const windMps = reading.WSD;
      const rainMm = reading.RN1;
      const precipitationType = reading.PTY;
      if (![windMps, rainMm, precipitationType].some(Number.isFinite)) return unavailable("기상청", "기상 관측", "realtime", "기상 관측값 형식이 올바르지 않습니다.");
      return available("기상청", "기상 관측", "realtime", "sufficient", "기상청 초단기실황", { windMps, rainMm, precipitationType });
    } catch (error) {
      return unavailable("기상청", "기상 관측", "realtime", error instanceof Error ? error.message : "기상청 호출 실패");
    }
  },

  async highwayVms(): Promise<AdapterResult<VmsReading>> {
    const apiKey = process.env.EX_HIGHWAY_API_KEY;
    if (!apiKey) return unavailable("한국도로공사", "도로·VMS 안내", "realtime", "한국도로공사 API 키가 구성되지 않았습니다.");
    try {
      const query = new URLSearchParams({ key: apiKey, type: "json" });
      const response = await fetchJson(`https://data.ex.co.kr/openapi/vms/vmsList?${query}`) as Record<string, unknown>;
      const raw = JSON.stringify(response);
      const messages = raw.match(/[가-힣A-Za-z0-9 ]{8,80}/g)?.slice(0, 3) ?? [];
      return available("한국도로공사", "도로·VMS 안내", "realtime", "partial", "고속도로 VMS 공개 데이터", { hasAdvisory: messages.length > 0, messages });
    } catch (error) {
      return unavailable("한국도로공사", "도로·VMS 안내", "realtime", error instanceof Error ? error.message : "한국도로공사 VMS 호출 실패");
    }
  },

  portPattern(input: PlanInput): AdapterResult<{ applied: boolean }> {
    const applied = /광양항|gwangyang\s*port|gwct/i.test(input.destination);
    return available("여수광양항만공사", "광양항 과거 패턴", "historical", "partial", applied ? "광양항 목적지에 과거 시간대 버퍼 15분을 반영했습니다. 실시간 게이트 대기시간이 아닙니다." : "목적지가 광양항이 아니어서 항만 패턴 버퍼를 적용하지 않았습니다.", { applied });
  },
};

export const makeRouteOptions = (input: PlanInput, routes: HgvRoute[], portBufferApplied: boolean): RouteOption[] => {
  const labels: Array<Pick<RouteOption, "id" | "label" | "description">> = [
    { id: "balanced", label: "기본 추천", description: "시간과 예상 직접비의 균형" },
    { id: "fastest", label: "시간 우선", description: "예상 소요시간이 가장 짧은 후보" },
    { id: "lowest-cost", label: "비용 우선", description: "예상 직접비가 낮은 후보" },
  ];
  return routes.slice(0, 3).map((route, index) => {
    const variant = labels[index] ?? labels[0];
    const directCostKrw = Math.round((route.distanceKm / input.vehicle.fuelEfficiencyKmPerL) * 1550);
    return { ...variant, departure: "", durationMinutes: route.durationMinutes, distanceKm: route.distanceKm, directCostKrw, costReliability: "partial", status: "normal", portBufferApplied, geometry: route.geometry };
  });
};
