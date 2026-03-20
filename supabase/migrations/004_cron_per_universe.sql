-- Remove old single-shot refresh-catalog cron and replace with per-universe jobs
-- Each universe gets its own cron staggered 10 minutes apart on Sunday 03:xx UTC

select cron.unschedule('guessle-refresh-catalog');

select cron.schedule('guessle-refresh-lol',          '0 3 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"lol"}'::jsonb);$q$);

select cron.schedule('guessle-refresh-pokemon',       '10 3 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"pokemon","offset":0}'::jsonb);$q$);

select cron.schedule('guessle-refresh-naruto',        '20 3 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"naruto"}'::jsonb);$q$);

select cron.schedule('guessle-refresh-onepiece',      '30 3 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"onepiece"}'::jsonb);$q$);

select cron.schedule('guessle-refresh-jujutsu',       '40 3 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"jujutsu"}'::jsonb);$q$);

select cron.schedule('guessle-refresh-smash',         '50 3 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"smash"}'::jsonb);$q$);

select cron.schedule('guessle-refresh-zelda',         '0 4 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"zelda"}'::jsonb);$q$);

select cron.schedule('guessle-refresh-mario',         '10 4 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"mario"}'::jsonb);$q$);

select cron.schedule('guessle-refresh-gow',           '20 4 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"gow"}'::jsonb);$q$);

select cron.schedule('guessle-refresh-monsterhunter', '30 4 * * 0', $q$select net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')), body := '{"universe":"monsterhunter"}'::jsonb);$q$);
