import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { MessageSquare, Send, Trash2, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useComments } from "../data/socialStore.js";
import { timeAgo, initials } from "../utils.js";

function CommentAvatar({ name, t }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", background: t.primary,
      color: "#FFFFFF", fontSize: 11.5, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

export default function CommentSection({ scope, t, id = "bill-discussion" }) {
  const { user, isAuthed } = useAuth();
  const { comments, addComment, deleteComment } = useComments(scope);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(e) {
    e.preventDefault();
    if (!draft.trim()) { setError("Write something before posting."); return; }
    if (draft.trim().length > 600) { setError("Keep comments under 600 characters."); return; }
    try {
      await addComment(user, draft);
      setDraft("");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section id={id} style={{
      background: t.surface, borderRadius: 14, padding: "20px 22px",
      border: `1px solid ${t.borderLight}`, marginBottom: 16, boxShadow: t.shadow,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8,
        marginBottom: 16, display: "flex", alignItems: "center", gap: 7,
      }}>
        <MessageSquare size={14} color={t.primary} aria-hidden="true" />
        {comments.length ? `${comments.length} CITIZEN COMMENT${comments.length === 1 ? "" : "S"}` : "CITIZEN DISCUSSION"}
      </div>

      {comments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          {comments.map(c => {
            const canDelete = isAuthed && user && (user.id === c.authorId || user.isAdmin);
            return (
              <div key={c.id} style={{
                display: "flex", gap: 12, padding: "12px 14px",
                borderRadius: 10, background: t.surface2, border: `1px solid ${t.borderLight}`,
              }}>
                <CommentAvatar name={c.authorName} t={t} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{c.authorName}</span>
                    <span style={{ fontSize: 11.5, color: t.textMuted }}>{timeAgo(c.createdAt)}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => deleteComment(c.id).catch(e => setError(e.message))}
                        aria-label="Delete comment"
                        title="Delete comment"
                        style={{
                          marginLeft: "auto", background: "none", border: "none",
                          color: t.textMuted, cursor: "pointer", display: "flex",
                          alignItems: "center", padding: 4, borderRadius: 6,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: 13.5, color: t.textSub, lineHeight: 1.6, wordBreak: "break-word" }}>
                    {c.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAuthed ? (
        <form onSubmit={submit}>
          <div style={{ display: "flex", gap: 12 }}>
            <CommentAvatar name={user.name} t={t} />
            <div style={{ flex: 1 }}>
              <textarea
                value={draft}
                maxLength={600}
                onChange={e => { setDraft(e.target.value); if (error) setError(""); }}
                placeholder="Share a constructive perspective on this bill..."
                rows={3}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${error ? t.danger : t.borderLight}`,
                  background: t.surface, color: t.text, fontSize: 13.5,
                  fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box",
                  transition: "border-color .18s ease, box-shadow .18s ease, background-color .18s ease",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 11.5, color: error ? t.danger : t.textMuted }}>
                  {error || `${draft.length}/600 characters`}
                </span>
                <button
                  type="submit"
                  style={{
                    padding: "8px 16px", background: t.primary, color: "#FFFFFF",
                    border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}
                >
                  <Send size={13} />Post comment
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: t.surface2, border: `1px dashed ${t.border}`,
          borderRadius: 10, padding: "14px 16px", flexWrap: "wrap",
        }}>
          <LogIn size={16} color={t.textMuted} aria-hidden="true" />
          <span style={{ fontSize: 13, color: t.textSub, flex: 1 }}>Sign in to join the discussion.</span>
          <button
            type="button"
            onClick={() => navigate("/login", { state: { from: location.pathname } })}
            style={{
              padding: "6px 14px", background: t.primary, color: "#FFFFFF",
              border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Sign in
          </button>
          <Link
            to="/signup"
            state={{ from: location.pathname }}
            style={{
              padding: "6px 14px", background: "none", color: t.primary,
              border: `1px solid ${t.primary}`, borderRadius: 7,
              fontSize: 12, fontWeight: 700, textDecoration: "none",
            }}
          >
            Create account
          </Link>
        </div>
      )}
    </section>
  );
}
