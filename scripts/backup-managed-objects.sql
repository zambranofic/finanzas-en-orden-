-- Read-only export of application customizations omitted from the standard dump.
SELECT '-- Managed schema customizations';
SELECT format(E'DROP TRIGGER IF EXISTS %I ON %I.%I;\n%s;', t.tgname, n.nspname, c.relname, pg_get_triggerdef(t.oid))
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc f ON f.oid = t.tgfoid
JOIN pg_namespace fn ON fn.oid = f.pronamespace
WHERE n.nspname IN ('auth', 'storage') AND NOT t.tgisinternal
  AND fn.nspname NOT IN ('auth', 'storage')
ORDER BY n.nspname, c.relname, t.tgname;
SELECT format(E'DROP POLICY IF EXISTS %I ON %I.%I;\nCREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
  policyname, schemaname, tablename, policyname, schemaname, tablename,
  permissive, cmd,
  (SELECT string_agg(quote_ident(r), ', ') FROM unnest(roles) r),
  CASE WHEN qual IS NULL THEN '' ELSE ' USING (' || qual || ')' END,
  CASE WHEN with_check IS NULL THEN '' ELSE ' WITH CHECK (' || with_check || ')' END)
FROM pg_policies WHERE schemaname IN ('auth', 'storage')
ORDER BY schemaname, tablename, policyname;
-- Recover job definitions paused. A human enables them only at the final destination.
SELECT format('WITH restored AS (SELECT cron.schedule(%L, %L, %L) AS id) SELECT cron.alter_job(id, active := false) FROM restored;',
  coalesce(jobname, 'restored-job-' || jobid::text), schedule, command)
FROM cron.job WHERE database = current_database() ORDER BY jobid;

-- Preserve the narrow recipient lookup permissions used by annual email delivery.
-- auth is managed and its custom ACLs are excluded from the ordinary schema dump.
SELECT format('GRANT SELECT (%I) ON auth.users TO service_role;', column_name)
FROM information_schema.column_privileges
WHERE table_schema='auth' AND table_name='users'
  AND grantee='service_role' AND privilege_type='SELECT'
  AND column_name IN ('id','email')
ORDER BY column_name;
