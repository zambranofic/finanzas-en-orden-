"""Build private verification SQL from the COPY dump and source inventory."""
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
counts = {}
table = None
for line in (root / 'data.sql').read_text().splitlines():
    if table is not None:
        if line == r'\.':
            table = None
        else:
            counts[table] += 1
    elif line.startswith('COPY ') and line.endswith(' FROM stdin;'):
        table = line[5:].split(' (', 1)[0]
        # pg_dump emits quoted or ordinary identifiers, never executable names.
        if not re.fullmatch(r'(?:"(?:[^"]|"")+"|[a-zA-Z_][a-zA-Z_0-9$]*)\.(?:"(?:[^"]|"")+"|[a-zA-Z_][a-zA-Z_0-9$]*)', table):
            raise ValueError('Unexpected COPY table identifier')
        if table in counts:
            raise ValueError('Repeated COPY table')
        counts[table] = 0
if table is not None or not counts:
    raise ValueError('Incomplete COPY dump')

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

checks = []
for name, count in counts.items():
    checks.append(f"IF (SELECT count(*) FROM {name}) <> {count} THEN RAISE EXCEPTION 'Restored row count mismatch'; END IF;")
inventory = json.loads((root / 'inventory.json').read_text())
for item in inventory['rls']:
    checks.append(f"IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname={literal(item['schema'])} AND tablename={literal(item['table'])} AND rowsecurity={'true' if item['enabled'] else 'false'}) THEN RAISE EXCEPTION 'RLS mismatch'; END IF;")
for item in inventory['policies']:
    # Compare every policy property, not only the policy name.
    checks.append(f"IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE row_to_json(p)::jsonb = {literal(json.dumps(item))}::jsonb) THEN RAISE EXCEPTION 'Policy mismatch'; END IF;")
for item in inventory['managed_triggers']:
    checks.append(f"IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname={literal(item['schema'])} AND c.relname={literal(item['table'])} AND t.tgname={literal(item['name'])} AND pg_get_triggerdef(t.oid)={literal(item['definition'])} AND t.tgenabled={literal(item['enabled'])}) THEN RAISE EXCEPTION 'Managed trigger mismatch'; END IF;")
checks.append("health := private.recovery_healthcheck(); IF (health->>'database_ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Database health check failed'; END IF;")
checks.append("FOR category IN SELECT unnest(ARRAY['tables','functions','security']) LOOP IF EXISTS (SELECT 1 FROM jsonb_each(health->category) WHERE value <> 'true'::jsonb) THEN RAISE EXCEPTION 'Application recovery check failed'; END IF; END LOOP;")
sql = "DO $verify$ DECLARE health jsonb; category text; BEGIN\n" + '\n'.join(checks) + "\nEND $verify$;\n"
(root / 'verify.sql').write_text(sql)
print(f"Prepared checks for {len(counts)} tables, {len(inventory['policies'])} policies and {len(inventory['managed_triggers'])} managed triggers.")
