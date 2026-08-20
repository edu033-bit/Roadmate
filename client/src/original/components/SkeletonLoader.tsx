// P1-E: 스켈레톤 로딩 컴포넌트 — 점진적 렌더링용
export function SkeletonHero() {
  return (
    <section className="art-hero art-hero--skeleton" aria-busy="true" aria-label="경로 계산 중">
      <div className="art-hero__label">
        <div className="skeleton skeleton--label" />
      </div>
      <div className="skeleton skeleton--heading" />
      <div className="skeleton skeleton--btn" />
      <div className="skeleton skeleton--caption" />
    </section>
  )
}

export function SkeletonCard() {
  return (
    <article className="art-primary-card art-primary-card--skeleton" aria-busy="true">
      <div className="skeleton skeleton--tag" />
      <div className="skeleton skeleton--heading" />
      <div className="skeleton-stats">
        <div className="skeleton skeleton--stat" />
        <div className="skeleton skeleton--stat" />
        <div className="skeleton skeleton--stat" />
      </div>
    </article>
  )
}

export function SkeletonAlternatives() {
  return (
    <div className="art-alternative-grid">
      {[0, 1].map((i) => (
        <div key={i} className="art-alternative-card art-alternative-card--skeleton" aria-busy="true">
          <div className="skeleton skeleton--tag" />
          <div className="skeleton skeleton--stat" />
        </div>
      ))}
    </div>
  )
}
