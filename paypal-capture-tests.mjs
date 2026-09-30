import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('./supabase/functions/paypal-capture-checkout/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const checkout='00000000-0000-4000-8000-000000000001';
const checkoutSecret='test-checkout-private-value';
const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(checkoutSecret))).toString('hex');
const captured=(value='29.00')=>({status:'COMPLETED',purchase_units:[{payments:{captures:[{id:'TEST-CAPTURE',status:'COMPLETED',amount:{currency_code:'USD',value}}]}}]});

function harness(options={}){
  let handler;const calls=[],logs=[],updates=[];
  const intent={id:checkout,email:'test@example.invalid',status:'approved',provider_order_id:'TEST-ORDER',checkout_secret_hash:digest,amount_minor:2900,currency:'USD',...options.intent};
  const db={rpc:async()=>options.rateError?{error:{code:'TEST_RATE_ERROR'}}:{data:{allowed:true}},from(){return {
    select(){return {eq(){return this},maybeSingle:async()=>({data:intent})}},
    update(patch){updates.push(patch);return {eq(){return this},then(resolve){if(!options.finalizeError)Object.assign(intent,patch);return Promise.resolve({error:options.finalizeError?{code:'TEST_WRITE_ERROR'}:null}).then(resolve)}}}
  }}};
  const fetch=async(url,init={})=>{
    calls.push({url,init});
    if(url.endsWith('/oauth2/token')){
      if(options.oauthNetwork)throw new Error('network detail test-client-secret');
      if(options.oauthInvalid)return new Response('{}',{status:200});
      return Response.json(options.oauthStatus?{error:'invalid_client'}:{access_token:'test-access-token'},{status:options.oauthStatus||200});
    }
    if(url.endsWith('/capture')){
      if(options.captureNetwork){options.order=captured();throw new Error('uncertain payment result test-access-token')}
      return Response.json(captured(options.captureAmount));
    }
    if(options.lookupNetwork)throw new Error('lookup error test-access-token');
    return Response.json(options.order||{status:'APPROVED'});
  };
  const context=vm.createContext({Deno:{env:{get:n=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-service-key',PAYPAL_CLIENT_ID:'test-client-id',PAYPAL_CLIENT_SECRET:'test-client-secret'}[n])},serve:fn=>{handler=fn}},createClient:()=>db,crypto:webcrypto,TextEncoder,Uint8Array,Response,console:{error:(...args)=>logs.push(args)},fetch,btoa,Date});
  vm.runInContext(source,context);
  return {calls,logs,updates,intent,async call(){const response=await handler(new Request('https://example.invalid/capture',{method:'POST',headers:{origin:'https://finorve.com','content-type':'application/json'},body:JSON.stringify({checkout_id:checkout,checkout_secret:checkoutSecret,order_id:'TEST-ORDER'})}));return {status:response.status,body:await response.json()}}};
}

let h=harness({rateError:true}),r=await h.call();
assert.equal(r.status,503);assert.equal(r.body.error,'RATE_LIMIT_UNAVAILABLE');assert.equal(h.calls.length,0);
for(const status of [401,503]){
  h=harness({oauthStatus:status});r=await h.call();
  assert.equal(r.status,503);assert.equal(r.body.error,'PAYPAL_AUTH_FAILED');assert.equal(h.calls.length,1);assert.equal(h.updates.length,0);
  assert.ok(JSON.stringify(h.logs).includes('oauth_http'));assert.ok(JSON.stringify(h.logs).includes(String(status)));
}
h=harness({oauthNetwork:true});r=await h.call();assert.equal(r.status,503);assert.equal(r.body.error,'PAYPAL_UNAVAILABLE');assert.equal(h.calls.length,1);
assert.ok(!JSON.stringify([r.body,h.logs]).includes('test-client-secret'));
h=harness({oauthInvalid:true});r=await h.call();assert.equal(r.status,503);assert.equal(r.body.error,'PAYPAL_AUTH_RESPONSE_INVALID');assert.equal(h.calls.length,1);
h=harness({lookupNetwork:true});r=await h.call();assert.equal(r.status,502);assert.equal(r.body.error,'PAYPAL_ORDER_LOOKUP_UNAVAILABLE');assert.equal(h.updates.length,0);
assert.ok(!JSON.stringify([r.body,h.logs]).includes('test-access-token'));
h=harness({intent:{status:'completed',provider_capture_id:'TEST-CAPTURE'}});r=await h.call();assert.equal(r.status,200);assert.equal(r.body.recovered,true);assert.equal(h.calls.length,0);
h=harness({order:captured()});r=await h.call();assert.equal(r.status,200);assert.equal(h.calls.filter(c=>c.url.endsWith('/capture')).length,0);
h=harness({captureAmount:'28.00'});r=await h.call();assert.equal(r.status,409);assert.equal(r.body.error,'CAPTURE_VERIFICATION_FAILED');assert.equal(h.updates.length,0);
h=harness({finalizeError:true});r=await h.call();assert.equal(r.status,500);assert.equal(r.body.error,'CHECKOUT_FINALIZE_FAILED');

// Provider completes the capture but the response is lost. A second request
// looks up the same order and reconciles it, without sending another capture.
const options={captureNetwork:true};h=harness(options);r=await h.call();
assert.equal(r.status,502);assert.equal(r.body.error,'PAYPAL_CAPTURE_UNCERTAIN');assert.equal(h.updates.length,0);
assert.ok(!JSON.stringify([r.body,h.logs]).includes('test-access-token'));
const captureCall=h.calls.find(c=>c.url.endsWith('/capture'));
assert.equal(captureCall.init.headers['PayPal-Request-Id'],'public-capture-'+checkout);
r=await h.call();assert.equal(r.status,200);assert.equal(h.intent.status,'completed');
assert.equal(h.calls.filter(c=>c.url.endsWith('/capture')).length,1);
r=await h.call();assert.equal(r.status,200);assert.equal(r.body.recovered,true);
assert.equal(h.calls.filter(c=>c.url.endsWith('/capture')).length,1);

console.log('paypal-capture-tests: OK (mocked provider/database; no real payments)');
