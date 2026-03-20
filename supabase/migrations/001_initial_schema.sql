-- themes
create table themes (
  id     serial primary key,
  slug   text unique not null,
  name   text not null,
  icon   text not null,
  color  text not null,
  type   text not null check (type in ('character','game','code')),
  modes  text[] not null default '{}',
  active boolean default true
);

-- characters
create table characters (
  id         serial primary key,
  theme_id   int references themes(id),
  name       text not null,
  image_url  text,
  attributes jsonb not null default '{}',
  extra      jsonb not null default '{}',
  active     boolean default true,
  unique(theme_id, name)
);

-- gamedle_pool
create table gamedle_pool (
  id           serial primary key,
  igdb_id      int unique not null,
  name         text not null,
  genre        text[],
  platform     text[],
  developer    text,
  franchise    text,
  release_year int,
  multiplayer  boolean default false,
  active       boolean default true
);

-- daily_challenges
create table daily_challenges (
  id           serial primary key,
  theme_id     int references themes(id),
  mode         text not null,
  date         date not null,
  character_id int references characters(id) null,
  name         text not null,
  image_url    text,
  attributes   jsonb not null default '{}',
  extra        jsonb not null default '{}',
  content_hash text,
  unique(theme_id, mode, date),
  unique(theme_id, mode, content_hash)
);

create index idx_daily_lookup on daily_challenges(theme_id, mode, date);

-- game_sessions
create table game_sessions (
  id                 serial primary key,
  user_id            uuid references auth.users(id),
  daily_challenge_id int references daily_challenges(id),
  attempts           int default 0,
  hints_used         int default 0,
  won                boolean default false,
  score              int default 0,
  started_at         timestamptz default now(),
  completed_at       timestamptz,
  unique(user_id, daily_challenge_id)
);

-- guesses
create table guesses (
  id             serial primary key,
  session_id     int references game_sessions(id),
  attempt_number int not null,
  value          text not null,
  result         jsonb not null,
  created_at     timestamptz default now()
);

-- rankings
create table rankings (
  id             serial primary key,
  user_id        uuid references auth.users(id),
  theme_id       int references themes(id),
  total_wins     int default 0,
  total_games    int default 0,
  win_rate       decimal(5,2) default 0,
  avg_attempts   decimal(4,2) default 0,
  current_streak int default 0,
  best_streak    int default 0,
  score          int default 0,
  updated_at     timestamptz default now(),
  unique(user_id, theme_id)
);

-- indexes
create index idx_rankings_theme_score    on rankings(theme_id, score desc);
create index idx_rankings_global_score   on rankings(score desc);
create index idx_sessions_user_challenge on game_sessions(user_id, daily_challenge_id);
create index idx_guesses_session         on guesses(session_id, attempt_number);

-- ranking trigger
create or replace function fn_update_ranking()
returns trigger language plpgsql security definer as $$
declare
  v_theme_id   int;
  v_date       date;
  v_prev_won   boolean;
  v_win_inc    int;
  v_new_streak int;
  v_cur        rankings%rowtype;
begin
  if new.completed_at is null or old.completed_at is not null then
    return new;
  end if;

  select dc.theme_id, dc.date
  into v_theme_id, v_date
  from daily_challenges dc
  where dc.id = new.daily_challenge_id;

  select exists (
    select 1
    from game_sessions gs
    join daily_challenges dc on dc.id = gs.daily_challenge_id
    where gs.user_id = new.user_id
      and dc.theme_id = v_theme_id
      and dc.date = v_date - 1
      and gs.won = true
  ) into v_prev_won;

  insert into rankings (user_id, theme_id)
  values (new.user_id, v_theme_id)
  on conflict (user_id, theme_id) do nothing;

  select * into v_cur from rankings
  where user_id = new.user_id and theme_id = v_theme_id;

  v_win_inc := case when new.won then 1 else 0 end;

  v_new_streak := case
    when new.won and v_prev_won then v_cur.current_streak + 1
    when new.won                then 1
    else 0
  end;

  update rankings set
    total_wins     = v_cur.total_wins     + v_win_inc,
    total_games    = v_cur.total_games    + 1,
    score          = v_cur.score          + new.score,
    win_rate       = (v_cur.total_wins + v_win_inc)::decimal / (v_cur.total_games + 1) * 100,
    avg_attempts   = (v_cur.avg_attempts * v_cur.total_games + new.attempts) / (v_cur.total_games + 1),
    current_streak = v_new_streak,
    best_streak    = greatest(v_cur.best_streak, v_new_streak),
    updated_at     = now()
  where user_id = new.user_id and theme_id = v_theme_id;

  return new;
end;
$$;

create trigger trg_update_ranking
after update of completed_at on game_sessions
for each row execute function fn_update_ranking();

-- RLS
alter table themes           enable row level security;
alter table characters       enable row level security;
alter table gamedle_pool     enable row level security;
alter table daily_challenges enable row level security;
alter table game_sessions    enable row level security;
alter table guesses          enable row level security;
alter table rankings         enable row level security;

create policy "public read themes"           on themes           for select using (true);
create policy "public read characters"       on characters       for select using (true);
create policy "public read gamedle_pool"     on gamedle_pool     for select using (true);
create policy "public read daily_challenges" on daily_challenges for select using (true);
create policy "public read rankings"         on rankings         for select using (true);
create policy "auth select sessions"         on game_sessions    for select using (auth.uid() = user_id);
