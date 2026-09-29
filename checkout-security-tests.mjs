import assert from 'node:assert/strict';
import { checkoutCancelPayload } from './checkout-security-utils.js';

assert.deepEqual(
  checkoutCancelPayload('cid-1','cancel-only-token','sensitive-checkout-secret'),
  {checkout_id:'cid-1',cancel_token:'cancel-only-token'},
  'new cancellation must never include checkout_secret'
);
assert.deepEqual(
  checkoutCancelPayload('cid-old','', 'legacy-secret'),
  {checkout_id:'cid-old',checkout_secret:'legacy-secret'},
  'legacy checkouts remain cancellable during migration'
);
assert.throws(()=>checkoutCancelPayload('cid-1','',''),/MISSING_CANCEL_TOKEN/);

console.log('checkout-security-tests: OK');
