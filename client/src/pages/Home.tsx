import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudRain,
  FileWarning,
  Fuel,
  MapPin,
  Moon,
  Navigation,
  Radio,
  Route,
  ShieldAlert,
  Sun,
  Truck,
  Wallet,
  Waves,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createFallbackPlan, createRiskState, defaultPlanInput, defaultVehicleSpecs, formatDuration, type PlanInput, type RiskStatus, type RouteOption, type VehiclePreset } from "@shared/planner";

type Screen = "dashboard" | "compare" | "in-trip";
type LastTrip = { destination: string; departure: string };

const PLAN_STORAGE_KEY = "jeonnam-freight-plan";
const LAST_TRIP_KEY = "jeonnam-freight-last-trip";
const RECENT_DESTINATIONS_KEY = "jeonnam-freight-recent-destinations";

const statusStyle: Record<RiskStatus, { label: string; icon: typeof CheckCircle2; tone: string; card: string }> = {
  normal: { label: "정상", icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", card: "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/25" },
  caution: { label: "주의", icon: AlertTriangle, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", card: "border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/25" },
  high: { label: "고위험", icon: ShieldAlert, tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300", card: "border-rose-500/35 bg-rose-50/80 dark:bg-rose-950/25" },
  insufficient: { label: "근거부족", icon: FileWarning, tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300", card: "border-slate-400/35 bg-slate-100/80 dark:bg-slate-900/55" },
};

const loadStoredPlan = (): PlanInput => {
  if (typeof window === "undefined") return defaultPlanInput;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAN_STORAGE_KEY) ?? "null") as PlanInput | null;
    if (stored?.origin && stored.destination && stored.vehicle) return stored;
  } catch {
    // Corrupted local values should not block planning.
  }
  return defaultPlanInput;
};

const loadLastTrip = (): LastTrip | null => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(LAST_TRIP_KEY) ?? "null") as LastTrip | null;
  } catch {
    return null;
  }
};

const loadRecentDestinations = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_DESTINATIONS_KEY) ?? "[]") as unknown;
    return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 4) : [];
  } catch {
    return [];
  }
};

const formatCost = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

function StatusBadge({ status }: { status: RiskStatus }) {
  const info = statusStyle[status];
  const Icon = info.icon;
  return <Badge className={`gap-1 border-0 px-2.5 py-1 ${info.tone}`}><Icon className="size-3.5" />{info.label}</Badge>;
}

function LoadingSkeleton() {
  return <div className="space-y-4" aria-label="추천 정보를 불러오는 중">
    <div className="h-36 animate-pulse rounded-3xl bg-muted" />
    <div className="h-44 animate-pulse rounded-3xl bg-muted" />
    <div className="h-28 animate-pulse rounded-3xl bg-muted" />
  </div>;
}

function RouteOptionCard({ option, selected, onSelect }: { option: RouteOption; selected: boolean; onSelect: () => void }) {
  return <button
    type="button"
    onClick={onSelect}
    className={`w-full rounded-3xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary bg-primary/5 shadow-[0_12px_34px_-24px_hsl(var(--primary))]" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/45"}`}
    aria-pressed={selected}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-semibold tracking-tight">{option.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
      </div>
      <StatusBadge status={option.status} />
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center">
      <div><Clock3 className="mx-auto mb-1 size-4 text-muted-foreground" /><p className="text-sm font-semibold">{formatDuration(option.durationMinutes)}</p><p className="text-[11px] text-muted-foreground">예상 시간</p></div>
      <div><Wallet className="mx-auto mb-1 size-4 text-muted-foreground" /><p className="text-sm font-semibold">{formatCost(option.directCostKrw)}</p><p className="text-[11px] text-muted-foreground">예상 유류비</p></div>
      <div><Navigation className="mx-auto mb-1 size-4 text-muted-foreground" /><p className="text-sm font-semibold">{option.departure}</p><p className="text-[11px] text-muted-foreground">권장 출발</p></div>
    </div>
  </button>;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const initialParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const requestedView = initialParams.get("view");
  const [screen, setScreen] = useState<Screen>(requestedView === "compare" || requestedView === "in-trip" ? requestedView : "dashboard");
  const [plan, setPlan] = useState<PlanInput>(loadStoredPlan);
  const [selectedId, setSelectedId] = useState<RouteOption["id"]>("balanced");
  const [evidenceOpen, setEvidenceOpen] = useState(initialParams.get("evidence") === "1");
  const [navOpen, setNavOpen] = useState(initialParams.get("nav") === "1");
  const [lastTrip, setLastTrip] = useState<LastTrip | null>(loadLastTrip);
  const [recentDestinations, setRecentDestinations] = useState<string[]>(loadRecentDestinations);

  const summaryQuery = trpc.plan.summary.useQuery(plan, { retry: false, staleTime: 30_000 });
  const optionsQuery = trpc.plan.options.useQuery(plan, { retry: false, staleTime: 30_000 });
  const fallback = useMemo(() => createFallbackPlan(plan), [plan]);
  const resolvedSummary = summaryQuery.data ?? fallback.summary;
  const previewRisk = initialParams.get("risk");
  const summary = previewRisk === "normal" || previewRisk === "caution" || previewRisk === "high" || previewRisk === "insufficient"
    ? { ...resolvedSummary, risk: createRiskState(previewRisk) }
    : resolvedSummary;
  const options = optionsQuery.data?.options ?? fallback.options.options;
  const selectedOption = options.find((option) => option.id === selectedId) ?? options[0];
  // The fallback snapshot is synchronously available, so the route cards never disappear while live evidence is loading.
  const loading = false;
  const canStart = summary.risk.status !== "high" && Boolean(selectedOption);

  useEffect(() => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    if (selectedOption && !options.some((option) => option.id === selectedId)) setSelectedId(selectedOption.id);
  }, [options, selectedId, selectedOption]);

  const updatePreset = (preset: VehiclePreset) => setPlan((current) => ({ ...current, vehiclePreset: preset, vehicle: defaultVehicleSpecs(preset) }));
  const startTrip = () => {
    if (!selectedOption) return;
    const nextLastTrip = { destination: plan.destination, departure: selectedOption.departure };
    const nextRecent = [plan.destination, ...recentDestinations.filter((destination) => destination !== plan.destination)].slice(0, 4);
    window.localStorage.setItem(LAST_TRIP_KEY, JSON.stringify(nextLastTrip));
    window.localStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(nextRecent));
    setLastTrip(nextLastTrip);
    setRecentDestinations(nextRecent);
    setNavOpen(true);
  };
  const openExternalNavigation = () => window.open(`https://map.kakao.com/?q=${encodeURIComponent(plan.destination)}`, "_blank", "noopener,noreferrer");

  if (screen === "in-trip" && selectedOption) {
    return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_33%),hsl(var(--background))] text-foreground">
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-7 pt-5 sm:px-6">
        <header className="flex items-center justify-between"><Button variant="ghost" size="icon" onClick={() => setScreen("dashboard")} aria-label="대시보드로 돌아가기"><ArrowLeft className="size-5" /></Button><p className="text-sm font-semibold">운행 중 재확인</p><ThemeButton theme={theme} onClick={toggleTheme} /></header>
        <div className="my-auto space-y-5 py-8">
          <div className="rounded-[2rem] border border-primary/25 bg-card p-6 shadow-xl shadow-primary/5"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><Truck className="size-5" /></div><div><p className="text-sm text-muted-foreground">목적지</p><h1 className="text-xl font-bold tracking-tight">{plan.destination}</h1></div></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-muted/65 p-4"><p className="text-xs text-muted-foreground">선택 경로</p><p className="mt-1 font-semibold">{selectedOption.label}</p></div><div className="rounded-2xl bg-muted/65 p-4"><p className="text-xs text-muted-foreground">예상 도착 여유</p><p className="mt-1 font-semibold">{summary.safetySlackMinutes}분</p></div></div></div>
          <div className={`rounded-3xl border p-5 ${statusStyle[summary.risk.status].card}`}><div className="flex items-start gap-3"><StatusBadge status={summary.risk.status} /><div><h2 className="font-semibold">{summary.risk.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{summary.risk.message}</p></div></div></div>
        </div>
        <div className="grid gap-3"><Button size="lg" className="h-13 rounded-2xl" onClick={() => setNavOpen(true)}><Navigation className="mr-2 size-5" />내비 앱 열기</Button><Button size="lg" variant="outline" className="h-13 rounded-2xl" onClick={() => setScreen("dashboard")}>대시보드 복귀</Button></div>
      </section>
      <NavigationDialog open={navOpen} onOpenChange={setNavOpen} destination={plan.destination} onOpenExternal={openExternalNavigation} onStart={() => { setNavOpen(false); }} />
    </main>;
  }

  if (screen === "compare") {
    return <main className="min-h-screen bg-background text-foreground"><section className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-5 sm:px-6"><header className="flex items-center justify-between"><Button variant="ghost" size="icon" onClick={() => setScreen("dashboard")} aria-label="대시보드로 돌아가기"><ArrowLeft className="size-5" /></Button><div className="text-center"><p className="text-xs text-muted-foreground">{plan.origin} → {plan.destination}</p><h1 className="font-bold tracking-tight">경로 후보 비교</h1></div><ThemeButton theme={theme} onClick={toggleTheme} /></header><div className="mt-6 rounded-3xl bg-muted/65 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">권장 출발 시간대</p><p className="mt-1 text-xl font-bold">{summary.departureWindow.start} – {summary.departureWindow.end}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">확보 여유</p><p className="mt-1 font-semibold">{summary.safetySlackMinutes}분</p></div></div></div><div className="mt-5 space-y-3">{loading ? <LoadingSkeleton /> : options.map((option) => <RouteOptionCard key={option.id} option={option} selected={option.id === selectedOption?.id} onSelect={() => setSelectedId(option.id)} />)}</div><p className="mt-5 text-center text-xs leading-5 text-muted-foreground">예상 유류비 및 항만 패턴은 참고용입니다. 실제 표지·통제기관 안내를 우선하세요.</p></section><div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-2xl gap-3"><Button variant="outline" className="h-12 flex-1 rounded-2xl" onClick={() => setEvidenceOpen(true)}>근거 보기</Button><Button className="h-12 flex-[1.45] rounded-2xl" disabled={!canStart} onClick={startTrip}>{summary.risk.status === "high" ? "출발 보류 권장" : "선택 경로로 운행 시작"}<ChevronRight className="ml-1 size-4" /></Button></div></div><EvidenceDrawer open={evidenceOpen} onOpenChange={setEvidenceOpen} summary={summary} /></main>;
  }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_85%_-8%,_hsl(var(--primary)/0.22),_transparent_28%),hsl(var(--background))] text-foreground"><section className="mx-auto max-w-2xl px-4 pb-8 pt-5 sm:px-6"><header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Route className="size-5" /></div><div><p className="text-xs font-medium text-primary">ROAD MATE</p><h1 className="text-lg font-bold tracking-tight">전남 화물 운행 플래너</h1></div></div><ThemeButton theme={theme} onClick={toggleTheme} /></header>
    {lastTrip && lastTrip.destination !== plan.destination ? <button type="button" onClick={() => { setPlan((current) => ({ ...current, destination: lastTrip.destination })); setScreen("in-trip"); }} className="mt-5 flex w-full items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-left"><span><span className="block text-xs text-muted-foreground">이전 운행 복원</span><span className="mt-0.5 block text-sm font-semibold">{lastTrip.destination} · {lastTrip.departure} 출발</span></span><ChevronRight className="size-4 text-primary" /></button> : null}
    {recentDestinations.length > 0 ? <div className="mt-4"><p className="mb-2 text-xs font-medium text-muted-foreground">최근 목적지</p><div className="flex flex-wrap gap-2">{recentDestinations.map((destination) => <button key={destination} type="button" onClick={() => setPlan((current) => ({ ...current, destination }))} className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary">{destination}</button>)}</div></div> : null}
    <section className="mt-5 rounded-[2rem] border bg-card p-5 shadow-[0_20px_60px_-42px_hsl(var(--foreground)/0.45)]"><div className="mb-4 flex items-center gap-2"><MapPin className="size-4 text-primary" /><h2 className="font-semibold">오늘의 운행 계획</h2></div><div className="grid gap-4"><div className="grid gap-2"><Label htmlFor="origin">출발지</Label><Input id="origin" value={plan.origin} onChange={(event) => setPlan((current) => ({ ...current, origin: event.target.value }))} placeholder="예: 광양항 GWCT" /></div><div className="grid gap-2"><Label htmlFor="destination">목적지</Label><Input id="destination" value={plan.destination} onChange={(event) => setPlan((current) => ({ ...current, destination: event.target.value }))} placeholder="예: 여수국가산단" /></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="arrival">도착 시각</Label><Input id="arrival" type="time" value={plan.arrivalTime} onChange={(event) => setPlan((current) => ({ ...current, arrivalTime: event.target.value }))} /></div><div className="grid gap-2"><Label htmlFor="workload">업무 강도</Label><select id="workload" value={plan.workload} onChange={(event) => setPlan((current) => ({ ...current, workload: event.target.value as PlanInput["workload"] }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="busy">촉박함</option><option value="relaxed">여유 있음</option></select></div></div><div className="grid gap-2"><Label>차량 설정</Label><div className="grid grid-cols-3 gap-2">{(["two-axle", "three-axle", "special"] as VehiclePreset[]).map((preset) => <button key={preset} type="button" onClick={() => updatePreset(preset)} className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${plan.vehiclePreset === preset ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted"}`}>{preset === "two-axle" ? "2축" : preset === "three-axle" ? "3축" : "특수"}</button>)}</div></div><div className="grid grid-cols-3 gap-2"><MetricInput label="적재중량(t)" value={plan.vehicle.weightTons} onChange={(value) => setPlan((current) => ({ ...current, vehicle: { ...current.vehicle, weightTons: value } }))} /><MetricInput label="전고(m)" value={plan.vehicle.heightM} onChange={(value) => setPlan((current) => ({ ...current, vehicle: { ...current.vehicle, heightM: value } }))} /><MetricInput label="연비(km/L)" value={plan.vehicle.fuelEfficiencyKmPerL} onChange={(value) => setPlan((current) => ({ ...current, vehicle: { ...current.vehicle, fuelEfficiencyKmPerL: value } }))} /></div><div className="grid grid-cols-3 gap-2"><MetricInput label="전장(m)" value={plan.vehicle.lengthM} onChange={(value) => setPlan((current) => ({ ...current, vehicle: { ...current.vehicle, lengthM: value } }))} /><MetricInput label="전폭(m)" value={plan.vehicle.widthM} onChange={(value) => setPlan((current) => ({ ...current, vehicle: { ...current.vehicle, widthM: value } }))} /><MetricInput label="축중량(t)" value={plan.vehicle.axleLoadTons} onChange={(value) => setPlan((current) => ({ ...current, vehicle: { ...current.vehicle, axleLoadTons: value } }))} /></div><label className="flex items-center gap-2 rounded-xl bg-muted/55 px-3 py-2 text-xs"><input type="checkbox" checked={plan.vehicle.hazmat} onChange={(event) => setPlan((current) => ({ ...current, vehicle: { ...current.vehicle, hazmat: event.target.checked } }))} className="size-4 accent-primary" />위험물 적재 차량</label></div></section>
    <section className={`mt-5 rounded-[2rem] border p-5 ${statusStyle[summary.risk.status].card}`}>{loading ? <LoadingSkeleton /> : <><div className="flex items-start justify-between gap-4"><div><StatusBadge status={summary.risk.status} /><h2 className="mt-3 text-xl font-bold tracking-tight">{summary.risk.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{summary.risk.message}</p></div><CloudRain className="size-8 shrink-0 text-primary/70" /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-background/70 p-4 dark:bg-black/15"><p className="text-xs text-muted-foreground">추천 출발 시간대</p><p className="mt-1 text-lg font-bold">{summary.departureWindow.start} – {summary.departureWindow.end}</p></div><div className="rounded-2xl bg-background/70 p-4 dark:bg-black/15"><p className="text-xs text-muted-foreground">안전 여유시간</p><p className="mt-1 text-lg font-bold">{summary.safetySlackMinutes}분</p>{summary.portBufferMinutes > 0 ? <p className="mt-1 text-[11px] text-primary">광양항 패턴 +15분</p> : null}</div></div>{summary.fallbackMode || summaryQuery.isError || optionsQuery.isError ? <div className="mt-4 flex items-start gap-2 rounded-xl bg-background/70 p-3 text-xs leading-5 text-muted-foreground"><Radio className="mt-0.5 size-3.5 shrink-0" />실시간 근거가 불완전하여 안전 대체 후보를 표시합니다. 출발 전 현장 안내를 꼭 확인하세요.</div> : null}</>}</section>
    <section className="mt-5 rounded-[2rem] border bg-card p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">빠른 확인</p><h2 className="font-semibold">추천 후보 3개</h2></div><Button variant="ghost" size="sm" onClick={() => setScreen("compare")}>전체 비교<ChevronRight className="ml-1 size-4" /></Button></div><div className="mt-4 grid gap-2">{loading ? <div className="h-24 animate-pulse rounded-2xl bg-muted" /> : options.slice(0, 3).map((option) => <button key={option.id} type="button" onClick={() => { setSelectedId(option.id); setScreen("compare"); }} className="flex items-center justify-between rounded-2xl bg-muted/55 px-4 py-3 text-left transition-colors hover:bg-muted"><span><span className="block text-sm font-semibold">{option.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatDuration(option.durationMinutes)} · {formatCost(option.directCostKrw)}</span></span><span className="text-sm font-bold text-primary">{option.departure}</span></button>)}</div></section>
    <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">본 서비스의 예측값은 보조 정보입니다. 실제 교통 통제·표지·현장 안내가 항상 우선합니다.</p></section><EvidenceDrawer open={evidenceOpen} onOpenChange={setEvidenceOpen} summary={summary} /><NavigationDialog open={navOpen} onOpenChange={setNavOpen} destination={plan.destination} onOpenExternal={openExternalNavigation} onStart={() => { setNavOpen(false); setScreen("in-trip"); }} /></main>;
}

function ThemeButton({ theme, onClick }: { theme: "light" | "dark"; onClick?: () => void }) {
  return <Button variant="outline" size="icon" className="rounded-xl" onClick={onClick} aria-label="테마 전환">{theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}</Button>;
}

function MetricInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="grid gap-1"><Label className="text-[11px] text-muted-foreground">{label}</Label><Input type="number" min="0" step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value) || 0.1)} /></div>;
}

function EvidenceDrawer({ open, onOpenChange, summary }: { open: boolean; onOpenChange: (open: boolean) => void; summary: { sources: Array<{ provider: string; label: string; reliability: string; observedAt: string; detail: string; failureReason?: string }> } }) {
  return <Drawer open={open} onOpenChange={onOpenChange}><DrawerContent><div className="mx-auto w-full max-w-2xl px-4 pb-8"><DrawerHeader className="px-0 text-left"><DrawerTitle>추천 근거</DrawerTitle><DrawerDescription>데이터 수집 시각과 신뢰도를 함께 확인하세요.</DrawerDescription></DrawerHeader><div className="space-y-3">{summary.sources.length > 0 ? summary.sources.map((source) => <div key={`${source.provider}-${source.label}`} className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{source.label}</p><p className="mt-1 text-xs text-muted-foreground">{source.provider} · {new Date(source.observedAt).toLocaleString("ko-KR")}</p></div><Badge variant="outline" className={source.reliability === "sufficient" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : source.reliability === "partial" ? "border-amber-500/40 text-amber-700 dark:text-amber-300" : "border-slate-400 text-muted-foreground"}>{source.reliability === "sufficient" ? "충분" : source.reliability === "partial" ? "부분" : "부족"}</Badge></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{source.detail}</p>{source.failureReason ? <p className="mt-2 text-xs leading-5 text-rose-700 dark:text-rose-300">수집 실패 사유: {source.failureReason}</p> : null}</div>) : <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">수집 가능한 근거가 없습니다. 네트워크 연결과 공급자 상태를 확인하세요.</div>}</div></div></DrawerContent></Drawer>;
}

function NavigationDialog({ open, onOpenChange, destination, onOpenExternal, onStart }: { open: boolean; onOpenChange: (open: boolean) => void; destination: string; onOpenExternal: () => void; onStart: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-sm rounded-3xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Navigation className="size-5 text-primary" />내비 앱 연동</DialogTitle><DialogDescription>{destination}까지의 경로를 외부 내비에서 확인한 뒤 운행을 시작하세요.</DialogDescription></DialogHeader><div className="rounded-2xl bg-muted p-4 text-sm"><p className="font-medium">안전 안내</p><p className="mt-1 leading-6 text-muted-foreground">출발 전 실제 도로 통제와 현장 안내를 우선 확인하세요.</p></div><DialogFooter className="grid gap-2 sm:grid-cols-2"><Button variant="outline" className="rounded-xl" onClick={onOpenExternal}>외부 내비 열기</Button><Button className="rounded-xl" onClick={onStart}>운행 화면 시작</Button></DialogFooter></DialogContent></Dialog>;
}
