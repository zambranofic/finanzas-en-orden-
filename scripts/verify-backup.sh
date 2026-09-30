#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RUNNER_TEMP:?Missing temporary directory}"
: "${FINORVE_BACKUP_PASSPHRASE:?Missing encryption passphrase}"
# This script accepts no destination URL: restoration is hard-wired to a new local container.
work="$RUNNER_TEMP/finorve-restore-check"
local_stack="$work/local"
container="supabase_db_finorve-restore-check"
cli=(npx --yes supabase@2.118.0)
cleanup() {
  "${cli[@]}" stop --workdir "$local_stack" --no-backup > /dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$local_stack"
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$RUNNER_TEMP/finorve-backup.tar.gz.gpg" 3<<<"$FINORVE_BACKUP_PASSPHRASE" | tar -xzf - -C "$work"
(cd "$work"; sha256sum --quiet -c SHA256SUMS)
"${cli[@]}" init --workdir "$local_stack" --yes > "$work/init.log" 2>&1
python3 - "$local_stack/supabase/config.toml" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
s = re.sub(r'^project_id = .*$', 'project_id = "finorve-restore-check"', s, flags=re.M)
s = re.sub(r'^major_version = .*$', 'major_version = 17', s, flags=re.M)
p.write_text(s)
PY
"${cli[@]}" start --workdir "$local_stack" -x realtime,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor > "$work/start.log" 2>&1 || { echo 'Isolated Supabase startup failed; no production writes performed.'; exit 1; }
# Remove all network access before any production-derived SQL is executed.
for network in $(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' "$container"); do
  docker network disconnect "$network" "$container"
done
# Grant the disposable postgres role bootstrap rights, then import as the same
# object creator as production so the bootstrap administrator's default ACLs
# do not grant extra privileges to application functions during restoration.
docker exec -i "$container" psql -U supabase_admin -d postgres -X -w -v ON_ERROR_STOP=1 -c 'ALTER ROLE postgres WITH SUPERUSER;' > "$work/bootstrap.log" 2>&1
psql_local=(docker exec -i "$container" psql -U postgres -d postgres -X -w -v ON_ERROR_STOP=1)
# pg_dump ACLs assume normal PostgreSQL defaults at object creation. Supabase's
# local bootstrap grants anon/authenticated extra rights by default, which can
# otherwise survive an import of source objects whose ACL excludes those roles.
# Reset only this fresh local creator's custom defaults; schema.sql restores the
# original defaults for future objects after restoring each object's actual ACL.
"${psql_local[@]}" > "$work/default-acl.log" 2>&1 <<'SQL'
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
SQL
"${psql_local[@]}" -c "CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;" > "$work/extensions.log" 2>&1
docker cp "$work/." "$container:/tmp/finorve-restore" > /dev/null
history=()
if [ -f "$work/history-schema.sql" ]; then
  history=(--file /tmp/finorve-restore/history-schema.sql --file /tmp/finorve-restore/history-data.sql)
fi
"${psql_local[@]}" --single-transaction --file /tmp/finorve-restore/roles.sql --file /tmp/finorve-restore/schema.sql --command 'SET session_replication_role = replica' --file /tmp/finorve-restore/data.sql --file /tmp/finorve-restore/managed-customizations.sql "${history[@]}" > "$work/restore.log" 2>&1 || {
  # Never print failing COPY values, user records, role passwords, or SQL function bodies.
  python3 - "$work/restore.log" <<'PY'
import re, sys
s = open(sys.argv[1]).read()
for line in s.splitlines():
    if 'ERROR:' in line:
        # Primary PostgreSQL error only; redact all quoted values and omit CONTEXT/DETAIL.
        primary = line.split('ERROR:', 1)[1].strip()
        primary = re.sub(r'"[^"]*"|\x27[^\x27]*\x27', '<redacted>', primary)
        location = re.search(r'/(roles|schema|data|managed-customizations|history-schema|history-data)\.sql:(\d+):', line)
        print('Restore failed' + (' in ' + location.group(1) + '.sql line ' + location.group(2) if location else '') + ': ' + primary)
        break
PY
  exit 1
}
python3 scripts/check-restored-backup.py "$work"
"${psql_local[@]}" < "$work/verify.sql" > "$work/verify.log" 2>&1 || {
  python3 - "$work/verify.log" <<'PY'
import re, sys
for line in open(sys.argv[1]):
    if 'ERROR:' in line:
        primary = line.split('ERROR:', 1)[1].strip()
        print('Verification failed: ' + re.sub(r'"[^"]*"|\x27[^\x27]*\x27', '<redacted>', primary))
        break
PY
  exit 1
}
echo 'Isolated restore passed: checksums, exact row counts, policies, managed triggers and application database/security checks.'
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  printf '%s\n' '### Database recovery test passed' 'Restored the encrypted export in an ephemeral Supabase/Postgres 17 container with network access disconnected. Verified checksums, all COPY row counts, RLS, policies, managed triggers and FINORVE database/security checks. Production was only read. No SQL or plaintext logs were uploaded. Cron activation, external Storage files, Edge Functions, Auth/SMTP settings and payment provider configuration remain part of manual disaster recovery.' >> "$GITHUB_STEP_SUMMARY"
fi
