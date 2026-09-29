import assert from 'node:assert/strict';
import { commitProfile } from './profile-utils.js';

const current={name:'Ana',country:'Ecuador',theme:'system'};
const saved=[];
const next=await commitProfile(current,{name:'Ana María'},async profile=>{saved.push(profile)});
assert.equal(current.name,'Ana','current profile must not mutate before save');
assert.equal(next.name,'Ana María');
assert.deepEqual(saved,[{name:'Ana María',country:'Ecuador',theme:'system'}]);

let failed=false;
try{
  await commitProfile(current,{country:'España'},async()=>{throw new Error('offline')});
}catch(e){failed=true;assert.equal(e.message,'offline')}
assert.equal(failed,true);
assert.deepEqual(current,{name:'Ana',country:'Ecuador',theme:'system'},'failed save must preserve confirmed profile');

console.log('profile-tests: OK');
