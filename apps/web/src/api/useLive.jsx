import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

export function useLive(load, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.resolve()
      .then(load)
      .then(v => { if (active) setData(v); })
      .catch(e => { if (active) setError(e.message || "Failed to load data"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);

  return { data, error, loading, retry: () => setRevision(value => value + 1) };
}

export function LiveError({ error, onRetry }) {
  if (!error) return null;
  return (
    <div style={{ maxWidth: 920, margin: "16px auto 0", padding: "0 20px" }}>
      <div
        role="alert"
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderRadius: 10,
          background: "#FEF2F2", border: "1px solid #FECACA",
          color: "#B91C1C", fontSize: 13, fontWeight: 500,
        }}
      >
        <AlertCircle size={16} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Unable to load data: {error}. Please verify that the API server is running.</span>
        {onRetry && <button type="button" onClick={onRetry} style={{ minHeight: 40, padding: "7px 12px", borderRadius: 8, border: "1px solid currentColor", color: "inherit", background: "transparent", fontWeight: 700 }}>Retry</button>}
      </div>
    </div>
  );
}
