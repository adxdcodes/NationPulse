import { useEffect, useRef } from "react";
import { ExternalLink, FileText, X, Landmark, Link2Off } from "lucide-react";

// Only use the original publisher URL. Never fall back to storage_path or a
// cached / downloaded copy when presenting an official source to readers.
function officialUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function documentLabel(doc, index) {
  const raw = doc.doc_type || doc.document_type || doc.title || "Document";
  return String(raw).replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) + ` ${index + 1}`;
}

export default function OfficialSourcesModal({ open, onClose, documents = [], title, t }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const available = documents.filter(doc => officialUrl(doc.source_url));
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(3,10,25,.76)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
      <section role="dialog" aria-modal="true" aria-labelledby="np-sources-title"
        style={{width:"100%",maxWidth:650,maxHeight:"min(82vh,750px)",overflowY:"auto",background:t.surface,border:`1px solid ${t.border}`,borderRadius:22,boxShadow:"0 24px 85px rgba(0,0,0,.4)",padding:"clamp(20px,4vw,30px)"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,marginBottom:12}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:9,color:t.primary,fontSize:12,fontWeight:750,letterSpacing:1,marginBottom:9}}><Landmark size={17}/> OFFICIAL SOURCES</div>
            <h2 id="np-sources-title" style={{margin:0,color:t.text,fontSize:22,lineHeight:1.35}}>Original bill documents</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close sources"
            style={{display:"grid",placeItems:"center",width:36,height:36,flexShrink:0,border:`1px solid ${t.border}`,borderRadius:11,background:t.surface2,color:t.text,cursor:"pointer"}}><X size={19}/></button>
        </div>
        <p style={{color:t.textMuted,fontSize:13,lineHeight:1.6,margin:"0 0 19px"}}>{title} — links below open the original source websites, not NationPulse's stored copies.</p>
        {available.length ? (
          <div style={{display:"grid",gap:10}}>
            {available.map((doc, index) => {
              const url = officialUrl(doc.source_url);
              return <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer"
                style={{display:"flex",alignItems:"center",gap:13,padding:15,border:`1px solid ${t.border}`,borderRadius:14,background:t.surface2,textDecoration:"none",color:t.text,transition:"border-color .2s, transform .2s"}}
                onMouseEnter={e => {e.currentTarget.style.borderColor=t.primary;e.currentTarget.style.transform="translateY(-1px)";}}
                onMouseLeave={e => {e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="none";}}>
                <span style={{display:"grid",placeItems:"center",height:42,width:42,borderRadius:12,background:t.accentBg,color:t.primary,flexShrink:0}}><FileText size={21}/></span>
                <span style={{minWidth:0,flex:1}}><span style={{display:"block",fontSize:14,fontWeight:700,marginBottom:5}}>{documentLabel(doc,index)}</span><span style={{display:"block",fontSize:11,color:t.textMuted,overflowWrap:"anywhere"}}>{new URL(url).hostname}</span></span>
                <ExternalLink size={17} color={t.primary} style={{flexShrink:0}}/>
              </a>;
            })}
          </div>
        ) : (
          <div style={{textAlign:"center",padding:"30px 14px",border:`1px dashed ${t.border}`,borderRadius:14,color:t.textMuted}}>
            <Link2Off size={27} style={{marginBottom:10}}/><div style={{fontWeight:700,color:t.text,marginBottom:6}}>No original document links available</div><div style={{fontSize:13}}>The official source URLs for this bill have not been recorded.</div>
          </div>
        )}
        {available.length < documents.length && available.length > 0 && <p style={{fontSize:12,color:t.textMuted,margin:"14px 0 0"}}>{documents.length - available.length} document(s) have no valid original source URL and are not shown.</p>}
      </section>
    </div>
  );
}
