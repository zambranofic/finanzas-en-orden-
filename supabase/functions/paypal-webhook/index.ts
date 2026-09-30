import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const get=(n)=>Deno.env.get(n);
function toMinorExact(value){const s=String(value??"").trim();const m=/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(s);if(!m)return null;const n=BigInt(m[1])*100n+BigInt((m[2]||"").padEnd(2,"0"));return n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null}
async function token(base,cid,secret){const r=await fetch(base+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+btoa(cid+":"+secret),"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});if(!r.ok)throw new Error("paypal auth");return (await r.json()).access_token}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
 const url=get("SUPABASE_URL"),service=get("SUPABASE_SERVICE_ROLE_KEY"),cid=get("PAYPAL_CLIENT_ID"),secret=get("PAYPAL_CLIENT_SECRET"),wid=get("PAYPAL_WEBHOOK_ID"),base=get("PAYPAL_BASE_URL")||"https://api-m.sandbox.paypal.com";
 if(!url||!service||!cid||!secret||!wid)return Response.json({error:"Webhook not configured"},{status:503});
 let event;try{event=await req.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 if(!event?.id||!event?.event_type)return Response.json({error:"Invalid event"},{status:400});
 const tid=req.headers.get("paypal-transmission-id"),tt=req.headers.get("paypal-transmission-time"),cu=req.headers.get("paypal-cert-url"),aa=req.headers.get("paypal-auth-algo"),ts=req.headers.get("paypal-transmission-sig");
 if(!tid||!tt||!cu||!aa||!ts)return Response.json({error:"Missing PayPal signature headers"},{status:400});
 let access;try{access=await token(base,cid,secret)}catch{return Response.json({error:"PayPal authentication failed"},{status:502})}
 const vr=await fetch(base+"/v1/notifications/verify-webhook-signature",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},body:JSON.stringify({auth_algo:aa,cert_url:cu,transmission_id:tid,transmission_sig:ts,transmission_time:tt,webhook_id:wid,webhook_event:event})});
 const vj=await vr.json().catch(()=>({}));
 if(!vr.ok||vj.verification_status!=="SUCCESS")return Response.json({error:"Invalid webhook signature"},{status:401});
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:existing}=await db.from("payment_events").select("id").eq("id",event.id).maybeSingle();
 if(existing)return Response.json({ok:true,duplicate:true});
 const type=event.event_type,res=event.resource||{},captureId=res.id||res.supplementary_data?.related_ids?.capture_id||null,orderId=res.supplementary_data?.related_ids?.order_id||null;
 let payment=null,checkout=null;
 if(captureId){let x=await db.from("payments").select("*").eq("provider_capture_id",captureId).maybeSingle();payment=x.data;if(!payment){x=await db.from("checkout_intents").select("*").eq("provider_capture_id",captureId).maybeSingle();checkout=x.data}}
 if(!payment&&!checkout&&orderId){let x=await db.from("payments").select("*").eq("provider_order_id",orderId).maybeSingle();payment=x.data;if(!payment){x=await db.from("checkout_intents").select("*").eq("provider_order_id",orderId).maybeSingle();checkout=x.data}}
 if(type==="PAYMENT.CAPTURE.COMPLETED"&&payment){
   const amount=res.amount,minor=toMinorExact(amount?.value);
   if(res.status!=="COMPLETED"||amount?.currency_code!==payment.currency||minor===null||minor!==Number(payment.amount_minor))return Response.json({error:"Capture mismatch"},{status:409});
   const {error:e}=await db.rpc("apply_paypal_capture_event_internal",{p_event_id:event.id,p_payment_id:payment.id,p_user_id:payment.user_id,p_capture_id:captureId,p_raw:event});
   if(e)return Response.json({error:"Capture reconciliation failed"},{status:500});
   return Response.json({ok:true,reconciled:true});
 }
 if(type==="PAYMENT.CAPTURE.COMPLETED"&&checkout){
   const amount=res.amount,minor=toMinorExact(amount?.value);
   if(res.status!=="COMPLETED"||amount?.currency_code!==checkout.currency||minor===null||minor!==Number(checkout.amount_minor))return Response.json({error:"Checkout capture mismatch"},{status:409});
   const {error:ue}=await db.from("checkout_intents").update({provider_capture_id:captureId,status:"completed",raw:{...checkout.raw,webhook_capture:event},updated_at:new Date().toISOString()}).eq("id",checkout.id);
   if(ue)return Response.json({error:"Checkout capture reconciliation failed"},{status:500});
   const {error:ie}=await db.from("payment_events").insert({id:event.id,provider:"paypal",event_type:type,raw:event});
   if(ie?.code!=="23505"&&ie)return Response.json({error:"Event persistence failed"},{status:500});
   return Response.json({ok:true,reconciled:true,checkout:true});
 }
 if(["PAYMENT.CAPTURE.REFUNDED","PAYMENT.CAPTURE.REVERSED","PAYMENT.CAPTURE.DENIED"].includes(type)&&payment){
   if(type==="PAYMENT.CAPTURE.REFUNDED"){const refundMinor=toMinorExact(res.amount?.value);if(res.amount?.currency_code!==payment.currency||refundMinor===null)return Response.json({error:"Refund amount mismatch"},{status:409});if(refundMinor<Number(payment.amount_minor)){const {error:ie}=await db.from("payment_events").insert({id:event.id,provider:"paypal",event_type:type,raw:event});if(ie?.code!=="23505"&&ie)return Response.json({error:"Event persistence failed"},{status:500});return Response.json({ok:true,partial_refund:true})}if(refundMinor!==Number(payment.amount_minor))return Response.json({error:"Refund amount mismatch"},{status:409})}
   const ps=type.endsWith("REFUNDED")?"refunded":type.endsWith("REVERSED")?"reversed":"denied";
   const ls=type.endsWith("REFUNDED")?"refunded":"revoked";
   const {error:e}=await db.rpc("apply_paypal_terminal_event_internal",{p_event_id:event.id,p_payment_id:payment.id,p_user_id:payment.user_id,p_payment_status:ps,p_license_status:ls,p_raw:event});
   if(e)return Response.json({error:"Terminal payment reconciliation failed"},{status:500});
   return Response.json({ok:true,reconciled:true});
 }
 if(["PAYMENT.CAPTURE.REFUNDED","PAYMENT.CAPTURE.REVERSED","PAYMENT.CAPTURE.DENIED"].includes(type)&&checkout){
   if(type==="PAYMENT.CAPTURE.REFUNDED"){const refundMinor=toMinorExact(res.amount?.value);if(res.amount?.currency_code!==checkout.currency||refundMinor===null)return Response.json({error:"Refund amount mismatch"},{status:409});if(refundMinor<Number(checkout.amount_minor)){const {error:ie}=await db.from("payment_events").insert({id:event.id,provider:"paypal",event_type:type,raw:event});if(ie?.code!=="23505"&&ie)return Response.json({error:"Event persistence failed"},{status:500});return Response.json({ok:true,partial_refund:true,checkout:true})}if(refundMinor!==Number(checkout.amount_minor))return Response.json({error:"Refund amount mismatch"},{status:409})}
   const cs=type.endsWith("REFUNDED")?"refunded":type.endsWith("REVERSED")?"reversed":"failed";
   const {error:e}=await db.rpc("apply_checkout_terminal_event_internal",{p_event_id:event.id,p_checkout_id:checkout.id,p_status:cs,p_raw:event});
   if(e)return Response.json({error:"Checkout terminal reconciliation failed"},{status:500});
   return Response.json({ok:true,reconciled:true,checkout:true});
 }
 const {error:ie}=await db.from("payment_events").insert({id:event.id,provider:"paypal",event_type:type,raw:event});
 if(ie?.code!=="23505"&&ie)return Response.json({error:"Event persistence failed"},{status:500});
 return Response.json({ok:true});
});