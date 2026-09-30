import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {ensureSyncId,samePendingSnapshot} from './sync-utils.js';
const source=fs.readFileSync(new URL('./app-v4.js',import.meta.url),'utf8');
const storage=new Map(),calls=[],timers=[];
let user={id:'account-a'};
const ctx=vm.createContext({
 ensureSyncId,samePendingSnapshot,crypto:{randomUUID:()=>String(Math.random())},
 cloud:{session:()=>({user}),syncRecords:async(...args)=>calls.push(args)},
 localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},
 records:{personal:{},business:{}},profileData:{},navigator:{onLine:true},
 document:{querySelectorAll:()=>[],addEventListener:()=>{}},window:{addEventListener:()=>{}},
 $:()=>null,showCloudError:()=>{},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout:()=>{}
});
vm.runInContext(source.slice(source.indexOf("const SYNC_BACKUP="),source.indexOf("const saveRecords=")),ctx);
vm.runInContext("syncOwner='account-a'; globalThis.a=persistPending(syncSnapshot());",ctx);
assert(storage.has('finorve-pending-sync:account-a'));
storage.set('finorve-pending-sync',JSON.stringify({records:{legacy:true}}));
user={id:'account-b'};
assert.equal(vm.runInContext('readPending()',ctx),null);
assert.equal(await vm.runInContext('flushRecords(a)',ctx),false);
assert.equal(calls.length,0);
vm.runInContext("syncOwner='account-b'; globalThis.b=persistPending(syncSnapshot());",ctx);
assert(storage.has('finorve-pending-sync:account-b'));
assert.equal(vm.runInContext('readPending().userId',ctx),'account-b');
await vm.runInContext('flushRecords(b)',ctx);
assert.equal(calls[0][2],'account-b');
assert(storage.has('finorve-pending-sync:account-a'),'A pending data retained');
assert(!storage.has('finorve-pending-sync:account-b'),'B successful data cleared');
user={id:'account-a'};
vm.runInContext("syncOwner='account-a';queueSync(a,0)",ctx);
user={id:'account-b'};
timers.at(-1)();
await vm.runInContext('syncPromise',ctx);
assert.equal(calls.length,1,'queued A write blocked after account switch');
user={id:'account-a'};
assert.equal(vm.runInContext('readPending().userId',ctx),'account-a');
await vm.runInContext('flushRecords(a)',ctx);
assert.equal(calls[1][2],'account-a');
assert(storage.has('finorve-pending-sync'),'unowned legacy data retained, never replayed');
console.log('account-sync-tests: account switch, deferred writes, replay and retention PASS');
