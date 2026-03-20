# Guessle — Plan 4: Deploy & CI/CD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure deployment pipeline: Vercel for Next.js, Supabase for Edge Functions, and GitHub Actions for CI (lint + typecheck + tests on every PR).

**Architecture:** Vercel reads from `apps/web`, deploying the Next.js 14 app. Edge Functions are deployed via `supabase functions deploy`. GitHub Actions CI runs on every push and pull request. No secrets are committed — all via environment variables set in platform dashboards.

**Tech Stack:** Vercel, Supabase CLI, GitHub Actions, pnpm, Turborepo

---

## File Structure

```
.github/
└── workflows/
    └── ci.yml                  # Type check + lint + tests on push/PR
vercel.json                     # Vercel monorepo config
apps/web/
└── next.config.ts              # next.config.ts with output settings
```

---

## Task 1: Vercel Configuration

**Files:**
- Create: `vercel.json`
- Modify: `apps/web/next.config.ts` (verify configuration)

Vercel needs to know the root directory for the Next.js app in a monorepo.

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "buildCommand": "cd ../.. && pnpm --filter @guessle/web build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "rootDirectory": "apps/web"
}
```

- [ ] **Step 2: Read and verify `apps/web/next.config.ts`**

Read the file and ensure it does NOT have `output: 'export'` (which would break API routes). It should be a standard Next.js config. If `output: 'export'` is present, remove it. If the file does not exist, create it:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'assets.pokemon.com' },
      { protocol: 'https', hostname: 'ddragon.leagueoflegends.com' },
      { protocol: 'https', hostname: 'images.igdb.com' },
      { protocol: 'https', hostname: '*.fandom.com' },
      { protocol: 'https', hostname: '*.wikia.nocookie.net' },
      { protocol: 'https', hostname: 'static.wikia.nocookie.net' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 3: Verify tsc still passes**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add vercel.json apps/web/next.config.ts && git commit -m "feat: add Vercel deployment config and next.config image remotePatterns

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

CI runs on every push and pull request. Steps: install → typecheck → shared tests.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Type check + Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check shared package
        run: pnpm --filter @guessle/shared exec tsc --noEmit

      - name: Type check web app
        run: pnpm --filter @guessle/web exec tsc --noEmit
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key

      - name: Run shared tests
        run: pnpm --filter @guessle/shared test --run
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add .github && git commit -m "feat: add GitHub Actions CI workflow (typecheck + tests)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Environment Variable Documentation

**Files:**
- Create: `.env.example`

Documents all required environment variables without exposing real values. This is committed to the repo.

- [ ] **Step 1: Create `.env.example`**

```bash
# Supabase (required for Next.js app)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq (required for code puzzle generation — set in Supabase Edge Function secrets)
GROQ_API_KEY=your-groq-api-key

# IGDB / Twitch (optional — for Gamedle cover images)
IGDB_CLIENT_ID=your-twitch-client-id
IGDB_CLIENT_SECRET=your-twitch-client-secret
```

- [ ] **Step 2: Verify .gitignore has `.env.local`**

Run:
```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && grep -r "\.env\.local" .gitignore apps/web/.gitignore 2>/dev/null || echo "not found"
```

If `.env.local` is not ignored, add it to the root `.gitignore`.

- [ ] **Step 3: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add .env.example && git commit -m "chore: add .env.example with all required environment variables

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: README

**Files:**
- Create: `README.md`

Minimal README documenting what Guessle is, the monorepo structure, local setup steps, and deployment instructions.

- [ ] **Step 1: Create `README.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add README.md && git commit -m "docs: add project README with setup and deployment instructions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run all checks**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/shared exec tsc --noEmit && echo "shared: OK"
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit && echo "web: OK"
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/shared test --run && echo "tests: OK"
```

- [ ] **Step 2: Verify git log (full project)**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git log --oneline
```

Expected: clean commit history showing all Plan 1-4 work.

- [ ] **Step 3: Report pass/fail**
