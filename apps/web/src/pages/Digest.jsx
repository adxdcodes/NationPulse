import {api} from "../api/client.js";
import {useLive,LiveError} from "../api/useLive.jsx";
import {UniversalCard,Footer,PageHeader} from "../components/UI.jsx";
import {Newspaper} from "lucide-react";
export default function Digest({dark,t}) {const {data,error,loading}=useLive(()=>api.getDigest(12),[]);return <div><PageHeader t={t} eyebrow="WEEKLY DIGEST" IconComp={Newspaper} title="Parliamentary weekly digest" subtitle="Approved bill updates grouped by week."/><LiveError error={error}/><main style={{maxWidth:860,margin:"auto",padding:20}}>{loading?<p>Loading digest…</p>:!(data?.items?.length)?<p>No approved updates in the last 12 weeks.</p>:data.items.map(d=><section key={d.id}><h2 style={{color:t.text}}>{d.label} · {d.stat.value} updates</h2>{d.highlights.map(ev=><div key={ev.id} style={{marginBottom:14}}><UniversalCard ev={ev} dark={dark} t={t}/></div>)}</section>)}</main><Footer t={t}/></div>}
