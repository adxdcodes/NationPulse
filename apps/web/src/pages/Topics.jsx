import { Link } from "react-router-dom";
import { Tag, ArrowRight, FileText } from "lucide-react";
import { EVENTS, TOPIC_INFO } from "../data/mockData.js";
import { DOMAIN_META, FONT_SERIF } from "../context/ThemeContext.jsx";
import { PageHeader, Footer } from "../components/UI.jsx";

export default function Topics({ dark, t }) {
  const topics = Object.keys(TOPIC_INFO).map(name => {
    const events = EVENTS.filter(e => e.topic === name);
    const domainCounts = {};
    events.forEach(e => { domainCounts[e.domain] = (domainCounts[e.domain] || 0) + 1; });
    const topDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { name, count: events.length, topDomain, latest: events[0] };
  }).sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader t={t} eyebrow="DIRECTORY" IconComp={Tag} title="Browse by topic"
        subtitle="Every bill, scheme, and ruling NationPulse tracks, organised by the policy area it affects." />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {topics.map(topic => {
            const dm = topic.topDomain ? DOMAIN_META[topic.topDomain] : null;
            const c = dm ? (dark ? dm.dark : dm.light) : null;
            return (
              <Link key={topic.name} to={`/topics/${encodeURIComponent(topic.name)}`}
                style={{ display: "block", background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: "18px 18px", textDecoration: "none", boxShadow: t.shadow, transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.boxShadow = t.shadowHover; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderLight; e.currentTarget.style.boxShadow = t.shadow; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 700, color: t.text }}>{topic.name}</h3>
                  {dm && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: c.bg, color: c.text, flexShrink: 0 }}>
                      <dm.Icon size={10} aria-hidden="true" />{topic.topDomain}
                    </span>
                  )}
                </div>
                <p style={{ margin: "0 0 14px 0", fontSize: 12.5, color: t.textSub, lineHeight: 1.6, minHeight: 38 }}>{TOPIC_INFO[topic.name].blurb}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${t.borderLight}` }}>
                  <span style={{ fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
                    <FileText size={12} aria-hidden="true" />{topic.count} tracked
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.primary, display: "flex", alignItems: "center", gap: 3 }}>
                    View<ArrowRight size={12} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <Footer t={t} />
    </div>
  );
}
