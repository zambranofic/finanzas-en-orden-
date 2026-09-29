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
(
  cd "$work"
  sha256sum roles.sql schema.sql data.sql > SHA256SUMS
  date -u +'%Y-%m-%dT%H:%M:%SZ' > exported-at.txt
)
tar -czf - -C "$work" . | gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase-fd 3 --output "$RUNNER_TEMP/finorve-backup.tar.gz.gpg" 3<<<"$FINORVE_BACKUP_PASSPHRASE"
test -s "$RUNNER_TEMP/finorve-backup.tar.gz.gpg"
# Decrypt and check the archive before calling this a successful export.
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$RUNNER_TEMP/finorve-backup.tar.gz.gpg" 3<<<"$FINORVE_BACKUP_PASSPHRASE" | tar -tzf - >/dev/null
echo 'Encrypted database export created and archive verified; restore test still required.'
