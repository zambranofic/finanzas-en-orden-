# Annual FINORVE membership

Price: USD 29/year, manual renewal. No card tokenization or automatic charge authorization is collected. Current Payphone mode is TEST; activating live checkout requires setting the provider application to Production, verifying its mode, and setting PAYPHONE_LIVE_ENABLED=true in Supabase secrets. Do not set that flag while the app is in Test. Existing PayPal flow remains available while real Payphone validation is pending.

## Flow

- `/comprar.html`: guest purchase at the current server offer price. TEST charges $1 simulated and never creates a paid account. A live, confirmed payment produces an email-bound claim for the existing signup/login flow.
- `/renovar.html`: authenticated member quote and checkout. The server uses the saved annual price for an active member, otherwise the current offer. Browser amounts, price, mode and user identifiers cannot override it.
- Active renewals add one calendar year from the current expiry; expired renewals add one year from confirmation. Duplicate confirmed payments cannot add another year.
- Only validated Payphone transaction ID, client ID, amount, currency and Approved status can apply a live payment. Cancellation, mismatch, uncertainty and TEST cannot activate a license.
- Profile displays expiry, days remaining, original contracted annual price, renewal button and an internal calendar. All account screens show a persistent warning from 30 days before expiry. Expired access keeps the membership/renewal screen available; existing RLS enforces expiry for financial records.

## Email

Daily 09:00 America/Guayaquil queues one reminder for each member/expiry at 30, 15, 7 and 0 calendar days. Daily 09:05 runs delivery. A unique database key prevents duplicate reminders. Renewal invalidates outdated queued reminders. The worker only sends queued messages to their verified account recipient, never arbitrary caller-supplied addresses.

Actual delivery is pending `RESEND_API_KEY` and `MEMBERSHIP_EMAIL_FROM` for a verified sender/domain. Neither exists in the current configuration (`email_ready=false`). Until configured, the worker reports EMAIL_NOT_CONFIGURED and sends nothing. No claim of successful delivery has been made. Provider send idempotency keys are used; uncertain delivery is not blindly retried. A provider/domain account must be configured separately before activation.

## Storage and security

Apply `supabase/schema/annual-membership.sql` once, followed by `supabase/schema/payphone-purchase.sql`. Source SQL records the deployed changes. SQL-backed intent and reminder tables have RLS enabled, all client privileges revoked, and service-role-only mutations. All privileged RPCs revoke public/anonymous/authenticated execution. Existing private paid-claim function retains its original boundary and gains provider-aware, duplicate-safe application.

`payphone-membership` verifies the caller using Supabase Auth for renewal, binds confirmation to the member and a high-entropy one-use checkout secret, validates CORS, and rate limits actions. Guest confirmation requires the checkout secret and is restricted to a guest intent. The official SDK needs the merchant token only in runtime memory; neither token nor card data is persisted. Only the one-use intent secret is stored in sessionStorage. Never log provider responses, tokens or card/buyer data.

## Validation

`npm test`: existing application checks plus `membership-tests.mjs` covering price protection with a $35 future offer, expired pricing, ownership, malformed proof, duplicate confirmation, TEST isolation, and guest claim issuance.

Database rollback tests verified early extension, duplicate no-op, and unique reminders. No live transaction was executed, no actual member was granted or extended access by a test, and no email was sent. The original separate $1 provider simulation had already been approved/confirmed by the user before these changes.
