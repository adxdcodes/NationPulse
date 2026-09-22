import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { MessageSquare, Send, Trash2, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useComments } from "../data/socialStore.js";
import { timeAgo, initials } from "../utils.js";

function CommentAvatar({ name, t }) {
  return (
    <div style={{ width: 30, height: 30, borderRadius: "50%", background: t.primary, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

export default function CommentSection({ scope, t, dark }) {
  const { user, isAuthed } = useAuth();
  const { comments, addComment, deleteComment } = useComments(scope);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  function submit(e) {
    e.preventDefault();
    if (!draft.trim()) { setError("Write something before posting."); return; }
    if (draft.trim().length > 600) { setError("Keep comments under 600 characters."); return; }
    addComment(user, draft);
    setDraft("");
    setError("");
  }

  return (
    <div style={{ background: t.surface, borderRadius: 12, padding: 20, border: `1px solid ${t.borderLight}`, marginBottom: 12, boxShadow: t.shadow }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.7, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
        <MessageSquare size={13} color={t.primary} aria-hidden="true" />
        {comments.length ? `${comments.length} COMMENT${comments.length === 1 ? "" : "S"}` : "DISCUSSION"}
      </div>

      {comments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <CommentAvatar name={c.authorName} t={t} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{c.authorName}</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{timeAgo(c.createdAt)}</span>
                  {isAuthed && user.email === c.authorEmail && (
                    <button onClick={() => deleteComment(c.id)} aria-label="Delete comment"
                      style={{ marginLeft: "auto", background: "none", border: "none", color: t.textMuted, cursor: "pointer", display: "flex", alignItems: "center", padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p style={{ margin: "3px 0 0 0", fontSize: 13.5, color: t.textSub, lineHeight: 1.6, wordBreak: "break-word" }}>{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAuthed ? (
        <form onSubmit={submit}>
          <div style={{ display: "flex", gap: 10 }}>
            <CommentAvatar name={user.name} t={t} />
            <div style={{ flex: 1 }}>
              <textarea
                value={draft}
                onChange={e => { setDraft(e.target.value); if (error) setError(""); }}
                placeholder="Share your view on this..."
                rows={2}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${error ? t.danger : t.border}`, background: t.surface2, color: t.text, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: error ? t.danger : t.textMuted }}>{error || `${draft.length}/600`}</span>
                <button type="submit" style={{ padding: "7px 14px", background: t.primary, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                  <Send size={12} />Post
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.surface2, border: `1px dashed ${t.border}`, borderRadius: 10, padding: "14px 16px", flexWrap: "wrap" }}>
          <LogIn size={16} color={t.textMuted} aria-hidden="true" />
          <span style={{ fontSize: 13, color: t.textSub, flex: 1 }}>Sign in to join the discussion.</span>
          <button onClick={() => navigate("/login", { state: { from: location.pathname } })}
            style={{ padding: "6px 14px", background: t.primary, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Sign in
          </button>
          <Link to="/signup" state={{ from: location.pathname }}
            style={{ padding: "6px 14px", background: "none", color: t.primary, border: `1px solid ${t.primary}`, borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            Create account
          </Link>
        </div>
      )}
    </div>
  );
}
