import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(()=>new Response("Not Found",{status:404,headers:{"Cache-Control":"no-store"}}));