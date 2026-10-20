import { Info, Database, ShieldCheck, Scale, Users2, Mail } from "lucide-react";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { PageHeader, Footer } from "../components/UI.jsx";

const PRINCIPLES = [
  { Icon: ShieldCheck, title: "Non-partisan by construction", body: "We report what happened, sourced from official records. We do not endorse or oppose bills, schemes, or rulings." },
  { Icon: Scale, title: "Plain language, not spin", body: "Every entry is written to be understood without a law degree, and every claim is traceable to a primary source." },
  { Icon: Users2, title: "\"Why it matters\" is mandatory", body: "We only publish an item once we can explain, concretely, how it affects citizens' daily lives." },
  { Icon: Database, title: "Source-linked, always", body: "Every card links back to the underlying gazette notification, parliamentary bill PDF, or official record." },
];

const SOURCES = [
  "Sansad (Lok Sabha & Rajya Sabha) official bill tracker and legislative records",
  "Supreme Court of India and High Court judgment databases",
  "Union and State Budget documents published by the Ministry of Finance",
  "Ministry press releases via the Press Information Bureau (PIB)",
  "Reserve Bank of India and sectoral regulator circulars",
];

export default function About({ t }) {
  return (
    <div>
      <PageHeader
        t={t}
        eyebrow="EDITORIAL STANDARDS & METHODOLOGY"
        IconComp={Info}
        title="Government activity, explained plainly"
        subtitle="NationPulse tracks parliamentary bills, executive schemes, budget line items, and court rulings, translating each one into what it actually means for citizens."
      />
      <main style={{ maxWidth: 840, margin: "0 auto", padding: "30px 20px 44px" }}>
        <section style={{
          background: t.surface, border: `1px solid ${t.borderLight}`,
          borderRadius: 16, padding: "24px 26px", marginBottom: 24, boxShadow: t.shadow,
        }}>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 700, color: t.text, margin: "0 0 10px 0" }}>
            Our Mission
          </h2>
          <p style={{ fontSize: 14.5, color: t.textSub, lineHeight: 1.8, margin: 0 }}>
            Most government activity is public record, but it is scattered across gazettes, lengthy PDFs, and dense legalese that
            few citizens have time to read. NationPulse exists to close that gap: we monitor Parliament, the
            Executive, the Union Budget, and the courts, turning each development into a concise, source-verified summary
            with a plain-English answer to &ldquo;why does this matter to me?&rdquo;
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 700, color: t.text, margin: "0 0 14px 0" }}>
            Editorial Principles
          </h2>
          <div className="np-two-col-grid">
            {PRINCIPLES.map(p => (
              <div key={p.title} style={{
                background: t.surface, border: `1px solid ${t.borderLight}`,
                borderRadius: 14, padding: "20px 22px", boxShadow: t.shadow,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, background: t.accentBg,
                  color: t.primary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
                }}>
                  <p.Icon size={18} aria-hidden="true" />
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.text, marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 13.5, color: t.textSub, lineHeight: 1.65 }}>{p.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 700, color: t.text, margin: "0 0 12px 0" }}>
            Primary Data Sources
          </h2>
          <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 14, overflow: "hidden", boxShadow: t.shadow }}>
            {SOURCES.map((s, i) => (
              <div key={s} style={{
                padding: "14px 18px", fontSize: 13.5, color: t.textSub,
                borderTop: i > 0 ? `1px solid ${t.borderLight}` : "none",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <Database size={15} color={t.primary} style={{ flexShrink: 0 }} aria-hidden="true" />
                <span>{s}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: t.textMuted, marginTop: 12, lineHeight: 1.6 }}>
            AI-assisted summaries are verified by human editors before publication — only approved summaries appear in the NationPulse feed.
          </p>
        </section>

        <section style={{
          background: t.accentBg, border: `1px solid ${t.border}`,
          borderLeft: `4px solid ${t.accent}`, borderRadius: 14,
          padding: "18px 20px", display: "flex", alignItems: "center", gap: 14,
        }}>
          <Mail size={22} color={t.accentText} aria-hidden="true" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 3 }}>Spotted an error or broken source link?</div>
            <div style={{ fontSize: 13, color: t.textSub }}>
              Write to <strong>corrections@nationpulse.example</strong> — every report is investigated against primary parliamentary documents.
            </div>
          </div>
        </section>
      </main>
      <Footer t={t} />
    </div>
  );
}
