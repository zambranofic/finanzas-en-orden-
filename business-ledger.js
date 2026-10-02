import {businessConfig} from './business-daily.js';
import {businessPeriodEnd} from './business-chart.js';
import {validDate} from './calendar-events.js';

// Money is summed as integer minor units; display ratios never alter balances.
const safe=n=>n>=-BigInt(Number.MAX_SAFE_INTEGER)&&n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null;
const sum=rows=>safe(rows.reduce((n,x)=>n+BigInt(x.amountMinor),0n));
export function businessLedger(bucket,section,month,currency,asOf){
 const until=businessPeriodEnd(month,asOf),start=month+'-01',config=businessConfig(bucket,currency);
 const valid=x=>validDate(x.date)&&x.date<=until&&(x.currency||'USD')===currency&&x.calendarRole!=='reminder'&&x.cashRole!=='openingConfig'&&x.dailyField!=='anchor'&&Number.isSafeInteger(x.amountMinor)&&x.amountMinor>=0;
 const types=section==='cashflow'?['collection','cashPayment','debtPrincipal','debtInterest']:[{sales:'sale',costs:'cost',expenses:'expense'}[section]];
 const all=types.flatMap(type=>(bucket[type]||[]).map((x,index)=>({...x,type,index}))).filter(valid);
 const rows=all.filter(x=>x.date>=start).sort((a,b)=>b.date.localeCompare(a.date));
 const inflow=x=>x.type==='collection';
 const signed=rows=>safe(rows.reduce((n,x)=>n+(inflow(x)?1n:-1n)*BigInt(x.amountMinor),0n));
 const sales=sum((bucket.sale||[]).filter(x=>valid(x)&&x.date>=start));
 const total=sum(rows),incoming=sum(rows.filter(inflow)),outgoing=sum(rows.filter(x=>!inflow(x))),net=signed(rows);
 const configKnown=Number.isSafeInteger(config?.openingCashMinor)&&validDate(config?.startDate)&&config.startDate<=until;
 const baselineDate=configKnown?(config.startDate>start?config.startDate:start):start;
 const prior=configKnown?all.filter(x=>x.date>=config.startDate&&x.date<baselineDate):[];
 const opening=configKnown?safe(BigInt(config.openingCashMinor)+prior.reduce((n,x)=>n+(inflow(x)?1n:-1n)*BigInt(x.amountMinor),0n)):null;
 const relevant=configKnown?all.filter(x=>x.date>=baselineDate):rows;
 const balance=configKnown&&opening!==null?safe(BigInt(opening)+relevant.reduce((n,x)=>n+(inflow(x)?1n:-1n)*BigInt(x.amountMinor),0n)):null;
 const days=new Map();for(const row of section==='cashflow'?relevant:rows){if(!days.has(row.date))days.set(row.date,[]);days.get(row.date).push(row)}
 let accumulated=section==='cashflow'?BigInt(opening??0):0n;
 const points=[{date:section==='cashflow'?baselineDate:start,value:safe(accumulated),initial:true,change:0}];
 for(const [date,entries] of [...days].sort(([a],[b])=>a.localeCompare(b))){const change=section==='cashflow'?signed(entries):sum(entries);if(change===null){accumulated=BigInt(Number.MAX_SAFE_INTEGER)+1n;break}accumulated+=BigInt(change);points.push({date,value:safe(accumulated),change})}
 const overflow=total===null||sales===null||(section==='cashflow'&&(net===null||(configKnown&&(opening===null||balance===null))))||safe(accumulated)===null||points.some(p=>p.value===null);
 if(points.at(-1).date<until)points.push({date:until,value:safe(accumulated),closing:true,change:0});
 const anchors=(bucket.collection||[]).filter(x=>x.dailyField==='anchor'&&(x.currency||'USD')===currency&&validDate(x.date)&&x.date>=start&&x.date<=until);
 return {section,month,start,until,rows,total,sales,incoming,outgoing,net,opening,balance,configKnown,baselineDate,overflow,points:overflow?[]:points,hasMovements:days.size>0,registeredDays:anchors.length,missingCostDays:anchors.filter(x=>!x.costKnown).length,ratio:total!==null&&sales>0?Number(BigInt(total)*10000n/BigInt(sales))/100:null,history:[...new Set(rows.map(x=>x.date))].map(date=>({date,rows:rows.filter(x=>x.date===date),total:section==='cashflow'?signed(rows.filter(x=>x.date===date)):sum(rows.filter(x=>x.date===date))}))};
}
