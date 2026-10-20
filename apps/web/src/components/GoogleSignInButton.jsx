import { useEffect, useRef, useState } from "react";

export default function GoogleSignInButton({
  onSuccess,
  onError,
  text = "signin_with", // "signin_with" | "signup_with" | "continue_with"
  dark = false,
  t,
}) {
  const containerRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const [configMissing, setConfigMissing] = useState(!clientId);
  const [showConfigNotice, setShowConfigNotice] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setConfigMissing(true);
      return;
    }
    setConfigMissing(false);

    let checkInterval = null;

    const setupGoogle = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return false;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              onSuccess?.(response.credential);
            } else {
              onError?.("Google sign-in did not return valid credentials.");
            }
          },
        });

        // Clear existing button contents before re-rendering
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(containerRef.current, {
            type: "standard",
            theme: dark ? "filled_black" : "outline",
            size: "large",
            text: text,
            shape: "rectangular",
            logo_alignment: "left",
            width: 346,
          });
        }
        return true;
      } catch (err) {
        console.error("Failed to render Google Sign-In button:", err);
        return false;
      }
    };

    if (!setupGoogle()) {
      checkInterval = setInterval(() => {
        if (setupGoogle()) {
          clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [clientId, dark, text, onSuccess, onError]);

  const buttonLabel = text === "signup_with"
    ? "Sign up with Google"
    : text === "continue_with"
      ? "Continue with Google"
      : "Sign in with Google";

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Official Google rendered button container if client_id is configured */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          display: configMissing ? "none" : "flex",
          justifyContent: "center",
          minHeight: 44,
        }}
      />

      {/* Fallback button when client_id is not yet configured in .env */}
      {configMissing && (
        <button
          type="button"
          onClick={() => setShowConfigNotice((prev) => !prev)}
          style={{
            width: "100%",
            maxWidth: 346,
            padding: "10px 16px",
            borderRadius: 10,
            border: `1px solid ${dark ? "#334155" : "#DADCE0"}`,
            background: dark ? "#1E293B" : "#FFFFFF",
            color: dark ? "#F8FAFC" : "#3C4043",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            boxShadow: dark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(60,64,67,0.08)",
            transition: "all 0.15s ease",
          }}
        >
          {/* Official Google 'G' icon */}
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.55 10.78l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span>{buttonLabel}</span>
        </button>
      )}

      {/* Helpful setup notice when client_id is not set in .env */}
      {showConfigNotice && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.5,
            background: dark ? "rgba(30, 58, 138, 0.3)" : "#EFF6FF",
            border: `1px solid ${dark ? "rgba(56, 189, 248, 0.4)" : "#BFDBFE"}`,
            color: dark ? "#93C5FD" : "#1E40AF",
            textAlign: "left",
            maxWidth: 346,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <strong>Google OAuth setup note:</strong>
          <div style={{ marginTop: 4 }}>
            Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>apps/web/.env</code> and <code>GOOGLE_CLIENT_ID</code> in <code>api/.env</code> with your Google Cloud OAuth Client ID to activate one-click Google Sign-In.
          </div>
        </div>
      )}
    </div>
  );
}
