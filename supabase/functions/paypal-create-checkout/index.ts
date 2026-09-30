import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const ALLOWED=new Set(["https://finorve.com","https://www.finorve.com"]);
const APP="https://finorve.com";
const cors=(origin)=>({"Access-Control-Allow-Origin":ALLOWED.has(origin||"")?origin:APP,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin","Cache-Control":"no-store"});
const env=()=>({url:Deno.env.get("SUPABASE_URL"),service:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),cid:Deno.env.get("PAYPAL_CLIENT_ID"),secret:Deno.env.get("PAYPAL_CLIENT_SECRET"),base:Deno.env.get("PAYPAL_BASE_URL")||"https://api-m.sandbox.paypal.com"});
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
async function token(c){if(!c.cid||!c.secret)throw new Error("PAYPAL_NOT_CONFIGURED");const r=await fetch(c.base+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+btoa(c.cid+":"+c.secret),"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});if(!r.ok)throw new Error("PAYPAL_AUTH_FAILED");return (await r.json()).access_token}
const approve=(x)=>x&&x.links&&x.links.find((l)=>l.rel==="payer-action"||l.rel==="approve")?.href||null;
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS"){if(origin&&!ALLOWED.has(origin))return new Response("Forbidden",{status:403});return new Response("ok",{headers:cors(origin)})}
 if(origin&&!ALLOWED.has(origin))return Response.json({error:"ORIGIN_NOT_ALLOWED"},{status:403,headers:cors(origin)});
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:cors(origin)});
 let body;try{body=await req.json()}catch{return Response.json({error:"INVALID_JSON"},{status:400,headers:cors(origin)})}
 const email=String(body&&body.email||"").trim().toLowerCase();
 if(!email||!email.includes("@")||!(email.split("@")[1]||"").includes("."))return Response.json({error:"INVALID_EMAIL"},{status:400,headers:cors(origin)});
 const c=env(),db=createClient(c.url,c.service,{auth:{persistSession:false,autoRefreshToken:false}});
 const rawIp=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
 const fp=await sha(rawIp),since=new Date(Date.now()-10*60*1000).toISOString();
 const [{count:emailCount},{count:fpCount}]=await Promise.all([
   db.from("checkout_intents").select("id",{count:"exact",head:true}).eq("email",email).gte("created_at",since),
   db.from("checkout_intents").select("id",{count:"exact",head:true}).eq("request_fingerprint",fp).gte("created_at",since)
 ]);
 if((emailCount||0)>=3||(fpCount||0)>=10)return Response.json({error:"TOO_MANY_CHECKOUT_ATTEMPTS"},{status:429,headers:cors(origin)});
 const {data:o,error:oe}=await db.from("offers").select("code,product_code,amount_minor,currency,active").eq("code","feo_v1").single();
 if(oe||!o||!o.active)return Response.json({error:"OFFER_UNAVAILABLE"},{status:409,headers:cors(origin)});
 const secret=crypto.randomUUID()+"."+crypto.randomUUID(),secretHash=await sha(secret);
 const cancelToken=crypto.randomUUID()+"."+crypto.randomUUID(),cancelTokenHash=await sha(cancelToken);
 const {data:intent,error:ie}=await db.from("checkout_intents").insert({email,amount_minor:o.amount_minor,currency:o.currency,offer_code:o.code,checkout_secret_hash:secretHash,cancel_token_hash:cancelTokenHash,request_fingerprint:fp,status:"created"}).select("id").single();
 if(ie||!intent)return Response.json({error:"CHECKOUT_CREATE_FAILED"},{status:500,headers:cors(origin)});
 let access;try{access=await token(c)}catch(e){return Response.json({error:String(e.message)},{status:503,headers:cors(origin)})}
 const value=(Number(o.amount_minor)/100).toFixed(2);
 const returnUrl=APP+"/?checkout=approved&cid="+intent.id+"&cs="+encodeURIComponent(secret),cancelUrl=APP+"/?checkout=cancelled&cid="+intent.id+"&ct="+encodeURIComponent(cancelToken);
 const pr=await fetch(c.base+"/v2/checkout/orders",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json","PayPal-Request-Id":"checkout-"+intent.id},body:JSON.stringify({
   intent:"CAPTURE",
   payment_source:{paypal:{experience_context:{brand_name:"FINORVE",locale:"es-ES",landing_page:"GUEST_CHECKOUT",payment_method_preference:"IMMEDIATE_PAYMENT_REQUIRED",shipping_preference:"NO_SHIPPING",user_action:"PAY_NOW",return_url:returnUrl,cancel_url:cancelUrl}}},
   purchase_units:[{custom_id:intent.id,description:"FINORVE · Acceso completo",amount:{currency_code:o.currency,value}}]
 })});
 const pj=await pr.json().catch(()=>({}));
 if(!pr.ok||!pj.id){await db.from("checkout_intents").update({status:"failed",raw:{create_error:pj},updated_at:new Date().toISOString()}).eq("id",intent.id);return Response.json({error:"PAYPAL_ORDER_CREATE_FAILED"},{status:502,headers:cors(origin)})}
 const au=approve(pj);if(!au)return Response.json({error:"PAYPAL_APPROVAL_URL_MISSING"},{status:502,headers:cors(origin)});
 await db.from("checkout_intents").update({provider_order_id:pj.id,raw:{create_status:pj.status,landing_page:"GUEST_CHECKOUT"},updated_at:new Date().toISOString()}).eq("id",intent.id);
 return Response.json({order_id:pj.id,approve_url:au,checkout_id:intent.id,checkout_secret:secret},{headers:cors(origin)});
});