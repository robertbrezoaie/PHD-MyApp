#!/usr/bin/env bash
# Replaces the FreshLearn sync token (2026-10-26). The old token is written into
# supabase/migrations/20260330190000_freshlearn_cron.sql; after this script it is no longer accepted.
#   1. generates a new token
#   2. stores it in Vault as "freshlearn_cron_secret" (creates it, or updates it on later rotations)
#   3. sets it as the freshlearn-sync function's CRON_SECRET
#   4. reschedules the daily cron job to read the token from Vault each time it runs
# The token is written only to temporary files readable by you, deleted at the end; it is never printed.
# Run from the MyApp folder: bash scripts/rotate-freshlearn-cron-secret.sh
set -euo pipefail
REF=prgflhcpnhdxbabdnqhc
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
umask 077

TOKEN=$(openssl rand -hex 32)
cat > "$TMP/vault.sql" <<SQL
select case
  when exists (select 1 from vault.secrets where name = 'freshlearn_cron_secret')
  then (select vault.update_secret(id, '$TOKEN') from vault.secrets where name = 'freshlearn_cron_secret')::text
  else vault.create_secret('$TOKEN', 'freshlearn_cron_secret', 'Bearer token the freshlearn-daily-sync cron job sends to freshlearn-sync')::text
end as stored;
SQL
printf 'CRON_SECRET=%s\n' "$TOKEN" > "$TMP/cron.env"
unset TOKEN

echo "1/3 Storing the new token in Vault"
supabase db query --linked -f "$TMP/vault.sql" -o csv > /dev/null
echo "2/3 Setting CRON_SECRET for freshlearn-sync"
supabase secrets set --env-file "$TMP/cron.env" --project-ref "$REF" > /dev/null
echo "3/3 Rescheduling the cron job to read the token from Vault"
cat > "$TMP/cron.sql" <<'SQL'
select cron.unschedule('freshlearn-daily-sync') where exists (select 1 from cron.job where jobname = 'freshlearn-daily-sync');
select cron.schedule(
  'freshlearn-daily-sync',
  '0 3 * * *',
  $job$
  select net.http_post(
    url     := 'https://prgflhcpnhdxbabdnqhc.supabase.co/functions/v1/freshlearn-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'freshlearn_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $job$
);
SQL
supabase db query --linked -f "$TMP/cron.sql" -o csv > /dev/null
supabase db query --linked -o table "select jobname, schedule, active, command like '%vault.decrypted_secrets%' as reads_vault from cron.job"
echo "Done. The next nightly run (03:00 UTC) uses the new token."
