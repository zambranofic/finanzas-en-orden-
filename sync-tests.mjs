import assert from 'node:assert/strict';
import { ensureSyncId, samePendingSnapshot } from './sync-utils.js';

const a=ensureSyncId({records:{a:1},profile:{}},()=> 'sync-a');
const retry=ensureSyncId(a,()=> 'sync-b');
assert.equal(a.syncId,'sync-a');
assert.equal(retry.syncId,'sync-a','retry must preserve the same sync id');

const newer=ensureSyncId({records:{a:2},profile:{}},()=> 'sync-b');
assert.equal(samePendingSnapshot(a,a),true);
assert.equal(samePendingSnapshot(newer,a),false,'older success must not clear a newer pending snapshot');
assert.equal(samePendingSnapshot(null,a),false);
assert.equal(samePendingSnapshot({records:{}},{records:{}}),false,'legacy snapshots without ids must never match accidentally');

console.log('sync-tests: OK');
