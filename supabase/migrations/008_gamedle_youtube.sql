-- Add YouTube fields to gamedle_pool for soundtrack mode
alter table gamedle_pool add column if not exists youtube_id    text;
alter table gamedle_pool add column if not exists youtube_start integer not null default 0;
