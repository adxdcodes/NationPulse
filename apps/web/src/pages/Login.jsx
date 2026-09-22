import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogIn, Mail, Lock, AlertCircle, Flag } from "lucide-react";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login({ t }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.ok) navigate(from, { replace: true });
    else setError(result.error);
  }

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 14, padding: 28, boxShadow: t.shadow }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg,#3B82F6,#0EA5E9)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Flag size={20} color="#fff" aria-hidden="true" />
        </div>
        <h1 style={{ margin: "0 0 4px 0", fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 700, color: t.text }}>Welcome back</h1>
        <p style={{ margin: "0 0 20px 0", fontSize: 13, color: t.textMuted }}>Sign in to comment, follow bills, and personalise your feed. Admins sign in here too.</p>

        <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>EMAIL</label>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Mail size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} aria-hidden="true" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus required
            style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>PASSWORD</label>
        <div style={{ position: "relative", marginBottom: error ? 8 : 18 }}>
          <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} aria-hidden="true" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required
            style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: 9, border: `1px solid ${error ? t.danger : t.border}`, background: t.surface2, color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.danger, marginBottom: 14 }}>
            <AlertCircle size={13} aria-hidden="true" />{error}
          </div>
        )}
        <button type="submit" disabled={submitting} style={{ width: "100%", padding: "11px 0", background: t.primary, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
          <LogIn size={15} />{submitting ? "Signing in..." : "Sign in"}
        </button>
        <p style={{ margin: "16px 0 0 0", fontSize: 12.5, color: t.textMuted, textAlign: "center" }}>
          New here? <Link to="/signup" state={{ from }} style={{ color: t.primary, fontWeight: 600, textDecoration: "none" }}>Create an account</Link>
        </p>
        <p style={{ margin: "10px 0 0 0", fontSize: 11, color: t.textMuted, textAlign: "center" }}>
          Browsing is free for everyone — an account is only needed to comment, follow, personalise, or moderate.
        </p>
      </form>
    </div>
  );
}
