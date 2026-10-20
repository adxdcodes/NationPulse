import { useState, useMemo } from "react";
import { api } from "../api/client.js";
import { useLive, LiveError } from "../api/useLive.jsx";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Users, Landmark, GraduationCap, Briefcase, Calendar,
  MessageSquare, TrendingUp, FileText, ArrowLeft, Search, X,
} from "lucide-react";

import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { PartyBadge, UniversalCard, EmptyState, Footer, PageHeader, FollowButton } from "../components/UI.jsx";
import { PersonSkeleton } from "../components/LoadingUI.jsx";
import NotFound from "./ErrorPages.jsx";

function Avatar({ name, size = 46, t }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: t.primary, color: "#FFFFFF",
      fontSize: size * 0.36, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function StatBlock({ label, value, Icon, t }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.borderLight}`,
      borderRadius: 14, padding: "16px 18px", boxShadow: t.shadow,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.primary, lineHeight: 1.1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
        <Icon size={13} aria-hidden="true" />{label}
      </div>
    </div>
  );
}

function MPDirectory({ dark, t }) {
  const [q, setQ] = useState("");
  const [house, setHouse] = useState("All");

  const { data, error, loading } = useLive(() => api.listMPs({ q, house }), [q, house]);
  const MPS = data?.items || [];
  const filtered = useMemo(() => MPS.filter(mp => {
    if (house !== "All" && mp.house !== house) return false;
    if (q && !`${mp.name} ${mp.state} ${mp.constituency} ${mp.party}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [q, house, MPS]);

  const chip = (active) => ({
    padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: active ? 600 : 500,
    border: `1px solid ${active ? t.primary : t.border}`,
    background: active ? t.primary : t.surface, color: active ? "#FFFFFF" : t.textSub,
    cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div>
      <PageHeader
        t={t}
        eyebrow="PARLIAMENTARY DIRECTORY"
        IconComp={Users}
        title="Members of Parliament"
        subtitle="Track sponsorships, committee work, and legislative activity for MPs across the Lok Sabha and Rajya Sabha."
      />
      <LiveError error={error} />
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px 44px", width: "100%" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} aria-hidden="true" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by MP name, state, party, or constituency..."
              aria-label="Search by MP name, state, party, or constituency"
              style={{
                width: "100%", padding: "9px 32px 9px 38px",
                borderRadius: 9, border: `1px solid ${t.border}`,
                background: t.surface, color: t.text, fontSize: 13.5,
                outline: "none", fontFamily: "inherit",
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: t.textMuted, cursor: "pointer",
                  display: "flex", alignItems: "center",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["All", "Lok Sabha", "Rajya Sabha"].map(h => (
              <button key={h} type="button" style={chip(house === h)} onClick={() => setHouse(h)}>{h}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <PersonSkeleton />
        ) : !filtered.length ? (
          <EmptyState
            t={t}
            title="No Members of Parliament found"
            body={q || house !== "All" ? "Try adjusting your search query or house filter." : "No MP profiles have been ingested into the directory yet."}
            actionLabel={(q || house !== "All") ? "Reset filters" : undefined}
            onAction={(q || house !== "All") ? () => { setQ(""); setHouse("All"); } : undefined}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
            {filtered.map(mp => (
              <Link
                key={mp.id}
                to={`/mps/${mp.id}`}
                style={{
                  display: "flex", gap: 14, background: t.surface,
                  border: `1px solid ${t.borderLight}`, borderRadius: 16,
                  padding: "18px 18px", textDecoration: "none",
                  boxShadow: t.shadow, transition: "all 0.18s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = t.primary;
                  e.currentTarget.style.boxShadow = t.shadowHover;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = t.borderLight;
                  e.currentTarget.style.boxShadow = t.shadow;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <Avatar name={mp.name} t={t} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: FONT_SERIF, fontSize: 16.5, fontWeight: 700, color: t.text, marginBottom: 3 }}>
                    {mp.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: t.textMuted, marginBottom: 10 }}>
                    {mp.constituency}, {mp.state}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <PartyBadge bloc={mp.bloc} dark={dark} />
                    <span style={{
                      fontSize: 11.5, fontWeight: 500, color: t.textSub,
                      background: t.surface2, border: `1px solid ${t.borderLight}`,
                      padding: "3px 8px", borderRadius: 6,
                    }}>
                      {mp.house}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer t={t} />
    </div>
  );
}

function MPProfile({ mp, dark, t }) {
  const navigate = useNavigate();
  const events = mp.bills || [];
  return (
    <div>
      <div style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        borderBottom: `1px solid ${t.topbarBorder}`,
        padding: "24px 20px 28px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <button
            type="button"
            onClick={() => navigate("/mps")}
            style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 8, cursor: "pointer", color: "#F8FAFC",
              fontSize: 12.5, fontWeight: 600, padding: "6px 12px", marginBottom: 18,
              display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
            }}
          >
            <ArrowLeft size={14} />All MPs
          </button>

          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar name={mp.name} size={64} t={{ primary: "#2563EB" }} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 style={{ margin: "0 0 4px 0", fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 700, color: "#FFFFFF" }}>
                {mp.name}
              </h1>
              <div style={{ fontSize: 13.5, color: "#CBD5E1", marginBottom: 10 }}>
                {mp.constituency}, {mp.state} · {mp.house}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <PartyBadge bloc={mp.bloc} dark />
                <span style={{
                  fontSize: 11.5, fontWeight: 600, color: "#E2E8F0",
                  background: "rgba(255,255,255,0.1)", padding: "4px 10px", borderRadius: 6,
                }}>
                  {mp.party}
                </span>
              </div>
            </div>
            <FollowButton kind="mp" id={mp.id} t={t} onDark />
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 44px" }}>
        <div className="np-mp-stats-grid" style={{ marginBottom: 22 }}>
          <StatBlock label="Bills sponsored" value={mp.stats.billsSponsored} Icon={FileText} t={t} />
          <StatBlock label="Questions asked" value={mp.stats.questionsAsked} Icon={MessageSquare} t={t} />
          <StatBlock label="Attendance" value={`${mp.stats.attendance}%`} Icon={TrendingUp} t={t} />
          <StatBlock label="Debates joined" value={mp.stats.debates} Icon={Landmark} t={t} />
        </div>

        <div style={{
          background: t.surface, border: `1px solid ${t.borderLight}`,
          borderRadius: 16, padding: "22px 24px", marginBottom: 24, boxShadow: t.shadow,
        }}>
          <p style={{ margin: "0 0 18px 0", fontSize: 14.5, color: t.textSub, lineHeight: 1.75 }}>{mp.bio}</p>
          <div className="np-two-col-grid" style={{ fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <GraduationCap size={13} />EDUCATION
              </div>
              <div style={{ color: t.text, fontWeight: 600 }}>{mp.education}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <Briefcase size={13} />COMMITTEE
              </div>
              <div style={{ color: t.text, fontWeight: 600 }}>{mp.committee}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <Calendar size={13} />TERM
              </div>
              <div style={{ color: t.text, fontWeight: 600 }}>{mp.term} ({mp.terms} term{mp.terms > 1 ? "s" : ""})</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>FOCUS AREAS</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(mp.topics || []).map(topic => (
                  <Link
                    key={topic}
                    to={`/topics/${encodeURIComponent(topic)}`}
                    style={{
                      fontSize: 11.5, fontWeight: 600, color: t.primary,
                      background: t.accentBg, padding: "3px 9px", borderRadius: 6, textDecoration: "none",
                    }}
                  >
                    {topic}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <h2 style={{ fontFamily: FONT_SERIF, fontSize: 19, fontWeight: 700, color: t.text, margin: "0 0 14px 0" }}>
          Related Legislative Activity
        </h2>
        {events.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {events.map(ev => <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13.5, color: t.textMuted }}>No tracked bills currently linked to this MP.</p>
        )}
      </main>
      <Footer t={t} />
    </div>
  );
}

export default function MP({ dark, t }) {
  const { id } = useParams();
  return id ? <MPDetail id={id} dark={dark} t={t} /> : <MPDirectory dark={dark} t={t} />;
}

function MPDetail({ id, dark, t }) {
  const { data: mp, error, loading } = useLive(() => api.getMP(id), [id]);
  if (loading) return <PersonSkeleton detail />;
  if (error) return <LiveError error={error} />;
  if (!mp) return <NotFound t={t} />;
  return <MPProfile mp={mp} dark={dark} t={t} />;
}
