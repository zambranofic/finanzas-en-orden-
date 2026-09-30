// Only sends precomputed, unique renewal reminders. Caller cannot choose a recipient or message.
const APP_KEY='sb_publishable_Ltn-8m11gMlS2AY14k8nfA_hcJ3Izjl';
async function db(path,options={}){const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('DATABASE_UNAVAILABLE');return r.json()}
Deno.serve(async req=>{
 const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 if(req.headers.get('apikey')!==APP_KEY)return json({error:'APP_KEY_REQUIRED'},401);
 const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('MEMBERSHIP_EMAIL_FROM');
 if(!key||!from)return json({enabled:false,sent:0,reason:'EMAIL_NOT_CONFIGURED'});
 try{
  const rate=await db('rpc/consume_rate_limit_internal',{method:'POST',body:JSON.stringify({p_endpoint:'membership-email:worker',p_subject_hash:'0000000000000000000000000000000000000000000000000000000000000000',p_window_seconds:60,p_limit:1})});
  if(!rate?.allowed)return json({error:'TOO_MANY_ATTEMPTS'},429);
  const rows=await db('rpc/claim_membership_reminders_internal',{method:'POST',body:'{}'});let sent=0;
  for(const row of rows){
   const day=new Date(row.expires_at).toLocaleDateString('es-EC',{timeZone:'America/Guayaquil'});
   const text=`Tu membresía anual de FINORVE vence ${row.threshold_days?'en '+row.threshold_days+' días':'hoy'}, el ${day}. Renueva desde tu cuenta: https://finorve.com/renovar.html. Si renuevas antes de vencer, conservas tu tarifa y sumas un año desde tu vencimiento actual. La renovación es manual; no se realizan cobros automáticos.`;
   let state='uncertain',providerId=null;
   try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'membership-reminder/'+row.id},body:JSON.stringify({from,to:[row.email],subject:row.threshold_days?'Tu membresía de FINORVE vence en '+row.threshold_days+' días':'Tu membresía de FINORVE vence hoy',text}),signal:AbortSignal.timeout(15000)});
    const data=await r.json().catch(()=>null);if(r.ok&&data?.id){state='sent';providerId=data.id;sent++}else if(r.status>=400&&r.status<500)state='failed';
   }catch{/* Uncertain deliveries are not blindly retried. */}
   await db('membership_reminders?id=eq.'+row.id+'&status=eq.sending',{method:'PATCH',body:JSON.stringify({status:state,provider_id:providerId,updated_at:new Date().toISOString()})});
  }
  return json({enabled:true,sent});
 }catch{return json({error:'REMINDER_DELIVERY_UNAVAILABLE'},503)}
});
