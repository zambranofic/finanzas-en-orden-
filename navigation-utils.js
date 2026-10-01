const SECTIONS=new Set(['calendar','home','movements','plan','decisions','more','profile','settings','income','expenses','debts','savings','goals','assets','diagnostic','sales','costs','cashflow','breakEven','results']);
const MODES=new Set(['personal','business']);

export function normalizeNavigationState(value,fallback={section:'home',mode:'personal'}){
  const section=SECTIONS.has(value?.section)?value.section:fallback.section;
  const mode=MODES.has(value?.mode)?value.mode:fallback.mode;
  return {section,mode};
}
export function navigationChanged(current,next){
  const a=normalizeNavigationState(current),b=normalizeNavigationState(next,a);
  return a.section!==b.section||a.mode!==b.mode;
}
