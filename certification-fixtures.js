// Dataset determinista de certificación. No son números aleatorios.
const months=(startYear,startMonth,count)=>Array.from({length:count},(_,i)=>{const d=new Date(Date.UTC(startYear,startMonth-1+i,1));return d.toISOString().slice(0,7)});
export const personalMonths=months(2026,1,12);
export const businessMonths=months(2025,1,24);

export function buildPersonal12(){
 const d={income:[],expense:[],saving:[],debtPayments:[],assets:[],debts:[]};
 personalMonths.forEach((m,i)=>{
   const income=300000+(i>=6?25000:0)+(i%3===2?45000:0);
   const expense=205000+(i%4)*7500+(i===7?60000:0);
   const saving=35000+(i>=5?10000:0);
   const debtPay=22000;
   d.income.push({date:`${m}-01`,amountMinor:income});
   d.expense.push({date:`${m}-10`,amountMinor:expense});
   d.saving.push({date:`${m}-15`,amountMinor:saving,direction:'deposit'});
   d.debtPayments.push({date:`${m}-25`,amountMinor:debtPay});
   d.assets.push({id:'cash-investments',date:`${m}-28`,valueMinor:600000+i*50000});
   d.debts.push({id:'consumer-debt',date:`${m}-28`,balanceMinor:420000-i*22000});
 });
 return d;
}

export function buildBusiness24(){
 const d={sales:[],collections:[],variableCosts:[],operatingExpenses:[],cashPayments:[],debtPrincipalPayments:[],debtInterestPayments:[]};
 businessMonths.forEach((m,i)=>{
   const seasonal=(i%12===10||i%12===11)?180000:0;
   const sales=800000+i*25000+seasonal;
   const varCost=Math.round(sales*0.34); // fixture generation only; stored result is integer
   const opex=260000+(i>=12?30000:0)+(i===15?80000:0);
   const collections=Math.round(sales*(i%5===0?0.82:0.94));
   const interest=Math.max(5000,18000-i*500);
   const principal=30000;
   // cashPayments excludes debt service; represents supplier/opex cash actually paid
   const cashPayments=varCost+opex-(i%6===0?25000:0);
   d.sales.push({date:`${m}-03`,amountMinor:sales});
   d.collections.push({date:`${m}-12`,amountMinor:collections});
   d.variableCosts.push({date:`${m}-06`,amountMinor:varCost});
   d.operatingExpenses.push({date:`${m}-08`,amountMinor:opex});
   d.cashPayments.push({date:`${m}-20`,amountMinor:cashPayments});
   d.debtPrincipalPayments.push({date:`${m}-25`,amountMinor:principal});
   d.debtInterestPayments.push({date:`${m}-25`,amountMinor:interest});
 });
 return d;
}
