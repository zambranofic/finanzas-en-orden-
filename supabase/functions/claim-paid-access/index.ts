import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:cors});
 const h=req.headers.get("Authorization");
 if(!h?.startsWith("Bearer "))return new Response("Unauthorized",{status:401,headers:cors});
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const uc=createClient(url,anon,{global:{headers:{Authorization:h}}});
 const {data:{user}}=await uc.auth.getUser();
 if(!user?.email)return new Response("Unauthorized",{status:401,headers:cors});
 let body;try{body=await req.json()}catch{return Response.json({error:"INVALID_JSON"},{status:400,headers:cors})}
 const claim=String(body?.claim_token||"");
 if(!claim)return Response.json({error:"MISSING_CLAIM"},{status:400,headers:cors});
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const subject=await sha(user.id);
 const {data:limit,error:limitError}=await db.rpc("consume_rate_limit_internal",{p_endpoint:"claim-paid-access:user",p_subject_hash:subject,p_window_seconds:900,p_limit:6});
 if(limitError)return Response.json({error:"RATE_LIMIT_UNAVAILABLE"},{status:503,headers:cors});
 if(limit&&!limit.allowed)return Response.json({error:"TOO_MANY_CLAIM_ATTEMPTS"},{status:429,headers:{...cors,"Retry-After":String(limit.retry_after||1)}});
 const {error}=await db.rpc("claim_paid_checkout_internal",{p_claim_hash:await sha(claim),p_user_id:user.id,p_email:user.email});
 if(error)return Response.json({error:error.message||"CLAIM_FAILED"},{status:409,headers:cors});
 return Response.json({ok:true},{headers:cors});
});