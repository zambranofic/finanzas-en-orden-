import assert from 'node:assert/strict';
import {buildAnnualScenario,engineData} from './annual-scenario.js';
import {personalMonth,businessMonth,businessBreakEvenSummary,personalPosition} from './financial-engine.js';
const s=buildAnnualScenario(),d=engineData(s.records);assert.equal(s.months.length,12);
for(const e of s.expectations){const p=personalMonth(d.personal,e.month),b=businessMonth(d.business,e.month),be=businessBreakEvenSummary(b);for(const k of ['income','expense','netSavings','debtPayments','available'])assert.equal(p[k],e[k],e.month+' personal '+k);assert.equal(b.sales,e.sales);assert.equal(b.operatingResult,e.result);assert.equal(b.cashFlow,e.flow);assert.equal(be.revenueMinor,e.breakEven);assert.equal(b.collections+e.receivable,e.sales+(s.expectations[s.expectations.indexOf(e)-1]?.receivable||0));}
const last=s.expectations.at(-1);assert.equal(personalPosition(d.personal,s.months.at(-1)+'-30').netWorth,last.assets-last.debts);
for(const mode of ['personal','business'])for(const rows of Object.values(s.records[mode]))for(const r of rows){assert(r.demo);assert(Number.isSafeInteger(r.amountMinor));assert(r.amountMinor>0);}
const totals=s.expectations.reduce((a,e)=>{for(const k of ['income','expense','available','sales','result','flow'])a[k]=(a[k]||0)+e[k];return a},{});console.log(JSON.stringify({months:12,records:Object.values(s.records).flatMap(x=>Object.values(x)).flat().length,totals,closingCash:last.closingCash,checks:'12 months personal/business, credit collections, cash flow, break-even and final net worth PASS'},null,2));
