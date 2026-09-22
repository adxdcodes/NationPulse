import { useState, useEffect, useMemo } from "react";
import { EVENTS, DOMAINS, TOPICS, STATUSES } from "../data/mockData.js";
import { DOMAIN_META } from "../context/ThemeContext.jsx";
import { FilterBar, UniversalCard, SkeletonCard, EmptyState, Footer } from "../components/UI.jsx";

export default function Home({ dark, t }) {
  const [filters, setFilters] = useState({ domain: "All", topic: "All", status: "All" });
  const [loading, setLoading] = useState(true);
  useEffect(() => { const id = setTimeout(() => setLoading(false), 700); return () => clearTimeout(id); }, []);

  const filtered = useMemo(() => EVENTS.filter(ev => {
    if (filters.domain !== "All" && ev.domain !== filters.domain) return false;
    if (filters.topic !== "All" && ev.topic !== filters.topic) return false;
    if (filters.status !== "All" && ev.status !== filters.status) return false;
    return true;
  }), [filters]);

  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} t={t} domains={DOMAINS} topics={TOPICS} statuses={STATUSES} />
      <div style={{ background: t.topbar, borderBottom: `1px solid ${t.topbarBorder}`, padding: "20px 20px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0", color: "#fff", fontSize: 18, fontWeight: 700 }}>Government activity feed</h2>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{filtered.length} updates · sorted by most recent · Parliament, Executive, Budget and Judiciary</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(DOMAIN_META).map(([d, m]) => {
              const on = filters.domain === d;
              return (
                <button key={d} onClick={() => setFilters(f => ({ ...f, domain: f.domain === d ? "All" : d }))}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "1px solid rgba(255,255,255,0.12)", color: on ? "#93C5FD" : "rgba(255,255,255,0.6)", background: on ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.18s", fontFamily: "inherit", opacity: filters.domain !== "All" && !on ? 0.4 : 1 }}>
                  <m.Icon size={13} aria-hidden="true" />{d}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? [1, 2, 3].map(i => <SkeletonCard key={i} t={t} />) : !filtered.length ? (
          <EmptyState t={t} actionLabel="Clear filters" onAction={() => setFilters({ domain: "All", topic: "All", status: "All" })} />
        ) : filtered.map(ev => <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} />)}
      </div>
      <Footer t={t} />
    </div>
  );
}
