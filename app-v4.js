import { membershipState, membershipBanner, membershipCard } from './membership-ui.js';
import { personalMonth, personalPosition, businessMonth, businessBreakEvenSummary, breakEven as calcBreakEven, simulateBusiness } from './financial-engine.js';
import * as cloud from './supabase-store.js';
import { ensureSyncId, samePendingSnapshot } from './sync-utils.js';
import { commitProfile } from './profile-utils.js';
import { validatePassword, PASSWORD_POLICY_MESSAGE } from './password-policy.js';
import { normalizeNavigationState, navigationChanged } from './navigation-utils.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let membershipLicense=null;
const state={mode:localStorage.getItem('feo-mode')||'personal',section:'home',theme:localStorage.getItem('feo-theme')||'system',sound:localStorage.getItem('feo-sound')!=='off',onboardingChoice:'personal',onboardingMode:'personal',onboardingStep:0};
const money=(n,c='USD')=>new Intl.NumberFormat('es-ES',{style:'currency',currency:c,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const moneyMinor=(n,c='USD')=>new Intl.NumberFormat('es-ES',{style:'currency',currency:c,minimumFractionDigits:2,maximumFractionDigits:2}).format((n||0)/100);
const toMinor=s=>{const v=String(s??'').trim().replace(',','.');if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(v))return null;const [a,b='']=v.split('.');const n=Number(a)*100+Number((b+'00').slice(0,2));return Number.isSafeInteger(n)?n:null};
const navs={personal:[['home','⌂','Inicio'],['movements','◉','Movimientos'],['plan','□','Plan'],['decisions','◇','Decisiones'],['more','•••','Más']],business:[['home','⌂','Inicio'],['movements','◉','Movimientos'],['plan','□','Plan'],['decisions','◇','Decisiones'],['more','•••','Más']]};
const personal={income:4850,expenses:3120,savings:650,debt:350,assets:18400,totalDebt:6200};
const business={sales:12500,collections:10800,costs:4300,expenses:3100,debtPayments:650,cash:6420};
const systemTheme=()=>window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
function applyTheme(){const resolved=state.theme==='system'?systemTheme():state.theme;document.documentElement.dataset.theme=resolved;document.documentElement.dataset.themePreference=state.theme;const meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=resolved==='dark'?'#071f1d':'#f3f6f4'}
applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(state.theme==='system')applyTheme()});
function historySnapshot(){return {finorve:true,section:state.section,mode:state.mode}}
function ensureHistoryState(){const current=normalizeNavigationState(history.state||{},historySnapshot());state.section=current.section;state.mode=current.mode;history.replaceState(historySnapshot(),'')}
function navigateApp(next,{replace=false,fromPop=false}={}){const target=normalizeNavigationState(next,historySnapshot());if(!navigationChanged(historySnapshot(),target)&&!replace)return;state.section=target.section;state.mode=target.mode;localStorage.setItem('feo-mode',state.mode);if(!fromPop)(replace?history.replaceState:history.pushState).call(history,historySnapshot(),'');render()}
function renderNav(){const items=navs[state.mode];$('#nav').innerHTML=items.map(([id,ic,t])=>`<button data-section="${id}" class="${state.section===id?'active':''}"><b>${ic}</b><span>${t}</span></button>`).join('');$('#mobileNav').innerHTML=items.map(([id,ic,t])=>`<button data-section="${id}" class="${state.section===id?'active':''}"><i>${ic}</i>${t}</button>`).join('');bindNav()}
function bindNav(){document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>navigateApp({section:b.dataset.section,mode:state.mode}))}
window.addEventListener('popstate',e=>{const target=normalizeNavigationState(e.state||{}, {section:'home',mode:state.mode});state.section=target.section;state.mode=target.mode;localStorage.setItem('feo-mode',state.mode);render()})
function bars(){return [48,64,55,78,69,88,74].map((h,i)=>`<div class="bar ${i===5?'active':''}" style="height:${h}%"><span>${['Mar','Abr','May','Jun','Jul','Ago','Sep'][i]}</span></div>`).join('')}
function localDateKey(){const d=new Date(),local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,10)}
function monthKey(){return localDateKey().slice(0,7)}
function monthEndFor(month){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)}
function monthEndKey(){return monthEndFor(monthKey())}
function recentMonthKeys(count=7,endMonth=monthKey()){const [y,m]=endMonth.split('-').map(Number);return Array.from({length:count},(_,i)=>{const d=new Date(Date.UTC(y,m-count+i,1));return d.toISOString().slice(0,7)})}
function monthLabel(month){const [y,m]=month.split('-').map(Number);return new Intl.DateTimeFormat('es-ES',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1))).replace('.','').replace(/^./,c=>c.toUpperCase())}
function asMinor(x){return Number.isSafeInteger(x?.amountMinor)?x.amountMinor:0}
function personalEngineData(){const b=records.personal||{};return {income:(b.income||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),expense:(b.expense||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),saving:(b.saving||[]).map(x=>({date:x.date,amountMinor:asMinor(x),direction:x.direction||'deposit'})),debtPayments:(b.debtPayment||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),assets:(b.asset||[]).map((x,i)=>({id:x.entityId||x.id||`asset-${i}`,date:x.date,valueMinor:asMinor(x)})),debts:(b.debt||[]).map((x,i)=>({id:x.entityId||x.id||`debt-${i}`,date:x.date,balanceMinor:asMinor(x)}))}}
function businessEngineData(){const b=records.business||{};return {sales:(b.sale||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),collections:(b.collection||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),variableCosts:(b.cost||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),operatingExpenses:(b.expense||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),cashPayments:(b.cashPayment||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),debtPrincipalPayments:(b.debtPrincipal||[]).map(x=>({date:x.date,amountMinor:asMinor(x)})),debtInterestPayments:(b.debtInterest||[]).map(x=>({date:x.date,amountMinor:asMinor(x)}))}}
function personalScore(m,pos){if(!m.income&&!m.expense&&!m.netSavings&&!m.debtPayments&&!pos.assets&&!pos.debts)return null;let score=50;if(m.available>0)score+=12;if((m.savingsRateBp||0)>=1000)score+=10;if((m.savingsRateBp||0)>=2000)score+=6;if(pos.netWorth>0)score+=8;if(pos.debts>0&&pos.assets>pos.debts)score+=5;if(m.expense>m.income)score-=18;return Math.max(0,Math.min(100,score))}
function businessScore(m){if(!m.sales&&!m.collections&&!m.variableCosts&&!m.operatingExpenses&&!m.cashPayments&&!m.debtPrincipal&&!m.debtInterest)return null;let score=48;if(m.operatingResult>0)score+=15;if(m.cashFlow>0)score+=12;if(m.sales>0&&m.collections>=m.sales*.7)score+=8;if(m.sales>m.variableCosts+m.operatingExpenses)score+=7;if(m.cashFlow<0)score-=16;return Math.max(0,Math.min(100,score))}
function microBars(values=[]){return `<div class="microBars">${values.map((v,i)=>{const valid=Number.isFinite(v);return `<i class="${i===values.length-1?'active':''}${valid?'':' empty'}" style="height:${valid?Math.max(0,Math.min(100,Math.round(v))):0}%"></i>`}).join('')}</div>`}
function chartLegend(months){return `<div class="chartLegend">${months.map(m=>`<span>${monthLabel(m)}</span>`).join('')}</div>`}
function personalHistory(){const data=personalEngineData(),months=recentMonthKeys();return {months,values:months.map(month=>personalScore(personalMonth(data,month),personalPosition(data,monthEndFor(month))))}}
function businessHistory(){const data=businessEngineData(),months=recentMonthKeys();return {months,values:months.map(month=>businessScore(businessMonth(data,month)))}}
function nowNextGoal(items){return `<div class="triad">${items.map(([k,label,value,sub,icon])=>`<div class="triadCard"><span class="triadIcon">${icon}</span><div><small>${k}</small><b>${label}</b><strong>${value}</strong>${sub?`<em>${sub}</em>`:''}</div></div>`).join('')}</div>`}
function home(){if(state.mode==='personal'){const m=personalMonth(personalEngineData(),monthKey()),pos=personalPosition(personalEngineData(),monthEndKey()),score=personalScore(m,pos);const expPct=m.income?Math.round(m.expense*100/m.income):0;return `<div class="dashboardLead"><div class="scoreCard"><span class="eyebrow">TU SITUACIÓN FINANCIERA</span><div class="scoreLine"><strong>${score==null?'—':score}</strong><span>${score==null?'Sin datos':'/ 100'}</span></div><p>${score==null?'Registra tus primeros movimientos para calcular tu situación financiera.':score>=75?'Vas en buena dirección.':score>=55?'Hay una base estable, con espacio para mejorar.':'Hay varios puntos que requieren atención.'}</p><div class="scoreProgress"><i style="width:${score==null?0:score}%"></i></div><button class="scoreArrow" data-section="decisions">→</button></div><div class="priorityCard"><span class="eyebrow">LO MÁS IMPORTANTE AHORA</span><div class="priorityBody"><div class="priorityIcon">↗</div><div><h3>${expPct>65?'Tus gastos están tomando demasiado espacio':'Protege tu disponible antes de comprometerlo'}</h3><p>${expPct>65?`Los gastos equivalen al ${expPct}% de tus ingresos este mes.`:`Hoy tienes ${moneyMinor(m.available,currency())} disponibles después de tus movimientos registrados.`}</p><button class="primary" data-section="decisions">Ver recomendación →</button></div></div></div></div>${nowNextGoal([['AHORA','Disponible',moneyMinor(m.available,currency()),'', '▣'],['PRÓXIMO','Revisar pagos','Esta semana','Evita sorpresas de caja','□'],['META','Tasa de ahorro',m.savingsRateBp==null?'—':(m.savingsRateBp/100).toFixed(1)+'%','Objetivo recomendado: 20%','◎']])}<div class="dashboardGrid"><div class="card chartCard"><div class="cardHead"><div><span class="eyebrow">EVOLUCIÓN</span><h3>Tu situación financiera</h3></div><button class="info" data-info="available">i</button></div>${(()=>{const h=personalHistory();return microBars(h.values)+chartLegend(h.months)})()}</div><div class="card compactList"><span class="eyebrow">ESTE MES</span><div class="metricRow"><span>Ingresos</span><b>${moneyMinor(m.income,currency())}</b></div><div class="metricRow"><span>Gastos</span><b>${moneyMinor(m.expense,currency())}</b></div><div class="metricRow"><span>Ahorro neto</span><b>${moneyMinor(m.netSavings,currency())}</b></div><div class="metricRow"><span>Patrimonio</span><b>${moneyMinor(pos.netWorth,currency())}</b></div></div></div>`}return businessHome()}
function businessHome(){const m=businessMonth(businessEngineData(),monthKey()),score=businessScore(m);const margin=m.sales?Math.round(m.operatingResult*1000/m.sales)/10:null;return `<div class="dashboardLead"><div class="scoreCard"><span class="eyebrow">SALUD DE TU NEGOCIO</span><div class="scoreLine"><strong>${score==null?'—':score}</strong><span>${score==null?'Sin datos':'/ 100'}</span></div><p>${score==null?'Registra ventas, costos y caja para calcular la salud del negocio.':score>=75?'Buen potencial de crecimiento.':score>=55?'La operación es funcional, pero hay margen de mejora.':'La caja o el resultado requieren atención.'}</p><div class="scoreProgress"><i style="width:${score==null?0:score}%"></i></div><button class="scoreArrow" data-section="decisions">→</button></div><div class="priorityCard"><span class="eyebrow">LO MÁS IMPORTANTE AHORA</span><div class="priorityBody"><div class="priorityIcon">↗</div><div><h3>${margin!=null&&margin<20?'Tu margen necesita protección':'Resultado y caja deben avanzar juntos'}</h3><p>${margin!=null?`Tu margen operativo aproximado es ${margin}%.`:'Registra ventas y cobros para separar rentabilidad de efectivo.'}</p><button class="primary" data-section="decisions">Ver recomendación →</button></div></div></div></div>${nowNextGoal([['AHORA','Caja del mes',moneyMinor(m.cashFlow,currency()),'Cobros reales − pagos reales','▣'],['PRÓXIMO','Revisar cobros',moneyMinor(m.collections,currency()),'No confundas venta con efectivo','□'],['META','Resultado',moneyMinor(m.operatingResult,currency()),margin==null?'Sin ventas':`${margin}% sobre ventas`,'◎']])}<div class="dashboardGrid"><div class="card chartCard"><div class="cardHead"><div><span class="eyebrow">EVOLUCIÓN</span><h3>Salud mensual del negocio</h3></div><button class="info" data-info="cash">i</button></div>${(()=>{const h=businessHistory();return microBars(h.values)+chartLegend(h.months)})()}</div><div class="card compactList"><span class="eyebrow">ESTE MES</span><div class="metricRow"><span>Ventas</span><b>${moneyMinor(m.sales,currency())}</b></div><div class="metricRow"><span>Cobros</span><b>${moneyMinor(m.collections,currency())}</b></div><div class="metricRow"><span>Resultado</span><b>${moneyMinor(m.operatingResult,currency())}</b></div><div class="metricRow"><span>Flujo de caja</span><b>${moneyMinor(m.cashFlow,currency())}</b></div></div></div>`}
const titles={movements:'Movimientos',plan:'Plan',decisions:'Decisiones',more:'Más',income:'Ingresos',expenses:'Gastos',debts:'Deudas',savings:'Ahorros',goals:'Metas',assets:'Activos',diagnostic:'Diagnóstico financiero',sales:'Ventas',costs:'Costos',cashflow:'Flujo de caja',breakEven:'Punto de equilibrio',results:'Resultado',profile:'Mi perfil',settings:'Ajustes'};
function quickAction(id,icon,title,copy){return `<button class="moduleCard" data-section="${id}"><span>${icon}</span><b>${title}</b><small>${copy}</small><i>→</i></button>`}
function movementsView(){if(state.mode==='personal')return `<div class="sectionHead"><div><h2>Movimientos</h2><p>Registra lo esencial. FINORVE convierte tus movimientos en contexto para decidir mejor.</p></div></div><div class="moduleGrid">${quickAction('income','＋','Ingresos','Todo el dinero que entra a tus finanzas personales')}${quickAction('expenses','−','Gastos','Lo que reduce tu disponible durante el mes')}${quickAction('savings','◇','Ahorro','Movimientos que construyen o reducen tu colchón')}${quickAction('debts','□','Deudas','Controla cuánto debes y qué estás pagando')}</div>`;return `<div class="sectionHead"><div><h2>Movimientos</h2><p>Registra operación y caja por separado para entender tu negocio sin confusiones.</p></div></div><div class="moduleGrid">${quickAction('sales','＋','Ventas','Registra lo vendido aunque el dinero aún no haya entrado')}${quickAction('costs','−','Costos','Lo que aumenta o disminuye con tus ventas')}${quickAction('expenses','▤','Gastos','Lo que necesitas pagar para mantener la operación')}${quickAction('cashflow','↕','Cobros y pagos','Lo que realmente cobraste o pagaste')}</div>`}
function planView(){if(state.mode==='personal')return `<div class="sectionHead"><div><h2>Plan</h2><p>Convierte tus números actuales en un plan financiero claro.</p></div></div><div class="moduleGrid">${quickAction('goals','◎','Metas','Define objetivos y cuánto necesitas para alcanzarlos')}${quickAction('debts','□','Deudas','Ordena obligaciones y prioridades de pago')}${quickAction('assets','▣','Patrimonio','Entiende qué tienes, qué debes y tu posición neta')}${quickAction('diagnostic','✦','Diagnóstico','FINORVE identifica qué merece atención primero')}</div>`;return `<div class="sectionHead"><div><h2>Plan</h2><p>Usa tus números para planificar rentabilidad, caja y crecimiento.</p></div></div><div class="moduleGrid">${quickAction('breakEven','◎','Punto de equilibrio','Conoce el mínimo de ventas que sostiene tu operación')}${quickAction('results','▣','Resultado','Separa ingresos, costos y rentabilidad real')}${quickAction('cashflow','↕','Caja','Entiende cuánto efectivo entró y salió')}${quickAction('decisions','✦','Escenarios','Simula cambios antes de llevarlos al negocio real')}</div>`}
function moreView(){return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · HERRAMIENTAS</span><h2>Más</h2><p>Accede a las herramientas complementarias de tu espacio financiero.</p></div></div><div class="moreIntro"><div><span class="eyebrow">${state.mode==='personal'?'PERSONAL':'NEGOCIO'}</span><h3>${state.mode==='personal'?'Completa tu lectura financiera':'Profundiza en la lectura de tu negocio'}</h3><p>${state.mode==='personal'?'Diagnóstico, perfil y configuración reunidos en un solo lugar.':'Resultados, perfil y configuración sin mezclar operación y cuenta.'}</p></div></div><div class="moduleGrid moreGrid">${state.mode==='personal'?quickAction('diagnostic','✦','Diagnóstico','Entiende qué merece atención primero'):quickAction('results','▣','Resultados','Separa rentabilidad de caja y operación')}${quickAction('profile','○','Perfil','Identidad, país y monedas principales')}${quickAction('settings','⚙','Ajustes','Experiencia, seguridad y datos de demostración')}</div>`}
function personalDecisions(){const m=personalMonth(personalEngineData(),monthKey());const pos=personalPosition(personalEngineData(),monthEndKey());const expenseCut=Math.max(0,Math.round(m.expense*.12));const savingsTarget=Math.max(0,Math.round(m.income*.2));const debtRatio=pos.assets?Math.round(pos.debts*100/pos.assets):0;return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · MOTOR DE DECISIONES</span><h2>Decisiones</h2><p>No te mostramos veinte opciones a la vez. Elige una decisión y revisa su posible impacto con tus propios datos.</p></div></div><div class="decisionContext"><div><small>DISPONIBLE ACTUAL</small><strong>${moneyMinor(m.available,currency())}</strong></div><div><small>AHORRO OBJETIVO</small><strong>${m.income?moneyMinor(savingsTarget,currency()):'—'}</strong></div><div><small>DEUDA / ACTIVOS</small><strong>${pos.assets?debtRatio+'%':'—'}</strong></div></div><div class="decisionHero"><div class="decisionHeroHead"><div><span class="eyebrow">ELIGE UNA DECISIÓN</span><h3>¿Qué estás pensando hacer?</h3></div><span class="decisionBadge">Simulación segura</span></div><div class="moduleGrid decisionOptions"><button class="moduleCard personalDecision" data-personal-decision="expenses"><span>↘</span><b>Reducir gastos</b><small>Estima cuánto espacio podrías recuperar este mes.</small><i>→</i></button><button class="moduleCard personalDecision" data-personal-decision="save"><span>◇</span><b>Ahorrar más</b><small>Compara tu ahorro actual con un objetivo sostenible.</small><i>→</i></button><button class="moduleCard personalDecision" data-personal-decision="debt"><span>□</span><b>Salir de deudas</b><small>Revisa cuánto debes y cómo priorizar pagos sin asfixiar tu caja.</small><i>→</i></button><button class="moduleCard personalDecision" data-personal-decision="invest"><span>◎</span><b>Invertir</b><small>Comprueba primero liquidez, deuda y compromisos próximos.</small><i>→</i></button></div></div><div class="card decisionSummary featuredDecision"><div class="decisionSummaryIcon">✦</div><div><span class="eyebrow">LECTURA ACTUAL</span><h2>${expenseCut?`Reducir 12% de tus gastos liberaría aproximadamente ${moneyMinor(expenseCut,currency())}`:'Registra gastos para que FINORVE construya una recomendación concreta'}</h2><p>Es una orientación basada en tus registros actuales. No modifica tus datos ni representa una predicción.</p></div></div>`}
function decisions(){if(state.mode==='personal')return personalDecisions();const m=businessMonth(businessEngineData(),monthKey());const margin=m.sales?Math.round(m.operatingResult*100/m.sales):0;return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · MOTOR DE DECISIONES</span><h2>Decisiones</h2><p>Prueba escenarios con tus datos antes de llevar un cambio al negocio real.</p></div><button class="info" data-info="decisions">i</button></div><div class="decisionContext"><div><small>VENTAS</small><strong>${moneyMinor(m.sales,currency())}</strong></div><div><small>RESULTADO</small><strong>${moneyMinor(m.operatingResult,currency())}</strong></div><div><small>MARGEN</small><strong>${m.sales?margin+'%':'—'}</strong></div></div><div class="decisionHero"><div class="decisionHeroHead"><div><span class="eyebrow">ELIGE UN ESCENARIO</span><h3>¿Qué estás pensando cambiar?</h3></div><span class="decisionBadge">No altera tus datos</span></div><div class="moduleGrid decisionOptions"><div class="moduleCard decision" data-sim="price"><span>↗</span><b>Subir precios</b><small>Observa el efecto potencial sobre margen, resultado y equilibrio.</small><i>→</i></div><div class="moduleCard decision" data-sim="hire"><span>＋</span><b>Contratar</b><small>Mide cuánto cambia tu estructura con un nuevo costo fijo.</small><i>→</i></div><div class="moduleCard decision" data-sim="sales"><span>◎</span><b>Caída en ventas</b><small>Comprueba cómo respondería tu negocio ante un escenario de -10%.</small><i>→</i></div></div></div><div class="card decisionSummary featuredDecision"><div class="decisionSummaryIcon">▣</div><div><span class="eyebrow">LECTURA ACTUAL</span><div class="metricRow"><span>Ventas</span><b>${moneyMinor(m.sales,currency())}</b></div><div class="metricRow"><span>Resultado</span><b>${moneyMinor(m.operatingResult,currency())}</b></div><div class="metricRow"><span>Flujo de caja</span><b>${moneyMinor(m.cashFlow,currency())}</b></div><p>Los escenarios son orientativos y nunca modifican tus registros reales.</p></div></div>`}
function breakEven(){const m=businessMonth(businessEngineData(),monthKey()),be=businessBreakEvenSummary(m);const margin=be.contributionMarginBp==null?null:(be.contributionMarginBp/100).toFixed(1);const above=be.currentSalesDeltaMinor!=null&&be.currentSalesDeltaMinor>=0;return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · NEGOCIO</span><h2>Punto de equilibrio</h2><p>Entiende cuánto necesitas vender para cubrir la estructura actual de tu negocio.</p></div><button class="info" data-info="breakeven">i</button></div><div class="breakEvenHero"><div><span class="eyebrow">PUNTO DE EQUILIBRIO MENSUAL</span><h2>${be.possible?moneyMinor(be.revenueMinor,currency()):'—'}</h2><p>${be.possible?'Calculado con tus ventas, costos variables y gastos registrados del mes.':'Necesitamos ventas y un margen de contribución positivo para calcularlo.'}</p></div><div class="breakEvenStatus"><small>POSICIÓN ACTUAL</small><strong>${be.currentSalesDeltaMinor==null?'—':(above?'+':'')+moneyMinor(be.currentSalesDeltaMinor,currency())}</strong><span>${be.currentSalesDeltaMinor==null?'Sin datos suficientes':above?'sobre el equilibrio':'por debajo del equilibrio'}</span></div></div><div class="insightGrid"><div class="card insightCard"><span class="eyebrow">LECTURA RÁPIDA</span><h3>${be.possible?(above?'Tus ventas están por encima del mínimo operativo':'Tus ventas aún no cubren la estructura actual'):'Todavía no podemos calcular una lectura fiable'}</h3><p>${be.possible?`Margen de contribución aproximado: ${margin}%. Costos fijos considerados: ${moneyMinor(be.fixedCostsMinor,currency())}.`:'Registra ventas y costos variables reales para obtener un punto de equilibrio útil.'}</p></div><div class="card focus insightCard"><span class="focusTag">¿QUÉ PASA SI...?</span><h3>Prueba antes de cambiar</h3><p>Contratar, subir alquileres o modificar precios puede mover tu punto de equilibrio. Simúlalo antes de decidir.</p><button class="primary" data-section="decisions">Abrir simulador →</button></div></div>`}
function profileLegacy(){return `<div class="sectionHead"><div><h2>Mi perfil</h2><p>Tu identidad y preferencias financieras.</p></div></div><div class="grid"><div class="card"><div class="profileCard"><div class="profilePhoto">AZ</div><div><h2 style="margin:0">Alejandro Zambrano</h2><p class="sub">Cuenta principal</p><button class="ghost" style="margin-top:10px">Cambiar foto</button></div></div></div><div class="card"><div class="formGrid"><div class="field"><label>Nombre</label><input value="Alejandro Zambrano"></div><div class="field"><label>Correo</label><input value="usuario@ejemplo.com"></div><div class="field"><label>País</label><select><option>Ecuador</option><option>España</option></select></div><div class="field"><label>Moneda personal</label><select><option>USD — Dólar</option><option>EUR — Euro</option></select></div></div></div></div>`}
function settingsLegacy(){return `<div class="sectionHead"><div><h2>Ajustes</h2><p>Personaliza la experiencia y controla los datos de prueba.</p></div></div><div class="grid"><div class="card"><h3>Apariencia</h3><div class="settingsRow"><div><b>Modo de color</b><small>Claro, oscuro o según tu dispositivo.</small></div><button class="ghost" id="settingTheme">${state.theme==='dark'?'Oscuro':'Claro'}</button></div><div class="settingsRow"><div><b>Recorrido inicial</b><small>Puedes volver a ver el tutorial cuando quieras.</small></div><button class="ghost" id="restartTour">Ver recorrido</button></div></div><div class="card"><h3>Datos de demostración</h3><div class="settingsRow"><div><b>Personal</b><small>12 meses de datos de ejemplo certificados.</small></div><button class="ghost">Cargar / eliminar</button></div><div class="settingsRow"><div><b>Negocio</b><small>24 meses para explorar resultados y decisiones.</small></div><button class="ghost">Cargar / eliminar</button></div><p class="sub" style="margin-top:14px">Los datos demo se identifican por separado y nunca deben borrar datos reales.</p></div></div>`}
function render(){renderNav();$$('.modeBtn').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));const name=(profileData.name||'').split(' ')[0]||'Usuario';$('#pageTitle').textContent=state.section==='home'?(state.mode==='personal'?`Hola, ${name}`:'Mi negocio'):titles[state.section]||'FINORVE';const content=$('#content');content.classList.remove('viewEntering');content.innerHTML=membershipBanner(membershipLicense)+(state.section==='home'?home():generic());requestAnimationFrame(()=>content.classList.add('viewEntering'));bindNav();bindExtras()}
function bindExtrasLegacy(){$$('[data-info]').forEach(b=>b.onclick=()=>showInfo(b.dataset.info));$$('[data-sim]').forEach(b=>b.onclick=()=>showSim(b.dataset.sim));$$('[data-personal-decision]').forEach(b=>b.onclick=()=>showPersonalDecision(b.dataset.personalDecision));$('#restartTour')?.addEventListener('click',()=>startTour(true));$('#settingTheme')?.addEventListener('click',toggleTheme)}
function showInfo(type){const texts={breakeven:['¿Qué es el punto de equilibrio?','Es el nivel de ventas necesario para cubrir costes y gastos. Por encima de ese nivel empiezas a generar resultado positivo. Si cambian tus precios, costes o gastos, también cambia el punto de equilibrio.'],decisions:['Decide con tus propios datos','El simulador modifica supuestos, no tus registros reales. Así puedes observar el posible impacto sobre resultado, caja, margen y punto de equilibrio antes de ejecutar una decisión.'],available:['¿Qué significa disponible?','Es lo que queda después de ingresos, gastos, ahorro planificado y pagos de deuda del período.'],focus:['¿Por qué esta recomendación?','El sistema detectó que los gastos variables aumentaron respecto al mes anterior mientras tu objetivo de ahorro se mantiene.'],cash:['Caja del negocio','Representa el dinero disponible. No es lo mismo que beneficio: una venta puede existir aunque todavía no haya sido cobrada.'],generic:['¿Cómo interpretar esta sección?','Cada indicador tiene una función financiera específica. Pulsa los iconos de información para aprender justo cuando lo necesitas.']};openModal(...(texts[type]||texts.generic))}
function showPersonalDecision(type){const m=personalMonth(personalEngineData(),monthKey()),p=personalPosition(personalEngineData(),monthEndKey());const expenseCut=Math.round(m.expense*.12);const savingsTarget=Math.round(m.income*.2);const texts={expenses:['Reducir mis gastos',m.expense?`Si reduces 12% de tus gastos actuales, liberarías aproximadamente <b>${moneyMinor(expenseCut,currency())}</b> este mes.`:'Registra tus gastos para estimar cuánto podrías liberar.'],save:['Ahorrar más',m.income?`Un objetivo del 20% de tus ingresos sería <b>${moneyMinor(savingsTarget,currency())}</b> al mes. Compáralo con tu ahorro actual antes de comprometerte.`:'Registra ingresos para calcular un objetivo de ahorro.'],debt:['Salir de deudas',p.debts?`Tienes <b>${moneyMinor(p.debts,currency())}</b> de deuda registrada. Prioriza pagos sin dejar tu disponible mensual en negativo.`:'No hay deuda registrada actualmente.'],invest:['Invertir',m.available>0&&p.debts<=p.assets*.35?`Tu disponible es <b>${moneyMinor(m.available,currency())}</b>. Antes de invertir, confirma fondo de emergencia y próximos pagos.`:'Antes de invertir, fortalece liquidez y revisa deuda registrada.']};openModal(texts[type][0],texts[type][1]+'<br><br>Esta orientación usa tus registros actuales y no constituye una predicción.')}
function showSim(type){const m=businessMonth(businessEngineData(),monthKey());const units=100;const base={units,unitPriceMinor:m.sales?Math.max(1,Math.round(m.sales/units)):1,unitVariableCostMinor:m.variableCosts?Math.max(0,Math.round(m.variableCosts/units)):0,fixedCostsMinor:m.operatingExpenses+m.debtInterest,openingCashMinor:0};const changes={hire:{fixedCostDeltaMinor:80000},price:{pricePctBp:1000},sales:{unitsPctBp:-1000}};const after=simulateBusiness(base,changes[type]);const title={hire:'Simulación: contratar por 800/mes',price:'Simulación: subir precios 10%',sales:'Simulación: ventas -10%'}[type];openModal(title,`Situación actual aproximada: <b>${moneyMinor(base.units*base.unitPriceMinor-base.units*base.unitVariableCostMinor-base.fixedCostsMinor,currency())}</b> de resultado.<br>Escenario simulado: <b>${moneyMinor(after.result,currency())}</b>.<br>Punto de equilibrio simulado: <b>${after.breakEven.units??'No alcanzable'} unidades de referencia</b>.<br><br>La simulación no modifica tus registros reales y muestra un escenario, no una predicción.`)}
function closeModal(){const wrap=$('#modalWrap');if(!wrap?.classList.contains('hidden'))wrap.classList.add('hidden')}
function openModal(title,body){$('#modal').setAttribute('role','dialog');$('#modal').setAttribute('aria-modal','true');$('#modal').innerHTML=`<button class="ghost modalClose" aria-label="Cerrar">×</button><h2>${title}</h2><p style="line-height:1.65;color:var(--muted)">${body}</p><button class="primary modalDone">Entendido</button>`;$('#modalWrap').classList.remove('hidden');$('.modalClose').onclick=$('.modalDone').onclick=closeModal;requestAnimationFrame(()=>$('.modalDone')?.focus())}
const themeLabels={light:'Claro',dark:'Oscuro',system:'Sistema'};
async function cycleTheme(){const order=['light','dark','system'],previousTheme=state.theme,nextTheme=order[(order.indexOf(state.theme)+1)%order.length];state.theme=nextTheme;localStorage.setItem('feo-theme',nextTheme);applyTheme();render();try{profileData=await commitProfile(profileData,{theme:nextTheme},cloud.saveProfile)}catch(e){state.theme=previousTheme;localStorage.setItem('feo-theme',previousTheme);applyTheme();render();showCloudError(e)}}
function setSound(enabled){state.sound=!!enabled;localStorage.setItem('feo-sound',state.sound?'on':'off')}
function playModeSwitchSound(nextMode){if(!state.sound)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=new AC(),osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;osc.type='sine';const start=nextMode==='business'?430:540,end=nextMode==='business'?560:430;osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+.11);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.045,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.14);osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.15);osc.onended=()=>ctx.close().catch(()=>{})}catch{}}
$$('.modeBtn').forEach(b=>b.onclick=()=>{const next=b.dataset.mode;if(next!==state.mode)playModeSwitchSound(next);navigateApp({mode:next,section:'home'})});$('#themeBtn').onclick=cycleTheme;$('#modalWrap').onclick=e=>{if(e.target.id==='modalWrap')closeModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
const tourByMode={personal:[['Tu punto de partida','Aquí ves tu situación financiera y la acción más importante ahora.'],['Registra tus movimientos','En Movimientos agrega ingresos, gastos, ahorro y deuda.'],['Recibe recomendaciones','Decisiones te muestra qué podrías hacer según tus propios registros.'],['Define y sigue tu plan','En Plan reúnes metas, deudas, patrimonio y diagnóstico.']],business:[['Vista principal de tu negocio','Aquí ves salud del negocio, resultado, caja y la recomendación principal.'],['Registra ventas y caja','En Movimientos mantén separadas ventas, costos, cobros y pagos.'],['Conoce tu punto de equilibrio','En Plan sabrás cuánto necesitas vender para cubrir tu estructura.'],['Prueba antes de decidir','Decisiones simula escenarios sin modificar los datos reales.']]};let tourIndex=0;
function startTour(force=false){if(!force&&profileData.tutorialCompleted)return;tourIndex=0;$('#tour').classList.remove('hidden');paintTour()}
function paintTour(){const steps=tourByMode[state.mode], [h,p]=steps[tourIndex];$('#tourStep').innerHTML=`<span class="focusTag">${tourIndex+1} / ${steps.length}</span><h2>${h}</h2><p>${p}</p>`;$('#tourPrev').style.visibility=tourIndex?'visible':'hidden';$('#tourNext').textContent=tourIndex===steps.length-1?'Entendido':'Siguiente'}
async function finishTour(){try{profileData=await commitProfile(profileData,{tutorialCompleted:true},cloud.saveProfile);$('#tour').classList.add('hidden')}catch(e){showCloudError(e)}}
$('#tourNext').onclick=()=>{const steps=tourByMode[state.mode];if(tourIndex===steps.length-1)finishTour();else{tourIndex++;paintTour()}};$('#tourPrev').onclick=()=>{tourIndex=Math.max(0,tourIndex-1);paintTour()};$('#tourSkip').onclick=finishTour;

// V4 functional layer
const PROFILE_DEFAULT={name:'Usuario',email:'',country:'Ecuador',personalCurrency:'USD',businessCurrency:'USD',photo:'',tutorialCompleted:false,theme:'system'};
const sectionType={income:'income',expenses:'expense',debts:'debt',savings:'saving',goals:'goal',assets:'asset',sales:'sale',costs:'cost'};
const entitySections=new Set(['debts','assets','goals']);
const entityLabel={debts:'saldo',assets:'valor',goals:'objetivo'};
const seed={personal:{income:[['Salario',3000],['Freelance',1200],['Ingresos extra',650]],expense:[['Vivienda',850],['Alimentación',620],['Transporte',240]],debt:[['Tarjeta principal',2200]],saving:[['Fondo emergencia',650]],goal:[['Viaje',3000]],asset:[['Cuenta ahorro',8400]]},business:{sale:[['Ventas online',7200],['Servicios',5300]],cost:[['Coste producto',4300]],expense:[['Alquiler',1200],['Marketing',900],['Software',250]]}};
let records={personal:{},business:{}};
let profileData={...PROFILE_DEFAULT};
let adminMode=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SYNC_BACKUP='finorve-pending-sync';
let syncOwner=null;
const pendingKey=owner=>owner?SYNC_BACKUP+':'+owner:null;
const ownsSnapshot=snapshot=>!!snapshot?.userId&&snapshot.userId===syncOwner&&snapshot.userId===cloud.session()?.user?.id;
let syncTimer=null,syncPromise=Promise.resolve(),syncPending=false,syncRetryTimer=null;
function syncSnapshot(){return ensureSyncId({userId:syncOwner,records:JSON.parse(JSON.stringify(records)),profile:{...profileData}})}
function showSyncState(kind,text){
  document.querySelectorAll('.syncError,.syncStatus').forEach(x=>x.remove());
  const c=$('#content');if(!c)return;
  c.insertAdjacentHTML('afterbegin',`<div class="${kind==='error'?'syncError':'syncStatus'}">${text}</div>`);
}
function persistPending(snapshot){try{const normalized=ensureSyncId(snapshot);if(!normalized.userId)return normalized;localStorage.setItem(pendingKey(normalized.userId),JSON.stringify(normalized));return normalized}catch{return ensureSyncId(snapshot)}}
function clearPending(snapshot){try{const pending=readPending();if(samePendingSnapshot(pending,snapshot)){localStorage.removeItem(pendingKey(snapshot.userId));return true}}catch{}return false}
function readPending(){try{if(!syncOwner||cloud.session()?.user?.id!==syncOwner)return null;const raw=JSON.parse(localStorage.getItem(pendingKey(syncOwner))||'null');if(!raw||raw.userId!==syncOwner)return null;return ensureSyncId(raw)}catch{return null}}
async function flushRecords(snapshot=syncSnapshot()){
  if(!ownsSnapshot(snapshot))return false;
  snapshot=persistPending(snapshot);syncPending=true;
  try{
    await cloud.syncRecords(snapshot.records,snapshot.profile,snapshot.userId);
    const cleared=clearPending(snapshot);
    syncPending=!!readPending();
    clearTimeout(syncRetryTimer);
    if(cleared&&!syncPending)document.querySelectorAll('.syncError,.syncStatus').forEach(x=>x.remove());
    return true;
  }catch(e){
    syncPending=true;showCloudError(e);
    clearTimeout(syncRetryTimer);
    if(navigator.onLine&&ownsSnapshot(snapshot))syncRetryTimer=setTimeout(()=>queueSync(readPending()||snapshot,0),3000);
    return false;
  }
}
function queueSync(snapshot=syncSnapshot(),delay=180){
  if(!ownsSnapshot(snapshot))return;
  snapshot=persistPending(snapshot);clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{syncPromise=syncPromise.then(()=>flushRecords(snapshot))},delay);
}
const saveRecords=()=>queueSync(syncSnapshot(),180);
function showCloudError(e){console.error(e);showSyncState('error',navigator.onLine?'No pudimos guardar todavía. FINORVE conservará los cambios y reintentará automáticamente.':'Sin conexión. Tus cambios quedan pendientes y se guardarán al volver a estar en línea.')}
window.addEventListener('online',()=>{const pending=readPending();if(pending)queueSync(pending,50)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const pending=readPending();if(pending)queueSync(pending,50)}});
window.addEventListener('pagehide',()=>{const pending=syncPending?readPending():null;if(pending)persistPending(pending)});
const bucket=()=>records[state.mode]||(records[state.mode]={});
function listFor(type){return bucket()[type]||(bucket()[type]=[])}
function currency(){return state.mode==='personal'?profileData.personalCurrency:profileData.businessCurrency}
function recordView(){const type=sectionType[state.section];const t=titles[state.section];const list=listFor(type);const entity=entitySections.has(state.section);const total=list.reduce((a,x)=>a+(Number.isSafeInteger(x.amountMinor)?x.amountMinor:Math.round(Number(x.amount||0)*100)),0);const totalLabel=state.section==='debts'?'SALDO TOTAL':state.section==='assets'?'VALOR TOTAL':state.section==='goals'?'OBJETIVO TOTAL':'TOTAL REGISTRADO';return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · ${state.mode==='personal'?'PERSONAL':'NEGOCIO'}</span><h2>${t}</h2><p>${entity?'Añade cada elemento una sola vez y actualiza su valor cuando cambie.':state.mode==='personal'?'Registra tus datos reales. FINORVE actualizará tu panorama automáticamente.':'Registra datos reales del negocio y mantenlos separados de cualquier simulación.'}</p></div><button class="primary" id="newRecord">＋ ${entity?'Nuevo':'Añadir'}</button></div><div class="recordSummary"><div><small>${totalLabel}</small><strong>${moneyMinor(total,currency())}</strong></div><div><small>${entity?'ELEMENTOS':'MOVIMIENTOS'}</small><strong>${list.length}</strong></div><div><small>TIPO</small><strong>${state.mode==='personal'?'Personal':'Negocio'}</strong></div></div><div class="card recordListCard"><div class="recordListHead"><div><span class="eyebrow">${entity?'POSICIÓN ACTUAL':'HISTORIAL'}</span><h3>${t}</h3></div><small>${list.length?(entity?'Actualiza sin duplicar':'Últimos registros'):'Sin registros todavía'}</small></div><div class="list">${list.length?list.map((x,i)=>`<div class="row recordRow"><div class="ico">${state.mode==='personal'?'○':'▣'}</div><div><b>${esc(x.name)}</b><small>${x.date||localDateKey()} · ${x.demo?'Demostración':'Real'}${entity?' · '+(entityLabel[state.section]||'valor')+' actual':''}</small></div><div class="amount">${moneyMinor(Number.isSafeInteger(x.amountMinor)?x.amountMinor:Math.round(Number(x.amount||0)*100),currency())} <button class="ghost editRecord" data-i="${i}">Editar</button><button class="ghost deleteRecord" data-i="${i}" aria-label="Eliminar">×</button></div></div>`).join(''):`<div class="emptyState"><span>＋</span><h3>Aún no hay registros</h3><p>${entity?'Crea el primero. Después podrás actualizar su valor sin añadir duplicados.':'Añade el primero para que FINORVE empiece a construir tu panorama.'}</p><button class="primary" id="newRecordEmpty">Añadir primer registro</button></div>`}</div></div>`}
function generic(){if(state.section==='movements')return movementsView();if(state.section==='plan')return planView();if(state.section==='decisions')return decisions();if(state.section==='more')return moreView();if(state.section==='profile')return profile();if(state.section==='settings')return settings();if(state.section==='breakEven')return breakEven();if(state.section==='cashflow')return cashflowView();if(state.section==='results')return resultsView();if(state.section==='diagnostic')return diagnosticView();if(sectionType[state.section])return recordView();return moreView()}
function cashflowView(){const b=records.business||{};const rows=[...(b.collection||[]).map((x,i)=>({...x,_type:'collection',_i:i,_label:'Cobro'})),...(b.cashPayment||[]).map((x,i)=>({...x,_type:'cashPayment',_i:i,_label:'Pago'})),...(b.debtPrincipal||[]).map((x,i)=>({...x,_type:'debtPrincipal',_i:i,_label:'Capital deuda'})),...(b.debtInterest||[]).map((x,i)=>({...x,_type:'debtInterest',_i:i,_label:'Interés deuda'}))].sort((a,b)=>(b.date||'').localeCompare(a.date||''));const totalIn=(b.collection||[]).reduce((a,x)=>a+asMinor(x),0),totalOut=['cashPayment','debtPrincipal','debtInterest'].reduce((sum,type)=>sum+(b[type]||[]).reduce((a,x)=>a+asMinor(x),0),0);return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · CAJA</span><h2>Flujo de caja</h2><p>Separa el dinero realmente cobrado y pagado de ventas, costos y gastos registrados.</p></div><div class="cashActions"><button class="primary cashAdd" data-cash="collection">＋ Cobro</button><button class="ghost cashAdd" data-cash="cashPayment">− Pago</button></div></div><div class="cashSummary"><div><small>COBRADO</small><strong>+${moneyMinor(totalIn,currency())}</strong></div><div><small>PAGADO</small><strong>−${moneyMinor(totalOut,currency())}</strong></div><div><small>FLUJO NETO</small><strong>${moneyMinor(totalIn-totalOut,currency())}</strong></div></div><div class="card recordListCard"><div class="recordListHead"><div><span class="eyebrow">MOVIMIENTOS DE CAJA</span><h3>Cobros y pagos</h3></div><small>${rows.length} registros</small></div><div class="list">${rows.length?rows.map(x=>`<div class="row recordRow"><div class="ico">${x._label==='Cobro'?'＋':'−'}</div><div><b>${esc(x.name)}</b><small>${x.date} · ${x._label} · ${x.demo?'Demostración':'Real'}</small></div><div class="amount">${x._label==='Cobro'?'+':'−'}${moneyMinor(asMinor(x),currency())} <button class="ghost deleteCash" data-type="${x._type}" data-i="${x._i}" aria-label="Eliminar">×</button></div></div>`).join(''):'<div class="emptyState"><span>↕</span><h3>Aún no hay movimientos de caja</h3><p>Registra un cobro o un pago para que FINORVE calcule tu flujo neto.</p></div>'}</div></div>`}
function resultsView(){const m=businessMonth(businessEngineData(),monthKey());const margin=m.sales?Math.round(m.operatingResult*100/m.sales):0;return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · NEGOCIO</span><h2>Resultado</h2><p>Mide el resultado económico del mes sin confundirlo con el efectivo disponible.</p></div></div><div class="resultHero"><div><span class="eyebrow">RESULTADO OPERATIVO</span><h2>${moneyMinor(m.operatingResult,currency())}</h2><p>${m.operatingResult>=0?'El negocio registra resultado positivo en el período.':'El período registra resultado negativo; revisa costos y gastos antes de asumir más estructura.'}</p></div><div class="resultMargin"><small>MARGEN</small><strong>${m.sales?margin+'%':'—'}</strong></div></div><div class="resultGrid"><div><small>VENTAS</small><strong>${moneyMinor(m.sales,currency())}</strong></div><div><small>COSTOS VARIABLES</small><strong>${moneyMinor(m.variableCosts,currency())}</strong></div><div><small>GASTOS OPERATIVOS</small><strong>${moneyMinor(m.operatingExpenses,currency())}</strong></div></div><div class="card resultNote"><span class="eyebrow">IMPORTANTE</span><h3>Resultado no significa caja</h3><p>Una venta puede existir antes de ser cobrada. Usa Flujo de caja para saber cuánto dinero realmente entró o salió.</p><button class="ghost" data-section="cashflow">Ver flujo de caja →</button></div>`}
function diagnosticView(){const m=personalMonth(personalEngineData(),monthKey()),p=personalPosition(personalEngineData(),monthEndKey());const savingsRate=m.savingsRateBp==null?null:(m.savingsRateBp/100).toFixed(1);const liquidityState=m.available>=0?'Estable':'Atención';const wealthState=p.netWorth>=0?'Positivo':'Negativo';return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · DIAGNÓSTICO</span><h2>Diagnóstico financiero</h2><p>Una lectura breve de tu situación actual para saber dónde concentrarte primero.</p></div></div><div class="diagnosticLead"><div class="diagnosticScore"><span class="eyebrow">TU LECTURA DEL MES</span><h3>${m.available>=0?'Tienes margen para decidir':'Tu prioridad es recuperar liquidez'}</h3><p>${m.available>=0?'Tus registros muestran un disponible positivo después de los compromisos del período.':'Las salidas registradas están superando lo que entra; conviene revisar gastos y compromisos antes de asumir algo nuevo.'}</p><button class="primary" data-section="decisions">Ver decisiones →</button></div><div class="diagnosticMetrics"><div><small>LIQUIDEZ</small><strong>${moneyMinor(m.available,currency())}</strong><em>${liquidityState}</em></div><div><small>PATRIMONIO</small><strong>${moneyMinor(p.netWorth,currency())}</strong><em>${wealthState}</em></div><div><small>TASA DE AHORRO</small><strong>${savingsRate==null?'—':savingsRate+'%'}</strong><em>${savingsRate==null?'Sin datos':Number(savingsRate)>=20?'Buena base':'Por debajo de 20%'}</em></div></div></div><div class="diagnosticGrid"><div class="card diagnosticCard"><span class="eyebrow">QUÉ ESTÁ BIEN</span><h3>${m.available>=0?'Tu disponible sigue siendo positivo':'Ya tienes una foto real de tus salidas'}</h3><p>${m.available>=0?'Eso te da espacio para priorizar ahorro, deuda o inversión con más contexto.':'Identificar el desbalance es el primer paso para corregirlo antes de asumir nuevos compromisos.'}</p></div><div class="card diagnosticCard"><span class="eyebrow">QUÉ REVISAR</span><h3>${p.debts>p.assets*.35?'El peso de la deuda sobre tus activos':'La relación entre ahorro y gasto'}</h3><p>${p.debts>p.assets*.35?'Tu deuda registrada representa una parte relevante de tus activos. Revisa prioridades de pago antes de aumentar riesgo.':'Comprueba si tu tasa de ahorro se acerca al objetivo que quieres sostener en el tiempo.'}</p></div></div>`}
function openCashModal(type){const isIn=type==='collection';openModalForm(isIn?'Nuevo cobro':'Nuevo pago',`<div class="formGrid"><div class="field"><label>Concepto</label><input id="rName" maxlength="80" placeholder="${isIn?'Ej. Factura cobrada':'Ej. Pago proveedor'}"></div><div class="field"><label>Monto (${currency()})</label><input id="rAmount" inputmode="decimal" placeholder="0.00"></div><div class="field"><label>Fecha</label><input id="rDate" type="date" value="${localDateKey()}"></div></div>`,()=>{const name=$('#rName').value.trim(),amountMinor=toMinor($('#rAmount').value),date=$('#rDate').value;clearModalError();if(name.length<2)return modalError('Escribe un concepto de al menos 2 caracteres.','#rName');if(amountMinor===null||amountMinor<=0)return modalError('Escribe un monto válido mayor que 0.','#rAmount');if(!date)return modalError('Selecciona una fecha.','#rDate');const b=records.business||(records.business={});(b[type]||(b[type]=[])).push({name,amountMinor,currency:currency(),date,demo:false});saveRecords();$('#modalWrap').classList.add('hidden');render()})}
function profile(){const initials=profileData.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · CUENTA</span><h2>Mi perfil</h2><p>Gestiona tu identidad y las preferencias financieras que FINORVE usa en Personal y Negocio.</p></div><button class="primary" id="saveProfile">Guardar cambios</button></div><div class="profileLayout"><div class="card profileIdentity"><div class="profileCard"><div class="profilePhoto" id="photoPreview" style="${profileData.photoUrl?`background-image:url(${profileData.photoUrl});background-size:cover;background-position:center;font-size:0`:''}">${initials}</div><div><span class="eyebrow">CUENTA PRINCIPAL</span><h2>${profileData.name}</h2><p class="sub">${profileData.email||'Correo asociado a tu cuenta'}</p><button class="ghost" id="changePhoto">Cambiar foto</button><input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp" hidden></div></div><div class="profileMeta"><div><small>PAÍS</small><b>${profileData.country}</b></div><div><small>MONEDA PERSONAL</small><b>${profileData.personalCurrency}</b></div><div><small>MONEDA NEGOCIO</small><b>${profileData.businessCurrency}</b></div></div></div><div class="card profileFormCard"><div class="cardHead"><div><span class="eyebrow">PREFERENCIAS</span><h3>Datos de tu cuenta</h3></div></div><div class="formGrid"><div class="field"><label>Nombre</label><input id="pfName" value="${profileData.name}"></div><div class="field"><label>Correo</label><input id="pfEmail" value="${profileData.email}" disabled></div><div class="field"><label>País</label><select id="pfCountry">${['Ecuador','España','Estados Unidos','Colombia','México'].map(x=>`<option ${x===profileData.country?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Moneda personal</label><select id="pfPCurrency">${['USD','EUR','GBP','MXN','COP'].map(x=>`<option ${x===profileData.personalCurrency?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Moneda negocio</label><select id="pfBCurrency">${['USD','EUR','GBP','MXN','COP'].map(x=>`<option ${x===profileData.businessCurrency?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="profileNote">FINORVE mantiene Personal y Negocio separados; cambiar una moneda no mezcla tus registros.</div></div></div>${membershipCard(membershipLicense)}`}
function demoActive(mode){return Object.values(records[mode]||{}).some(a=>(a||[]).some(x=>x.demo))}
function settings(){return `<div class="sectionHead"><div><span class="eyebrow">FINORVE · CONFIGURACIÓN</span><h2>Ajustes</h2><p>Controla apariencia, seguridad y datos sin afectar tus registros financieros.</p></div></div><div class="settingsGrid"><div class="card settingsCard"><div class="settingsTitle"><span class="settingsIcon">◐</span><div><span class="eyebrow">EXPERIENCIA</span><h3>Apariencia y sonido</h3></div></div><div class="settingsRow"><div><b>Modo de color</b><small>Claro, oscuro o según tu dispositivo.</small></div><button class="ghost" id="settingTheme">${themeLabels[state.theme]||'Sistema'}</button></div><div class="settingsRow"><div><b>Sonido al cambiar de espacio</b><small>Un tono breve al pasar entre Personal y Negocio.</small></div><button class="ghost" id="settingSound">${state.sound?'Activado':'Silenciado'}</button></div><div class="settingsRow"><div><b>Recorrido inicial</b><small>Vuelve a ver la guía de FINORVE cuando quieras.</small></div><button class="ghost" id="restartTour">Ver recorrido</button></div></div><div class="card settingsCard"><div class="settingsTitle"><span class="settingsIcon">⌁</span><div><span class="eyebrow">CUENTA</span><h3>Seguridad y datos</h3></div></div><div class="settingsRow"><div><b>Cambiar contraseña</b><small>Actualiza tu acceso. Mínimo 8 caracteres.</small></div><button class="ghost" id="changePassword">Cambiar</button></div><div class="settingsRow"><div><b>Exportar mis datos</b><small>Descarga una copia JSON de tu información y registros.</small></div><button class="ghost" id="exportData">Exportar</button></div><div class="settingsRow dangerRow"><div><b>Eliminar cuenta</b><small>Elimina permanentemente la cuenta y sus datos asociados.</small></div><button class="ghost dangerButton" id="deleteAccount">Eliminar</button></div></div><div class="card settingsCard demoCard"><div class="settingsTitle"><span class="settingsIcon">◇</span><div><span class="eyebrow">EXPLORACIÓN</span><h3>Datos de demostración</h3></div></div><p class="settingsIntro">Úsalos para explorar FINORVE sin tocar tus datos reales. Se identifican por separado.</p>${['personal','business'].map(m=>`<div class="settingsRow"><div><b>${m==='personal'?'Personal':'Negocio'}</b><small>${m==='personal'?'12 meses':'24 meses'} de ejemplo para probar la experiencia.</small></div><button class="ghost demoToggle" data-demo="${m}">${demoActive(m)?'Eliminar demo':'Cargar demo'}</button></div>`).join('')}</div></div>`}
function openRecordModal(index=null){const type=sectionType[state.section],list=listFor(type),editing=Number.isInteger(index),current=editing?list[index]:null,entity=entitySections.has(state.section),valueLabel=state.section==='debts'?'Saldo actual':state.section==='assets'?'Valor actual':state.section==='goals'?'Objetivo':'Monto';openModalForm(`${editing?'Actualizar':'Nuevo'} ${titles[state.section].toLowerCase()}`,`<div class="formGrid"><div class="field"><label>Nombre / concepto</label><input id="rName" maxlength="80" placeholder="Ej. ${state.section==='debts'?'Tarjeta principal':state.section==='assets'?'Cuenta de ahorro':state.section==='goals'?'Fondo de emergencia':'Salario'}" value="${current?esc(current.name):''}"></div><div class="field"><label>${valueLabel} (${currency()})</label><input id="rAmount" inputmode="decimal" placeholder="0.00" value="${current?(asMinor(current)/100).toFixed(2):''}"></div><div class="field"><label>Fecha</label><input id="rDate" type="date" value="${current?.date||localDateKey()}"></div></div>`,()=>{const name=$('#rName').value.trim(),amountMinor=toMinor($('#rAmount').value),date=$('#rDate').value;clearModalError();if(name.length<2)return modalError('Escribe un concepto de al menos 2 caracteres.','#rName');if(amountMinor===null||amountMinor<=0)return modalError('Escribe un monto válido mayor que 0.','#rAmount');if(!date)return modalError('Selecciona una fecha.','#rDate');const base={name,amountMinor,currency:currency(),date,demo:false,entityType:type};if(editing){list[index]={...list[index],...base,entityId:list[index].entityId||list[index].id||crypto.randomUUID()}}else{list.push({...base,...(entity?{entityId:crypto.randomUUID()}:{})})}saveRecords();$('#modalWrap').classList.add('hidden');render()})}
function clearModalError(){const msg=$('.modalMsg');msg?.classList.add('hidden');document.querySelectorAll('#modal .fieldError').forEach(x=>x.classList.remove('fieldError'))}
function modalError(message,selector){const msg=$('.modalMsg');if(msg){msg.textContent=message;msg.classList.remove('hidden')}const el=$(selector);el?.classList.add('fieldError');el?.focus();return false}
function openModalForm(title,body,onSave){$('#modal').setAttribute('role','dialog');$('#modal').setAttribute('aria-modal','true');$('#modal').innerHTML=`<button class="ghost modalClose" aria-label="Cerrar">×</button><h2>${title}</h2>${body}<div class="modalMsg hidden" role="alert"></div><div class="modalActions"><button class="ghost modalCancel">Cancelar</button><button class="primary modalSave">Guardar</button></div>`;$('#modalWrap').classList.remove('hidden');$('.modalClose').onclick=$('.modalCancel').onclick=closeModal;$('.modalSave').onclick=onSave;requestAnimationFrame(()=>$('#modal input,#modal select,#modal textarea,.modalSave')?.focus())}
function toggleDemo(mode){records[mode] ||= {}; if(demoActive(mode)){Object.keys(records[mode]).forEach(k=>records[mode][k]=(records[mode][k]||[]).filter(x=>!x.demo))}else{Object.entries(seed[mode]).forEach(([k,arr])=>{records[mode][k] ||= [];arr.forEach(([name,amount],i)=>records[mode][k].push({name,amountMinor:Math.round(amount*100),currency:mode==='personal'?profileData.personalCurrency:profileData.businessCurrency,date:`${monthKey()}-${String(10+i).padStart(2,'0')}`,demo:true}))})}saveRecords();render()}
function bindExtras(){$$('[data-info]').forEach(b=>b.onclick=()=>showInfo(b.dataset.info));$$('[data-sim]').forEach(b=>b.onclick=()=>showSim(b.dataset.sim));$$('[data-personal-decision]').forEach(b=>b.onclick=()=>showPersonalDecision(b.dataset.personalDecision));$('#restartTour')?.addEventListener('click',()=>startTour(true));$('#settingTheme')?.addEventListener('click',cycleTheme);$('#settingSound')?.addEventListener('click',()=>{setSound(!state.sound);render()});$('#newRecord')?.addEventListener('click',()=>openRecordModal());$('#newRecordEmpty')?.addEventListener('click',()=>openRecordModal());$$('.editRecord').forEach(b=>b.onclick=()=>openRecordModal(Number(b.dataset.i)));$$('.cashAdd').forEach(b=>b.onclick=()=>openCashModal(b.dataset.cash));$$('.deleteCash').forEach(b=>b.onclick=()=>{(records.business[b.dataset.type]||[]).splice(Number(b.dataset.i),1);saveRecords();render()});$$('.deleteRecord').forEach(b=>b.onclick=()=>{listFor(sectionType[state.section]).splice(Number(b.dataset.i),1);saveRecords();render()});$$('.demoToggle').forEach(b=>b.onclick=()=>toggleDemo(b.dataset.demo));$('#changePhoto')?.addEventListener('click',()=>$('#photoInput').click());$('#photoInput')?.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const photo=await cloud.uploadAvatar(f),photoUrl=await cloud.avatarObjectUrl(photo);profileData=await commitProfile(profileData,{photo,photoUrl},cloud.saveProfile);render()}catch(err){showCloudError(err)}});$('#saveProfile')?.addEventListener('click',async()=>{const patch={name:$('#pfName').value.trim()||profileData.name,country:$('#pfCountry').value,personalCurrency:$('#pfPCurrency').value,businessCurrency:$('#pfBCurrency').value};try{profileData=await commitProfile(profileData,patch,cloud.saveProfile);render()}catch(e){showCloudError(e)}});$('#exportData')?.addEventListener('click',async()=>{try{const data=await cloud.exportMyData();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`finorve-datos-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){alert(e.message)}});$('#changePassword')?.addEventListener('click',()=>openModalForm('Cambiar contraseña','<div class="field"><label>Nueva contraseña</label><input id="newPassword" type="password" minlength="12" autocomplete="new-password"><small>'+PASSWORD_POLICY_MESSAGE+'</small></div>',async()=>{try{await cloud.changePassword($('#newPassword').value);$('#modalWrap').classList.add('hidden');alert('Contraseña actualizada.')}catch(e){alert(e.message)}}));$('#deleteAccount')?.addEventListener('click',()=>openModalForm('Eliminar cuenta','<p>Esta acción es permanente. Escribe <b>ELIMINAR</b> para confirmar.</p><div class="field"><input id="deleteConfirm" autocomplete="off" placeholder="ELIMINAR"></div>',async()=>{if($('#deleteConfirm').value!=='ELIMINAR'){alert('Escribe ELIMINAR para confirmar.');return}try{await cloud.deleteMyAccount($('#deleteConfirm').value);location.reload()}catch(e){alert(e.message)}}))}
const onboardingCopy={personal:[['Paso 1 de 3','Construye tu base financiera','Empieza con lo esencial: cuánto entra y cuánto sale. Con esos dos datos FINORVE ya puede empezar a darte contexto.','Ingresos → Gastos'],['Paso 2 de 3','Añade lo que ya está comprometido','Registra deudas, ahorro y metas para que FINORVE distinga lo disponible de lo que ya tiene un destino.','Deudas → Ahorro → Metas'],['Paso 3 de 3','Deja que FINORVE priorice contigo','Vuelve a Inicio y revisa una sola recomendación antes de tomar otra decisión. Menos ruido, más claridad.','Inicio → Decisiones']],business:[['Paso 1 de 3','Construye la foto real de tu negocio','Registra ventas, costos y gastos para separar crecimiento de rentabilidad.','Ventas → Costos → Gastos'],['Paso 2 de 3','Distingue resultado de caja','Añade cobros y pagos reales. FINORVE separa lo vendido de lo que realmente entró o salió.','Cobros → Pagos'],['Paso 3 de 3','Decide con números, no con intuición','Revisa tu punto de equilibrio y prueba escenarios antes de ejecutar cambios importantes.','Plan → Decisiones']]};
function showOnboarding(){state.onboardingStep=0;state.onboardingChoice='personal';state.onboardingMode='personal';$('#shell').classList.add('hidden');$('#mobileNav').classList.add('hidden');$('#onboardingGate').classList.remove('hidden');paintOnboarding()}
function onboardingModes(){return state.onboardingChoice==='both'?['personal','business']:[state.onboardingChoice]}
function paintOnboarding(){const box=$('#onboardingContent'),track=$('#onboardingTrack');if(state.onboardingStep===0){track.innerHTML='<span class="active">1</span><i></i><span>2</span><i></i><span>3</span>';box.innerHTML=`<div class="onboardingCard"><span class="eyebrow">TU PRIMERA CONFIGURACIÓN</span><h1>¿Qué quieres entender primero?</h1><p>Elige el espacio que quieres ordenar ahora. Personal y Negocio funcionan por separado para que nunca mezcles tus decisiones.</p><div class="choiceGrid"><button class="choiceCard active" data-onboard-choice="personal"><span>01</span><b>Mis finanzas personales</b><small>Controla ingresos, gastos, deudas, ahorro y metas.</small></button><button class="choiceCard" data-onboard-choice="business"><span>02</span><b>Mi negocio</b><small>Entiende ventas, costos, caja, margen y punto de equilibrio.</small></button><button class="choiceCard" data-onboard-choice="both"><span>03</span><b>Quiero organizar ambos</b><small>FINORVE te guiará por cada espacio sin mezclar información.</small></button></div><button class="primary onboardingNext">Configurar FINORVE →</button><div class="onboardingTrust">Puedes cambiar entre Personal y Negocio cuando quieras.</div></div>`;$$('[data-onboard-choice]').forEach(b=>b.onclick=()=>{state.onboardingChoice=b.dataset.onboardChoice;$$('[data-onboard-choice]').forEach(x=>x.classList.toggle('active',x===b))});$('.onboardingNext').onclick=()=>{state.onboardingMode=onboardingModes()[0];state.onboardingStep=1;paintOnboarding()};return}const modes=onboardingModes(), modeIndex=modes.indexOf(state.onboardingMode), steps=onboardingCopy[state.onboardingMode], stepIndex=((state.onboardingStep-1)%3), [label,title,copy,path]=steps[stepIndex];track.innerHTML=`<span class="${stepIndex>=0?'active':''}">1</span><i class="${stepIndex>=1?'active':''}"></i><span class="${stepIndex>=1?'active':''}">2</span><i class="${stepIndex>=2?'active':''}"></i><span class="${stepIndex>=2?'active':''}">3</span>`;box.innerHTML=`<div class="onboardingCard"><div class="onboardingModeTag">${state.onboardingMode==='personal'?'Personal':'Negocio'} · ${label}</div><h1>${title}</h1><p>${copy}</p><div class="onboardingPath">${path.split(' → ').map((x,i)=>`<span>${i+1}</span><b>${x}</b>`).join('<i>→</i>')}</div><div class="onboardingActions"><button class="ghost onboardingBack">Atrás</button><button class="primary onboardingNext">${stepIndex===2&&modeIndex===modes.length-1?'Ver mi panorama →':'Siguiente →'}</button></div></div>`;$('.onboardingBack').onclick=()=>{if(stepIndex===0){state.onboardingStep=0;paintOnboarding()}else{state.onboardingStep--;paintOnboarding()}};$('.onboardingNext').onclick=async()=>{if(stepIndex<2){state.onboardingStep++;paintOnboarding();return}if(modeIndex<modes.length-1){state.onboardingMode=modes[modeIndex+1];state.onboardingStep=1;paintOnboarding();return}profileData.tutorialCompleted=false;state.mode=modes[0];localStorage.setItem('feo-mode',state.mode);$('#onboardingGate').classList.add('hidden');$('#shell').classList.remove('hidden');$('#mobileNav').classList.remove('hidden');render();setTimeout(()=>startTour(true),250)}}

// Paid checkout recovery is shared across same-origin tabs and expires locally.
const PAID_CHECKOUT_KEY='feo-paid-checkout';
function rememberPaidCheckout(email,claim,existingAccount=false){
  const previous=readPaidCheckout();
  const same=previous?.claim===claim&&previous?.email===email.toLowerCase();
  const value={email:email.toLowerCase(),claim,existingAccount:existingAccount||(same&&previous.existingAccount)||false,expiresAt:same?previous.expiresAt:Date.now()+24*60*60*1000};
  localStorage.setItem(PAID_CHECKOUT_KEY,JSON.stringify(value));
  sessionStorage.removeItem('feo-paid-claim');sessionStorage.removeItem('feo-paid-email');
  return value;
}
function clearPaidCheckout(){
  localStorage.removeItem(PAID_CHECKOUT_KEY);
  sessionStorage.removeItem('feo-paid-claim');sessionStorage.removeItem('feo-paid-email');
}
function readPaidCheckout(){
  try{
    const raw=localStorage.getItem(PAID_CHECKOUT_KEY);
    if(raw){const value=JSON.parse(raw);if(value.claim&&value.email&&Number.isFinite(value.expiresAt)&&value.expiresAt>Date.now())return value;clearPaidCheckout();return null}
    const claim=sessionStorage.getItem('feo-paid-claim'),email=sessionStorage.getItem('feo-paid-email');
    if(!claim||!email)return null;
    const value={email:email.toLowerCase(),claim,existingAccount:false,expiresAt:Date.now()+24*60*60*1000};
    localStorage.setItem(PAID_CHECKOUT_KEY,JSON.stringify(value));
    sessionStorage.removeItem('feo-paid-claim');sessionStorage.removeItem('feo-paid-email');
    return value;
  }catch{clearPaidCheckout();return null}
}
async function claimPendingPaidAccess(){
  const pending=readPaidCheckout();if(!pending)return;
  const user=await cloud.currentUser();
  if(!user?.email||user.email.toLowerCase()!==pending.email.toLowerCase())return;
  await cloud.claimPaidAccess(pending.claim);
  clearPaidCheckout();
}
// End paid checkout recovery helpers.
function hideEntryGates(){['checkoutGate','authGate','paidSignupGate','accessGate'].forEach(id=>$('#'+id)?.classList.add('hidden'))}
function showCheckout(message=''){hideEntryGates();$('#shell').classList.add('hidden');$('#mobileNav').classList.add('hidden');$('#checkoutGate').classList.remove('hidden');if(message)$('#checkoutMsg').textContent=message;void initEmbeddedPayPal()}
function showExistingLogin(message=''){hideEntryGates();showAuth();setAuthMode('signin');const pending=readPaidCheckout();if(pending){pending.existingAccount=true;localStorage.setItem(PAID_CHECKOUT_KEY,JSON.stringify(pending));$('#authEmail').value=pending.email}const msg=$('#authMsg');if(message&&msg){msg.textContent=message;msg.classList.add('authMsgInfo')}if(message)$('#authSignup')?.classList.add('hidden')}
function showRecoveryPassword(){
  hideEntryGates();showAuth();authMode='recovery';
  $('#authKicker').textContent='SEGURIDAD';
  $('#authTitle').textContent='Crea una nueva contraseña';
  $('#authCopy').textContent='Tu identidad ya fue verificada desde el enlace enviado a tu correo.';
  $('#authEmail').closest('label')?.classList.add('hidden');
  $('#authEmail').classList.add('hidden');
  $('#authPassword').setAttribute('autocomplete','new-password');
  $('#authPassword').value='';
  $('#signupConfirmWrap').classList.remove('hidden');
  $('#authPasswordConfirm').value='';
  $('#authSignin').innerHTML='Guardar nueva contraseña <span>→</span>';
  $('#authSignup').classList.add('hidden');
  $('#forgotPassword').classList.add('hidden');
  $('#authMsg').textContent='';
  $('#authPassword').focus();
}
async function submitRecoveryPassword(){
  const p=$('#authPassword').value, c=$('#authPasswordConfirm').value, msg=$('#authMsg'), btn=$('#authSignin');
  msg.textContent='';msg.classList.remove('authMsgInfo');
  if(!validatePassword(p)){msg.textContent=PASSWORD_POLICY_MESSAGE;return}
  if(p!==c){msg.textContent='Las contraseñas no coinciden.';return}
  const old=btn.textContent;btn.disabled=true;btn.textContent='Guardando…';
  try{
    await cloud.changePassword(p);
    cloud.signOut();
    location.href=location.origin+location.pathname+'?login=1';
  }catch(e){msg.textContent=authMessage(e);btn.disabled=false;btn.textContent=old}
}
function showPaidSignup(email,claim){hideEntryGates();$('#shell').classList.add('hidden');$('#mobileNav').classList.add('hidden');$('#paidSignupGate').classList.remove('hidden');$('#paidEmail').value=email;rememberPaidCheckout(email,claim)}
function showCheckoutRecovery(message){showCheckout(message);const b=$('#retryCheckoutCapture');b?.classList.remove('hidden')}
async function retryCheckoutCapture(){
  const raw=sessionStorage.getItem('feo-checkout-recovery'),btn=$('#retryCheckoutCapture'),msg=$('#checkoutMsg');
  if(!raw){btn?.classList.add('hidden');if(msg)msg.textContent='No encontramos una confirmación pendiente. Si ya pagaste, inicia sesión o revisa tu recibo de PayPal.';return}
  let ctx;try{ctx=JSON.parse(raw)}catch{sessionStorage.removeItem('feo-checkout-recovery');return}
  if(btn){btn.disabled=true;btn.textContent='Confirmando…'}if(msg)msg.textContent='Confirmando tu pago con PayPal…';
  try{
    const r=await cloud.capturePublicCheckout(ctx.cid,ctx.cs,ctx.token);
    if(!r?.claim_token)throw new Error('PAYMENT_CAPTURE_PENDING');
    sessionStorage.removeItem('feo-checkout-recovery');
    if(btn){btn.classList.add('hidden');btn.disabled=false;btn.textContent='Reintentar confirmación'}
    showPaidSignup(r.email,r.claim_token);
  }catch(e){
    if(msg)msg.textContent='Aún no pudimos confirmar el acceso. No realices otro pago; puedes reintentar en esta misma pantalla.';
    if(btn){btn.classList.remove('hidden');btn.disabled=false;btn.textContent='Reintentar confirmación'}
  }
}
async function boot(){
 const authType=cloud.acceptAuthFromUrl();
 const qp=new URLSearchParams(location.search);
 if(authType==='recovery'){showRecoveryPassword();return}
 if(qp.get('login')==='1'){history.replaceState(null,'',location.pathname);showExistingLogin('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');return}
 if(qp.get('checkout')==='cancelled'){const cid=qp.get('cid'),ct=qp.get('ct'),cs=qp.get('cs');history.replaceState(null,'',location.pathname);if(cid&&(ct||cs)){try{await cloud.cancelPublicCheckout(cid,ct,cs)}catch(e){console.warn('checkout cancel sync',e)}}showCheckout('El pago fue cancelado. No se creó ninguna cuenta.');return}
 if(qp.get('checkout')==='approved'&&qp.get('cid')&&qp.get('cs')&&qp.get('token')){
   sessionStorage.setItem('feo-checkout-recovery',JSON.stringify({cid:qp.get('cid'),cs:qp.get('cs'),token:qp.get('token')}));
   history.replaceState(null,'',location.pathname);
   hideEntryGates();$('#checkoutGate').classList.remove('hidden');$('#checkoutMsg').textContent='Confirmando tu pago…';
   await retryCheckoutCapture();
   return;
 }
 const pendingCheckout=sessionStorage.getItem('feo-checkout-recovery');
 if(pendingCheckout){showCheckoutRecovery('Hay una confirmación de pago pendiente. No vuelvas a pagar; reintenta la confirmación.');return}
 const user=await cloud.currentUser();
 if(user){try{await claimPendingPaidAccess();await enterApp()}catch{showAccessPending(null,'Tu compra sigue pendiente de asociarse. Pulsa Comprobar acceso para reintentar; no vuelvas a pagar.')}return}
 const pending=readPaidCheckout();
 if(pending){if(pending.existingAccount)showExistingLogin('Tu compra está confirmada. Inicia sesión para activar tu acceso.');else showPaidSignup(pending.email,pending.claim);return}
 showCheckout();
}
async function enterApp(){try{const lic=await cloud.myLicense();membershipLicense=lic;adminMode=await cloud.isAdmin();if(!adminMode&&!membershipState(lic).active){showAccessPending(lic);return}hideEntryGates();const data=await cloud.loadData();syncOwner=data.user.id;records=data.records;profileData={...PROFILE_DEFAULT,...data.profile};const pendingSync=readPending();if(pendingSync?.records){records=pendingSync.records;profileData={...profileData,...pendingSync.profile};queueSync(pendingSync,50);}if(profileData.theme&&['light','dark','system'].includes(profileData.theme))state.theme=profileData.theme;localStorage.setItem('feo-theme',state.theme);applyTheme();profileData.photoUrl=await cloud.avatarObjectUrl(profileData.photo);$('#authGate')?.classList.add('hidden');$('#accessGate')?.classList.add('hidden');if(adminMode){$('#shell').classList.remove('hidden');$('#mobileNav').classList.remove('hidden');injectAdminButton();ensureHistoryState();render();return}if(!profileData.tutorialCompleted){showOnboarding();return}$('#shell').classList.remove('hidden');$('#mobileNav').classList.remove('hidden');ensureHistoryState();render()}catch(e){showAuth(e.message)}}
function showAccessPending(lic,message=''){ hideEntryGates();$('#shell').classList.add('hidden');$('#mobileNav').classList.add('hidden');const g=$('#accessGate');g?.classList.remove('hidden');const st=$('#accessStatus');if(st)st.textContent=message||(lic?`Estado de acceso: ${lic.status}.`:'Esta cuenta no tiene una compra asociada.');const buy=$('#buyAccess');if(buy){buy.textContent=lic?.expires_at?'Renovar membresía':'Activar membresía';buy.onclick=()=>{location.href='/renovar.html'}}let memberBox=document.getElementById('expiredMembership');if(!memberBox){memberBox=document.createElement('div');memberBox.id='expiredMembership';g?.append(memberBox)}memberBox.innerHTML=membershipCard(lic);const refresh=$('#refreshAccess');if(refresh)refresh.onclick=async()=>{refresh.disabled=true;try{if(readPaidCheckout()){await claimPendingPaidAccess();await enterApp();return}const l=await cloud.myLicense();if(membershipState(l).active){await enterApp();return}st.textContent='No encontramos una compra confirmada asociada a esta cuenta.'}catch(e){st.textContent=e.message}finally{refresh.disabled=false}}}
function injectAdminButton(){const b=document.createElement('button');b.id='adminOpen';b.innerHTML='▦ <span>Admin</span>';b.onclick=()=>openAdmin();document.querySelector('.sideBottom')?.prepend(b)}
async function openAdmin(){
 try{
  const [d,ops]=await Promise.all([cloud.adminDashboard(),cloud.adminOpsSummary()]);
  const users=d.users||[],checkout=ops.checkouts||{},payments=ops.payments||{},licenses=ops.licenses||{};
  const cAll=checkout.all||{},pAll=payments.all||{},lAll=licenses.all||{};
  const riskCount=Number(checkout.stale||0)+Number(cAll.failed||0)+Number(pAll.denied||0)+Number(pAll.reversed||0);
  const rows=users.map(u=>{
   const l=u.license,pay=u.last_payment;
   const payText=pay?`${esc(pay.status)} · ${esc(pay.currency)} ${(Number(pay.amount_minor)/100).toFixed(2)}`:'Sin pago registrado';
   const action=l?`<button class="ghost adminLicense" data-user="${u.id}" data-status="${l.status==='active'?'revoked':'active'}">${l.status==='active'?'Desactivar':'Activar'}</button>`:'—';
   return `<div class="adminRow"><div><b>${esc(u.full_name||u.email||'Usuario')}</b><small>${esc(u.country||'—')} · ${esc(u.email||'Sin correo')}</small></div><div><b>${esc(l?.status||'sin licencia')}</b><small>${payText}</small></div><div>${action}</div><div><button class="ghost adminNote" data-user="${u.id}">Nota</button></div></div>`;
  }).join('');
  $('#content').innerHTML=`<div class="sectionHead"><div><span class="eyebrow">FINORVE · OPERACIÓN</span><h2>Administración</h2><p>Acceso, pagos y soporte. Los movimientos financieros no están disponibles aquí.</p></div><button class="ghost" id="adminRefresh">Actualizar</button></div>
  <div class="adminOpsGrid">
    <div class="adminOpsCard"><small>USUARIOS</small><strong>${users.length}</strong><span>cuentas visibles</span></div>
    <div class="adminOpsCard"><small>LICENCIAS ACTIVAS</small><strong>${Number(lAll.active||0)}</strong><span>${Number(lAll.revoked||0)+Number(lAll.refunded||0)} revocadas/reembolsadas</span></div>
    <div class="adminOpsCard ${riskCount?'warn':''}"><small>ATENCIÓN</small><strong>${riskCount}</strong><span>${Number(checkout.stale||0)} checkout(s) atascado(s)</span></div>
    <div class="adminOpsCard"><small>EVENTOS 24H</small><strong>${Number(ops.payment_events_last24h||0)}</strong><span>webhooks procesados</span></div>
  </div>
  <div class="adminOpsDetail">
    <div class="card"><span class="eyebrow">CHECKOUT</span><div class="opsRows">
      <div><span>Creados</span><b>${Number(cAll.created||0)}</b></div>
      <div><span>Completados</span><b>${Number(cAll.completed||0)}</b></div>
      <div><span>Reclamados</span><b>${Number(cAll.claimed||0)}</b></div>
      <div><span>Cancelados</span><b>${Number(cAll.cancelled||0)}</b></div>
      <div><span>Fallidos</span><b>${Number(cAll.failed||0)}</b></div>
    </div></div>
    <div class="card"><span class="eyebrow">PAGOS</span><div class="opsRows">
      <div><span>Completados</span><b>${Number(pAll.completed||0)}</b></div>
      <div><span>Reembolsados</span><b>${Number(pAll.refunded||0)}</b></div>
      <div><span>Revertidos</span><b>${Number(pAll.reversed||0)}</b></div>
      <div><span>Denegados</span><b>${Number(pAll.denied||0)}</b></div>
    </div></div>
  </div>
  <div class="card adminUsersCard"><div class="recordListHead"><div><span class="eyebrow">USUARIOS</span><h3>Accesos y soporte</h3></div><small>Actualizado ${new Date(ops.generated_at||Date.now()).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</small></div><div class="adminTable">${rows||'<p class="sub">Aún no hay usuarios.</p>'}</div></div>`;
  $('#adminRefresh')?.addEventListener('click',openAdmin);
  $$('.adminLicense').forEach(b=>b.onclick=async()=>{try{await cloud.adminSetLicense(b.dataset.user,b.dataset.status);await openAdmin()}catch(e){alert(e.message)}});
  $$('.adminNote').forEach(b=>b.onclick=()=>openModalForm('Nota de soporte','<div class="field"><label>Nota interna</label><textarea id="supportNote" maxlength="1000"></textarea></div>',async()=>{await cloud.adminAddNote(b.dataset.user,$('#supportNote').value);$('#modalWrap').classList.add('hidden')}));
 }catch(e){alert(e.message)}
}

function showAuth(message=''){const gate=$('#authGate');gate?.classList.remove('hidden');$('#shell').classList.add('hidden');$('#mobileNav').classList.add('hidden');const msg=$('#authMsg');if(msg){msg.textContent=message||'';msg.classList.remove('authMsgInfo')}$('#authSignup')?.classList.remove('hidden')}
function authMessage(error){const m=String(error?.message||error||'').toLowerCase();if(m.includes('anonymous sign-ins are disabled'))return 'Escribe tu correo electrónico para crear la cuenta.';if(m.includes('invalid login credentials'))return 'Correo o contraseña incorrectos.';if(m.includes('email not confirmed'))return 'Confirma tu correo antes de iniciar sesión.';if(m.includes('user already registered'))return 'Ya existe una cuenta con ese correo. Inicia sesión.';if(m.includes('password'))return 'La contraseña debe tener al menos 8 caracteres.';if(m.includes('email'))return 'Revisa que el correo electrónico sea válido.';return 'No pudimos completar la solicitud. Inténtalo nuevamente.'}
function validateAuth(mode){const email=$('#authEmail').value.trim(),password=$('#authPassword').value,msg=$('#authMsg');msg.textContent='';msg.classList.remove('authMsgInfo','authMsgSuccess');if(!email){msg.textContent='Escribe tu correo electrónico.';$('#authEmail').focus();return null}if(!email.includes('@')||email.startsWith('@')||!email.slice(email.indexOf('@')+1).includes('.')||email.endsWith('.')){msg.textContent='Escribe un correo electrónico válido.';$('#authEmail').focus();return null}if(!password){msg.textContent='Escribe tu contraseña.';$('#authPassword').focus();return null}if(password.length<8){msg.textContent='La contraseña debe tener al menos 8 caracteres.';$('#authPassword').focus();return null}return {email,password,msg}}
window.feoAuth={async forgot(){const email=$('#authEmail').value.trim(),msg=$('#authMsg');msg.textContent='';msg.classList.remove('authMsgInfo','authMsgSuccess');if(!email||!email.includes('@')||email.startsWith('@')||!email.slice(email.indexOf('@')+1).includes('.')||email.endsWith('.')){msg.textContent='Escribe un correo electrónico válido.';$('#authEmail').focus();return}try{await cloud.requestPasswordReset(email);msg.textContent='✓ Revisa tu correo. Si existe una cuenta con esta dirección, recibirás un enlace para crear una nueva contraseña.';msg.classList.add('authMsgInfo')}catch(e){msg.textContent=authMessage(e)}},async submit(mode){const v=validateAuth(mode);if(!v)return;const {email,password,msg}=v;const btn=$('#authSignin');const original=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Ingresando…'}try{await cloud.signIn(email,password);await claimPendingPaidAccess();await enterApp()}catch(e){msg.textContent=authMessage(e)}finally{if(btn){btn.disabled=false;btn.textContent=original}}},logout(){cloud.signOut();location.reload()}};
let authMode='signin';
function setAuthMode(mode){
  authMode=mode;
  const signup=mode==='signup';
  $('#authKicker').textContent=signup?'CREAR CUENTA':'BIENVENIDO';
  $('#authTitle').textContent=signup?'Crea tu cuenta':'Accede a tus finanzas';
  $('#authCopy').textContent=signup?'Usa tu correo y una contraseña segura para comenzar.':'Tu situación financiera, organizada para que sepas qué hacer después.';
  $('#signupConfirmWrap').classList.toggle('hidden',!signup);
  $('#forgotPassword').classList.toggle('hidden',signup);
  $('#authSignin').innerHTML=signup?'Crear mi cuenta <span>→</span>':'Iniciar sesión <span>→</span>';
  $('#authSignup').textContent=signup?'Ya tengo una cuenta':'Crear una cuenta';
  $('#authPassword').setAttribute('autocomplete',signup?'new-password':'current-password');
  $('#authMsg').textContent='';
}
function showSignupSuccess(email){
  $('#authEmail').closest('.authCard').querySelectorAll('label,input,#authSignin,#authSignup,#forgotPassword,#authMsg').forEach(el=>el.classList.add('hidden'));
  $('#authKicker').textContent='REVISA TU CORREO';
  $('#authTitle').textContent='Confirma tu cuenta';
  $('#authCopy').textContent='Hemos enviado un enlace de confirmación a '+email+'.';
  $('#signupSuccess').classList.remove('hidden');
}

let paypalEmbeddedReady=false;
let paypalEmbeddedInit=null;
let paypalSdkPromise=null;
let paypalCardFields=null;
let paypalCheckoutContext=null;
async function loadPayPalSdkV5(){
  if(window.paypal?.Buttons)return;
  if(paypalSdkPromise)return paypalSdkPromise;
  paypalSdkPromise=(async()=>{
    const cfg=await cloud.paypalPublicConfig();
    await new Promise((resolve,reject)=>{
      const sc=document.createElement('script');
      sc.src='https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(cfg.clientId)+'&currency=USD&intent=capture&components=buttons,card-fields';
      sc.async=true;sc.dataset.paypalV5='1';
      sc.onload=resolve;sc.onerror=()=>{sc.remove();reject(new Error('No se pudo cargar el checkout seguro de PayPal.'))};
      document.head.appendChild(sc);
    });
    if(typeof window.paypal?.Buttons!=='function')throw new Error('PAYPAL_SDK_UNAVAILABLE');
  })();
  try{await paypalSdkPromise}catch(e){paypalSdkPromise=null;throw e}
}
function checkoutEmailValid(){
  const email=$('#checkoutEmail').value.trim().toLowerCase();
  if(!email||!email.includes('@')||!(email.split('@')[1]||'').includes('.')){
    $('#checkoutMsg').textContent='Escribe un correo electrónico válido.';
    $('#checkoutEmail').focus();return false;
  }
  return true;
}
function embeddedPaymentError(){
  if(sessionStorage.getItem('feo-checkout-recovery')){
    showCheckoutRecovery('Tu pago está pendiente de confirmación. No vuelvas a pagar; usa Reintentar confirmación.');
  }else $('#checkoutMsg').textContent='No pudimos completar el pago. Revisa los datos e inténtalo nuevamente.';
}
async function createEmbeddedOrder(){
  if(sessionStorage.getItem('feo-checkout-recovery')){embeddedPaymentError();throw new Error('PAYMENT_CONFIRMATION_PENDING')}
  if(!checkoutEmailValid())throw new Error('INVALID_EMAIL');
  const email=$('#checkoutEmail').value.trim().toLowerCase();
  $('#checkoutMsg').textContent='';
  if(paypalCheckoutContext?.email===email)return paypalCheckoutContext.order_id;
  const o=await cloud.createPublicCheckout(email);
  if(!o?.order_id||!o?.checkout_id||!o?.checkout_secret)throw new Error('CHECKOUT_UNAVAILABLE');
  o.email=email;
  paypalCheckoutContext=o;
  return o.order_id;
}
async function approveEmbeddedOrder(data){
  if(!paypalCheckoutContext||data.orderID!==paypalCheckoutContext.order_id)throw new Error('No encontramos el checkout activo.');
  const ctx={cid:paypalCheckoutContext.checkout_id,cs:paypalCheckoutContext.checkout_secret,token:data.orderID};
  sessionStorage.setItem('feo-checkout-recovery',JSON.stringify(ctx));
  try{
    const c=await cloud.capturePublicCheckout(ctx.cid,ctx.cs,ctx.token);
    if(!c?.claim_token)throw new Error('El pago se realizó, pero no pudimos preparar el acceso.');
    sessionStorage.removeItem('feo-checkout-recovery');
    paypalCheckoutContext=null;
    showPaidSignup(c.email,c.claim_token);
  }catch(e){
    showCheckoutRecovery('Tu pago puede estar aprobado, pero FINORVE todavía no pudo confirmar el acceso. No vuelvas a pagar; usa Reintentar confirmación.');
    throw e;
  }
}
async function initEmbeddedPayPal(){
  if(paypalEmbeddedReady)return;
  if(paypalEmbeddedInit)return paypalEmbeddedInit;
  paypalEmbeddedInit=(async()=>{
    const loading=$('#paypalCardLoading'),fields=$('#paypalCardFields'),unavailable=$('#paypalCardUnavailable');
    const walletLoading=$('#paypalButtonsLoading'),walletUnavailable=$('#paypalButtonsUnavailable');
    loading?.classList.remove('hidden');walletLoading?.classList.remove('hidden');
    unavailable?.classList.add('hidden');walletUnavailable?.classList.add('hidden');
    let walletReady=false,cardReady=false;
    try{
      await loadPayPalSdkV5();
      try{
        const buttons=window.paypal.Buttons({
          style:{layout:'vertical',color:'gold',shape:'rect',label:'pay'},
          fundingSource:window.paypal.FUNDING?.PAYPAL,
          createOrder:createEmbeddedOrder,onApprove:approveEmbeddedOrder,
          onClick:(_data,actions)=>checkoutEmailValid()?actions.resolve():actions.reject(),
          onCancel:()=>{paypalCheckoutContext=null;$('#checkoutMsg').textContent='Pago cancelado. Puedes intentarlo nuevamente.'},
          onError:embeddedPaymentError
        });
        if(!buttons.isEligible())throw new Error('PAYPAL_BUTTON_NOT_ELIGIBLE');
        await buttons.render('#paypal-buttons');walletReady=true;
      }catch{walletUnavailable?.classList.remove('hidden')}
      try{
        if(typeof window.paypal.CardFields!=='function')throw new Error('CARD_FIELDS_NOT_ELIGIBLE');
        const card=window.paypal.CardFields({createOrder:createEmbeddedOrder,onApprove:approveEmbeddedOrder,onError:embeddedPaymentError});
        if(!card.isEligible())throw new Error('CARD_FIELDS_NOT_ELIGIBLE');
        await card.NameField().render('#paypal-card-name');
        await card.NumberField().render('#paypal-card-number');
        await card.ExpiryField().render('#paypal-card-expiry');
        await card.CVVField().render('#paypal-card-cvv');
        paypalCardFields=card;fields?.classList.remove('hidden');cardReady=true;
      }catch{paypalCardFields=null;fields?.classList.add('hidden');unavailable?.classList.remove('hidden')}
      paypalEmbeddedReady=walletReady||cardReady;
    }catch{unavailable?.classList.remove('hidden');walletUnavailable?.classList.remove('hidden')}
    finally{
      loading?.classList.add('hidden');walletLoading?.classList.add('hidden');
      $('#retryPaymentMethods')?.classList.toggle('hidden',paypalEmbeddedReady);
    }
  })();
  try{await paypalEmbeddedInit}finally{paypalEmbeddedInit=null}
}
async function payEmbeddedCard(){
  const msg=$('#checkoutMsg'),btn=$('#payWithCard');msg.textContent='';
  if(!checkoutEmailValid())return;
  if(!paypalCardFields){msg.textContent='El pago con tarjeta todavía se está preparando.';return}
  btn.disabled=true;const old=btn.textContent;btn.textContent='Procesando pago…';
  try{await paypalCardFields.submit()}
  catch(e){embeddedPaymentError()}
  finally{btn.disabled=false;btn.textContent=old}
}
function bindAuthActions(){
  $('#payWithCard')?.addEventListener('click',payEmbeddedCard);
  $('#retryCheckoutCapture')?.addEventListener('click',retryCheckoutCapture);
  $('#retryPaymentMethods')?.addEventListener('click',()=>initEmbeddedPayPal());
  $('#existingLogin')?.addEventListener('click',()=>showExistingLogin());
  $('#paidExistingLogin')?.addEventListener('click',()=>showExistingLogin());
  $('#createPaidAccount')?.addEventListener('click',async()=>{
    const name=$('#paidName').value.trim(),email=$('#paidEmail').value.trim().toLowerCase(),password=$('#paidPassword').value,confirm=$('#paidPasswordConfirm').value,msg=$('#paidSignupMsg'),btn=$('#createPaidAccount'),claim=readPaidCheckout()?.claim;
    msg.textContent='';
    if(name.length<2){msg.textContent='Escribe tu nombre.';$('#paidName').focus();return}
    if(!validatePassword(password)){msg.textContent=PASSWORD_POLICY_MESSAGE;return}
    if(password!==confirm){msg.textContent='Las contraseñas no coinciden.';return}
    if(!claim){msg.textContent='El comprobante de pago ya no está disponible. Contacta soporte con tu recibo de PayPal.';return}
    btn.disabled=true;const old=btn.textContent;btn.textContent='Creando tu acceso…';
    try{
      await cloud.createPaidAccount(email,password,claim);
      await cloud.signIn(email,password);
      await cloud.saveProfile({name,country:'Ecuador',personalCurrency:'USD',businessCurrency:'USD',theme:'system',tutorialCompleted:false});
      clearPaidCheckout();
      await enterApp();
    }catch(e){
      if(e.message==='ACCOUNT_EXISTS'){
        const email=$('#paidEmail').value.trim().toLowerCase();
        showExistingLogin('✓ Compra verificada. Ya tienes una cuenta. Inicia sesión para activar tu acceso.');
        $('#authEmail').value=email;
        $('#authEmail').readOnly=true;
        $('#authPassword').focus();
      }else{
        msg.textContent=e.message;
      }
      btn.disabled=false;btn.textContent=old;
    }
  });
  $('#authSignin')?.addEventListener('click',()=>authMode==='recovery'?submitRecoveryPassword():window.feoAuth.submit('signin'));
  $('#authSignup')?.addEventListener('click',()=>showCheckout());
  $('#forgotPassword')?.addEventListener('click',()=>window.feoAuth.forgot());
  $('#accessLogout')?.addEventListener('click',()=>window.feoAuth.logout());
  $('#backToLogin')?.addEventListener('click',()=>location.reload());
  $('#resendConfirmation')?.addEventListener('click',async()=>{
    const btn=$('#resendConfirmation'), msg=$('#resendMsg'), email=$('#authCopy').textContent.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]||$('#authEmail').value.trim();
    btn.disabled=true; const old=btn.textContent; btn.textContent='Enviando…'; msg.textContent='';
    try{await cloud.resendSignupConfirmation(email);msg.textContent='Correo reenviado. Usa el enlace más reciente.'}catch(e){msg.textContent=authMessage(e)}finally{btn.disabled=false;btn.textContent=old}
  });
}
bindAuthActions();
function finishBoot(){const gate=$('#bootGate');if(!gate)return;gate.classList.add('bootDone');setTimeout(()=>gate.remove(),220)}
boot().finally(finishBoot);

function syncVisualViewport(){const vv=window.visualViewport;const h=vv?.height||window.innerHeight;document.documentElement.style.setProperty('--visual-viewport-height',h+'px');document.documentElement.dataset.keyboardOpen=vv&&window.innerHeight-h>120?'true':'false'}
syncVisualViewport();window.visualViewport?.addEventListener('resize',syncVisualViewport);window.visualViewport?.addEventListener('scroll',syncVisualViewport);document.addEventListener('focusin',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName||''))setTimeout(()=>e.target.scrollIntoView({block:'center',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}),120)});

