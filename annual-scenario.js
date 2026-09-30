// Fictional twelve-month scenario. No production account or API is involved.
export function buildAnnualScenario(){
 const records={personal:{income:[],expense:[],saving:[],debtPayment:[],asset:[],debt:[],goal:[]},business:{sale:[],cost:[],expense:[],collection:[],cashPayment:[],debtPrincipal:[],debtInterest:[]}};
 const months=Array.from({length:12},(_,i)=>new Date(Date.UTC(2025,9+i,1)).toISOString().slice(0,7));
 const expectations=[];let assets=500000,loan=480000,card=120000,cash=400000,receivable=0,payable=0;
 const add=(mode,type,name,amountMinor,date,extra={})=>records[mode][type].push({name,amountMinor,date,currency:'USD',demo:true,entityType:type,...extra});
 months.forEach((month,i)=>{
  const date=d=>`${month}-${String(d).padStart(2,'0')}`;
  const salary=240000+(i>=6?20000:0),freelance=25000+i*1500,bonus=i===2?60000:0;
  add('personal','income','Marta · Salario',salary,date(1));add('personal','income','Marta · Diseño freelance',freelance,date(8));if(bonus)add('personal','income','Marta · Bono anual',bonus,date(20));
  const expenses=[['Alquiler',65000],['Alimentación',32000+i*400],['Transporte',11000],['Servicios',9000],['Salud',6500],['Educación',8000],['Ocio',10000],['Seguro',4500]];
  if(i===4)expenses.push(['Reparación del automóvil',85000]);if(i===9)expenses.push(['Vacaciones',65000]);
  expenses.forEach(([name,amount],j)=>add('personal','expense',name,amount,date(5+j)));
  const deposit=35000,withdrawal=i===4?20000:0,payment=30000+(i<6?20000:0),expense=expenses.reduce((a,x)=>a+x[1],0),income=salary+freelance+bonus;
  add('personal','saving','Fondo de emergencia',deposit,date(15),{direction:'deposit'});if(withdrawal)add('personal','saving','Retiro por reparación',withdrawal,date(16),{direction:'withdrawal'});
  add('personal','debtPayment','Cuota préstamo personal',30000,date(25));if(i<6)add('personal','debtPayment','Pago tarjeta de crédito',20000,date(26));
  loan-=25000;card=Math.max(0,card-20000);assets+=income-expense-payment;
  const sales=700000+i*25000+([2,11].includes(i)?200000:0),cost=Math.round(sales*0.42),interest=10000-i*500,principal=30000;
  const overhead=[['Alquiler del local',90000],['Nómina',140000],['Servicios',16000],['Marketing',18000],['Software',6000],['Contabilidad',10000]];
  if(i===5)overhead.push(['Reparación de estanterías',65000]);const opex=overhead.reduce((a,x)=>a+x[1],0);
  add('business','sale','Librería Horizonte · Ventas del mes',sales,date(3));add('business','cost','Libros y materiales vendidos',cost,date(6));overhead.forEach(([name,amount],j)=>add('business','expense',name,amount,date(10+j)));
  const collected=Math.round(sales*0.8)+receivable;receivable=sales-Math.round(sales*0.8);
  const supplierPaid=Math.round(cost*0.9)+payable;payable=cost-Math.round(cost*0.9);
  add('business','collection','Cobros del mes y cartera anterior',collected,date(20));add('business','cashPayment','Pago a proveedores',supplierPaid,date(21));add('business','cashPayment','Pagos operativos',opex,date(22));add('business','debtPrincipal','Capital préstamo negocio',principal,date(25));add('business','debtInterest','Interés préstamo negocio',interest,date(25));
  const result=sales-cost-opex-interest,flow=collected-supplierPaid-opex-principal-interest;cash+=flow;
  expectations.push({month,income,expense,netSavings:deposit-withdrawal,debtPayments:payment,available:income-expense-deposit+withdrawal-payment,assets,debts:loan+card,sales,cost,opex,interest,principal,collected,supplierPaid,result,flow,closingCash:cash,receivable,payable,breakEven:Math.ceil((opex+interest)*sales/(sales-cost))});
 });
 const last=months.at(-1)+'-28';add('personal','asset','Ahorro, efectivo e inversiones',assets,last,{entityId:'marta-assets'});add('personal','debt','Préstamo personal · saldo pendiente',loan,last,{entityId:'marta-loan'});add('personal','goal','Fondo de emergencia objetivo',900000,last,{entityId:'marta-goal'});
 return {months,records,expectations,profile:{name:'Marta Ríos · FICTICIO',email:'',country:'Ecuador',personalCurrency:'USD',businessCurrency:'USD',theme:'dark',tutorialCompleted:true,photo:''},openingCash:400000,person:'Marta Ríos, diseñadora de 34 años. Vive de su salario y encargos freelance; paga una tarjeta y un préstamo, ahorra y afronta una reparación y unas vacaciones.',business:'Librería Horizonte, negocio ficticio con ventas de contado y crédito, compras a proveedores, nómina, alquiler, deuda y estacionalidad.'};
}
export function engineData(records){const p=records.personal,b=records.business;return {personal:{income:p.income,expense:p.expense,saving:p.saving,debtPayments:p.debtPayment,assets:p.asset.map(x=>({id:x.entityId,date:x.date,valueMinor:x.amountMinor})),debts:p.debt.map(x=>({id:x.entityId,date:x.date,balanceMinor:x.amountMinor}))},business:{sales:b.sale,collections:b.collection,variableCosts:b.cost,operatingExpenses:b.expense,cashPayments:b.cashPayment,debtPrincipalPayments:b.debtPrincipal,debtInterestPayments:b.debtInterest}};}
