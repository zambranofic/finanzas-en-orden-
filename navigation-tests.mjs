import assert from 'node:assert/strict';
import { normalizeNavigationState,navigationChanged } from './navigation-utils.js';

assert.deepEqual(normalizeNavigationState({section:'plan',mode:'business'}),{section:'plan',mode:'business'});
assert.deepEqual(normalizeNavigationState({section:'hack',mode:'other'}),{section:'home',mode:'personal'});
assert.equal(navigationChanged({section:'home',mode:'personal'},{section:'plan',mode:'personal'}),true);
assert.equal(navigationChanged({section:'home',mode:'personal'},{section:'home',mode:'personal'}),false);

console.log('navigation-tests: OK');

// Every rendered navigation destination must be accepted, including nested modules.
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('./app-v4.js',import.meta.url),'utf8');
const titlesLine=app.split('\n').find(x=>x.startsWith('const titles='));
const destinations=vm.runInNewContext(titlesLine+'; Object.keys(titles)');
for(const mode of ['personal','business'])for(const section of ['home',...destinations]){
 const current={section:'movements',mode};
 assert.equal(normalizeNavigationState({section,mode},current).section,section,section+' must open');
 assert.equal(navigationChanged(current,{section,mode}),section!=='movements',section+' must navigate');
}
assert.deepEqual(normalizeNavigationState({section:'unknown',mode:'business'},{section:'income',mode:'personal'}),{section:'income',mode:'business'});
