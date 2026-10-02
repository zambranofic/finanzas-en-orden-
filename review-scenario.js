// Populated UI review fixture: one completed year and the current day. Demo only.
import {buildAnnualScenario} from './annual-scenario.js';
import {DAILY_FIELDS,upsertDaily,businessSummary} from './business-daily.js';
import {personalMonth} from './financial-engine.js';
import {engineData} from './annual-scenario.js';
export function buildReviewScenario(asOf=new Date().toISOString().slice(0,10)){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||new Date(asOf+'T12:00:00Z').toISOString().slice(0,10)!==asOf)throw Error('Fecha de demostración inválida');
 const base=buildAnnualScenario(),s=structuredClone(base),[year,month]=asOf.split('-').map(Number);
 s.months=Array.from({length:12},(_,i)=>new Date(Date.UTC(year,month-13+i,1)).toISOString().slice(0,7));
 const map=new Map(base.months.map((m,i)=>[m,s.months[i]]));
 for(const bucket of Object.values(s.records))for(const rows of Object.values(bucket))for(const x of rows)x.date=map.get(x.date.slice(0,7))+x.date.slice(7);
 const p=s.records.personal;
 const fixed=new Set(['Alquiler','Servicios','Educación','Seguro']);
 for(const x of p.expense)x.expenseClass=fixed.has(x.name)?'fixed':'variable';
 const oldSaving=p.saving;p.saving=[];
 const add=(type,name,amountMinor,date,extra={})=>p[type].push({name,amountMinor,date,currency:'USD',demo:true,entityType:type,...extra});
 const allocations=[['survival','Supervivencia',20000],['emergency','Emergencia',8000],['future','Capital futuro',3000],['vacation','Vacaciones',2000],['training','Formación',2000]];
 for(const x of oldSaving)if(x.direction==='withdrawal')p.saving.push({...x,fundId:'emergency'});else for(const [fundId,name,amountMinor] of allocations)p.saving.push({...x,name:'Aporte · '+name,amountMinor,fundId});
 for(const m of s.months)for(const day of [3,10,17,24])add('expense','Café y snack',650,m+'-'+String(day).padStart(2,'0'),{expenseClass:'ant'});
 // Reconcile the asset snapshot with the additional small expenses.
 p.asset[0].amountMinor-=12*4*650;
 p.goal=[];
 for(const [fundId,name,target] of [['survival','Supervivencia',360000],['emergency','Emergencia',150000],['future','Capital futuro',200000],['vacation','Vacaciones',100000],['training','Formación',60000]])add('goal',name,target,s.months[0]+'-01',{fundId,entityId:'demo-goal-'+fundId,...(fundId==='survival'?{essentialMonthlyMinor:120000,targetMonths:3}:{})});
 let business=Object.fromEntries(Object.keys(s.records.business).map(k=>[k,[]]));
 business.collection.push({name:'Configuración · Librería Horizonte',amountMinor:0,date:s.months[0]+'-01',currency:'USD',entityType:'collection',demo:true,cashRole:'openingConfig',openingCashMinor:400000,openingDebtMinor:1200000,debtStartDate:s.months[0]+'-01',startDate:s.months[0]+'-01',activity:'Librería Horizonte · demostración',fixedMonthlyMinor:280000,contributionMarginBp:5800});
 const split=(total,i,n)=>Math.floor(total/n)+(i<total%n?1:0);
 let previousReceivable=0;
 base.expectations.forEach((e,j)=>{
  const cashSales=e.collected-previousReceivable,creditSales=e.sales-cashSales;
  for(let i=0;i<24;i++){
   const input=Object.fromEntries(DAILY_FIELDS.map(k=>[k,0]));
   input.olderCollections=i===0?previousReceivable:0;
   input.collected=split(cashSales,i,24)+input.olderCollections;
   input.unpaidSales=split(creditSales,i,24);input.purchases=split(e.supplierPaid,i,24);
   input.expenses=split(e.opex,i,24);input.soldCost=split(e.cost,i,24);
   business=upsertDaily(business,s.months[j]+'-'+String(i+1).padStart(2,'0'),'USD',input);
  }
  const input=Object.fromEntries(DAILY_FIELDS.map(k=>[k,0]));input.principal=e.principal;input.interest=e.interest;
  business=upsertDaily(business,s.months[j]+'-25','USD',input);previousReceivable=e.receivable;
 });
 // Current-month example, dated today: no future operations or premature full-month totals.
 add('income','Marta · Salario',260000,asOf);
 for(const [name,amountMinor,expenseClass] of [['Alquiler',65000,'fixed'],['Compra de alimentos',12000,'variable'],['Café',450,'ant']])add('expense',name,amountMinor,asOf,{expenseClass});
 for(const [fundId,name,amountMinor] of allocations)add('saving','Aporte · '+name,amountMinor,asOf,{fundId,direction:'deposit'});
 add('debtPayment','Cuota préstamo personal',30000,asOf);
 p.debt[0].amountMinor-=25000;p.debt[0].date=asOf;
 p.asset[0].amountMinor+=260000-77450-30000;p.asset[0].date=asOf;
 const today=Object.fromEntries(DAILY_FIELDS.map(k=>[k,0]));Object.assign(today,{collected:52000,olderCollections:12000,unpaidSales:5000,purchases:14000,expenses:8500,soldCost:18900,principal:3000,interest:450});
 business=upsertDaily(business,asOf,'USD',today);
 for(const rows of Object.values(business))for(const x of rows)x.demo=true;
 s.records.business=business;s.asOf=asOf;s.currentMonth=asOf.slice(0,7);
 s.profile.name='Marta Ríos · DEMOSTRACIÓN';s.profile.theme='light';
 s.person='Marta Ríos, personaje ficticio: un año de ingresos, gastos fijos, variables y hormiga, pagos de deuda y cinco fondos de ahorro.';
 s.business='Librería Horizonte, negocio ficticio: un año de resúmenes diarios, cobros, ventas pendientes, costos, gastos, caja y pagos de deuda.';
 s.reviewExpectations=[...s.months,s.currentMonth].map(m=>({month:m,personal:personalMonth(engineData(s.records).personal,m),business:businessSummary(business,m,'USD',m===s.currentMonth?asOf:m+'-31')}));
 return s;
}
