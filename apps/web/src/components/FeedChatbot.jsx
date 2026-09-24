import { useEffect, useRef, useState } from "react";
import { Bot, X, ArrowUp, Sparkles, MessageCircle, RotateCcw, ShieldCheck, ChevronDown } from "lucide-react";
import "./FeedChatbot.css";

const SUGGESTIONS = ["What happened in Parliament recently?", "Explain a bill in simple language", "How does a bill become law?"];

export default function FeedChatbot({ dark = false }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);
  const send = (value = draft) => {
    const text = value.trim();
    if (!text) return;
    setMessages(prev => [...prev, { id: Date.now(), text, role: "user" }]);
    setDraft("");
  };
  return (
    <div className={`np-chat-root ${dark ? "np-chat-dark" : ""}`}>
      {open && <section className="np-chat-panel" role="dialog" aria-label="NationPulse assistant" aria-modal="false">
        <header className="np-chat-header">
          <span className="np-chat-avatar"><Sparkles size={20}/></span>
          <span className="np-chat-heading"><strong>Pulse AI</strong><small>Your Parliament companion <span className="np-chat-demo">UI preview</span></small></span>
          <button type="button" className="np-chat-icon-btn" onClick={() => setMessages([])} title="Clear conversation" aria-label="Clear conversation"><RotateCcw size={16}/></button>
          <button type="button" className="np-chat-icon-btn" onClick={() => setOpen(false)} title="Close assistant" aria-label="Close assistant"><X size={19}/></button>
        </header>
        <div className="np-chat-body" aria-live="polite">
          <div className="np-chat-welcome">
            <span className="np-chat-welcome-icon"><Bot size={27}/></span>
            <h3>Make sense of the news.</h3>
            <p>Explore bills, understand parliamentary processes, and ask better questions about public policy.</p>
          </div>
          {messages.length === 0 && <div className="np-chat-suggestions"><span>TRY ASKING</span>{SUGGESTIONS.map(s => <button type="button" key={s} onClick={() => send(s)}>{s}<ArrowUp size={13}/></button>)}</div>}
          {messages.map(m => <div key={m.id} className="np-chat-message np-chat-user">{m.text}</div>)}
          {messages.length > 0 && <div className="np-chat-preview-note"><Sparkles size={16}/><span>Chat interface preview. AI responses will appear here once the chatbot backend is connected.</span></div>}
          <div ref={bottomRef}/>
        </div>
        <form className="np-chat-compose" onSubmit={e => {e.preventDefault();send();}}>
          <div className="np-chat-input-wrap"><input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ask about Parliament..." aria-label="Message Pulse AI"/><button type="submit" disabled={!draft.trim()} aria-label="Send message"><ArrowUp size={17}/></button></div>
          <span className="np-chat-disclaimer"><ShieldCheck size={12}/> AI responses will require source verification</span>
        </form>
      </section>}
      <button className={`np-chat-launcher ${open ? "np-chat-launcher-open" : ""}`} onClick={() => setOpen(v => !v)} aria-label={open ? "Close Pulse AI" : "Open Pulse AI"} aria-expanded={open} type="button">
        {open ? <ChevronDown size={23}/> : <><MessageCircle size={22}/><span>Ask Pulse AI</span><span className="np-chat-launcher-sparkle"><Sparkles size={13}/></span></>}
      </button>
    </div>
  );
}
