import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const ALLOWED=new Set(["https://finorve.com","https://www.finorve.com"]);
const APP="https://finorve.com";
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
const cors=(origin)=>({"Access-Control-Allow-Origin":ALLOWED.has(origin||"")?origin:APP,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin","Cache-Control":"no-store"});
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS"){if(origin&&!ALLOWED.has(origin))return new Response("Forbidden",{status:403});return new Response("ok",{headers:cors(origin)})}
 if(origin&&!ALLOWED.has(origin))return Response.json({error:"ORIGIN_NOT_ALLOWED"},{status:403,headers:cors(origin)});
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:cors(origin)});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key||!service)return Response.json({error:"SERVICE_NOT_CONFIGURED"},{status:503,headers:cors(origin)});
 const raw=await req.text();let parsed={};try{parsed=JSON.parse(raw||"{}")}catch{return Response.json({error:"INVALID_JSON"},{status:400,headers:cors(origin)})}
 const password=String(parsed?.password||""),claim=String(parsed?.claim_token||"");
 const strong=password.length>=12&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/\d/.test(password)&&/[^A-Za-z0-9]/.test(password);
 if(!strong)return Response.json({error:"WEAK_PASSWORD",message:"Usa al menos 12 caracteres con mayúscula, minúscula, número y símbolo."},{status:400,headers:cors(origin)});
 if(!claim)return Response.json({error:"MISSING_CLAIM_TOKEN"},{status:400,headers:cors(origin)});
 const {createClient}=await import("npm:@supabase/supabase-js@2");
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const rawIp=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
 const [claimLimit,ipLimit]=await Promise.all([
   db.rpc("consume_rate_limit_internal",{p_endpoint:"create-paid-account-finorve:claim",p_subject_hash:await sha(claim),p_window_seconds:900,p_limit:6}),
   db.rpc("consume_rate_limit_internal",{p_endpoint:"create-paid-account-finorve:ip",p_subject_hash:await sha(rawIp),p_window_seconds:900,p_limit:20})
 ]);
 if(claimLimit.error||ipLimit.error)return Response.json({error:"RATE_LIMIT_UNAVAILABLE"},{status:503,headers:cors(origin)});
 const denied=[claimLimit.data,ipLimit.data].filter((x)=>x&&!x.allowed);
 if(denied.length){const retry=Math.max(...denied.map((x)=>Number(x.retry_after||1)));return Response.json({error:"TOO_MANY_ACCOUNT_ATTEMPTS"},{status:429,headers:{...cors(origin),"Retry-After":String(retry)}})}
 const r=await fetch(url+"/functions/v1/create-paid-account",{method:"POST",headers:{"apikey":key,"Content-Type":"application/json"},body:raw});
 const text=await r.text();
 return new Response(text,{status:r.status,headers:{...cors(origin),"Content-Type":r.headers.get("content-type")||"application/json"}});
});