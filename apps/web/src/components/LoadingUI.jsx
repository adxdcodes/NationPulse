import "./LoadingUI.css";

function Lines({ widths = ["100%", "72%"] }) {
  return <div className="np-skeleton-lines" aria-hidden="true">
    {widths.map((width, index) => <span key={index} className="np-skeleton" style={{ width }} />)}
  </div>;
}

/** Content-shaped placeholders shared by feed, search, topic and digest pages. */
export function CardSkeletonList({ count = 3, compact = false, className = "" }) {
  return <div className={`np-skeleton-list${compact ? " np-skeleton-list--compact" : ""} ${className}`.trim()} role="status" aria-label="Loading updates" aria-live="polite">
    {Array.from({ length: count }, (_, index) => <article className="np-skeleton-card" key={index} aria-hidden="true">
      <div className="np-skeleton-meta"><span className="np-skeleton np-skeleton-badge"/><span className="np-skeleton np-skeleton-badge np-skeleton-badge--short"/><span className="np-skeleton np-skeleton-date"/></div>
      <div className="np-skeleton-title-block"><span className="np-skeleton np-skeleton-title"/><span className="np-skeleton np-skeleton-title np-skeleton-title--short"/></div>
      <Lines widths={["100%", "88%", "62%"]}/>
      {!compact && <>
        <div className="np-skeleton-insight"><span className="np-skeleton np-skeleton-insight-label"/><Lines widths={["100%", "76%"]}/></div>
        <div className="np-skeleton-tags"><span className="np-skeleton np-skeleton-tag"/><span className="np-skeleton np-skeleton-tag np-skeleton-tag--short"/><span className="np-skeleton np-skeleton-date"/></div>
      </>}
    </article>)}
    <span className="np-sr-only">Loading, please wait.</span>
  </div>;
}

export function TopicSkeletonGrid({ count = 6 }) {
  return <div className="np-topic-skeleton-grid" role="status" aria-label="Loading policy topics" aria-live="polite">
    {Array.from({ length: count }, (_, i) => <div className="np-topic-skeleton" key={i} aria-hidden="true">
      <div className="np-topic-skeleton-title"><span className="np-skeleton"/><span className="np-skeleton"/></div>
      <Lines widths={["100%", "86%", "58%"]}/>
      <span className="np-skeleton np-topic-skeleton-footer"/>
    </div>)}
    <span className="np-sr-only">Loading policy topics, please wait.</span>
  </div>;
}

export function ProfileSkeleton() {
  return <div className="np-profile-skeleton" role="status" aria-label="Loading watchlist" aria-live="polite">
    <div className="np-profile-skeleton-head"><span className="np-skeleton"/><span className="np-skeleton"/></div>
    <CardSkeletonList count={2} compact/>
    <span className="np-sr-only">Loading your watchlist, please wait.</span>
  </div>;
}

export function LoadingPanel({ label = "Loading", lines = 3 }) {
  return <div className="np-loading-panel" role="status" aria-label={label} aria-live="polite">
    <span className="np-skeleton np-loading-panel-title" aria-hidden="true"/>
    <Lines widths={Array.from({ length: lines }, (_, i) => i === lines - 1 ? "62%" : "100%")}/>
    <span className="np-sr-only">{label}, please wait.</span>
  </div>;
}

export function PersonSkeleton({ detail = false }) {
  return <div className={`np-person-skeleton${detail ? " np-person-skeleton--detail" : ""}`} role="status" aria-label={detail ? "Loading MP profile" : "Loading MPs"} aria-live="polite">
    {Array.from({ length: detail ? 1 : 6 }, (_, i) => <div className="np-person-skeleton-card" key={i} aria-hidden="true">
      <span className="np-skeleton np-person-skeleton-avatar"/>
      <span className="np-skeleton np-person-skeleton-name"/>
      <span className="np-skeleton np-person-skeleton-line"/>
      <span className="np-skeleton np-person-skeleton-line np-person-skeleton-line--short"/>
    </div>)}
    <span className="np-sr-only">Loading, please wait.</span>
  </div>;
}

export function PagePreloader({ path = "" }) {
  if (path === "/topics") return <main className="np-page-preloader" aria-label="Loading topics"><TopicSkeletonGrid/></main>;
  if (path.startsWith("/mps/")) return <main className="np-page-preloader" aria-label="Loading MP profile"><PersonSkeleton detail/></main>;
  if (path === "/mps") return <main className="np-page-preloader" aria-label="Loading MPs"><PersonSkeleton/></main>;
  if (path === "/profile") return <main className="np-page-preloader" aria-label="Loading watchlist"><ProfileSkeleton/></main>;
  if (path.startsWith("/bills/") || path.startsWith("/event/")) return <DetailSkeleton/>;
  if (path === "/bills") return <main className="np-page-preloader" role="status" aria-label="Loading bills"><div className="np-route-skeleton-heading"><span className="np-skeleton"/><span className="np-skeleton"/></div><CardSkeletonList count={6} compact/></main>;
  if (path.startsWith("/admin")) return <main className="np-page-preloader" aria-label="Loading administration"><LoadingPanel label="Loading administration" lines={5}/></main>;
  if (path === "/login" || path === "/signup") return <main className="np-auth-preloader" role="status" aria-label="Loading sign in page"><div className="np-auth-skeleton-art"><span className="np-skeleton"/><span className="np-skeleton"/><span className="np-skeleton"/></div><div className="np-auth-skeleton-form"><span className="np-skeleton"/><span className="np-skeleton"/><span className="np-skeleton"/><span className="np-skeleton"/></div></main>;
  if (path === "/") return <main className="np-landing-preloader" role="status" aria-label="Loading landing page"><div className="np-landing-skeleton-hero"><div><span className="np-skeleton"/><span className="np-skeleton"/><span className="np-skeleton"/><span className="np-skeleton"/></div><span className="np-skeleton np-landing-skeleton-art"/></div><div className="np-topic-skeleton-grid">{[0,1,2].map(i=><div className="np-topic-skeleton" key={i}><div className="np-topic-skeleton-title"><span className="np-skeleton"/><span className="np-skeleton"/></div><Lines widths={["100%","75%"]}/></div>)}</div></main>;
  if (path === "/about") return <main className="np-page-preloader" aria-label="Loading about page"><LoadingPanel label="Loading About NationPulse" lines={5}/></main>;
  return <main className="np-page-preloader" role="status" aria-label="Loading page">
    <div className="np-route-skeleton-heading"><span className="np-skeleton"/><span className="np-skeleton"/></div>
    <CardSkeletonList count={3}/>
  </main>;
}

export function DetailSkeleton() {
  return <main className="np-detail-preloader" role="status" aria-label="Loading bill details">
    <section className="np-detail-skeleton-hero" aria-hidden="true">
      <div className="np-detail-skeleton-hero-inner">
        <span className="np-skeleton np-detail-skeleton-crumb"/>
        <div className="np-detail-skeleton-actions"><span className="np-skeleton np-detail-skeleton-action"/><span className="np-skeleton np-detail-skeleton-action np-detail-skeleton-action--wide"/></div>
        <div className="np-detail-skeleton-badges"><span className="np-skeleton np-skeleton-badge"/><span className="np-skeleton np-skeleton-badge np-skeleton-badge--short"/><span className="np-skeleton np-detail-skeleton-house"/></div>
        <span className="np-skeleton np-detail-skeleton-title"/>
        <span className="np-skeleton np-detail-skeleton-title np-detail-skeleton-title--short"/>
        <span className="np-skeleton np-detail-skeleton-line"/>
      </div>
    </section>
    <div className="np-detail-skeleton-layout" aria-hidden="true">
      <div className="np-detail-skeleton-content">
        <section className="np-detail-skeleton-section">
          <span className="np-skeleton np-detail-skeleton-label"/>
          <Lines widths={["100%", "100%", "100%", "82%", "63%"]}/>
        </section>
        <section className="np-detail-skeleton-section np-detail-skeleton-callout">
          <span className="np-skeleton np-detail-skeleton-label"/>
          <Lines widths={["100%", "78%"]}/>
        </section>
        <section className="np-detail-skeleton-section np-detail-skeleton-section--compact">
          <span className="np-skeleton np-detail-skeleton-label"/>
          <span className="np-skeleton np-detail-skeleton-line np-detail-skeleton-line--medium"/>
        </section>
      </div>
      <aside className="np-detail-skeleton-facts">
        <span className="np-skeleton np-detail-skeleton-facts-title"/>
        {Array.from({length: 6}, (_, i) => <div className="np-detail-skeleton-fact" key={i}>
          <span className="np-skeleton np-detail-skeleton-fact-label"/>
          <span className={`np-skeleton np-detail-skeleton-fact-value${i % 2 ? " is-short" : ""}`}/>
        </div>)}
        <span className="np-skeleton np-detail-skeleton-facts-button"/>
      </aside>
    </div>
    <span className="np-sr-only">Loading, please wait.</span>
  </main>;
}
