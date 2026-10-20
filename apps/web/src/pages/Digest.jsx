import { useState } from "react";
import { Newspaper, Calendar, FileText } from "lucide-react";
import { api } from "../api/client.js";
import { useLive, LiveError } from "../api/useLive.jsx";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { UniversalCard, Footer, PageHeader, EmptyState } from "../components/UI.jsx";
import { CardSkeletonList } from "../components/LoadingUI.jsx";

const WEEK_OPTIONS = [
  { label: "Last 4 weeks", value: 4 },
  { label: "Last 8 weeks", value: 8 },
  { label: "Last 12 weeks", value: 12 },
  { label: "Last 24 weeks", value: 24 },
];

export default function Digest({ dark, t }) {
  const [weeks, setWeeks] = useState(12);
  const { data, error, loading } = useLive(() => api.getDigest(weeks), [weeks]);
  const editions = data?.items || [];

  const totalBills = editions.reduce((acc, ed) => acc + (ed.stat?.value || ed.highlights?.length || 0), 0);

  return (
    <div>
      <PageHeader
        t={t}
        eyebrow="WEEKLY DIGEST"
        IconComp={Newspaper}
        title="Parliamentary Weekly Digest"
        subtitle="Approved legislative updates and parliamentary activity grouped chronologically by week so you never miss an important bill."
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)" }}>
            {WEEK_OPTIONS.map(opt => {
              const active = weeks === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWeeks(opt.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    border: "none",
                    background: active ? "#2563EB" : "transparent",
                    color: active ? "#FFFFFF" : "#CBD5E1",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        }
      />

      <LiveError error={error} />

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px 44px", width: "100%" }}>
        {loading ? (
          <CardSkeletonList count={3} />
        ) : !editions.length ? (
          <EmptyState
            t={t}
            title={`No updates in the last ${weeks} weeks`}
            body="Try expanding the timeframe to 24 weeks or browse the full legislative feed."
            actionLabel={weeks < 24 ? "Expand to 24 weeks" : undefined}
            onAction={weeks < 24 ? () => setWeeks(24) : undefined}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Summary Banner */}
            <div style={{
              background: t.surface,
              border: `1px solid ${t.borderLight}`,
              borderRadius: 14,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              boxShadow: t.shadow,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: t.accentBg, color: t.primary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                    {editions.length} Weekly {editions.length === 1 ? "Edition" : "Editions"}
                  </div>
                  <div style={{ fontSize: 12.5, color: t.textMuted }}>
                    Covering {totalBills} parliamentary bill {totalBills === 1 ? "update" : "updates"} over the past {weeks} weeks
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Editions */}
            {editions.map((ed) => (
              <section key={ed.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 10,
                  borderBottom: `2px solid ${t.borderLight}`,
                  flexWrap: "wrap",
                  gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: t.primary, display: "inline-block",
                    }} />
                    <h2 style={{
                      margin: 0, fontFamily: FONT_SERIF, fontSize: 20,
                      fontWeight: 700, color: t.text,
                    }}>
                      {ed.label}
                    </h2>
                  </div>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 11px", borderRadius: 99,
                    background: t.surface2, border: `1px solid ${t.borderLight}`,
                    fontSize: 12, fontWeight: 600, color: t.textSub,
                  }}>
                    <FileText size={12} color={t.primary} />
                    {ed.stat?.value || ed.highlights?.length || 0} {ed.stat?.value === 1 ? "bill updated" : "bills updated"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(ed.highlights || []).map(ev => (
                    <UniversalCard key={ev.id} ev={ev} dark={dark} t={t} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <Footer t={t} />
    </div>
  );
}
