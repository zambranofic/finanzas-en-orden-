# FINORVE — Recovery & Continuity Runbook

Last reviewed: 2026-09-30
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

Select a previously validated READY deployment from current Vercel history and record its deployment ID and commit before rollback. An older recorded deployment must not be assumed to contain today's fixes.

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
3. For the Free plan, inspect the external encrypted backups in GitHub Actions: `.github/workflows/finorve-backup.yml`. See BACKUP_FREE.md for seven-day retention, independent downloads and the isolated restore verification. Platform daily backups/PITR are not enabled by this external workflow.
4. Restore only after understanding the amount of data that will be lost between the restore point and the incident.

Supabase restore can require downtime. Database backups do not restore deleted Storage objects.

The external backup runs daily at 08:23 UTC (approximately 03:23 Ecuador). Each run saves an encrypted artifact before attempting an isolated, network-disconnected local recovery. A failed recovery test leaves the encrypted artifact available but must be investigated. Keep the encryption passphrase independently; it cannot be retrieved from the artifact.

Restore roles, application schema and data, managed Auth/Storage customizations and optional migration history in a fresh compatible target. The backup also preserves cron definitions, restored paused; activate them only after the final destination is validated. Local Supabase's bootstrap default ACLs can add unintended anon/authenticated privileges during import: use the isolation script's clean-creator setup, then verify the restricted RPC checks. Never copy its local superuser setup to production.

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
- Payphone membership configuration and Resend sender/domain; legacy PayPal webhook/config if used
- cron jobs `finorve-operational-maintenance`, `finorve-membership-reminders` and `finorve-membership-email-delivery`
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
1. Check the provider transaction ID and checkout intent: Payphone for current memberships, PayPal for legacy payments.
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

## 9. Verified recovery evidence and remaining work

On 2026-09-30, backup run `36787862866` passed an isolated database restore: 45 tables, 20 policies and one managed trigger. See `docs/recuperacion-respaldos.md` for artifact, encryption custody and scope. This is not a complete Auth, DNS or provider recovery.

All 21 deployed Edge Function sources matched the repository. `supabase/functions.snapshot.json` records source hashes, versions and JWT settings. Run `node scripts/verify-function-snapshot.mjs` before using this recovery revision. See `docs/recuperacion-funciones.md` for private variable names and deployment order.

The annual 314-record scenario passed backend persistence, edit, delete, invalid-input atomicity and isolation checks with rollback; see `docs/annual-database-validation.md`. Real browser income/sale CRUD was confirmed separately. These checks do not establish recovery in a new Supabase project.

For a full-service rehearsal, restore an isolated compatible destination first, configure its Auth redirects and mail settings, deploy the preserved functions, and replace embedded project URLs/public keys in frontend and functions. Keep scheduled sends and live payments disabled until the destination is verified. Validate registration, login, password recovery, licensed access, save/reload and account isolation. Verify Resend sender/domain, recipient permissions and renewal queue, then activate only the intended schedules. Reconcile payments and licenses before any production cutover.

Current membership behavior: annual access, manual renewal, expiry notices at 30/15/7/0 days and retained individual renewal price. A real membership payment and the first automatic eligible reminder remain pending. Independent custody of the backup passphrase and full-service recovery in another environment are not yet confirmed. Do not mark these items complete from source preservation or the database restore alone.
