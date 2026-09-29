import assert from 'node:assert/strict';
import { normalizeNavigationState,navigationChanged } from './navigation-utils.js';

assert.deepEqual(normalizeNavigationState({section:'plan',mode:'business'}),{section:'plan',mode:'business'});
assert.deepEqual(normalizeNavigationState({section:'hack',mode:'other'}),{section:'home',mode:'personal'});
assert.equal(navigationChanged({section:'home',mode:'personal'},{section:'plan',mode:'personal'}),true);
assert.equal(navigationChanged({section:'home',mode:'personal'},{section:'home',mode:'personal'}),false);

console.log('navigation-tests: OK');
