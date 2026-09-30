import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const ALLOWED=new Set(["https://finorve.com","https://www.finorve.com"]);
const cors=(origin)=>({"Access-Control-Allow-Origin":ALLOWED.has(origin||"")?origin:"https://finorve.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin","Cache-Control":"no-store"});
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS"){if(origin&&!ALLOWED.has(origin))return new Response("Forbidden",{status:403});return new Response("ok",{headers:cors(origin)})}
 if(origin&&!ALLOWED.has(origin))return Response.json({error:"ORIGIN_NOT_ALLOWED"},{status:403,headers:cors(origin)});
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:cors(origin)});
 let body;try{body=await req.json()}catch{return Response.json({error:"INVALID_JSON"},{status:400,headers:cors(origin)})}
 const cid=String(body?.checkout_id||""),cancelToken=String(body?.cancel_token||""),legacySecret=String(body?.checkout_secret||"");
 if(!cid||(!cancelToken&&!legacySecret))return Response.json({error:"MISSING_CHECKOUT_DATA"},{status:400,headers:cors(origin)});
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const rawIp=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
 const [checkoutLimit,ipLimit]=await Promise.all([
   db.rpc("consume_rate_limit_internal",{p_endpoint:"paypal-cancel-checkout:checkout",p_subject_hash:await sha(cid),p_window_seconds:900,p_limit:8}),
   db.rpc("consume_rate_limit_internal",{p_endpoint:"paypal-cancel-checkout:ip",p_subject_hash:await sha(rawIp),p_window_seconds:900,p_limit:20})
 ]);
 if(checkoutLimit.error||ipLimit.error)return Response.json({error:"RATE_LIMIT_UNAVAILABLE"},{status:503,headers:cors(origin)});
 const denied=[checkoutLimit.data,ipLimit.data].filter((x)=>x&&!x.allowed);
 if(denied.length){const retry=Math.max(...denied.map((x)=>Number(x.retry_after||1)));return Response.json({error:"TOO_MANY_CANCEL_ATTEMPTS"},{status:429,headers:{...cors(origin),"Retry-After":String(retry)}})}
 const {data:intent}=await db.from("checkout_intents").select("id,status,checkout_secret_hash,cancel_token_hash").eq("id",cid).maybeSingle();
 if(!intent)return Response.json({error:"CHECKOUT_NOT_FOUND"},{status:404,headers:cors(origin)});
 const presentedHash=await sha(cancelToken||legacySecret);
 const valid=intent.cancel_token_hash?presentedHash===intent.cancel_token_hash:presentedHash===intent.checkout_secret_hash;
 if(!valid)return Response.json({error:"INVALID_CANCEL_TOKEN"},{status:401,headers:cors(origin)});
 if(["completed","claimed","refunded","reversed"].includes(intent.status))return Response.json({ok:true,status:intent.status,unchanged:true},{headers:cors(origin)});
 const {error}=await db.from("checkout_intents").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",cid).in("status",["created","approved","failed"]);
 if(error)return Response.json({error:"CHECKOUT_CANCEL_FAILED"},{status:500,headers:cors(origin)});
 return Response.json({ok:true,status:"cancelled"},{headers:cors(origin)});
});