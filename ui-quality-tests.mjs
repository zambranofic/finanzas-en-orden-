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

console.log('ui-quality-tests: OK');
