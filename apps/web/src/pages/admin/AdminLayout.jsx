import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, ListCheck, Radio, Database, GitCompare, LayoutDashboard,
  Clock, CircleCheck, Calendar, Check, X, Edit,
  LogOut, Save, AlertCircle, FileText, Sparkles, Ban,
  RefreshCw, ChevronDown, ChevronRight, PlugZap, ArrowUp, ArrowDown,
  Search, SearchCheck, ExternalLink, ArrowDownWideNarrow, Layers,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { api, ApiError } from "../../api/client.js";
import { FONT_SERIF } from "../../context/ThemeContext.jsx";
import { DomainBadge, StatusBadge } from "../../components/UI.jsx";

const TABS = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "processing", label: "Bills & Processing", Icon: PlugZap },
  { key: "processed", label: "Processed Bills", Icon: SearchCheck },
  { key: "queue", label: "Review queue", Icon: ListCheck },
  { key: "published", label: "Published", Icon: Radio },
  { key: "comparator", label: "Bill comparator", Icon: GitCompare },
];

// ---------- small shared bits ----------

function ConnectionError({ t, message, onRetry }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: t.dangerBg, color: t.danger, padding: "12px 16px", borderRadius: 10, fontSize: 13 }}>
      <AlertCircle size={16} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onRetry} style={{ padding: "5px 12px", background: "none", border: `1px solid ${t.danger}`, color: t.danger, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
        <RefreshCw size={12} />Retry
      </button>
    </div>
  );
}

function StatCard({ label, val, color, Icon, t }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{val}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color, display: "flex", alignItems: "center", gap: 4 }}>
        <Icon size={12} aria-hidden="true" />{label}
      </div>
    </div>
  );
}

const JOB_STATUS_META = {
  queued: { color: "#D97706", bg: "#FFF7ED", label: "Queued" },
  running: { color: "#0369A1", bg: "#E0F2FE", label: "Running" },
  done: { color: "#15803D", bg: "#F0FDF4", label: "Done" },
  failed: { color: "#BE123C", bg: "#FFF1F2", label: "Failed" },
  cancelled: { color: "#64748B", bg: "#F1F5F9", label: "Cancelled" },
};

function JobPill({ status, dark }) {
  const m = JOB_STATUS_META[status] || JOB_STATUS_META.queued;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: m.bg, color: m.color }}>
      {status === "running" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, animation: "np-pulse 1.2s infinite" }} />}
      {m.label.toUpperCase()}
    </span>
  );
}

// Polls `fetchFn` every `intervalMs` while `active` is true. Always does one
// immediate fetch on mount / whenever `deps` change, active or not.
function usePolling(fetchFn, { intervalMs = 2000, active = true, deps = [] }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const savedFetch = useRef(fetchFn);
  savedFetch.current = fetchFn;

  const refresh = useCallback(async () => {
    try {
      const result = await savedFetch.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the API. Is it running?");
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!active) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalMs, refresh, ...deps]);

  return { data, error, refresh };
}

// ---------- Dashboard ----------

function Dashboard({ t, dark, token }) {
  const { data, error, refresh } = usePolling(() => api.adminDashboard(token), { intervalMs: 8000 });

  if (error) return <ConnectionError t={t} message={error} onRetry={refresh} />;
  if (!data) return <p style={{ fontSize: 13, color: t.textMuted }}>Loading…</p>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 22 }}>
        <StatCard label="Pending review" val={data.pendingReview} color="#D97706" Icon={Clock} t={t} />
        <StatCard label="Published" val={data.published} color="#15803D" Icon={CircleCheck} t={t} />
        <StatCard label="Total bills tracked" val={data.totalBills} color={t.primary} Icon={Database} t={t} />
      </div>
      <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, marginBottom: 14 }}>RECENTLY SEEN BY INGESTION</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.recentActivity.map(r => (
            <div key={r.bill_number} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ color: t.text, flex: 1 }}>{r.bill_name}</span>
              <StatusBadge status={r.status} dark={dark} />
              <span style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                <Calendar size={11} />{new Date(r.last_seen_at).toLocaleDateString()}
              </span>
            </div>
          ))}
          {!data.recentActivity.length && <p style={{ fontSize: 13, color: t.textMuted }}>No bills ingested yet — run the ingestion service.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- Bills & Processing (the new feature) ----------

function SortHeader({ label, sortKey, sortBy, sortDir, onSort, t, style }) {
  const active = sortBy === sortKey;
  return (
    <button onClick={() => onSort(sortKey)}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: active ? t.primary : t.textMuted, fontFamily: "inherit", ...style }}>
      {label}
      {active && (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </button>
  );
}

function BillRow({ bill, t, dark, runningJobs, onProcess, onCancel, busy, selected, onToggleSelect, showPriority }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState(null);
  const { token } = useAuth();

  const pdfRunning = runningJobs.find(j => j.bill_id === bill.id && j.job_type === "pdf_extract");
  const aiRunning = runningJobs.find(j => j.bill_id === bill.id && j.job_type === "ai_summarize");

  const docsDone = bill.documents_extracted === bill.document_count && bill.document_count > 0;
  const canProcessPdf = bill.document_count > 0 && !docsDone && !pdfRunning;
  const canProcessAi = docsDone && !["generating", "pending_review", "approved"].includes(bill.ai_status) && !aiRunning;

  async function toggleExpand() {
    setExpanded(e => !e);
    if (!history) {
      try { setHistory(await api.billJobs(token, bill.id)); } catch { setHistory({ jobs: [] }); }
    }
  }

  return (
    <div style={{ borderBottom: `1px solid ${t.borderLight}`, background: selected ? t.accentBg : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 10, flexWrap: "wrap" }}>
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(bill.id)} aria-label={`Select ${bill.bill_name}`}
          style={{ width: 15, height: 15, cursor: "pointer", accentColor: t.primary, flexShrink: 0 }} />
        <button onClick={toggleExpand} aria-label="Expand history"
          style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", display: "flex", padding: 2 }}>
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <StatusBadge status={bill.status} dark={dark} />
        {showPriority && (
          <span title="Processing priority score — higher means more worth processing first"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28, padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 800, flexShrink: 0, background: bill.priority_score === 0 ? t.surface2 : t.accentBg, color: bill.priority_score === 0 ? t.textMuted : t.accentText }}>
            {bill.priority_score}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{bill.bill_name}</div>
          <div style={{ fontSize: 11, color: t.textMuted }}>
            {bill.bill_number}
            {bill.bill_category && <> · {bill.bill_category}</>}
            {bill.ministry_name && <> · {bill.ministry_name}</>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 100, fontSize: 11, color: t.textMuted }}>
          <Calendar size={11} />
          {bill.last_seen_at ? new Date(bill.last_seen_at).toLocaleDateString() : "—"}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 130 }}>
          <FileText size={12} color={t.textMuted} />
          <span style={{ fontSize: 11, color: t.textMuted }}>{bill.documents_extracted}/{bill.document_count} PDFs</span>
          {pdfRunning && <JobPill status="running" dark={dark} />}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 120 }}>
          <Sparkles size={12} color={t.textMuted} />
          {aiRunning ? <JobPill status="running" dark={dark} /> : (
            <span style={{ fontSize: 11, color: t.textMuted }}>{bill.ai_status || "not started"}</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {pdfRunning ? (
            <button onClick={() => onCancel(pdfRunning.id)} disabled={busy}
              style={{ padding: "6px 12px", background: "none", border: "1px solid #BE123C", color: "#BE123C", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
              <Ban size={11} />Stop PDF
            </button>
          ) : (
            <button onClick={() => onProcess(bill.id, "pdf")} disabled={busy || !canProcessPdf}
              style={{ padding: "6px 12px", background: canProcessPdf ? (dark ? "#0C1B3A" : "#EFF6FF") : t.surface2, color: canProcessPdf ? (dark ? "#93C5FD" : "#1D4ED8") : t.textMuted, border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: canProcessPdf ? "pointer" : "default", opacity: canProcessPdf ? 1 : 0.6, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
              <FileText size={11} />{docsDone ? "Extracted" : "Process PDF"}
            </button>
          )}
          {aiRunning ? (
            <button onClick={() => onCancel(aiRunning.id)} disabled={busy}
              style={{ padding: "6px 12px", background: "none", border: "1px solid #BE123C", color: "#BE123C", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
              <Ban size={11} />Stop AI
            </button>
          ) : (
            <button onClick={() => onProcess(bill.id, "ai")} disabled={busy || !canProcessAi}
              style={{ padding: "6px 12px", background: canProcessAi ? "#16A34A" : t.surface2, color: canProcessAi ? "#fff" : t.textMuted, border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: canProcessAi ? "pointer" : "default", opacity: canProcessAi ? 1 : 0.6, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
              <Sparkles size={11} />{["pending_review", "approved"].includes(bill.ai_status) ? "Summarized" : "Generate summary"}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 14px 66px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>
            DOCUMENTS
          </div>
          {!bill.documents?.length ? (
            <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 14 }}>No documents linked to this bill yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {bill.documents.map(doc => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: t.textSub, background: t.surface2, borderRadius: 7, padding: "6px 10px", flexWrap: "wrap" }}>
                  <JobPill status={doc.extractionStatus === "done" ? "done" : doc.extractionStatus === "failed" ? "failed" : "queued"} dark={dark} />
                  <span style={{ fontWeight: 600 }}>{doc.docType}</span>
                  {doc.errorMessage && <span style={{ color: t.danger }}>{doc.errorMessage}</span>}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {doc.sourceUrl && (
                      <a href={doc.sourceUrl} target="_blank" rel="noreferrer"
                        style={{ padding: "3px 9px", background: "none", border: `1px solid ${t.border}`, color: t.textSub, borderRadius: 6, fontSize: 10, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ExternalLink size={10} />Source PDF
                      </a>
                    )}
                    {doc.extractedTextUrl && (
                      <a href={doc.extractedTextUrl} target="_blank" rel="noreferrer"
                        style={{ padding: "3px 9px", background: "none", border: `1px solid ${t.border}`, color: t.textSub, borderRadius: 6, fontSize: 10, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <FileText size={10} />Extracted text
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>
            JOB HISTORY
          </div>
          {!history ? (
            <p style={{ fontSize: 12, color: t.textMuted }}>Loading history…</p>
          ) : !history.jobs.length ? (
            <p style={{ fontSize: 12, color: t.textMuted }}>No processing jobs run for this bill yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.jobs.map(j => (
                <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: t.textSub, background: t.surface2, borderRadius: 7, padding: "6px 10px" }}>
                  <JobPill status={j.status} dark={dark} />
                  <span style={{ fontWeight: 600 }}>{j.job_type === "pdf_extract" ? "PDF extraction" : "AI summarization"}</span>
                  <span style={{ color: t.textMuted }}>{new Date(j.created_at).toLocaleString()}</span>
                  {j.started_at && j.finished_at && (
                    <span style={{ color: t.textMuted }}>
                      ({Math.round((new Date(j.finished_at) - new Date(j.started_at)) / 1000)}s)
                    </span>
                  )}
                  {j.error_message && <span style={{ color: t.danger, marginLeft: "auto" }}>{j.error_message}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;
// New sort column defaults to descending for the date field (most recent
// first is almost always what you want) and ascending for everything else.
const DEFAULT_SORT_DIR = {
  last_seen_at: "desc", introduced_date: "desc", priority: "desc",
  bill_number: "asc", bill_name: "asc", status: "asc",
  bill_category: "asc", bill_type: "asc", ministry_name: "asc",
};

const GROUP_BY_OPTIONS = [
  { value: "", label: "No grouping" },
  { value: "bill_category", label: "Group by category" },
  { value: "bill_type", label: "Group by type" },
  { value: "ministry_name", label: "Group by ministry" },
  { value: "status", label: "Group by status" },
];

const DOCUMENT_FILTERS = [
  { value: "", label: "All bills" },
  { value: "true", label: "Has PDFs (processable)" },
  { value: "false", label: "No PDFs (nothing to process)" },
];

const AI_STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "none", label: "Not yet summarized" },
  { value: "generating", label: "Generating" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

// Debounces a fast-changing value (keystrokes) so the API isn't hit on
// every character — waits `delay` ms of silence before updating.
function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Backs both "Bills & Processing" (mode="all": every ingested bill, the
// primary control surface) and "Processed Bills" (mode="processed": only
// bills that have been through at least one processing stage, with an
// extra status filter) — same table, same search, same bulk controls,
// differing only in the fixed `processed_only` filter and whether the
// status dropdown is shown.
function BillManager({ t, dark, mode }) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("last_seen_at");
  const [sortDir, setSortDir] = useState("desc");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [docFilter, setDocFilter] = useState("");
  const search = useDebounced(searchInput);
  // Selection is deliberately scoped to bills currently loaded on screen —
  // it's cleared on page/sort/search change rather than tracked across
  // pages you haven't seen, so "12 selected" always means 12 specific
  // bills you actually looked at, not an assumption about rows you never loaded.
  const [selectedIds, setSelectedIds] = useState(new Set());

  const queryParams = {
    page, page_size: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir,
    q: search || undefined,
    group_by: groupBy || undefined,
    // "" means no filter; "true"/"false" are strings from the <select>, so
    // they're sent as-is — FastAPI coerces them to real booleans.
    has_documents: docFilter || undefined,
    ai_status: mode === "processed" && statusFilter ? statusFilter : undefined,
    processed_only: mode === "processed" ? true : undefined,
  };

  const { data: entities, error: entitiesError, refresh: refreshEntities } =
    usePolling(() => api.adminEntities(token, queryParams),
      { intervalMs: 4000, deps: [page, sortBy, sortDir, search, statusFilter, groupBy, docFilter, mode] });
  const { data: jobsData, refresh: refreshJobs } =
    usePolling(() => api.listJobs(token, "running"), { intervalMs: 1500 });

  // Search/filter changes should snap back to page 1 — otherwise "page 3"
  // of an old, wider result set silently shows page 3 of a narrower one.
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, statusFilter, groupBy, docFilter, mode]);

  const runningJobs = jobsData?.items || [];
  const items = entities?.items || [];
  const totalPages = entities ? Math.max(1, Math.ceil(entities.total / PAGE_SIZE)) : 1;

  function handleSort(key) {
    setPage(1);
    setSelectedIds(new Set());
    if (sortBy === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir(DEFAULT_SORT_DIR[key] || "asc"); }
  }

  function changePage(next) {
    setPage(next);
    setSelectedIds(new Set());
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(prev => (prev.size === items.length ? new Set() : new Set(items.map(b => b.id))));
  }

  async function handleProcess(billId, stage) {
    setBusy(true); setActionError("");
    try {
      await (stage === "pdf" ? api.processPdf(token, billId) : api.processAi(token, billId));
      await Promise.all([refreshEntities(), refreshJobs()]);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to start processing.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(jobId) {
    setBusy(true); setActionError("");
    try {
      await api.cancelJob(token, jobId);
      await Promise.all([refreshEntities(), refreshJobs()]);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to cancel job.");
    } finally {
      setBusy(false);
    }
  }

  // Fires requests one at a time rather than Promise.all — selecting 20
  // bills shouldn't spawn 20 subprocesses in the same instant. Bills that
  // aren't actually eligible for this stage (already done, already
  // running) are silently skipped, same eligibility rule the per-row
  // buttons use, and counted separately so the summary is honest about
  // what actually happened.
  async function handleBulkProcess(stage) {
    const targets = items.filter(b => selectedIds.has(b.id));
    setBusy(true); setActionError(""); setBulkStatus(`Starting 0 of ${targets.length}…`);
    let started = 0, skipped = 0, failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const bill = targets[i];
      setBulkStatus(`Starting ${i + 1} of ${targets.length}…`);
      const docsDone = bill.documents_extracted === bill.document_count && bill.document_count > 0;
      const eligible = stage === "pdf"
        ? bill.document_count > 0 && !docsDone
        : docsDone && !["generating", "pending_review", "approved"].includes(bill.ai_status);
      if (!eligible) { skipped++; continue; }
      try {
        await (stage === "pdf" ? api.processPdf(token, bill.id) : api.processAi(token, bill.id));
        started++;
      } catch {
        failed++;
      }
    }

    setBulkStatus(`Started ${started}, skipped ${skipped} (not eligible), ${failed} failed to start.`);
    setSelectedIds(new Set());
    await Promise.all([refreshEntities(), refreshJobs()]);
    setBusy(false);
    setTimeout(() => setBulkStatus(""), 6000);
  }

  if (entitiesError) return <ConnectionError t={t} message={entitiesError} onRetry={refreshEntities} />;

  const allOnPageSelected = items.length > 0 && selectedIds.size === items.length;
  const selectStyle = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 12.5, fontFamily: "inherit" };

  return (
    <div>
      <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 16px 0" }}>
        {mode === "processed"
          ? "Bills that have been through at least one processing stage — search or filter to find and re-manage any of them."
          : "Ingestion only stores bill metadata — nothing is extracted or summarized until you trigger it here. Processing runs as a real, cancellable background job per bill."}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by bill name or number..."
            style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        {mode === "processed" && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            {AI_STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        )}
        <select value={docFilter} onChange={e => setDocFilter(e.target.value)} style={selectStyle}>
          {DOCUMENT_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={selectStyle}>
          {GROUP_BY_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button
          onClick={() => { setSortBy("priority"); setSortDir("desc"); setPage(1); setSelectedIds(new Set()); }}
          title="Rank by how worth processing each bill is: weightier categories (Constitution Amendment, Money Bill) and further-along statuses first, and bills with no PDFs attached pushed to the bottom since there's nothing to process."
          style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${sortBy === "priority" ? t.primary : t.border}`, background: sortBy === "priority" ? t.primary : "transparent", color: sortBy === "priority" ? "#fff" : t.textSub }}>
          <ArrowDownWideNarrow size={13} />Priority
        </button>
      </div>

      {actionError && (
        <div style={{ marginBottom: 14 }}><ConnectionError t={t} message={actionError} onRetry={() => setActionError("")} /></div>
      )}

      {runningJobs.length > 0 && (
        <div style={{ background: t.accentBg, border: "1px solid rgba(14,165,233,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.accentText, letterSpacing: 0.5, marginBottom: 8 }}>
            RUNNING NOW ({runningJobs.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {runningJobs.map(j => (
              <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <JobPill status={j.status} dark={dark} />
                <span style={{ color: t.text, fontWeight: 600 }}>{j.bill_name}</span>
                <span style={{ color: t.textMuted }}>{j.job_type === "pdf_extract" ? "extracting PDFs" : "generating AI summary"}</span>
                <button onClick={() => handleCancel(j.id)} disabled={busy}
                  style={{ marginLeft: "auto", padding: "3px 10px", background: "none", border: "1px solid #BE123C", color: "#BE123C", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  STOP
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: dark ? "#0C1B3A" : "#EFF6FF", border: `1px solid ${t.primary}`, borderRadius: 10, padding: "10px 16px", marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: t.primary }}>{selectedIds.size} selected</span>
          <button onClick={() => handleBulkProcess("pdf")} disabled={busy}
            style={{ padding: "6px 14px", background: t.primary, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
            <FileText size={12} />Process PDF for selected
          </button>
          <button onClick={() => handleBulkProcess("ai")} disabled={busy}
            style={{ padding: "6px 14px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
            <Sparkles size={12} />Generate summaries for selected
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            style={{ padding: "6px 12px", background: "none", color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Clear
          </button>
          {bulkStatus && <span style={{ fontSize: 11.5, color: t.textSub, marginLeft: "auto" }}>{bulkStatus}</span>}
        </div>
      )}

      <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${t.borderLight}`, gap: 10, flexWrap: "wrap" }}>
          <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} aria-label="Select all on this page"
            style={{ width: 15, height: 15, cursor: "pointer", accentColor: t.primary, flexShrink: 0 }} />
          <span style={{ width: 15 }} />
          <SortHeader label="Bill" sortKey="bill_name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} t={t} style={{ flex: 1, minWidth: 200 }} />
          <SortHeader label="Date" sortKey="last_seen_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} t={t} style={{ minWidth: 100 }} />
          <span style={{ minWidth: 130, fontSize: 11, fontWeight: 700, color: t.textMuted }}>PDF status</span>
          <span style={{ minWidth: 120, fontSize: 11, fontWeight: 700, color: t.textMuted }}>AI status</span>
          <span style={{ minWidth: 210 }} />
        </div>
        {!entities ? (
          <p style={{ fontSize: 13, color: t.textMuted, padding: 16 }}>Loading…</p>
        ) : !items.length ? (
          <p style={{ fontSize: 13, color: t.textMuted, padding: 16 }}>
            {search || statusFilter || docFilter ? "No bills match your search or filter." : "No bills yet — run the ingestion service."}
          </p>
        ) : (
          // With grouping on, the API returns rows already sorted by the
          // group column, so a header just needs rendering wherever that
          // value changes between consecutive rows. Note headers only
          // delimit groups *within the current page* — a group spanning a
          // page boundary correctly shows its header again on the next
          // page rather than looking like a new group.
          items.map((bill, idx) => {
            const showGroupHeader = groupBy && (idx === 0 || items[idx - 1][groupBy] !== bill[groupBy]);
            return (
              <div key={bill.id}>
                {showGroupHeader && (
                  <div style={{ padding: "8px 16px", background: t.surface2, borderBottom: `1px solid ${t.borderLight}`, fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 6 }}>
                    <Layers size={12} color={t.textMuted} />
                    {bill[groupBy] || "(none)"}
                  </div>
                )}
                <BillRow bill={bill} t={t} dark={dark} runningJobs={runningJobs}
                  onProcess={handleProcess} onCancel={handleCancel} busy={busy}
                  selected={selectedIds.has(bill.id)} onToggleSelect={toggleSelect}
                  showPriority={sortBy === "priority"} />
              </div>
            );
          })
        )}
        {entities && entities.total > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${t.borderLight}` }}>
            <span style={{ fontSize: 11.5, color: t.textMuted }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, entities.total)} of {entities.total}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => changePage(page - 1)} disabled={page <= 1}
                style={{ padding: "5px 12px", background: "none", border: `1px solid ${t.border}`, color: page <= 1 ? t.textMuted : t.text, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.5 : 1, fontFamily: "inherit" }}>
                Previous
              </button>
              <span style={{ fontSize: 12, color: t.textMuted, padding: "5px 8px" }}>Page {page} of {totalPages}</span>
              <button onClick={() => changePage(page + 1)} disabled={page >= totalPages}
                style={{ padding: "5px 12px", background: "none", border: `1px solid ${t.border}`, color: page >= totalPages ? t.textMuted : t.text, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.5 : 1, fontFamily: "inherit" }}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BillsProcessing({ t, dark }) {
  return <BillManager t={t} dark={dark} mode="all" />;
}

function ProcessedBills({ t, dark }) {
  return <BillManager t={t} dark={dark} mode="processed" />;
}

// ---------- Review Queue ----------

function Queue({ t, dark, token }) {
  const { data, error, refresh } = usePolling(() => api.adminQueue(token), { intervalMs: 6000 });
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function act(fn, contentId) {
    setBusyId(contentId);
    try { await fn(); await refresh(); } catch { /* surfaced via refresh's error state on next poll */ }
    setBusyId(null);
  }

  function startEdit(item) {
    setEditingId(item.content_id);
    setDraft({ plain_title: item.plain_title || "", summary: item.summary || "", why_it_matters: item.why_it_matters || "", topic: item.topic || "" });
  }

  async function saveEdit(contentId) {
    setBusyId(contentId);
    try { await api.editContent(token, contentId, draft); setEditingId(null); await refresh(); }
    catch { /* noop, stays open so they can retry */ }
    setBusyId(null);
  }

  if (error) return <ConnectionError t={t} message={error} onRetry={refresh} />;
  if (!data) return <p style={{ fontSize: 13, color: t.textMuted }}>Loading…</p>;
  if (!data.items.length) return <p style={{ fontSize: 13, color: t.textMuted }}>Nothing waiting for review.</p>;

  return data.items.map(item => (
    <div key={item.content_id} style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 12, overflow: "hidden", marginBottom: 12, boxShadow: t.shadow }}>
      <div style={{ padding: "13px 16px", borderBottom: `1px solid ${t.borderLight}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <StatusBadge status={item.status} dark={dark} />
        <span style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{item.plain_title || item.bill_name}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>{item.provider}/{item.model_version}</span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        {editingId === item.content_id ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <input value={draft.plain_title} onChange={e => setDraft(d => ({ ...d, plain_title: e.target.value }))} placeholder="Title"
              style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, fontFamily: "inherit" }} />
            <textarea value={draft.summary} onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))} placeholder="Summary" rows={2}
              style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
            <textarea value={draft.why_it_matters} onChange={e => setDraft(d => ({ ...d, why_it_matters: e.target.value }))} placeholder="Why it matters" rows={2}
              style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
            <input value={draft.topic} onChange={e => setDraft(d => ({ ...d, topic: e.target.value }))} placeholder="Topic"
              style={{ padding: "8px 10px", borderRadius: 7, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, fontFamily: "inherit" }} />
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 8px 0", fontSize: 13, color: t.textSub, lineHeight: 1.6 }}><strong style={{ color: t.text }}>Summary:</strong> {item.summary}</p>
            <p style={{ margin: "0 0 14px 0", fontSize: 13, color: t.textSub, lineHeight: 1.6 }}><strong style={{ color: t.text }}>Why it matters:</strong> {item.why_it_matters}</p>
          </>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {editingId === item.content_id ? (
            <>
              <button onClick={() => saveEdit(item.content_id)} disabled={busyId === item.content_id}
                style={{ padding: "7px 16px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                <Save size={13} />Save
              </button>
              <button onClick={() => setEditingId(null)}
                style={{ padding: "7px 16px", background: "none", color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => act(() => api.approveContent(token, item.content_id), item.content_id)} disabled={busyId === item.content_id}
                style={{ padding: "7px 16px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                <Check size={13} />Approve and publish
              </button>
              <button onClick={() => startEdit(item)}
                style={{ padding: "7px 16px", background: "none", color: t.primary, border: `1px solid ${t.primary}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                <Edit size={13} />Edit
              </button>
              <button onClick={() => act(() => api.rejectContent(token, item.content_id), item.content_id)} disabled={busyId === item.content_id}
                style={{ padding: "7px 16px", background: "none", color: "#BE123C", border: "1px solid #BE123C", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                <X size={13} />Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  ));
}

// ---------- Published (read-only; simplified from the old mock's Feed Manager) ----------

function Published({ t, dark, token }) {
  const { data, error, refresh } = usePolling(() => api.adminEntities(token, { page_size: 200 }), { intervalMs: 8000 });
  if (error) return <ConnectionError t={t} message={error} onRetry={refresh} />;
  const published = (data?.items || []).filter(b => b.ai_status === "approved");

  return (
    <div>
      <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 16px 0" }}>
        Bills currently visible on the public site. Unpublishing isn't wired up yet — see the API README for what
        that endpoint would need.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {published.map(bill => (
          <div key={bill.id} style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 10, padding: "14px 16px" }}>
            <StatusBadge status={bill.status} dark={dark} />
            <p style={{ margin: "10px 0 0 0", fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.4 }}>{bill.bill_name}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: 11, color: t.textMuted }}>{bill.bill_number}</p>
          </div>
        ))}
        {!published.length && <p style={{ fontSize: 13, color: t.textMuted }}>Nothing published yet — approve something in the Review queue.</p>}
      </div>
    </div>
  );
}

// ---------- Comparator (simplified: title/status/summary/key changes) ----------

function Comparator({ t, dark, token }) {
  const { data: entities } = usePolling(() => api.adminEntities(token, { page_size: 200 }), { intervalMs: 15000 });
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [leftBill, setLeftBill] = useState(null);
  const [rightBill, setRightBill] = useState(null);

  useEffect(() => { if (leftId) api.getBill(leftId).then(setLeftBill).catch(() => setLeftBill(null)); else setLeftBill(null); }, [leftId]);
  useEffect(() => { if (rightId) api.getBill(rightId).then(setRightBill).catch(() => setRightBill(null)); else setRightBill(null); }, [rightId]);

  const selectStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, fontFamily: "inherit" };

  function Column({ bill }) {
    if (!bill) return <div style={{ fontSize: 13, color: t.textMuted }}>Select a published bill.</div>;
    return (
      <div>
        <StatusBadge status={bill.status} dark={dark} />
        <h3 style={{ margin: "8px 0", fontFamily: FONT_SERIF, fontSize: 15, fontWeight: 700, color: t.text }}>{bill.title}</h3>
        <p style={{ fontSize: 12.5, color: t.textSub, lineHeight: 1.6, marginBottom: 12 }}>{bill.summary}</p>
        {bill.changes?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bill.changes.map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: t.textSub, background: t.surface2, borderRadius: 7, padding: "8px 10px", lineHeight: 1.5 }}>{c.after}</div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: t.textMuted }}>No amendment changes recorded for this bill.</div>}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 16px 0" }}>Compare two tracked bills' published summaries side by side.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[[leftId, setLeftId, leftBill], [rightId, setRightId, rightBill]].map(([val, setVal, bill], i) => (
          <div key={i} style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 16, boxShadow: t.shadow }}>
            <select value={val} onChange={e => setVal(e.target.value)} style={{ ...selectStyle, marginBottom: 16 }}>
              <option value="">Select a bill...</option>
              {(entities?.items || []).map(b => <option key={b.id} value={b.id}>{b.bill_name}</option>)}
            </select>
            <Column bill={bill} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Layout ----------

export default function AdminLayout({ dark, t }) {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [tab, setTab] = useState("processing");

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>
      <style>{`@keyframes np-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
      <aside style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${t.borderLight}`, background: t.surface, padding: "20px 12px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 4 }}>
          <Shield size={18} color={t.primary} aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Moderator</span>
        </div>
        <div style={{ padding: "0 8px", marginBottom: 16, fontSize: 11, color: t.textMuted }}>{user?.email}</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 8, border: "none", background: tab === key ? (dark ? "#0C1B3A" : "#EFF6FF") : "none", color: tab === key ? t.primary : t.textSub, fontSize: 13, fontWeight: tab === key ? 700 : 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <Icon size={15} aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 8, border: `1px solid ${t.borderLight}`, background: "none", color: t.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <LogOut size={13} aria-hidden="true" />Sign out
        </button>
      </aside>
      <main style={{ flex: 1, padding: "24px 24px", minWidth: 0 }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: "0 0 4px 0" }}>{TABS.find(x => x.key === tab)?.label}</h1>
          <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>
            {tab === "dashboard" && "Overview of tracked government activity and moderation load."}
            {tab === "processing" && "Pick which bills get extracted and summarized — nothing runs automatically."}
            {tab === "processed" && "Search and filter bills that have already been through processing."}
            {tab === "queue" && "Review AI-drafted cards before they go public."}
            {tab === "published" && "What's currently live on the public site."}
            {tab === "comparator" && "Compare two published bills side by side."}
          </p>
        </div>
        {tab === "dashboard" && <Dashboard t={t} dark={dark} token={token} />}
        {tab === "processing" && <BillsProcessing t={t} dark={dark} />}
        {tab === "processed" && <ProcessedBills t={t} dark={dark} />}
        {tab === "queue" && <Queue t={t} dark={dark} token={token} />}
        {tab === "published" && <Published t={t} dark={dark} token={token} />}
        {tab === "comparator" && <Comparator t={t} dark={dark} token={token} />}
      </main>
    </div>
  );
}
