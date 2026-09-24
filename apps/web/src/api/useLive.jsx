import {useEffect,useState} from "react";
export function useLive(load, deps=[]) {
 const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;setLoading(true);setError("");Promise.resolve().then(load).then(v=>{if(active)setData(v)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},deps);
 return {data,error,loading};
}
export function LiveError({error}) {return error?<div role="alert" style={{padding:16,color:"#dc2626"}}>API error: {error}. Check the FastAPI server and database.</div>:null}