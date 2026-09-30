SELECT json_build_object(
  'policies', (SELECT coalesce(json_agg(row_to_json(p) ORDER BY schemaname, tablename, policyname), '[]'::json)
    FROM pg_policies p WHERE schemaname IN ('public', 'private', 'auth', 'storage')),
  'rls', (SELECT coalesce(json_agg(json_build_object('schema', schemaname, 'table', tablename, 'enabled', rowsecurity) ORDER BY schemaname, tablename), '[]'::json)
    FROM pg_tables WHERE schemaname IN ('public', 'private')),
  'extensions', (SELECT json_agg(json_build_object('name', extname, 'version', extversion)) FROM pg_extension),
  'cron', (SELECT coalesce(json_agg(json_build_object('name', jobname, 'schedule', schedule, 'command', command, 'active', active)), '[]'::json) FROM cron.job),
  'managed_triggers', (SELECT coalesce(json_agg(json_build_object('schema', n.nspname, 'table', c.relname, 'name', t.tgname, 'definition', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled) ORDER BY n.nspname, c.relname, t.tgname), '[]'::json)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc f ON f.oid=t.tgfoid JOIN pg_namespace fn ON fn.oid=f.pronamespace
    WHERE n.nspname IN ('auth', 'storage') AND NOT t.tgisinternal AND fn.nspname NOT IN ('auth', 'storage'))
);
