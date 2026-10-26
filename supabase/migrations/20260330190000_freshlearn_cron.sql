-- The original bearer token was removed from this file on 2026-10-26 (rotated, no longer valid).
-- The live job reads the token from Vault: see scripts/rotate-freshlearn-cron-secret.sh.
-- Enable pg_cron and pg_net extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Schedule daily sync at 3:00 AM UTC
select cron.schedule(
  'freshlearn-daily-sync',
  '0 3 * * *',
  $$
  select net.http_post(
    url    := 'https://prgflhcpnhdxbabdnqhc.supabase.co/functions/v1/freshlearn-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <redacted: token rotated 2026-10-26>'
    ),
    body   := '{}'::jsonb
  );
  $$
);
