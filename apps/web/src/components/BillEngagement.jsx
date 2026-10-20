import { useEffect, useState } from "react";
import { Eye, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "../api/client.js";

const number = value => new Intl.NumberFormat(undefined, { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0);

export default function BillEngagement({ billId, commentCount = 0 }) {
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.recordBillView(billId)
      .then(result => { if (active) setStats(result); })
      .catch(err => { if (active) setError(err.message || "Reactions are temporarily unavailable."); });
    return () => { active = false; };
  }, [billId]);

  async function react(reaction) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.reactToBill(billId, reaction);
      setStats(result);
    } catch (err) {
      setError(err.message || "Your reaction could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const current = stats?.reaction;
  return (
    <section className="np-engagement" aria-label="Bill reactions and activity">
      <div className="np-engagement-actions">
        <button type="button" className={`np-reaction-button${current === "like" ? " is-selected" : ""}`} aria-pressed={current === "like"} disabled={busy} onClick={() => react("like")}>
          <ThumbsUp size={17} aria-hidden="true" /><span>Like</span><strong>{number(stats?.likes)}</strong>
        </button>
        <button type="button" className={`np-reaction-button${current === "dislike" ? " is-selected" : ""}`} aria-pressed={current === "dislike"} disabled={busy} onClick={() => react("dislike")}>
          <ThumbsDown size={17} aria-hidden="true" /><span>Dislike</span><strong>{number(stats?.dislikes)}</strong>
        </button>
        <span className="np-engagement-stat" title="Unique signed-in readers">
          <Eye size={17} aria-hidden="true" /><span>{number(stats?.views)} views</span>
        </span>
        <button type="button" className="np-engagement-stat np-comment-link" onClick={() => document.getElementById("bill-discussion")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          <MessageCircle size={17} aria-hidden="true" /><span>{number(commentCount)} comments</span>
        </button>
      </div>
      {error && <span className="np-engagement-error" role="status">{error}</span>}
    </section>
  );
}
