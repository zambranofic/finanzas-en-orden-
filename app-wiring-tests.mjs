import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('./app-v4.js',import.meta.url),'utf8');
assert(app.includes("from './navigation-utils.js'"),'navigation helpers must be imported');
assert(app.includes("function bindNav(){document.querySelectorAll('[data-section]').forEach"),'navigation must bind all section buttons');
assert(!app.includes("function bindNav(){$('[data-section]').forEach"),'querySelector must not be used as a collection');
const modeBinding=app.split('\n').find(line=>line.includes(".modeBtn')")&&line.includes('b.onclick='));
assert(modeBinding,'mode buttons must be wired during startup');
const buttons=[{dataset:{mode:'personal'}},{dataset:{mode:'business'}}];
const elements={'#themeBtn':{},'#modalWrap':{}};
let navigation;
vm.runInNewContext(modeBinding,{
  $:selector=>selector==='.modeBtn'?buttons[0]:elements[selector],
  $$:selector=>selector==='.modeBtn'?buttons:[],
  state:{mode:'personal'},playModeSwitchSound:()=>{},
  navigateApp:value=>{navigation=value},cycleTheme:()=>{},closeModal:()=>{},
  document:{addEventListener:()=>{}}
});
assert.equal(typeof buttons[0].onclick,'function');
assert.equal(typeof buttons[1].onclick,'function');
buttons[1].onclick();
assert.equal(navigation.mode,'business');
assert.equal(navigation.section,'home');
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}};
const shared=memory(), firstSession=memory(), secondSession=memory();
const helperSource=app.slice(app.indexOf('// Paid checkout recovery'),app.indexOf('// End paid checkout recovery helpers.'));
const first=vm.createContext({localStorage:shared,sessionStorage:firstSession,Date});
const second=vm.createContext({localStorage:shared,sessionStorage:secondSession,Date});
vm.runInContext(helperSource,first);vm.runInContext(helperSource,second);
vm.runInContext("rememberPaidCheckout('Buyer@example.com','test-claim',true)",first);
assert.equal(vm.runInContext('readPaidCheckout().claim',second),'test-claim','recovery tab must retain the paid claim');
assert.equal(vm.runInContext('readPaidCheckout().existingAccount',second),true);
let claimed=0;
second.cloud={currentUser:async()=>({email:'other@example.com'}),myLicense:async()=>null,claimPaidAccess:async()=>{claimed++}};
await vm.runInContext('claimPendingPaidAccess()',second);
assert.equal(claimed,0,'another account must not consume the purchase');
assert(vm.runInContext('readPaidCheckout()',second));
second.cloud.currentUser=async()=>({email:'buyer@example.com'});
await vm.runInContext('claimPendingPaidAccess()',second);
assert.equal(claimed,1);
assert.equal(vm.runInContext('readPaidCheckout()',first),null,'successful claim clears every tab');
vm.runInContext("rememberPaidCheckout('buyer@example.com','already-claimed',true)",first);
second.cloud.myLicense=async()=>({status:'active'});
await vm.runInContext('claimPendingPaidAccess()',second);
assert.equal(claimed,1,'an active license must not retry a consumed claim');
assert.equal(vm.runInContext('readPaidCheckout()',first),null);
firstSession.setItem('feo-paid-claim','legacy');firstSession.setItem('feo-paid-email','buyer@example.com');
assert.equal(vm.runInContext('readPaidCheckout().claim',first),'legacy','existing checkout tabs must migrate');
shared.setItem('feo-paid-checkout',JSON.stringify({email:'buyer@example.com',claim:'expired',expiresAt:Date.now()-1}));
assert.equal(vm.runInContext('readPaidCheckout()',second),null,'expired claims must be removed');
const bootSource=app.slice(app.indexOf('async function boot(){'),app.indexOf('async function enterApp(){'));
let screen;
const location={search:'?login=1',pathname:'/',origin:'https://finorve.com'};
const routing=vm.createContext({cloud:{acceptAuthFromUrl:()=>null},URLSearchParams,location,history:{replaceState:()=>{}},showExistingLogin:()=>{screen='login'},showRecoveryPassword:()=>{screen='recovery'}});
vm.runInContext(bootSource,routing);
await vm.runInContext('boot()',routing);
assert.equal(screen,'login','password reset return must open login without checkout');
routing.cloud.acceptAuthFromUrl=()=> 'recovery';
await vm.runInContext('boot()',routing);
assert.equal(screen,'recovery','recovery link must take priority over pending checkout/login');
const resetSource=app.slice(app.indexOf('async function submitRecoveryPassword(){'),app.indexOf('function showPaidSignup('));
const resetElements={'#authPassword':{value:'new-secret'},'#authPasswordConfirm':{value:'new-secret'},'#authMsg':{classList:{remove:()=>{}}},'#authSignin':{textContent:'Guardar'}};
let resetSaved=false;
const reset=vm.createContext({$:s=>resetElements[s],validatePassword:()=>true,cloud:{changePassword:async()=>{resetSaved=true},signOut:()=>{}},location:{origin:'https://finorve.com',pathname:'/'}});
vm.runInContext(resetSource,reset);
await vm.runInContext('submitRecoveryPassword()',reset);
assert(resetSaved);
assert.equal(reset.location.href,'https://finorve.com/?login=1');
console.log('app-wiring-tests: OK');
