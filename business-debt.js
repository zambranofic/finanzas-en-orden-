import {businessConfig} from './business-daily.js';

// Aggregate business debt: an explicit opening balance, plus new loans,
// minus principal repaid. Interest is cash paid, never principal repaid.
export function businessDebtSummary(bucket,currency,until){
 const config=businessConfig(bucket,currency),start=config?.debtStartDate;
 const configured=Number.isSafeInteger(config?.openingDebtMinor)&&config.openingDebtMinor>=0&&/^\d{4}-\d{2}-\d{2}$/.test(start||'');
 const inRange=x=>(x.currency||'USD')===currency&&x.date&&x.date<=until&&(!configured||x.date>=start);
 const history=[...(bucket.debtPrincipal||[]).filter(inRange).map(x=>({...x,kind:'principal'})),...(bucket.debtInterest||[]).filter(inRange).map(x=>({...x,kind:'interest'})),...(bucket.collection||[]).filter(x=>inRange(x)&&x.dailyField==='loanReceived').map(x=>({...x,kind:'loan'}))].sort((a,b)=>b.date.localeCompare(a.date));
 const sum=kind=>history.filter(x=>x.kind===kind).reduce((n,x)=>n+BigInt(Number.isSafeInteger(x.amountMinor)?x.amountMinor:0),0n);
 const paid=sum('principal'),interest=sum('interest'),loans=sum('loan'),total=BigInt(configured?config.openingDebtMinor:0)+loans;
 const overflow=[paid,interest,loans,total].some(n=>n>BigInt(Number.MAX_SAFE_INTEGER));
 const beforeStart=configured&&until<start;
 const inconsistent=configured&&paid>total;
 const known=configured&&!beforeStart&&!overflow&&!inconsistent;
 return {configured,start,until,beforeStart,overflow,inconsistent,history,opening:configured?config.openingDebtMinor:null,paid:overflow?null:Number(paid),interest:overflow?null:Number(interest),loans:overflow?null:Number(loans),total:known?Number(total):null,remaining:known?Number(total-paid):null,progress:known&&total>0n?Number(paid*10000n/total)/100:known?0:null};
}

export function groupBusinessDebtHistory(history){
 const months=new Map(),safe=n=>n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null;
 for(const row of history){
  const month=row.date.slice(0,7);if(!months.has(month))months.set(month,new Map());
  const dates=months.get(month);if(!dates.has(row.date))dates.set(row.date,{date:row.date,rows:[]});dates.get(row.date).rows.push(row);
 }
 const total=(rows,kind)=>rows.filter(x=>kind.includes(x.kind)).reduce((n,x)=>n+BigInt(Number.isSafeInteger(x.amountMinor)?x.amountMinor:0),0n);
 return [...months].sort(([a],[b])=>b.localeCompare(a)).map(([month,dates])=>{const rows=[...dates.values()].flatMap(x=>x.rows);return {month,paid:safe(total(rows,['principal','interest'])),loans:safe(total(rows,['loan'])),days:[...dates.values()].sort((a,b)=>b.date.localeCompare(a.date)).map(day=>({date:day.date,principal:safe(total(day.rows,['principal'])),interest:safe(total(day.rows,['interest'])),loans:safe(total(day.rows,['loan'])),paid:safe(total(day.rows,['principal','interest'])),editable:day.rows.every(x=>!!x.dailyRecordId)}))}});
}
