#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${FINORVE_DB_URL:?Missing database connection}"
: "${FINORVE_BACKUP_PASSPHRASE:?Missing encryption passphrase}"
: "${RUNNER_TEMP:?Missing temporary directory}"
work="$RUNNER_TEMP/finorve-backup-work"
mkdir -p "$work"
trap 'rm -rf "$work"' EXIT
# Never enable shell tracing or upload SQL files to the public repository.
# All database operations below are exports; no restore or database writes.
cli=(npx --yes supabase@2.118.0)
"${cli[@]}" db dump --help >/dev/null
"${cli[@]}" db dump --db-url "$FINORVE_DB_URL" -f "$work/roles.sql" --role-only
"${cli[@]}" db dump --db-url "$FINORVE_DB_URL" -f "$work/schema.sql"
"${cli[@]}" db dump --db-url "$FINORVE_DB_URL" -f "$work/data.sql" --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
for part in roles schema data; do test -s "$work/$part.sql"; done
image='public.ecr.aws/supabase/postgres:17.6.1.171@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9'
remote_psql() {
  docker run --rm -i -e FINORVE_DB_URL "$image" sh -c 'exec psql "$FINORVE_DB_URL" -XAt -v ON_ERROR_STOP=1'
}
remote_psql < scripts/backup-managed-objects.sql > "$work/managed-customizations.sql" 2> "$work/catalog-export.log" || { echo 'Managed customization export failed.'; exit 1; }
remote_psql < scripts/backup-inventory.sql > "$work/inventory.json" 2> "$work/inventory-export.log" || { echo 'Recovery inventory export failed.'; exit 1; }
if [ "$(printf '%s\n' "SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL;" | remote_psql 2> "$work/history-check.log")" = 't' ]; then
  "${cli[@]}" db dump --db-url "$FINORVE_DB_URL" --schema supabase_migrations -f "$work/history-schema.sql"
  "${cli[@]}" db dump --db-url "$FINORVE_DB_URL" --schema supabase_migrations --data-only --use-copy -f "$work/history-data.sql"
fi
rm -f "$work/"*.log
(
  cd "$work"
  sha256sum ./*.sql inventory.json > SHA256SUMS
  date -u +'%Y-%m-%dT%H:%M:%SZ' > exported-at.txt
)
tar -czf - -C "$work" . | gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase-fd 3 --output "$RUNNER_TEMP/finorve-backup.tar.gz.gpg" 3<<<"$FINORVE_BACKUP_PASSPHRASE"
test -s "$RUNNER_TEMP/finorve-backup.tar.gz.gpg"
# Decrypt and check the archive before calling this a successful export.
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$RUNNER_TEMP/finorve-backup.tar.gz.gpg" 3<<<"$FINORVE_BACKUP_PASSPHRASE" | tar -tzf - >/dev/null
echo 'Encrypted database export created and archive verified; isolated restore follows.'
