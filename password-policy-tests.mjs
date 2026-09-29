import assert from 'node:assert/strict';
import { validatePassword,passwordIssues } from './password-policy.js';

assert.equal(validatePassword('Abcdefgh123!'),true);
assert.equal(validatePassword('short1A!'),false);
assert.deepEqual(passwordIssues('abcdefghijkl'),['uppercase','number','symbol']);
assert.deepEqual(passwordIssues('ABCDEFGHIJKL'),['lowercase','number','symbol']);
assert.deepEqual(passwordIssues('Abcdefghijkl'),['number','symbol']);
assert.deepEqual(passwordIssues('Abcdefgh1234'),['symbol']);

console.log('password-policy-tests: OK');
