import assert from 'node:assert/strict';
import { shouldRefreshSession, createSingleFlight } from './auth-session-utils.js';

assert.equal(shouldRefreshSession({refresh_token:'r',expires_at:1000},980,30),true);
assert.equal(shouldRefreshSession({refresh_token:'r',expires_at:1100},980,30),false);
assert.equal(shouldRefreshSession({expires_at:1000},980,30),false);

let calls=0;
const gate=createSingleFlight(async()=>{
  calls++;
  await new Promise(r=>setTimeout(r,10));
  return 'fresh-token';
});
const [a,b,c]=await Promise.all([gate(),gate(),gate()]);
assert.equal(a,'fresh-token');
assert.equal(b,'fresh-token');
assert.equal(c,'fresh-token');
assert.equal(calls,1,'concurrent refreshes must collapse into one request');

await gate();
assert.equal(calls,2,'after completion a later refresh may run again');

console.log('auth-session-tests: OK');
