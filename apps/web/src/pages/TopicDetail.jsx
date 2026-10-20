import { CardSkeletonList } from "../components/LoadingUI.jsx";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { Tag } from "lucide-react";
import { api } from "../api/client.js";
import { useLive, LiveError } from "../api/useLive.jsx";
import { FilterBar, UniversalCard, EmptyState, Footer, PageHeader, FollowButton } from "../components/UI.jsx";
import NotFound from "./ErrorPages.jsx";

const DOMAINS = ["All", "Parliament"];
// Match the normalized statuses serialized by the API and used on the bills feed.
const STATUSES = ["All", "Pending", "Passed", "In Effect"];

export default function TopicDetail({ dark, t }) {
  const { topic } = useParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ domain: "All", topic: "All", status: "All" });

  const decoded = topic || "";
  const { data, error, loading } = useLive(() => api.listBills({ topic: decoded, page_size: 100 }), [decoded]);
  const EVENTS = useMemo(() => data?.items || [], [data]);

  const filtered = useMemo(() => EVENTS.filter(ev => {
    if (filters.domain !== "All" && ev.domain !== filters.domain) return false;
    if (filters.status !== "All" && ev.status !== filters.status) return false;
    return true;
  }), [EVENTS, decoded, filters]);

  if (!decoded) return <NotFound t={t} />;

  return (
    <div>
      <PageHeader
        t={t}
        breadcrumbs={[
          { label: "Topics", to: "/topics" },
          { label: decoded },
        ]}
        IconComp={Tag}
        title={decoded}
        subtitle={`Approved parliamentary bills and legislative updates classified under ${decoded}.`}
        right={<FollowButton kind="topic" id={decoded} t={t} onDark />}
      />
      <FilterBar filters={filters} setFilters={setFilters} t={t} domains={DOMAINS} statuses={STATUSES} />
      <LiveError error={error} />
      <main style={{ width: "100%", maxWidth: 920, margin: "0 auto", padding: "24px 20px 44px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textSub }}>
          {loading ? "Loading updates..." : `${filtered.length} tracked ${filtered.length === 1 ? "bill" : "bills"} in ${decoded}`}
        </div>
        {loading ? (
          <CardSkeletonList count={3} />
        ) : !filtered.length ? (
          <EmptyState
            t={t}
            title={filters.status === "All" ? "No bills found in this topic" : `No ${filters.status} bills in this topic`}
            body={filters.status === "All" ? "There are no approved bills classified under this topic yet." : "Clear the status filter to see all approved bills in this topic."}
            actionLabel={filters.status === "All" ? "Browse all topics" : "Clear status filter"}
            onAction={() => filters.status === "All" ? navigate("/topics") : setFilters(current => ({ ...current, status: "All" }))}
          />
        ) : (
          filtered.map(ev => <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} compact />)
        )}
      </main>
      <Footer t={t} />
    </div>
  );
}
