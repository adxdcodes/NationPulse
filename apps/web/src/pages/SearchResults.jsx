import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { EVENTS } from "../data/mockData.js";
import { UniversalCard, EmptyState, Footer, PageHeader } from "../components/UI.jsx";

function scoreEvent(ev, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const terms = q.split(/\s+/).filter(Boolean);
  let score = 0;
  const fields = [
    { text: ev.title.toLowerCase(), weight: 5 },
    { text: ev.topic.toLowerCase(), weight: 3 },
    { text: (ev.ministry || "").toLowerCase(), weight: 3 },
    { text: ev.domain.toLowerCase(), weight: 2 },
    { text: ev.summary.toLowerCase(), weight: 2 },
    { text: ev.why.toLowerCase(), weight: 1 },
  ];
  for (const term of terms) {
    for (const f of fields) {
      if (f.text.includes(term)) score += f.weight;
      if (f.text.startsWith(term)) score += 1;
    }
  }
  if (ev.title.toLowerCase().includes(q)) score += 8;
  return score;
}

export default function SearchResults({ dark, t }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get("q") || "";
  const [draft, setDraft] = useState(query);

  const ranked = useMemo(() => {
    return EVENTS
      .map(ev => ({ ev, score: scoreEvent(ev, query) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query]);

  function submit(e) {
    e.preventDefault();
    setParams(draft.trim() ? { q: draft.trim() } : {});
  }

  return (
    <div>
      <PageHeader t={t} eyebrow="SEARCH" IconComp={SearchIcon}
        title={query ? `Results for "${query}"` : "Search NationPulse"}
        subtitle={query ? `${ranked.length} result${ranked.length === 1 ? "" : "s"} ranked by relevance across titles, topics, ministries and summaries.` : "Search across bills, schemes, judgments and budget items."} />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "22px 20px" }}>
        <form onSubmit={submit} style={{ position: "relative", marginBottom: 20 }}>
          <SearchIcon size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} aria-hidden="true" />
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Search bills, schemes, judgments..."
            style={{ width: "100%", padding: "11px 14px 11px 38px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </form>
        {!query ? (
          <EmptyState t={t} title="Start typing to search" body="Try a bill name, ministry, or topic like 'data protection' or 'budget'." />
        ) : !ranked.length ? (
          <EmptyState t={t} title="No matches" body="Try different keywords, or browse by topic instead." actionLabel="Browse topics" onAction={() => navigate("/topics")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ranked.map(({ ev }) => <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} />)}
          </div>
        )}
      </div>
      <Footer t={t} />
    </div>
  );
}
