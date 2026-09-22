import { Info, Database, ShieldCheck, Scale, Users2, Mail } from "lucide-react";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { PageHeader, Footer } from "../components/UI.jsx";

const PRINCIPLES = [
  { Icon: ShieldCheck, title: "Non-partisan by construction", body: "We report what happened, sourced from official records. We do not endorse or oppose bills, schemes, or rulings." },
  { Icon: Scale, title: "Plain language, not spin", body: "Every entry is written to be understood without a law degree, and every claim is traceable to a primary source." },
  { Icon: Users2, title: "\"Why it matters\" is mandatory", body: "We only publish an item once we can explain, concretely, how it affects someone's daily life." },
  { Icon: Database, title: "Source-linked, always", body: "Every card links back to the underlying gazette notification, judgment, or budget document." },
];

const SOURCES = [
  "Sansad (Lok Sabha & Rajya Sabha) bill tracker and PRS Legislative Research summaries",
  "Supreme Court of India and High Court judgment databases",
  "Union and State Budget documents published by the Ministry of Finance",
  "Ministry press releases via the Press Information Bureau (PIB)",
  "Reserve Bank of India and sectoral regulator circulars",
];

export default function About({ t }) {
  return (
    <div>
      <PageHeader t={t} eyebrow="ABOUT" IconComp={Info} title="Government activity, explained plainly"
        subtitle="NationPulse tracks bills, executive schemes, budget line items, and court rulings, and translates each one into what it actually means for you." />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "26px 20px" }}>
        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 19, fontWeight: 700, color: t.text, margin: "0 0 10px 0" }}>Our mission</h2>
          <p style={{ fontSize: 14, color: t.textSub, lineHeight: 1.8, margin: 0 }}>
            Most government activity is public record, but it is scattered across gazettes, PDFs, and legalese that
            few people have time to read. NationPulse exists to close that gap: we monitor Parliament, the
            Executive, the Union Budget, and the courts, and turn each development into a short, sourced summary
            with a plain-English answer to "why should I care?"
          </p>
        </section>
        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 19, fontWeight: 700, color: t.text, margin: "0 0 14px 0" }}>Editorial principles</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {PRINCIPLES.map(p => (
              <div key={p.title} style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 16, boxShadow: t.shadow }}>
                <p.Icon size={18} color={t.primary} style={{ marginBottom: 8 }} aria-hidden="true" />
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12.5, color: t.textSub, lineHeight: 1.6 }}>{p.body}</div>
              </div>
            ))}
          </div>
        </section>
        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 19, fontWeight: 700, color: t.text, margin: "0 0 12px 0" }}>Where our data comes from</h2>
          <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 12, overflow: "hidden" }}>
            {SOURCES.map((s, i) => (
              <div key={s} style={{ padding: "12px 16px", fontSize: 13, color: t.textSub, borderTop: i > 0 ? `1px solid ${t.borderLight}` : "none", display: "flex", gap: 10 }}>
                <Database size={14} color={t.textMuted} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                {s}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 10, lineHeight: 1.6 }}>
            AI-assisted drafts are reviewed by a human moderator before publishing — see our admin workflow for
            details on how items move from source document to published card.
          </p>
        </section>
        <section style={{ background: t.accentBg, border: "1px solid rgba(14,165,233,0.2)", borderRadius: 12, padding: 18, display: "flex", alignItems: "center", gap: 12 }}>
          <Mail size={20} color={t.accentText} aria-hidden="true" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>Spotted an error?</div>
            <div style={{ fontSize: 12.5, color: t.textSub }}>Write to corrections@nationpulse.example — every report is investigated and corrections are logged publicly.</div>
          </div>
        </section>
      </div>
      <Footer t={t} />
    </div>
  );
}
