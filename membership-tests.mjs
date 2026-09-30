import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {membershipState,membershipBanner,membershipCard} from './membership-ui.js';
const now=Date.parse('2026-09-30T14:00:00Z'),expiry=new Date(now+30*86400000).toISOString();
assert.equal(membershipState({status:'active',expires_at:expiry},now).remaining,30);
assert(membershipBanner({status:'active',expires_at:expiry},now).includes('30 días'));
assert.equal(membershipBanner({status:'active',expires_at:new Date(now+31*86400000).toISOString()},now),'');
assert.equal(membershipState({status:'active',expires_at:new Date(now).toISOString()},now).active,false);
assert.equal(membershipState({status:'active',expires_at:null},now).active,false);
assert(membershipCard({status:'active',expires_at:expiry,annual_price_minor:2900},now).includes('Calendario de membresía'));
const code=fs.readFileSync('supabase/functions/payphone-membership/index.ts','utf8');
const uid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222',store='36da299e-cd67-4dd7-a236-d460172d7c6c',secret=cid+'.'+cid,key='sb_publishable_Ltn-8m11gMlS2AY14k8nfA_hcJ3Izjl';
const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))).toString('hex');
function fixture({live=false,guest=false,expired=false,other=false,wrongAmount=false}={}){
 let handler,apply=0,claims=0,providerCalls=0;
 const mode=live?'live':'test',amount=live?2900:100;
 const row={id:cid,user_id:guest?null:other?'33333333-3333-4333-8333-333333333333':uid,email:guest?'test@example.com':null,mode,store_id:store,amount_minor:amount,annual_price_minor:2900,currency:'USD',offer_code:'feo_v1',secret_hash:hash,status:'created',expires_at:new Date(Date.now()+600000).toISOString()};
 const env={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'fake-service-key',PAYPHONE_TOKEN:'fake-token-only',PAYPHONE_STORE_ID:store,...(live?{PAYPHONE_LIVE_ENABLED:'true'}:{})};
 const fetch=async (url,opts={})=>{
  const u=new URL(url);
  if(u.pathname==='/auth/v1/user')return Response.json({id:uid});
  if(u.hostname==='paymentbox.payphonetodoesposible.com'){providerCalls++;return Response.json({clientTransactionId:cid,transactionId:12345,amount:wrongAmount?amount+1:amount,currency:'USD',statusCode:3,transactionStatus:'Approved'})}
  if(u.pathname.endsWith('/rpc/consume_rate_limit_internal'))return Response.json({allowed:true});
  if(u.pathname.endsWith('/rpc/apply_membership_checkout_internal')){apply++;assert.equal(row.mode,'live');assert.equal(row.status,'confirmed');row.status='approved';row.applied_expires_at='2027-10-30T14:00:00Z';return Response.json({expires_at:row.applied_expires_at})}
  if(u.pathname.endsWith('/rpc/prepare_payphone_claim_internal')){claims++;assert.equal(row.mode,'live');assert.equal(row.user_id,null);row.status='approved';return Response.json({claimed:false,email:row.email})}
  if(u.pathname.endsWith('/offers'))return Response.json([{code:'feo_v1',amount_minor:3500,currency:'USD',active:true}]);
  if(u.pathname.endsWith('/licenses'))return Response.json(guest?[]:[{status:'active',expires_at:new Date(Date.now()+(expired?-1:1)*86400000).toISOString(),annual_price_minor:2900}]);
  assert.equal(u.pathname,'/rest/v1/membership_checkouts');
  if(opts.method==='POST'){Object.assign(row,JSON.parse(opts.body));return Response.json([{...row}])}
  if(opts.method==='PATCH'){if(u.searchParams.get('status')&&u.searchParams.get('status')!=='eq.'+row.status)return Response.json([]);Object.assign(row,JSON.parse(opts.body))}
  return Response.json([{...row}]);
 };
 vm.runInNewContext(code,{Deno:{env:{get:n=>env[n]},serve:f=>handler=f},fetch,crypto:webcrypto,TextEncoder,AbortSignal,Response,console:{error:()=>{}}});
 const req=async(body,auth=!guest)=>{const response=await handler(new Request('https://fn.example',{method:'POST',headers:{apikey:key,...(auth?{Authorization:'Bearer fake-user-token'}:{})},body:JSON.stringify({...body,...(guest?{guest:true}:{})})}));return {status:response.status,body:await response.json()}};
 return {req,row,counts:()=>({apply,claims,providerCalls})};
}
const confirm={action:'confirm',checkout_id:cid,checkout_secret:secret,transaction_id:'12345'};
{
 const f=fixture();assert.equal((await f.req({action:'info'})).body.annual_price_minor,2900);
 const r=await f.req(confirm);assert.equal(r.status,200);assert.equal(r.body.access_activated,false);assert.equal(f.counts().apply,0);
 assert.equal((await f.req(confirm)).body.recovered,true);assert.equal(f.counts().providerCalls,1);
}
assert.equal((await fixture({expired:true}).req({action:'info'})).body.annual_price_minor,3500);
{
 const f=fixture({live:true});const r=await f.req(confirm);assert.equal(r.body.access_activated,true);assert.equal(f.counts().apply,1);
 await f.req(confirm);assert.deepEqual(f.counts(),{apply:1,claims:0,providerCalls:1});
}
{
 const f=fixture({live:true,guest:true});const r=await f.req(confirm);assert.equal(r.body.needs_signup,true);assert.equal(r.body.access_activated,false);assert(r.body.claim_token);assert.equal(f.counts().apply,0);
}
assert.equal((await fixture({other:true}).req(confirm)).status,401);
assert.equal((await fixture().req({...confirm,checkout_secret:'x'.repeat(70)})).status,401);
assert.equal((await fixture({wrongAmount:true,live:true}).req(confirm)).status,409);
assert.equal((await fixture().req({action:'info'},false)).status,401);
{
 const f=fixture({guest:true});const c=await f.req({action:'create',email:'test@example.com',confirm_test_mode:true,amount:1,mode:'live'});assert.equal(c.body.mode,'test');assert.equal(c.body.box.amount,100);assert.equal(c.body.annual_price_minor,3500);
 assert.equal(f.row.user_id,null);assert.equal(f.row.annual_price_minor,3500);
}
console.log('membership-tests: OK — grandfathered prices, expiry, authenticated ownership, duplicate confirmation, test isolation and guest claims.');
