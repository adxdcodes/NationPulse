import { useSearchParams } from "react-router-dom";
import PublishedBillModal from "../components/PublishedBillModal.jsx";
import { CardSkeletonList } from "../components/LoadingUI.jsx";
import { useState, useEffect, useMemo } from "react";
import FeedChatbot from "../components/FeedChatbot.jsx";
import { api } from "../api/client.js";
import { useLive, LiveError } from "../api/useLive.jsx";
const DOMAINS=["All","Parliament"], STATUSES=["All","Introduced","In Committee","Passed","Enacted","Withdrawn"];
import { DOMAIN_META } from "../context/ThemeContext.jsx";
import { FilterBar, UniversalCard, EmptyState, Footer } from "../components/UI.jsx";

export default function Home({ dark, t }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const previewId = searchParams.get("bill");
  const closePreview = () => setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete("bill"); return next; }, { replace:true });
  const [filters, setFilters] = useState({ domain: "All", topic: "All", status: "All" });
  const {data,loading,error}=useLive(()=>Promise.all([api.listBills({page_size:100,...filters}),api.listTopics()]),[filters.domain,filters.topic,filters.status]);
  const EVENTS=useMemo(() => data?.[0]?.items || [], [data]); const TOPICS=["All",...(data?.[1]?.items||[]).map(x=>x.name)];

  const filtered = useMemo(() => EVENTS.filter(ev => {
    if (filters.domain !== "All" && ev.domain !== filters.domain) return false;
    if (filters.topic !== "All" && ev.topic !== filters.topic) return false;
    if (filters.status !== "All" && ev.status !== filters.status) return false;
    return true;
  }), [EVENTS, filters]);

  return (
    <div className="np-feed-page">
      <FilterBar filters={filters} setFilters={setFilters} t={t} domains={DOMAINS} topics={TOPICS} statuses={STATUSES} />
      <div className="np-feed-hero" style={{ background: t.topbar, borderBottom: `1px solid ${t.topbarBorder}`, padding: "20px 20px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0", color: "#fff", fontSize: 18, fontWeight: 700 }}>Your Parliament, clearly explained</h2>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{loading ? "Loading" : filtered.length} updates · sorted by most recent · Explore bills and parliamentary updates</p>
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
      <LiveError error={error}/><div className="np-feed-list" style={{ width: "100%", maxWidth: 860, margin: "0 auto", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? <CardSkeletonList count={3} /> : !filtered.length ? (
          <EmptyState t={t} actionLabel="Clear filters" onAction={() => setFilters({ domain: "All", topic: "All", status: "All" })} />
        ) : filtered.map(ev => <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} />)}
      </div>
      <Footer t={t} />
      <FeedChatbot dark={dark} />
      <PublishedBillModal id={previewId} onClose={closePreview} t={t} dark={dark} />
    </div>
  );
}
