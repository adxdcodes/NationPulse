import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search as SearchIcon, X } from "lucide-react";
import { api } from "../api/client.js";
import { useLive, LiveError } from "../api/useLive.jsx";
import { UniversalCard, EmptyState, Footer, PageHeader } from "../components/UI.jsx";
import { CardSkeletonList } from "../components/LoadingUI.jsx";

function scoreEvent(ev, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const terms = q.split(/\s+/).filter(Boolean);
  let score = 0;
  const fields = [
    { text: (ev.title || "").toLowerCase(), weight: 5 },
    { text: (ev.topic || "").toLowerCase(), weight: 3 },
    { text: (ev.ministry || "").toLowerCase(), weight: 3 },
    { text: (ev.domain || "").toLowerCase(), weight: 2 },
    { text: (ev.summary || "").toLowerCase(), weight: 2 },
    { text: (ev.why || "").toLowerCase(), weight: 1 },
  ];
  for (const term of terms) {
    for (const f of fields) {
      if (f.text.includes(term)) score += f.weight;
      if (f.text.startsWith(term)) score += 1;
    }
  }
  if ((ev.title || "").toLowerCase().includes(q)) score += 8;
  return score;
}

export default function SearchResults({ dark, t }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get("q") || "";
  const [draft, setDraft] = useState(query);

  useEffect(() => { setDraft(query); }, [query]);

  const { data, error, loading } = useLive(
    () => query ? api.listBills({ q: query, page_size: 100 }) : Promise.resolve({ items: [] }),
    [query]
  );
  const EVENTS = data?.items || [];
  const ranked = useMemo(() => {
    return EVENTS
      .map(ev => ({ ev, score: scoreEvent(ev, query) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, EVENTS]);

  function submit(e) {
    e.preventDefault();
    setParams(draft.trim() ? { q: draft.trim() } : {});
  }

  return (
    <div>
      <PageHeader
        t={t}
        eyebrow="PLATFORM SEARCH"
        IconComp={SearchIcon}
        title={query ? `Search results for "${query}"` : "Search NationPulse"}
        subtitle={
          query
            ? `${ranked.length} ${ranked.length === 1 ? "result" : "results"} ranked by relevance across bill titles, policy topics, ministries, and summaries.`
            : "Search across all approved parliamentary bills, ministries, and policy summaries."
        }
      />
      <LiveError error={error} />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "26px 20px 44px", width: "100%" }}>
        <form onSubmit={submit} style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <SearchIcon size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} aria-hidden="true" />
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Search bills, ministries, or policy keywords..."
              aria-label="Search bills, ministries, or policy keywords"
              style={{
                width: "100%", padding: "11px 36px 11px 40px",
                borderRadius: 10, border: `1px solid ${t.border}`,
                background: t.surface, color: t.text, fontSize: 14,
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
            {draft && (
              <button
                type="button"
                onClick={() => { setDraft(""); setParams({}); }}
                aria-label="Clear search query"
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: t.textMuted, cursor: "pointer",
                  display: "flex", alignItems: "center",
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="submit"
            style={{
              padding: "0 20px", borderRadius: 10, border: "none",
              background: t.primary, color: "#FFFFFF", fontSize: 13.5,
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Search
          </button>
        </form>

        {loading ? (
          <CardSkeletonList count={3} />
        ) : !query ? (
          <EmptyState
            t={t}
            title="Enter a keyword to search"
            body="Try a bill name, ministry, or topic like 'data protection', 'finance', or 'education'."
          />
        ) : !ranked.length ? (
          <EmptyState
            t={t}
            title={`No matches for "${query}"`}
            body="Try broader keywords, or browse all legislation organized by policy topic."
            actionLabel="Browse policy topics"
            onAction={() => navigate("/topics")}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {ranked.map(({ ev }) => <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} />)}
          </div>
        )}
      </main>
      <Footer t={t} />
    </div>
  );
}
