-- Remove old single-shot refresh-catalog cron and replace with per-universe jobs
-- Each universe gets its own cron staggered 10 minutes apart on Sunday 03:xx UTC

select cron.unschedule('guessle-refresh-catalog');

do $$
declare
  universes text[] := array['lol','pokemon','naruto','onepiece','jujutsu','smash','zelda','mario','gow','monsterhunter'];
  slug      text;
  i         int    := 0;
begin
  foreach slug in array universes loop
    perform cron.schedule(
      'guessle-refresh-' || slug,
      (i * 10)::text || ' 3 * * 0',
      format(
        $$select net.http_post(
          url     := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body    := ('{"universe":"%s"}')::jsonb
        );$$,
        slug
      )
    );
    i := i + 1;
  end loop;
end $$;
