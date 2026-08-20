import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CircleCheck,
  Clock3,
  CloudLightning,
  MapPinned,
  Navigation,
  Route,
  ShieldAlert,
  TriangleAlert,
  Waves,
  Wind,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { ReliabilityState, RiskState, RouteOption } from '../types'

const statusIcon = {
  normal: CircleCheck,
  caution: TriangleAlert,
  high: ShieldAlert,
  insufficient: AlertTriangle,
}

function StatusPill({ risk }: { risk: RiskState }) {
  const Icon = statusIcon[risk.status]
  const label =
    risk.status === 'normal'
      ? '원활'
      : risk.status === 'caution'
        ? '주의'
        : risk.status === 'high'
          ? '출발 보류 권장'
          : '근거 부족'

  return (
    <span className={`status-pill status-pill--${risk.status}`}>
      <Icon size={15} aria-hidden="true" />
      {label}
    </span>
  )
}

export function DashboardHeader({ onCompare }: { onCompare: () => void }) {
  return (
    <header className="dashboard-header">
      <div className="brand-lockup">
        <span className="brand-mark">J</span>
        <div>
          <strong>전남 화물 플래너</strong>
          <span>출발 전 운행 판단</span>
        </div>
      </div>
      <button className="icon-button" aria-label="알림 보기" type="button">
        <Bell size={20} />
      </button>
      <button className="trip-summary" type="button" onClick={onCompare}>
        <MapPinned size={18} aria-hidden="true" />
        <span>
          <strong>광양항 컨테이너 터미널</strong>
          <small>순천 IC 출발 · 오늘 17:00 도착</small>
        </span>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </header>
  )
}

export function RecommendedHero({
  risk,
  reliability,
  onCompare,
}: {
  risk: RiskState
  reliability: ReliabilityState
  onCompare: () => void
}) {
  const isHigh = risk.status === 'high'
  const isInsufficient = risk.status === 'insufficient'

  return (
    <section className={`recommended-hero recommended-hero--${risk.status}`} aria-labelledby="recommendation-title">
      <div className="hero-topline">
        <StatusPill risk={risk} />
        <span className="updated-at">기준 {risk.observedAt}</span>
      </div>
      <div className="hero-body">
        <p className="eyebrow" id="recommendation-title">
          {isHigh ? '기상 확인이 먼저 필요합니다' : isInsufficient ? '계산 근거를 확인해 주세요' : '오늘의 출발 판단'}
        </p>
        <h1>{isHigh ? '출발 보류 권장' : '13:10-13:30'}</h1>
        <p className="hero-action">{isHigh ? risk.weatherReason : isInsufficient ? '최신 기상·고속도로 안내 확인 필요' : '이 시간대 출발 권장'}</p>
        {!isHigh && !isInsufficient && (
          <div className="hero-metrics">
            <span><Clock3 size={17} aria-hidden="true" /> 납기까지 <strong>52분 여유</strong></span>
            <span><Route size={17} aria-hidden="true" /> 기본 추천 2시간 38분</span>
          </div>
        )}
      </div>
      <div className="hero-footer">
        <span><CircleCheck size={16} aria-hidden="true" /> {reliability.label}</span>
        <button className="text-action" type="button" onClick={onCompare}>
          {isHigh ? '우회 경로 보기' : '추천 근거 보기'} <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

export function PrimaryRecommendationCard({ option, risk }: { option: RouteOption; risk: RiskState }) {
  return (
    <article className="route-card route-card--primary">
      <div className="route-card__heading">
        <div>
          <p className="card-kicker">기본 추천</p>
          <h2>{option.departure} 출발</h2>
        </div>
        <StatusPill risk={risk} />
      </div>
      <div className="metric-grid metric-grid--three">
        <Metric label="예상 시간" value={option.duration} />
        <Metric label="예상 직접비" value={option.cost} />
        <Metric label="추천 사유" value="균형" />
      </div>
      <p className="route-reason"><CircleCheck size={16} aria-hidden="true" /> {option.reason}</p>
    </article>
  )
}

export function AlternativeMiniCards({ options, onSelect }: { options: RouteOption[]; onSelect: (id: RouteOption['id']) => void }) {
  return (
    <div className="alternative-grid">
      {options.map((option) => (
        <button className="alternative-card" type="button" key={option.id} onClick={() => onSelect(option.id)}>
          <span className="alternative-card__label">{option.shortTitle}</span>
          <strong>{option.delta}</strong>
          <span>{option.reason}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

export function EvidenceMapPreview({ risk }: { risk: RiskState }) {
  const caution = risk.status === 'caution'
  return (
    <section className="map-card" aria-labelledby="evidence-map-title">
      <div className="map-card__heading">
        <div>
          <p className="card-kicker">추천 근거</p>
          <h2 id="evidence-map-title">경로와 현장 안내</h2>
        </div>
        <span className="map-refresh">15:42 갱신</span>
      </div>
      <div className="map-surface" role="img" aria-label="순천에서 광양항까지의 추천 경로와 강풍 주의, VMS 안내 표출 위치">
        <div className="map-road map-road--one" />
        <div className="map-road map-road--two" />
        <div className="map-route map-route--alt" />
        <div className="map-route map-route--main" />
        <span className="map-place map-place--origin">순천 IC</span>
        <span className="map-place map-place--destination">광양항</span>
        {caution && <span className="map-badge map-badge--wind"><Wind size={15} /> 강풍 주의</span>}
        <span className="map-badge map-badge--vms"><Bell size={14} /> VMS 안내</span>
      </div>
      <div className="map-note"><Navigation size={16} aria-hidden="true" /> 실제 표지·통제기관 안내를 우선하세요.</div>
    </section>
  )
}

export function StickyActionBar({ onClick }: { onClick: () => void }) {
  return <div className="sticky-action"><button type="button" onClick={onClick}><Route size={21} aria-hidden="true" /> 후보 경로 비교 보기</button></div>
}

export function CompareTopSummary() {
  return (
    <section className="compare-summary">
      <div><span>권장 출발</span><strong>13:10-13:30</strong></div>
      <div><span>납기 여유</span><strong>52분</strong></div>
    </section>
  )
}

export function RouteOptionCardList({
  options,
  selectedId,
  onSelect,
  risk,
}: {
  options: RouteOption[]
  selectedId: RouteOption['id']
  onSelect: (id: RouteOption['id']) => void
  risk: RiskState
}) {
  return <section className="option-list" aria-label="후보 경로 목록">{options.map((option) => <RouteOptionCard key={option.id} option={option} selected={option.id === selectedId} onSelect={onSelect} risk={risk} />)}</section>
}

export function RouteOptionCard({ option, selected, onSelect, risk }: { option: RouteOption; selected: boolean; onSelect: (id: RouteOption['id']) => void; risk: RiskState }) {
  return (
    <button className={`option-card ${selected ? 'option-card--selected' : ''}`} type="button" onClick={() => onSelect(option.id)} aria-pressed={selected}>
      <div className="option-card__top"><span className="card-kicker">{option.title}</span>{selected && <span className="selected-tag">선택됨</span>}</div>
      <strong className="option-departure">{option.departure} 출발</strong>
      <div className="option-metrics"><Metric label="소요" value={option.duration} /><Metric label="직접비" value={option.cost} /><Metric label="차이" value={option.delta} /></div>
      <span className="option-reason">{risk.status === 'high' ? '기상 근거 확인 후 선택' : option.reason}</span>
    </button>
  )
}

export function RouteCompareMap({ selectedId, risk }: { selectedId: RouteOption['id']; risk: RiskState }) {
  return (
    <section className="map-card map-card--compare" aria-labelledby="compare-map-title">
      <div className="map-card__heading"><div><p className="card-kicker">경로 비교</p><h2 id="compare-map-title">선택 경로 지도</h2></div><span className="map-refresh">선택: {selectedId === 'base' ? '기본 추천' : selectedId === 'time' ? '시간 우선' : '비용 우선'}</span></div>
      <div className="map-surface map-surface--compare" role="img" aria-label="선택한 경로와 대안 경로 지도">
        <div className="map-road map-road--one" /><div className="map-road map-road--two" />
        <div className="map-route map-route--alt map-route--alt-two" /><div className={`map-route map-route--main map-route--selected-${selectedId}`} />
        <span className="map-badge map-badge--vms"><Bell size={14} /> VMS 안내 표출</span>
        {risk.status === 'caution' && <span className="map-badge map-badge--wind"><Wind size={15} /> 강풍 주의</span>}
      </div>
      <div className="map-legend"><span><i className="legend-line legend-line--selected" /> 선택 경로</span><span><i className="legend-line" /> 대안 경로</span></div>
    </section>
  )
}

export function CompareStickyActionBar({ option, onDashboard }: { option: RouteOption; onDashboard: () => void }) {
  return <div className="sticky-action"><button type="button" onClick={onDashboard}><Navigation size={21} aria-hidden="true" /> {option.title} 선택 완료</button></div>
}

export function CautionBanner({ risk }: { risk: RiskState }) {
  if (risk.status !== 'caution') return null
  return <aside className="caution-banner"><CloudLightning size={20} aria-hidden="true" /><span><strong>{risk.weatherReason ?? '기상 주의'}</strong><small>{risk.vmsReason ?? '고속도로 안내를 함께 확인하세요.'}</small></span></aside>
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

export function MapFallbackBadge() {
  return <span className="map-badge map-badge--vms"><Waves size={14} /> 경로 정보</span>
}
