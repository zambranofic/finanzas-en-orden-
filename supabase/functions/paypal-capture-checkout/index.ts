import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const ALLOWED=new Set(["https://finorve.com","https://www.finorve.com"]);
const cors=(origin)=>({"Access-Control-Allow-Origin":ALLOWED.has(origin||"")?origin:"https://finorve.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin","Cache-Control":"no-store"});
const env=()=>({url:Deno.env.get("SUPABASE_URL"),service:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),cid:Deno.env.get("PAYPAL_CLIENT_ID"),secret:Deno.env.get("PAYPAL_CLIENT_SECRET"),base:Deno.env.get("PAYPAL_BASE_URL")||"https://api-m.sandbox.paypal.com"});
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
function toMinorExact(value){const s=String(value??"").trim();const m=/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(s);if(!m)return null;const n=BigInt(m[1])*100n+BigInt((m[2]||"").padEnd(2,"0"));return n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null}
async function token(c){if(!c.cid||!c.secret)throw new Error("PAYPAL_NOT_CONFIGURED");const r=await fetch(c.base+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+btoa(c.cid+":"+c.secret),"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});if(!r.ok){console.error("capture_paypal_auth_failed",r.status);throw new Error("PAYPAL_AUTH_FAILED")}return (await r.json()).access_token}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS"){if(origin&&!ALLOWED.has(origin))return new Response("Forbidden",{status:403});return new Response("ok",{headers:cors(origin)})}
 if(origin&&!ALLOWED.has(origin))return Response.json({error:"ORIGIN_NOT_ALLOWED"},{status:403,headers:cors(origin)});
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:cors(origin)});
 let body;try{body=await req.json()}catch{return Response.json({error:"INVALID_JSON"},{status:400,headers:cors(origin)})}
 const cid=String(body?.checkout_id||""),secret=String(body?.checkout_secret||""),oid=String(body?.order_id||"");
 if(!cid||!secret||!oid)return Response.json({error:"MISSING_CHECKOUT_DATA"},{status:400,headers:cors(origin)});
 const c=env(),db=createClient(c.url,c.service,{auth:{persistSession:false,autoRefreshToken:false}});
 const rawIp=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
 const [checkoutLimit,ipLimit]=await Promise.all([
   db.rpc("consume_rate_limit_internal",{p_endpoint:"paypal-capture-checkout:checkout",p_subject_hash:await sha(cid),p_window_seconds:900,p_limit:8}),
   db.rpc("consume_rate_limit_internal",{p_endpoint:"paypal-capture-checkout:ip",p_subject_hash:await sha(rawIp),p_window_seconds:900,p_limit:20})
 ]);
 if(checkoutLimit.error||ipLimit.error){console.error("capture_rate_limit_unavailable",checkoutLimit.error?.code||null,ipLimit.error?.code||null);return Response.json({error:"RATE_LIMIT_UNAVAILABLE"},{status:503,headers:cors(origin)})}
 const denied=[checkoutLimit.data,ipLimit.data].filter((x)=>x&&!x.allowed);
 if(denied.length){const retry=Math.max(...denied.map((x)=>Number(x.retry_after||1)));return Response.json({error:"TOO_MANY_CAPTURE_ATTEMPTS"},{status:429,headers:{...cors(origin),"Retry-After":String(retry)}})}
 const {data:intent}=await db.from("checkout_intents").select("*").eq("id",cid).eq("provider_order_id",oid).maybeSingle();
 if(!intent)return Response.json({error:"CHECKOUT_NOT_FOUND"},{status:404,headers:cors(origin)});
 if(await sha(secret)!==intent.checkout_secret_hash)return Response.json({error:"INVALID_CHECKOUT_SECRET"},{status:401,headers:cors(origin)});
 if(intent.status==="claimed")return Response.json({error:"CHECKOUT_ALREADY_CLAIMED"},{status:409,headers:cors(origin)});
 if(intent.status==="completed"&&intent.provider_capture_id){
   const claim=crypto.randomUUID()+"."+crypto.randomUUID(),claimHash=await sha(claim),expires=new Date(Date.now()+24*60*60*1000).toISOString();
   const {error:re}=await db.from("checkout_intents").update({claim_token_hash:claimHash,claim_expires_at:expires,updated_at:new Date().toISOString()}).eq("id",cid).eq("status","completed");
   if(re)return Response.json({error:"CHECKOUT_RECOVERY_FAILED"},{status:500,headers:cors(origin)});
   return Response.json({ok:true,email:intent.email,claim_token:claim,recovered:true},{headers:cors(origin)});
 }
 let access;try{access=await token(c)}catch(e){return Response.json({error:String(e.message)},{status:503,headers:cors(origin)})}
 let order;const gr=await fetch(c.base+"/v2/checkout/orders/"+encodeURIComponent(oid),{headers:{Authorization:"Bearer "+access}});
 order=await gr.json().catch(()=>({}));if(!gr.ok)return Response.json({error:"PAYPAL_ORDER_LOOKUP_FAILED"},{status:502,headers:cors(origin)});
 if(order.status!=="COMPLETED"){const cr=await fetch(c.base+"/v2/checkout/orders/"+encodeURIComponent(oid)+"/capture",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json","PayPal-Request-Id":"public-capture-"+cid},body:"{}"});order=await cr.json().catch(()=>({}));if(!cr.ok)return Response.json({error:"PAYPAL_CAPTURE_FAILED",paypal_status:order?.name||null},{status:502,headers:cors(origin)})}
 const cap=order?.purchase_units?.[0]?.payments?.captures?.[0],amount=cap?.amount,capturedMinor=toMinorExact(amount?.value);
 if(order.status!=="COMPLETED"||cap?.status!=="COMPLETED"||amount?.currency_code!==intent.currency||capturedMinor===null||capturedMinor!==Number(intent.amount_minor))return Response.json({error:"CAPTURE_VERIFICATION_FAILED"},{status:409,headers:cors(origin)});
 const claim=crypto.randomUUID()+"."+crypto.randomUUID(),claimHash=await sha(claim),expires=new Date(Date.now()+24*60*60*1000).toISOString();
 const {error:ue}=await db.from("checkout_intents").update({status:"completed",provider_capture_id:cap.id,claim_token_hash:claimHash,claim_expires_at:expires,raw:{capture_status:order.status,capture_id:cap.id},updated_at:new Date().toISOString()}).eq("id",cid);
 if(ue)return Response.json({error:"CHECKOUT_FINALIZE_FAILED"},{status:500,headers:cors(origin)});
 return Response.json({ok:true,email:intent.email,claim_token:claim},{headers:cors(origin)});
});