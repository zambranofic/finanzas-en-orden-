# FINORVE — Recovery & Continuity Runbook

Last reviewed: 2026-09-29
Production domain: https://finorve.com

## 1. First response to an incident

Do not change database data or redeploy repeatedly before identifying the failing layer.

1. Check the latest Vercel production deployment state.
2. Check Vercel runtime/build errors.
3. Check Supabase project status and Edge Function logs.
4. Run:
   `select private.recovery_healthcheck();`
5. Decide whether the incident is frontend-only, Edge Function/payment-related, or database/schema-related.

## 2. Vercel rollback

Current known-good production deployment at review time:

- Deployment: `dpl_2FHqLAkp5CJxzi5wncPLduAMpN1V`
- Commit: `4240d4dd66c2de83aea58400b8685e1073da15ba`
- Status at review: READY
- Includes FINORVE admin observability UI.

If a newer frontend deployment breaks production, prefer an instant Vercel rollback/promote to a previously validated READY deployment instead of rebuilding the broken commit.

After rollback, verify:
- https://finorve.com loads
- `app-v4.js`, `supabase-store.js`, and `styles.css` return successfully
- checkout gate renders
- login renders
- no new production runtime error cluster appears

Important: a Vercel rollback only reverts frontend/static deployment state. It does NOT roll back Supabase schema, data, Edge Functions, Auth, or Storage.

## 3. Supabase recovery

Project ref: `euqhrqsatbhnxgohbild`

Before any database restore:
1. Record the exact incident timestamp in UTC.
2. Export or record any payment/checkouts that happened after the desired restore point.
3. Confirm whether scheduled daily backups or PITR are enabled in Supabase Dashboard > Database > Backups.
4. Restore only after understanding the amount of data that will be lost between the restore point and the incident.

Supabase restore can require downtime. Database backups do not restore deleted Storage objects.

After a restore, run:
`select private.recovery_healthcheck();`

Expected:
- database_ok = true
- profiles = true
- movements = true
- licenses = true
- payments = true
- checkout_intents = true
- payment_events = true
- replace_my_movements = true
- has_active_license = true
- claim_paid_checkout = true
- admin_ops_summary = true
- operational_maintenance = true

Then verify:
- RLS advisors
- performance advisors
- Edge Functions and versions
- PayPal webhook/config
- cron job `finorve-operational-maintenance`
- one licensed synthetic isolation test inside a transaction with ROLLBACK

## 4. Database migration discipline

For changes that can affect production data:
1. Read current schema/function/policy definitions first.
2. Make backward-compatible changes where possible.
3. Never drop data columns/tables in the same release that stops using them.
4. Verify RLS after any policy/function change.
5. Run a synthetic transactional test with ROLLBACK.
6. Run Supabase security and performance advisors.
7. Only then update the frontend that depends on the migration.

When a migration fails, verify whether it was transactional before retrying. Never assume partial success.

## 5. Payment incident priorities

Do not ask a customer to pay again until checkout state is inspected.

Relevant states:
- checkout: created, approved, completed, claimed, cancelled, failed, refunded, reversed
- payment: completed, refunded, reversed, denied
- license: active, inactive, revoked, refunded

For “paid but no access”:
1. Check checkout by PayPal order/capture ID.
2. If checkout is completed, recover the claim rather than create a second payment.
3. Verify the payment row.
4. Verify license status.
5. Check recent PayPal events.
6. Re-run access claim only through the existing verified claim flow.

## 6. Data protection boundaries

Never restore or overwrite production merely to correct a UI issue.

Critical tables not covered by automatic operational cleanup:
- payments
- licenses
- movements
- profiles
- admin_audit_log

Operational cleanup intentionally targets only stale/terminal checkout intents, old PayPal events, and old cron run logs.

## 7. Post-incident checklist

Before declaring recovery complete:
- Production deployment is READY.
- FINORVE domain resolves to the intended deployment.
- `private.recovery_healthcheck()` is fully green.
- Security advisor has no new high-risk finding.
- RLS isolation test passes.
- Checkout/public PayPal endpoints are restricted to FINORVE origins where applicable.
- Admin endpoints still require JWT + admin role.
- Payment webhook remains active.
- Operational maintenance cron is active.
- No unexplained runtime or Edge Function error spike remains.

## 8. Recovery principle

Frontend failures should be handled with Vercel rollback first.
Database/data incidents require Supabase restore planning first.
Never combine a frontend rollback with an automatic database restore unless both layers are proven to be part of the same incident.
