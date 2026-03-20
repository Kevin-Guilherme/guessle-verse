# Guessle — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Turborepo monorepo, run the DB migration on Supabase, configure the design system, and deliver a working home page (universe grid) and universe hub page (`/games/[slug]`) with real data from Supabase.

**Architecture:** Turborepo monorepo with `apps/web` (Next.js 14 App Router) and `packages/shared` (shared types). All data reads from Supabase via RSC Server Components with ISR. No game logic yet — only navigation and layout.

**Tech Stack:** Node 22, pnpm 9, Turborepo 2, Next.js 14, TypeScript, Tailwind CSS 3, shadcn/ui, Supabase JS v2 (`@supabase/ssr`), Vitest

---

## Pre-flight

Before starting, you need:
- Supabase project URL and anon key (from the project dashboard — already in spec: `https://yabxlaicllxqwaaqfnax.supabase.co`)
- Supabase service role key (from Project Settings → API)
- The migration must be applied in the Supabase SQL Editor before running the app

---

## Task 1: Install Prerequisites

**Files:** none (system tools)

- [ ] **Step 1: Install pnpm**

```bash
npm install -g pnpm@9
```

Expected: `pnpm: 9.x.x`

- [ ] **Step 2: Install Supabase CLI**

```bash
brew install supabase/tap/supabase
```

Expected: `supabase version` prints a version string

- [ ] **Step 3: Verify**

```bash
pnpm --version && supabase --version
```

Expected: both print version numbers without error

---

## Task 2: Initialize Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```bash
cat > /Users/kevin.souza/Documents/Github/guessle-verse/package.json << 'EOF'
{
  "name": "guessle",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
EOF
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```bash
cat > /Users/kevin.souza/Documents/Github/guessle-verse/pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF
```

- [ ] **Step 3: Create turbo.json**

```bash
cat > /Users/kevin.souza/Documents/Github/guessle-verse/turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
EOF
```

- [ ] **Step 4: Create .gitignore**

```bash
cat > /Users/kevin.souza/Documents/Github/guessle-verse/.gitignore << 'EOF'
node_modules
.next
dist
.turbo
.env.local
.env.*.local
*.log
.DS_Store
EOF
```

- [ ] **Step 5: Install Turborepo**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm install
```

Expected: `node_modules` created at root with `turbo` installed

- [ ] **Step 6: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add package.json pnpm-workspace.yaml turbo.json .gitignore && git commit -m "chore: initialize Turborepo monorepo with pnpm workspaces

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/types/game.types.ts`
- Create: `packages/shared/utils/feedback.ts`
- Create: `packages/shared/utils/score.ts`
- Test: `packages/shared/utils/feedback.test.ts`
- Test: `packages/shared/utils/score.test.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/packages/shared/src/types
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/packages/shared/src/utils
```

- [ ] **Step 2: Create packages/shared/package.json**

```json
{
  "name": "@guessle/shared",
  "version": "0.0.1",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3b: Create packages/shared/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Create packages/shared/src/types/game.types.ts**

```bash
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/packages/shared/src/types
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/packages/shared/src/utils
```

Create `packages/shared/src/types/game.types.ts`:

```typescript
export type FeedbackType = 'correct' | 'partial' | 'wrong' | 'higher' | 'lower'

export interface AttributeConfig {
  key:         string
  label:       string
  type:        'string' | 'boolean' | 'number' | 'enum'
  compareMode: 'exact' | 'partial' | 'arrow'
  icon?:       string
}

export interface AttributeFeedback {
  key:      string
  label:    string
  value:    string | number | boolean
  feedback: FeedbackType
}

export interface ModeConfig {
  slug:        string
  label:       string
  maxAttempts: number | null
  lives?:      number
  attributes?: AttributeConfig[]
}

export interface DailyChallenge {
  id:           number
  themeId:      number
  mode:         string
  date:         string
  characterId?: number
  name:         string
  imageUrl?:    string
  attributes:   Record<string, unknown>
  extra:        Record<string, unknown>
}

export interface GameSession {
  id:               number
  userId:           string
  dailyChallengeId: number
  attempts:         number
  hintsUsed:        number
  won:              boolean
  score:            number
  startedAt:        string
  completedAt?:     string
}

export interface Universe {
  slug:  string
  name:  string
  icon:  string
  color: string
  type:  'character' | 'game' | 'code'
  modes: string[]
}
```

- [ ] **Step 5: Write failing test for feedback utility**

Create `packages/shared/src/utils/feedback.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeFeedback } from './feedback'
import type { FeedbackType } from '../types/game.types'

describe('computeFeedback', () => {
  describe('exact', () => {
    it('returns correct when values match', () => {
      expect(computeFeedback('fire', 'fire', 'exact')).toBe('correct')
    })
    it('returns wrong when values differ', () => {
      expect(computeFeedback('fire', 'water', 'exact')).toBe('wrong')
    })
  })

  describe('partial', () => {
    it('returns correct when arrays fully overlap', () => {
      expect(computeFeedback(['fire', 'flying'], ['fire', 'flying'], 'partial')).toBe('correct')
    })
    it('returns partial when arrays partially overlap', () => {
      expect(computeFeedback(['fire', 'poison'], ['fire', 'flying'], 'partial')).toBe('partial')
    })
    it('returns wrong when no overlap', () => {
      expect(computeFeedback(['water'], ['fire'], 'partial')).toBe('wrong')
    })
    it('handles scalar equality', () => {
      expect(computeFeedback('red', 'red', 'partial')).toBe('correct')
    })
  })

  describe('arrow', () => {
    it('returns correct when equal', () => {
      expect(computeFeedback(5, 5, 'arrow')).toBe('correct')
    })
    it('returns higher when guess is less than target', () => {
      expect(computeFeedback(3, 7, 'arrow')).toBe('higher')
    })
    it('returns lower when guess is greater than target', () => {
      expect(computeFeedback(9, 5, 'arrow')).toBe('lower')
    })
  })
})
```

- [ ] **Step 6: Run test — verify FAIL**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse/packages/shared && pnpm test
```

Expected: FAIL — `Cannot find module './feedback'`

- [ ] **Step 7: Create packages/shared/src/utils/feedback.ts**

```typescript
import type { FeedbackType } from '../types/game.types'

export function computeFeedback(
  guessValue: unknown,
  targetValue: unknown,
  compareMode: 'exact' | 'partial' | 'arrow'
): FeedbackType {
  switch (compareMode) {
    case 'exact':
      return guessValue === targetValue ? 'correct' : 'wrong'

    case 'partial':
      if (Array.isArray(guessValue) && Array.isArray(targetValue)) {
        const hit = (guessValue as string[]).filter(v => (targetValue as string[]).includes(v))
        if (hit.length === targetValue.length) return 'correct'
        if (hit.length > 0) return 'partial'
        return 'wrong'
      }
      return guessValue === targetValue ? 'correct' : 'wrong'

    case 'arrow': {
      const g = guessValue as number
      const t = targetValue as number
      if (g === t) return 'correct'
      return g < t ? 'higher' : 'lower'
    }
  }
}
```

- [ ] **Step 8: Run test — verify PASS**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse/packages/shared && pnpm test
```

Expected: All 8 tests pass

- [ ] **Step 9: Write failing test for score utility**

Create `packages/shared/src/utils/score.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateScore, shouldRevealHint } from './score'

describe('calculateScore', () => {
  it('returns 1000 on first attempt with no hints', () => {
    expect(calculateScore(1, 0)).toBe(1000)
  })
  it('deducts 40 per wrong attempt', () => {
    expect(calculateScore(3, 0)).toBe(920)
  })
  it('deducts 150 for first hint', () => {
    expect(calculateScore(1, 1)).toBe(850)
  })
  it('deducts 350 for both hints', () => {
    expect(calculateScore(1, 2)).toBe(650)
  })
  it('never returns below 50', () => {
    expect(calculateScore(100, 2)).toBe(50)
  })
})

describe('shouldRevealHint', () => {
  it('returns null before 5 attempts', () => {
    expect(shouldRevealHint(4)).toBeNull()
  })
  it('returns 1 at 5 attempts', () => {
    expect(shouldRevealHint(5)).toBe(1)
  })
  it('returns 2 at 10 attempts', () => {
    expect(shouldRevealHint(10)).toBe(2)
  })
})
```

- [ ] **Step 10: Run test — verify FAIL**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse/packages/shared && pnpm test
```

Expected: FAIL — `Cannot find module './score'`

- [ ] **Step 11: Create packages/shared/src/utils/score.ts**

```typescript
const SCORE_CONFIG = {
  base:              1000,
  penaltyPerAttempt:   40,
  penaltyHint1:       150,
  penaltyHint2:       200,
  minScore:            50,
}

export function calculateScore(attempts: number, hintsUsed: number): number {
  const attemptPenalty = (attempts - 1) * SCORE_CONFIG.penaltyPerAttempt
  const hintPenalty    = (hintsUsed >= 1 ? SCORE_CONFIG.penaltyHint1 : 0)
                       + (hintsUsed >= 2 ? SCORE_CONFIG.penaltyHint2 : 0)
  return Math.max(SCORE_CONFIG.base - attemptPenalty - hintPenalty, SCORE_CONFIG.minScore)
}

export function shouldRevealHint(attempts: number): 1 | 2 | null {
  if (attempts >= 10) return 2
  if (attempts >= 5)  return 1
  return null
}
```

- [ ] **Step 12: Create packages/shared/src/index.ts (barrel)**

Create `packages/shared/src/index.ts`:

```typescript
export * from './types/game.types'
export * from './utils/feedback'
export * from './utils/score'
```

- [ ] **Step 13: Run all tests — verify PASS**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse/packages/shared && pnpm test
```

Expected: All 11 tests pass

- [ ] **Step 14: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add packages/shared && git commit -m "feat: add shared package with game types, feedback, and score utilities

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create Next.js App

**Files:**
- Create: `apps/web/` (full Next.js 14 scaffold)
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/.env.local`

- [ ] **Step 1: Scaffold Next.js app with create-next-app**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse/apps && pnpm create next-app@14 web --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*" --no-git
```

When prompted, confirm all defaults.

- [ ] **Step 2: Replace apps/web/package.json with project version**

Replace the generated `apps/web/package.json` with:

```json
{
  "name": "@guessle/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@guessle/shared": "workspace:*",
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.43.0",
    "@tanstack/react-query": "^5.40.0",
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "^4.3.0",
    "eslint": "^8",
    "eslint-config-next": "14.2.3",
    "jsdom": "^24.0.0",
    "typescript": "^5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create apps/web/next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'ddragon.leagueoflegends.com' },
      { protocol: 'https', hostname: 'images.igdb.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 4: Create apps/web/.env.local**

```bash
cat > /Users/kevin.souza/Documents/Github/guessle-verse/apps/web/.env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://yabxlaicllxqwaaqfnax.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-anon-key-here>
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-here>
EOF
```

Fill in the actual keys from the Supabase dashboard.

- [ ] **Step 5: Install dependencies**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm install
```

Expected: all packages installed, workspace link to `@guessle/shared` created

- [ ] **Step 6: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web && git commit -m "feat: scaffold Next.js 14 app with TypeScript and Tailwind

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Configure Tailwind Design System

**Files:**
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Replace apps/web/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0F1117',
          surface: '#1A1D2E',
        },
        border:  '#2D3148',
        correct: '#22C55E',
        partial: '#EAB308',
        wrong:   '#374151',
        arrow:   '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Replace apps/web/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0F1117;
  --foreground: #F0F0F0;
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 3: Install shadcn/ui**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse/apps/web && pnpm dlx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 4: Add core shadcn components**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse/apps/web && pnpm dlx shadcn@latest add button badge dialog input skeleton card
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm dev
```

Expected: Next.js dev server starts at `http://localhost:3000` without errors

- [ ] **Step 6: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/tailwind.config.ts apps/web/app/globals.css apps/web/components/ui && git commit -m "feat: configure Tailwind design system and install shadcn/ui components

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Setup Supabase Clients

**Files:**
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/lib/supabase/server.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/apps/web/lib/supabase
```

- [ ] **Step 2: Create apps/web/lib/supabase/client.ts**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create apps/web/lib/supabase/server.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components throw on cookie writes — intentional per @supabase/ssr docs
          }
        },
      },
    }
  )
}

export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/lib && git commit -m "feat: add Supabase browser and server clients

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Database Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/supabase/migrations
```

- [ ] **Step 2: Create supabase/migrations/001_initial_schema.sql**

```sql
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
```

- [ ] **Step 3: Apply migration in Supabase SQL Editor**

Go to: Supabase Dashboard → SQL Editor → paste the contents of `001_initial_schema.sql` → Run

Expected: All tables created, no errors

- [ ] **Step 4: Verify tables exist**

In Supabase Dashboard → Table Editor, confirm these tables exist:
`themes`, `characters`, `gamedle_pool`, `daily_challenges`, `game_sessions`, `guesses`, `rankings`

- [ ] **Step 5: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add supabase/migrations && git commit -m "feat: add initial database schema with ranking trigger and RLS policies

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Seed Themes

**Files:**
- Create: `supabase/seed/themes.sql`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/supabase/seed
```

- [ ] **Step 2: Create supabase/seed/themes.sql**

```sql
insert into themes (slug, name, icon, color, type, modes) values
  ('lol',           'LoLdle',        '⚔️',  '#C89B3C', 'character', array['classic','quote','ability','splash','build','skill-order','quadra']),
  ('naruto',        'Narutodle',     '🍥',  '#FF6B2B', 'character', array['classic','jutsu','quote','eye','voice']),
  ('onepiece',      'OnePiecedle',   '🏴‍☠️', '#E8C84A', 'character', array['classic','devil-fruit','wanted','laugh']),
  ('jujutsu',       'Jujutsudle',    '🩸',  '#8B5CF6', 'character', array['classic','cursed-technique','quote','eyes']),
  ('pokemon',       'Pokédle',        '⚡',  '#FFCC02', 'character', array['classic','silhouette','ability','cry']),
  ('smash',         'Smashdle',       '🥊',  '#E8534A', 'character', array['classic','silhouette','kirby','final-smash']),
  ('zelda',         'Zeldadle',       '🧝',  '#4ADE80', 'character', array['classic','item','location','music']),
  ('mario',         'Mariodle',       '⭐',  '#EF4444', 'character', array['classic','game','sound','level']),
  ('gow',           'GoWdle',          '🪓',  '#DC2626', 'character', array['classic','weapon','voice','quote']),
  ('monsterhunter', 'MHdle',           '🐉',  '#F97316', 'character', array['classic','silhouette','roar','weakness']),
  ('gamedle',       'Gamedle',         '🕹️', '#6366F1', 'game',      array['classic','screenshot','cover','soundtrack']),
  ('js',            'JSdle',           '🟨',  '#F7DF1E', 'code',      array['complete','fix','output']),
  ('ts',            'TSdle',           '🟦',  '#3178C6', 'code',      array['complete','fix','output']),
  ('python',        'Pythondle',       '🐍',  '#3B82F6', 'code',      array['complete','fix','output'])
on conflict (slug) do nothing;
```

- [ ] **Step 3: Apply seed in Supabase SQL Editor**

Go to: Supabase Dashboard → SQL Editor → paste themes.sql → Run

Expected: 14 rows inserted

- [ ] **Step 4: Verify in Table Editor**

Dashboard → Table Editor → `themes` → confirm 14 rows with correct slugs

- [ ] **Step 5: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add supabase/seed && git commit -m "feat: seed 14 game universe themes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Universe Constants

**Files:**
- Create: `apps/web/lib/constants/universes.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/apps/web/lib/constants
```

- [ ] **Step 2: Create apps/web/lib/constants/universes.ts**

```typescript
import type { Universe } from '@guessle/shared'

export const UNIVERSES: Universe[] = [
  { slug: 'lol',           name: 'LoLdle',        icon: '⚔️',  color: '#C89B3C', type: 'character', modes: ['classic','quote','ability','splash','build','skill-order','quadra'] },
  { slug: 'naruto',        name: 'Narutodle',      icon: '🍥',  color: '#FF6B2B', type: 'character', modes: ['classic','jutsu','quote','eye','voice'] },
  { slug: 'onepiece',      name: 'OnePiecedle',    icon: '🏴‍☠️', color: '#E8C84A', type: 'character', modes: ['classic','devil-fruit','wanted','laugh'] },
  { slug: 'jujutsu',       name: 'Jujutsudle',     icon: '🩸',  color: '#8B5CF6', type: 'character', modes: ['classic','cursed-technique','quote','eyes'] },
  { slug: 'pokemon',       name: 'Pokédle',         icon: '⚡',  color: '#FFCC02', type: 'character', modes: ['classic','silhouette','ability','cry'] },
  { slug: 'smash',         name: 'Smashdle',        icon: '🥊',  color: '#E8534A', type: 'character', modes: ['classic','silhouette','kirby','final-smash'] },
  { slug: 'zelda',         name: 'Zeldadle',        icon: '🧝',  color: '#4ADE80', type: 'character', modes: ['classic','item','location','music'] },
  { slug: 'mario',         name: 'Mariodle',        icon: '⭐',  color: '#EF4444', type: 'character', modes: ['classic','game','sound','level'] },
  { slug: 'gow',           name: 'GoWdle',           icon: '🪓',  color: '#DC2626', type: 'character', modes: ['classic','weapon','voice','quote'] },
  { slug: 'monsterhunter', name: 'MHdle',            icon: '🐉',  color: '#F97316', type: 'character', modes: ['classic','silhouette','roar','weakness'] },
  { slug: 'gamedle',       name: 'Gamedle',          icon: '🕹️', color: '#6366F1', type: 'game',      modes: ['classic','screenshot','cover','soundtrack'] },
  { slug: 'js',            name: 'JSdle',            icon: '🟨',  color: '#F7DF1E', type: 'code',      modes: ['complete','fix','output'] },
  { slug: 'ts',            name: 'TSdle',            icon: '🟦',  color: '#3178C6', type: 'code',      modes: ['complete','fix','output'] },
  { slug: 'python',        name: 'Pythondle',        icon: '🐍',  color: '#3B82F6', type: 'code',      modes: ['complete','fix','output'] },
]

export function getUniverse(slug: string): Universe | undefined {
  return UNIVERSES.find(u => u.slug === slug)
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/lib/constants && git commit -m "feat: add universe constants matching database seed

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Layout Components

**Files:**
- Create: `apps/web/components/layout/header.tsx`
- Create: `apps/web/components/layout/footer.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/apps/web/components/layout
```

- [ ] **Step 2: Create apps/web/components/layout/header.tsx**

```typescript
import Link from 'next/link'

export function Header() {
  return (
    <header className="border-b border-border bg-bg-surface sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
            G
          </div>
          <span className="font-bold text-xl text-white">Guessle</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/ranking"
            className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
          >
            Ranking
          </Link>
          <Link
            href="/login"
            className="text-sm bg-bg-surface border border-border px-4 py-2 rounded-lg text-gray-200 hover:border-gray-500 transition-colors duration-200"
          >
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create apps/web/components/layout/footer.tsx**

```typescript
export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-surface mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          Guessle — jogos diarios de adivinhar
        </p>
        <p className="text-xs text-gray-600">
          {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Update apps/web/app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Guessle — Hub de jogos diarios',
  description: 'Adivinhe personagens, jogos e codigo todo dia.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-bg-primary min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verify visually**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm dev
```

Open `http://localhost:3000` — confirm header with "Guessle" logo and footer render correctly on dark background

- [ ] **Step 6: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/components/layout apps/web/app/layout.tsx && git commit -m "feat: add Header and Footer layout components with root layout

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: UniverseCard Component

**Files:**
- Create: `apps/web/components/layout/universe-card.tsx`

- [ ] **Step 1: Create apps/web/components/layout/universe-card.tsx**

```typescript
import Link from 'next/link'
import type { Universe } from '@guessle/shared'

interface UniverseCardProps {
  universe: Universe
}

const MODE_LABELS: Record<string, string> = {
  classic:           'Classic',
  silhouette:        'Silhouette',
  quote:             'Quote',
  ability:           'Ability',
  splash:            'Splash',
  build:             'Build',
  'skill-order':     'Skill Order',
  quadra:            'Quadra',
  'devil-fruit':     'Devil Fruit',
  wanted:            'Wanted',
  laugh:             'Laugh',
  jutsu:             'Jutsu',
  eye:               'Eye',
  voice:             'Voice',
  'cursed-technique':'Cursed Technique',
  eyes:              'Eyes',
  cry:               'Cry',
  kirby:             'Kirby',
  'final-smash':     'Final Smash',
  item:              'Item',
  location:          'Location',
  music:             'Music',
  game:              'Game',
  sound:             'Sound',
  level:             'Level',
  weapon:            'Weapon',
  roar:              'Roar',
  weakness:          'Weakness',
  screenshot:        'Screenshot',
  cover:             'Cover',
  soundtrack:        'Soundtrack',
  complete:          'Complete',
  fix:               'Fix',
  output:            'Output',
}

export function UniverseCard({ universe }: UniverseCardProps) {
  return (
    <Link href={`/games/${universe.slug}`}>
      <div
        className="group relative bg-bg-surface border border-border rounded-xl p-5 hover:border-gray-500 transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full"
        style={{ '--universe-color': universe.color } as React.CSSProperties}
      >
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity duration-300"
          style={{ backgroundColor: universe.color }}
        />
        <div className="relative">
          <div className="text-4xl mb-3">{universe.icon}</div>
          <h3 className="font-bold text-white text-lg mb-1">{universe.name}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {universe.modes.length} {universe.modes.length === 1 ? 'modo' : 'modos'}
          </p>
          <div className="flex flex-wrap gap-1">
            {universe.modes.slice(0, 3).map(mode => (
              <span
                key={mode}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400"
              >
                {MODE_LABELS[mode] ?? mode}
              </span>
            ))}
            {universe.modes.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
                +{universe.modes.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/components/layout/universe-card.tsx && git commit -m "feat: add UniverseCard component with mode pills

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Home Page

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace apps/web/app/page.tsx**

```typescript
import { createClient } from '@/lib/supabase/server'
import { UniverseCard } from '@/components/layout/universe-card'
import { UNIVERSES } from '@/lib/constants/universes'
import type { Universe } from '@guessle/shared'

export const revalidate = 3600

export default async function HomePage() {
  const supabase = createClient()
  const { data: themes } = await supabase
    .from('themes')
    .select('slug, active')
    .eq('active', true)

  const activeSlugs = new Set(themes?.map(t => t.slug) ?? [])
  const universes: Universe[] = UNIVERSES.filter(u => activeSlugs.has(u.slug))

  const character = universes.filter(u => u.type === 'character')
  const game      = universes.filter(u => u.type === 'game')
  const code      = universes.filter(u => u.type === 'code')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-3">
          Escolha seu universo
        </h1>
        <p className="text-gray-400 text-lg">
          Um novo desafio todo dia em cada modo
        </p>
      </div>

      {character.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Personagens
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {character.map(u => <UniverseCard key={u.slug} universe={u} />)}
          </div>
        </section>
      )}

      {game.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Jogos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {game.map(u => <UniverseCard key={u.slug} universe={u} />)}
          </div>
        </section>
      )}

      {code.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Codigo
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {code.map(u => <UniverseCard key={u.slug} universe={u} />)}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify home page renders 14 universes**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm dev
```

Open `http://localhost:3000` — confirm:
- 3 sections: Personagens (10 cards), Jogos (1 card), Codigo (3 cards)
- Each card shows icon, name, mode pills
- Cards link to `/games/<slug>`

- [ ] **Step 3: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/app/page.tsx && git commit -m "feat: add home page with universe grid grouped by type

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Universe Hub Page

**Files:**
- Create: `apps/web/app/games/[slug]/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/kevin.souza/Documents/Github/guessle-verse/apps/web/app/games/\[slug\]
```

- [ ] **Step 2: Create apps/web/app/games/[slug]/page.tsx**

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUniverse } from '@/lib/constants/universes'

export const revalidate = 3600

interface Props {
  params: { slug: string }
}

const MODE_META: Record<string, { label: string; description: string; icon: string }> = {
  classic:           { label: 'Classic',          description: 'Adivinhe pelos atributos',            icon: '🎯' },
  silhouette:        { label: 'Silhouette',        description: 'Identifique pela silhueta',           icon: '👤' },
  quote:             { label: 'Quote',             description: 'Adivinhe pela frase',                 icon: '💬' },
  ability:           { label: 'Ability',           description: 'Identifique pela habilidade',         icon: '✨' },
  splash:            { label: 'Splash Art',        description: 'Adivinhe pelo splash art',            icon: '🖼️' },
  build:             { label: 'Build',             description: 'Identifique pelos itens',             icon: '🛡️' },
  'skill-order':     { label: 'Skill Order',       description: 'Identifique pela ordem de skills',   icon: '📋' },
  quadra:            { label: 'Quadra Kill',       description: 'Classic com 4 vidas',                 icon: '💀' },
  'devil-fruit':     { label: 'Devil Fruit',       description: 'Identifique pela fruta do diabo',    icon: '🍎' },
  wanted:            { label: 'Wanted',            description: 'Adivinhe pelo poster de procurado',  icon: '📜' },
  laugh:             { label: 'Laugh',             description: 'Adivinhe pelo riso',                  icon: '😂' },
  jutsu:             { label: 'Jutsu',             description: 'Identifique pelo jutsu',              icon: '🌀' },
  eye:               { label: 'Eye',              description: 'Adivinhe pelo dojutsu',               icon: '👁️' },
  voice:             { label: 'Voice',             description: 'Identifique pela voz',                icon: '🎤' },
  'cursed-technique':{ label: 'Cursed Technique',  description: 'Identifique pela tecnica maldita',   icon: '🩸' },
  eyes:              { label: 'Eyes',             description: 'Identifique pelos olhos',             icon: '👁️' },
  cry:               { label: 'Cry',              description: 'Adivinhe pelo grito',                 icon: '🔊' },
  kirby:             { label: 'Kirby',            description: 'Kirby copiou a habilidade',           icon: '⭐' },
  'final-smash':     { label: 'Final Smash',      description: 'Identifique pelo Final Smash',       icon: '💥' },
  item:              { label: 'Item',             description: 'Identifique pelo item',               icon: '🗡️' },
  location:          { label: 'Location',         description: 'Adivinhe pelo local',                 icon: '🗺️' },
  music:             { label: 'Music',            description: 'Identifique pela musica',             icon: '🎵' },
  game:              { label: 'Game',             description: 'Adivinhe pelo jogo',                  icon: '🎮' },
  sound:             { label: 'Sound',            description: 'Identifique pelo som',                icon: '🔉' },
  level:             { label: 'Level',            description: 'Adivinhe pela fase',                  icon: '🗺️' },
  weapon:            { label: 'Weapon',           description: 'Identifique pela arma',               icon: '⚔️' },
  roar:              { label: 'Roar',             description: 'Identifique pelo rugido',             icon: '🦁' },
  weakness:          { label: 'Weakness',         description: 'Identifique pelas fraquezas',         icon: '⚡' },
  screenshot:        { label: 'Screenshot',       description: 'Adivinhe pelo screenshot',            icon: '📸' },
  cover:             { label: 'Cover',            description: 'Adivinhe pela capa',                  icon: '📦' },
  soundtrack:        { label: 'Soundtrack',       description: 'Identifique pela trilha sonora',      icon: '🎼' },
  complete:          { label: 'Complete',         description: 'Complete o codigo',                   icon: '✏️' },
  fix:               { label: 'Fix',              description: 'Corrija o bug',                       icon: '🐛' },
  output:            { label: 'Output',           description: 'Qual e a saida?',                     icon: '💻' },
}

export default async function UniverseHubPage({ params }: Props) {
  const universe = getUniverse(params.slug)
  if (!universe) notFound()

  const supabase = createClient()
  const today    = new Date().toISOString().split('T')[0]

  const { data: theme } = await supabase
    .from('themes')
    .select('id')
    .eq('slug', params.slug)
    .single()

  const { data: challenges } = theme
    ? await supabase
        .from('daily_challenges')
        .select('mode')
        .eq('theme_id', theme.id)
        .eq('date', today)
        .in('mode', universe.modes)
    : { data: null }

  const modesWithChallenge = new Set(challenges?.map(c => c.mode) ?? [])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Voltar
        </Link>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-5xl">{universe.icon}</span>
          <div>
            <h1 className="text-3xl font-extrabold text-white">{universe.name}</h1>
            <p className="text-gray-400 mt-1">
              {universe.modes.length} modos disponíveis
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {universe.modes.map(mode => {
          const meta      = MODE_META[mode]
          const available = modesWithChallenge.has(mode)

          return (
            <Link
              key={mode}
              href={available ? `/games/${universe.slug}/${mode}` : '#'}
              aria-disabled={!available}
              className={`group relative bg-bg-surface border rounded-xl p-5 transition-all duration-300 ${
                available
                  ? 'border-border hover:border-gray-500 hover:-translate-y-0.5 cursor-pointer'
                  : 'border-border opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{meta?.icon ?? '🎮'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">
                      {meta?.label ?? mode}
                    </h3>
                    {!available && (
                      <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {meta?.description ?? ''}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add generateStaticParams**

Add this export to the same file, before the default export:

```typescript
export async function generateStaticParams() {
  const supabase = createClient()
  const { data } = await supabase.from('themes').select('slug').eq('active', true)
  return data?.map(t => ({ slug: t.slug })) ?? []
}
```

- [ ] **Step 4: Verify hub page**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm dev
```

Open `http://localhost:3000/games/pokemon` — confirm:
- Pokemon icon and name shown
- 4 mode cards rendered (classic, silhouette, ability, cry)
- Modes without today's challenge show "Em breve" badge

- [ ] **Step 5: Verify 404 for unknown slug**

Open `http://localhost:3000/games/nonexistent` — confirm Next.js 404 page shown

- [ ] **Step 6: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/app/games && git commit -m "feat: add universe hub page with mode cards and daily availability status

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm build
```

Expected: build succeeds with no TypeScript errors

- [ ] **Step 2: Run all tests**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm test
```

Expected: All 11 tests pass (feedback.test.ts + score.test.ts)

- [ ] **Step 3: Smoke test navigation flow**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm dev
```

Verify manually:
- `http://localhost:3000` → 14 universe cards in 3 sections
- `http://localhost:3000/games/lol` → 7 mode cards
- `http://localhost:3000/games/gamedle` → 4 mode cards
- `http://localhost:3000/games/js` → 3 mode cards (complete, fix, output)
- `http://localhost:3000/games/xyz` → 404

- [ ] **Step 4: Commit (if any lingering changes)**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git status
```

If clean: done. If dirty: stage and commit remaining files.

---

## Plan 1 Complete

**Deliverables:**
- Turborepo monorepo with pnpm workspaces
- `packages/shared` with typed game primitives, `computeFeedback`, `calculateScore` (11 tests passing)
- Full DB schema + ranking trigger + RLS running on Supabase
- 14 themes seeded
- Next.js 14 app with Tailwind design system and shadcn/ui
- Working home page (universe grid) and universe hub (`/games/[slug]`)

**Next:** Plan 2 — Game Engine (classic mode, auth, all game modes)
