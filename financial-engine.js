/* Finanzas en Orden V4 — motor financiero puro.
   Dinero: enteros en minor units. FX: entero escalado (1e8). Sin floats monetarios. */
export const CURRENCY_MINOR_UNITS = { USD:2, EUR:2, GBP:2, MXN:2, COP:2, ARS:2, CLP:0, PEN:2, BRL:2, JPY:0 };
export const FX_SCALE = 100000000;

function assertInt(n,label='valor'){ if(!Number.isSafeInteger(n)) throw new Error(`${label} debe ser entero seguro`); return n; }
function monthOf(date){ return String(date).slice(0,7); }
function rowsInMonth(rows,month){ return rows.filter(r=>monthOf(r.date)===month); }
function sumMinor(rows,predicate=()=>true){ return rows.filter(predicate).reduce((a,r)=>a+assertInt(r.amountMinor,'amountMinor'),0); }
function pctBasisPoints(n,d){ return d===0?null:Math.round((n*10000)/d); }
function divRoundHalfAway(num,den){
  if(den<=0) throw new Error('denominador inválido');
  const sign=num<0?-1:1; const n=Math.abs(num);
  return sign*Math.floor((n+Math.floor(den/2))/den);
}
function pow10(n){ return 10**n; }

export function convertMinor(amountMinor,from,to,rateScaled){
  assertInt(amountMinor,'amountMinor'); assertInt(rateScaled,'rateScaled');
  const f=CURRENCY_MINOR_UNITS[from], t=CURRENCY_MINOR_UNITS[to];
  if(f==null||t==null) throw new Error('moneda no soportada');
  // targetMinor = sourceMinor / 10^f * rate * 10^t
  const num=amountMinor*rateScaled*pow10(t);
  const den=FX_SCALE*pow10(f);
  if(!Number.isSafeInteger(num)) throw new Error('conversión excede entero seguro');
  return divRoundHalfAway(num,den);
}

export function personalMonth(data,month){
  const income=sumMinor(rowsInMonth(data.income||[],month));
  const expense=sumMinor(rowsInMonth(data.expense||[],month));
  const savingsIn=sumMinor(rowsInMonth(data.saving||[],month),r=>r.direction!=='withdrawal');
  const savingsOut=sumMinor(rowsInMonth(data.saving||[],month),r=>r.direction==='withdrawal');
  const netSavings=savingsIn-savingsOut;
  const debtPayments=sumMinor(rowsInMonth(data.debtPayments||[],month));
  const available=income-expense-netSavings-debtPayments;
  return {income,expense,netSavings,debtPayments,available,savingsRateBp:pctBasisPoints(netSavings,income)};
}

function latestById(rows,asOf,valueKey){
  const map=new Map();
  for(const r of rows.filter(x=>x.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date))){
    const id=r.id||'__single__'; map.set(id,assertInt(r[valueKey],valueKey));
  }
  return [...map.values()].reduce((a,v)=>a+v,0);
}
export function personalPosition(data,asOf){
  const assets=latestById(data.assets||[],asOf,'valueMinor');
  const debts=latestById(data.debts||[],asOf,'balanceMinor');
  return {assets,debts,netWorth:assets-debts};
}

export function businessMonth(data,month){
  const sales=sumMinor(rowsInMonth(data.sales||[],month));
  const collections=sumMinor(rowsInMonth(data.collections||[],month));
  const variableCosts=sumMinor(rowsInMonth(data.variableCosts||[],month));
  const operatingExpenses=sumMinor(rowsInMonth(data.operatingExpenses||[],month));
  const cashPayments=sumMinor(rowsInMonth(data.cashPayments||[],month));
  const debtPrincipal=sumMinor(rowsInMonth(data.debtPrincipalPayments||[],month));
  const debtInterest=sumMinor(rowsInMonth(data.debtInterestPayments||[],month));
  const operatingResult=sales-variableCosts-operatingExpenses-debtInterest;
  const cashFlow=collections-cashPayments-debtPrincipal-debtInterest;
  const contribution=sales-variableCosts;
  return {sales,collections,variableCosts,operatingExpenses,cashPayments,debtPrincipal,debtInterest,operatingResult,cashFlow,contribution,contributionMarginBp:pctBasisPoints(contribution,sales)};
}

export function breakEven({fixedCostsMinor,unitPriceMinor,unitVariableCostMinor}){
  [fixedCostsMinor,unitPriceMinor,unitVariableCostMinor].forEach((n,i)=>assertInt(n,['fixedCostsMinor','unitPriceMinor','unitVariableCostMinor'][i]));
  const contributionPerUnit=unitPriceMinor-unitVariableCostMinor;
  if(contributionPerUnit<=0) return {possible:false,units:null,revenueMinor:null,contributionPerUnit};
  const units=Math.ceil(fixedCostsMinor/contributionPerUnit);
  return {possible:true,units,revenueMinor:units*unitPriceMinor,contributionPerUnit};
}

export function simulateBusiness(base,change){
  let {units,unitPriceMinor,unitVariableCostMinor,fixedCostsMinor,openingCashMinor=0}=base;
  if(change.pricePctBp!=null) unitPriceMinor=divRoundHalfAway(unitPriceMinor*(10000+change.pricePctBp),10000);
  if(change.unitsPctBp!=null) units=Math.max(0,divRoundHalfAway(units*(10000+change.unitsPctBp),10000));
  if(change.variableCostPctBp!=null) unitVariableCostMinor=divRoundHalfAway(unitVariableCostMinor*(10000+change.variableCostPctBp),10000);
  if(change.fixedCostDeltaMinor!=null) fixedCostsMinor+=change.fixedCostDeltaMinor;
  const sales=units*unitPriceMinor, variableCosts=units*unitVariableCostMinor;
  const result=sales-variableCosts-fixedCostsMinor;
  const be=breakEven({fixedCostsMinor,unitPriceMinor,unitVariableCostMinor});
  return {units,unitPriceMinor,unitVariableCostMinor,fixedCostsMinor,sales,variableCosts,result,closingCashMinor:openingCashMinor+result,breakEven:be,assumptions:{...change}};
}
export function businessDecisionImpact(before,after){ return {salesDelta:after.sales-before.sales,resultDelta:after.result-before.result,cashDelta:after.closingCashMinor-before.closingCashMinor,breakEvenUnitsDelta:(after.breakEven.units??0)-(before.breakEven.units??0)}; }
