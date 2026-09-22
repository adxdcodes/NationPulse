import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Calendar, Tag, Building, FileText, User, BarChart2,
  Route, GitCompare, Database, ExternalLink, Users, ArrowLeftRight,
} from "lucide-react";
import { getEventById, getMPById } from "../data/mockData.js";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { DomainBadge, StatusBadge, BillStepper, BudgetBar, DiffTable, Section, Footer, FollowButton } from "../components/UI.jsx";
import CommentSection from "../components/Comments.jsx";
import NotFound from "./ErrorPages.jsx";

export default function EventDetail({ dark, t }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const ev = getEventById(id);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [id]);

  if (!ev) return <NotFound t={t} />;

  const sponsorMPs = (ev.sponsors || []).map(getMPById).filter(Boolean);

  return (
    <div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px" }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: t.primary, fontSize: 13, fontWeight: 600, padding: "0 0 20px 0", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
          <ArrowLeft size={15} aria-hidden="true" />Back
        </button>
        <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
          <DomainBadge domain={ev.domain} dark={dark} />
          <StatusBadge status={ev.status} dark={dark} />
          {ev.amend && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 500, background: dark ? "#1A0A2E" : "#FAF5FF", color: dark ? "#C084FC" : "#7E22CE" }}>
              <ArrowLeftRight size={11} />Amends {ev.prevLaw}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 700, color: t.text, lineHeight: 1.3, flex: 1, minWidth: 240 }}>{ev.title}</h1>
          <FollowButton kind="event" id={ev.id} t={t} />
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 24, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{ev.date}</span>
          <span>·</span>
          <Link to={`/topics/${encodeURIComponent(ev.topic)}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: t.textMuted, textDecoration: "none" }}>
            <Tag size={12} />{ev.topic}
          </Link>
          {ev.ministry && <><span>·</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Building size={12} />{ev.ministry}</span></>}
        </div>
        <Section IconComp={FileText} label="WHAT HAPPENED" t={t}>
          <p style={{ margin: 0, fontSize: 14, color: t.textSub, lineHeight: 1.75 }}>{ev.summary}</p>
        </Section>
        <div style={{ background: t.accentBg, borderRadius: 12, padding: 20, border: "1px solid rgba(14,165,233,0.2)", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.accentText, letterSpacing: 0.7, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <User size={13} aria-hidden="true" />WHY IT MATTERS TO YOU
          </div>
          <p style={{ margin: 0, fontSize: 14, color: t.textSub, lineHeight: 1.75 }}>{ev.why}</p>
        </div>
        {ev.allocation && <Section IconComp={BarChart2} label="BUDGET UTILISATION" t={t}><BudgetBar allocation={ev.allocation} utilised={ev.utilised} dark={dark} t={t} /></Section>}
        {ev.stages?.length > 0 && <Section IconComp={Route} label="LEGISLATIVE JOURNEY" t={t}><BillStepper stages={ev.stages} stage={ev.stage} dark={dark} t={t} /></Section>}
        {ev.amend && ev.changes && (
          <Section IconComp={GitCompare} label={`KEY CHANGES FROM ${ev.prevLaw?.toUpperCase() || "PREVIOUS LAW"}`} t={t}>
            <DiffTable changes={ev.changes} t={t} />
          </Section>
        )}
        {sponsorMPs.length > 0 && (
          <Section IconComp={Users} label="SPONSORED / LED BY" t={t}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sponsorMPs.map(mp => (
                <Link key={mp.id} to={`/mps/${mp.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.borderLight}`, textDecoration: "none" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: t.primary, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {mp.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{mp.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{mp.party} · {mp.constituency}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}
        <CommentSection scope={`event:${ev.id}`} t={t} dark={dark} />
        <div style={{ textAlign: "center", paddingTop: 12, fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Database size={12} />Official government records ·{" "}
          <a href="https://sansad.in" target="_blank" rel="noreferrer" style={{ color: t.primary, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
            View source<ExternalLink size={12} />
          </a>
        </div>
      </div>
      <Footer t={t} />
    </div>
  );
}
