import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User, LogOut, Shield, Bell, FileText, Tag, Users,
  ArrowRight, Trash2, CheckCircle2, Mail,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import { ProfileSkeleton } from "../components/LoadingUI.jsx";
import { LiveError } from "../api/useLive.jsx";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { Footer, PageHeader, EmptyState } from "../components/UI.jsx";
import { initials } from "../utils.js";

const SECTIONS = [
  { key: "bill", label: "Followed Bills", Icon: FileText, empty: "You aren't following any bills yet.", browseLink: "/bills", browseLabel: "Explore bills" },
  { key: "topic", label: "Followed Policy Topics", Icon: Tag, empty: "You aren't following any policy topics yet.", browseLink: "/topics", browseLabel: "Browse topics" },
  { key: "mp", label: "Followed MPs", Icon: Users, empty: "You aren't following any Members of Parliament yet.", browseLink: "/mps", browseLabel: "Browse MPs" },
];

export default function Profile({ dark, t }) {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [follows, setFollows] = useState({ bill: [], topic: [], mp: [] });
  const [billDetails, setBillDetails] = useState({});
  const [mpDetails, setMpDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const loadWatchlist = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const f = await api.myFollows(token);
      const norm = {
        bill: f?.bill || [],
        topic: f?.topic || [],
        mp: f?.mp || [],
      };
      setFollows(norm);

      // Hydrate bill titles & MP names for human-friendly display
      const [billsRes, mpsRes] = await Promise.all([
        norm.bill.length ? api.listBills({ page_size: 100 }).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
        norm.mp.length ? api.listMPs({}).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      ]);
      const bMap = {};
      for (const b of (billsRes?.items || [])) bMap[String(b.id)] = b;
      setBillDetails(bMap);

      const mMap = {};
      for (const m of (mpsRes?.items || [])) mMap[String(m.id)] = m;
      setMpDetails(mMap);
    } catch (e) {
      setError(e.message || "Could not load your watchlist.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  async function handleUnfollow(kind, targetId) {
    try {
      await api.unfollow(token, kind, String(targetId));
      setFollows(prev => ({
        ...prev,
        [kind]: (prev[kind] || []).filter(id => String(id) !== String(targetId)),
      }));
    } catch (e) {
      setError(e.message || "Failed to unfollow item.");
    }
  }

  if (!user) return null;

  const totalFollowed = (follows.bill?.length || 0) + (follows.topic?.length || 0) + (follows.mp?.length || 0);

  return (
    <div>
      <PageHeader
        t={t}
        eyebrow="CITIZEN ACCOUNT"
        IconComp={User}
        title={user.name}
        subtitle={`Signed in as ${user.email} · Manage your followed bills, policy topics, and Members of Parliament.`}
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {user.isAdmin && (
              <Link
                to="/admin"
                style={{
                  padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38BDF8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7,
                }}
              >
                <Shield size={15} />Admin Console
              </Link>
            )}
            <button
              type="button"
              onClick={() => { logout(); navigate("/login"); }}
              style={{
                padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: "rgba(248, 113, 113, 0.14)", border: "1px solid rgba(248, 113, 113, 0.35)",
                color: "#FCA5A5", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
                fontFamily: "inherit",
              }}
            >
              <LogOut size={15} />Sign out
            </button>
          </div>
        }
      />

      <LiveError error={error} />

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px 44px", width: "100%" }}>
        {/* Account Overview Cards */}
        <div className="np-mp-stats-grid" style={{ marginBottom: 28 }}>
          <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 14, padding: "16px 18px", boxShadow: t.shadow, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", background: t.primary,
              color: "#FFFFFF", fontSize: 16, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {initials(user.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 11.5, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={12} color={t.success} />{user.isAdmin ? "Administrator" : "Verified Member"}
              </div>
            </div>
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 14, padding: "16px 18px", boxShadow: t.shadow }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.primary, lineHeight: 1.1, marginBottom: 4 }}>{follows.bill?.length || 0}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
              <FileText size={13} />Followed Bills
            </div>
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 14, padding: "16px 18px", boxShadow: t.shadow }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.primary, lineHeight: 1.1, marginBottom: 4 }}>{follows.topic?.length || 0}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
              <Tag size={13} />Followed Topics
            </div>
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 14, padding: "16px 18px", boxShadow: t.shadow }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.primary, lineHeight: 1.1, marginBottom: 4 }}>{follows.mp?.length || 0}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
              <Users size={13} />Followed MPs
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 21, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={18} color={t.primary} />Your Personal Watchlist ({totalFollowed})
          </h2>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All Followed" },
              { key: "bill", label: `Bills (${follows.bill?.length || 0})` },
              { key: "topic", label: `Topics (${follows.topic?.length || 0})` },
              { key: "mp", label: `MPs (${follows.mp?.length || 0})` },
            ].map(tab => {
              const on = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "6px 13px", borderRadius: 8, fontSize: 12.5,
                    fontWeight: on ? 600 : 500,
                    border: `1px solid ${on ? t.primary : t.border}`,
                    background: on ? t.primary : t.surface,
                    color: on ? "#FFFFFF" : t.textSub,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <ProfileSkeleton />
        ) : totalFollowed === 0 ? (
          <EmptyState
            t={t}
            title="Your watchlist is empty"
            body="Click the 'Follow' button on any bill, policy topic, or Member of Parliament to bookmark them here for quick access."
            actionLabel="Browse legislative feed"
            onAction={() => navigate("/bills")}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {SECTIONS.filter(sec => activeTab === "all" || activeTab === sec.key).map(sec => {
              const ids = follows[sec.key] || [];
              const Icon = sec.Icon;
              return (
                <section key={sec.key} style={{
                  background: t.surface, border: `1px solid ${t.borderLight}`,
                  borderRadius: 16, padding: "20px 22px", boxShadow: t.shadow,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon size={16} color={t.primary} />
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>
                        {sec.label} ({ids.length})
                      </h3>
                    </div>
                    <Link to={sec.browseLink} style={{ fontSize: 12.5, fontWeight: 600, color: t.primary, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {sec.browseLabel}<ArrowRight size={13} />
                    </Link>
                  </div>

                  {!ids.length ? (
                    <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>{sec.empty}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {ids.map(id => {
                        const keyStr = String(id);
                        let title = `${sec.key === "bill" ? "Bill #" : sec.key === "mp" ? "MP #" : ""}${id}`;
                        let meta = "";
                        let href = `/topics/${encodeURIComponent(id)}`;

                        if (sec.key === "bill") {
                          href = `/bills/${id}`;
                          const b = billDetails[keyStr];
                          if (b) {
                            title = b.title;
                            meta = `${b.status} · ${b.topic || "Parliament"}`;
                          }
                        } else if (sec.key === "mp") {
                          href = `/mps/${id}`;
                          const m = mpDetails[keyStr];
                          if (m) {
                            title = m.name;
                            meta = `${m.party} · ${m.constituency}, ${m.state}`;
                          }
                        } else {
                          title = String(id);
                          meta = "Policy Topic";
                        }

                        return (
                          <div
                            key={keyStr}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              gap: 12, padding: "12px 14px", borderRadius: 10,
                              background: t.surface2, border: `1px solid ${t.borderLight}`,
                            }}
                          >
                            <Link to={href} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: meta ? 2 : 0 }}>
                                {title}
                              </div>
                              {meta && <div style={{ fontSize: 12, color: t.textMuted }}>{meta}</div>}
                            </Link>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                              <Link
                                to={href}
                                style={{
                                  padding: "6px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                                  background: t.surface, border: `1px solid ${t.border}`,
                                  color: t.textSub, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                                }}
                              >
                                View<ArrowRight size={12} />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleUnfollow(sec.key, id)}
                                aria-label={`Unfollow ${title}`}
                                title="Remove from watchlist"
                                style={{
                                  padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                                  background: t.dangerBg, border: `1px solid ${t.danger}`,
                                  color: t.danger, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                                  fontFamily: "inherit",
                                }}
                              >
                                <Trash2 size={13} />Unfollow
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Footer t={t} />
    </div>
  );
}
