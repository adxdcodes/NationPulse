import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ExternalLink, FileText, X } from "lucide-react";
import { api } from "../api/client.js";
import OfficialSourcesModal from "./OfficialSourcesModal.jsx";

export default function PublishedBillModal({ id, onClose, t, dark }) {
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [error, setError] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setBill(null); setError(""); setSourcesOpen(false);
    api.getBill(id).then(data => { if (active) setBill(data); })
      .catch(e => { if (active) setError(e?.message || "Unable to load this bill."); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!id) return;
    const onKey = e => { if (e.key === "Escape") { if (sourcesOpen) setSourcesOpen(false); else onClose(); } };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [id, onClose, sourcesOpen]);
  if (!id) return null;
  const button = { border:`1px solid ${t.borderLight}`, background:t.surface, color:t.text, borderRadius:10, padding:"10px 14px", fontWeight:650, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, fontFamily:"inherit" };
  return <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(3,9,22,.78)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <section role="dialog" aria-modal="true" aria-label={bill?.title || "Published bill"} style={{width:"min(680px,100%)",maxHeight:"min(85dvh,850px)",overflowY:"auto",background:t.surface,border:`1px solid ${t.borderLight}`,boxShadow:"0 24px 80px #0008",borderRadius:20,padding:"clamp(20px,4vw,32px)",color:t.text}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:18}}><span style={{color:t.primary,fontSize:12,fontWeight:800,letterSpacing:1}}>PUBLISHED BILL</span><button type="button" aria-label="Close preview" onClick={onClose} style={{...button,padding:8}}><X size={19}/></button></div>
      {!bill && !error && <div role="status" style={{padding:"42px 0",textAlign:"center",color:t.textMuted}}>Loading published bill…</div>}
      {error && <div role="alert" style={{color:t.danger,padding:"25px 0"}}>{error}</div>}
      {bill && <>
        <div style={{display:"flex",gap:9,flexWrap:"wrap",fontSize:12,color:t.textMuted,marginBottom:12}}><span>{bill.status}</span><span>·</span><span>{bill.topic || bill.domain}</span></div>
        <h2 style={{fontSize:"clamp(20px,3vw,28px)",lineHeight:1.35,margin:"0 0 20px",color:t.text}}>{bill.title || bill.bill_name}</h2>
        {bill.summary && <div style={{marginBottom:18}}><h3 style={{fontSize:12,letterSpacing:1,color:t.primary}}>SUMMARY</h3><p style={{color:t.textSub,lineHeight:1.75,whiteSpace:"pre-line"}}>{bill.summary}</p></div>}
        {bill.why && <div style={{background:t.accentBg,borderRadius:12,padding:16,marginBottom:20}}><h3 style={{fontSize:12,letterSpacing:1,color:t.primary,marginTop:0}}>WHY IT MATTERS</h3><p style={{color:t.textSub,lineHeight:1.7,marginBottom:0}}>{bill.why}</p></div>}
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:24}}><button type="button" onClick={()=>navigate(`/event/${encodeURIComponent(id)}`)} style={{...button,background:t.primary,color:dark?"#101827":"#fff",borderColor:t.primary}}>Open full bill <ArrowRight size={16}/></button><button type="button" onClick={()=>setSourcesOpen(true)} style={button}><FileText size={16}/> Original documents <ExternalLink size={14}/></button></div>
        <OfficialSourcesModal open={sourcesOpen} onClose={()=>setSourcesOpen(false)} documents={bill.documents || []} title={bill.title || bill.bill_name} t={t}/>
      </>}
    </section>
  </div>;
}
