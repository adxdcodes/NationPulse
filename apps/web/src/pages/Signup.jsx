import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { UserPlus, Mail, Lock, User, AlertCircle, Flag } from "lucide-react";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Signup({ t }) {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setSubmitting(true);
    const result = await signup(name, email, password);
    setSubmitting(false);
    if (result.ok) navigate(from, { replace: true });
    else setError(result.error);
  }

  const inputWrap = { position: "relative", marginBottom: 14 };
  const iconStyle = { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textMuted };
  const inputStyle = { width: "100%", padding: "10px 14px 10px 34px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: t.surface, border: `1px solid ${t.borderLight}`, borderRadius: 14, padding: 28, boxShadow: t.shadow }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg,#3B82F6,#0EA5E9)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Flag size={20} color="#fff" aria-hidden="true" />
        </div>
        <h1 style={{ margin: "0 0 4px 0", fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 700, color: t.text }}>Create your account</h1>
        <p style={{ margin: "0 0 20px 0", fontSize: 13, color: t.textMuted }}>Free, and only needed if you want to comment or follow bills and MPs.</p>

        <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>NAME</label>
        <div style={inputWrap}>
          <User size={14} style={iconStyle} aria-hidden="true" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus required style={inputStyle} />
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>EMAIL</label>
        <div style={inputWrap}>
          <Mail size={14} style={iconStyle} aria-hidden="true" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inputStyle} />
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>PASSWORD</label>
        <div style={inputWrap}>
          <Lock size={14} style={iconStyle} aria-hidden="true" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required style={inputStyle} />
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>CONFIRM PASSWORD</label>
        <div style={{ ...inputWrap, marginBottom: error ? 8 : 18 }}>
          <Lock size={14} style={iconStyle} aria-hidden="true" />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" required style={inputStyle} />
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.danger, marginBottom: 14 }}>
            <AlertCircle size={13} aria-hidden="true" />{error}
          </div>
        )}
        <button type="submit" disabled={submitting} style={{ width: "100%", padding: "11px 0", background: t.primary, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
          <UserPlus size={15} />{submitting ? "Creating account..." : "Create account"}
        </button>
        <p style={{ margin: "16px 0 0 0", fontSize: 12.5, color: t.textMuted, textAlign: "center" }}>
          Already have an account? <Link to="/login" state={{ from }} style={{ color: t.primary, fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}
