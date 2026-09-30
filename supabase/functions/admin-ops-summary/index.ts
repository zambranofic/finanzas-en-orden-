import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async(req)=>{
  if(req.method!=="GET"&&req.method!=="POST")return new Response("Method Not Allowed",{status:405});
  const h=req.headers.get("Authorization");
  if(!h?.startsWith("Bearer "))return new Response("Unauthorized",{status:401});
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service)return Response.json({error:"SERVICE_NOT_CONFIGURED"},{status:503});
  const uc=createClient(url,anon,{global:{headers:{Authorization:h}}});
  const {data:{user},error:ue}=await uc.auth.getUser();
  if(ue||!user)return new Response("Unauthorized",{status:401});
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:role}=await db.from("admin_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(role?.role!=="admin")return new Response("Forbidden",{status:403});

  const {data:summary,error:summaryError}=await db.rpc("admin_ops_summary_internal");
  if(summaryError)return Response.json({error:"OPS_SUMMARY_FAILED"},{status:500,headers:{"Cache-Control":"no-store"}});
  return Response.json(summary,{headers:{"Cache-Control":"no-store"}});
});