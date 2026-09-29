import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('./app-v4.js',import.meta.url),'utf8');

assert(html.includes('id="bootGate"'),'boot gate must reserve initial layout');
assert(app.includes('boot().finally(finishBoot)'),'boot gate must clear after boot settles');
assert(css.includes('font-size:clamp('),'responsive type scale must use clamp');
assert(css.includes('font-size:.6875rem'),'small UI text must use rem overrides');
assert(css.includes('#content.viewEntering'),'content transitions must keep visual continuity');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'motion preference must remain respected');
assert(html.includes('viewport-fit=cover'),'mobile viewport must include viewport-fit=cover');
for (const side of ['top','right','bottom','left']) {
  assert(css.includes(`safe-area-inset-${side}`),`safe area ${side} must be handled`);
}
assert(css.includes('min-width:44px')&&css.includes('min-height:44px'),'critical touch targets must stay at least 44px');
assert(css.includes('button:active')||css.includes(':active'),'touch controls must expose an active state');
assert(app.includes('visualViewport'),'mobile keyboard layout must use Visual Viewport');
assert(app.includes('history.pushState')&&app.includes('popstate'),'internal navigation must integrate with browser history');
assert(app.includes('aria-modal')&&app.includes("e.key==='Escape'"),'modals must support dialog semantics and Escape');
assert(/<(button|input|select|textarea)\b/i.test(html),'native semantic controls must remain present');
assert(css.includes('transform:')&&css.includes('transition:'),'visual continuity should prefer compositor-friendly transforms');

console.log('ui-quality-tests: OK');
