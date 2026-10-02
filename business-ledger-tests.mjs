import assert from 'node:assert/strict';
import {businessLedger} from './business-ledger.js';
import {buildReviewScenario} from './review-scenario.js';
import {businessSummary,upsertDaily,DAILY_FIELDS} from './business-daily.js';
const demo=buildReviewScenario('2026-10-01').records.business;
for(const section of ['sales','costs','expenses','cashflow']){
 const l=businessLedger(demo,section,'2026-09','USD','2026-10-01'),s=businessSummary(demo,'2026-09','USD','2026-09-30');
 assert.equal(l.until,'2026-09-30');assert.equal(l.overflow,false);assert.equal(l.points.at(-1).value,section==='cashflow'?s.cash:s[{sales:'sales',costs:'cost',expenses:'expenses'}[section]]);assert.equal(l.history.reduce((n,d)=>n+d.rows.length,0),l.rows.length);
 if(section!=='cashflow')assert.equal(l.total,s[{sales:'sales',costs:'cost',expenses:'expenses'}[section]]);else assert.equal(l.net,l.incoming-l.outgoing);
}
const cfg={cashRole:'openingConfig',currency:'USD',date:'2026-01-01',startDate:'2026-01-01',openingCashMinor:10000,amountMinor:0};
let b={collection:[cfg,{date:'2026-01-20',currency:'USD',amountMinor:2000},{date:'2026-02-02',currency:'USD',amountMinor:1000},{date:'2026-02-10',currency:'USD',amountMinor:9999},{date:'2026-02-02',currency:'EUR',amountMinor:9999},{date:'2026-02-03',currency:'USD',amountMinor:0,dailyField:'anchor',costKnown:false}],cashPayment:[{date:'2026-02-02',currency:'USD',amountMinor:4000}],debtPrincipal:[{date:'2026-02-02',currency:'USD',amountMinor:500}],debtInterest:[{date:'2026-02-02',currency:'USD',amountMinor:100}]};
let l=businessLedger(b,'cashflow','2026-02','USD','2026-02-05');assert.equal(l.opening,12000);assert.equal(l.balance,8400);assert.equal(l.incoming,1000);assert.equal(l.outgoing,4600);assert.equal(l.net,-3600);assert.equal(l.rows.length,4);assert.equal(l.points[1].value,8400);
l=businessLedger({...b,collection:b.collection.filter(x=>x!==cfg)},'cashflow','2026-02','USD','2026-02-05');assert.equal(l.balance,null);assert.equal(l.points[0].value,0);assert.equal(l.points.at(-1).value,-3600,'unconfigured cash is monthly net flow, not an invented cash balance');
l=businessLedger(b,'costs','2026-02','USD','2026-02-05');assert.equal(l.missingCostDays,1);assert.equal(l.ratio,null);
const input={...Object.fromEntries(DAILY_FIELDS.map(k=>[k,0])),collected:10000,olderCollections:4000,unpaidSales:3000,purchases:2000,expenses:1000,soldCost:4500,principal:300,interest:100,loanReceived:2000,ownerContribution:1000,ownerWithdrawal:500};
b=upsertDaily({collection:[cfg]},'2026-02-02','USD',input);
assert.equal(businessLedger(b,'sales','2026-02','USD','2026-02-05').total,9000);assert.equal(businessLedger(b,'costs','2026-02','USD','2026-02-05').total,4500);assert.equal(businessLedger(b,'costs','2026-02','USD','2026-02-05').ratio,50);assert.equal(businessLedger(b,'expenses','2026-02','USD','2026-02-05').total,1000);l=businessLedger(b,'cashflow','2026-02','USD','2026-02-05');assert.equal(l.incoming,13000);assert.equal(l.outgoing,3900);assert.equal(l.balance,19100);
b=upsertDaily(b,'2026-02-02','USD',{...input,soldCost:6000});assert.equal(businessLedger(b,'costs','2026-02','USD','2026-02-05').total,6000,'edits replace the existing daily group');
const huge={sale:[{date:'2026-02-02',currency:'USD',amountMinor:Number.MAX_SAFE_INTEGER},{date:'2026-02-03',currency:'USD',amountMinor:1}]};l=businessLedger(huge,'sales','2026-02','USD','2026-02-05');assert.equal(l.overflow,true);assert.equal(l.total,null);assert.deepEqual(l.points,[]);
assert.equal(businessLedger({},'sales','2026-02','USD','2026-02-05').hasMovements,false);
console.log('business ledgers: monthly reconciliation, funding vs sales, purchases vs sold costs, interest/principal/withdrawals, unknown cash and cost, currencies, cutoff, replacement and overflow PASS');
