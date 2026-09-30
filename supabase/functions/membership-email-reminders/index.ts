// Only sends precomputed, unique renewal reminders. Caller cannot choose a recipient or message.
const APP_KEY='sb_publishable_Ltn-8m11gMlS2AY14k8nfA_hcJ3Izjl';
async function db(path,options={}){const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('DATABASE_UNAVAILABLE');return r.json()}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function reminderHtml(days,day){
 const timing=days?'en '+escapeHtml(days)+' días':'hoy';
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aviso de vencimiento FINORVE</title></head>
<body style="margin:0;padding:0;background-color:#071F1A;font-family:Arial,Helvetica,sans-serif;color:#F2FAF6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Tu membresía vence ${timing}. Revisa tu fecha y renueva desde tu cuenta.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#071F1A"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#10352B;border:1px solid #285346;border-radius:16px">
<tr><td style="padding:32px 28px 20px"><p style="margin:0;color:#8DE5BD;font-size:28px;font-weight:bold;letter-spacing:3px">FINORVE</p><p style="margin:8px 0 0;color:#BCD3C8;font-size:12px;letter-spacing:2px">AVISO DE MEMBRESÍA</p></td></tr>
<tr><td style="padding:0 28px 28px"><h1 style="margin:0 0 20px;font-size:28px;line-height:1.3;color:#F2FAF6">Tu membresía vence ${timing}</h1>
<p style="font-size:16px;line-height:1.6;color:#D4E5DB">Te recordamos la fecha de vencimiento de tu membresía anual de FINORVE.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#071F1A;border:1px solid #285346;border-radius:10px"><tr><td style="padding:20px"><p style="margin:0 0 8px;color:#BCD3C8;font-size:13px">FECHA DE VENCIMIENTO</p><p style="margin:0;color:#8DE5BD;font-size:24px;font-weight:bold">${escapeHtml(day)}</p></td></tr></table>
<p style="font-size:16px;line-height:1.6;color:#D4E5DB">Si renuevas antes de vencer, conservas tu tarifa y sumas un año desde tu vencimiento actual.</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#8DE5BD" style="background-color:#8DE5BD;border-radius:8px"><a href="https://finorve.com/renovar.html" style="display:inline-block;padding:16px 24px;border:1px solid #8DE5BD;border-radius:8px;font-size:16px;font-weight:bold;color:#071F1A;text-decoration:none">Renovar mi membresía</a></td></tr></table>
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#BCD3C8">Si el botón no abre, accede a:<br><a href="https://finorve.com/renovar.html" style="color:#8DE5BD;word-break:break-all">https://finorve.com/renovar.html</a></p>
</td></tr><tr><td style="padding:20px 28px;border-top:1px solid #285346;color:#BCD3C8;font-size:13px;line-height:1.6">Renovación manual, sin cobros automáticos.<br>FINORVE · Aviso sobre tu membresía</td></tr></table>
</td></tr></table></body></html>`;
}

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
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'membership-reminder/'+row.id},body:JSON.stringify({from,to:[row.email],subject:row.threshold_days?'Tu membresía de FINORVE vence en '+row.threshold_days+' días':'Tu membresía de FINORVE vence hoy',text,html:reminderHtml(row.threshold_days,day)}),signal:AbortSignal.timeout(15000)});
    const data=await r.json().catch(()=>null);if(r.ok&&data?.id){state='sent';providerId=data.id;sent++}else if(r.status>=400&&r.status<500)state='failed';
   }catch{/* Uncertain deliveries are not blindly retried. */}
   await db('membership_reminders?id=eq.'+row.id+'&status=eq.sending',{method:'PATCH',body:JSON.stringify({status:state,provider_id:providerId,updated_at:new Date().toISOString()})});
  }
  return json({enabled:true,sent});
 }catch{return json({error:'REMINDER_DELIVERY_UNAVAILABLE'},503)}
});
