-- Add audio_url to gamedle_pool for soundtrack mode
alter table gamedle_pool add column if not exists audio_url text;
