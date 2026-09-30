// Rehearsal endpoint only. No writes to payments, licenses, checkout_intents or auth.
// The public app key identifies guest requests; the random intent secret authorizes confirmation.
const APP = 'https://finorve.com';
const APP_KEY = 'sb_publishable_Ltn-8m11gMlS2AY14k8nfA_hcJ3Izjl';
const ORIGINS = new Set([APP, 'https://www.finorve.com']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONFIRM = 'https://paymentbox.payphonetodoesposible.com/api/confirm';
async function sha(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function database(path, options = {}) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('DATABASE_UNAVAILABLE');
  let r;
  try {
    r = await fetch(url + '/rest/v1/' + path, {
      ...options,
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      signal: AbortSignal.timeout(10000),
    });
  } catch { throw new Error('DATABASE_UNAVAILABLE'); }
  if (!r.ok) throw new Error('DATABASE_UNAVAILABLE');
  return r.json();
}
const table = 'payphone_test_intents';
async function rateLimit(req, action) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
  const result = await database('rpc/consume_rate_limit_internal', { method: 'POST', body: JSON.stringify({
    p_endpoint: 'payphone-test:' + action, p_subject_hash: await sha(ip), p_window_seconds: 300, p_limit: action === 'create' ? 8 : 20,
  }) });
  if (!result || typeof result.allowed !== 'boolean') throw new Error('RATE_LIMIT_UNAVAILABLE');
  return result;
}
function publicResult(intent, recovered = false) {
  return { ok: true, mode: 'test', status: intent.status, transaction_id: String(intent.provider_transaction_id || ''), access_activated: false, recovered };
}
Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const headers = {
    'Access-Control-Allow-Origin': ORIGINS.has(origin || '') ? origin : APP,
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', Vary: 'Origin',
  };
  const json = (body, status = 200) => Response.json(body, { status, headers });
  if (origin && !ORIGINS.has(origin)) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (req.headers.get('apikey') !== APP_KEY) return json({ error: 'APP_KEY_REQUIRED' }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'INVALID_JSON' }, 400); }
  const action = body?.action;
  if (!['create', 'confirm', 'status'].includes(action)) return json({ error: 'INVALID_ACTION' }, 400);
  try {
    const rate = await rateLimit(req, action);
    if (!rate.allowed) return json({ error: 'TOO_MANY_ATTEMPTS' }, 429);
    const token = (Deno.env.get('PAYPHONE_TOKEN') || '').trim();
    const storeId = (Deno.env.get('PAYPHONE_STORE_ID') || '').trim();
    if (!token || UUID.test(token) || !UUID.test(storeId)) return json({ error: 'PAYPHONE_NOT_CONFIGURED' }, 503);
    if (action === 'create') {
      if (body.confirm_test_mode !== true) return json({ error: 'TEST_MODE_CONFIRMATION_REQUIRED' }, 400);
      const secret = crypto.randomUUID() + '.' + crypto.randomUUID();
      const [intent] = await database(table, { method: 'POST', body: JSON.stringify({ store_id: storeId, amount_minor: 100, currency: 'USD', secret_hash: await sha(secret) }) });
      if (!intent) throw new Error('DATABASE_UNAVAILABLE');
      // The official browser SDK needs the app token at runtime. Never commit it or persist it in browser storage.
      return json({ checkout_id: intent.id, checkout_secret: secret, mode: 'test', expires_at: intent.expires_at,
        box: { token, storeId, clientTransactionId: intent.id, amount: 100, amountWithoutTax: 100, currency: 'USD',
          reference: 'FINORVE - prueba de integracion', lang: 'es', defaultMethod: 'card', timeZone: -5 } });
    }
    const cid = String(body.checkout_id || '');
    const secret = String(body.checkout_secret || '');
    const tid = String(body.transaction_id || '');
    if (!UUID.test(cid) || secret.length < 60 || secret.length > 100 || (action === 'confirm' && (!/^[1-9]\d{0,14}$/.test(tid) || !Number.isSafeInteger(Number(tid))))) {
      return json({ error: 'INVALID_CHECKOUT_DATA' }, 400);
    }
    const [intent] = await database(table + '?id=eq.' + encodeURIComponent(cid) + '&select=*');
    if (!intent || await sha(secret) !== intent.secret_hash) return json({ error: 'INVALID_CHECKOUT_SECRET' }, 401);
    if (intent.mode !== 'test' || intent.store_id !== storeId) return json({ error: 'CHECKOUT_CONFIGURATION_CHANGED' }, 409);
    if (action === 'status') {
      if (intent.status === 'approved' || intent.status === 'cancelled') return json(publicResult(intent, true));
      if (intent.status !== 'created') return json({ error: 'CONFIRMATION_REQUIRES_REVIEW' }, 409);
      let lookup;
      try {
        lookup = await fetch('https://pay.payphonetodoesposible.com/api/Sale/client/' + encodeURIComponent(cid), {
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
        });
      } catch { return json({ error: 'PAYPHONE_STATUS_UNAVAILABLE' }, 502); }
      const value = await lookup.json().catch(() => null);
      if (lookup.status === 404 || (lookup.ok && Array.isArray(value) && value.length === 0)) return json({ mode: 'test', status: 'not_found', access_activated: false });
      if (!lookup.ok) return json({ error: 'PAYPHONE_STATUS_UNAVAILABLE' }, 502);
      const result = Array.isArray(value) ? value.find(x => x?.clientTransactionId === cid) : value;
      if (!result || result.clientTransactionId !== cid || result.amount !== intent.amount_minor || result.currency !== intent.currency) return json({ error: 'PAYPHONE_VERIFICATION_FAILED' }, 409);
      const transactionId = String(result.transactionId || '');
      if (!/^[1-9]\d{0,14}$/.test(transactionId)) return json({ error: 'PAYPHONE_VERIFICATION_FAILED' }, 409);
      if (result.statusCode === 2 && result.transactionStatus === 'Canceled') {
        const [cancelled] = await database(table + '?id=eq.' + cid + '&status=eq.created', { method: 'PATCH', body: JSON.stringify({ status: 'cancelled', provider_transaction_id: Number(transactionId), updated_at: new Date().toISOString() }) });
        if (!cancelled) return json({ error: 'CONFIRMATION_IN_PROGRESS' }, 409);
        return json(publicResult(cancelled));
      }
      // Reading an approved provider state is not confirmation. The original
      // checkout secret still authorizes the separate confirm action.
      return json({ mode: 'test', status: result.statusCode === 3 && result.transactionStatus === 'Approved' ? 'needs_confirmation' : 'pending', transaction_id: transactionId, access_activated: false });
    }
    if (intent.status === 'approved' || intent.status === 'cancelled') {
      if (String(intent.provider_transaction_id) !== tid) return json({ error: 'TRANSACTION_MISMATCH' }, 409);
      return json(publicResult(intent, true));
    }
    if (Date.parse(intent.expires_at) < Date.now()) return json({ error: 'CHECKOUT_EXPIRED' }, 410);
    if (intent.status !== 'created') return json({ error: 'CONFIRMATION_REQUIRES_REVIEW' }, 409);
    const rows = await database(table + '?id=eq.' + cid + '&status=eq.created', { method: 'PATCH', body: JSON.stringify({ status: 'confirming', provider_transaction_id: Number(tid), updated_at: new Date().toISOString() }) });
    if (!rows.length) return json({ error: 'CONFIRMATION_IN_PROGRESS' }, 409);
    let response;
    try {
      response = await fetch(CONFIRM, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(tid), clientTxId: cid }), signal: AbortSignal.timeout(15000) });
    } catch {
      await database(table + '?id=eq.' + cid, { method: 'PATCH', body: JSON.stringify({ status: 'uncertain', updated_at: new Date().toISOString() }) });
      return json({ error: 'PAYPHONE_CONFIRMATION_UNCERTAIN' }, 502);
    }
    let payload;
    try { payload = await response.json(); } catch {
      await database(table + '?id=eq.' + cid, { method: 'PATCH', body: JSON.stringify({ status: 'uncertain' }) });
      return json({ error: 'PAYPHONE_RESPONSE_INVALID' }, 502);
    }
    if (!response.ok || payload?.errorCode) {
      await database(table + '?id=eq.' + cid, { method: 'PATCH', body: JSON.stringify({ status: 'failed' }) });
      return json({ error: response.status === 401 || response.status === 403 ? 'PAYPHONE_CREDENTIALS_REJECTED' : 'PAYPHONE_CONFIRMATION_FAILED' }, 502);
    }
    const matches = payload?.clientTransactionId === cid && String(payload?.transactionId) === tid;
    const approved = matches && payload?.statusCode === 3 && payload?.transactionStatus === 'Approved'
      && Number.isSafeInteger(payload?.amount) && payload.amount === intent.amount_minor && payload.currency === intent.currency;
    const cancelled = matches && payload?.statusCode === 2 && payload?.transactionStatus === 'Canceled';
    if (!approved && !cancelled) {
      await database(table + '?id=eq.' + cid, { method: 'PATCH', body: JSON.stringify({ status: 'failed' }) });
      return json({ error: 'PAYPHONE_VERIFICATION_FAILED' }, 409);
    }
    const [saved] = await database(table + '?id=eq.' + cid + '&status=eq.confirming', { method: 'PATCH', body: JSON.stringify({ status: approved ? 'approved' : 'cancelled', updated_at: new Date().toISOString() }) });
    if (!saved) throw new Error('DATABASE_UNAVAILABLE');
    return json(publicResult(saved));
  } catch (e) {
    // Do not log tokens, headers, upstream payloads or buyer/card information.
    console.error(JSON.stringify({ event: 'payphone_test_failure', stage: ['DATABASE_UNAVAILABLE', 'RATE_LIMIT_UNAVAILABLE'].includes(e?.message) ? e.message : 'INTERNAL' }));
    return json({ error: 'PAYPHONE_TEST_UNAVAILABLE' }, 503);
  }
});
