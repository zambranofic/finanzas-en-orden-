import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const hex=(b)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return new Response("Method Not Allowed",{status:405});
  const authHeader=req.headers.get("Authorization");
  if(!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized",{status:401});
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user) return new Response("Unauthorized",{status:401});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:role}=await admin.from("admin_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(role?.role!=="admin") return new Response("Forbidden",{status:403});
  const {data:limit,error:limitError}=await admin.rpc("consume_rate_limit_internal",{p_endpoint:"admin-list-users:user",p_subject_hash:await sha(user.id),p_window_seconds:300,p_limit:30});
  if(limitError) return Response.json({error:"RATE_LIMIT_UNAVAILABLE"},{status:503});
  if(limit&&!limit.allowed) return Response.json({error:"TOO_MANY_ADMIN_REQUESTS"},{status:429,headers:{"Retry-After":String(limit.retry_after||1)}});

  let page=1, perPage=50;
  if(req.method==="POST"){try{const b=await req.json();page=Math.max(1,Math.min(10000,Number(b?.page)||1));perPage=Math.max(1,Math.min(100,Number(b?.per_page)||50))}catch{}}
  const {data:authData,error:authError}=await admin.auth.admin.listUsers({page,perPage});
  if(authError) return Response.json({error:"Could not list users"},{status:500});
  const ids=authData.users.map(u=>u.id);
  if(!ids.length) return Response.json({users:[],page,per_page:perPage});

  const [{data:profiles},{data:licenses},{data:payments}]=await Promise.all([
    admin.from("profiles").select("user_id,full_name,country").in("user_id",ids),
    admin.from("licenses").select("user_id,status,activated_at,expires_at,revoked_at").in("user_id",ids),
    admin.from("payments").select("user_id,status,amount_minor,currency,created_at").in("user_id",ids).order("created_at",{ascending:false})
  ]);
  const pm=new Map((profiles||[]).map((x:any)=>[x.user_id,x]));
  const lm=new Map((licenses||[]).map((x:any)=>[x.user_id,x]));
  const paym=new Map<string,any>(); for(const p of payments||[]) if(!paym.has(p.user_id)) paym.set(p.user_id,p);
  const users=authData.users.map(u=>({id:u.id,email:u.email||null,created_at:u.created_at,last_sign_in_at:u.last_sign_in_at||null,
    full_name:pm.get(u.id)?.full_name||null,country:pm.get(u.id)?.country||null,
    license:lm.get(u.id)||null,last_payment:paym.get(u.id)||null}));
  return Response.json({users,page,per_page:perPage});
});