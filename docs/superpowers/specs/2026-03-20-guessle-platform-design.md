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
  API Routes /api/*
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

---

## Database Schema

### Tables

```sql
themes           -- 14 universes with slug, name, icon, color, type, modes[]
characters       -- cached character data for universes without public APIs
gamedle_pool     -- fixed pool of 150 games for Gamedle universe
daily_challenges -- daily snapshots with complete data (not just FK)
game_sessions    -- per-user per-challenge session with attempts, score, won
guesses          -- individual guesses with result feedback as JSONB
rankings         -- aggregated stats per user per theme (trigger-maintained)
```

### Ranking Trigger

`fn_update_ranking()` fires on `game_sessions.completed_at` update and performs upsert on `rankings` with:
- `total_wins`, `total_games`, `win_rate`, `avg_attempts` recalculated
- `current_streak` checked against previous day's session
- `best_streak` updated if current streak exceeds it
- `score` accumulated

```sql
create trigger trg_update_ranking
after update of completed_at on game_sessions
for each row execute function fn_update_ranking();
```

### Additional Indexes

```sql
create index idx_rankings_theme_score  on rankings(theme_id, score desc);
create index idx_rankings_global_score on rankings(score desc);
create index idx_sessions_user_challenge on game_sessions(user_id, daily_challenge_id);
create index idx_guesses_session on guesses(session_id, attempt_number);
```

### RLS Policies

- Public read: `themes`, `characters`, `daily_challenges`, `rankings`
- Auth write: `game_sessions` (own rows), `guesses` (via session ownership check)

---

## Game Engine — Mode Registry Pattern

### Mode Contract

```typescript
interface ModeConfig {
  slug:        string
  label:       string
  maxAttempts: number | null  // null = unlimited
  lives?:      number         // Quadra = 4, Code modes = 3
  attributes?: AttributeConfig[]
  hints:       { after: number; penalty: number }[]
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

Maps mode slug to dynamic import. Multiple slugs can point to the same component (e.g., `fix` and `complete` both map to `CodeMode`). Adding a new mode requires one file + one registry entry — no changes to core files.

### Scoring

```
base:              1000 pts
penalty per wrong:   40 pts
hint 1 (after 5):  150 pts
hint 2 (after 10): 200 pts
minimum score:      50 pts
```

`calculateScore(attempts, hintsUsed)` in `apps/web/lib/game/score.ts`

### Feedback Engine

`computeFeedback(guessValue, targetValue, compareMode)` in `packages/shared/utils/feedback.ts`

- `exact` → correct | wrong
- `partial` → correct | partial | wrong (array intersection)
- `arrow` → correct | higher | lower (numeric comparison)

Runs client-side for immediate visual feedback; result persisted to `guesses.result` via Supabase.

---

## Game Modes

### Classic (all character universes)
SearchInput with fuzzy autocomplete + GuessRow grid of AttributeCell components. Unlimited attempts. 2 hints.

### Visual Modes
| Mode | Mechanic |
|---|---|
| Silhouette | CSS filter brightness(0) image revealed gradually |
| Splash | Zoomed crop of splash art, progressively wider |
| Wanted | One Piece wanted poster with bounty value |
| Kirby | Kirby copying the ability, guess the fighter |

### Audio Modes
| Mode | Mechanic |
|---|---|
| Audio / Cry | Web Audio API player, reveals longer clip each wrong attempt |

### Ability/Skill Modes
| Mode | Mechanic |
|---|---|
| Ability | Show ability icon without name, guess character |
| Build | Show build items, guess the champion |
| Skill Order | Show skill max order, guess the champion |
| Final Smash | Show final smash, guess the Smash fighter |

### Special Mechanics
| Mode | Max Attempts | Lives |
|---|---|---|
| Quadra | Unlimited | 4 |
| Code (complete/fix/output) | 3 | — |
| All others | Unlimited | — |

### Quote Mode
Obfuscated quote text, letters revealed progressively per wrong attempt.

### Code Modes (JSdle / TSdle / Pythondle)
Monaco-lite editor. 3 attempts maximum. Puzzles generated daily by Groq LLM.

---

## Data Pipeline

### Edge Functions

| Function | Schedule | Purpose |
|---|---|---|
| `cron-daily-challenges` | `0 10 * * *` UTC | Generate all daily challenges |
| `refresh-catalog` | `0 3 * * 0` UTC (Sundays) | Scrape wikis, update characters table |
| `generate-code-puzzle` | Called by cron | Groq LLM code puzzle generation |

### Fetcher Strategy per Universe

| Universe | Source |
|---|---|
| Pokemon | PokeAPI (pokeapi.co) |
| LoL | Riot Data Dragon |
| Gamedle | IGDB API (fixed pool of 150) |
| JSdle / TSdle / Pythondle | Groq LLM (llama-3.3-70b) |
| Naruto, OnePiece, Jujutsu, Smash, Zelda, Mario, GoW, MH | `characters` table (wiki-populated) |

### Anti-Repetition

60-day lookback per theme+mode. Recent names fetched before picking, excluded from candidates.

### Wiki Scraper (`refresh-catalog`)

Scrapes fandom wikis for 8 universes. Extracts character infobox data via CSS selectors. Upserts into `characters` table (conflict on `theme_id + name`).

| Universe | Wiki |
|---|---|
| Naruto | naruto.fandom.com |
| One Piece | onepiece.fandom.com |
| Jujutsu Kaisen | jujutsu-kaisen.fandom.com |
| Smash Bros | supersmashbros.fandom.com |
| Zelda | zelda.fandom.com |
| Mario | mario.fandom.com |
| God of War | godofwar.fandom.com |
| Monster Hunter | monsterhunter.fandom.com |

### Code Puzzle Generation

Groq `llama-3.3-70b` generates per language per mode variant (`complete`, `fix`, `output`). Output validated as JSON before insert. Uniqueness checked against 60-day history via hash of `code` content.

---

## Frontend

### Pages

| Route | Strategy | Description |
|---|---|---|
| `/` | RSC + ISR 1h | Home grid, 14 universe cards |
| `/games/[slug]` | RSC + ISR 1h | Universe hub, mode cards |
| `/games/[slug]/[mode]` | RSC shell + Client | Game (challenge via RSC, state via hooks) |
| `/ranking` | RSC + ISR 5min | Global top 100 |
| `/ranking/[slug]` | RSC + ISR 5min | Per-universe top 100 |
| `/profile` | Client + auth guard | Personal history and stats |
| `/login` | Client | Supabase Auth sign in |
| `/register` | Client | Email/password sign up |

### Key Hooks

| Hook | Responsibility |
|---|---|
| `useDailyChallenge` | Fetches daily_challenges for theme+mode+today |
| `useGameSession` | Creates/recovers game_sessions, manages local state |
| `useGuess` | Submits guess, receives AttributeFeedback[], persists to guesses |
| `useRanking` | Reads rankings with pagination and theme filter |

### State Management

**Zustand** manages volatile UI state only (guesses array, hintsUsed, attempts, status). Persisted data (game_sessions, guesses) lives in Supabase. TanStack Query v5 handles all server state fetching and caching.

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
- Unauthenticated users can play — state lives in Zustand (memory only, not persisted)
- Protected routes: `/profile`
- Redirect to `/login` when unauthenticated user accesses ranking or profile

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

- `/ranking` — top 100 global (sum of score across all themes)
- `/ranking/[slug]` — top 100 per universe
- Columns: position, initial avatar, name, tier badge, score, win rate, streak
- Pagination: 50 per page

---

## Share Result

`generateShareText()` produces emoji grid + stats string. `ShareButton` uses `navigator.share()` on mobile (native share sheet) with clipboard fallback for desktop.

---

## Implementation Order

```
1.  Scaffold monorepo       Turborepo + pnpm + Next.js + Supabase CLI
2.  DB Migration            001_initial_schema.sql + trigger + indexes
3.  Seed themes             14 universos in themes table
4.  Design system           Tailwind config + shadcn setup
5.  Layout base             Header, Footer, Home grid
6.  Universe hub            /games/[slug] with mode cards
7.  Classic engine          SearchInput, GuessRow, AttributeCell, feedback, score
8.  Auth                    Supabase Auth, login, register, middleware
9.  Visual modes            Silhouette, Splash, Quote, Wanted, Kirby
10. Audio modes             AudioMode with Web Audio API player
11. Special modes           Quadra, Build, SkillOrder, Weakness, Final Smash
12. Code modes              CodeMode with Monaco-lite, 3 attempts
13. Cron Edge Function      cron-daily-challenges with all fetchers
14. Wiki scraper            refresh-catalog Edge Function
15. Code puzzle gen         generate-code-puzzle Edge Function (Groq)
16. Ranking                 Tables, tiers, badges, share result
17. Deploy                  Vercel (frontend) + Supabase (functions + cron)
```

---

## Critical Rules

- Frontend never calls external APIs — reads only from Supabase
- `daily_challenges` stores complete data snapshots — not just foreign keys
- Attempts are unlimited except: Code modes (max 3), Quadra (4 lives)
- Hint 1 unlocked after 5 wrong (-150pts), Hint 2 after 10 wrong (-200pts)
- Minimum score is 50pts — never zero
- Anti-repetition window: 60 days per theme+mode
- Audio/voice files stored in Supabase Storage (copyright)
- Pokemon cries use public PokeAPI URLs (no upload needed)
- Gamedle uses fixed pool of 150 games in `gamedle_pool` table
- Cron uses try/catch per theme — isolated failure does not block other themes
- No inline comments in code
- Naming: camelCase functions, PascalCase components, kebab-case files
