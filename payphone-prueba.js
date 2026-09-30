const ENDPOINT = 'https://euqhrqsatbhnxgohbild.supabase.co/functions/v1/payphone-test-checkout';
const KEY = 'sb_publishable_Ltn-8m11gMlS2AY14k8nfA_hcJ3Izjl';
const PREFIX = 'finorve-payphone-test:';
const status = document.getElementById('status');
let inFlight = false;
let processingTimer = null;
const messages = {
  PAYPHONE_NOT_CONFIGURED: 'Falta la configuración de Payphone. No se ha iniciado el pago.',
  PAYPHONE_CREDENTIALS_REJECTED: 'Payphone no acepta las credenciales configuradas. Hay que revisarlas antes de continuar.',
  CHECKOUT_EXPIRED: 'La prueba ha caducado. Regresa a la pantalla de prueba para comenzar otra.',
  TOO_MANY_ATTEMPTS: 'Se han realizado varios intentos. Espera cinco minutos antes de volver a probar.',
  CONFIRMATION_IN_PROGRESS: 'La confirmación está en curso. Espera antes de volver a consultar.',
  CONFIRMATION_REQUIRES_REVIEW: 'El resultado requiere revisión. No repitas el pago; no se ha activado ningún acceso.',
  PAYPHONE_CONFIRMATION_UNCERTAIN: 'No se pudo obtener una respuesta definitiva. No repitas el pago; hay que revisar la transacción en Payphone.',
  PAYPHONE_CONFIRMATION_FAILED: 'Payphone no pudo confirmar esta prueba. Hay que revisar la transacción antes de repetirla.',
  PAYPHONE_VERIFICATION_FAILED: 'Los datos de la respuesta no coinciden con la prueba iniciada. No se ha activado ningún acceso.',
};
function show(text, kind = '') { status.textContent = text; status.className = kind; }
async function request(body) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(25000), cache: 'no-store' });
  const payload = await r.json();
  if (!r.ok) throw new Error(messages[payload?.error] || 'No se pudo completar la prueba. Conserva esta pantalla para revisar el resultado.');
  return payload;
}
function saveIntent(intent) {
  // Keep only this one-use checkout secret. Never persist the merchant token or card details.
  sessionStorage.setItem(PREFIX + intent.checkout_id, JSON.stringify({ checkout_id: intent.checkout_id, checkout_secret: intent.checkout_secret, expires_at: intent.expires_at }));
}
function readIntent(cid) { try { return JSON.parse(sessionStorage.getItem(PREFIX + cid)); } catch { return null; } }
function displayResult(result) {
  if (result.mode !== 'test' || result.access_activated !== false) throw new Error('La respuesta no corresponde a una prueba segura.');
  if (result.status === 'approved' || result.status === 'cancelled') {
    clearTimeout(processingTimer);
    const container = document.getElementById('pp-button'); if (container) container.hidden = true;
    show(result.status === 'approved' ? 'Prueba aprobada y confirmada. No se ha activado ningún acceso de pago.' : 'Payphone registra esta prueba como cancelada. No se ha activado ningún acceso.', result.status === 'approved' ? 'success' : '');
  } else show('El resultado está pendiente. No repitas el pago; puedes consultar de nuevo.', 'error');
}
async function checkStatus(cid) {
  const intent = readIntent(cid);
  if (!intent || inFlight) return;
  show('Consultando el resultado de la prueba anterior…');
  try {
    const result = await request({ action: 'status', checkout_id: cid, checkout_secret: intent.checkout_secret });
    if (result.status === 'needs_confirmation') await confirm(result.transaction_id, cid);
    else displayResult(result);
  } catch (e) { show(e.message || 'No se pudo consultar el resultado. No repitas el pago.', 'error'); }
}
function addStatusButton(cid) {
  const existing = document.getElementById('check-status');
  if (existing) { existing.dataset.checkoutId = cid; return; }
  const button = document.createElement('button'); button.id = 'check-status'; button.type = 'button'; button.textContent = 'Consultar resultado sin repetir el pago';
  button.dataset.checkoutId = cid;
  button.addEventListener('click', async () => { button.disabled = true; try { await checkStatus(button.dataset.checkoutId); } finally { button.disabled = false; } });
  status.insertAdjacentElement('afterend', button);
}
async function confirm(transactionId, cid) {
  if (inFlight) return;
  const intent = readIntent(cid);
  if (!intent || intent.checkout_id !== cid) { show('No encontramos la prueba iniciada en esta pestaña. Hay que revisar la transacción en Payphone antes de repetirla.', 'error'); return; }
  inFlight = true;
  show('Confirmando el resultado con Payphone…');
  try {
    const result = await request({ action: 'confirm', checkout_id: cid, checkout_secret: intent.checkout_secret, transaction_id: String(transactionId) });
    displayResult(result);
  } catch (e) { show(e.message || 'No se pudo confirmar el resultado. No repitas el pago.', 'error'); }
  finally { inFlight = false; }
}
async function loadSDK() {
  if (window.PPaymentButtonBox) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css'; document.head.append(link);
  await new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.type = 'module'; script.src = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js';
    const timer = setTimeout(() => reject(new Error('Payphone tarda en cargar. Actualiza la pantalla para volver a intentarlo.')), 20000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('No se pudo cargar el formulario de Payphone.')); };
    document.head.append(script);
  });
  if (!window.PPaymentButtonBox) throw new Error('El formulario de Payphone no está disponible.');
}
const form = document.getElementById('test-form');
if (form) form.addEventListener('submit', async event => {
  event.preventDefault();
  const start = document.getElementById('start');
  if (start.disabled || !document.getElementById('test-mode').checked) return;
  start.disabled = true; show('Preparando el formulario de Payphone…');
  try {
    await loadSDK();
    const intent = await request({ action: 'create', confirm_test_mode: true });
    if (intent.mode !== 'test') throw new Error('La configuración no corresponde a una prueba.');
    saveIntent(intent);
    const cid = intent.checkout_id;
    addStatusButton(cid);
    const box = new window.PPaymentButtonBox({ ...intent.box, isAsyncResponse: true,
      showPayphonePayment: false, showCashPayment: false, showClickToPay: false, showPaymentMethodSelector: false });
    const handlePaymentResult = result => {
      if (result?.transactionId && result?.clientTransactionId === cid) confirm(result.transactionId, cid);
      else if (result === 'errorProcess') { clearTimeout(processingTimer); show('Payphone no pudo completar la prueba. Revisa el mensaje del formulario.', 'error'); }
      else if (result === 'errorValidation') { clearTimeout(processingTimer); show('Revisa los campos indicados por Payphone antes de continuar.', 'error'); }
    };
    // v2.0 dispatches its async result as a DOM event. Its callback setter alone
    // does not subscribe to that event when the provider's own Pagar button is used.
    window.addEventListener('processPaymentAsync', event => handlePaymentResult(event.detail));
    box.onCompletedPayment(handlePaymentResult);
    box.render('pp-button');
    document.getElementById('pp-button').hidden = false;
    document.getElementById('pp-button').addEventListener('submit', () => {
      show('Payphone está procesando la prueba. No vuelvas a pulsar Pagar.');
      clearTimeout(processingTimer);
      processingTimer = setTimeout(() => show('Payphone tarda en responder. Usa Consultar resultado sin repetir el pago.', 'error'), 45000);
    }, { capture: true });
    delete intent.box.token;
    form.hidden = true;
    show('Completa el formulario de Payphone. La confirmación aparecerá aquí mismo.');
  } catch (e) { start.disabled = false; show(e.message || 'No se pudo cargar el formulario.', 'error'); }
});
if (form) {
  // Recover only this app's existing one-use intent, without creating another payment.
  const intents = Object.keys(sessionStorage).filter(key => key.startsWith(PREFIX)).map(key => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } }).filter(x => x?.checkout_id && Date.parse(x.expires_at) > Date.now()).sort((a, b) => Date.parse(b.expires_at) - Date.parse(a.expires_at));
  if (intents[0]) { addStatusButton(intents[0].checkout_id); checkStatus(intents[0].checkout_id); }
}
if (!form) {
  const query = new URLSearchParams(location.search);
  const tid = query.get('id'); const cid = query.get('clientTransactionId');
  history.replaceState(null, '', location.pathname);
  if (tid && cid) confirm(tid, cid);
  else show('Esta página muestra el resultado cuando Payphone devuelve una transacción. Comienza desde la pantalla de prueba.');
}
