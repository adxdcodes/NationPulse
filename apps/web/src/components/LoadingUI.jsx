import "./LoadingUI.css";

/** Mirrors UniversalCard's badge/date, heading, summary, why-it-matters and footer layout. */
export function CardSkeletonList({ count = 3 }) {
  return <div className="np-skeleton-list" role="status" aria-label="Loading updates" aria-live="polite">
    {Array.from({ length: count }, (_, i) => <div className="np-skeleton-card" key={i} aria-hidden="true">
      <div className="np-skeleton-badges">
        <span className="np-skeleton np-skeleton-badge" />
        <span className="np-skeleton np-skeleton-badge np-skeleton-badge-small" />
        <span className="np-skeleton np-skeleton-date" />
      </div>
      <div className="np-skeleton-heading">
        <span className="np-skeleton np-skeleton-title" />
        {i % 2 === 0 && <span className="np-skeleton np-skeleton-title np-skeleton-title-short" />}
      </div>
      <div className="np-skeleton-paragraph">
        <span className="np-skeleton np-skeleton-line" />
        <span className="np-skeleton np-skeleton-line np-skeleton-line-medium" />
      </div>
      <div className="np-skeleton-insight">
        <span className="np-skeleton np-skeleton-insight-label" />
        <span className="np-skeleton np-skeleton-line" />
        <span className="np-skeleton np-skeleton-line np-skeleton-line-medium" />
      </div>
      <div className="np-skeleton-tags">
        <span className="np-skeleton np-skeleton-tag" />
        <span className="np-skeleton np-skeleton-tag np-skeleton-tag-small" />
        <span className="np-skeleton np-skeleton-view" />
      </div>
      <div className="np-skeleton-comments"><span className="np-skeleton np-skeleton-comment" /></div>
    </div>)}
    <span className="np-sr-only">Loading, please wait.</span>
  </div>;
}

export function PagePreloader() {
  return <main className="np-page-preloader" role="status" aria-label="Loading page">
    <div className="np-preloader-heading" aria-hidden="true"><span className="np-skeleton np-skeleton-title"/><span className="np-skeleton np-skeleton-line np-skeleton-line-medium"/></div>
    <CardSkeletonList count={3}/>
  </main>;
}

export function DetailSkeleton() {
  return <main className="np-page-preloader" role="status" aria-label="Loading bill details">
    <div className="np-preloader-heading" aria-hidden="true"><span className="np-skeleton np-skeleton-badge"/><span className="np-skeleton np-skeleton-title"/><span className="np-skeleton np-skeleton-title np-skeleton-title-short"/><span className="np-skeleton np-skeleton-line np-skeleton-line-medium"/></div>
    <CardSkeletonList count={2}/>
  </main>;
}
