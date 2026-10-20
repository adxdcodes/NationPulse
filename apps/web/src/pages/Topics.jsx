import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Tag, ArrowRight, FileText, Search, X } from "lucide-react";
import { api } from "../api/client.js";
import { useLive, LiveError } from "../api/useLive.jsx";
import { DOMAIN_META, FONT_SERIF } from "../context/ThemeContext.jsx";
import { PageHeader, Footer, EmptyState } from "../components/UI.jsx";
import { TopicSkeletonGrid } from "../components/LoadingUI.jsx";

export default function Topics({ dark, t }) {
  const [q, setQ] = useState("");
  const { data, error, loading } = useLive(() => api.listTopics(), []);
  const topics = data?.items || [];

  const filtered = useMemo(() => {
    if (!q.trim()) return topics;
    const term = q.trim().toLowerCase();
    return topics.filter(tp => tp.name.toLowerCase().includes(term));
  }, [topics, q]);

  return (
    <div>
      <PageHeader
        t={t}
        eyebrow="POLICY DIRECTORY"
        IconComp={Tag}
        title="Browse Legislation by Policy Topic"
        subtitle="Every bill, scheme, and ruling NationPulse tracks, organised by the policy area and sector it affects."
      />
      <LiveError error={error} />
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "26px 20px 44px", width: "100%" }}>
        {/* Filter Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.textSub }}>
            {loading ? "Loading policy topics..." : `${filtered.length} policy ${filtered.length === 1 ? "area" : "areas"} available`}
          </div>
          <div style={{ position: "relative", minWidth: 240, flex: "0 1 300px" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} aria-hidden="true" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Filter topics by name..."
              aria-label="Filter topics by name"
              style={{
                width: "100%", padding: "8px 30px 8px 34px",
                borderRadius: 9, border: `1px solid ${t.border}`,
                background: t.surface, color: t.text, fontSize: 13,
                outline: "none", fontFamily: "inherit",
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: t.textMuted, padding: 2,
                  display: "flex", alignItems: "center", cursor: "pointer",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <TopicSkeletonGrid />
        ) : !filtered.length ? (
          <EmptyState
            t={t}
            title="No policy topics found"
            body={q ? `No topics matched "${q}". Try a different keyword.` : "No approved bills with policy topics are published yet."}
            actionLabel={q ? "Clear search" : undefined}
            onAction={q ? () => setQ("") : undefined}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {filtered.map(topic => {
              const dm = topic.topDomain ? DOMAIN_META[topic.topDomain] : null;
              const c = dm ? (dark ? dm.dark : dm.light) : null;
              return (
                <Link
                  key={topic.name}
                  to={`/topics/${encodeURIComponent(topic.name)}`}
                  style={{
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    background: t.surface, border: `1px solid ${t.borderLight}`,
                    borderRadius: 16, padding: "20px 22px", textDecoration: "none",
                    boxShadow: t.shadow, transition: "all 0.18s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = t.primary;
                    e.currentTarget.style.boxShadow = t.shadowHover;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = t.borderLight;
                    e.currentTarget.style.boxShadow = t.shadow;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <h2 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 18, fontWeight: 700, color: t.text, lineHeight: 1.3 }}>
                        {topic.name}
                      </h2>
                      {dm && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: c.bg, color: c.text, border: `1px solid ${c.border}`, flexShrink: 0,
                        }}>
                          <dm.Icon size={11} aria-hidden="true" />{topic.topDomain}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "0 0 18px 0", fontSize: 13, color: t.textSub, lineHeight: 1.6 }}>
                      Explore {topic.count} approved parliamentary {topic.count === 1 ? "bill" : "bills"} and plain-language impact analyses under {topic.name}.
                    </p>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    paddingTop: 12, borderTop: `1px solid ${t.borderLight}`,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
                      <FileText size={13} color={t.primary} aria-hidden="true" />{topic.count} {topic.count === 1 ? "bill" : "bills"} tracked
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: t.primary, display: "flex", alignItems: "center", gap: 4 }}>
                      Explore<ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer t={t} />
    </div>
  );
}
