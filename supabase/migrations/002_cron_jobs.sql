-- Enable pg_cron and pg_net extensions (required for HTTP cron jobs)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Daily challenges at 10:00 UTC
select cron.schedule(
  'guessle-daily-challenges',
  '0 10 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/cron-daily-challenges',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Catalog refresh every Sunday at 03:00 UTC
select cron.schedule(
  'guessle-refresh-catalog',
  '0 3 * * 0',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
