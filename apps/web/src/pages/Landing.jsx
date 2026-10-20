import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, FileSearch, Landmark, MessageCircle, Newspaper, ShieldCheck, Sparkles, Timer, UsersRound } from "lucide-react";
import { api } from "../api/client.js";
import { useLive } from "../api/useLive.jsx";
import { Footer } from "../components/UI.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const features = [
  [BookOpen, "Plain-language summaries", "Understand what a bill proposes without wading through legal language."],
  [FileSearch, "Why it matters", "See the practical implications for people, services and communities."],
  [ShieldCheck, "Official sources", "Trace every explanation back to the parliamentary record."],
];
const benefits = [
  [Timer, "Save time reading dense documents"], [CheckCircle2, "Understand the likely impact"],
  [ShieldCheck, "Check the sources yourself"], [Landmark, "Follow bills you care about"],
  [Newspaper, "Get a weekly legislative digest"], [MessageCircle, "Ask Pulse AI about bill texts"],
];

function SampleBill({ bill, index }) {
  const tint = ["#FFFFFF", "#F2C7C7", "#D5F3D8"][index % 3];
  return <Link className={`np-sample-card np-sample-card--${index}`} to={`/bills/${bill.id}`} style={{ background: tint }}>
    <span className="np-bill-number">{bill.billNumber ? `Bill No. ${bill.billNumber}` : "PARLIAMENTARY BILL"}{bill.billYear ? ` · ${bill.billYear}` : ""}</span>
    <h3>{bill.title}</h3><p>{bill.summary || "Read the plain-language summary and see why this bill matters."}</p>
    <span className="np-card-link">Explore bill <ArrowRight size={14} /></span>
  </Link>;
}

export default function Landing({ dark, t }) {
  const { data } = useLive(() => api.listBills({ page_size: 3 }), []);
  const { isAuthed } = useAuth();
  const bills = useMemo(() => (data?.items || []).slice(0, 3), [data]);
  return <div className="np-landing">
    <a className="np-skip-link" href="#main-content">Skip to content</a>
    <header className="np-landing-header">
      <Link className="np-wordmark" to="/" aria-label="NationPulse home"><span className="np-logo-mark"><Landmark size={19} /></span>NationPulse</Link>
      <nav aria-label="Main navigation" className="np-landing-nav"><a href="#how-it-works">How it works</a><a href="#benefits">Benefits</a><Link to="/about">About</Link></nav>
      <div className="np-landing-actions">{isAuthed ? <Link className="np-button np-button--primary" to="/bills">Go to bills <ArrowRight size={15} /></Link> : <><Link className="np-button np-button--ghost" to="/login">Sign in</Link><Link className="np-button np-button--primary" to="/signup">Get started</Link></>}</div>
    </header>
    <main id="main-content">
      <section className="np-hero">
        <div className="np-hero-copy"><span className="np-eyebrow"><Landmark size={15} /> PARLIAMENT, MADE CLEAR</span>
          <h1>Know what your Parliament is passing, <em>in plain language.</em></h1>
          <p>Follow Indian bills from introduction to enactment. Read clear summaries, understand why they matter, and verify the official sources.</p>
          <div className="np-hero-actions"><Link className="np-button np-button--primary np-button--large" to="/signup">Get started <ArrowRight size={17} /></Link><a className="np-button np-button--secondary np-button--large" href="#preview">Browse sample bills</a></div>
          <div className="np-trust-note"><ShieldCheck size={16} /> Non-partisan, source-linked, and reviewed by editors</div>
        </div>
        <div className="np-hero-art" aria-label="Preview of parliamentary bill cards">
          <div className="np-art-orbit np-art-orbit--one" aria-hidden="true" /><div className="np-art-orbit np-art-orbit--two" aria-hidden="true" />
          <article className="np-art-card np-art-card--back"><span className="np-bill-number">BILL TRACKER · 2025</span><h2>Making public services easier to access</h2><span className="np-mini-status">Under review</span></article>
          <article className="np-art-card np-art-card--front"><span className="np-bill-number">A CLEARER VIEW OF PARLIAMENT</span><h2>What changes for citizens?</h2><p>Plain-language summaries, official sources and progress in one place.</p><div className="np-art-progress"><i /><i /><i /><i /><i /><i /></div></article>
          <span className="np-art-stamp"><Sparkles size={16} /> Clear. Cited. Civic.</span>
        </div>
      </section>
      <section className="np-section np-section--intro"><div className="np-section-heading"><span className="np-eyebrow">A BETTER WAY TO STAY INFORMED</span><h2>Government bills, made understandable.</h2><p>NationPulse turns long parliamentary documents into clear, source-linked explanations for everyone.</p></div>
        <div className="np-feature-grid">{features.map(([Icon, title, body]) => <article className="np-feature-card" key={title}><span className="np-feature-icon"><Icon size={21} /></span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>
      <section id="how-it-works" className="np-section np-how"><div className="np-section-heading"><span className="np-eyebrow">FROM RECORD TO READING</span><h2>How NationPulse works</h2><p>AI helps make official documents easier to read. Editors review summaries before publication.</p></div>
        <ol className="np-steps">{[["Ingest", "We collect bill records and PDFs from official parliamentary sources."], ["Extract", "Document text is extracted so its details can be reviewed."], ["Summarize", "AI drafts a plain-language explanation for editorial review."], ["Publish", "Reviewed summaries appear with links to their official sources."]].map(([title, body], i) => <li key={title}><span className="np-step-number">0{i + 1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol>
      </section>
      <section id="benefits" className="np-section np-benefits"><div className="np-section-heading"><span className="np-eyebrow">YOUR CIVIC TOOLKIT</span><h2>Stay informed on your terms.</h2></div><div className="np-benefit-grid">{benefits.map(([Icon, title]) => <div className="np-benefit-item" key={title}><span><Icon size={18} /></span>{title}</div>)}</div></section>
      {bills.length > 0 && <section id="preview" className="np-section np-preview"><div className="np-preview-heading"><div><span className="np-eyebrow">FROM THE BILL TRACKER</span><h2>Explore recent bills</h2></div><Link to="/signup">See all bills <ArrowRight size={15} /></Link></div><div className="np-preview-grid">{bills.map((bill, i) => <SampleBill key={bill.id} bill={bill} index={i} />)}</div></section>}
      <section className="np-promise"><span className="np-promise-icon"><ShieldCheck size={23} /></span><div><span className="np-eyebrow">OUR EDITORIAL PROMISE</span><h2>Clear explanations. No party line.</h2><p>We explain what official records say, in accessible language, with links so you can check the source and make up your own mind.</p></div><Link to="/about">Read about our standards <ArrowRight size={15} /></Link></section>
      <section className="np-final-cta"><span className="np-eyebrow">YOUR PARLIAMENT, WITH CONTEXT</span><h2>Make sense of what’s changing.</h2><p>Start exploring the bills that shape everyday life.</p><Link className="np-button np-button--primary np-button--large" to="/signup">Get started free <ArrowRight size={17} /></Link></section>
    </main>
    <Footer t={t} />
  </div>;
}
