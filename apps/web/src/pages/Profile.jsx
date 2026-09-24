import {useAuth} from "../context/AuthContext.jsx";
import {api} from "../api/client.js";
import {useLive,LiveError} from "../api/useLive.jsx";
import {Link,useNavigate} from "react-router-dom";
import {Footer,PageHeader} from "../components/UI.jsx";
import {User} from "lucide-react";
export default function Profile({t}){const {user,logout,token}=useAuth();const navigate=useNavigate();const {data,error,loading}=useLive(()=>api.myFollows(token),[token]);if(!user)return null;return <><PageHeader t={t} eyebrow="ACCOUNT" IconComp={User} title={user.name} subtitle={user.email}/><main style={{maxWidth:760,margin:"auto",padding:24,color:t.text}}><button onClick={()=>{logout();navigate("/")}}>Sign out</button><h2>Your follows</h2><LiveError error={error}/>{loading?<p>Loading…</p>:!data?<p>No follows loaded.</p>:Object.entries(data).map(([kind,ids])=><section key={kind}><h3>{kind} ({ids.length})</h3>{ids.length?ids.map(id=><div key={id}><Link to={kind==="bill"?`/event/${id}`:kind==="mp"?`/mps/${id}`:`/topics/${encodeURIComponent(id)}`}>{kind} {id}</Link></div>):<p>No followed {kind}s.</p>}</section>)}{user.isAdmin&&<p><Link to="/admin">Admin console</Link></p>}</main><Footer t={t}/></>}
