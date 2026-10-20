import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, X, ArrowUp, Sparkles, MessageCircle, RotateCcw, ShieldCheck, ChevronDown, ThumbsUp, ThumbsDown, FileText } from "lucide-react";
import { api } from "../api/client";
import MarkdownMessage from "./MarkdownMessage.jsx";
import "./FeedChatbot.css";

const SUGGESTIONS = ["What is the purpose of this bill?", "Explain a bill in simple language", "Which ministry introduced the latest bill?"];

/** Pulse AI — RAG chatbot backed by the nationpulse-qa service (see api.askQuestion).
 *  Optional `billId` scopes retrieval to one bill (QA-service bill id, e.g. "RS-..."). */
export default function FeedChatbot({ dark = false, billId = null, billTitle = null, startOpen = false, initialQuestion = "", onClose }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initialQuestion);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    if (startOpen) {
      setDraft(initialQuestion);
      setOpen(true);
    }
  }, [startOpen, initialQuestion]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, open]);

  const send = async (value = draft) => {
    const text = value.trim();
    if (!text || loading) return;
    setMessages(prev => [...prev, { id: Date.now(), text, role: "user" }]);
    setDraft("");
    setLoading(true);
    try {
      const res = await api.askQuestion(text, billId, billTitle);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: "bot", text: res.answer,
        sources: res.sources || [], interactionId: res.interaction_id, rating: 0,
      }]);
    } catch (err) {
      const offline = err instanceof TypeError;
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: "bot", error: true,
        text: offline ? "Pulse AI is unreachable right now. Please make sure the Q&A service is running and try again." : `Sorry, something went wrong: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const rate = async (msg, rating) => {
    if (!msg.interactionId || msg.rating) return;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, rating } : m));
    try { await api.qaFeedback(msg.interactionId, rating); }
    catch { setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, rating: 0 } : m)); }
  };

  return createPortal((
    <div className={`np-chat-root ${dark ? "np-chat-dark" : ""}`}>
      {open && <section className="np-chat-panel" role="dialog" aria-label="NationPulse assistant" aria-modal="false">
        <header className="np-chat-header">
          <span className="np-chat-avatar"><Sparkles size={20}/></span>
          <span className="np-chat-heading"><strong>Pulse AI</strong><small title={billTitle || undefined}>{billTitle ? `Bill context: ${billTitle}` : "Your Parliament companion"}</small></span>
          <button type="button" className="np-chat-icon-btn" onClick={() => setMessages([])} title="Clear conversation" aria-label="Clear conversation"><RotateCcw size={16}/></button>
          <button type="button" className="np-chat-icon-btn" onClick={() => { setOpen(false); onClose?.(); }} title="Close assistant" aria-label="Close assistant"><X size={19}/></button>
        </header>
        <div className="np-chat-body" aria-live="polite">
          <div className="np-chat-welcome">
            <span className="np-chat-welcome-icon"><Bot size={27}/></span>
            <h3>Make sense of the news.</h3>
            <p>Ask questions about parliamentary bills — answers are grounded in the bill text with sources.</p>
          </div>
          {messages.length === 0 && <div className="np-chat-suggestions"><span>TRY ASKING</span>{SUGGESTIONS.map(s => <button type="button" key={s} onClick={() => send(s)}>{s}<ArrowUp size={13}/></button>)}</div>}
          {messages.map(m => m.role === "user"
            ? <div key={m.id} className="np-chat-message np-chat-user">{m.text}</div>
            : <div key={m.id} className={`np-chat-message np-chat-bot ${m.error ? "np-chat-error" : ""}`}>
                <div className="np-chat-bot-text"><MarkdownMessage text={m.text} /></div>
                {(() => {
                  // Group/deduplicate chunks by unique bill
                  const uniqueBills = [];
                  const seen = new Set();
                  for (const s of (m.sources || [])) {
                    const key = s.bill_id || s.bill_title;
                    if (key && !seen.has(key)) {
                      seen.add(key);
                      uniqueBills.push(s);
                    }
                  }
                  if (uniqueBills.length === 0) return null;
                  return (
                    <details className="np-chat-sources">
                      <summary>
                        <FileText size={12}/> {uniqueBills.length} referenced bill{uniqueBills.length > 1 ? "s" : ""}
                      </summary>
                      <div className="np-chat-sources-list">
                        {uniqueBills.map((b, i) => (
                          <div key={i} className="np-chat-source-item">
                            <span className="np-chat-source-badge">{b.bill_id || `#${i + 1}`}</span>
                            <span className="np-chat-source-title">{b.bill_title || b.bill_id}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })()}
                {m.interactionId && <div className="np-chat-feedback">
                  <button type="button" disabled={!!m.rating} className={m.rating === 1 ? "on" : ""} onClick={() => rate(m, 1)} aria-label="Helpful"><ThumbsUp size={12}/></button>
                  <button type="button" disabled={!!m.rating} className={m.rating === -1 ? "on" : ""} onClick={() => rate(m, -1)} aria-label="Not helpful"><ThumbsDown size={12}/></button>
                </div>}
              </div>)}
          {loading && <div className="np-chat-message np-chat-bot np-chat-typing" aria-label="Pulse AI is thinking"><span/><span/><span/></div>}
          <div ref={bottomRef}/>
        </div>
        <form className="np-chat-compose" onSubmit={e => {e.preventDefault();send();}}>
          <div className="np-chat-input-wrap"><input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ask about Parliament bills..." aria-label="Message Pulse AI" disabled={loading}/><button type="submit" disabled={!draft.trim() || loading} aria-label="Send message"><ArrowUp size={17}/></button></div>
          <span className="np-chat-disclaimer"><ShieldCheck size={12}/> AI responses may be inaccurate — verify with the sources</span>
        </form>
      </section>}
      <button className={`np-chat-launcher ${open ? "np-chat-launcher-open" : ""}`} onClick={() => setOpen(v => { if (v) onClose?.(); return !v; })} aria-label={open ? "Close Pulse AI" : "Open Pulse AI"} aria-expanded={open} type="button">
        {open ? <ChevronDown size={23}/> : <><MessageCircle size={22}/><span>Ask Pulse AI</span><span className="np-chat-launcher-sparkle"><Sparkles size={13}/></span></>}
      </button>
    </div>
  ), document.body);
}
