// Read-only configuration check. Never returns credentials or contacts Payphone.
// Gateway JWT verification must remain enabled.
const allowedOrigin = "https://finorve.com";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve((req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "ORIGIN_NOT_ALLOWED" }), { status: 403, headers });
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers });
  const token = (Deno.env.get("PAYPHONE_TOKEN") || "").trim();
  const storeId = (Deno.env.get("PAYPHONE_STORE_ID") || "").trim();
  const tokenPresent = token.length > 0;
  const tokenLooksLikeStoreId = uuid.test(token);
  const storeIdValid = uuid.test(storeId);
  return new Response(JSON.stringify({
    configured: tokenPresent && !tokenLooksLikeStoreId && storeIdValid && token !== storeId,
    token_present: tokenPresent,
    token_looks_like_store_id: tokenLooksLikeStoreId,
    store_id_present: storeId.length > 0,
    store_id_valid: storeIdValid,
    provider_credentials_verified: false,
    checkout_ready: false,
  }), { headers });
});
