import assert from 'node:assert/strict';
import fs from 'node:fs';
import {businessPeriods,businessPeriodEnd,businessSalesSeries} from './business-chart.js';
import {buildReviewScenario} from './review-scenario.js';
import {businessSummary} from './business-daily.js';
const s=buildReviewScenario('2026-10-01'),b=s.records.business;
assert.equal(businessPeriods(b,'USD',s.asOf).length,13);
assert.equal(businessPeriodEnd('2026-09',s.asOf),'2026-09-30');assert.equal(businessPeriodEnd('2026-10',s.asOf),s.asOf);assert.equal(businessPeriodEnd('2024-02','2026-10-01'),'2024-02-29');
const september=businessSalesSeries(b,'2026-09','USD',s.asOf),october=businessSalesSeries(b,'2026-10','USD',s.asOf);
assert.equal(september.length,24);assert.equal(september.at(-1).value,1175000);assert.equal(october.length,1);assert.equal(october[0].value,45000);assert.equal(businessSalesSeries(b,'2026-09','EUR',s.asOf).length,0);
const historic=businessSummary(b,'2026-09','USD',businessPeriodEnd('2026-09',s.asOf));assert.equal(historic.cash,2403350);assert.equal(historic.result,397000);assert.equal(historic.target,482759);
for(const file of ['app-v4.js','annual-demo-app.js']){
 const source=fs.readFileSync(file,'utf8'),start=source.indexOf('function businessSalesChart('),end=source.indexOf('\nfunction businessDashboard()',start),code=source.slice(start,end)+';return businessSalesChart(target);';
 const render=(points,target=482759)=>new Function('businessSalesSeries','records','businessPeriod','currency','localDateKey','moneyMinor','esc','businessPeriodLabel','target',code)(()=>points,{business:b},()=> '2026-10',()=> 'USD',()=>s.asOf,n=>String(n),String,()=> 'octubre de 2026',target);
 assert(render([]).includes('La gráfica aparecerá'));
 assert(render(october).includes('9 % del umbral'));assert(render(october).includes('1 día de ventas registrado'));assert(!render(october).includes('<path'));assert(render(october).includes('<circle'));
 assert(render(september).includes('fundHeroLine'));assert(render(september).includes('243 % del umbral'));assert(!render(september).includes('<progress'));assert(!render(september,null).includes('equilibriumBadge'));
}
console.log('PASS: all 13 periods, historical cash cutoff, 24-day sales curve, visible single-day progress, no data and currency isolation.');
