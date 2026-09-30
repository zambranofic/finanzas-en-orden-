import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('./app-v4.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const source=app.slice(app.indexOf('let paypalEmbeddedReady=false;'),app.indexOf('function bindAuthActions(){'));
assert(!app.includes('location.assign(o.approve_url)'),'checkout must use the SDK instead of replacing the FINORVE page');
assert(html.includes('id="paypal-buttons"')&&html.includes('id="paypal-card-name"'));
assert(!html.includes('id="startCheckout"'));

function harness({cardEligible=true,captureFails=false,sdkFails=false}={}){
  const elements=new Map(),storage=new Map(),renders=[];let buttonOptions,cardOptions,orders=0,captures=0,signup,recovery,loads=0;
  const node=id=>{if(!elements.has(id)){const classes=new Set(['hidden']);elements.set(id,{value:id==='#checkoutEmail'?'Buyer@example.invalid':'',textContent:'',disabled:false,focus(){this.focused=true},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)}})}return elements.get(id)};
  const card={isEligible:()=>cardEligible,NameField:()=>({render:async s=>renders.push(s)}),NumberField:()=>({render:async s=>renders.push(s)}),ExpiryField:()=>({render:async s=>renders.push(s)}),CVVField:()=>({render:async s=>renders.push(s)}),submit:async()=>{}};
  const paypal={FUNDING:{PAYPAL:'paypal'},Buttons:options=>{buttonOptions=options;return {isEligible:()=>true,render:async s=>renders.push(s)}},CardFields:options=>{cardOptions=options;return card}};
  const window={};
  const context=vm.createContext({window,$:node,document:{createElement:()=>({dataset:{},remove(){}}),head:{appendChild:s=>{loads++;if(sdkFails)s.onerror();else {window.paypal=paypal;s.onload()}}}},cloud:{paypalPublicConfig:async()=>({clientId:'test-client',environment:'sandbox'}),createPublicCheckout:async()=>{orders++;return {order_id:'ORDER-'+orders,checkout_id:'CHECKOUT-'+orders,checkout_secret:'test-checkout-secret'}},capturePublicCheckout:async()=>{captures++;if(captureFails)throw new Error('temporary failure');return {email:'buyer@example.invalid',claim_token:'test-claim'}}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},showPaidSignup:(email,claim)=>{signup={email,claim}},showCheckoutRecovery:message=>{recovery=message}});
  vm.runInContext(source,context);
  return {context,node,storage,renders,get buttons(){return buttonOptions},get card(){return cardOptions},get orders(){return orders},get captures(){return captures},get signup(){return signup},get recovery(){return recovery},get loads(){return loads},call:expr=>vm.runInContext(expr,context)};
}
let h=harness();
await Promise.all([h.call('initEmbeddedPayPal()'),h.call('initEmbeddedPayPal()')]);
assert.equal(h.loads,1);assert.equal(h.renders.filter(x=>x==='#paypal-buttons').length,1);assert.equal(h.renders.length,5);
assert(!h.node('#paypalCardFields').classList.contains('hidden'));
h.node('#checkoutEmail').value='invalid';let rejected=0,resolved=0;
h.buttons.onClick({}, {reject(){rejected++},resolve(){resolved++}});
assert.equal(rejected,1);assert.equal(resolved,0);
await assert.rejects(h.buttons.createOrder(),/INVALID_EMAIL/);assert.equal(h.orders,0);
h.node('#checkoutEmail').value='Buyer@example.invalid';
const order=await h.buttons.createOrder();assert.equal(await h.buttons.createOrder(),order);assert.equal(h.orders,1);
await h.buttons.onApprove({orderID:order});assert.equal(h.captures,1);assert.equal(h.signup.claim,'test-claim');assert.equal(h.storage.size,0);

h=harness({cardEligible:false});await h.call('initEmbeddedPayPal()');
assert.deepEqual(h.renders,['#paypal-buttons']);assert(!h.node('#paypalCardUnavailable').classList.contains('hidden'));
assert(h.node('#paypalCardFields').classList.contains('hidden'));
assert(h.node('#paypalButtonsUnavailable').classList.contains('hidden'),'card ineligibility must not disable the wallet');

h=harness({captureFails:true});await h.call('initEmbeddedPayPal()');
const pendingOrder=await h.buttons.createOrder();
await assert.rejects(h.buttons.onApprove({orderID:pendingOrder}),/temporary failure/);
assert(h.storage.has('feo-checkout-recovery'));h.buttons.onError();assert(h.recovery.includes('No vuelvas a pagar'));
await assert.rejects(h.buttons.createOrder(),/PAYMENT_CONFIRMATION_PENDING/);assert.equal(h.orders,1);

h=harness({sdkFails:true});await h.call('initEmbeddedPayPal()');
assert(!h.node('#retryPaymentMethods').classList.contains('hidden'));
assert(!h.node('#paypalButtonsUnavailable').classList.contains('hidden'));
await h.call('initEmbeddedPayPal()');assert.equal(h.loads,2,'a failed SDK load must be retryable');
console.log('embedded-checkout-tests: OK (SDK simulated; no payments)');
