import { useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Search, Moon, Sun, Shield, ArrowRight,
  Calendar, Clock3, Tag, Building, Check, X,
  ArrowLeftRight, BarChart2, SearchX, Flag, Menu, ChevronDown,
  Bell, BellRing, MessageSquare, User as UserIcon, LogOut, RotateCcw, Filter,
} from "lucide-react";
import { DOMAIN_META, STATUS_META, PARTY_META, FONT_SERIF } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useFollow } from "../data/socialStore.js";
import { initials } from "../utils.js";

export function DomainBadge({ domain, dark }) {
  const m = DOMAIN_META[domain];
  if (!m) return null;
  const c = dark ? m.dark : m.light;
  const Icon = m.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      <Icon size={12} aria-hidden="true" />{domain}
    </span>
  );
}

export function StatusBadge({ status, dark }) {
  const m = STATUS_META[status] || STATUS_META["Pending"];
  const c = dark ? m.dark : m.light;
  const Icon = status === "Passed" ? Check : status === "In Effect" ? Shield : status === "Under Review" ? Search : ["Struck Down", "Withdrawn", "Lapsed"].includes(status) ? X : Clock3;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600,
      background: c.bg, color: c.text, border: c.border ? `1px solid ${c.border}` : "none",
    }}>
      <Icon size={12} aria-hidden="true" />{status}
    </span>
  );
}

export function PartyBadge({ bloc, dark }) {
  const m = PARTY_META[bloc] || PARTY_META["Independent"];
  const c = dark ? m.dark : m.light;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600,
      background: c.bg, color: c.text, border: c.border ? `1px solid ${c.border}` : "none",
    }}>
      {bloc}
    </span>
  );
}

export function FollowButton({ kind, id, t, size = "md", onDark = false, className = "" }) {
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { following, toggle } = useFollow(user?.email, kind, id);
  const pad = size === "sm" ? "6px 12px" : "8px 16px";
  const fontSize = size === "sm" ? 12 : 13;

  function onClick() {
    if (!isAuthed) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    toggle();
  }

  const style = onDark
    ? {
        border: `1px solid ${following ? "#38BDF8" : "rgba(255,255,255,0.25)"}`,
        background: following ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.08)",
        color: following ? "#7DD3FC" : "#F8FAFC",
      }
    : {
        border: `1px solid ${following ? t.primary : t.border}`,
        background: following ? t.primary : t.surface,
        color: following ? "#FFFFFF" : t.text,
      };

  return (
    <button
      className={className}
      onClick={onClick}
      type="button"
      style={{
        padding: pad, borderRadius: 8, fontSize, fontWeight: 600,
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "inherit", transition: "all 0.15s ease", flexShrink: 0,
        ...style,
      }}
    >
      {following ? <BellRing size={size === "sm" ? 13 : 14} /> : <Bell size={size === "sm" ? 13 : 14} />}
      {following ? "Following" : "Follow"}
    </button>
  );
}

export function CommentCountBadge({ scope, t }) {
  const count = 0;
  if (!count) {
    return (
      <span style={{ fontSize: 12, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <MessageSquare size={12} aria-hidden="true" />Discuss
      </span>
    );
  }
  return (
    <span style={{ fontSize: 12, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <MessageSquare size={12} aria-hidden="true" />{count} comment{count === 1 ? "" : "s"}
    </span>
  );
}

export function BillStepper({ stages, stage, dark, t }) {
  return (
    <div role="group" aria-label="Legislative journey" style={{ display: "flex", alignItems: "flex-start", width: "100%", minWidth: 0, padding: "6px 0 2px" }}>
      {stages.map((s, i) => {
        const done = i < stage;
        const active = i === stage;
        const doneColor = dark ? "#22C55E" : "#16A34A";
        const activeColor = t.primary;
        const circleColor = done ? doneColor : active ? activeColor : t.border;
        return (
          <div key={`${s}-${i}`} style={{ display: "flex", alignItems: "flex-start", flex: "1 1 0", minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: "100%", minWidth: 0 }}>
              <div style={{
                width: 26, height: 26, minWidth: 26, minHeight: 26,
                boxSizing: "border-box", flexShrink: 0, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${circleColor}`,
                background: done ? doneColor : active ? activeColor : t.surface2,
                color: done || active ? "#FFFFFF" : t.textMuted,
                boxShadow: active ? `0 0 0 3px ${dark ? "rgba(255,183,197,0.22)" : "rgba(179,57,91,0.16)"}` : "none",
                transition: "all 0.2s ease",
              }}>
                {done ? <Check size={15} strokeWidth={3} aria-hidden="true" />
                  : active ? <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", background: "#FFFFFF" }} />
                  : <span style={{ fontSize: 11.5, fontWeight: 700 }}>{i + 1}</span>}
              </div>
              <span style={{
                fontSize: 10.5, textAlign: "center", width: "100%", lineHeight: 1.25,
                color: done || active ? t.text : t.textMuted,
                fontWeight: done || active ? 600 : 500,
                overflowWrap: "anywhere",
              }}>
                {s}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div style={{
                flex: "0.38 1 0", minWidth: 6, height: 2, margin: "12px 3px 0",
                borderRadius: 99, background: done ? doneColor : t.borderLight,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BudgetBar({ allocation, utilised, dark, t }) {
  const pct = Math.round((utilised / allocation) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.textSub, display: "flex", alignItems: "center", gap: 5 }}>
          <BarChart2 size={13} aria-hidden="true" />Budget utilisation
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: t.success }}>{pct}%</span>
      </div>
      <div style={{ background: t.surface2, borderRadius: 99, height: 8, overflow: "hidden", border: `1px solid ${t.borderLight}` }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: t.success, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11, color: t.textMuted }}>
        <span>Rs {(utilised / 1000).toFixed(0)}k Cr spent</span>
        <span>Rs {(allocation / 1000).toFixed(0)}k Cr allocated</span>
      </div>
    </div>
  );
}

export function DiffTable({ changes, t }) {
  return (
    <div style={{ border: `1px solid ${t.borderLight}`, borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{
          padding: "9px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
          display: "flex", alignItems: "center", gap: 6,
          background: t.dangerBg, color: t.danger,
        }}>
          <X size={13} />PREVIOUS PROVISION
        </div>
        <div style={{
          padding: "9px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
          display: "flex", alignItems: "center", gap: 6,
          background: t.successBg, color: t.success, borderLeft: `1px solid ${t.borderLight}`,
        }}>
          <Check size={13} />NEW PROVISION
        </div>
      </div>
      {changes.map((c, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${t.borderLight}` }}>
          <div style={{ padding: "12px 14px", fontSize: 13.5, color: t.textSub, lineHeight: 1.65 }}>{c.before}</div>
          <div style={{ padding: "12px 14px", fontSize: 13.5, color: t.text, lineHeight: 1.65, borderLeft: `1px solid ${t.borderLight}`, fontWeight: 500 }}>{c.after}</div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ t }) {
  return (
    <div style={{ background: t.surface, borderRadius: 16, padding: "22px 24px", border: `1px solid ${t.borderLight}` }}>
      {[55, 92, 70, 40].map((w, i) => (
        <div key={i} style={{ width: `${w}%`, height: i === 1 ? 18 : 13, background: t.surface2, borderRadius: 6, marginBottom: 10, animation: "shimmer 1.3s infinite" }} />
      ))}
    </div>
  );
}

export function Section({ IconComp, label, t, children }) {
  return (
    <section style={{
      background: t.surface, borderRadius: 14, padding: "20px 22px",
      border: `1px solid ${t.borderLight}`, marginBottom: 16, boxShadow: t.shadow,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8,
        marginBottom: 12, display: "flex", alignItems: "center", gap: 7, textTransform: "uppercase",
      }}>
        <IconComp size={14} color={t.primary} aria-hidden="true" />{label}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ t, title = "No results found", body = "Try adjusting your filters or search query.", actionLabel, onAction }) {
  return (
    <div className="np-empty-state" style={{
      textAlign: "center", padding: "56px 24px",
      background: t.surface, borderRadius: 16, border: `1px solid ${t.borderLight}`,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: t.surface2,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
      }}>
        <SearchX size={26} style={{ color: t.textMuted }} aria-hidden="true" />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: "0 0 6px 0" }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: t.textMuted, margin: "0 auto 20px", maxWidth: 400, lineHeight: 1.6 }}>{body}</p>
      {actionLabel && (
        <button
          onClick={onAction}
          type="button"
          style={{
            padding: "9px 18px", background: t.primary, color: "#FFFFFF",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
          }}
        >
          <RotateCcw size={14} />{actionLabel}
        </button>
      )}
    </div>
  );
}

export function UniversalCard({ ev, dark, t, compact = false }) {
  const [hov, setHov] = useState(false);
  const navigate = useNavigate();
  return (
    <article
      className="np-card-enter"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/bills/${ev.id}`)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/bills/${ev.id}`); } }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: topicTint(ev.topic, dark),
        breakInside: "avoid",
        borderRadius: 16,
        padding: "22px 24px",
        border: `1px solid ${hov ? t.primary : t.borderLight}`,
        boxShadow: hov ? t.shadowHover : t.shadow,
        cursor: "pointer",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
      }}
    >
      {/* Top Meta Row: Domain, Status, Amendment, Date */}
      <div className="np-card-meta-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="np-card-meta-badges">
          <DomainBadge domain={ev.domain} dark={dark} />
          <StatusBadge status={ev.status} dark={dark} />
          {ev.amend && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600,
              background: dark ? "#2E1065" : "#FAF5FF",
              color: dark ? "#D8B4FE" : "#7E22CE",
              border: `1px solid ${dark ? "#581C87" : "#E9D5FF"}`,
            }}>
              <ArrowLeftRight size={11} aria-hidden="true" />Amendment
            </span>
          )}
        </div>
        {ev.date && (
          <span className="np-card-meta-date" style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 500, color: t.textMuted,
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            <Calendar size={12} aria-hidden="true" />{ev.date}
          </span>
        )}
      </div>

      {/* Headline & Summary */}
      <h3 style={{
        margin: "0 0 8px 0", fontFamily: FONT_SERIF, fontSize: 19,
        fontWeight: 700, color: t.text, lineHeight: 1.38, letterSpacing: "-0.015em",
      }}>
        {ev.title}
      </h3>
      <p className={compact ? "np-bill-card-summary--compact" : undefined} style={{ margin: "0 0 14px 0", fontSize: 14, color: t.textSub, lineHeight: 1.68 }}>
        {ev.summary}
      </p>

      {compact ? (
        <div className="np-bill-card-compact-meta">
          <span>{[ev.topic, ev.ministry].filter(Boolean).join(" · ") || "Parliamentary bill"}</span>
          <span className="np-bill-card-view">View bill details <ArrowRight size={13} aria-hidden="true" /></span>
        </div>
      ) : <>
      {/* Why It Matters Callout */}
      {ev.why && (
        <div style={{
          background: t.accentBg,
          borderLeft: `3px solid ${t.accent}`,
          borderRadius: "0 8px 8px 0",
          padding: "10px 14px",
          marginBottom: (ev.allocation || ev.stages?.length) ? 14 : 0,
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: t.accentText,
            letterSpacing: 0.7, marginBottom: 3, textTransform: "uppercase",
          }}>
            Why it matters to citizens
          </div>
          <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6 }}>{ev.why}</div>
        </div>
      )}

      {ev.allocation && (
        <div style={{ marginTop: 14 }}>
          <BudgetBar allocation={ev.allocation} utilised={ev.utilised} dark={dark} t={t} />
        </div>
      )}
      {ev.stages?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <BillStepper stages={ev.stages} stage={ev.stage} dark={dark} t={t} />
        </div>
      )}

      {/* Footer Tags, Comment Count & Action */}
      <div style={{
        display: "flex", gap: 8, marginTop: 16, paddingTop: 14,
        borderTop: `1px solid ${t.borderLight}`, alignItems: "center", flexWrap: "wrap",
      }}>
        {ev.topic && (
          <span style={{
            fontSize: 11.5, fontWeight: 500, color: t.textSub, background: t.surface2,
            border: `1px solid ${t.borderLight}`, padding: "3px 9px", borderRadius: 6,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <Tag size={11} aria-hidden="true" />{ev.topic}
          </span>
        )}
        {ev.ministry && (
          <span style={{
            fontSize: 11.5, fontWeight: 500, color: t.textSub, background: t.surface2,
            border: `1px solid ${t.borderLight}`, padding: "3px 9px", borderRadius: 6,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <Building size={11} aria-hidden="true" />{ev.ministry}
          </span>
        )}
        <span style={{
          fontSize: 12, color: t.textMuted, display: "inline-flex",
          alignItems: "center", gap: 4, marginLeft: 4,
        }}>
          <MessageSquare size={12} aria-hidden="true" />
          {ev.commentCount ?? 0} {ev.commentCount === 1 ? "comment" : "comments"}
        </span>
        <span style={{
          marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: t.primary,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          Read analysis<ArrowRight size={13} aria-hidden="true" />
        </span>
      </div>
      </>}
    </article>
  );
}

function topicTint(topic, dark) {
  if (dark) return "#2B1A22";
  const tints = ["#FFFFFF", "#FFF1F3", "#F1FAF2", "#FFF5F7"];
  const key = String(topic || "");
  const hash = [...key].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return tints[hash % tints.length];
}

/**
 * HCI-Compliant FilterBar:
 * Replaces horizontal scrolling of dozens of topic chips with structured, scannable controls:
 * - Clean Topic select dropdown (prevents cognitive overload / Hick's Law)
 * - Status segmented pills
 * - Active filter counter and one-click Reset button
 */
export function FilterBar({ filters, setFilters, t, domains = [], topics = [], statuses = [] }) {
  const activeCount = [
    filters.domain && filters.domain !== "All",
    filters.topic && filters.topic !== "All",
    filters.status && filters.status !== "All",
  ].filter(Boolean).length;

  const chipStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: active ? 600 : 500,
    border: `1px solid ${active ? t.primary : t.border}`,
    background: active ? t.primary : t.surface,
    color: active ? "#FFFFFF" : t.textSub,
    cursor: "pointer",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontFamily: "inherit",
  });

  return (
    <div className="np-filter-bar" style={{
      background: t.surface,
      borderBottom: `1px solid ${t.borderLight}`,
      padding: "12px 20px",
      position: "sticky",
      top: 60,
      zIndex: 40,
      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
    }}>
      <div className="np-filter-bar-inner" style={{
        maxWidth: 1040,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
      }}>
        {/* Status Filter Chips */}
        {statuses.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: t.textMuted,
              letterSpacing: 0.6, marginRight: 4, display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <Filter size={12} aria-hidden="true" />STATUS
            </span>
            {statuses.map(st => (
              <button
                key={st}
                type="button"
                className={`np-filter-chip${filters.status === st ? " is-active" : ""}`}
                style={chipStyle(filters.status === st)}
                onClick={() => setFilters(f => ({ ...f, status: f.status === st && st !== "All" ? "All" : st }))}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {/* Right Side: Topic Select Dropdown + Reset */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
          {topics.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <label className="np-filter-label" htmlFor="np-topic-filter" style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.6 }}>
                POLICY TOPIC
              </label>
              <select
                id="np-topic-filter"
                className="np-filter-select"
                value={filters.topic || "All"}
                onChange={e => setFilters(f => ({ ...f, topic: e.target.value }))}
                style={{
                  padding: "6px 30px 6px 11px",
                  borderRadius: 8,
                  border: `1px solid ${filters.topic !== "All" ? t.primary : t.border}`,
                  background: t.surface2,
                  color: t.text,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 34,
                }}
              >
                {topics.map(tp => (
                  <option key={tp} value={tp}>
                    {tp === "All" ? "All Topics" : tp}
                  </option>
                ))}
              </select>
            </div>
          )}

          {domains.length > 2 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <label className="np-filter-label" htmlFor="np-domain-filter" style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.6 }}>
                BRANCH
              </label>
              <select
                id="np-domain-filter"
                className="np-filter-select"
                value={filters.domain || "All"}
                onChange={e => setFilters(f => ({ ...f, domain: e.target.value }))}
                style={{
                  padding: "6px 28px 6px 11px",
                  borderRadius: 8,
                  border: `1px solid ${filters.domain !== "All" ? t.primary : t.border}`,
                  background: t.surface2,
                  color: t.text,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 34,
                }}
              >
                {domains.map(dm => (
                  <option key={dm} value={dm}>{dm === "All" ? "All Branches" : dm}</option>
                ))}
              </select>
            </div>
          )}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters({ domain: "All", topic: "All", status: "All" })}
              style={{
                padding: "6px 11px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${t.danger}`,
                background: t.dangerBg,
                color: t.danger,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
            >
              <RotateCcw size={12} />Reset ({activeCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const NAV_LINKS = [
  { to: "/bills", label: "Bills" },
  { to: "/topics", label: "Topics" },
  { to: "/digest", label: "Weekly Digest" },
  { to: "/about", label: "About" },
];

function UserMenu({ t }) {
  const { user, isAuthed, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!isAuthed || !user) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          height: 36, padding: "0 10px 0 6px", borderRadius: 99,
          background: t.surface, border: `1px solid ${t.borderLight}`,
          color: t.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 1px 3px rgba(91,42,59,.08)", transition: "background .16s ease,border-color .16s ease,box-shadow .16s ease",
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: "50%", background: t.primary,
          color: "#FFFFFF", fontSize: 11, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `2px solid ${t.surface}`, boxShadow: `0 0 0 1px ${t.primary}`,
        }}>
          {initials(user.name)}
        </span>
        <span className="np-user-name-label" style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user.name}
        </span>
        <ChevronDown size={13} style={{ opacity: 0.7 }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div style={{
            position: "absolute", right: 0, top: 44, width: 230,
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 12, boxShadow: t.shadowHover, zIndex: 20, overflow: "hidden",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.borderLight}`, background: t.surface2 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{user.name}</div>
                {isAdmin && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: t.primary, color: "#fff" }}>
                    ADMIN
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2, wordBreak: "break-all" }}>{user.email}</div>
            </div>
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "10px 16px",
                fontSize: 13, fontWeight: 500, color: t.text, textDecoration: "none",
              }}
            >
              <UserIcon size={15} color={t.textMuted} />My Profile & Watchlist
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "10px 16px",
                  fontSize: 13, fontWeight: 500, color: t.text, textDecoration: "none",
                  borderTop: `1px solid ${t.borderLight}`,
                }}
              >
                <Shield size={15} color={t.primary} />Admin Console
              </Link>
            )}
            <button
              onClick={() => { logout(); setOpen(false); navigate("/login"); }}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "10px 16px",
                fontSize: 13, fontWeight: 600, color: t.danger, background: "none",
                border: "none", borderTop: `1px solid ${t.borderLight}`,
                width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <LogOut size={15} />Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar({ t, dark, toggle }) {
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  function submitSearch(e) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
      setMobileOpen(false);
    }
  }

  const linkStyle = ({ isActive }) => ({
    fontSize: 13.5,
    fontWeight: isActive ? 600 : 500,
    color: isActive ? (dark ? "#1F1218" : "#8E2646") : t.textSub,
    background: isActive ? (dark ? "#FFB7C5" : "#F2C7C7") : "transparent",
    textDecoration: "none",
    padding: "7px 12px",
    borderRadius: 8,
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
  });

  return (
    <header className="np-topbar" style={{
      background: t.topbar,
      borderBottom: `1px solid ${t.topbarBorder}`,
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div className="np-topbar-inner" style={{
        width: "100%",
        margin: "0 auto",
        height: 60,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        alignItems: "center",
        padding: "0 12px",
        boxSizing: "border-box",
        gap: 20,
      }}>
        {/* Brand Identity */}
        <Link to="/bills" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, justifySelf: "start", textDecoration: "none" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: t.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(142, 38, 70, 0.18)",
          }}>
            <Flag size={16} color="#FFFFFF" aria-hidden="true" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: t.text, letterSpacing: "-0.02em" }}>
            Nation<span style={{ color: t.primary }}>Pulse</span>
          </span>
        </Link>

        <div className="np-topbar-center" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, minWidth: 0 }}>
        {/* Primary Desktop Navigation */}
        <nav aria-label="Main navigation" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }} className="np-nav-desktop">
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end style={linkStyle}>{l.label}</NavLink>
          ))}
        </nav>

        {/* Global Search Bar */}
        <form onSubmit={submitSearch} role="search" className="np-topbar-search" style={{ width: 300, maxWidth: 360, minWidth: 0, position: "relative" }}>
          <Search size={15} aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bills, ministries, topics..."
            aria-label="Search bills, ministries, topics"
            style={{
              width: "100%", padding: "8px 12px 8px 36px",
              background: t.surface,
              border: `1px solid ${t.borderLight}`,
              borderRadius: 9, color: t.text, fontSize: 13, outline: "none",
              boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
        </form>
        </div>

        {/* Right Controls: Theme Toggle, Admin Console (only for Admins), User Menu */}
        <div className="np-topbar-actions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0, justifySelf: "end" }}>
          <button
            onClick={toggle}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: t.surface, border: `1px solid ${t.borderLight}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: t.textSub, cursor: "pointer",
            }}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {isAdmin && (
            <Link
              to="/admin"
              aria-label="Admin Console"
              title="Admin Console"
              style={{
                height: 36, padding: "0 12px", borderRadius: 8,
                border: "1px solid rgba(56, 189, 248, 0.35)",
                color: "#38BDF8", background: "rgba(56, 189, 248, 0.10)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                textDecoration: "none", fontSize: 12.5, fontWeight: 600,
              }}
              className="np-nav-desktop"
            >
              <Shield size={14} />Admin
            </Link>
          )}

          <UserMenu t={t} />

          <button
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(o => !o)}
            className="np-nav-toggle"
            style={{
              display: "none", width: 36, height: 36, borderRadius: 8,
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
              alignItems: "center", justifyContent: "center", color: "#FFFFFF", cursor: "pointer",
            }}
          >
            <Menu size={17} />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <nav aria-label="Mobile navigation" style={{
          display: "flex", flexDirection: "column", padding: "10px 20px 16px",
          gap: 4, borderTop: `1px solid ${t.topbarBorder}`, background: t.topbar,
        }}>
          {NAV_LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                color: isActive ? "#38BDF8" : "#E2E8F0",
                background: isActive ? "rgba(56,189,248,0.1)" : "transparent",
                textDecoration: "none",
              })}
            >
              {l.label}
            </NavLink>
          ))}
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            style={{
              padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              color: "#E2E8F0", textDecoration: "none", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <UserIcon size={15} />My Profile ({user?.name})
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              style={{
                padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                color: "#38BDF8", textDecoration: "none", display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <Shield size={15} />Admin Console
            </Link>
          )}
          <button
            onClick={() => { logout(); setMobileOpen(false); navigate("/login"); }}
            style={{
              padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              color: "#F87171", background: "none", border: "none",
              textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <LogOut size={15} />Sign out
          </button>
        </nav>
      )}
      <style>{`
        @media (max-width: 900px) {
          .np-topbar-inner { display: flex !important; justify-content: space-between; gap: 12px !important; }
          .np-topbar-center { display: none !important; }
          .np-topbar-actions { margin-left: auto; }
          .np-nav-desktop { display: none !important; }
          .np-nav-toggle { display: flex !important; }
          .np-user-name-label { display: none !important; }
        }
        @media (min-width: 901px) and (max-width: 1100px) {
          .np-topbar-search { display: none; }
        }
      `}</style>
    </header>
  );
}

export function PageHeader({ t, eyebrow, title, subtitle, IconComp, right, breadcrumbs }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
      borderBottom: `1px solid ${t.topbarBorder}`,
      padding: "28px 20px",
    }}>
      <div style={{
        maxWidth: 1040,
        margin: "0 auto",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          {breadcrumbs && (
            <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94A3B8", marginBottom: 10 }}>
              {breadcrumbs.map((b, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <span>/</span>}
                  {b.to ? (
                    <Link to={b.to} style={{ color: "#CBD5E1", textDecoration: "none", fontWeight: 500 }}>{b.label}</Link>
                  ) : (
                    <span style={{ color: "#38BDF8", fontWeight: 600 }}>{b.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          {eyebrow && !breadcrumbs && (
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#38BDF8",
              marginBottom: 8, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase",
            }}>
              {IconComp && <IconComp size={13} aria-hidden="true" />}{eyebrow}
            </div>
          )}
          <h1 style={{
            margin: subtitle ? "0 0 8px 0" : 0, color: "#FFFFFF",
            fontFamily: FONT_SERIF, fontSize: "clamp(22px, 2.8vw, 28px)", fontWeight: 700,
            letterSpacing: "-0.02em",
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: 0, fontSize: 13.5, color: "#CBD5E1", maxWidth: 680, lineHeight: 1.6 }}>
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </div>
    </div>
  );
}

export function Footer({ t }) {
  return (
    <footer style={{ borderTop: `1px solid ${t.borderLight}`, marginTop: 48, padding: "28px 20px", background: t.surface }}>
      <div style={{
        maxWidth: 1040, margin: "0 auto", display: "flex",
        justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: "linear-gradient(135deg, #2563EB, #0EA5E9)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Flag size={12} color="#FFFFFF" aria-hidden="true" />
          </div>
          <span style={{ fontSize: 12.5, color: t.textMuted, fontWeight: 500 }}>
            © {new Date().getFullYear()} NationPulse · Non-partisan tracking of Indian parliamentary & government activity.
          </span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <Link to="/bills" style={{ fontSize: 12.5, fontWeight: 500, color: t.textSub, textDecoration: "none" }}>Bills</Link>
          <Link to="/topics" style={{ fontSize: 12.5, fontWeight: 500, color: t.textSub, textDecoration: "none" }}>Topics</Link>
          <Link to="/mps" style={{ fontSize: 12.5, fontWeight: 500, color: t.textSub, textDecoration: "none" }}>MPs</Link>
          <Link to="/digest" style={{ fontSize: 12.5, fontWeight: 500, color: t.textSub, textDecoration: "none" }}>Weekly Digest</Link>
          <Link to="/about" style={{ fontSize: 12.5, fontWeight: 500, color: t.textSub, textDecoration: "none" }}>About & Sources</Link>
        </div>
      </div>
    </footer>
  );
}

export function ChevronDownIcon(props) {
  return <ChevronDown {...props} />;
}
