import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowed = new Set(["active","inactive","revoked","refunded"]);
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed",{status:405});
  const authHeader=req.headers.get("Authorization");
  if(!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized",{status:401});
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user) return new Response("Unauthorized",{status:401});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:role}=await admin.from("admin_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(role?.role!=="admin") return new Response("Forbidden",{status:403});
  const {data:limit,error:limitError}=await admin.rpc("consume_rate_limit_internal",{p_endpoint:"admin-set-license:user",p_subject_hash:await sha(user.id),p_window_seconds:300,p_limit:20});
  if(limitError) return Response.json({error:"RATE_LIMIT_UNAVAILABLE"},{status:503});
  if(limit&&!limit.allowed) return Response.json({error:"TOO_MANY_ADMIN_ACTIONS"},{status:429,headers:{"Retry-After":String(limit.retry_after||1)}});
  let body:any; try{body=await req.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
  const target=String(body?.user_id||""), status=String(body?.status||"");
  if(!/^[0-9a-f-]{36}$/i.test(target)||!allowed.has(status)) return Response.json({error:"Invalid request"},{status:400});
  const now=new Date().toISOString();
  const patch:any={status,updated_at:now};
  if(status==="active"){const expiry=new Date();expiry.setUTCFullYear(expiry.getUTCFullYear()+1);patch.activated_at=now;patch.expires_at=expiry.toISOString();patch.revoked_at=null}
  if(status==="revoked"||status==="refunded"){patch.revoked_at=now}
  const {data:license,error:updateError}=await admin.from("licenses").update(patch).eq("user_id",target).select("user_id,status,activated_at,expires_at,revoked_at").maybeSingle();
  if(updateError) return Response.json({error:"License update failed"},{status:500});
  if(!license) return Response.json({error:"License not found"},{status:404});
  const action=status==="active"?"license_activate":status==="inactive"?"license_deactivate":status==="revoked"?"license_revoke":"license_refund";
  const {error:auditError}=await admin.from("admin_audit_log").insert({actor_user_id:user.id,target_user_id:target,action,metadata:{new_status:status}});
  if(auditError) return Response.json({error:"Audit write failed; license changed"},{status:500});
  return Response.json({ok:true,license});
});