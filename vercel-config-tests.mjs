import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg=JSON.parse(fs.readFileSync(new URL('./vercel.json',import.meta.url),'utf8'));
assert.equal(cfg?.git?.deploymentEnabled?.staging,false,'staging must not auto-deploy to Vercel');
console.log('vercel-config-tests: OK');
