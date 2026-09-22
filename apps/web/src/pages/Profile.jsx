import { Link, useNavigate } from "react-router-dom";
import { User, MessageSquare, Bell, Calendar, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { getFollowsForUser, getAllCommentsByUser } from "../data/socialStore.js";
import { getEventById, getMPById } from "../data/mockData.js";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { DomainBadge, Footer, PageHeader } from "../components/UI.jsx";
import { timeAgo, initials } from "../utils.js";

export default function Profile({ dark, t }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const follows = getFollowsForUser(user.email);
  const followedEvents = follows.event.map(getEventById).filter(Boolean);
  const followedMPs = follows.mp.map(getMPById).filter(Boolean);
  const followedTopics = follows.topic;
  const comments = getAllCommentsByUser(user.email);
  const totalFollows = followedEvents.length + followedMPs.length + followedTopics.length;

  return (
    <div>
      <div style={{ background: t.topbar, borderBottom: `1px solid ${t.topbarBorder}`, padding: "28px 20px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#3B82F6", color: "#fff", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {initials(user.name)}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: "0 0 3px 0", fontFamily: FONT_SERIF, fontSize: 21, fontWeight: 700, color: "#fff" }}>{user.name}</h1>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
              {user.email}{user.isAdmin && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#38BDF8", background: "rgba(56,189,248,0.15)", padding: "2px 7px", borderRadius: 99 }}>ADMIN</span>}
            </div>
          </div>
          <button onClick={() => { logout(); navigate("/"); }}
            style={{ padding: "8px 16px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
            <LogOut size={13} />Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <Bell size={15} color={t.primary} />Following ({totalFollows})
          </h2>
          {totalFollows === 0 ? (
            <p style={{ fontSize: 13, color: t.textMuted }}>You're not following anything yet. Follow a bill, MP, or topic to see updates here.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {followedEvents.map(ev => (
                <Link key={`e${ev.id}`} to={`/event/${ev.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 9, textDecoration: "none" }}>
                  <DomainBadge domain={ev.domain} dark={dark} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{ev.title}</span>
                </Link>
              ))}
              {followedMPs.map(mp => (
                <Link key={`m${mp.id}`} to={`/mps/${mp.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 9, textDecoration: "none" }}>
                  <User size={13} color={t.textMuted} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{mp.name}</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>MP</span>
                </Link>
              ))}
              {followedTopics.map(topic => (
                <Link key={`t${topic}`} to={`/topics/${encodeURIComponent(topic)}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 9, textDecoration: "none" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{topic}</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>Topic</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <MessageSquare size={15} color={t.primary} />Your comments ({comments.length})
          </h2>
          {comments.length === 0 ? (
            <p style={{ fontSize: 13, color: t.textMuted }}>You haven't commented on anything yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {comments.map(c => {
                const [, id] = c.scope.split(":");
                const ev = getEventById(id);
                return (
                  <Link key={c.id} to={ev ? `/event/${ev.id}` : "#"} style={{ padding: "10px 12px", background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 9, textDecoration: "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.primary }}>{ev?.title || "Deleted item"}</span>
                      <span style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}><Calendar size={11} />{timeAgo(c.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>{c.text}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {user.isAdmin && (
          <section style={{ marginTop: 30, padding: 16, background: t.accentBg, borderRadius: 12, border: "1px solid rgba(14,165,233,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>You have admin access</div>
            <div style={{ fontSize: 12.5, color: t.textSub, marginBottom: 10 }}>Review incoming bills, control AI processing, and approve content for the public site.</div>
            <Link to="/admin" style={{ fontSize: 12.5, fontWeight: 700, color: t.primary, textDecoration: "none" }}>Go to admin console →</Link>
          </section>
        )}
      </div>
      <Footer t={t} />
    </div>
  );
}
