import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const source = fs.readFileSync(new URL('./supabase/functions/payphone-test-checkout/index.ts', import.meta.url), 'utf8');
const cid = '36da299e-cd67-4dd7-a236-d460172d7c6c';
const secret = cid + '.' + cid;
const key = 'sb_publishable_Ltn-8m11gMlS2AY14k8nfA_hcJ3Izjl';
const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))).toString('hex');
const provider = { statusCode: 3, transactionStatus: 'Approved', clientTransactionId: cid, transactionId: 12345, amount: 100, currency: 'USD' };
function setup({ payload = provider, intentChanges = {}, envChanges = {}, networkFailure = false } = {}) {
  let handler; let providerCalls = 0; let lookupCalls = 0;
  const logs = [];
  const row = { id: cid, mode: 'test', amount_minor: 100, currency: 'USD', secret_hash: hash, status: 'created', store_id: cid, expires_at: new Date(Date.now() + 600000).toISOString(), ...intentChanges };
  const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'fake-service-only-key', PAYPHONE_TOKEN: 'fake-merchant-test-token', PAYPHONE_STORE_ID: cid, ...envChanges };
  const fakeFetch = async (url, opts = {}) => {
    const u = new URL(url);
    if (u.hostname === 'pay.payphonetodoesposible.com') {
      lookupCalls++; assert.equal(u.pathname, '/api/Sale/client/' + cid); assert.equal(opts.method || 'GET', 'GET');
      return Response.json(payload);
    }
    if (u.hostname === 'paymentbox.payphonetodoesposible.com') {
      providerCalls++; assert.equal(u.pathname, '/api/confirm');
      const body = JSON.parse(opts.body); assert.equal(body.clientTxId, cid); assert.equal(body.id, 12345);
      if (networkFailure) throw new Error('network error fake-merchant-test-token');
      return Response.json(payload);
    }
    assert.equal(u.hostname, 'db.example');
    assert(!/licenses|payments|checkout_intents|auth/.test(u.pathname), 'tests must not touch paid account tables');
    if (u.pathname.endsWith('/rpc/consume_rate_limit_internal')) return Response.json({ allowed: true });
    assert.equal(u.pathname, '/rest/v1/payphone_test_intents');
    if (opts.method === 'POST') return Response.json([{ ...row, ...JSON.parse(opts.body) }]);
    if (opts.method === 'PATCH') {
      const expected = u.searchParams.get('status');
      if (expected && expected !== 'eq.' + row.status) return Response.json([]);
      Object.assign(row, JSON.parse(opts.body)); return Response.json([{ ...row }]);
    }
    return Response.json([{ ...row }]);
  };
  vm.runInNewContext(source, { Deno: { env: { get: name => env[name] }, serve: f => handler = f }, fetch: fakeFetch, crypto: webcrypto,
    TextEncoder, AbortSignal, Response, console: { error: text => logs.push(text) } });
  const request = async (body, headers = { apikey: key }, method = 'POST') => {
    const r = await handler(new Request('https://function.example', { method, headers, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }));
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  };
  return { request, row, calls: () => providerCalls, lookups: () => lookupCalls, logs };
}
const confirm = { action: 'confirm', checkout_id: cid, checkout_secret: secret, transaction_id: '12345' };
{
  const s = setup(); const r = await s.request(confirm);
  assert.equal(r.status, 200); assert.equal(r.body.status, 'approved'); assert.equal(r.body.access_activated, false); assert.equal(s.calls(), 1);
  const second = await s.request(confirm); assert.equal(second.body.recovered, true); assert.equal(s.calls(), 1);
  assert.equal((await s.request({ ...confirm, transaction_id: '67890' })).status, 409); assert.equal(s.calls(), 1);
  assert(!JSON.stringify(r.body).includes('token'));
}
for (const change of [{ amount: 99 }, { amount: '100' }, { currency: 'EUR' }, { transactionId: 67890 }, { clientTransactionId: 'other-intent' }, { statusCode: 2 }]) {
  const s = setup({ payload: { ...provider, ...change } });
  assert.equal((await s.request(confirm)).status, 409); assert.equal(s.row.status, 'failed');
}
{
  const s = setup({ payload: { ...provider, statusCode: 2, transactionStatus: 'Canceled' } });
  assert.equal((await s.request(confirm)).body.status, 'cancelled');
}
for (const token of ['', cid]) {
  const s = setup({ envChanges: { PAYPHONE_TOKEN: token } });
  assert.equal((await s.request({ action: 'create', confirm_test_mode: true })).status, 503); assert.equal(s.calls(), 0);
}
{
  const s = setup();
  assert.equal((await s.request({ action: 'create' })).status, 400);
  const r = await s.request({ action: 'create', confirm_test_mode: true, amount: 999999, mode: 'production' });
  assert.equal(r.body.mode, 'test'); assert.equal(r.body.box.amount, 100); assert.equal(r.body.box.currency, 'USD');
  assert(!JSON.stringify(r.body).includes('fake-service-only-key'));
  assert.equal((await s.request(confirm, {})).status, 401);
  assert.equal((await s.request(confirm, { apikey: key, origin: 'https://evil.example' })).status, 403);
  assert.equal((await s.request(null, { apikey: key }, 'GET')).status, 405);
  assert.equal((await s.request({ ...confirm, checkout_secret: secret.replace('36da', '46da') })).status, 401); assert.equal(s.calls(), 0);
}
{
  const s = setup({ intentChanges: { expires_at: '2020-01-01T00:00:00Z' } }); assert.equal((await s.request(confirm)).status, 410); assert.equal(s.calls(), 0);
}
{
  const s = setup({ networkFailure: true }); assert.equal((await s.request(confirm)).status, 502); assert.equal(s.row.status, 'uncertain');
  assert.equal((await s.request(confirm)).status, 409); assert.equal(s.calls(), 1); assert(!s.logs.join('').includes('fake-merchant-test-token'));
}
{
  const s = setup(); const r = await Promise.all([s.request(confirm), s.request(confirm)]);
  assert.equal(s.calls(), 1); assert(r.some(x => x.status === 200));
}
console.log('PASS: Payphone rehearsal validates amount/currency/transaction, protects intent secrets, serializes confirmation, handles uncertainty, and never grants paid access.');
{
  const s = setup({ payload: { ...provider, statusCode: 2, transactionStatus: 'Canceled' } });
  const r = await s.request({ action: 'status', checkout_id: cid, checkout_secret: secret });
  assert.equal(r.body.status, 'cancelled'); assert.equal(s.row.status, 'cancelled'); assert.equal(s.calls(), 0); assert.equal(s.lookups(), 1);
}
{
  const s = setup(); const r = await s.request({ action: 'status', checkout_id: cid, checkout_secret: secret });
  assert.equal(r.body.status, 'needs_confirmation'); assert.equal(s.row.status, 'created'); assert.equal(s.calls(), 0);
  assert.equal((await s.request({ action: 'status', checkout_id: cid, checkout_secret: secret.replace('36da','46da') })).status, 401); assert.equal(s.lookups(), 1);
}
{
  const s = setup({ payload: { ...provider, amount: 200 } }); assert.equal((await s.request({ action: 'status', checkout_id: cid, checkout_secret: secret })).status, 409); assert.equal(s.calls(), 0);
}
console.log('PASS: status recovery reads only the original provider transaction, detects cancellation, and never initiates another payment.');
