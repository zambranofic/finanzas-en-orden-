import assert from 'node:assert/strict';
import {
  convertMinor, personalMonth, personalPosition, businessMonth,
  businessBreakEvenSummary, breakEven, simulateBusiness, businessDecisionImpact, FX_SCALE
} from './financial-engine.js';

const eq=(actual,expected,label)=>assert.deepEqual(actual,expected,label);

// FX exacto: USD 10.00 -> EUR 9.20
assert.equal(convertMinor(1000,'USD','EUR',Math.round(.92*FX_SCALE)),920);

// Personal month
eq(personalMonth({
  income:[{date:'2026-09-01',amountMinor:300000}],
  expense:[{date:'2026-09-02',amountMinor:120000}],
  saving:[
    {date:'2026-09-03',amountMinor:40000,direction:'deposit'},
    {date:'2026-09-04',amountMinor:5000,direction:'withdrawal'}
  ],
  debtPayments:[{date:'2026-09-05',amountMinor:25000}]
},'2026-09'),{
  income:300000,
  expense:120000,
  netSavings:35000,
  debtPayments:25000,
  available:120000,
  savingsRateBp:1167
});

// Posición: toma último snapshot por entidad
eq(personalPosition({
  assets:[
    {id:'cash',date:'2026-08-31',valueMinor:500000},
    {id:'cash',date:'2026-09-30',valueMinor:550000},
    {id:'broker',date:'2026-09-15',valueMinor:250000}
  ],
  debts:[
    {id:'card',date:'2026-08-31',balanceMinor:120000},
    {id:'card',date:'2026-09-30',balanceMinor:100000}
  ]
},'2026-09-30'),{assets:800000,debts:100000,netWorth:700000});

// Negocio
const bm=businessMonth({
  sales:[{date:'2026-09-01',amountMinor:1000000}],
  collections:[{date:'2026-09-02',amountMinor:900000}],
  variableCosts:[{date:'2026-09-03',amountMinor:350000}],
  operatingExpenses:[{date:'2026-09-04',amountMinor:250000}],
  cashPayments:[{date:'2026-09-05',amountMinor:575000}],
  debtPrincipalPayments:[{date:'2026-09-06',amountMinor:30000}],
  debtInterestPayments:[{date:'2026-09-06',amountMinor:20000}]
},'2026-09');
eq(bm,{
  sales:1000000,collections:900000,variableCosts:350000,operatingExpenses:250000,
  cashPayments:575000,debtPrincipal:30000,debtInterest:20000,
  operatingResult:380000,cashFlow:275000,contribution:650000,contributionMarginBp:6500
});

const bes=businessBreakEvenSummary(bm);
assert.equal(bes.possible,true);
assert.equal(bes.fixedCostsMinor,270000);
assert.equal(bes.revenueMinor,415385);
assert.equal(bes.currentSalesDeltaMinor,584615);

eq(breakEven({fixedCostsMinor:100000,unitPriceMinor:5000,unitVariableCostMinor:3000}),{
  possible:true,units:50,revenueMinor:250000,contributionPerUnit:2000
});
assert.equal(breakEven({fixedCostsMinor:100000,unitPriceMinor:3000,unitVariableCostMinor:3000}).possible,false);

const before=simulateBusiness(
  {units:100,unitPriceMinor:5000,unitVariableCostMinor:3000,fixedCostsMinor:100000,openingCashMinor:200000},
  {}
);
const after=simulateBusiness(
  {units:100,unitPriceMinor:5000,unitVariableCostMinor:3000,fixedCostsMinor:100000,openingCashMinor:200000},
  {pricePctBp:1000}
);
assert.equal(before.result,100000);
assert.equal(after.result,150000);
eq(businessDecisionImpact(before,after),{
  salesDelta:50000,resultDelta:50000,cashDelta:50000,breakEvenUnitsDelta:-10
});

assert.throws(()=>convertMinor(Number.MAX_SAFE_INTEGER,'USD','EUR',FX_SCALE),/entero seguro/);

console.log('engine-tests: OK');
