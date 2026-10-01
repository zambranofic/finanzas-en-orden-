import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COUNTRIES,CURRENCIES,CURRENCY_MINOR_UNITS,countryInfo,currencyLabel,currencyOptionLabel,countryOptions,searchCountries,countryLabel,formatMinor,inputMinor,parseMinor,currencyBucket,countrySuggestion} from './currency-utils.js';
import {personalMonth,businessMonth,convertMinor} from './financial-engine.js';
import {expenseBreakdown,fundBalance} from './personal-foundation.js';
import {DAILY_FIELDS,upsertDaily,businessSummary} from './business-daily.js';
import {calendarEvents} from './calendar-events.js';
const required='EC AR BO CL CO CR CU DO SV GT HN MX NI PA PY PE PR UY VE ES CA BR US AD DE AT BE BG CY HR SK SI EE FI FR GR IE IT LV LT LU MT MC ME NL PT SM XK VA AU HT GY SR'.split(' ');
for(const code of required)assert(COUNTRIES.some(x=>x.code===code),code);
assert.equal(countryInfo('BG').currency,'EUR');assert.equal(countryInfo('Brasil').currency,'BRL');assert.equal(COUNTRIES.length,new Set(COUNTRIES.map(x=>x.code)).size);
let cases=0;
for(const x of COUNTRIES){for(const n of [0,1,99,1234567,98765432100]){assert.equal(parseMinor(inputMinor(n,x.currency,x.name),x.currency,x.name),n,`${x.code} ${n}`);assert(formatMinor(n,x.currency,x.name).includes(x.currency));cases++;}}
for(const c of CURRENCIES){assert.equal(parseMinor('-1',c,'Ecuador'),null);assert.equal(parseMinor('1e3',c,'Ecuador'),null);assert.equal(parseMinor('9007199254740992',c,'Ecuador'),null);assert.equal(parseMinor('1,123',c,'Ecuador'),null)}
assert.equal(parseMinor('1.234,56','EUR','España'),123456);assert.equal(parseMinor('1,234.56','MXN','México'),123456);assert.equal(parseMinor('12.34,56','EUR','España'),null);assert.equal(parseMinor('1,23.45','MXN','México'),null);assert.equal(parseMinor('1,5','CLP','Chile'),null);assert.equal(parseMinor('1.234','CLP','Chile'),1234);
assert(!formatMinor(15000000,'COP','Colombia').includes(',00'));assert(formatMinor(15000001,'COP','Colombia').includes(',01'));
const rows={income:[{date:'2026-10-01',amountMinor:10000,currency:'USD'},{date:'2026-10-01',amountMinor:50000000,currency:'COP'}],expense:[{date:'2026-10-01',amountMinor:1000,currency:'USD',expenseClass:'fixed'},{date:'2026-10-01',amountMinor:10000000,currency:'COP',expenseClass:'fixed'}],saving:[{date:'2026-10-01',amountMinor:300,currency:'USD',fundId:'survival'},{date:'2026-10-01',amountMinor:500000,currency:'COP',fundId:'survival'}]};
const before=JSON.stringify(rows);
assert.equal(personalMonth(currencyBucket(rows,'USD'),'2026-10').income,10000);assert.equal(personalMonth(currencyBucket(rows,'COP'),'2026-10').income,50000000);assert.equal(expenseBreakdown(rows.expense,'2026-10','USD').fixed,1000);assert.equal(fundBalance(rows.saving,'survival','COP'),500000);assert(calendarEvents(rows,'personal','USD').every(x=>x.currency==='USD'));
assert.equal(JSON.stringify(rows),before);
const suggest=countrySuggestion({personalCurrency:'USD',businessCurrency:'USD'},'Colombia',{personal:rows,business:{}});assert.equal(suggest.personalCurrency,undefined);assert.equal(suggest.businessCurrency,'COP');assert.equal(countrySuggestion({},'Canadá',{personal:{},business:{}}).personalCurrency,'CAD');
let b={};b=upsertDaily(b,'2026-10-01','USD',{...Object.fromEntries(DAILY_FIELDS.map(x=>[x,0])),collected:10000,purchases:2000,expenses:1000,soldCost:2000});b=upsertDaily(b,'2026-10-01','CLP',{...Object.fromEntries(DAILY_FIELDS.map(x=>[x,0])),collected:50000,purchases:10000,expenses:5000,soldCost:10000});assert.equal(businessSummary(b,'2026-10','USD','2026-10-01').collections,10000);assert.equal(businessSummary(b,'2026-10','CLP','2026-10-01').collections,50000);
assert.equal(convertMinor(100,'USD','CLP',900*100000000),900);assert.equal(convertMinor(900,'CLP','USD',Math.round(100000000/900)),100);
for(const path of ['app-v4.js','annual-demo-app.js']){const source=fs.readFileSync(path,'utf8');assert(source.includes('const b=currencyBucket(records.personal,profileData.personalCurrency)'));assert(source.includes('const b=currencyBucket(records.business,profileData.businessCurrency)'));assert(source.includes('current?.currency||currency(),date,demo:'));assert(!source.includes('Math.round(amount*100)'));assert(!source.includes('asMinor(current)/100'));}
assert(fs.readFileSync('supabase-store.js','utf8').includes("base_currency:x.currency||"));
console.log(`currency: ${COUNTRIES.length} countries, ${CURRENCIES.length} currencies, ${cases} exact input/format round trips; currency isolation, calendar, funds, daily summaries, safe country suggestion, FX scales PASS`);
// Exercise the actual dashboard adapters, profile markup, history and edit handler.
for(const path of ['app-v4.js','annual-demo-app.js']){
 const source=fs.readFileSync(path,'utf8'),get=name=>source.split('\n').find(x=>x.startsWith('function '+name+'('));
 const profileData={name:'Ana',email:'ana@example.test',country:'Colombia',personalCurrency:'USD',businessCurrency:'CLP'};
 for(const [fn,mode] of [['personalEngineData','personal'],['businessEngineData','business']]){
  const records={personal:rows,business:{sale:rows.income}};
  const data=new Function('records','profileData','currencyBucket','asMinor','isWithdrawal',get(fn)+`;return ${fn}();`)(records,profileData,currencyBucket,x=>x.amountMinor,x=>x.direction==='withdrawal');
  assert(Object.values(data).flat().every(x=>mode==='personal'?x.amountMinor!==50000000&&x.amountMinor!==10000000:true));
 }
 const profileHtml=new Function('profileData','esc','COUNTRIES','CURRENCIES','currencyLabel','membershipCard','membershipLicense','navIcon','countryOptions','currencyOptionLabel',get('profile')+';return profile();')(profileData,x=>String(x),COUNTRIES,CURRENCIES,currencyLabel,()=>'',null,()=>'',countryOptions,currencyOptionLabel);
 for(const c of COUNTRIES)assert(profileHtml.includes(`value="${c.name}"`));
 const current={name:'Ingreso COP',date:'2026-10-01',amountMinor:50000000,currency:'COP'},list=[current];let callback,saved=false;
 const inputs={'#rName':{value:'Ingreso COP actualizado'},'#rAmount':{value:'500.000,01'},'#rDate':{value:'2026-10-01'},'#modalWrap':{classList:{add(){}}}};
 const deps={state:{mode:'personal',section:'income'},listFor:()=>list,sectionType:{income:'income'},entitySections:new Set(),openModalForm:(title,html,cb)=>{callback=cb;assert(html.includes('(COP)'))},esc:String,currency:()=>profileData.personalCurrency,amountInput:(n,c=profileData.personalCurrency)=>inputMinor(n,c,profileData.country),asMinor:x=>x.amountMinor,localDateKey:()=> '2026-10-01',$:x=>inputs[x],toMinor:(n,c)=>parseMinor(n,c,profileData.country),clearModalError(){},modalError(msg){throw Error(msg)},saveRecords(){saved=true},render(){},crypto:{randomUUID:()=> 'test'},records:{personal:{income:list},business:{}},readDaily:()=>({registered:false}),navigateApp(){},openPersonalMovement(){}};
 new Function(...Object.keys(deps),get('openRecordModal')+';openRecordModal(0);')(...Object.values(deps));callback();assert(saved);assert.equal(list[0].currency,'COP');assert.equal(list[0].amountMinor,50000001);
 deps.state.section='home';inputs['#rName'].value='Ingreso rápido';inputs['#rAmount'].value='10,00';
 new Function(...Object.keys(deps),get('openRecordModal')+";openRecordModal(null,'income');")(...Object.values(deps));callback();assert.equal(deps.state.section,'home');assert.equal(list.at(-1).amountMinor,1000);assert.equal(list.at(-1).currency,'USD');
}
for(const c of CURRENCIES){const n=Number.MAX_SAFE_INTEGER;assert.equal(parseMinor(inputMinor(n,c,'España'),c,'España'),n);assert(formatMinor(-1,c,'España').includes('-'));}
console.log('currency integration: both apps keep original currency when editing, render all country options, isolate dashboard data, preserve maximum safe integer and negative-display precision PASS');

for(const code of ['CH','NO','JP','NZ','GQ','PL','CZ','SE'])assert(!COUNTRIES.some(x=>x.code===code));
assert.equal(searchCountries('Estados Unidos')[0].code,'US');assert.equal(searchCountries('EEUU')[0].code,'US');assert.equal(searchCountries('canada')[0].code,'CA');assert(searchCountries('euro').every(x=>x.currency==='EUR'));assert.equal(countryLabel(countryInfo('US')),'Estados Unidos · USD');assert.equal(currencyLabel('USD'),'USD · dólar');assert.equal(searchCountries('Inglaterra')[0].code,'GB');
assert(countryOptions('Colombia','Estados Unidos').includes('value="Colombia" selected'));assert(countryOptions('Colombia','Estados Unidos').includes('Estados Unidos'));assert(countryOptions('Colombia','zzzz').includes('No hay países'));assert(countryOptions('Suiza').includes('Selecciona tu país'));
console.log('country picker: euro-only Europe, Latin America and requested destinations; flags, concise labels, accent-insensitive search, EEUU alias and stable selection PASS');

import {pickerChoice} from './profile-pickers.js';
for(const x of COUNTRIES){assert(pickerChoice(x.name,true).includes('assets/flags/'+x.code.toLowerCase()+'.png'));assert(fs.readFileSync('assets/flags/'+x.code.toLowerCase()+'.png').subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));}assert(pickerChoice('USD',false).includes('assets/flags/us.png'));assert(pickerChoice('GBP',false).includes('assets/flags/gb.png'));assert(pickerChoice('USD',false).includes('USD · dólar'));console.log('profile pickers: actual local image flags, short labels, England and photo markup PASS');

// A click on a label must stay inside its picker even after refresh replaces that label.
const pickerSource=fs.readFileSync('profile-pickers.js','utf8');
const outsideHandler=pickerSource.split("root.addEventListener('click',")[1].split(',{signal});')[0];
let closes=0;const wrap={},picker={wrap,close(){closes++}};
const handleOutside=new Function('pickers','return '+outsideHandler)([picker]);
const detachedLabel={id:''};
handleOutside({target:detachedLabel,composedPath:()=>[detachedLabel,wrap]});assert.equal(closes,0);
handleOutside({target:{id:''},composedPath:()=>[{}]});assert.equal(closes,1);
handleOutside({target:{id:'pfCountrySearch'},composedPath:()=>[{}]});assert.equal(closes,1);
console.log('picker click regression: refreshed labels remain open; outside clicks close; search remains open PASS');
