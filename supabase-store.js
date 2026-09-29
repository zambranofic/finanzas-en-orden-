const URL='https://euqhrqsatbhnxgohbild.supabase.co';
const KEY='sb_publishable_Ltn-8m11gMlS2AY14k8nfA_hcJ3Izjl';
const SESSION='feo-supabase-session';
const headers=(token,extra={})=>({'apikey':KEY,'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{ }),...extra});
const getSession=()=>{try{return JSON.parse(localStorage.getItem(SESSION))}catch{return null}};
const setSession=s=>s?localStorage.setItem(SESSION,JSON.stringify(s)):localStorage.removeItem(SESSION);
async function jsonFetch(path,opts={}){const r=await fetch(URL+path,opts);const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok)throw new Error(body?.msg||body?.message||body?.error_description||`HTTP ${r.status}`);return body}
export async function signIn(email,password){const s=await jsonFetch('/auth/v1/token?grant_type=password',{method:'POST',headers:headers(null),body:JSON.stringify({email,password})});setSession(s);return s}
export async function signUp(email,password){const redirectTo=location.origin+location.pathname;const s=await jsonFetch('/auth/v1/signup?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',headers:headers(null),body:JSON.stringify({email,password})});if(s?.access_token)setSession(s);return s}
export function signOut(){setSession(null)}
export function session(){return getSession()}
export async function currentUser(){const s=getSession();if(!s?.access_token)return null;try{return await jsonFetch('/auth/v1/user',{headers:headers(s.access_token)})}catch{setSession(null);return null}}
const kindMap={personal:{income:'income',expense:'expense',saving:'saving',debtPayment:'debt_payment',asset:'asset',debt:'debt',goal:'asset'},business:{sale:'sale',collection:'collection',cost:'cost',expense:'business_expense',cashPayment:'payment',debtPrincipal:'principal_payment',debtInterest:'interest_payment'}};
const reverse={personal:{income:'income',expense:'expense',saving:'saving',debt_payment:'debtPayment',asset:'asset',debt:'debt'},business:{sale:'sale',collection:'collection',cost:'cost',business_expense:'expense',payment:'cashPayment',principal_payment:'debtPrincipal',interest_payment:'debtInterest'}};
export async function loadData(){const s=getSession(),u=await currentUser();if(!s||!u)throw new Error('AUTH_REQUIRED');const [rows,profiles]=await Promise.all([
 jsonFetch('/rest/v1/movements?select=id,mode,kind,description,amount_minor,currency,occurred_on,is_demo,metadata&order=occurred_on.asc',{headers:headers(s.access_token)}),
 jsonFetch('/rest/v1/profiles?select=*&limit=1',{headers:headers(s.access_token)})
]);const records={personal:{},business:{}};for(const x of rows||[]){const type=reverse[x.mode]?.[x.kind];if(!type)continue;(records[x.mode][type]||(records[x.mode][type]=[])).push({id:x.id,name:x.description,amountMinor:Number(x.amount_minor),currency:x.currency,date:x.occurred_on,demo:x.is_demo,...(x.metadata||{})})}
 const p=profiles?.[0];const profile=p?{name:p.full_name||'',email:u.email||'',country:p.country||'Ecuador',personalCurrency:p.personal_currency||'USD',businessCurrency:p.business_currency||'USD',photo:p.avatar_path||'',tutorialCompleted:!!p.tutorial_completed,theme:p.theme||'system'}:{name:(u.email||'Usuario').split('@')[0],email:u.email||'',country:'Ecuador',personalCurrency:'USD',businessCurrency:'USD',photo:'',tutorialCompleted:false,theme:'system'};return {records,profile,user:u}}
export async function syncRecords(records,profile){const s=getSession(),u=await currentUser();if(!s||!u)return;const out=[];for(const mode of ['personal','business'])for(const [type,arr] of Object.entries(records[mode]||{}))for(const x of arr||[]){const kind=kindMap[mode]?.[type];if(!kind)continue;out.push({user_id:u.id,mode,kind,description:String(x.name||type).slice(0,180),amount_minor:Number(x.amountMinor)||0,currency:x.currency|| (mode==='personal'?profile.personalCurrency:profile.businessCurrency),fx_rate:1,base_currency:mode==='personal'?profile.personalCurrency:profile.businessCurrency,base_amount_minor:Number(x.amountMinor)||0,occurred_on:x.date||new Date().toISOString().slice(0,10),is_demo:!!x.demo,metadata:{direction:x.direction||undefined}})}await jsonFetch('/rest/v1/rpc/replace_my_movements',{method:'POST',headers:headers(s.access_token,{'Prefer':'return=minimal'}),body:JSON.stringify({items:out})})}
export async function saveProfile(p){const s=getSession(),u=await currentUser();if(!s||!u)return;const row={user_id:u.id,full_name:p.name||'',country:p.country||'Ecuador',personal_currency:p.personalCurrency||'USD',business_currency:p.businessCurrency||'USD',language:'es',theme:p.theme||'system',tutorial_completed:!!p.tutorialCompleted,avatar_path:p.photo||null,updated_at:new Date().toISOString()};await jsonFetch('/rest/v1/profiles?on_conflict=user_id',{method:'POST',headers:headers(s.access_token,{'Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(row)})}


export async function uploadAvatar(file){
 const s=getSession(),u=await currentUser(); if(!s||!u)throw new Error('AUTH_REQUIRED');
 const allowed=['image/jpeg','image/png','image/webp']; if(!allowed.includes(file.type))throw new Error('Usa una imagen JPEG, PNG o WebP.');
 if(file.size>2097152)throw new Error('La imagen no puede superar 2 MB.');
 const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'; const path=`${u.id}/avatar.${ext}`;
 const r=await fetch(`${URL}/storage/v1/object/avatars/${path}`,{method:'POST',headers:{'apikey':KEY,'Authorization':`Bearer ${s.access_token}`,'Content-Type':file.type,'x-upsert':'true'},body:file});
 if(!r.ok){let e={};try{e=await r.json()}catch{}throw new Error(e.message||`No se pudo subir la foto (${r.status})`)}
 return path;
}
export async function avatarObjectUrl(path){
 if(!path)return ''; const s=getSession(); if(!s?.access_token)return '';
 const r=await fetch(`${URL}/storage/v1/object/authenticated/avatars/${encodeURI(path)}`,{headers:{'apikey':KEY,'Authorization':`Bearer ${s.access_token}`}});
 if(!r.ok)return ''; return URL.createObjectURL(await r.blob());
}
export async function changePassword(password){if(String(password).length<8)throw new Error('La contraseña debe tener al menos 8 caracteres.');const s=getSession();if(!s?.access_token)throw new Error('AUTH_REQUIRED');return jsonFetch('/auth/v1/user',{method:'PUT',headers:headers(s.access_token),body:JSON.stringify({password})})}
export async function requestPasswordReset(email){if(!email)throw new Error('Escribe tu correo.');const redirectTo=`${location.origin}${location.pathname}`;return jsonFetch('/auth/v1/recover?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',headers:headers(null),body:JSON.stringify({email})})}
export function acceptAuthFromUrl(){const h=new URLSearchParams(location.hash.replace(/^#/,''));const type=h.get('type');const token=h.get('access_token');if(!token||!['signup','recovery','email_change','magiclink'].includes(type||''))return null;setSession({access_token:token,refresh_token:h.get('refresh_token')||'',token_type:'bearer',expires_in:Number(h.get('expires_in')||3600)});history.replaceState(null,'',location.pathname+location.search);return type}
export async function resendSignupConfirmation(email){if(!email)throw new Error('Escribe tu correo.');const redirectTo='https://finanzas-en-orden-bice.vercel.app';return jsonFetch('/auth/v1/resend?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',headers:headers(null),body:JSON.stringify({type:'signup',email})})}

export async function exportMyData(){
 const s=getSession(),u=await currentUser(); if(!s||!u)throw new Error('AUTH_REQUIRED');
 const [profile,movements,licenses,payments]=await Promise.all([
  jsonFetch('/rest/v1/profiles?select=user_id,full_name,country,personal_currency,business_currency,language,tutorial_completed,theme,avatar_path,created_at,updated_at&limit=1',{headers:headers(s.access_token)}),
  jsonFetch('/rest/v1/movements?select=id,mode,kind,description,amount_minor,currency,fx_rate,base_currency,base_amount_minor,occurred_on,is_demo,metadata,created_at,updated_at&order=occurred_on.asc',{headers:headers(s.access_token)}),
  jsonFetch('/rest/v1/licenses?select=status,product_code,access_type,activated_at,revoked_at,created_at,updated_at&limit=1',{headers:headers(s.access_token)}),
  jsonFetch('/rest/v1/payments?select=provider,provider_order_id,provider_capture_id,status,amount_minor,currency,created_at,updated_at&order=created_at.asc',{headers:headers(s.access_token)})
 ]);
 return {export_version:1,exported_at:new Date().toISOString(),account:{id:u.id,email:u.email||null,created_at:u.created_at||null},profile:profile?.[0]||null,movements:movements||[],license:licenses?.[0]||null,payments:payments||[]};
}

export async function deleteMyAccount(){const s=getSession();if(!s?.access_token)throw new Error('AUTH_REQUIRED');const r=await fetch(`${URL}/functions/v1/delete-my-account`,{method:'POST',headers:{'apikey':KEY,'Authorization':`Bearer ${s.access_token}`}});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||'No se pudo eliminar la cuenta.');setSession(null);return body}

export async function myLicense(){const s=getSession();if(!s?.access_token)throw new Error('AUTH_REQUIRED');const rows=await jsonFetch('/rest/v1/licenses?select=status,product_code,access_type,activated_at,revoked_at&limit=1',{headers:headers(s.access_token)});return rows?.[0]||null}
export async function createPayPalOrder(){const s=getSession();if(!s?.access_token)throw new Error('AUTH_REQUIRED');return jsonFetch('/functions/v1/paypal-create-order',{method:'POST',headers:headers(s.access_token),body:'{}'})}
export async function capturePayPalOrder(orderId){const s=getSession();if(!s?.access_token)throw new Error('AUTH_REQUIRED');return jsonFetch('/functions/v1/paypal-capture-order',{method:'POST',headers:headers(s.access_token),body:JSON.stringify({order_id:String(orderId||'')})})}
export async function isAdmin(){const s=getSession();if(!s?.access_token)return false;const rows=await jsonFetch('/rest/v1/admin_roles?select=role&limit=1',{headers:headers(s.access_token)});return rows?.[0]?.role==='admin'}
export async function adminDashboard(){const s=getSession();if(!s?.access_token)throw new Error('AUTH_REQUIRED');const d=await jsonFetch('/functions/v1/admin-list-users',{method:'POST',headers:headers(s.access_token),body:JSON.stringify({page:1,per_page:100})});return d}
export async function adminSetLicense(userId,status){if(!['active','inactive','revoked','refunded'].includes(status))throw new Error('Estado inválido');const s=getSession();if(!s?.access_token)throw new Error('AUTH_REQUIRED');return jsonFetch('/functions/v1/admin-set-license',{method:'POST',headers:headers(s.access_token),body:JSON.stringify({user_id:userId,status})})}
export async function adminAddNote(userId,note){const s=getSession(),u=await currentUser();if(!s||!u)throw new Error('AUTH_REQUIRED');return jsonFetch('/rest/v1/support_notes',{method:'POST',headers:headers(s.access_token,{'Prefer':'return=minimal'}),body:JSON.stringify({user_id:userId,note:String(note).trim().slice(0,1000),created_by:u.id})})}

export async function createPublicCheckout(email){return jsonFetch('/functions/v1/paypal-create-checkout',{method:'POST',headers:headers(null),body:JSON.stringify({email})})}
export async function capturePublicCheckout(checkoutId,checkoutSecret,orderId){return jsonFetch('/functions/v1/paypal-capture-checkout',{method:'POST',headers:headers(null),body:JSON.stringify({checkout_id:checkoutId,checkout_secret:checkoutSecret,order_id:orderId})})}
export async function createPaidAccount(email,password,claimToken){return jsonFetch('/functions/v1/create-paid-account',{method:'POST',headers:headers(null),body:JSON.stringify({email,password,claim_token:claimToken})})}
