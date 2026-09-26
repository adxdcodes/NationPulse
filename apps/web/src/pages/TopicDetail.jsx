import { CardSkeletonList } from "../components/LoadingUI.jsx";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { Tag } from "lucide-react";
import {api} from "../api/client.js";
import {useLive,LiveError} from "../api/useLive.jsx";
const DOMAINS=["All","Parliament"],STATUSES=["All","Introduced","In Committee","Passed","Enacted","Withdrawn"];
import { UniversalCard, EmptyState, Footer, PageHeader, FollowButton } from "../components/UI.jsx";
import NotFound from "./ErrorPages.jsx";

export default function TopicDetail({ dark, t }) {
  const { topic } = useParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ domain: "All", status: "All" });

  const decoded = topic || ""; // React Router already decodes URL parameters.
  const {data,error,loading}=useLive(()=>api.listBills({topic:decoded,page_size:100}),[decoded]);
  const EVENTS = useMemo(() => data?.items || [], [data]);
  const info={blurb:`Approved parliamentary bills about ${decoded}.`};

  const filtered = useMemo(() => EVENTS.filter(ev => {
    if (ev.topic !== decoded) return false;
    if (filters.domain !== "All" && ev.domain !== filters.domain) return false;
    if (filters.status !== "All" && ev.status !== filters.status) return false;
    return true;
  }), [EVENTS, decoded, filters]);

  if (!info) return <NotFound t={t} />;

  const chip = (active) => ({
    padding: "4px 11px", borderRadius: 99, fontSize: 12, fontWeight: 500,
    border: `1px solid ${active ? t.primary : t.border}`,
    background: active ? t.primary : "transparent", color: active ? "#fff" : t.textSub,
    cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
  });

  return (
    <div>
      <PageHeader t={t} eyebrow="TOPIC" IconComp={Tag} title={decoded} subtitle={info.blurb}
        right={<FollowButton kind="topic" id={decoded} t={t} onDark />} />
      <LiveError error={error}/><div style={{ background: t.surface, borderBottom: `1px solid ${t.borderLight}`, padding: "0 20px", display: "flex", alignItems: "center", gap: 20, overflowX: "auto", minHeight: 46 }}>
        {[["DOMAIN", DOMAINS, "domain"], ["STATUS", STATUSES, "status"]].map(([label, opts, key]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.7 }}>{label}</span>
            {opts.map(o => (
              <button key={o} style={chip(filters[key] === o)} onClick={() => setFilters(f => ({ ...f, [key]: f[key] === o ? "All" : o }))}>{o}</button>
            ))}
          </div>
        ))}
      </div>
      <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12, color: t.textMuted }}>{loading ? "Loading updates…" : `${filtered.length} update${filtered.length === 1 ? "" : "s"} in ${decoded}`}</div>
        {loading ? (
          <CardSkeletonList count={3} />
        ) : !filtered.length ? (
          <EmptyState t={t} actionLabel="View all topics" onAction={() => navigate("/topics")} />
        ) : filtered.map(ev => <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} />)}
      </div>
      <Footer t={t} />
    </div>
  );
}
