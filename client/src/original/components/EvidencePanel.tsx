// P1-B: 경로 신뢰도 근거 패널 — '왜 이 추천인가?' 드로어
import { X, Clock3, ShieldCheck, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react'
import type { RiskState, RouteOption } from '../types'

interface Source {
  provider: string
  observedAt?: string
  sourceType?: string
  reliability?: string
  detail?: string
}

interface EvidencePanelProps {
  isOpen: boolean
  onClose: () => void
  option: RouteOption
  risk: RiskState
  sources?: Source[]
}

const reliabilityLabel = (r?: string) => {
  if (r === 'sufficient') return { text: '충분', icon: <CheckCircle2 className='ev-icon ev-icon--ok' aria-hidden='true' /> }
  if (r === 'partial') return { text: '일부 추정', icon: <AlertTriangle className='ev-icon ev-icon--warn' aria-hidden='true' /> }
  return { text: '확인 필요', icon: <AlertTriangle className='ev-icon ev-icon--err' aria-hidden='true' /> }
}

const DEFAULT_SOURCES: Source[] = [
  { provider: 'ORS HGV', observedAt: '최근', sourceType: 'estimated', reliability: 'sufficient', detail: 'HGV 차량 제약 반영 경로 추정' },
  { provider: '기상청 (KMA)', observedAt: '최근', sourceType: 'realtime', reliability: 'sufficient', detail: '초단기실황·단기예보 기상 판단' },
  { provider: '한국도로공사 VMS', observedAt: '최근', sourceType: 'realtime', reliability: 'partial', detail: '고속도로 VMS 안내 (주의 근거)' },
  { provider: '한국도로공사 통행료', observedAt: '최근', sourceType: 'static', reliability: 'partial', detail: '일부 민자구간 확인 필요' },
  { provider: 'YGPA 항만 패턴', observedAt: '2014–2018 기록', sourceType: 'static', reliability: 'partial', detail: '과거 광양항 출입 체류 시간대 패턴' },
]

export function EvidencePanel({ isOpen, onClose, option, risk, sources }: EvidencePanelProps) {
  if (!isOpen) return null
  const sourcesToShow = sources && sources.length > 0 ? sources : DEFAULT_SOURCES

  return (
    <div className="ev-backdrop" role="dialog" aria-modal="true" aria-labelledby="ev-panel-title">
      <div className="ev-panel">
        <header className="ev-panel__header">
          <div className="ev-panel__title-row">
            <ShieldCheck aria-hidden="true" />
            <h2 id="ev-panel-title">왜 이 경로가 추천됐나요?</h2>
          </div>
          <button type="button" className="ev-close" onClick={onClose} aria-label="닫기"><X aria-hidden="true" /></button>
        </header>
        <div className="ev-panel__body">
          <section className="ev-section">
            <h3>추천 근거 요약</h3>
            <div className="ev-reason-box">
              <p><strong>{option.title}</strong> — {option.reason}</p>
              {option.portPatternApplied && (
                <p className="ev-reason-port">⚓ 광양항 과거 출입·체류 패턴 기반 +15분 버퍼 가산</p>
              )}
            </div>
          </section>
          <section className="ev-section">
            <h3>안전 판단</h3>
            <div className={`ev-risk-chip ev-risk-chip--${risk.status}`}>
              {risk.status === 'high' ? '🚨 고위험 · 출발 보류 권장'
                : risk.status === 'caution' ? '⚠️ 기상 주의'
                : risk.status === 'insufficient' ? '🔘 근거 부족 · 확인 필요'
                : '✅ 정상'}
            </div>
            {risk.weatherReason && <p className="ev-note"><Clock3 aria-hidden="true" /> {risk.weatherReason}</p>}
            {risk.vmsReason && <p className="ev-note">{risk.vmsReason}</p>}
            <p className="ev-disclaimer">
              ⚠️ 이 서비스는 사전 계획 도구입니다. 실제 도로 표지·통제기관·내비게이션 안내를 항상 우선하십시오.
            </p>
          </section>
          <section className="ev-section">
            <h3>데이터 출처 및 최신성</h3>
            <ul className="ev-source-list">
              {sourcesToShow.map((src, i) => {
                const rel = reliabilityLabel(src.reliability)
                return (
                  <li key={i} className="ev-source-item">
                    <div className="ev-source-header">
                      {rel.icon}
                      <strong>{src.provider}</strong>
                      <span className="ev-source-badge">{src.sourceType === "realtime" ? "실시간" : src.sourceType === "estimated" ? "추정" : "정적"}</span>
                    </div>
                    <div className="ev-source-detail">
                      <span className="ev-source-time"><RotateCcw aria-hidden="true" /> {src.observedAt ?? "최근"}</span>
                      <span>{src.detail}</span>
                    </div>
                    <div className="ev-source-reliability">신뢰도: {rel.text}</div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
