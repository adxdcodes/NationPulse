import { DetailSkeleton } from "../components/LoadingUI.jsx";
import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client.js";
import { useLive, LiveError } from "../api/useLive.jsx";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Tag,
  Building,
  FileText,
  User,
  BarChart2,
  Route,
  GitCompare,
  Database,
  ExternalLink,
  Users,
  ArrowLeftRight,
  ShieldCheck,
  Share2,
  Check,
} from "lucide-react";

import { FONT_SERIF } from "../context/ThemeContext.jsx";
import {
  DomainBadge,
  StatusBadge,
  BillStepper,
  BudgetBar,
  DiffTable,
  Section,
  Footer,
  FollowButton,
} from "../components/UI.jsx";
import CommentSection from "../components/Comments.jsx";
import BillEngagement from "../components/BillEngagement.jsx";
import OfficialSourcesModal from "../components/OfficialSourcesModal.jsx";
import FeedChatbot from "../components/FeedChatbot.jsx";
import NotFound from "./ErrorPages.jsx";

export default function EventDetail({ dark, t }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [shareState, setShareState] = useState("");
  const [askAiOpen, setAskAiOpen] = useState(false);
  const closeSources = useCallback(() => setSourcesOpen(false), []);
  const { data: ev, error, loading } = useLive(() => api.getBill(id), [id]);
  const { data: relatedData } = useLive(
    () =>
      ev?.topic
        ? api.listBills({ topic: ev.topic, page_size: 4 })
        : Promise.resolve({ items: [] }),
    [ev?.topic],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);
  useEffect(() => {
    if (!ev?.title) return;
    document.title = `${ev.title} | NationPulse`;
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = (
      ev.summary ||
      `Plain-language explanation and official sources for ${ev.title}.`
    ).slice(0, 155);
  }, [ev]);

  if (loading) return <DetailSkeleton />;
  if (error) return <LiveError error={error} />;
  if (!ev) return <NotFound t={t} />;

  const sponsorMPs = ev.sponsors || [];
  const relatedBills = (relatedData?.items || [])
    .filter((bill) => String(bill.id) !== String(ev.id))
    .slice(0, 3);

  async function shareBill() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: ev.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareState("Link copied");
        window.setTimeout(() => setShareState(""), 2200);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        setShareState("Could not share");
        window.setTimeout(() => setShareState(""), 2200);
      }
    }
  }

  return (
    <div>
      {/* Bill Detail Top Header Banner */}
      <div
        className="np-detail-hero"
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          borderBottom: `1px solid ${t.topbarBorder}`,
          padding: "24px 20px 28px",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <nav className="np-breadcrumb" aria-label="Breadcrumb">
            <Link to="/bills">Bills</Link>
            <span aria-hidden="true">›</span>
            {ev.topic && (
              <>
                <Link to={`/topics/${encodeURIComponent(ev.topic)}`}>
                  {ev.topic}
                </Link>
                <span aria-hidden="true">›</span>
              </>
            )}
            <span>
              {ev.billNumber ? `Bill No. ${ev.billNumber}` : "Bill details"}
            </span>
          </nav>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              className="np-detail-action"
              onClick={() => navigate(-1)}
              type="button"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to feed
            </button>

            <div className="np-detail-actions">
              <button
                className="np-detail-action"
                type="button"
                onClick={shareBill}
                aria-label="Share this bill"
              >
                {shareState === "Link copied" ? (
                  <Check size={14} />
                ) : (
                  <Share2 size={14} />
                )}
                {shareState || "Share"}
              </button>
              <button
                className="np-detail-action"
                type="button"
                onClick={() => setAskAiOpen(true)}
              >
                Ask Pulse AI
              </button>
              <button
                className="np-detail-action"
                type="button"
                onClick={() => setSourcesOpen(true)}
              >
                <Database size={14} />
                Official Sources
                <ExternalLink size={13} />
              </button>
              <FollowButton
                kind="event"
                id={ev.id}
                t={t}
                onDark
                className="np-detail-action"
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <DomainBadge domain={ev.domain} />
            <StatusBadge status={ev.status} />
            {ev.house && <span className="np-house-badge">{ev.house}</span>}
            {ev.amend && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: "#2E1065",
                  color: "#D8B4FE",
                  border: "1px solid #581C87",
                }}
              >
                <ArrowLeftRight size={11} />
                Amends {ev.prevLaw}
              </span>
            )}
          </div>

          <h1
            style={{
              margin: "0 0 12px 0",
              fontFamily: FONT_SERIF,
              fontSize: "clamp(22px, 3vw, 29px)",
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.3,
              letterSpacing: "-0.015em",
            }}
          >
            {ev.title}
          </h1>

          {ev.officialTitle && (
            <p className="np-official-title">
              Official title: {ev.officialTitle}
            </p>
          )}

          <div
            style={{
              fontSize: 12.5,
              color: "#CBD5E1",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {ev.date && (
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <Calendar size={13} color="#38BDF8" />
                {ev.date}
              </span>
            )}
            {ev.topic && (
              <>
                <span>·</span>
                <Link
                  to={`/topics/${encodeURIComponent(ev.topic)}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    color: "#7DD3FC",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  <Tag size={13} />
                  {ev.topic}
                </Link>
              </>
            )}
            {ev.ministry && (
              <>
                <span>·</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Building size={13} color="#94A3B8" />
                  {ev.ministry}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <main
        className="np-detail-layout"
        style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 44px" }}
      >
        <div className="np-detail-content">
          <BillEngagement billId={ev.id} commentCount={ev.commentCount || 0} />
          <Section IconComp={FileText} label="WHAT HAPPENED" t={t}>
            <p
              style={{
                margin: 0,
                fontSize: 14.5,
                color: t.textSub,
                lineHeight: 1.78,
                whiteSpace: "pre-line",
              }}
            >
              {ev.summary}
            </p>
          </Section>

          {ev.why && (
            <div
              style={{
                background: t.accentBg,
                borderRadius: 14,
                padding: "20px 22px",
                border: `1px solid ${t.border}`,
                borderLeft: `4px solid ${t.accent}`,
                marginBottom: 16,
                boxShadow: t.shadow,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: t.accentText,
                  letterSpacing: 0.8,
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <User size={14} aria-hidden="true" />
                WHY IT MATTERS TO CITIZENS
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14.5,
                  color: t.text,
                  lineHeight: 1.75,
                }}
              >
                {ev.why}
              </p>
            </div>
          )}

          {ev.allocation && (
            <Section IconComp={BarChart2} label="BUDGET UTILISATION" t={t}>
              <BudgetBar
                allocation={ev.allocation}
                utilised={ev.utilised}
                dark={dark}
                t={t}
              />
            </Section>
          )}

          {ev.stages?.length > 0 && (
            <Section IconComp={Route} label="LEGISLATIVE JOURNEY" t={t}>
              <BillStepper
                stages={ev.stages}
                stage={ev.stage}
                dark={dark}
                t={t}
              />
            </Section>
          )}

          {ev.amend && ev.changes && (
            <Section
              IconComp={GitCompare}
              label={`KEY CHANGES FROM ${ev.prevLaw?.toUpperCase() || "PREVIOUS LAW"}`}
              t={t}
            >
              <DiffTable changes={ev.changes} t={t} />
            </Section>
          )}

          {sponsorMPs.length > 0 && (
            <Section IconComp={Users} label="SPONSORED / LED BY" t={t}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                {sponsorMPs.map((mp) => (
                  <Link
                    key={mp.id}
                    to={`/mps/${mp.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: t.surface2,
                      border: `1px solid ${t.borderLight}`,
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: t.primary,
                        color: "#FFFFFF",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {mp.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: t.text,
                        }}
                      >
                        {mp.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: t.textMuted }}>
                        {mp.party} · {mp.constituency}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          <Section IconComp={ShieldCheck} label="ABOUT THIS SUMMARY" t={t}>
            {ev.confidenceNotes && (
              <p
                style={{
                  margin: "0 0 10px",
                  color: t.textSub,
                  lineHeight: 1.65,
                }}
              >
                {ev.confidenceNotes}
              </p>
            )}
            <p style={{ margin: 0, color: t.textSub, lineHeight: 1.65 }}>
              This summary is AI-generated and editor-reviewed. Check the
              official parliamentary documents to verify the details.
            </p>
          </Section>

          <CommentSection scope={`event:${ev.id}`} t={t} dark={dark} />

          <div
            style={{
              marginTop: 18,
              padding: "14px 18px",
              borderRadius: 12,
              background: t.surface,
              border: `1px solid ${t.borderLight}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 12.5,
                color: t.textMuted,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Database size={14} color={t.primary} />
              Verified against official parliamentary gazette and legislative
              records
            </div>
            <button
              type="button"
              onClick={() => setSourcesOpen(true)}
              style={{
                color: t.primary,
                fontWeight: 600,
                fontSize: 12.5,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
              }}
            >
              View original documents
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
        <aside className="np-bill-facts" aria-label="Bill facts">
          <details open>
            <summary>Bill facts</summary>
            <dl>
              <div>
                <dt>Bill number</dt>
                <dd>
                  {ev.billNumber ? `No. ${ev.billNumber}` : "Not listed"}
                  {ev.billYear ? ` · ${ev.billYear}` : ""}
                </dd>
              </div>
              <div>
                <dt>House</dt>
                <dd>{ev.house || "Parliament of India"}</dd>
              </div>
              <div>
                <dt>Ministry</dt>
                <dd>{ev.ministry || "Not listed"}</dd>
              </div>
              <div>
                <dt>Introduced</dt>
                <dd>{ev.date || "Date not listed"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={ev.status} dark={dark} />
                </dd>
              </div>
              <div>
                <dt>Topic</dt>
                <dd>{ev.topic || "Not listed"}</dd>
              </div>
              <div>
                <dt>Discussion</dt>
                <dd>{ev.commentCount ?? 0} comments</dd>
              </div>
            </dl>
            {ev.stages?.length > 0 && (
              <div className="np-facts-progress">
                <span>Legislative progress</span>
                <div
                  aria-label={`Stage ${Number(ev.stage || 0) + 1} of ${ev.stages.length}`}
                >
                  <i
                    style={{
                      width: `${Math.max(8, ((Number(ev.stage || 0) + 1) / ev.stages.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            <button
              className="np-facts-source"
              type="button"
              onClick={() => setSourcesOpen(true)}
            >
              <Database size={15} />
              Official sources
            </button>
            <FollowButton kind="event" id={ev.id} t={t} />
            {relatedBills.length > 0 && (
              <section
                className="np-related-bills"
                aria-labelledby="np-related-title"
              >
                <h3 id="np-related-title">Related bills</h3>
                <ul>
                  {relatedBills.map((bill) => (
                    <li key={bill.id}>
                      <Link to={`/bills/${bill.id}`}>{bill.title}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </details>
        </aside>
      </main>

      <OfficialSourcesModal
        open={sourcesOpen}
        onClose={closeSources}
        documents={ev.documents || []}
        title={ev.title}
        t={t}
      />
      <FeedChatbot
        dark={dark}
        billId={ev.qaBillId}
        billTitle={ev.officialTitle || ev.title}
        startOpen={askAiOpen}
        initialQuestion={
          askAiOpen
            ? `Explain the bill “${ev.title}” in plain language and why it matters.`
            : ""
        }
        onClose={() => setAskAiOpen(false)}
      />
      <Footer t={t} />
    </div>
  );
}
