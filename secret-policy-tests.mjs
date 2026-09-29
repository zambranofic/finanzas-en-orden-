import assert from 'node:assert/strict';
import fs from 'node:fs';

const browserFiles=[
  'index.html',
  'app-v4.js',
  'supabase-store.js',
  'financial-engine.js',
  'sync-utils.js',
  'profile-utils.js',
  'auth-session-utils.js',
  'password-policy.js',
  'checkout-security-utils.js',
  'navigation-utils.js',
  'manifest.webmanifest',
  'vercel.json'
].filter(f=>fs.existsSync(new URL('./'+f,import.meta.url)));

const forbidden=[
  {name:'Supabase service role env',re:/SUPABASE_SERVICE_ROLE_KEY/i},
  {name:'Supabase secret key env',re:/SUPABASE_SECRET_KEY/i},
  {name:'PayPal client secret',re:/PAYPAL_CLIENT_SECRET/i},
  {name:'PayPal webhook secret/id',re:/PAYPAL_WEBHOOK_(?:SECRET|ID)/i},
  {name:'Stripe live secret',re:/sk_live_[A-Za-z0-9]{16,}/},
  {name:'GitHub personal token',re:/ghp_[A-Za-z0-9]{20,}/},
  {name:'private key material',re:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/}
];

for(const file of browserFiles){
  const text=fs.readFileSync(new URL('./'+file,import.meta.url),'utf8');
  for(const rule of forbidden){
    assert.equal(rule.re.test(text),false,`${rule.name} must never ship in browser file ${file}`);
  }
}

console.log('secret-policy-tests: OK');
