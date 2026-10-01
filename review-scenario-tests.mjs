import assert from 'node:assert/strict';
import {buildReviewScenario} from './review-scenario.js';
import {readDaily,dailyList,businessSummary} from './business-daily.js';
import {expenseBreakdown,fundBalance,fundHistory} from './personal-foundation.js';
const s=buildReviewScenario('2026-10-01'),p=s.records.personal,b=s.records.business;
assert.equal(s.months.length,12);assert.equal(s.months[0],'2025-10');assert.equal(s.months.at(-1),'2026-09');
assert.equal(dailyList(b,'USD').length,301);
for(const bucket of Object.values(s.records))for(const rows of Object.values(bucket))for(const row of rows){assert.equal(row.demo,true);assert(row.date<=s.asOf);assert(Number.isSafeInteger(row.amountMinor)&&row.amountMinor>=0);}
for(const month of [...s.months,s.currentMonth]){const ex=expenseBreakdown(p.expense,month,'USD');assert(ex.fixed>0&&ex.variable>0&&ex.ant>0);assert.equal(ex.unclassified,0);const biz=businessSummary(b,month,'USD',s.asOf);assert(biz.sales>0);assert.notEqual(biz.result,null);assert.equal(biz.target,482759);assert.equal(biz.result,biz.sales-biz.cost-biz.expenses-biz.interest);}
for(const id of ['survival','emergency','future','vacation','training'])assert(fundHistory(p.saving,id,'USD',s.asOf).every(x=>x.balance>=0));
assert.equal(fundBalance(p.saving,'survival','USD',s.asOf),260000);
assert.equal(fundBalance(p.saving,'emergency','USD',s.asOf),84000);
const current=s.reviewExpectations.at(-1);assert.equal(current.personal.available,117550);assert.equal(current.business.sales,45000);assert.equal(current.business.result,17150);assert.equal(readDaily(b,s.asOf,'USD').olderCollections,12000);
assert.equal(s.reviewExpectations.at(-2).business.cash,2403350);
assert.equal(current.business.cash,2429400);
assert.equal(s.records.personal.asset[0].amountMinor-s.records.personal.debt[0].amountMinor,1516950);
const shifted=buildReviewScenario('2027-02-03');assert.equal(shifted.months[0],'2026-02');assert.equal(shifted.months.at(-1),'2027-01');assert.equal(shifted.reviewExpectations.at(-1).business.registeredDays,1);
console.log('PASS: 12 completed months + current day; 301 daily summaries; all expense classes, five funds, current balances and business result validated.');
