import { Component } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleX, AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { FONT_SERIF } from "../context/ThemeContext.jsx";

function ActionRow({ t }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
      <button onClick={() => navigate(-1)}
        style={{ padding: "9px 18px", background: "none", color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
        <ArrowLeft size={14} />Go back
      </button>
      <Link to="/"
        style={{ padding: "9px 18px", background: t.primary, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
        <Home size={14} />Back to feed
      </Link>
    </div>
  );
}

export default function NotFound({ t }) {
  return (
    <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center" }}>
      <div>
        <CircleX size={48} style={{ color: t.border, marginBottom: 16 }} aria-hidden="true" />
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 24, fontWeight: 700, color: t.text, margin: "0 0 8px 0" }}>Page not found</h1>
        <p style={{ fontSize: 14, color: t.textMuted, margin: 0, maxWidth: 380 }}>
          The bill, scheme, MP, or page you're looking for doesn't exist or may have moved.
        </p>
        <ActionRow t={t} />
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("NationPulse render error:", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    const t = this.props.t;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", background: t.bg }}>
        <div>
          <AlertTriangle size={48} style={{ color: t.danger, marginBottom: 16 }} aria-hidden="true" />
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 24, fontWeight: 700, color: t.text, margin: "0 0 8px 0" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: t.textMuted, margin: "0 0 20px 0", maxWidth: 380 }}>
            NationPulse hit an unexpected error rendering this page. Reloading usually fixes it.
          </p>
          <button onClick={() => window.location.assign("/")}
            style={{ padding: "9px 20px", background: t.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Reload NationPulse
          </button>
        </div>
      </div>
    );
  }
}
