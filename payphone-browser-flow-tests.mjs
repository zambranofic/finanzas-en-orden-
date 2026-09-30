import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('./payphone-prueba.js',import.meta.url),'utf8');
const cid='de6e483d-e4cf-4389-8ab2-7615f03c9ae4';
class Node extends EventTarget { constructor(){super();this.hidden=false;this.disabled=false;this.dataset={};this.textContent='';} insertAdjacentElement(_,node){nodes.set(node.id,node);} }
const nodes=new Map(['status','test-form','start','test-mode','pp-button'].map(id=>[id,new Node()]));
nodes.get('test-mode').checked=true;
const storage={getItem(k){return this[k]||null},setItem(k,v){this[k]=v}};
const win=new EventTarget();
let registeredCallback;
// Reproduce official SDK v2 behavior: own Pagar dispatches a native event;
// setting onCompletedPayment alone does not subscribe to that event.
win.PPaymentButtonBox=class { onCompletedPayment(fn){registeredCallback=fn} render(){return this} };
const calls=[]; const timers=new Map();let timer=0;
vm.runInNewContext(source,{window:win,document:{getElementById:id=>nodes.get(id)||null,createElement:()=>new Node(),head:{append(){}}},sessionStorage:storage,
  location:{search:'',pathname:'/payphone-prueba.html'},history:{replaceState(){}},URLSearchParams,AbortSignal,
  setTimeout(fn){timers.set(++timer,fn);return timer},clearTimeout(id){timers.delete(id)},
  fetch:async(_,opts)=>{const body=JSON.parse(opts.body);calls.push(body);
    if(body.action==='create')return Response.json({checkout_id:cid,checkout_secret:'test-one-use-secret',mode:'test',expires_at:new Date(Date.now()+600000).toISOString(),box:{token:'fake-test-token'}});
    if(body.action==='confirm')return Response.json({mode:'test',access_activated:false,status:'approved'});
    throw new Error('Unexpected request '+body.action);
  },Response});
nodes.get('test-form').dispatchEvent(new Event('submit',{cancelable:true}));
await new Promise(setImmediate);
assert.equal(typeof registeredCallback,'function'); assert.equal(calls.length,1);
const evt=new Event('processPaymentAsync');evt.detail={transactionId:91846448,clientTransactionId:cid};
win.dispatchEvent(evt);win.dispatchEvent(evt);
await new Promise(setImmediate);
assert.equal(calls.filter(x=>x.action==='confirm').length,1);
assert.equal(calls[1].transaction_id,'91846448');assert.equal(calls[1].checkout_secret,'test-one-use-secret');
assert(nodes.get('status').textContent.includes('aprobada y confirmada'));
assert.equal(nodes.get('pp-button').hidden,true);
assert(!JSON.stringify(storage).includes('fake-test-token'));
console.log('PASS: provider-owned Pagar native event confirms once without relying on the SDK callback and removes the stale spinner.');
