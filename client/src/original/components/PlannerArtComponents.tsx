import {
  AlertTriangle,
  Anchor,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  CloudLightning,
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  MapPinned,
  Moon,
  Navigation,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Star,
  Sun,
  Truck,
  TriangleAlert,
  Wallet,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PlanInputs, RiskState, RouteOption, VehiclePreset, VehicleSpecs, Workload } from '../types'
import { RouteMap } from './RouteMap'

const vehiclePresets: Array<{ id: VehiclePreset; label: string; detail: string }> = [
  { id: 'two-axle', label: '2축 대형', detail: '기본 화물' },
  { id: 'three-axle', label: '3축 대형', detail: '중량 화물' },
  { id: 'special', label: '4축 이상/특수', detail: '특수 화물' },
]

export const defaultSpecsFor = (preset: VehiclePreset): VehicleSpecs => {
  switch (preset) {
    case 'two-axle':
      return { length: 12.0, width: 2.5, height: 3.8, weight: 25.0, axleload: 10.0, fuelEfficiency: 3.8, hazmat: false }
    case 'special':
      return { length: 19.0, width: 2.5, height: 4.2, weight: 44.0, axleload: 11.0, fuelEfficiency: 2.6, hazmat: false }
    case 'three-axle':
    default:
      return { length: 16.7, width: 2.5, height: 4.0, weight: 40.0, axleload: 10.0, fuelEfficiency: 3.2, hazmat: false }
  }
}

const quickDestinations: Array<{ label: string; coordinates: [number, number]; group?: string }> = [
  // 광양항 터미널
  { label: '광양항 GWCT', coordinates: [127.7188, 34.8806], group: '광양항' },
  { label: '광양항 KIT', coordinates: [127.7231, 34.8841], group: '광양항' },
  // 산업단지
  { label: '여수국가산단', coordinates: [127.7161, 34.789], group: '산단' },
  { label: '율촌 1산단', coordinates: [127.6492, 34.8463], group: '산단' },
  { label: '광양제철소', coordinates: [127.7542, 34.8951], group: '산단' },
  // 물류/교통
  { label: '순천 IC', coordinates: [127.487, 34.945], group: '교통' },
  { label: '광양 IC', coordinates: [127.703, 34.921], group: '교통' },
]

// P1-C: 최근 목적지 로컬 저장소 (max 5)
const RECENT_DEST_KEY = 'roadmate-recent-destinations'

export const getRecentDestinations = (): Array<{ label: string; coordinates: [number, number] }> => {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_DEST_KEY) ?? '[]') as Array<{ label: string; coordinates: [number, number] }>
  } catch { return [] }
}

export const saveRecentDestination = (label: string, coordinates: [number, number]) => {
  try {
    const current = getRecentDestinations()
    const filtered = current.filter((d) => d.label !== label)
    const updated = [{ label, coordinates }, ...filtered].slice(0, 5)
    window.localStorage.setItem(RECENT_DEST_KEY, JSON.stringify(updated))
  } catch { /* storage unavailable */ }
}

const vehicleLabel = (preset: VehiclePreset) => vehiclePresets.find((option) => option.id === preset)?.label ?? '3축 대형'
const workloadLabel = (workload: Workload) => workload === 'busy' ? '바쁨' : '여유'

const isPastTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return true
  const now = new Date()
  return hours * 60 + minutes < now.getHours() * 60 + now.getMinutes()
}

export function DashboardHeader({
  plan,
  onOpenPlan,
  onToggleTheme,
  isLight,
}: {
  plan: PlanInputs
  onOpenPlan: () => void
  onToggleTheme: () => void
  isLight: boolean
}) {
  return (
    <header className="art-header">
      <div className="art-title-row">
        <div className="art-title">
            <Truck aria-hidden="true" />
            <div className="art-brand">
              <h1>로드메이트</h1>
              <span className="art-brand__sub">전남 화물 운행 플래너</span>
            </div>
          </div>
        <div className="header-actions">
          <button className="header-icon" type="button" onClick={onToggleTheme} aria-label={isLight ? '다크 테마로 전환' : '라이트 테마로 전환'}>
            {isLight ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
          <button className="header-icon" type="button" aria-label="알림 보기"><Bell aria-hidden="true" /><i aria-hidden="true" /></button>
        </div>
      </div>
      <button className="art-trip" type="button" onClick={onOpenPlan} aria-label="운행 조건 수정">
        <span className="art-trip__route"><span>{plan.origin} <b aria-hidden="true">→</b> {plan.destination}</span><small>{vehicleLabel(plan.vehiclePreset)} · 오늘 {workloadLabel(plan.workload)}</small></span>
        <span className="art-arrival"><small>도착 희망</small><strong>{plan.arrivalTime}</strong></span>
      </button>
    </header>
  )
}

export function PlanSetupSheet({ plan, onClose, onSave }: { plan: PlanInputs; onClose: () => void; onSave: (plan: PlanInputs) => void }) {
  const [draft, setDraft] = useState(plan)
  const [specs, setSpecs] = useState<VehicleSpecs>(() => plan.vehicleSpecs ?? defaultSpecsFor(plan.vehiclePreset))
  const [showSpecs, setShowSpecs] = useState(false)
  const [timeError, setTimeError] = useState('')
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    setDraft(plan)
    setSpecs(plan.vehicleSpecs ?? defaultSpecsFor(plan.vehiclePreset))
    setTimeError('')
    setLocationError('')
  }, [plan])

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('이 기기에서는 위치를 가져올 수 없습니다. 출발지를 직접 입력해 주세요.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setDraft((current) => ({ ...current, origin: '현재 위치', originCoordinates: [coords.longitude, coords.latitude] }))
        setLocationError('')
      },
      () => setLocationError('위치 권한 없이도 출발지를 직접 입력해 계획할 수 있습니다.'),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    )
  }

  const handlePresetSelect = (preset: VehiclePreset) => {
    setDraft((current) => ({ ...current, vehiclePreset: preset }))
    setSpecs(defaultSpecsFor(preset))
  }

  const submitPlan = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isPastTime(draft.arrivalTime)) {
      setTimeError('현재 시각 이후의 도착 희망 시각을 선택해 주세요.')
      return
    }
    onSave({
      ...draft,
      origin: draft.origin.trim(),
      destination: draft.destination.trim(),
      vehicleSpecs: specs,
    })
  }

  return (
    <div className="plan-sheet-backdrop">
      <form className="plan-sheet" onSubmit={submitPlan} aria-label="운행 조건 수정">
        <header className="plan-sheet__header">
          <div><p>운행 조건</p><h2>출발 전 계획</h2></div>
          <button className="plan-close" type="button" onClick={onClose} aria-label="운행 조건 닫기"><X aria-hidden="true" /></button>
        </header>
        <div className="plan-sheet__body">
          <label className="plan-field">
            <span><MapPin aria-hidden="true" /> 출발지</span>
            <input value={draft.origin} onChange={(event) => setDraft((current) => ({ ...current, origin: event.target.value, originCoordinates: undefined }))} list="origin-options" required />
          </label>
          <datalist id="origin-options">{quickDestinations.map((option) => <option key={option.label} value={option.label} />)}</datalist>
          <button className="plan-location-button" type="button" onClick={useCurrentLocation}><LocateFixed aria-hidden="true" /> 현재 위치 사용</button>
          {locationError && <p className="plan-field-error" role="alert">{locationError}</p>}

          <label className="plan-field">
            <span><Navigation aria-hidden="true" /> 도착지</span>
            <input value={draft.destination} onChange={(event) => setDraft((current) => ({ ...current, destination: event.target.value, destinationCoordinates: undefined }))} list="destination-options" required />
          </label>
          <datalist id="destination-options">
              {quickDestinations.map((option) => <option key={option.label} value={option.label} />)}
              {getRecentDestinations().map((option) => <option key={option.label} value={option.label} />)}
            </datalist>
          {/* P1-C: 최근 목적지 */}
          {getRecentDestinations().length > 0 && (
            <div className="plan-recent-destinations" aria-label="최근 목적지">
              <span className="plan-recent-label">최근 목적지</span>
              {getRecentDestinations().map((option) => (
                <button key={option.label} type="button" className="plan-recent-btn" onClick={() => setDraft((current) => ({ ...current, destination: option.label, destinationCoordinates: option.coordinates }))}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {/* P1-A: 빠른 선택 — 광양항·산단·교통 */}
          <div className="plan-quick-destinations" aria-label="빠른 도착지 선택">
            <span className="plan-quick-label">⚓ 광양항</span>
            {quickDestinations.filter(o => o.group === '광양항').map((option) => (
              <button key={option.label} type="button" onClick={() => setDraft((current) => ({ ...current, destination: option.label, destinationCoordinates: option.coordinates }))}>{option.label}</button>
            ))}
            <span className="plan-quick-label">🏭 산단</span>
            {quickDestinations.filter(o => o.group === '산단').map((option) => (
              <button key={option.label} type="button" onClick={() => setDraft((current) => ({ ...current, destination: option.label, destinationCoordinates: option.coordinates }))}>{option.label}</button>
            ))}
          </div>

          <label className="plan-field plan-field--time">
            <span><Clock3 aria-hidden="true" /> 도착 희망 시각</span>
            <input type="time" value={draft.arrivalTime} onChange={(event) => { setDraft((current) => ({ ...current, arrivalTime: event.target.value })); setTimeError('') }} required />
          </label>
          {timeError && <p className="plan-field-error" role="alert">{timeError}</p>}

          <section className="plan-choice-section" aria-labelledby="workload-title">
            <span id="workload-title">오늘 업무량</span>
            <div className="plan-choice-grid">
              {(['busy', 'relaxed'] as Workload[]).map((workload) => <button key={workload} className={draft.workload === workload ? 'is-selected' : ''} type="button" aria-pressed={draft.workload === workload} onClick={() => setDraft((current) => ({ ...current, workload }))}><strong>{workloadLabel(workload)}</strong><small>{workload === 'busy' ? '시간 우선' : '비용 우선'}</small></button>)}
            </div>
          </section>

          <section className="plan-choice-section" aria-labelledby="vehicle-title">
            <span id="vehicle-title"><Truck aria-hidden="true" /> 내 차량</span>
            <div className="plan-vehicle-grid">
              {vehiclePresets.map((preset) => <button key={preset.id} className={draft.vehiclePreset === preset.id ? 'is-selected' : ''} type="button" aria-pressed={draft.vehiclePreset === preset.id} onClick={() => handlePresetSelect(preset.id)}><strong>{preset.label}</strong><small>{preset.detail}</small></button>)}
            </div>
          </section>

          <section className="plan-specs-section">
            <button type="button" className="plan-specs-toggle" onClick={() => setShowSpecs((prev) => !prev)}>
              <Sliders aria-hidden="true" />
              <span>차량 상세 제원 직접 수정 (높이·중량·연비)</span>
              {showSpecs ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </button>
            {showSpecs && (
              <div className="plan-specs-grid">
                <label className="plan-spec-field">
                  <span>차량 높이 (m)</span>
                  <input type="number" step="0.1" min="2.0" max="4.8" value={specs.height} onChange={(e) => setSpecs({ ...specs, height: Number(e.target.value) })} />
                </label>
                <label className="plan-spec-field">
                  <span>총중량 (톤)</span>
                  <input type="number" step="1" min="5" max="60" value={specs.weight} onChange={(e) => setSpecs({ ...specs, weight: Number(e.target.value) })} />
                </label>
                <label className="plan-spec-field">
                  <span>축중 (톤)</span>
                  <input type="number" step="0.5" min="5" max="15" value={specs.axleload} onChange={(e) => setSpecs({ ...specs, axleload: Number(e.target.value) })} />
                </label>
                <label className="plan-spec-field">
                  <span>평균 연비 (km/L)</span>
                  <input type="number" step="0.1" min="1.0" max="8.0" value={specs.fuelEfficiency} onChange={(e) => setSpecs({ ...specs, fuelEfficiency: Number(e.target.value) })} />
                </label>
                <label className="plan-spec-field plan-spec-field--full">
                  <input type="checkbox" checked={specs.hazmat} onChange={(e) => setSpecs({ ...specs, hazmat: e.target.checked })} />
                  <span>위험물 / 유해물질 운송 차량</span>
                </label>
              </div>
            )}
          </section>
        </div>
        <footer className="plan-sheet__footer"><button type="submit">조건 적용하고 경로 보기</button></footer>
      </form>
    </div>
  )
}

export function RecommendedHero({
  risk,
  onCompare,
  onProceedAnyway,
  departureWindow,
  arrivalSlack,
  isPortPattern,
  hasProceededHighRisk,
}: {
  risk: RiskState
  onCompare: () => void
  onProceedAnyway?: () => void
  departureWindow: string
  arrivalSlack: string
  isPortPattern?: boolean
  hasProceededHighRisk?: boolean
}) {
  const highRisk = risk.status === 'high' && !hasProceededHighRisk
  const insufficient = risk.status === 'insufficient'

  return (
    <section className={`art-hero art-hero--${highRisk ? 'high' : risk.status}`} aria-labelledby="departure-window-title">
      <div className="art-hero__label">
        <Clock3 aria-hidden="true" />
        <span id="departure-window-title">{highRisk ? '기상 특보 감지' : '권장 출발 범위'}</span>
        {isPortPattern && <span className="art-hero-port-badge"><Anchor aria-hidden="true" /> 광양항 패턴 (+15분)</span>}
      </div>
      <h2>{highRisk ? '출발 보류 권장' : insufficient ? '근거 확인 필요' : departureWindow}</h2>
      
      {highRisk ? (
        <div className="art-hero__high-actions">
          <button className="art-hero__command art-hero__command--warning" type="button" onClick={onCompare}>우회 경로 보기</button>
          {onProceedAnyway && (
            <button className="art-hero__btn-secondary" type="button" onClick={onProceedAnyway}>위험 확인 후 계속 계획</button>
          )}
        </div>
      ) : (
        <button className="art-hero__command" type="button" onClick={onCompare}>출발 권장</button>
      )}

      <div className="art-hero__arrival">
        <CircleCheck aria-hidden="true" />
        <span>{highRisk ? risk.weatherReason : '도착 여유 '} {!highRisk && <strong>{arrivalSlack}</strong>}</span>
      </div>
      <p className="art-hero__evidence">
        <ShieldCheck aria-hidden="true" /> {insufficient ? '최신 기상·고속도로 안내 확인 필요' : isPortPattern ? '고속도로·기상 실황 및 항만 체류 패턴 반영' : '고속도로 · 기상 근거 반영'}
      </p>
    </section>
  )
}

export function PrimaryRecommendationCard({ option, risk, onStartTrip, onShowEvidence }: { option: RouteOption; risk: RiskState; onStartTrip?: () => void; onShowEvidence?: () => void }) {
  const label = option.id === 'base' ? '기본 추천' : `${option.title} 추천`
  const footer = option.id === 'time' ? '오늘 업무량 기준 · 시간 우선' : option.id === 'cost' ? '오늘 업무량 기준 · 비용 우선' : '납기 여유 · 비용 균형'

  return (
    <article className="art-primary-card">
      <div className="art-recommendation-tag-row">
        <div className="art-recommendation-tag"><Star fill="currentColor" aria-hidden="true" /> {label}</div>
        {option.portPatternApplied && <span className="art-card-port-tag"><Anchor aria-hidden="true" /> 항만 패턴 반영</span>}
      </div>
      <h2>{option.departure} 출발</h2>
      <div className="art-route-stats">
        <RouteStat icon={<Clock3 />} label="예상 소요 시간" value={option.duration} />
        <RouteStat icon={<Wallet />} label="예상 직접비" value={option.cost} />
        <RiskStat risk={risk} />
      </div>
      {onStartTrip && (
        <div className="art-card-action">
          <button type="button" className="art-start-trip-btn" onClick={onStartTrip}>
            <Play aria-hidden="true" /> 외부 내비로 운행 시작
          </button>
        </div>
      )}
      <footer>
        <ShieldCheck aria-hidden="true" /> {footer}
        {onShowEvidence && (
          <button type="button" className="art-evidence-btn" onClick={onShowEvidence}>왜 이 추천인가? →</button>
        )}
      </footer>
    </article>
  )
}

export function AlternativeMiniCards({ options, onSelect }: { options: RouteOption[]; onSelect: (id: RouteOption['id']) => void }) {
  return (
    <div className="art-alternative-grid">
      {options.map((option) => {
        const isTime = option.id === 'time'
        return (
          <button className="art-alternative-card" key={option.id} type="button" onClick={() => onSelect(option.id)}>
            <div className="art-alternative-card__top">{isTime ? <Clock3 aria-hidden="true" /> : <CircleDollarSign aria-hidden="true" />}<span>{option.title}</span></div>
            <strong>{option.delta}</strong>
            <small>{isTime ? `소요 시간 ${option.duration}` : `예상 직접비 ${option.cost}`}</small>
            <span className="art-alternative-card__arrow" aria-hidden="true">›</span>
          </button>
        )
      })}
    </div>
  )
}

export function EvidenceMapPreview({
  risk,
  origin,
  destination,
  selectedOption,
  alternativeOption,
}: {
  risk: RiskState
  origin: string
  destination: string
  selectedOption?: RouteOption
  alternativeOption?: RouteOption
}) {
  return (
    <section className="art-map" aria-labelledby="evidence-map-title">
      <div className="art-map__canvas" role="img" aria-label={`${origin}에서 ${destination}까지의 추천 경로와 강풍 주의, VMS 안내 표출 위치`}>
        <RouteMap
          routeId={selectedOption?.id ?? 'base'}
          coordinates={selectedOption?.geometryCoordinates}
          alternativeCoordinates={alternativeOption?.geometryCoordinates}
        />
        <div className="map-title" id="evidence-map-title"><MapPinned aria-hidden="true" /> 추천 근거 지도</div>
        <span className="map-time">{risk.observedAt ? `기상 · VMS 기준 ${risk.observedAt}` : '기상 · VMS 실시간 반영'}</span>
        {risk.status !== 'normal' && <span className="map-alert"><Wind aria-hidden="true" /> {risk.status === 'high' ? '강풍/호우 특보' : '기상 주의'}</span>}
        <span className="map-vms"><Bell aria-hidden="true" /> VMS 안내 표출</span>
        <span className="map-origin">{origin} <i aria-hidden="true" /></span>
        <span className="map-destination">{destination} <LocateFixed aria-hidden="true" /></span>
      </div>
    </section>
  )
}

export function StickyActionBar({ onClick, label = '경로 상세 보기' }: { onClick: () => void; label?: string }) {
  return <div className="art-sticky-action"><button type="button" onClick={onClick}>{label} <span aria-hidden="true">›</span></button></div>
}

export function CompareHeader({ plan, onBack, onToggleTheme, isLight }: { plan: PlanInputs; onBack: () => void; onToggleTheme: () => void; isLight: boolean }) {
  return (
    <header className="art-compare-header">
      <button className="art-back" type="button" onClick={onBack} aria-label="운행 계획으로 돌아가기"><ArrowLeft aria-hidden="true" /></button>
      <div><h1>후보 경로 비교</h1><p>{plan.origin} <b aria-hidden="true">→</b> {plan.destination} · 도착 <strong>{plan.arrivalTime}</strong></p></div>
      <button className="header-icon art-compare-theme" type="button" onClick={onToggleTheme} aria-label={isLight ? '다크 테마로 전환' : '라이트 테마로 전환'}>{isLight ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}</button>
    </header>
  )
}

export function CompareTopSummary({ departureWindow, arrivalSlack }: { departureWindow: string; arrivalSlack: string }) {
  return (
    <section className="art-compare-summary art-compare-summary--enhanced">
      <div><Clock3 aria-hidden="true" /><span>권장 출발<strong>{departureWindow}</strong></span></div>
      <div><CircleCheck aria-hidden="true" /><span>도착 여유<strong>{arrivalSlack}</strong></span></div>
    </section>
  )
}

export function RouteOptionCardList({ options, selectedId, onSelect, risk }: { options: RouteOption[]; selectedId: RouteOption['id']; onSelect: (id: RouteOption['id']) => void; risk: RiskState }) {
  return <section className="art-option-list" aria-label="후보 경로 목록">{options.map((option) => <RouteOptionCard key={option.id} option={option} selected={option.id === selectedId} onSelect={onSelect} risk={risk} />)}</section>
}

export function RouteOptionCard({ option, selected, onSelect, risk }: { option: RouteOption; selected: boolean; onSelect: (id: RouteOption['id']) => void; risk: RiskState }) {
  const icon = option.id === 'base' ? <Star fill="currentColor" /> : option.id === 'time' ? <Clock3 /> : <CircleDollarSign />
  const footer = option.id === 'base' ? '납기 여유 · 비용 균형' : option.id === 'time' ? '시간을 가장 우선' : '비용을 가장 우선'
  return (
    <button className={`art-option-card ${selected ? 'is-selected' : ''}`} type="button" onClick={() => onSelect(option.id)} aria-pressed={selected}>
      <div className="art-option-card__topline">
        <div className="art-recommendation-tag-row">
          <span className="art-option-tag">{icon} {option.title}</span>
          {option.portPatternApplied && <span className="art-card-port-tag"><Anchor aria-hidden="true" /> 항만 패턴</span>}
        </div>
        <span className="art-option-card__select-state"><i aria-hidden="true" />{selected ? '현재 선택' : '후보'}</span>
      </div>
      <h2>{option.departure} 출발</h2>
      <p className="art-option-card__reason">{option.reason}</p>
      <div className="art-route-stats">
        <RouteStat icon={<Clock3 />} label="예상 소요 시간" value={option.duration} />
        <RouteStat icon={<Wallet />} label="예상 비용" value={option.cost} />
        <RouteStat icon={<Zap />} label={option.id === 'base' ? risk.status === 'caution' ? '기상 주의' : '운행 상태' : option.delta} value={option.id === 'base' ? risk.status === 'caution' ? '기상 · VMS 안내' : '기상 기준 반영' : '기본 추천 대비'} highlight={option.id !== 'base'} />
      </div>
      <footer><ShieldCheck aria-hidden="true" /> {footer}</footer>
    </button>
  )
}

export function RouteCompareMap({
  selectedId,
  origin,
  destination,
  selectedOption,
  alternativeOption,
}: {
  selectedId: RouteOption['id']
  origin: string
  destination: string
  selectedOption?: RouteOption
  alternativeOption?: RouteOption
}) {
  return (
    <section className="art-compare-map" aria-label="선택 경로와 대안 경로 지도">
      <div className="art-compare-map__legend">
        <span><i className="route-swatch route-swatch--selected" /> 선택 경로 ({selectedId === 'base' ? '기본 추천' : selectedId === 'time' ? '시간 우선' : '비용 우선'})</span>
        <span><i className="route-swatch" /> 대안 경로</span>
        <hr />
        <strong>기상 주의 · VMS 안내</strong>
        <small>기상 · 도로공사 VMS 실시간 연동</small>
      </div>
      <RouteMap
        routeId={selectedId}
        coordinates={selectedOption?.geometryCoordinates}
        alternativeCoordinates={alternativeOption?.geometryCoordinates}
      />
      <span className="compare-map-origin">{origin} <i aria-hidden="true" /></span>
      <span className="compare-map-destination">{destination} <LocateFixed aria-hidden="true" /></span>
    </section>
  )
}

export function CompareStickyActionBar({ option, onStartTrip, onDashboard }: { option: RouteOption; onStartTrip: () => void; onDashboard: () => void }) {
  return (
    <div className="art-sticky-action art-sticky-action--compare">
      <button type="button" className="art-btn-sub" onClick={onDashboard}>계획으로 복귀</button>
      <button type="button" className="art-btn-main" onClick={onStartTrip} aria-label={`${option.title} 선택 후 내비 열기`}>
        선택 경로로 내비 열기 <ExternalLink aria-hidden="true" />
      </button>
    </div>
  )
}

export function CautionBanner({ risk }: { risk: RiskState }) {
  if (risk.status !== 'high') return null
  return <aside className="art-high-risk"><CloudLightning aria-hidden="true" /><span><strong>기상 특보 감지</strong>{risk.weatherReason}</span><TriangleAlert aria-hidden="true" /></aside>
}

function RiskStat({ risk }: { risk: RiskState }) {
  const high = risk.status === 'high'
  const insufficient = risk.status === 'insufficient'
  return <RouteStat icon={high || insufficient ? <AlertTriangle /> : <TriangleAlert />} label={high ? '출발 보류 권장' : insufficient ? '근거 부족' : risk.status === 'normal' ? '운행 상태' : '기상 주의'} value={high ? '기상 특보' : insufficient ? '확인 필요' : risk.status === 'normal' ? '기상 기준 반영' : '기상 특보 · VMS 안내'} warning={!risk.status || risk.status === 'caution' || high} />
}

function RouteStat({ icon, label, value, warning = false, highlight = false }: { icon: React.ReactNode; label: string; value: string; warning?: boolean; highlight?: boolean }) {
  return <div className={`art-route-stat ${warning ? 'is-warning' : ''} ${highlight ? 'is-highlight' : ''}`}><span className="art-route-stat__label">{icon}{label}</span><strong>{value}</strong></div>
}

export function NaviLaunchModal({
  isOpen,
  destination,
  coordinates,
  onClose,
  onStartInTrip,
}: {
  isOpen: boolean
  destination: string
  coordinates?: [number, number]
  onClose: () => void
  onStartInTrip: () => void
}) {
  if (!isOpen) return null

  const [lng, lat] = coordinates ?? [127.7161, 34.789]
  const encodedName = encodeURIComponent(destination)

  const kakaoUrl = `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`
  const tmapUrl = `tmap://route?goalname=${encodedName}&goalx=${lng}&goaly=${lat}`
  const naverUrl = `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodedName}&appname=jeonnam.planner`

  const launchAndStart = (url: string) => {
    window.open(url, '_blank')
    onStartInTrip()
  }

  return (
    <div className="navi-modal-backdrop">
      <div className="navi-modal" role="dialog" aria-modal="true" aria-labelledby="navi-modal-title">
        <header className="navi-modal__header">
          <div className="navi-modal__title">
            <Compass aria-hidden="true" />
            <h2 id="navi-modal-title">외부 내비게이션 연결</h2>
          </div>
          <button type="button" className="navi-modal__close" onClick={onClose} aria-label="닫기"><X aria-hidden="true" /></button>
        </header>
        <p className="navi-modal__desc">
          <strong>{destination}</strong>(으)로 안내를 시작할 내비 앱을 선택해 주세요.
        </p>
        <div className="navi-btn-grid">
          <button type="button" className="navi-btn navi-btn--kakao" onClick={() => launchAndStart(kakaoUrl)}>
            <span>카카오내비 / 카카오맵</span>
            <ExternalLink aria-hidden="true" />
          </button>
          <button type="button" className="navi-btn navi-btn--tmap" onClick={() => launchAndStart(tmapUrl)}>
            <span>티맵 (TMAP)</span>
            <ExternalLink aria-hidden="true" />
          </button>
          <button type="button" className="navi-btn navi-btn--naver" onClick={() => launchAndStart(naverUrl)}>
            <span>네이버 지도</span>
            <ExternalLink aria-hidden="true" />
          </button>
        </div>
        <footer className="navi-modal__footer">
          <button type="button" className="navi-btn-intrip" onClick={onStartInTrip}>
            <CheckCircle2 aria-hidden="true" /> 앱에서 바로 운행 중 모드 시작
          </button>
        </footer>
      </div>
    </div>
  )
}

export function InTripView({
  plan,
  option,
  risk,
  onBackToPlan,
  onOpenNavi,
}: {
  plan: PlanInputs
  option: RouteOption
  risk: RiskState
  onBackToPlan: () => void
  onOpenNavi: () => void
}) {
  return (
    <div className="art-intrip-view">
      <header className="intrip-header">
        <div className="intrip-badge"><Truck aria-hidden="true" /> 운행 중 안전 모드</div>
        <button type="button" className="intrip-back-btn" onClick={onBackToPlan}>
          <RotateCcw aria-hidden="true" /> 계획 모드
        </button>
      </header>

      <div className="intrip-content">
        <section className="intrip-hero">
          <div className="intrip-destination">
            <span>목적지</span>
            <h2>{plan.destination}</h2>
          </div>
          <div className="intrip-eta-block">
            <span className="intrip-eta-label">도착 희망 시각</span>
            <strong className="intrip-eta-time">{plan.arrivalTime}</strong>
            <p className="intrip-eta-sub">예상 소요 시간 {option.duration} · 거리 {option.distanceKm ?? 12.1} km</p>
          </div>
        </section>

        <section className="intrip-safety-card">
          <div className="intrip-safety-title">
            {risk.status === 'high' ? <ShieldAlert aria-hidden="true" className="is-red" /> : <ShieldCheck aria-hidden="true" className="is-green" />}
            <h3>실시간 안전 상태 요약</h3>
          </div>
          {risk.status === 'high' ? (
            <div className="intrip-alert-box is-high">
              <strong>🚨 기상 특보 주의</strong>
              <p>{risk.weatherReason ?? '강풍/호우 특보가 발효 중입니다. 안전 속도를 유지하세요.'}</p>
            </div>
          ) : risk.status === 'caution' ? (
            <div className="intrip-alert-box is-caution">
              <strong>⚠️ 기상 주의</strong>
              <p>{risk.weatherReason ?? '강풍 및 노면 상태 주의 구간이 있습니다.'}</p>
            </div>
          ) : (
            <div className="intrip-alert-box is-normal">
              <strong>✅ 운행 상태 원활</strong>
              <p>기상청 관측 및 고속도로 실황 기준 정상 운행 가능 구간입니다.</p>
            </div>
          )}
          {risk.vmsReason && (
            <p className="intrip-vms-note"><Bell aria-hidden="true" /> {risk.vmsReason}</p>
          )}
        </section>
      </div>

      <footer className="intrip-footer">
        <button type="button" className="intrip-navi-btn" onClick={onOpenNavi}>
          <ExternalLink aria-hidden="true" /> 내비게이션 다시 열기
        </button>
      </footer>
    </div>
  )
}
