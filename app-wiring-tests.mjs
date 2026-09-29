import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('./app-v4.js',import.meta.url),'utf8');
assert(app.includes("from './navigation-utils.js'"),'navigation helpers must be imported');
assert(app.includes("function bindNav(){$$('[data-section]').forEach"),'navigation must bind all section buttons');
assert(!app.includes("function bindNav(){$('[data-section]').forEach"),'querySelector must not be used as a collection');
console.log('app-wiring-tests: OK');
