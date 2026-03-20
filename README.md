# Guessle

Daily games hub with 14 themed universes — Wordle-style games for LoL, Pokemon, Naruto, One Piece, and more.

## Universes

| Universe | Slug | Modes |
|---|---|---|
| LoLdle | `lol` | classic, quote, ability, splash, build, skill-order, quadra |
| Narutodle | `naruto` | classic, jutsu, quote, eye, voice |
| OnePiecedle | `onepiece` | classic, devil-fruit, wanted, laugh |
| Jujutsudle | `jujutsu` | classic, cursed-technique, quote, eyes |
| Pokedle | `pokemon` | classic, silhouette, ability, cry |
| Smashdle | `smash` | classic, silhouette, kirby, final-smash |
| Zeldadle | `zelda` | classic, item, location, music |
| Mariodle | `mario` | classic, game, sound, level |
| GoWdle | `gow` | classic, weapon, voice, quote |
| MHdle | `monsterhunter` | classic, silhouette, roar, weakness |
| Gamedle | `gamedle` | classic, screenshot, cover, soundtrack |
| JSdle | `js` | complete, fix, output |
| TSdle | `ts` | complete, fix, output |
| Pythondle | `python` | complete, fix, output |

## Stack

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Edge Functions)
- **State:** Zustand (game state), TanStack Query (server state)
- **Monorepo:** Turborepo + pnpm workspaces

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase CLI (optional, for local Supabase)

### Setup

```bash
# Install dependencies
pnpm install

# Copy env vars
cp .env.example apps/web/.env.local
# Fill in your Supabase URL and anon key in apps/web/.env.local

# Start dev server
pnpm --filter @guessle/web dev
```

### Run tests

```bash
pnpm --filter @guessle/shared test
```

### Type check

```bash
pnpm --filter @guessle/shared exec tsc --noEmit
pnpm --filter @guessle/web exec tsc --noEmit
```

## Deployment

### Vercel (Next.js app)

1. Import the repository in Vercel
2. Set root directory to `apps/web`
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Supabase

1. Run migrations: `supabase db push`
2. Deploy Edge Functions:
   ```bash
   supabase functions deploy generate-code-puzzle
   supabase functions deploy cron-daily-challenges
   supabase functions deploy refresh-catalog
   ```
3. Set Edge Function secrets in Supabase Dashboard:
   - `GROQ_API_KEY`
   - `IGDB_CLIENT_ID` (optional)
   - `IGDB_CLIENT_SECRET` (optional)
4. Enable pg_cron via Dashboard → Database → Extensions
5. Set up cron jobs via Dashboard → Database → Cron Jobs (recommended over the SQL migration)

## Data Pipeline

| Function | Schedule | Purpose |
|---|---|---|
| `cron-daily-challenges` | Daily 10:00 UTC | Generate today's challenges for all universes |
| `refresh-catalog` | Sunday 03:00 UTC | Scrape wikis + refresh Pokemon/LoL data |
| `generate-code-puzzle` | Called by cron | Generate JS/TS/Python puzzles via Groq |
