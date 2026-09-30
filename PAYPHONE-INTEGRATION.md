# Payphone integration rehearsal

Routes: `/payphone-prueba.html` and the registered callback `/payphone-respuesta.html`.

This is a separate test workflow, not the live purchase flow. Before opening the provider form, the operator must check that FINORVE Web is in Prueba in Payphone Developers. The page fixes the amount to 100 USD cents and never activates access. It does not infer Payphone's environment from browser input; the checkbox is an operator confirmation. Do not use this rehearsal with a production app token.

Server secrets: `PAYPHONE_TOKEN` and `PAYPHONE_STORE_ID`. The official Cajita SDK requires the merchant app token in browser memory. It is supplied only at runtime and is never committed, written to browser storage, logged, or placed in a URL. The confirmation uses the server token. No card details are stored by the app.

`payphone_test_intents` is separate from `checkout_intents`, `payments`, `licenses`, and Auth. RLS and revoked client grants deny direct access. Only backend service role may read or write test intents. `supabase/schema/payphone-test-intents.sql` is the reproducible schema source, applied through the Supabase connector.

The guest API requires the existing public application key. This is app identification, not a privileged authorization boundary. Confirmation additionally requires a random checkout secret validated against its SHA-256 hash, verifies Payphone transaction and client IDs, amount and currency, and serializes concurrent confirmation requests. Completed requests are recovered without another provider call. Uncertain upstream responses require review instead of blindly repeating confirmation.

Provider SDK: official versioned v2.0 JS and CSS. Async completion confirms within the same page; the registered response route handles redirect fallback in the same tab. Checkout secrets stay in sessionStorage, never in callback URLs. A lost tab/session cannot claim a payment or activate access.

Validation: existing 14 test suites pass, plus Payphone-specific fixtures covering altered amount/currency/IDs, missing and incorrect configuration, guest key and secret authorization, origin restrictions, replay, concurrency, and uncertain network response. Deployed Supabase configuration check confirms both secret values exist and StoreID format is valid; that check does not authenticate with Payphone.

Pending before live checkout: real provider form and test transaction verification, confirmation response evidence, pricing/tax and access duration decision, secure paid account claim integration and reconciliation, then a deliberate move to production. Keep sandbox transactions isolated permanently.
