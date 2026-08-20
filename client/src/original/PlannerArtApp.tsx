import { useEffect, useState } from 'react'
import {
  AlternativeMiniCards,
  CautionBanner,
  CompareHeader,
  CompareStickyActionBar,
  CompareTopSummary,
  DashboardHeader,
  defaultSpecsFor,
  EvidenceMapPreview,
  InTripView,
  NaviLaunchModal,
  PlanSetupSheet,
  PrimaryRecommendationCard,
  RecommendedHero,
  RouteCompareMap,
  RouteOptionCardList,
  StickyActionBar,
  saveRecentDestination,
} from './components/PlannerArtComponents'
import { EvidencePanel } from './components/EvidencePanel'
import { LastTripBanner } from './components/LastTripBanner'
import { SkeletonHero, SkeletonCard, SkeletonAlternatives } from './components/SkeletonLoader'
import type { AppScreen, PlanInputs, RiskState, RiskStatus, RouteOption, VehiclePreset, VehicleSpecs } from './types'
import './PlannerArt.css'

const PLAN_STORAGE_KEY = 'jeonnam-planner-plan-inputs'
const LAST_TRIP_KEY = 'roadmate-last-trip'

const defaultPlan: PlanInputs = {
  origin: '광양항 GWCT',
  originCoordinates: [127.7188, 34.8806],
  destination: '여수국가산단',
  destinationCoordinates: [127.7161, 34.789],
  arrivalTime: '15:30',
  workload: 'busy',
  vehiclePreset: 'three-axle',
  vehicleSpecs: defaultSpecsFor('three-axle'),
}

const fallbackRisk: Record<RiskStatus, RiskState> = {
  normal: { status: 'normal', observedAt: '오늘 13:02' },
  caution: { status: 'caution', weatherReason: '강풍 주의 구간이 있습니다', vmsReason: 'VMS 안내 표출: 노면 상태를 확인하세요.', observedAt: '오늘 13:02' },
  high: { status: 'high', weatherReason: '강풍 특보로 출발 보류 권장', vmsReason: 'VMS 안내 표출이 있습니다.', observedAt: '오늘 13:02' },
  insufficient: { status: 'insufficient', observedAt: '오늘 12:10' },
}

const asRiskStatus = (value: unknown): RiskStatus =>
  value === 'normal' || value === 'caution' || value === 'high' || value === 'insufficient' ? value : 'insufficient'

const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
const formatCost = (amount: number) => `${amount.toLocaleString('ko-KR')}원`
const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : 15 * 60 + 30
}
const formatTime = (value: number) => {
  const normalized = ((value % 1_440) + 1_440) % 1_440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}
const priorityRouteId = (plan: PlanInputs): RouteOption['id'] => plan.workload === 'busy' ? 'time' : 'cost'
const safetyBufferMinutes = (plan: PlanInputs) => {
  const isPort = plan.destination.includes('광양항') || plan.destination.includes('GWCT') || plan.destination.includes('KIT') || plan.destination.includes('터미널')
  const baseBuffer = plan.workload === 'busy' ? 24 : 36
  return baseBuffer + (isPort ? 15 : 0)
}
const departureFor = (plan: PlanInputs, durationMinutes: number) => formatTime(timeToMinutes(plan.arrivalTime) - durationMinutes - safetyBufferMinutes(plan))
const createFallbackOptions = (plan: PlanInputs): RouteOption[] => [
  { id: 'base', title: '기본 추천', shortTitle: '기본 추천', departure: departureFor(plan, 124), duration: '2시간 04분', cost: '27,800원', delta: '균형 선택', reason: '시간과 직접비를 균형 있게 반영', statusText: '주의' },
  { id: 'time', title: '시간 우선', shortTitle: '시간 우선', departure: departureFor(plan, 112), duration: '1시간 52분', cost: '31,200원', delta: '12분 빠름', reason: '기본 추천 대비', statusText: '주의' },
  { id: 'cost', title: '비용 우선', shortTitle: '비용 우선', departure: departureFor(plan, 133), duration: '2시간 13분', cost: '23,600원', delta: '4,200원 절감', reason: '기본 추천 대비', statusText: '확인' },
]

const coordinatesFrom = (value: unknown): [number, number] | undefined =>
  Array.isArray(value) && value.length === 2 && value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    ? [value[0], value[1]]
    : undefined

const loadStoredPlan = (): PlanInputs => {
  if (typeof window === 'undefined') return defaultPlan

  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAN_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const storedOrigin = typeof stored.origin === 'string' && stored.origin.trim() ? stored.origin : undefined
    const storedDestination = typeof stored.destination === 'string' && stored.destination.trim() ? stored.destination : undefined
    const preset = (stored.vehiclePreset === 'two-axle' || stored.vehiclePreset === 'special' ? stored.vehiclePreset : 'three-axle') as VehiclePreset
    const specs = stored.vehicleSpecs && typeof stored.vehicleSpecs === 'object' ? (stored.vehicleSpecs as VehicleSpecs) : defaultSpecsFor(preset)

    return {
      origin: storedOrigin ?? defaultPlan.origin,
      originCoordinates: coordinatesFrom(stored.originCoordinates) ?? (storedOrigin ? undefined : defaultPlan.originCoordinates),
      destination: storedDestination ?? defaultPlan.destination,
      destinationCoordinates: coordinatesFrom(stored.destinationCoordinates) ?? (storedDestination ? undefined : defaultPlan.destinationCoordinates),
      arrivalTime: typeof stored.arrivalTime === 'string' && /^\d{2}:\d{2}$/.test(stored.arrivalTime) ? stored.arrivalTime : defaultPlan.arrivalTime,
      workload: stored.workload === 'relaxed' ? 'relaxed' : 'busy',
      vehiclePreset: preset,
      vehicleSpecs: specs,
    }
  } catch {
    return defaultPlan
  }
}

export default function PlannerArtApp() {
  const [screen, setScreen] = useState<AppScreen>('dashboard')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [plan, setPlan] = useState<PlanInputs>(loadStoredPlan)
  const [selectedId, setSelectedId] = useState<RouteOption['id']>(priorityRouteId(plan))
  const [isPlanEditorOpen, setPlanEditorOpen] = useState(false)
  const [isNaviModalOpen, setIsNaviModalOpen] = useState(false)
  const [hasProceededHighRisk, setHasProceededHighRisk] = useState(false)
  const [riskStatus, setRiskStatus] = useState<RiskStatus>('caution')
  const [options, setOptions] = useState<RouteOption[]>(() => createFallbackOptions(plan))
  const [isLoading, setIsLoading] = useState(false)        // P1-E: 스켈레톤 로딩
  const [isEvidencePanelOpen, setEvidencePanelOpen] = useState(false)  // P1-B: 근거 패널
  const [lastTripBanner, setLastTripBanner] = useState<{ destination: string; departure: string } | null>(() => { // P1-C: 이전 계획 배너
    try {
      const stored = JSON.parse(window.localStorage.getItem(LAST_TRIP_KEY) ?? 'null') as { destination: string; departure: string } | null
      return stored
    } catch { return null }
  })

  const isLight = theme === 'light'
  const risk = fallbackRisk[riskStatus]
  const isPortPattern = plan.destination.includes('광양항') || plan.destination.includes('GWCT') || plan.destination.includes('KIT') || plan.destination.includes('터미널')

  const primaryOption = options.find((item) => item.id === (riskStatus === 'high' && !hasProceededHighRisk ? 'time' : selectedId)) ?? options[0]
  const selectedOption = options.find((item) => item.id === selectedId) ?? primaryOption
  const departureWindow = `${primaryOption.departure} ~ ${formatTime(timeToMinutes(primaryOption.departure) + 20)}`
  const arrivalSlack = plan.workload === 'busy' ? (isPortPattern ? '39분 (항만패턴+15분)' : '24분') : (isPortPattern ? '51분 (항만패턴+15분)' : '36분')

  useEffect(() => {
    try {
      window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    } catch {
      // Local storage unavailable
    }
  }, [plan])

  useEffect(() => {
    let active = true
    const fallbackOptions = createFallbackOptions(plan)
    const origin = plan.originCoordinates?.join(',')
    const destination = plan.destinationCoordinates?.join(',')

    setOptions(fallbackOptions)
    setSelectedId(priorityRouteId(plan))
    setHasProceededHighRisk(false)
    setIsLoading(true) // P1-E: 로딩 시작

    const loadPlan = async () => {
      try {
        const specs = plan.vehicleSpecs ?? defaultSpecsFor(plan.vehiclePreset)
        const params = new URLSearchParams({
          live: 'true',
          destinationName: plan.destination,
          arrivalTime: plan.arrivalTime,
          workload: plan.workload,
          vehiclePreset: plan.vehiclePreset,
          height: String(specs.height),
          weight: String(specs.weight),
          length: String(specs.length),
          width: String(specs.width),
          axleload: String(specs.axleload),
          fuelEfficiency: String(specs.fuelEfficiency),
          hazmat: String(specs.hazmat),
        })
        if (origin) params.set('origin', origin)
        if (destination) params.set('destination', destination)

        const query = params.toString()
        const [summaryResponse, optionsResponse] = await Promise.all([
          fetch(`/api/plan/summary?${query}`),
          fetch(`/api/plan/options?${query}`),
        ])
        if (!summaryResponse.ok || !optionsResponse.ok) return
        const summary = await summaryResponse.json() as { risk?: { state?: unknown; weatherReason?: string; vmsReason?: string } }
        const optionResult = await optionsResponse.json() as {
          options?: Array<{
            id: string
            routeKind?: string
            kind: string
            label: string
            title?: string
            shortTitle?: string
            departure?: string
            duration?: string
            durationMinutes: number
            distanceKm?: number
            cost?: string
            directCost?: { amountKrw: number | null; reliability: string; note: string }
            delta?: string
            reason?: string
            statusText?: string
            portPatternApplied?: boolean
            geometryCoordinates?: [number, number][]
          }>
        }
        if (!active || !optionResult.options) return
        const kindMap: Record<string, RouteOption['id']> = { balanced: 'base', fastest: 'time', 'lowest-cost': 'cost' }
        const mapped: RouteOption[] = optionResult.options.map((option, idx) => {
          const id = (option.routeKind as RouteOption['id']) ?? (kindMap[option.kind] ?? (idx === 0 ? 'base' : idx === 1 ? 'time' : 'cost'))
          const fallback = fallbackOptions.find((item) => item.id === id) ?? fallbackOptions[0]
          return {
            ...fallback,
            id,
            title: option.title ?? option.label ?? fallback.title,
            shortTitle: option.shortTitle ?? fallback.shortTitle,
            departure: option.departure ?? departureFor(plan, option.durationMinutes),
            duration: option.duration ?? formatDuration(option.durationMinutes),
            durationMinutes: option.durationMinutes,
            distanceKm: option.distanceKm,
            cost: option.cost ?? (option.directCost?.amountKrw != null ? formatCost(option.directCost.amountKrw) : '확인 필요'),
            directCost: option.directCost,
            delta: option.delta ?? fallback.delta,
            reason: option.reason ?? fallback.reason,
            statusText: option.statusText ?? fallback.statusText,
            portPatternApplied: option.portPatternApplied ?? isPortPattern,
            geometryCoordinates: option.geometryCoordinates,
          }
        })
        if (mapped.length > 0) {
          setOptions(mapped)
          const newStatus = asRiskStatus(summary.risk?.state)
          setRiskStatus(newStatus)
        }
      } catch {
        // Mock stays functional if API fails
      } finally {
        if (active) setIsLoading(false) // P1-E: 로딩 완료
      }
    }

    void loadPlan()
    return () => { active = false }
  }, [plan])

  const switchTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light')
  const applyPlan = (nextPlan: PlanInputs) => {
    // P1-A: 최근 목적지 저장
    if (nextPlan.destinationCoordinates) {
      saveRecentDestination(nextPlan.destination, nextPlan.destinationCoordinates)
    }
    setPlan(nextPlan)
    setScreen('dashboard')
    setPlanEditorOpen(false)
  }

  // P1-C: 내비 시작 시 lastTrip 저장
  const handleStartTrip = () => {
    try {
      const tripData = { destination: plan.destination, departure: primaryOption.departure }
      window.localStorage.setItem(LAST_TRIP_KEY, JSON.stringify(tripData))
    } catch { /* storage unavailable */ }
    setIsNaviModalOpen(true)
  }

  const alternativeOption = options.find((option) => option.id !== primaryOption.id)

  if (screen === 'in-trip') {
    return (
      <main className="planner-art" data-theme={theme}>
        <section className="art-viewport" aria-label="운행 중 재확인 화면">
          <InTripView
            plan={plan}
            option={selectedOption}
            risk={risk}
            onBackToPlan={() => setScreen('dashboard')}
            onOpenNavi={() => setIsNaviModalOpen(true)}
          />
          <NaviLaunchModal
            isOpen={isNaviModalOpen}
            destination={plan.destination}
            coordinates={plan.destinationCoordinates}
            onClose={() => setIsNaviModalOpen(false)}
            onStartInTrip={() => {
              setIsNaviModalOpen(false)
              setScreen('in-trip')
            }}
          />
        </section>
      </main>
    )
  }

  return (
    <main className="planner-art" data-theme={theme}>
      <section className="art-viewport" aria-label="전남 화물 운행 플래너 시연">
        {screen === 'dashboard' ? (
          <>
            <DashboardHeader plan={plan} onOpenPlan={() => setPlanEditorOpen(true)} onToggleTheme={switchTheme} isLight={isLight} />
            {lastTripBanner && lastTripBanner.destination !== plan.destination && (
              <LastTripBanner
                destination={lastTripBanner.destination}
                departure={lastTripBanner.departure}
                onRestore={() => { setLastTripBanner(null); setScreen('in-trip') }}
                onDismiss={() => setLastTripBanner(null)}
              />
            )}
            <div className="art-scroll">
              <CautionBanner risk={risk} />
              {isLoading ? (
                <>
                  <SkeletonHero />
                  <SkeletonCard />
                  <SkeletonAlternatives />
                </>
              ) : (
                <>
                  <RecommendedHero
                    risk={risk}
                    onCompare={() => setScreen('compare')}
                    onProceedAnyway={() => setHasProceededHighRisk(true)}
                    departureWindow={departureWindow}
                    arrivalSlack={arrivalSlack}
                    isPortPattern={isPortPattern}
                    hasProceededHighRisk={hasProceededHighRisk}
                  />
                  {(risk.status !== 'high' || hasProceededHighRisk) && (
                    <PrimaryRecommendationCard
                      option={primaryOption}
                      risk={risk}
                      onStartTrip={handleStartTrip}
                      onShowEvidence={() => setEvidencePanelOpen(true)}
                    />
                  )}
                  {(risk.status !== 'high' || hasProceededHighRisk) && (
                    <AlternativeMiniCards
                      options={options.filter((option) => option.id !== primaryOption.id)}
                      onSelect={(id) => { setSelectedId(id); setScreen('compare') }}
                    />
                  )}
                </>
              )}
              <EvidenceMapPreview
                risk={risk}
                origin={plan.origin}
                destination={plan.destination}
                selectedOption={primaryOption}
                alternativeOption={alternativeOption}
              />
            </div>
            <StickyActionBar onClick={() => setScreen('compare')} label="후보 경로 비교하기" />
          </>
        ) : (
          <>
            <CompareHeader plan={plan} onBack={() => setScreen('dashboard')} onToggleTheme={switchTheme} isLight={isLight} />
            <div className="art-scroll art-scroll--compare">
              <CompareTopSummary departureWindow={departureWindow} arrivalSlack={arrivalSlack} />
              <RouteOptionCardList options={options} selectedId={selectedId} onSelect={setSelectedId} risk={risk} />
              <RouteCompareMap
                selectedId={selectedId}
                origin={plan.origin}
                destination={plan.destination}
                selectedOption={selectedOption}
                alternativeOption={options.find((option) => option.id !== selectedOption.id)}
              />
              <p className="art-disclaimer">실제 표지·통제기관 안내 우선</p>
            </div>
            <CompareStickyActionBar
              option={selectedOption}
              onStartTrip={() => setIsNaviModalOpen(true)}
              onDashboard={() => setScreen('dashboard')}
            />
          </>
        )}
        {isPlanEditorOpen && <PlanSetupSheet plan={plan} onClose={() => setPlanEditorOpen(false)} onSave={applyPlan} />}
        <EvidencePanel
          isOpen={isEvidencePanelOpen}
          onClose={() => setEvidencePanelOpen(false)}
          option={primaryOption}
          risk={risk}
        />
        <NaviLaunchModal
          isOpen={isNaviModalOpen}
          destination={plan.destination}
          coordinates={plan.destinationCoordinates}
          onClose={() => setIsNaviModalOpen(false)}
          onStartInTrip={() => {
            setIsNaviModalOpen(false)
            setScreen('in-trip')
          }}
        />
      </section>
    </main>
  )
}
