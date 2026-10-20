import { useSearchParams, Link } from "react-router-dom";
import PublishedBillModal from "../components/PublishedBillModal.jsx";
import { CardSkeletonList } from "../components/LoadingUI.jsx";
import { useState, useMemo, useEffect } from "react";
import { Landmark, Search, X, Newspaper, Users, Tag } from "lucide-react";
import FeedChatbot from "../components/FeedChatbot.jsx";
import { api } from "../api/client.js";
import { useLive, LiveError } from "../api/useLive.jsx";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import {
  FilterBar,
  UniversalCard,
  EmptyState,
  Footer,
} from "../components/UI.jsx";

const DOMAINS = ["All", "Parliament"];
const STATUSES = ["All", "Pending", "Passed", "In Effect"];

export default function Home({ dark, t }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const previewId = searchParams.get("bill");
  const closePreview = () =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("bill");
        return next;
      },
      { replace: true },
    );

  const [filters, setFilters] = useState({
    domain: "All",
    topic: "All",
    status: "All",
  });
  const [quickQuery, setQuickQuery] = useState("");
  const [deferredQuery, setDeferredQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [loadedBills, setLoadedBills] = useState([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredQuery(quickQuery), 130);
    return () => window.clearTimeout(timer);
  }, [quickQuery]);

  const { data, loading, error, retry } = useLive(
    () =>
      Promise.all([
        api.listBills({ page: 1, page_size: 100, ...filters }),
        api.listTopics(),
      ]),
    [filters.domain, filters.topic, filters.status],
  );

  useEffect(() => {
    setLoadedBills(data?.[0]?.items || []);
    setPage(1);
    setVisibleCount(20);
  }, [data]);

  const EVENTS = useMemo(() => loadedBills, [loadedBills]);
  const TOPICS = useMemo(
    () => ["All", ...(data?.[1]?.items || []).map((x) => x.name)],
    [data],
  );

  const filtered = useMemo(
    () =>
      EVENTS.filter((ev) => {
        if (filters.domain !== "All" && ev.domain !== filters.domain)
          return false;
        if (filters.topic !== "All" && ev.topic !== filters.topic) return false;
        if (filters.status !== "All" && ev.status !== filters.status)
          return false;
        if (deferredQuery.trim()) {
          const q = deferredQuery.trim().toLowerCase();
          const hay =
            `${ev.title || ""} ${ev.summary || ""} ${ev.why || ""} ${ev.topic || ""} ${ev.ministry || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [EVENTS, filters, deferredQuery],
  );
  const visibleBills = filtered.slice(0, visibleCount);

  async function loadMoreBills() {
    if (loadingMore || loadedBills.length >= (data?.[0]?.total || 0)) return;
    setLoadingMore(true);
    setLoadMoreError("");
    try {
      const nextPage = page + 1;
      const result = await api.listBills({
        page: nextPage,
        page_size: 100,
        ...filters,
      });
      setLoadedBills((current) => {
        const knownIds = new Set(current.map((bill) => String(bill.id)));
        return [
          ...current,
          ...(result.items || []).filter(
            (bill) => !knownIds.has(String(bill.id)),
          ),
        ];
      });
      setPage(nextPage);
      setVisibleCount((count) => count + 20);
    } catch (err) {
      setLoadMoreError(
        err.message || "Unable to load more bills. Please try again.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="np-feed-page">
      {/* Clean Hero Banner with Quick Navigation Shortcuts */}
      <div
        className="np-feed-hero"
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          borderBottom: `1px solid ${t.topbarBorder}`,
          padding: "18px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                color: "#38BDF8",
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Landmark size={13} aria-hidden="true" />
              LEGISLATIVE TRACKER
            </div>
            <h1
              style={{
                margin: 0,
                color: "#FFFFFF",
                fontFamily: FONT_SERIF,
                fontSize: "clamp(23px, 2.8vw, 30px)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Your Parliament, clearly explained
            </h1>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Link
              to="/topics"
              style={{
                padding: "8px 13px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "#F8FAFC",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Tag size={13} color="#38BDF8" />
              {Math.max(0, TOPICS.length - 1)} Topics
            </Link>
            <Link
              to="/digest"
              style={{
                padding: "8px 13px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "#F8FAFC",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Newspaper size={13} color="#38BDF8" />
              Weekly Digest
            </Link>
            <Link
              to="/mps"
              style={{
                padding: "8px 13px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "#F8FAFC",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Users size={13} color="#38BDF8" />
              MP Directory
            </Link>
          </div>
        </div>
      </div>

      {/* Structured Filter Control Bar */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        t={t}
        domains={DOMAINS}
        topics={TOPICS}
        statuses={STATUSES}
      />

      <LiveError error={error} onRetry={retry} />

      {/* Feed Content Container */}
      <main
        className="np-feed-main"
        style={{
          width: "100%",
          maxWidth: 920,
          margin: "0 auto",
          padding: "24px 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Feed Status & Quick Inline Filter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 4,
          }}
        >
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{ fontSize: 13, fontWeight: 600, color: t.textSub }}
          >
            {loading ? (
              "Loading parliamentary updates..."
            ) : (
              <>
                Showing{" "}
                <strong style={{ color: t.text }}>{visibleBills.length}</strong>{" "}
                of <strong style={{ color: t.text }}>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? "bill" : "bills"}
                {filters.topic !== "All" && (
                  <>
                    {" "}
                    in{" "}
                    <strong style={{ color: t.primary }}>
                      {filters.topic}
                    </strong>
                  </>
                )}
                {filters.status !== "All" && (
                  <>
                    {" "}
                    · Status:{" "}
                    <strong style={{ color: t.primary }}>
                      {filters.status}
                    </strong>
                  </>
                )}
              </>
            )}
          </div>

          {!loading && (
            <div
              style={{ position: "relative", minWidth: 260, flex: "0 1 360px" }}
            >
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 11,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: t.textMuted,
                }}
                aria-hidden="true"
              />
              <input
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Filter current feed..."
                aria-label="Filter current feed"
                style={{
                  width: "100%",
                  minHeight: 32,
                  padding: "7px 32px 7px 36px",
                  borderRadius: 10,
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  color: t.text,
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              {quickQuery && (
                <button
                  type="button"
                  onClick={() => setQuickQuery("")}
                  aria-label="Clear filter text"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: t.textMuted,
                    padding: 2,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bill List */}
        {loading ? (
          <CardSkeletonList count={6} compact />
        ) : !filtered.length ? (
          <EmptyState
            t={t}
            title="No matching parliamentary updates"
            body="Try clearing your active topic, status, or keyword filters to view all tracked bills."
            actionLabel="Reset all filters"
            onAction={() => {
              setFilters({ domain: "All", topic: "All", status: "All" });
              setQuickQuery("");
            }}
          />
        ) : (
          <div
            key={deferredQuery}
            className="np-bill-results"
            aria-busy={deferredQuery !== quickQuery}
          >
            {visibleBills.map((ev) => (
              <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} compact />
            ))}
          </div>
        )}
        {!loading && visibleBills.length < filtered.length && (
          <>
            <div className="np-load-status" aria-live="polite">
              {visibleBills.length} of {filtered.length} bills shown
            </div>
            <button
              className="np-load-more"
              type="button"
              onClick={() =>
                setVisibleCount((n) => Math.min(n + 20, filtered.length))
              }
            >
              Load 20 more bills
            </button>
          </>
        )}
        {!loading &&
          visibleBills.length === filtered.length &&
          loadedBills.length < (data?.[0]?.total || 0) && (
            <button
              className="np-load-more"
              type="button"
              onClick={loadMoreBills}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading bills…" : "Load more bills"}
            </button>
          )}
        {loadMoreError && (
          <div role="alert" className="np-load-more-error">
            {loadMoreError}{" "}
            <button type="button" onClick={loadMoreBills}>
              Retry
            </button>
          </div>
        )}
      </main>

      <Footer t={t} />
      <FeedChatbot dark={dark} />
      <PublishedBillModal
        id={previewId}
        onClose={closePreview}
        t={t}
        dark={dark}
      />
    </div>
  );
}
