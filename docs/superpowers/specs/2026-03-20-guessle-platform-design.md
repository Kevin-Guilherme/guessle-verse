# Guessle Platform — Design Document

**Date:** 2026-03-20
**Status:** Approved
**Author:** Kevin Souza

---

## Overview

Guessle is a daily games hub in the Wordle style with multiple themed universes. Each universe offers multiple game modes. The platform uses a monorepo architecture with Next.js 14 (App Router), Supabase (Postgres + Auth + Edge Functions), and Turborepo.

---

## Scope

- 14 game universes, all modes per universe (full spec — no MVP reduction)
- Email/password authentication only (Supabase Auth)
- Character data for universes without public APIs sourced from fandom wikis via automated scraper
- Code puzzles (JSdle, TSdle, Pythondle) generated daily via Groq LLM

---

## Architecture

### System Layers

```
Vercel (Next.js 14 App Router)
  Pages (RSC + Client)
  API Routes /api/guess, /api/session
  Mode Registry (dynamic imports)
        |
Supabase
  Postgres + RLS
  Auth (email/password)
  Edge Functions (cron + scraper + code gen)
```

### Monorepo Structure

```
guessle/
├── apps/web/          # Next.js 14 — single app
├── packages/shared/   # types + feedback utils
└── supabase/          # migrations + functions + seed
```

**Key decisions:**
- RSC for static pages (home, universe hub); Client Components for game state
- Frontend reads exclusively from Supabase — no direct external API calls from browser
- Edge Functions handle all external API interactions (cron, wiki scraping, Groq)
- Mode Registry in `apps/web/lib/game/registry.ts` maps slug to dynamic import
- Guess submission goes through `/api/guess` (Next.js API Route) — server validates result before persisting to prevent client-side manipulation

---

## Access Control

| Route | Unauthenticated | Authenticated |
|---|---|---|
| `/` | Public | Public |
| `/games/[slug]` | Public | Public |
| `/games/[slug]/[mode]` | Play (state in memory only, no DB writes) | Play + persist session |
| `/ranking` | Public read | Public read |
| `/ranking/[slug]` | Public read | Public read |
| `/profile` | Redirect to `/login` | Full access |
| `/login` | Access | Redirect to `/` |
| `/register` | Access | Redirect to `/` |

Unauthenticated users can play and view rankings. Only `/profile` requires authentication.

---

## Database Schema

### Table: `themes`

```sql
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
```

### Table: `characters`

```sql
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
```

### Table: `gamedle_pool`

Fixed pool of 150 curated games for the Gamedle universe. Populated via seed SQL. IGDB is queried at cron time to fetch cover/screenshot URLs; these are stored in `daily_challenges.image_url` and `extra`. The pool table itself does not store images — it is a catalog of game metadata only.

```sql
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
```

Anti-repetition for Gamedle uses the same 60-day lookback on `daily_challenges.name`.

### Table: `daily_challenges`

Stores complete data snapshots at cron time. No re-fetching needed at game time.

```sql
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
  unique(theme_id, mode, content_hash)  -- prevents duplicate code puzzles across days
);

create index idx_daily_lookup on daily_challenges(theme_id, mode, date);
```

`content_hash` = SHA-256 of `attributes->>'code'` for code modes; null for all other modes.

**JSONB shape by mode type:**

Classic/Visual/Audio modes (character-based):
```json
{
  "attributes": { "type1": "fire", "type2": null, "generation": 1, "color": "red" },
  "extra": { "cry_url": "...", "silhouette_url": "...", "abilities": [] }
}
```

Code modes (JSdle / TSdle / Pythondle):
```json
{
  "attributes": {
    "code": "const x = ___",
    "answer": "42",
    "difficulty": "medium",
    "mode_variant": "complete"
  },
  "extra": { "explanation": "..." }
}
```

### Table: `game_sessions`

Sessions are always created with `completed_at = null`. They are updated (never re-inserted) to set `completed_at` when a game ends. This ensures the ranking trigger fires on UPDATE only.

```sql
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
```

### Table: `guesses`

```sql
create table guesses (
  id             serial primary key,
  session_id     int references game_sessions(id),
  attempt_number int not null,
  value          text not null,
  result         jsonb not null,
  created_at     timestamptz default now()
);
```

`result` shape: `[{ key, label, value, feedback: 'correct'|'partial'|'wrong'|'higher'|'lower' }]`

### Table: `rankings`

```sql
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
```

### Ranking Trigger

Fires only on `UPDATE OF completed_at` (never on INSERT — sessions are always inserted with `completed_at = null`).

Streak is per `theme_id`, not per mode. A win in any mode within the same universe on consecutive calendar days counts toward the streak.

`win_rate` and `avg_attempts` are computed incrementally to avoid full-table scans:
- `win_rate = (total_wins + win_increment) / (total_games + 1) * 100`
- `avg_attempts = (avg_attempts * total_games + new.attempts) / (total_games + 1)`

```sql
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
```

### Additional Indexes

```sql
create index idx_rankings_theme_score    on rankings(theme_id, score desc);
create index idx_rankings_global_score   on rankings(score desc);
create index idx_sessions_user_challenge on game_sessions(user_id, daily_challenge_id);
create index idx_guesses_session         on guesses(session_id, attempt_number);
```

### RLS Policies

```sql
create policy "public read themes"           on themes           for select using (true);
create policy "public read characters"       on characters       for select using (true);
create policy "public read daily_challenges" on daily_challenges for select using (true);
create policy "public read rankings"         on rankings         for select using (true);
create policy "auth select sessions"         on game_sessions    for select using (auth.uid() = user_id);
```

Writes to `game_sessions` and `guesses` are performed server-side via `/api/guess` using the Supabase service role key. No client-side write policies needed.

---

## Game Engine — Mode Registry Pattern

### Mode Contract

```typescript
interface ModeConfig {
  slug:        string
  label:       string
  maxAttempts: number | null  // null = unlimited
  lives?:      number         // Quadra = 4
  attributes?: AttributeConfig[]
}

interface ModeProps {
  challenge:  DailyChallenge
  session:    GameSession | null
  config:     ModeConfig
  onGuess:    (value: string) => Promise<AttributeFeedback[]>
  onComplete: (won: boolean) => void
}
```

### Registry (`apps/web/lib/game/registry.ts`)

Maps mode slug to dynamic import. Multiple slugs can point to the same component (e.g., `fix`, `complete`, `output` all map to `CodeMode`). Adding a new mode requires one file + one registry entry — no changes to core files.

### Scoring

Single source of truth in `apps/web/lib/game/score.ts`:

```
base:              1000 pts
penalty per wrong:   40 pts
hint 1 (after 5):  150 pts
hint 2 (after 10): 200 pts
minimum score:      50 pts
```

`calculateScore(attempts: number, hintsUsed: number): number`

Hints are unlocked by attempt count — not configurable per mode. Code modes have no hints (max 3 attempts, no hint system).

### Feedback Engine

`computeFeedback(guessValue, targetValue, compareMode)` in `packages/shared/utils/feedback.ts`

- `exact` → correct | wrong
- `partial` → correct | partial | wrong (array intersection)
- `arrow` → correct | higher | lower (numeric comparison)

Runs server-side in `/api/guess`. Client receives `AttributeFeedback[]` as the API response and renders it directly — no client-side computation.

### API Route: `/api/session`

```
POST /api/session
Body: { challengeId }
Auth: Supabase session cookie — required (unauthenticated users skip this call)

Server flow:
1. Resolve user_id from session cookie
2. INSERT INTO game_sessions (user_id, daily_challenge_id, completed_at=null)
   ON CONFLICT (user_id, daily_challenge_id) DO NOTHING
3. SELECT session row for this user + challenge
4. Return: { sessionId: number, attempts: number, hintsUsed: number, won: boolean, completedAt: string | null }
```

Used by `useGameSession` on mount to create or recover an existing session.

### API Route: `/api/guess`

```
POST /api/guess
Body: { challengeId, value }
Auth: Supabase session cookie — optional

Server flow:
1. Load daily_challenge by challengeId
2. Determine mode type from daily_challenge.attributes.mode_variant or mode slug
3. Compute feedback:
   - Character modes: find candidate by name in characters/gamedle_pool for this theme;
     run computeFeedback() per attribute against daily_challenge.attributes
   - Code modes: skip candidate lookup; compare value directly against
     daily_challenge.attributes->>'answer' (exact match, case-sensitive)
4. If authenticated (auth.uid() present):
   a. Upsert game_session (INSERT if not exists, then UPDATE attempts++)
   b. INSERT into guesses
   c. If correct: UPDATE session set won=true, score=calculateScore(), completed_at=now()
5. If unauthenticated: skip all DB writes
6. Return: { feedback: AttributeFeedback[], won: boolean, score?: number }
```

Sessions are always INSERTed first with `completed_at = null` (step 4a). `completed_at` is only SET on the UPDATE in step 4c. This guarantees the ranking trigger fires on the correct transition.

---

## Game Modes

### Classic (all character universes)
SearchInput with fuzzy autocomplete + GuessRow grid of AttributeCell components. Unlimited attempts. Hints at 5 and 10 wrong guesses.

### Visual Modes
| Mode | Mechanic |
|---|---|
| Silhouette | CSS `filter: brightness(0)` image; brightness increases each wrong attempt |
| Splash | Zoomed crop of splash art; crop progressively widens each wrong attempt |
| Wanted | One Piece wanted poster with bounty value shown |
| Kirby | Kirby copying the character's ability; guess the fighter |

### Audio Modes
| Mode | Mechanic |
|---|---|
| Audio / Cry | Web Audio API player; reveals a longer clip each wrong attempt |

### Ability/Skill Modes
| Mode | Mechanic |
|---|---|
| Ability | Show ability icon without name; guess the character |
| Build | Show champion build items without champion name; guess the champion |
| Skill Order | Show skill max priority order; guess the champion |
| Final Smash | Show final smash description/image; guess the Smash fighter |

### Weakness Mode (Monster Hunter)
Show a monster's elemental weaknesses (fire/water/ice/thunder/dragon ratings) without the monster's name or image. Guess the monster. Unlimited attempts, hints at 5 and 10.

### Special Mechanics
| Mode | Max Attempts | Lives | Hints |
|---|---|---|---|
| Quadra | Unlimited | 4 | None |
| Code (complete/fix/output) | 3 | — | None |
| All others | Unlimited | — | 2 (at 5 and 10 wrong) |

### Quote Mode
Obfuscated quote text with most characters replaced by `_`. One additional word revealed per wrong attempt. Guess the character who said the quote.

### Code Modes (JSdle / TSdle / Pythondle)
Monaco-lite editor. 3 attempts maximum. No hints. Puzzles generated daily by Groq LLM and stored in `daily_challenges`. Answer comparison is exact string match server-side.

---

## Data Pipeline

### Edge Functions

| Function | Schedule | Invocation |
|---|---|---|
| `cron-daily-challenges` | `0 10 * * *` UTC | pg_cron via net.http_post |
| `refresh-catalog` | `0 3 * * 0` UTC | pg_cron via net.http_post |
| `generate-code-puzzle` | No schedule | HTTP call from `cron-daily-challenges` via supabase.functions.invoke() |

`cron-daily-challenges` calls `generate-code-puzzle` for each code universe × mode variant. It is not independently scheduled.

### Fetcher Strategy per Universe

| Universe | Source |
|---|---|
| Pokemon | PokeAPI (pokeapi.co) |
| LoL | Riot Data Dragon |
| Gamedle | IGDB API (fixed `gamedle_pool` of 150) |
| JSdle / TSdle / Pythondle | `generate-code-puzzle` Edge Function (Groq) |
| Naruto, OnePiece, Jujutsu, Smash, Zelda, Mario, GoW, MH | `characters` table (wiki-populated) |

### Anti-Repetition

60-day lookback per `theme_id + mode`. Recent `name` values fetched before picking, excluded from candidates. For code puzzles: lookback on `daily_challenges.content_hash` (SHA-256 of `attributes->>'code'`). The `unique(theme_id, mode, content_hash)` constraint on `daily_challenges` also prevents duplicate inserts under concurrent conditions.

### Cron Error Handling

Each theme+mode combination is wrapped in try/catch. A failure in one fetcher logs the error and continues. The cron returns a log array with status per theme+mode (`ok | skipped | error`).

### Cron Missing Challenge (Client)

If `useDailyChallenge` finds no challenge for today (cron failed or not yet run), the game page renders an error boundary with a "Desafio de hoje ainda não está disponível" message and a retry button.

### Wiki Scraper (`refresh-catalog`)

Scrapes fandom wikis for 8 universes. Extracts character infobox data via CSS selectors. Upserts into `characters` table (conflict on `theme_id + name`).

| Universe | Wiki | Key attributes scraped |
|---|---|---|
| Naruto | naruto.fandom.com | especie, vila, cla, kekkei_genkai, afiliacao, rank |
| One Piece | onepiece.fandom.com | afiliacao, fruta_do_diabo, recompensa, haki, raca, ilha_natal |
| Jujutsu Kaisen | jujutsu-kaisen.fandom.com | tecnica_maldita, grau, afiliacao, genero |
| Smash Bros | supersmashbros.fandom.com | universe, weight_class, tier, first_appearance, fighter_type |
| Zelda | zelda.fandom.com | race, games, gender, affiliation |
| Mario | mario.fandom.com | species, first_appearance, affiliation |
| God of War | godofwar.fandom.com | realm, affiliation, weapon, gender |
| Monster Hunter | monsterhunter.fandom.com | type, element, weakness, size, threat_level |

### Code Puzzle Generation

Groq `llama-3.3-70b` generates per language per mode variant. Output validated as JSON. `content_hash` = SHA-256 of `attributes->>'code'`. Checked against existing `content_hash` values in `daily_challenges` before insert; database unique constraint provides final safety.

```typescript
// generate-code-puzzle response shape
{
  code:        string,
  answer:      string,
  explanation: string,
  difficulty:  'easy' | 'medium' | 'hard'
}
```

---

## Frontend

### Pages

| Route | Strategy | ISR | Description |
|---|---|---|---|
| `/` | RSC | 1h | Home grid, 14 universe cards |
| `/games/[slug]` | RSC | 1h | Universe hub, mode cards |
| `/games/[slug]/[mode]` | RSC shell + Client | 24h | Game shell via RSC; game state via hooks |
| `/ranking` | RSC | 5min | Global top 100 |
| `/ranking/[slug]` | RSC | 5min | Per-universe top 100 |
| `/profile` | Client + auth guard | — | Personal history and stats |
| `/login` | Client | — | Supabase Auth sign in |
| `/register` | Client | — | Email/password sign up |

The RSC shell for `/games/[slug]/[mode]` fetches `daily_challenges` for the current date at render time (ISR 24h) and passes the `challengeId` (DB primary key) as a prop to the Client Component. The Client Component uses this `challengeId` in all `/api/guess` and `/api/session` calls. On mount, TanStack Query re-validates the challenge to handle day-boundary cache staleness. If no challenge exists, renders an error boundary UI.

### Global Ranking Query

The `/ranking` page aggregates across themes. This query runs in the RSC using the Supabase service role key (required to access `auth.users` — not accessible via anon key). No materialized view needed at this scale.

```sql
select
  r.user_id,
  u.email,
  sum(r.score)          as total_score,
  sum(r.total_wins)     as total_wins,
  sum(r.total_games)    as total_games,
  max(r.best_streak)    as best_streak
from rankings r
join auth.users u on u.id = r.user_id
group by r.user_id, u.email
order by total_score desc
limit 100
```

Per-universe ranking (`/ranking/[slug]`) reads `rankings` filtered by `theme_id` directly.

The "avatar" column in the ranking table displays a generated initials avatar (first letter of email) — no profile image or separate `profiles` table required.

### Key Hooks

| Hook | Responsibility |
|---|---|
| `useDailyChallenge` | Fetches daily_challenges for theme+mode+today; handles missing challenge state |
| `useGameSession` | Creates/recovers game_sessions via /api/session, manages local state |
| `useGuess` | Calls `/api/guess`, receives AttributeFeedback[], updates Zustand store |
| `useRanking` | Reads rankings with pagination and theme filter |

### State Management

**Zustand** manages volatile UI state only (guesses array, hintsUsed, attempts, status). Persisted data (`game_sessions`, `guesses`) lives in Supabase, written via `/api/guess`. TanStack Query v5 handles all server state fetching and caching.

### Design System

```
Background:   #0F1117
Surface:      #1A1D2E
Border:       #2D3148
Text primary: #F0F0F0
Text muted:   #9CA3AF
Correct:      #22C55E
Partial:      #EAB308
Wrong:        #374151
Arrow:        #EF4444
Font:         Inter
Radius:       rounded-xl
Transitions:  duration-300
```

shadcn/ui components: Dialog, Input, Button, Badge, Table, Skeleton.

---

## Authentication

- Provider: Supabase email/password only
- Unauthenticated users can play — state lives in Zustand (memory only, no DB writes)
- Protected routes: `/profile` only
- `/ranking` and `/ranking/[slug]` are public — no auth required

---

## Ranking

### Tiers

| Tier | Score Range |
|---|---|
| Bronze | 0 – 4,999 |
| Silver | 5,000 – 14,999 |
| Gold | 15,000 – 29,999 |
| Platinum | 30,000 – 49,999 |
| Diamond | 50,000+ |

### Display

- `/ranking` — top 100 global (aggregated SUM of score across all themes)
- `/ranking/[slug]` — top 100 per universe (direct read from `rankings` by `theme_id`)
- Columns: position, initial avatar, name, tier badge, score, win rate, best streak
- Pagination: 50 per page

---

## Share Result

`generateShareText()` produces emoji grid + stats string. `ShareButton` uses `navigator.share()` on mobile (native share sheet) with clipboard fallback for desktop.

---

## Implementation Order

```
1.  Scaffold monorepo        Turborepo + pnpm + Next.js + Supabase CLI
2.  DB Migration             001_initial_schema.sql + trigger + indexes
3.  Seed themes              14 universos in themes table
4.  Design system            Tailwind config + shadcn setup
5.  Layout base              Header, Footer, Home grid
6.  Universe hub             /games/[slug] with mode cards
7.  Classic engine           SearchInput, GuessRow, AttributeCell, /api/guess, score
8.  Auth                     Supabase Auth, login, register, middleware
9.  Visual modes             Silhouette, Splash, Quote, Wanted, Kirby
10. Audio modes              AudioMode with Web Audio API player
11. Special modes            Quadra, Build, SkillOrder, Weakness, Final Smash
12. Code modes               CodeMode with Monaco-lite, 3 attempts
13. Cron Edge Function       cron-daily-challenges with all fetchers
14. Wiki scraper             refresh-catalog Edge Function
15. Code puzzle gen          generate-code-puzzle Edge Function (Groq)
16. Ranking                  Tables, tiers, badges, share result
17. Deploy                   Vercel (frontend) + Supabase (functions + cron)
```

---

## Critical Rules

- Frontend never calls external APIs — reads only from Supabase
- Guess submission and result computation always go through `/api/guess` (server-side)
- Unauthenticated guesses return feedback but skip all DB writes
- Sessions are always INSERTed with `completed_at = null`; only UPDATEd to set it on game completion
- `daily_challenges` stores complete data snapshots — not just foreign keys
- Attempts are unlimited except: Code modes (max 3), Quadra (4 lives)
- Hint 1 unlocked after 5 wrong (-150pts), Hint 2 after 10 wrong (-200pts); Code modes have no hints
- Minimum score is 50pts — never zero
- Anti-repetition window: 60 days per theme+mode
- Streak is per theme (universe), not per mode — any winning session in any mode counts
- Audio/voice files stored in Supabase Storage (copyright)
- Pokemon cries use public PokeAPI URLs (no upload needed)
- Gamedle uses fixed pool of 150 games in `gamedle_pool` table; images fetched from IGDB at cron time
- Cron uses try/catch per theme — isolated failure does not block other themes
- No inline comments in code
- Naming: camelCase functions, PascalCase components, kebab-case files
