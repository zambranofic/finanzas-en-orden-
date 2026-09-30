# Paid access verification

A passing unit suite or an administrator SQL call does not prove checkout works.

Before calling a checkout defect resolved:

1. Read the precise error from the failed request and its Auth/database logs.
2. Test account insertion, the final trusted app metadata, and the paid checkout guard in one transaction.
3. Call claim_paid_checkout_internal as service_role, the actual Edge Function role. Assert a claimed checkout, a matching completed payment, and an active license. Roll back verification data.
4. Verify negative cases: no captured payment, user_metadata spoofing, wrong email, expired claim, and callers anon/authenticated.
5. Confirm the intended code is actually deployed. A merge blocked by Vercel quota is not a release.
6. Complete the real browser Sandbox journey: payment, new account, automatic license, onboarding, reload, and sign in. Retain red status until this succeeds without a manual license grant.

Track separately: implementation complete, service-role verification passed, production deployed, and browser journey validated. Do not repeatedly ask the buyer to retry without new server evidence.

## 2026-09-30 incident evidence

- ACCOUNT_CREATE_FAILED: Auth admin creation inserts the row before updating app_metadata; fixed by a deferred constraint trigger checking the final row and captured payment.
- ACCESS_ACTIVATION_FAILED: service_role could invoke the public wrapper but lacked EXECUTE on private.claim_paid_checkout; repaired with a service-only grant.
- Full database transaction now passes with SET LOCAL ROLE service_role, including payment association and license activation. It rolls back the temporary account and checkout changes.
- Anonymous and authenticated clients remain unable to invoke the private claim function.
- Browser confirmation remains pending; intermittent PayPal capture 503 is still not root-caused.
