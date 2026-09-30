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
console.log('app-wiring-tests: OK');
