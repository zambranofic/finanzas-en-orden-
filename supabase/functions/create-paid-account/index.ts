import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const ALLOWED="https://finanzas-en-orden-bice.vercel.app";
const cors={"Access-Control-Allow-Origin":ALLOWED,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(origin&&origin!==ALLOWED)return Response.json({error:"ORIGIN_NOT_ALLOWED"},{status:403,headers:cors});
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:cors});
 let body;try{body=await req.json()}catch{return Response.json({error:"INVALID_JSON"},{status:400,headers:cors})}
 const claim=String(body?.claim_token||""),email=String(body?.email||"").trim().toLowerCase(),password=String(body?.password||"");
 const strong=password.length>=12&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/\d/.test(password)&&/[^A-Za-z0-9]/.test(password);
 if(!claim||!email||!strong)return Response.json({error:"INVALID_ACCOUNT_DATA"},{status:400,headers:cors});
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const claimHash=await sha(claim);
 const {data:limit,error:limitError}=await db.rpc("consume_rate_limit_internal",{p_endpoint:"create-paid-account:claim",p_subject_hash:claimHash,p_window_seconds:900,p_limit:6});
 if(limitError)return Response.json({error:"RATE_LIMIT_UNAVAILABLE"},{status:503,headers:cors});
 if(limit&&!limit.allowed)return Response.json({error:"TOO_MANY_ACCOUNT_ATTEMPTS"},{status:429,headers:{...cors,"Retry-After":String(limit.retry_after||1)}});
 const {data:intent}=await db.from("checkout_intents").select("id,email,status,claim_expires_at").eq("claim_token_hash",claimHash).eq("status","completed").maybeSingle();
 if(!intent||new Date(intent.claim_expires_at).getTime()<=Date.now())return Response.json({error:"INVALID_OR_EXPIRED_PAYMENT"},{status:409,headers:cors});
 if(intent.email.toLowerCase()!==email)return Response.json({error:"EMAIL_MISMATCH"},{status:409,headers:cors});
 const {data:created,error:ce}=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{paid_checkout:true}});
 if(ce){
   if(String(ce.message||"").toLowerCase().includes("already"))return Response.json({error:"ACCOUNT_EXISTS"},{status:409,headers:cors});
   return Response.json({error:"ACCOUNT_CREATE_FAILED"},{status:500,headers:cors});
 }
 const user=created?.user;
 if(!user)return Response.json({error:"ACCOUNT_CREATE_FAILED"},{status:500,headers:cors});
 const {error:claimErr}=await db.rpc("claim_paid_checkout_internal",{p_claim_hash:claimHash,p_user_id:user.id,p_email:email});
 if(claimErr){
   await db.auth.admin.deleteUser(user.id).catch(()=>{});
   return Response.json({error:"ACCESS_ACTIVATION_FAILED"},{status:500,headers:cors});
 }
 return Response.json({ok:true},{headers:cors});
});