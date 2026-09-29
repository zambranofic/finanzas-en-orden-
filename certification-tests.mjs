import assert from 'node:assert/strict';
import { buildPersonal12, buildBusiness24, personalMonths, businessMonths } from './certification-fixtures.js';
import { personalMonth, personalPosition, businessMonth, businessBreakEvenSummary } from './financial-engine.js';

const p=buildPersonal12();
assert.equal(personalMonths.length,12);
assert.equal(p.income.length,12);
assert.equal(p.assets.length,12);
assert.equal(p.debts.length,12);

for(const month of personalMonths){
  const m=personalMonth(p,month);
  assert(Number.isSafeInteger(m.income));
  assert(Number.isSafeInteger(m.expense));
  assert(Number.isSafeInteger(m.available));
  assert(m.income>0);
}
const pStart=personalPosition(p,'2026-01-31');
const pEnd=personalPosition(p,'2026-12-31');
assert(pEnd.assets>pStart.assets,'assets should rise across deterministic fixture');
assert(pEnd.debts<pStart.debts,'debts should fall across deterministic fixture');
assert(pEnd.netWorth>pStart.netWorth,'net worth should improve across deterministic fixture');

const b=buildBusiness24();
assert.equal(businessMonths.length,24);
assert.equal(b.sales.length,24);
for(const month of businessMonths){
  const m=businessMonth(b,month);
  assert(Number.isSafeInteger(m.sales));
  assert(Number.isSafeInteger(m.operatingResult));
  assert(Number.isSafeInteger(m.cashFlow));
  if(m.sales>0){
    const be=businessBreakEvenSummary(m);
    assert.equal(be.possible,true);
    assert(be.revenueMinor>=0);
    assert(Number.isSafeInteger(be.revenueMinor));
  }
}

const first=businessMonth(b,businessMonths[0]);
const last=businessMonth(b,businessMonths.at(-1));
assert(last.sales>first.sales,'sales should grow across deterministic fixture');
assert(last.contribution>first.contribution,'contribution should grow across deterministic fixture');

console.log('certification-tests: OK');
