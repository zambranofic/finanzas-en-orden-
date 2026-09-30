import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const ALLOWED=new Set(["https://finorve.com","https://www.finorve.com"]);
const cors=(origin)=>({"Access-Control-Allow-Origin":ALLOWED.has(origin||"")?origin:"https://finorve.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET,OPTIONS","Vary":"Origin","Cache-Control":"no-store"});
Deno.serve((req)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS"){if(origin&&!ALLOWED.has(origin))return new Response("Forbidden",{status:403});return new Response("ok",{headers:cors(origin)})}
 if(origin&&!ALLOWED.has(origin))return Response.json({error:"ORIGIN_NOT_ALLOWED"},{status:403,headers:cors(origin)});
 if(req.method!=="GET")return new Response("Method Not Allowed",{status:405,headers:cors(origin)});
 const clientId=Deno.env.get("PAYPAL_CLIENT_ID");
 const base=Deno.env.get("PAYPAL_BASE_URL")||"https://api-m.sandbox.paypal.com";
 if(!clientId)return Response.json({error:"PAYPAL_NOT_CONFIGURED"},{status:503,headers:cors(origin)});
 return Response.json({clientId,environment:base.includes("sandbox")?"sandbox":"live",currency:"USD"},{headers:cors(origin)});
});