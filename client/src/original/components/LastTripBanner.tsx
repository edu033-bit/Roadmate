// P1-C: 이전 계획 이어보기 배너
import { RotateCcw, X } from 'lucide-react'

interface LastTripBannerProps {
  destination: string
  departure: string
  onRestore: () => void
  onDismiss: () => void
}

export function LastTripBanner({ destination, departure, onRestore, onDismiss }: LastTripBannerProps) {
  return (
    <div className="last-trip-banner" role="status" aria-live="polite">
      <div className="last-trip-banner__content">
        <RotateCcw aria-hidden="true" />
        <div>
          <strong>이전 계획 이어보기</strong>
          <span>{destination} · {departure} 출발</span>
        </div>
      </div>
      <div className="last-trip-banner__actions">
        <button type="button" className="last-trip-btn last-trip-btn--restore" onClick={onRestore}>이어보기</button>
        <button type="button" className="last-trip-btn last-trip-btn--dismiss" onClick={onDismiss} aria-label="닫기"><X aria-hidden="true" /></button>
      </div>
    </div>
  )
}
