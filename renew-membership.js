import {membershipRequest,membershipGuestRequest,currentUser} from './supabase-store.js';
const $=id=>document.getElementById(id),KEY='finorve-membership-checkout';
const purchase=!!$('purchase-email');
let info=null,busy=false,activeIntent=null,timer;
const show=(message,success=false)=>{ $('status').textContent=message;$('status').className=success?'success':''; };
const errors={AUTH_REQUIRED:'Inicia sesión en FINORVE para renovar.',CHECKOUT_EXPIRED:'El formulario caducó. Consulta el resultado antes de iniciar otro pago.',CONFIRMATION_REQUIRES_REVIEW:'Este pago requiere revisión. No vuelvas a pagar.',PAYPHONE_CONFIRMATION_UNCERTAIN:'Payphone no dio una respuesta definitiva. No vuelvas a pagar.',CHECKOUT_CONFIGURATION_CHANGED:'Cambió la configuración del pago. Hay que revisar la operación antes de repetirla.'};
async function request(body){try{return await (purchase?membershipGuestRequest:membershipRequest)(body)}catch(e){throw new Error(errors[e.message]||'No pudimos completar esta operación. Conserva esta pantalla y consulta el resultado antes de repetir el pago.')}}
function result(r){
 if(!activeIntent||r.mode!==activeIntent.mode)throw new Error('El resultado no corresponde al pago iniciado.');
 if(r.status==='approved'||r.status==='cancelled'){
  clearTimeout(timer);$('pp-button').hidden=true;$('check-status').hidden=true;sessionStorage.removeItem(KEY);
  if(r.needs_signup&&r.claim_token&&r.email){localStorage.setItem('feo-paid-checkout',JSON.stringify({email:r.email,claim:r.claim_token,existingAccount:false,expiresAt:Date.now()+86400000}));location.href='/';return}
  show(r.status==='cancelled'?'Payphone registra este pago como cancelado. Tu vigencia no ha cambiado.':r.claimed?'Tu compra ya está asociada a una cuenta. Vuelve a FINORVE e inicia sesión.':r.access_activated?`Membresía renovada hasta ${new Date(r.expires_at).toLocaleDateString('es-EC',{timeZone:'America/Guayaquil'})}.`:'Prueba aprobada y confirmada. Tu membresía real no ha cambiado.',r.status==='approved');
 }else show('El pago está pendiente. No repitas el pago; consulta el resultado.');
}
async function confirm(id,cid){if(busy||cid!==activeIntent?.checkout_id)return;busy=true;show('Confirmando tu pago…');try{result(await request({action:'confirm',checkout_id:cid,checkout_secret:activeIntent.checkout_secret,transaction_id:String(id)}))}catch(e){show(e.message)}finally{busy=false}}
async function check(){if(busy||!activeIntent)return;busy=true;show('Consultando el resultado…');try{const r=await request({action:'status',checkout_id:activeIntent.checkout_id,checkout_secret:activeIntent.checkout_secret});if(r.status==='needs_confirmation'){busy=false;await confirm(r.transaction_id,activeIntent.checkout_id)}else result(r)}catch(e){show(e.message)}finally{busy=false}}
async function sdk(){if(window.PPaymentButtonBox)return;const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css';document.head.append(css);await new Promise((resolve,reject)=>{const s=document.createElement('script');s.type='module';s.src='https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js';s.onload=resolve;s.onerror=()=>reject(new Error('No se pudo cargar Payphone.'));document.head.append(s)});if(!window.PPaymentButtonBox)throw new Error('Payphone no está disponible.')}
$('check-status').onclick=check;
window.addEventListener('processPaymentAsync',e=>{const r=e.detail;if(r?.transactionId&&r.clientTransactionId===activeIntent?.checkout_id)void confirm(r.transactionId,r.clientTransactionId);else if(r==='errorProcess')show('Payphone no pudo procesar el pago. Revisa el mensaje del formulario.');});
$('renew-form').onsubmit=async e=>{e.preventDefault();if(busy||!info)return;if(info.mode==='test'&&!$('test-mode').checked){show('Confirma el modo Prueba antes de continuar.');return}busy=true;$('start').disabled=true;try{
 await sdk();const r=await request({action:'create',email:purchase?$('purchase-email').value.trim():undefined,confirm_test_mode:$('test-mode').checked});if(r.mode!==info.mode)throw new Error('La configuración cambió. Actualiza esta página.');
 activeIntent={checkout_id:r.checkout_id,checkout_secret:r.checkout_secret,expires_at:r.expires_at,mode:r.mode};sessionStorage.setItem(KEY,JSON.stringify(activeIntent));
 const box=new window.PPaymentButtonBox({...r.box,isAsyncResponse:true,showPayphonePayment:false,showCashPayment:false,showClickToPay:false,showPaymentMethodSelector:false});box.onCompletedPayment(x=>{if(x?.clientTransactionId===activeIntent?.checkout_id)void confirm(x.transactionId,x.clientTransactionId)});box.render('pp-button');delete r.box.token;
 $('pp-button').hidden=false;$('renew-form').hidden=true;$('check-status').hidden=false;show(info.mode==='test'?'Completa la simulación de $1 USD. Esta prueba no modifica tu acceso.':'Completa el pago para renovar un año.');
 $('pp-button').addEventListener('submit',()=>{show('Procesando el pago. No vuelvas a pulsar Pagar.');clearTimeout(timer);timer=setTimeout(()=>show('El pago tarda en responder. Consulta el resultado sin repetirlo.'),45000)},{capture:true});
 }catch(e){show(e.message);$('start').disabled=false}finally{busy=false}};
async function boot(){if(!purchase&&!await currentUser()){ $('membership-summary').textContent='Inicia sesión en FINORVE y vuelve a esta página para renovar tu membresía.';return}try{
 info=await request({action:'info'});const amount=new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(info.annual_price_minor/100);
 $('membership-summary').textContent=`Tu tarifa anual: ${amount} USD por un año. ${info.expires_at?'Vencimiento actual: '+new Date(info.expires_at).toLocaleDateString('es-EC',{timeZone:'America/Guayaquil'})+'. ':''}${info.mode==='test'?'Modo Prueba: el cobro simulado es $1 USD y no renueva el acceso.':'Al pagar, sumamos un año desde tu vencimiento actual si aún está vigente; si ya venció, desde hoy.'}`;
 $('test-confirmation').hidden=info.mode!=='test';$('start').textContent=info.mode==='test'?'Cargar formulario de prueba':purchase?'Pagar membresía anual':'Pagar renovación anual';
 try{activeIntent=JSON.parse(sessionStorage.getItem(KEY))}catch{};
 if(activeIntent){$('check-status').hidden=false;await check()}else $('renew-form').hidden=false;
 }catch(e){show(e.message);$('membership-summary').textContent='No pudimos consultar tu membresía.'}}
void boot();
