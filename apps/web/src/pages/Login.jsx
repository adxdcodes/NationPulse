import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  LogIn, Mail, Lock, AlertCircle, Flag, Eye, EyeOff,
  ShieldCheck, BookOpen, Sparkles, Sun, Moon, CheckCircle2,
} from "lucide-react";
import { FONT_SERIF } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";

const HIGHLIGHTS = [
  {
    Icon: BookOpen,
    title: "Plain-language legislative summaries",
    desc: "Every parliamentary bill distilled into what happened and why it matters to citizens.",
  },
  {
    Icon: ShieldCheck,
    title: "Verified primary sources",
    desc: "Direct links to official Lok Sabha, Rajya Sabha, and Gazette documents.",
  },
  {
    Icon: Sparkles,
    title: "Pulse AI parliamentary assistant",
    desc: "Ask questions across bill texts with source-grounded citations.",
  },
];

export default function Login({ t, dark, toggleTheme }) {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/bills";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email.trim(), password);
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
          position: "relative",
          overflow: "hidden",
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
            <CheckCircle2 size={13} />AUTHENTICATED CIVIC INTELLIGENCE PORTAL
          </div>

          <h1 style={{
            fontFamily: FONT_SERIF,
            fontSize: "clamp(28px, 3.2vw, 38px)",
            fontWeight: 700,
            lineHeight: 1.22,
            margin: "0 0 16px 0",
            maxWidth: 520,
          }}>
            Your Parliament, clearly explained and source-verified.
          </h1>
          <p style={{ fontSize: 15, color: "#CBD5E1", lineHeight: 1.7, maxWidth: 480, margin: "0 0 36px 0" }}>
            Track Lok Sabha and Rajya Sabha legislation, understand policy impact in plain English, and follow the topics and MPs that matter to you.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 460 }}>
            {HIGHLIGHTS.map(({ Icon, title, desc }) => (
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

      {/* Right Authentication Form Panel */}
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
            width: "100%", maxWidth: 410,
            background: t.surface, border: `1px solid ${t.borderLight}`,
            borderRadius: 16, padding: "34px 32px", boxShadow: t.shadowHover,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg, #2563EB, #0EA5E9)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Flag size={18} color="#FFFFFF" aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.primary, letterSpacing: 0.7 }}>MEMBER ACCESS</div>
              <h2 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 700, color: t.text }}>
                Sign in to NationPulse
              </h2>
            </div>
          </div>

          <p style={{ margin: "0 0 24px 0", fontSize: 13.5, color: t.textSub, lineHeight: 1.55 }}>
            Authentication is required to access legislative feeds, MP directories, weekly digests, and Pulse AI.
          </p>

          {error && (
            <div role="alert" style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              fontSize: 12.5, color: t.danger, background: t.dangerBg,
              border: `1px solid ${t.danger}`, borderRadius: 10,
              padding: "10px 12px", marginBottom: 18, lineHeight: 1.45,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <GoogleSignInButton
              text="signin_with"
              dark={dark}
              t={t}
              onSuccess={handleGoogleSuccess}
              onError={(msg) => setError(msg)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: t.borderLight }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.6 }}>
              OR SIGN IN WITH EMAIL
            </span>
            <div style={{ flex: 1, height: 1, background: t.borderLight }} />
          </div>

          <label htmlFor="login-email" style={{ fontSize: 11.5, fontWeight: 700, color: t.textSub, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>

            EMAIL ADDRESS
          </label>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
              style={{
                width: "100%", padding: "11px 14px 11px 38px",
                borderRadius: 10, border: `1px solid ${t.border}`,
                background: t.surface2, color: t.text, fontSize: 13.5,
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>

          <label htmlFor="login-password" style={{ fontSize: 11.5, fontWeight: 700, color: t.textSub, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
            PASSWORD
          </label>
          <div style={{ position: "relative", marginBottom: 22 }}>
            <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} aria-hidden="true" />
            <input
              id="login-password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              style={{
                width: "100%", padding: "11px 40px 11px 38px",
                borderRadius: 10, border: `1px solid ${error ? t.danger : t.border}`,
                background: t.surface2, color: t.text, fontSize: 13.5,
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }}
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
            <LogIn size={16} />{submitting ? "Signing in..." : "Sign in to Platform"}
          </button>

          <div style={{
            marginTop: 22, paddingTop: 18, borderTop: `1px solid ${t.borderLight}`,
            textAlign: "center", fontSize: 13, color: t.textSub,
          }}>
            Don&apos;t have an account yet?{" "}
            <Link to="/signup" state={{ from }} style={{ color: t.primary, fontWeight: 700, textDecoration: "none" }}>
              Create an account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
