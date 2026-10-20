import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  UserPlus, Mail, Lock, User, AlertCircle, Flag, Eye, EyeOff,
  ShieldCheck, BookOpen, Sparkles, Sun, Moon, CheckCircle2,
} from "lucide-react";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";

const BENEFITS = [
  {
    Icon: BookOpen,
    title: "Full access to parliamentary bills & digests",
    desc: "Browse every reviewed bill, status progression, and weekly legislative summary.",
  },
  {
    Icon: ShieldCheck,
    title: "Personalised watchlist & MP tracking",
    desc: "Follow specific policy topics, bills, and Members of Parliament in one place.",
  },
  {
    Icon: Sparkles,
    title: "Interactive civic discussion & AI Q&A",
    desc: "Ask Pulse AI questions about any bill and participate in moderated discussions.",
  },
];

export default function Signup({ t, dark, toggleTheme }) {
  const { signup, loginWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/bills";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    const result = await signup(name.trim(), email.trim(), password);
    setSubmitting(false);
    if (result.ok) navigate(from, { replace: true });
    else setError(result.error);
  }

  async function handleGoogleSuccess(credential) {
    setError("");
    setSubmitting(true);
    const result = await loginWithGoogle(credential);
    setSubmitting(false);
    if (result.ok) navigate(from, { replace: true });
    else setError(result.error);
  }


  const inputWrap = { position: "relative", marginBottom: 14 };
  const iconStyle = { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t.textMuted };
  const inputStyle = {
    width: "100%", padding: "10px 14px 10px 38px",
    borderRadius: 10, border: `1px solid ${t.border}`,
    background: t.surface2, color: t.text, fontSize: 13.5,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div className="np-auth-split" style={{ background: t.bg }}>
      {/* Left Civic Brand Hero Panel */}
      <div
        className="np-auth-hero-panel"
        style={{
          background: "linear-gradient(145deg, #0F172A 0%, #1E3A8A 100%)",
          color: "#FFFFFF",
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 44 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #2563EB, #0EA5E9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(14, 165, 233, 0.35)",
            }}>
              <Flag size={20} color="#FFFFFF" aria-hidden="true" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>
              Nation<span style={{ color: "#38BDF8" }}>Pulse</span>
            </span>
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 99,
            background: "rgba(56, 189, 248, 0.14)", border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#7DD3FC", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6,
            marginBottom: 18,
          }}>
            <CheckCircle2 size={13} />CITIZEN REGISTRATION
          </div>

          <h1 style={{
            fontFamily: FONT_SERIF,
            fontSize: "clamp(28px, 3.2vw, 38px)",
            fontWeight: 700,
            lineHeight: 1.22,
            margin: "0 0 16px 0",
            maxWidth: 520,
          }}>
            Join NationPulse to explore Indian legislation with clarity.
          </h1>
          <p style={{ fontSize: 15, color: "#CBD5E1", lineHeight: 1.7, maxWidth: 480, margin: "0 0 36px 0" }}>
            Create your free citizen account to unlock all legislative tracking tools, MP performance records, and AI-assisted bill analysis.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 460 }}>
            {BENEFITS.map(({ Icon, title, desc }) => (
              <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "#38BDF8",
                }}>
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC", marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.55 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#94A3B8", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 20 }}>
          Independent, non-partisan tracking of Indian parliamentary activity · Primary source linked
        </div>
      </div>

      {/* Right Signup Form Panel */}
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", padding: "32px 24px", position: "relative",
      }}>
        {toggleTheme && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              position: "absolute", top: 20, right: 20,
              padding: "8px 12px", borderRadius: 8,
              border: `1px solid ${t.border}`, background: t.surface,
              color: t.textSub, fontSize: 12, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
            }}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            {dark ? "Light theme" : "Dark theme"}
          </button>
        )}

        <form
          onSubmit={submit}
          style={{
            width: "100%", maxWidth: 420,
            background: t.surface, border: `1px solid ${t.borderLight}`,
            borderRadius: 16, padding: "32px 32px", boxShadow: t.shadowHover,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg, #2563EB, #0EA5E9)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Flag size={18} color="#FFFFFF" aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.primary, letterSpacing: 0.7 }}>NEW ACCOUNT</div>
              <h2 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 700, color: t.text }}>
                Create your account
              </h2>
            </div>
          </div>

          <p style={{ margin: "0 0 20px 0", fontSize: 13.5, color: t.textSub, lineHeight: 1.55 }}>
            Register to access NationPulse&apos;s legislative feed, follow bills and MPs, and join discussions.
          </p>

          {error && (
            <div role="alert" style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              fontSize: 12.5, color: t.danger, background: t.dangerBg,
              border: `1px solid ${t.danger}`, borderRadius: 10,
              padding: "10px 12px", marginBottom: 16, lineHeight: 1.45,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <GoogleSignInButton
              text="signup_with"
              dark={dark}
              t={t}
              onSuccess={handleGoogleSuccess}
              onError={(msg) => setError(msg)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: t.borderLight }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.6 }}>
              OR REGISTER WITH EMAIL
            </span>
            <div style={{ flex: 1, height: 1, background: t.borderLight }} />
          </div>

          <label htmlFor="signup-name" style={{ fontSize: 11.5, fontWeight: 700, color: t.textSub, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>

            FULL NAME
          </label>
          <div style={inputWrap}>
            <User size={15} style={iconStyle} aria-hidden="true" />
            <input
              id="signup-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              autoFocus
              required
              style={inputStyle}
            />
          </div>

          <label htmlFor="signup-email" style={{ fontSize: 11.5, fontWeight: 700, color: t.textSub, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
            EMAIL ADDRESS
          </label>
          <div style={inputWrap}>
            <Mail size={15} style={iconStyle} aria-hidden="true" />
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              style={inputStyle}
            />
          </div>

          <label htmlFor="signup-password" style={{ fontSize: 11.5, fontWeight: 700, color: t.textSub, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
            PASSWORD
          </label>
          <div style={inputWrap}>
            <Lock size={15} style={iconStyle} aria-hidden="true" />
            <input
              id="signup-password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
              style={{ ...inputStyle, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              aria-label={showPwd ? "Hide password" : "Show password"}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: t.textMuted,
                padding: 4, display: "flex", alignItems: "center", cursor: "pointer",
              }}
            >
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <label htmlFor="signup-confirm" style={{ fontSize: 11.5, fontWeight: 700, color: t.textSub, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
            CONFIRM PASSWORD
          </label>
          <div style={{ ...inputWrap, marginBottom: 22 }}>
            <Lock size={15} style={iconStyle} aria-hidden="true" />
            <input
              id="signup-confirm"
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "12px 16px",
              background: t.primary, color: "#FFFFFF",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.75 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: "inherit", boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
            }}
          >
            <UserPlus size={16} />{submitting ? "Creating account..." : "Create Account & Continue"}
          </button>

          <div style={{
            marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.borderLight}`,
            textAlign: "center", fontSize: 13, color: t.textSub,
          }}>
            Already have an account?{" "}
            <Link to="/login" state={{ from }} style={{ color: t.primary, fontWeight: 700, textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
