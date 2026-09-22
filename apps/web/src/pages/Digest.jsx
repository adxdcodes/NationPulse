import { useState } from "react";
import { Mail, Newspaper, CheckCircle2, ArrowRight } from "lucide-react";
import { DIGESTS, getEventById } from "../data/mockData.js";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { DomainBadge, StatusBadge, Footer, PageHeader } from "../components/UI.jsx";
import { Link } from "react-router-dom";

function SubscribeForm({ t }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    setError("");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 14, fontWeight: 600 }}>
        <CheckCircle2 size={18} color="#4ADE80" />You're subscribed. Look out for Sunday's digest.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: `1px solid ${error ? "#FB7185" : "rgba(255,255,255,0.18)"}`, background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        {error && <div style={{ fontSize: 11, color: "#FB7185", marginTop: 5 }}>{error}</div>}
      </div>
      <button type="submit" style={{ padding: "10px 20px", background: "#0EA5E9", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", whiteSpace: "nowrap" }}>
        <Mail size={14} />Subscribe
      </button>
    </form>
  );
}

export default function Digest({ dark, t }) {
  return (
    <div>
      <PageHeader t={t} eyebrow="WEEKLY DIGEST" IconComp={Newspaper} title="The week in government, in five minutes"
        subtitle="A plain-language roundup of what Parliament, the Executive, the Budget, and the courts did this week — delivered every Sunday." />
      <div style={{ background: dark ? "#0A1525" : "#152A47", padding: "18px 20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <SubscribeForm t={t} />
          <p style={{ margin: "10px 0 0 0", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Free, no spam, unsubscribe anytime. This is a demo form — no email is actually sent.</p>
        </div>
      </div>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "26px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
        {DIGESTS.map(d => (
          <div key={d.id} style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 14, padding: 22, boxShadow: t.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.accentText, letterSpacing: 0.6, marginBottom: 4 }}>{d.label}</div>
                <h2 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 19, fontWeight: 700, color: t.text }}>Published {d.published}</h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.primary, lineHeight: 1 }}>{d.stat.value}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{d.stat.label}</div>
              </div>
            </div>
            <p style={{ margin: "0 0 16px 0", fontSize: 14, color: t.textSub, lineHeight: 1.7 }}>{d.intro}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.highlightIds.map(id => {
                const ev = getEventById(id);
                if (!ev) return null;
                return (
                  <Link key={id} to={`/event/${ev.id}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: `1px solid ${t.borderLight}`, textDecoration: "none" }}>
                    <DomainBadge domain={ev.domain} dark={dark} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text, flex: 1 }}>{ev.title}</span>
                    <StatusBadge status={ev.status} dark={dark} />
                    <ArrowRight size={13} color={t.textMuted} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Footer t={t} />
    </div>
  );
}
