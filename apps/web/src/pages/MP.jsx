import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Users, Landmark, GraduationCap, Briefcase, Calendar, MessageSquare, TrendingUp, FileText } from "lucide-react";
import { MPS, getMPById, getEventsForMP } from "../data/mockData.js";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { PartyBadge, UniversalCard, EmptyState, Footer, PageHeader, FollowButton } from "../components/UI.jsx";
import NotFound from "./ErrorPages.jsx";

function Avatar({ name, size = 44, t }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("");
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: t.primary, color: "#fff", fontSize: size * 0.36, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function StatBlock({ label, value, Icon, t }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: t.primary, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
        <Icon size={11} aria-hidden="true" />{label}
      </div>
    </div>
  );
}

function MPDirectory({ dark, t }) {
  const [q, setQ] = useState("");
  const [house, setHouse] = useState("All");

  const filtered = useMemo(() => MPS.filter(mp => {
    if (house !== "All" && mp.house !== house) return false;
    if (q && !`${mp.name} ${mp.state} ${mp.constituency} ${mp.party}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [q, house]);

  const chip = (active) => ({
    padding: "5px 13px", borderRadius: 99, fontSize: 12, fontWeight: 500,
    border: `1px solid ${active ? t.primary : t.border}`,
    background: active ? t.primary : "transparent", color: active ? "#fff" : t.textSub,
    cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div>
      <PageHeader t={t} eyebrow="DIRECTORY" IconComp={Users} title="Members of Parliament"
        subtitle="Track sponsorships, committee work, and legislative activity for MPs across the Lok Sabha and Rajya Sabha." />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 20px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, state, or constituency..."
            style={{ flex: 1, minWidth: 220, padding: "9px 14px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          {["All", "Lok Sabha", "Rajya Sabha"].map(h => (
            <button key={h} style={chip(house === h)} onClick={() => setHouse(h)}>{h}</button>
          ))}
        </div>
        {!filtered.length ? (
          <EmptyState t={t} title="No MPs found" body="Try a different name, state, or house." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {filtered.map(mp => (
              <Link key={mp.id} to={`/mps/${mp.id}`}
                style={{ display: "flex", gap: 12, background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: "16px 16px", textDecoration: "none", boxShadow: t.shadow, transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderLight; e.currentTarget.style.transform = "translateY(0)"; }}>
                <Avatar name={mp.name} t={t} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_SERIF, fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 2 }}>{mp.name}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>{mp.constituency}, {mp.state}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <PartyBadge bloc={mp.bloc} dark={dark} />
                    <span style={{ fontSize: 11, color: t.textMuted, background: t.surface2, border: `1px solid ${t.borderLight}`, padding: "2px 8px", borderRadius: 5 }}>{mp.house}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer t={t} />
    </div>
  );
}

function MPProfile({ mp, dark, t }) {
  const events = getEventsForMP(mp.id);
  return (
    <div>
      <div style={{ background: t.topbar, borderBottom: `1px solid ${t.topbarBorder}`, padding: "28px 20px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={mp.name} size={64} t={{ primary: "#3B82F6" }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ margin: "0 0 4px 0", fontFamily: FONT_SERIF, fontSize: 24, fontWeight: 700, color: "#fff" }}>{mp.name}</h1>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{mp.constituency}, {mp.state} · {mp.house}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <PartyBadge bloc={mp.bloc} dark />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.08)", padding: "3px 9px", borderRadius: 99 }}>{mp.party}</span>
            </div>
          </div>
          <FollowButton kind="mp" id={mp.id} t={t} onDark />
        </div>
      </div>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "22px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          <StatBlock label="Bills sponsored" value={mp.stats.billsSponsored} Icon={FileText} t={t} />
          <StatBlock label="Questions asked" value={mp.stats.questionsAsked} Icon={MessageSquare} t={t} />
          <StatBlock label="Attendance" value={`${mp.stats.attendance}%`} Icon={TrendingUp} t={t} />
          <StatBlock label="Debates joined" value={mp.stats.debates} Icon={Landmark} t={t} />
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: t.shadow }}>
          <p style={{ margin: "0 0 16px 0", fontSize: 14, color: t.textSub, lineHeight: 1.75 }}>{mp.bio}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 12.5 }}>
            <div>
              <div style={{ color: t.textMuted, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}><GraduationCap size={12} />EDUCATION</div>
              <div style={{ color: t.text, fontWeight: 500 }}>{mp.education}</div>
            </div>
            <div>
              <div style={{ color: t.textMuted, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}><Briefcase size={12} />COMMITTEE</div>
              <div style={{ color: t.text, fontWeight: 500 }}>{mp.committee}</div>
            </div>
            <div>
              <div style={{ color: t.textMuted, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />TERM</div>
              <div style={{ color: t.text, fontWeight: 500 }}>{mp.term} ({mp.terms} term{mp.terms > 1 ? "s" : ""})</div>
            </div>
            <div>
              <div style={{ color: t.textMuted, marginBottom: 3 }}>FOCUS AREAS</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {mp.topics.map(topic => (
                  <Link key={topic} to={`/topics/${encodeURIComponent(topic)}`}
                    style={{ fontSize: 11, color: t.primary, background: t.accentBg, padding: "2px 8px", borderRadius: 5, textDecoration: "none" }}>{topic}</Link>
                ))}
              </div>
            </div>
          </div>
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 12px 0" }}>Related legislative activity</h2>
        {events.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {events.map(ev => <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: t.textMuted }}>No tracked bills currently linked to this MP.</p>
        )}
      </div>
      <Footer t={t} />
    </div>
  );
}

export default function MP({ dark, t }) {
  const { id } = useParams();
  if (!id) return <MPDirectory dark={dark} t={t} />;
  const mp = getMPById(id);
  if (!mp) return <NotFound t={t} />;
  return <MPProfile mp={mp} dark={dark} t={t} />;
}
