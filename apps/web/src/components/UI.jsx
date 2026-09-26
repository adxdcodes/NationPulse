import { useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Search, Moon, Sun, Shield, ArrowRight,
  Calendar, Tag, Building, Check, X,
  ArrowLeftRight, BarChart2, SearchX, Flag, Menu, ChevronDown,
  Bell, BellRing, MessageSquare, User as UserIcon, LogOut, LogIn, UserPlus,
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <Icon size={11} aria-hidden="true" />{domain}
    </span>
  );
}

export function StatusBadge({ status, dark }) {
  const m = STATUS_META[status] || STATUS_META["Pending"];
  const c = dark ? m.dark : m.light;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 500, background: c.bg, color: c.text }}>
      {status}
    </span>
  );
}

export function PartyBadge({ bloc, dark }) {
  const m = PARTY_META[bloc] || PARTY_META["Independent"];
  const c = dark ? m.dark : m.light;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text }}>
      {bloc}
    </span>
  );
}

// kind: "event" | "topic" | "mp". Prompts sign-in if the visitor isn't authed.
// Pass onDark when placing this on the navy topbar/header background.
export function FollowButton({ kind, id, t, size = "md", onDark = false }) {
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { following, toggle } = useFollow(user?.email, kind, id);
  const pad = size === "sm" ? "5px 12px" : "7px 16px";
  const fontSize = size === "sm" ? 11 : 12.5;

  function onClick() {
    if (!isAuthed) { navigate("/login", { state: { from: location.pathname } }); return; }
    toggle();
  }

  const style = onDark
    ? { border: `1px solid ${following ? "#38BDF8" : "rgba(255,255,255,0.2)"}`, background: following ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.06)", color: following ? "#7DD3FC" : "rgba(255,255,255,0.85)" }
    : { border: `1px solid ${following ? t.primary : t.border}`, background: following ? t.primary : "transparent", color: following ? "#fff" : t.textSub };

  return (
    <button onClick={onClick} type="button"
      style={{ padding: pad, borderRadius: 8, fontSize, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", transition: "all 0.15s", flexShrink: 0, ...style }}>
      {following ? <BellRing size={size === "sm" ? 12 : 13} /> : <Bell size={size === "sm" ? 12 : 13} />}
      {following ? "Following" : "Follow"}
    </button>
  );
}

export function CommentCountBadge({ scope, t }) {
  const count = 0;
  if (!count) return (
    <span style={{ fontSize: 11, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 3 }}>
      <MessageSquare size={11} aria-hidden="true" />Discuss
    </span>
  );
  return (
    <span style={{ fontSize: 11, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 3 }}>
      <MessageSquare size={11} aria-hidden="true" />{count} comment{count === 1 ? "" : "s"}
    </span>
  );
}

export function BillStepper({ stages, stage, dark, t }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", padding: "8px 4px 6px" }}>
      {stages.map((s, i) => {
        const done = i < stage;
        const active = i === stage;
        const circleColor = done ? "#65BF70" : active ? "#94B7FA" : t.border;
        return (
          <div key={`${s}-${i}`} style={{ display: "flex", alignItems: "flex-start", flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 76, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, minWidth: 32, minHeight: 32,
                boxSizing: "border-box", flexShrink: 0, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${circleColor}`,
                background: done ? "#65BF70" : active ? "#94B7FA" : "transparent",
                color: done || active ? "#fff" : t.textMuted,
                // A round shadow, not an outline or clipped overlay, keeps the active halo circular.
                boxShadow: active ? `0 0 0 5px ${dark ? "rgba(148,183,250,.20)" : "rgba(65,113,190,.16)"}` : "none",
                transition: "background .25s, border-color .25s, box-shadow .25s",
              }}>
                {done ? <Check size={17} strokeWidth={3} aria-hidden="true" />
                  : active ? <span style={{ width: 10, height: 10, flexShrink: 0, borderRadius: "50%", background: "#fff" }} />
                  : <span style={{ fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: 11, textAlign: "center", width: 76, lineHeight: 1.3,
                color: done || active ? t.primary : t.textMuted, fontWeight: done || active ? 700 : 400 }}>
                {s}
              </span>
            </div>
            {i < stages.length - 1 && <div style={{ width: 36, height: 3, margin: "15px 2px 0", flexShrink: 0,
              borderRadius: 99, background: done ? "#65BF70" : t.borderLight }} />}
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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}><BarChart2 size={12} aria-hidden="true" />Budget utilisation</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: dark ? "#4ADE80" : "#15803D" }}>{pct}%</span>
      </div>
      <div style={{ background: t.borderLight, borderRadius: 99, height: 7, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: dark ? "#22C55E" : "#16A34A", transition: "width 1s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: t.textMuted }}>
        <span>Rs {(utilised / 1000).toFixed(0)}k Cr spent</span>
        <span>Rs {(allocation / 1000).toFixed(0)}k Cr allocated</span>
      </div>
    </div>
  );
}

export function DiffTable({ changes, t }) {
  return (
    <div style={{ border: `1px solid ${t.borderLight}`, borderRadius: 9, overflow: "hidden", marginTop: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 0.6, display: "flex", alignItems: "center", gap: 5, background: "#FFF1F2", color: "#BE123C" }}><X size={12} />BEFORE</div>
        <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 0.6, display: "flex", alignItems: "center", gap: 5, background: "#F0FDF4", color: "#15803D", borderLeft: `1px solid ${t.borderLight}` }}><Check size={12} />AFTER</div>
      </div>
      {changes.map((c, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${t.borderLight}` }}>
          <div style={{ padding: "11px 14px", fontSize: 13, color: t.textSub, lineHeight: 1.6 }}>{c.before}</div>
          <div style={{ padding: "11px 14px", fontSize: 13, color: t.textSub, lineHeight: 1.6, borderLeft: `1px solid ${t.borderLight}` }}>{c.after}</div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ t }) {
  return (
    <div style={{ background: t.surface, borderRadius: 22, padding: "22px 24px", border: `1px solid ${t.borderLight}` }}>
      {[55, 92, 70, 40].map((w, i) => (
        <div key={i} style={{ width: `${w}%`, height: i === 1 ? 18 : 13, background: t.borderLight, borderRadius: 6, marginBottom: 10, animation: "shimmer 1.3s infinite" }} />
      ))}
    </div>
  );
}

export function Section({ IconComp, label, t, children }) {
  return (
    <div style={{ background: t.surface, borderRadius: 12, padding: 20, border: `1px solid ${t.borderLight}`, marginBottom: 12, boxShadow: t.shadow }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.7, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <IconComp size={13} color={t.primary} aria-hidden="true" />{label}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ t, title = "No results found", body = "Try adjusting your filters or search query.", actionLabel, onAction }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <SearchX size={44} style={{ color: t.border, display: "block", margin: "0 auto 16px" }} aria-hidden="true" />
      <h3 style={{ fontSize: 16, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>{title}</h3>
      <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 18px 0" }}>{body}</p>
      {actionLabel && (
        <button onClick={onAction}
          style={{ padding: "9px 20px", background: t.primary, color: "#fff", border: "none", borderRadius: 13, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          <X size={14} />{actionLabel}
        </button>
      )}
    </div>
  );
}

export function UniversalCard({ ev, dark, t }) {
  const [hov, setHov] = useState(false);
  const navigate = useNavigate();
  return (
    <div
      role="link" tabIndex={0}
      onClick={() => navigate(`/event/${ev.id}`)}
      onKeyDown={e => { if (e.key === "Enter") navigate(`/event/${ev.id}`); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: t.surface, borderRadius: 22, padding: "22px 24px", border: `1px solid ${hov ? t.primary : t.borderLight}`, boxShadow: hov ? t.shadowHover : t.shadow, cursor: "pointer", transform: hov ? "translateY(-2px)" : "translateY(0)", transition: "all 0.2s cubic-bezier(.4,0,.2,1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
        <DomainBadge domain={ev.domain} dark={dark} />
        <StatusBadge status={ev.status} dark={dark} />
        {ev.amend && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 500, background: dark ? "#1A0A2E" : "#FAF5FF", color: dark ? "#C084FC" : "#7E22CE" }}>
            <ArrowLeftRight size={11} aria-hidden="true" />Amendment
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Calendar size={11} aria-hidden="true" />{ev.date}
        </span>
      </div>
      <h3 style={{ margin: "0 0 7px 0", fontFamily: FONT_SERIF, fontSize: 16, fontWeight: 700, color: t.text, lineHeight: 1.4 }}>{ev.title}</h3>
      <p style={{ margin: "0 0 12px 0", fontSize: 13, color: t.textSub, lineHeight: 1.65 }}>{ev.summary}</p>
      <div style={{ background: t.accentBg, borderLeft: `3px solid ${t.accent}`, borderRadius: "0 7px 7px 0", padding: "8px 12px", marginBottom: (ev.allocation || ev.stages?.length) ? 12 : 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.accentText, letterSpacing: 0.6, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
          WHY IT MATTERS
        </div>
        <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>{ev.why}</div>
      </div>
      {ev.allocation && <div style={{ marginTop: 12 }}><BudgetBar allocation={ev.allocation} utilised={ev.utilised} dark={dark} t={t} /></div>}
      {ev.stages?.length > 0 && <div style={{ marginTop: 12 }}><BillStepper stages={ev.stages} stage={ev.stage} dark={dark} t={t} /></div>}
      <div style={{ display: "flex", gap: 6, marginTop: 13, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: t.textMuted, background: t.surface2, border: `1px solid ${t.borderLight}`, padding: "2px 8px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 3 }}>
          <Tag size={11} aria-hidden="true" />{ev.topic}
        </span>
        {ev.ministry && (
          <span style={{ fontSize: 11, color: t.textMuted, background: t.surface2, border: `1px solid ${t.borderLight}`, padding: "2px 8px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Building size={11} aria-hidden="true" />{ev.ministry}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: t.primary, display: "inline-flex", alignItems: "center", gap: 3 }}>
          View details<ArrowRight size={13} aria-hidden="true" />
        </span>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.borderLight}` }}>
        <span style={{fontSize:11,color:t.textMuted}}>{ev.commentCount ?? 0} comments</span>
      </div>
    </div>
  );
}

export function FilterBar({ filters, setFilters, t, domains = [], topics = [], statuses = [] }) {
  const chip = (active) => ({
    padding: "4px 11px", borderRadius: 99, fontSize: 12, fontWeight: 500,
    border: `1px solid ${active ? t.primary : t.border}`,
    background: active ? t.primary : "transparent", color: active ? "#fff" : t.textSub,
    cursor: "pointer", transition: "all 0.16s", whiteSpace: "nowrap",
    display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "inherit",
  });
  return (
    <div style={{ background: t.surface, borderBottom: `1px solid ${t.borderLight}`, padding: "0 20px", display: "flex", alignItems: "center", gap: 20, overflowX: "auto", minHeight: 46 }}>
      {[["DOMAIN", domains, "domain"], ["TOPIC", topics, "topic"], ["STATUS", statuses, "status"]].map(([label, opts, key]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.7 }}>{label}</span>
          {opts.map(o => {
            const dm = DOMAIN_META[o];
            return (
              <button key={o} style={chip(filters[key] === o)} onClick={() => setFilters(f => ({ ...f, [key]: f[key] === o ? "All" : o }))}>
                {key === "domain" && dm && <dm.Icon size={11} aria-hidden="true" />}{o}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const NAV_LINKS = [
  { to: "/", label: "Feed" },
  { to: "/topics", label: "Topics" },
  { to: "/mps", label: "MPs" },
  { to: "/digest", label: "Digest" },
  { to: "/about", label: "About" },
];

function UserMenu({ t }) {
  const { user, isAuthed, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!isAuthed) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Link to="/login"
          style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
          <LogIn size={13} />Sign in
        </Link>
        <Link to="/signup"
          style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "1px solid #38BDF8", color: "#38BDF8", background: "rgba(56,189,248,0.1)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
          <UserPlus size={13} />Sign up
        </Link>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Account menu"
        style={{ width: 34, height: 34, borderRadius: "50%", background: "#3B82F6", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {initials(user.name)}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div style={{ position: "absolute", right: 0, top: 42, width: 200, background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 10, boxShadow: t.shadowHover, zIndex: 20, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${t.borderLight}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{user.name}</div>
              <div style={{ fontSize: 11, color: t.textMuted }}>{user.email}</div>
            </div>
            <Link to="/profile" onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", fontSize: 13, color: t.textSub, textDecoration: "none" }}>
              <UserIcon size={14} />My profile
            </Link>
            <button onClick={() => { logout(); setOpen(false); navigate("/"); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", fontSize: 13, color: t.danger, background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <LogOut size={14} />Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MobileAuthLinks({ onNavigate }) {
  const { user, isAuthed, logout } = useAuth();
  const navigate = useNavigate();
  const linkStyle = { padding: "9px 4px", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 };
  if (!isAuthed) {
    return (
      <>
        <Link to="/login" onClick={onNavigate} style={linkStyle}><LogIn size={14} />Sign in</Link>
        <Link to="/signup" onClick={onNavigate} style={{ ...linkStyle, color: "#38BDF8" }}><UserPlus size={14} />Sign up</Link>
      </>
    );
  }
  return (
    <>
      <Link to="/profile" onClick={onNavigate} style={linkStyle}><UserIcon size={14} />My profile ({user.name})</Link>
      <button onClick={() => { logout(); onNavigate(); navigate("/"); }}
        style={{ ...linkStyle, background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "#FCA5A5" }}>
        <LogOut size={14} />Sign out
      </button>
    </>
  );
}

export function TopBar({ t, dark, toggle }) {
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  function submitSearch(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`);
  }

  const linkStyle = ({ isActive }) => ({
    fontSize: 13, fontWeight: 600, color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
    textDecoration: "none", padding: "6px 4px", borderBottom: `2px solid ${isActive ? "#38BDF8" : "transparent"}`,
    transition: "all 0.15s", whiteSpace: "nowrap",
  });

  return (
    <div style={{ background: "linear-gradient(110deg,#111d32,#172f59)", borderBottom: `1px solid ${t.topbarBorder}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", padding: "0 20px", gap: 14 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, textDecoration: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,#3B82F6,#0EA5E9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Flag size={14} color="#fff" aria-hidden="true" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: -0.3 }}>
            Nation<span style={{ color: "#38BDF8" }}>Pulse</span>
          </span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }} className="np-nav-desktop">
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} style={linkStyle}>{l.label}</NavLink>
          ))}
        </nav>
        <form onSubmit={submitSearch} style={{ flex: 1, maxWidth: 380, position: "relative" }}>
          <Search size={14} aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.38)", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills, schemes, judgments..."
            style={{ width: "100%", padding: "7px 12px 7px 34px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border 0.18s, background 0.18s" }}
            onFocus={e => { e.target.style.borderColor = "rgba(59,130,246,0.6)"; e.target.style.background = "rgba(255,255,255,0.12)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.14)"; e.target.style.background = "rgba(255,255,255,0.08)"; }} />
        </form>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={toggle} aria-label="Toggle theme"
            style={{ width: 34, height: 34, borderRadius: 7, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.75)", cursor: "pointer", transition: "background 0.18s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.14)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <UserMenu t={t} />
          <Link to="/admin" aria-label="Admin"
            style={{ width: 34, height: 34, borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.07)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <Shield size={15} />
          </Link>
          <button aria-label="Menu" onClick={() => setMobileOpen(o => !o)} className="np-nav-toggle"
            style={{ display: "none", width: 34, height: 34, borderRadius: 7, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
            <Menu size={16} />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav style={{ display: "flex", flexDirection: "column", padding: "6px 20px 12px", gap: 2 }}>
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({ padding: "9px 4px", fontSize: 14, fontWeight: 600, color: isActive ? "#38BDF8" : "rgba(255,255,255,0.75)", textDecoration: "none" })}>
              {l.label}
            </NavLink>
          ))}
          <MobileAuthLinks onNavigate={() => setMobileOpen(false)} />
        </nav>
      )}
      <style>{`
        @media (max-width: 900px) {
          .np-nav-desktop { display: none !important; }
          .np-nav-toggle { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

export function PageHeader({ t, eyebrow, title, subtitle, IconComp, right }) {
  return (
    <div style={{ background: t.topbar, borderBottom: `1px solid ${t.topbarBorder}`, padding: "28px 20px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          {eyebrow && (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#38BDF8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              {IconComp && <IconComp size={13} aria-hidden="true" />}{eyebrow}
            </div>
          )}
          <h1 style={{ margin: subtitle ? "0 0 6px 0" : 0, color: "#fff", fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 700 }}>{title}</h1>
          {subtitle && <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.55)", maxWidth: 640, lineHeight: 1.6 }}>{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}

export function Footer({ t }) {
  return (
    <footer style={{ borderTop: `1px solid ${t.borderLight}`, marginTop: 40, padding: "28px 20px", background: t.surface }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          © {new Date().getFullYear()} NationPulse · Independent, non-partisan tracking of Indian government activity.
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Link to="/about" style={{ fontSize: 12, color: t.textMuted, textDecoration: "none" }}>About</Link>
          <Link to="/topics" style={{ fontSize: 12, color: t.textMuted, textDecoration: "none" }}>Topics</Link>
          <Link to="/digest" style={{ fontSize: 12, color: t.textMuted, textDecoration: "none" }}>Digest</Link>
        </div>
      </div>
    </footer>
  );
}

export function ChevronDownIcon(props) {
  return <ChevronDown {...props} />;
}
