# Guessle — Plan 2: Game Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full game engine — classic mode, all other game modes, authentication, and the game session/guess API routes.

**Architecture:** Mode Registry pattern with dynamic imports. `/api/guess` is the server-side security boundary for all guess processing. Zustand manages volatile UI state. TanStack Query manages server state. Auth via Supabase email/password. Game page is an RSC shell (fetches challenge) wrapping a Client Component (game state).

**Tech Stack:** Next.js 14 App Router, Supabase Auth + SSR, TanStack Query v5, Zustand, shadcn/ui, Web Audio API

---

## File Structure

```
apps/web/
├── app/
│   ├── api/
│   │   ├── session/route.ts          # POST: create/recover game session
│   │   └── guess/route.ts            # POST: validate guess, write DB, return feedback
│   ├── games/[slug]/[mode]/
│   │   └── page.tsx                  # RSC shell: fetches challenge, renders <GameClient>
│   ├── login/page.tsx                # Email/password sign in
│   ├── register/page.tsx             # Email/password sign up
│   ├── profile/page.tsx              # Auth-protected personal history
│   ├── ranking/page.tsx              # Global top 100
│   └── ranking/[slug]/page.tsx       # Per-universe top 100
├── components/
│   ├── game/
│   │   ├── GameClient.tsx            # Client wrapper: mounts hooks, renders active mode
│   │   ├── SearchInput.tsx           # Autocomplete input for character guesses
│   │   ├── AttributeCell.tsx         # Single feedback cell (correct/partial/wrong/arrow)
│   │   ├── GuessRow.tsx              # Row of AttributeCells for one guess
│   │   ├── HintReveal.tsx            # Shows hint 1 or 2 when unlocked
│   │   └── ShareButton.tsx           # Copy/share result grid
│   ├── modes/
│   │   ├── ClassicMode.tsx           # SearchInput + GuessRow list
│   │   ├── SilhouetteMode.tsx        # Image with CSS brightness filter
│   │   ├── QuoteMode.tsx             # Obfuscated quote, word revealed per attempt
│   │   ├── SplashMode.tsx            # Zoomed crop, progressively revealed
│   │   ├── AudioMode.tsx             # Web Audio player, longer clip each attempt
│   │   ├── WantedMode.tsx            # One Piece wanted poster
│   │   ├── KirbyMode.tsx             # Kirby ability image
│   │   ├── AbilityMode.tsx           # Ability icon without name
│   │   ├── BuildMode.tsx             # Champion build items
│   │   ├── SkillOrderMode.tsx        # Skill max order
│   │   ├── QuadraMode.tsx            # Classic with 4 lives
│   │   ├── WeaknessMode.tsx          # Monster elemental weaknesses
│   │   ├── FinalSmashMode.tsx        # Final Smash description/image
│   │   └── CodeMode.tsx              # Monaco-lite editor, 3 attempts
│   └── auth/
│       ├── LoginForm.tsx
│       └── RegisterForm.tsx
├── lib/
│   ├── game/
│   │   ├── registry.ts               # Mode slug → dynamic import map
│   │   └── share.ts                  # generateShareText()
│   └── store/
│       └── game-store.ts             # Zustand store: guesses, attempts, status
├── hooks/
│   ├── useDailyChallenge.ts          # TanStack Query: fetch today's challenge
│   ├── useGameSession.ts             # POST /api/session on mount
│   └── useGuess.ts                   # POST /api/guess, update store
└── middleware.ts                     # Supabase auth session refresh
```

---

## Task 1: Zustand Store + Hooks

**Files:**
- Create: `apps/web/lib/store/game-store.ts`
- Create: `apps/web/hooks/useDailyChallenge.ts`
- Create: `apps/web/hooks/useGameSession.ts`
- Create: `apps/web/hooks/useGuess.ts`

- [ ] **Step 1: Install Zustand**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web add zustand
```

- [ ] **Step 2: Create apps/web/lib/store/game-store.ts**

```typescript
import { create } from 'zustand'
import type { AttributeFeedback } from '@guessle/shared'

interface GuessEntry {
  value: string
  feedback: AttributeFeedback[]
}

interface GameState {
  guesses:   GuessEntry[]
  attempts:  number
  hintsUsed: number
  won:       boolean
  lost:      boolean
  score:     number | null
  addGuess:  (entry: GuessEntry) => void
  setWon:    (score: number) => void
  setLost:   () => void
  reset:     () => void
  hydrate:   (state: Partial<Pick<GameState, 'guesses' | 'attempts' | 'hintsUsed' | 'won' | 'lost' | 'score'>>) => void
}

const initial = {
  guesses:   [] as GuessEntry[],
  attempts:  0,
  hintsUsed: 0,
  won:       false,
  lost:      false,
  score:     null as number | null,
}

export const useGameStore = create<GameState>((set) => ({
  ...initial,
  addGuess: (entry) =>
    set((s) => ({ guesses: [...s.guesses, entry], attempts: s.attempts + 1 })),
  setWon: (score) => set({ won: true, score }),
  setLost: ()    => set({ lost: true }),
  reset:   ()    => set(initial),
  hydrate: (state) => set((s) => ({ ...s, ...state })),
}))
```

- [ ] **Step 3: Create apps/web/hooks/useDailyChallenge.ts**

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useDailyChallenge(themeSlug: string, mode: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['daily-challenge', themeSlug, mode],
    queryFn:  async () => {
      const today = new Date().toISOString().split('T')[0]

      const { data: theme } = await supabase
        .from('themes')
        .select('id')
        .eq('slug', themeSlug)
        .single()

      if (!theme) throw new Error('Theme not found')

      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('theme_id', theme.id)
        .eq('mode', mode)
        .eq('date', today)
        .single()

      if (error || !data) throw new Error('No challenge today')
      return data
    },
    staleTime: 1000 * 60 * 60,
    retry:     1,
  })
}
```

- [ ] **Step 4: Create apps/web/hooks/useGameSession.ts**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'

interface SessionData {
  sessionId:   number
  attempts:    number
  hintsUsed:   number
  won:         boolean
  completedAt: string | null
}

export function useGameSession(challengeId: number | null, authenticated: boolean) {
  const [session, setSession] = useState<SessionData | null>(null)
  const hydrate = useGameStore((s) => s.hydrate)

  useEffect(() => {
    if (!challengeId || !authenticated) return

    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ challengeId }),
    })
      .then((r) => r.json())
      .then((data: SessionData) => {
        setSession(data)
        if (data.completedAt) {
          hydrate({
            attempts:  data.attempts,
            hintsUsed: data.hintsUsed,
            won:       data.won,
            lost:      !data.won,
          })
        }
      })
      .catch(() => {})
  }, [challengeId, authenticated, hydrate])

  return session
}
```

- [ ] **Step 5: Create apps/web/hooks/useGuess.ts**

```typescript
'use client'

import { useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { shouldRevealHint } from '@guessle/shared'

interface GuessResponse {
  feedback: Array<{ key: string; label: string; value: string; feedback: string }>
  won:      boolean
  lost:     boolean
  score?:   number
}

export function useGuess(challengeId: number | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const { addGuess, setWon, setLost, attempts, hintsUsed } = useGameStore()

  const submitGuess = async (value: string) => {
    if (!challengeId || loading) return
    setLoading(true)
    setError(null)

    try {
      const res  = await fetch('/api/guess', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ challengeId, value }),
      })
      const data: GuessResponse = await res.json()

      addGuess({ value, feedback: data.feedback as any })

      const newAttempts = attempts + 1
      const newHints    = shouldRevealHint(newAttempts) ?? hintsUsed

      if (data.won) {
        setWon(data.score ?? 50)
      } else if (data.lost) {
        setLost()
      }

      return data
    } catch {
      setError('Erro ao enviar palpite. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return { submitGuess, loading, error }
}
```

- [ ] **Step 6: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

Expected: zero errors

- [ ] **Step 7: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/lib/store apps/web/hooks apps/web/package.json pnpm-lock.yaml && git commit -m "feat: add Zustand game store and game hooks

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: TanStack Query Provider

**Files:**
- Create: `apps/web/components/providers.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create apps/web/components/providers.tsx**

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Wrap layout.tsx with Providers**

Update `apps/web/app/layout.tsx` body to wrap children with `<Providers>`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Providers } from '@/components/providers'
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
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/components/providers.tsx apps/web/app/layout.tsx && git commit -m "feat: add TanStack Query provider to root layout

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Auth Middleware + Auth Pages

**Files:**
- Create: `apps/web/middleware.ts`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/register/page.tsx`
- Create: `apps/web/app/profile/page.tsx`
- Create: `apps/web/components/auth/LoginForm.tsx`
- Create: `apps/web/components/auth/RegisterForm.tsx`

- [ ] **Step 1: Create apps/web/middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/profile')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/register'
  )) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/profile', '/login', '/register'],
}
```

- [ ] **Step 2: Create apps/web/components/auth/LoginForm.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  const router   = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-bg-surface border-border text-white"
          placeholder="seu@email.com"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Senha</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="bg-bg-surface border-border text-white"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Entrando...' : 'Entrar'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create apps/web/components/auth/RegisterForm.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function RegisterForm() {
  const router   = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-bg-surface border-border text-white"
          placeholder="seu@email.com"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Senha</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="bg-bg-surface border-border text-white"
          placeholder="mínimo 6 caracteres"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Criando conta...' : 'Criar conta'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Create apps/web/app/login/page.tsx**

```typescript
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-white mb-2">Entrar</h1>
      <p className="text-gray-400 text-sm mb-8">
        Não tem conta?{' '}
        <Link href="/register" className="text-blue-400 hover:text-blue-300">
          Criar conta
        </Link>
      </p>
      <LoginForm />
    </div>
  )
}
```

- [ ] **Step 5: Create apps/web/app/register/page.tsx**

```typescript
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-white mb-2">Criar conta</h1>
      <p className="text-gray-400 text-sm mb-8">
        Já tem conta?{' '}
        <Link href="/login" className="text-blue-400 hover:text-blue-300">
          Entrar
        </Link>
      </p>
      <RegisterForm />
    </div>
  )
}
```

- [ ] **Step 6: Create apps/web/app/profile/page.tsx**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: sessions } = await supabase
    .from('game_sessions')
    .select('*, daily_challenges(mode, themes(name, icon))')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
        <p className="text-gray-400 text-sm mt-1">{user.email}</p>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Histórico recente</h2>
      {(!sessions || sessions.length === 0) ? (
        <p className="text-gray-500">Nenhuma partida concluída ainda.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s: any) => (
            <div key={s.id} className="bg-bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-white font-medium">
                  {s.daily_challenges?.themes?.icon} {s.daily_challenges?.themes?.name} — {s.daily_challenges?.mode}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(s.started_at).toLocaleDateString('pt-BR')} · {s.attempts} tentativas
                </p>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${s.won ? 'text-correct' : 'text-red-400'}`}>
                  {s.won ? `+${s.score} pts` : 'Derrota'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/middleware.ts apps/web/app/login apps/web/app/register apps/web/app/profile apps/web/components/auth && git commit -m "feat: add auth middleware, login, register, and profile pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: API Routes — /api/session and /api/guess

**Files:**
- Create: `apps/web/app/api/session/route.ts`
- Create: `apps/web/app/api/guess/route.ts`

- [ ] **Step 1: Create apps/web/app/api/session/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { challengeId } = await req.json()

  if (!challengeId) {
    return NextResponse.json({ error: 'challengeId required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  await service
    .from('game_sessions')
    .insert({ user_id: user.id, daily_challenge_id: challengeId, completed_at: null })
    .onConflict('user_id,daily_challenge_id')
    .ignore()

  const { data: session, error } = await service
    .from('game_sessions')
    .select('id, attempts, hints_used, won, completed_at, score')
    .eq('user_id', user.id)
    .eq('daily_challenge_id', challengeId)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Session error' }, { status: 500 })
  }

  return NextResponse.json({
    sessionId:   session.id,
    attempts:    session.attempts,
    hintsUsed:   session.hints_used,
    won:         session.won,
    score:       session.score,
    completedAt: session.completed_at,
  })
}
```

- [ ] **Step 2: Create apps/web/app/api/guess/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { computeFeedback, calculateScore } from '@guessle/shared'

export async function POST(req: NextRequest) {
  const { challengeId, value } = await req.json()

  if (!challengeId || !value) {
    return NextResponse.json({ error: 'challengeId and value required' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: challenge, error: challengeError } = await service
    .from('daily_challenges')
    .select('*')
    .eq('id', challengeId)
    .single()

  if (challengeError || !challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  }

  const isCodeMode = ['complete', 'fix', 'output'].includes(challenge.mode)

  let feedback: Array<{ key: string; label: string; value: string; feedback: string }> = []
  let won = false

  if (isCodeMode) {
    const answer = challenge.attributes?.answer as string
    won = value.trim() === answer.trim()
    feedback = [{ key: 'answer', label: 'Resposta', value, feedback: won ? 'correct' : 'wrong' }]
  } else {
    const { data: attributes } = challenge

    const candidateQuery = challenge.mode === 'classic' || !['screenshot','cover','soundtrack'].includes(challenge.mode)
      ? await service
          .from('characters')
          .select('name, attributes')
          .eq('theme_id', challenge.theme_id)
          .ilike('name', `%${value}%`)
          .limit(1)
          .single()
      : { data: null }

    const candidate = candidateQuery?.data

    if (!candidate) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    const targetAttrs  = challenge.attributes as Record<string, any>
    const candidateAttrs = candidate.attributes as Record<string, any>

    const attrKeys = Object.keys(targetAttrs)

    feedback = attrKeys.map((key) => {
      const targetVal    = String(targetAttrs[key] ?? '')
      const candidateVal = String(candidateAttrs[key] ?? '')

      const isNumeric    = !isNaN(Number(targetVal)) && !isNaN(Number(candidateVal))
      const isArray      = targetVal.includes(',')
      const compareMode  = isNumeric ? 'arrow' : isArray ? 'partial' : 'exact'

      return {
        key,
        label:    key,
        value:    candidateVal,
        feedback: computeFeedback(candidateVal, targetVal, compareMode),
      }
    })

    won = feedback.every((f) => f.feedback === 'correct')
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await service
      .from('game_sessions')
      .insert({ user_id: user.id, daily_challenge_id: challengeId, completed_at: null })
      .onConflict('user_id,daily_challenge_id')
      .ignore()

    const { data: session } = await service
      .from('game_sessions')
      .select('id, attempts, hints_used, won, completed_at')
      .eq('user_id', user.id)
      .eq('daily_challenge_id', challengeId)
      .single()

    if (session && !session.completed_at) {
      const newAttempts = (session.attempts ?? 0) + 1
      const maxAttempts = isCodeMode ? 3 : null
      const isLost      = maxAttempts !== null && !won && newAttempts >= maxAttempts

      if (won || isLost) {
        const score = won ? calculateScore(newAttempts, session.hints_used ?? 0) : 0

        await service
          .from('game_sessions')
          .update({
            attempts:     newAttempts,
            won,
            score,
            completed_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        await service.from('guesses').insert({
          session_id:     session.id,
          attempt_number: newAttempts,
          value,
          result:         feedback,
        })

        return NextResponse.json({ feedback, won, lost: isLost, score })
      }

      await service
        .from('game_sessions')
        .update({ attempts: newAttempts })
        .eq('id', session.id)

      await service.from('guesses').insert({
        session_id:     session.id,
        attempt_number: newAttempts,
        value,
        result:         feedback,
      })
    }
  }

  const maxAttempts = isCodeMode ? 3 : null
  const lost        = maxAttempts !== null && !won

  return NextResponse.json({ feedback, won, lost: !won && lost })
}
```

- [ ] **Step 3: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/app/api && git commit -m "feat: add /api/session and /api/guess routes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Mode Registry + Game Components

**Files:**
- Create: `apps/web/lib/game/registry.ts`
- Create: `apps/web/lib/game/share.ts`
- Create: `apps/web/components/game/AttributeCell.tsx`
- Create: `apps/web/components/game/GuessRow.tsx`
- Create: `apps/web/components/game/SearchInput.tsx`
- Create: `apps/web/components/game/HintReveal.tsx`
- Create: `apps/web/components/game/ShareButton.tsx`
- Create: `apps/web/components/game/GameClient.tsx`

- [ ] **Step 1: Create apps/web/lib/game/registry.ts**

```typescript
import type { ComponentType } from 'react'

export type ModeComponentProps = {
  challenge:   any
  config:      { slug: string; label: string; maxAttempts: number | null; lives?: number }
}

const registry: Record<string, () => Promise<{ default: ComponentType<ModeComponentProps> }>> = {
  classic:            () => import('@/components/modes/ClassicMode'),
  silhouette:         () => import('@/components/modes/SilhouetteMode'),
  quote:              () => import('@/components/modes/QuoteMode'),
  splash:             () => import('@/components/modes/SplashMode'),
  ability:            () => import('@/components/modes/AbilityMode'),
  build:              () => import('@/components/modes/BuildMode'),
  'skill-order':      () => import('@/components/modes/SkillOrderMode'),
  quadra:             () => import('@/components/modes/QuadraMode'),
  'devil-fruit':      () => import('@/components/modes/ClassicMode'),
  wanted:             () => import('@/components/modes/WantedMode'),
  laugh:              () => import('@/components/modes/AudioMode'),
  jutsu:              () => import('@/components/modes/AbilityMode'),
  eye:                () => import('@/components/modes/SilhouetteMode'),
  voice:              () => import('@/components/modes/AudioMode'),
  'cursed-technique': () => import('@/components/modes/AbilityMode'),
  eyes:               () => import('@/components/modes/SilhouetteMode'),
  cry:                () => import('@/components/modes/AudioMode'),
  kirby:              () => import('@/components/modes/KirbyMode'),
  'final-smash':      () => import('@/components/modes/FinalSmashMode'),
  item:               () => import('@/components/modes/AbilityMode'),
  location:           () => import('@/components/modes/SilhouetteMode'),
  music:              () => import('@/components/modes/AudioMode'),
  game:               () => import('@/components/modes/ClassicMode'),
  sound:              () => import('@/components/modes/AudioMode'),
  level:              () => import('@/components/modes/SilhouetteMode'),
  weapon:             () => import('@/components/modes/AbilityMode'),
  roar:               () => import('@/components/modes/AudioMode'),
  weakness:           () => import('@/components/modes/WeaknessMode'),
  screenshot:         () => import('@/components/modes/SplashMode'),
  cover:              () => import('@/components/modes/SplashMode'),
  soundtrack:         () => import('@/components/modes/AudioMode'),
  complete:           () => import('@/components/modes/CodeMode'),
  fix:                () => import('@/components/modes/CodeMode'),
  output:             () => import('@/components/modes/CodeMode'),
}

export const MODE_CONFIGS: Record<string, { label: string; maxAttempts: number | null; lives?: number }> = {
  classic:            { label: 'Classic',    maxAttempts: null },
  silhouette:         { label: 'Silhouette', maxAttempts: null },
  quote:              { label: 'Quote',      maxAttempts: null },
  splash:             { label: 'Splash',     maxAttempts: null },
  ability:            { label: 'Ability',    maxAttempts: null },
  build:              { label: 'Build',      maxAttempts: null },
  'skill-order':      { label: 'Skill Order',maxAttempts: null },
  quadra:             { label: 'Quadra',     maxAttempts: null, lives: 4 },
  'devil-fruit':      { label: 'Devil Fruit',maxAttempts: null },
  wanted:             { label: 'Wanted',     maxAttempts: null },
  laugh:              { label: 'Laugh',      maxAttempts: null },
  jutsu:              { label: 'Jutsu',      maxAttempts: null },
  eye:                { label: 'Eye',        maxAttempts: null },
  voice:              { label: 'Voice',      maxAttempts: null },
  'cursed-technique': { label: 'Cursed',     maxAttempts: null },
  eyes:               { label: 'Eyes',       maxAttempts: null },
  cry:                { label: 'Cry',        maxAttempts: null },
  kirby:              { label: 'Kirby',      maxAttempts: null },
  'final-smash':      { label: 'Final Smash',maxAttempts: null },
  item:               { label: 'Item',       maxAttempts: null },
  location:           { label: 'Location',   maxAttempts: null },
  music:              { label: 'Music',      maxAttempts: null },
  game:               { label: 'Game',       maxAttempts: null },
  sound:              { label: 'Sound',      maxAttempts: null },
  level:              { label: 'Level',      maxAttempts: null },
  weapon:             { label: 'Weapon',     maxAttempts: null },
  roar:               { label: 'Roar',       maxAttempts: null },
  weakness:           { label: 'Weakness',   maxAttempts: null },
  screenshot:         { label: 'Screenshot', maxAttempts: null },
  cover:              { label: 'Cover',      maxAttempts: null },
  soundtrack:         { label: 'Soundtrack', maxAttempts: null },
  complete:           { label: 'Complete',   maxAttempts: 3 },
  fix:                { label: 'Fix',        maxAttempts: 3 },
  output:             { label: 'Output',     maxAttempts: 3 },
}

export function getModeLoader(slug: string) {
  return registry[slug] ?? registry.classic
}
```

- [ ] **Step 2: Create apps/web/lib/game/share.ts**

```typescript
const EMOJI: Record<string, string> = {
  correct: '🟩',
  partial: '🟨',
  wrong:   '⬛',
  higher:  '⬆️',
  lower:   '⬇️',
}

export function generateShareText(
  universeName: string,
  mode: string,
  attempts: number,
  won: boolean,
  guesses: Array<{ feedback: Array<{ feedback: string }> }>
): string {
  const header  = `Guessle — ${universeName} (${mode})`
  const result  = won ? `${attempts}/∞` : 'X'
  const rows    = guesses.map((g) =>
    g.feedback.map((f) => EMOJI[f.feedback] ?? '⬜').join('')
  )

  return [header, result, ...rows].join('\n')
}
```

- [ ] **Step 3: Create apps/web/components/game/AttributeCell.tsx**

```typescript
'use client'

import type { FeedbackType } from '@guessle/shared'

interface AttributeCellProps {
  label:    string
  value:    string
  feedback: FeedbackType
}

const BG: Record<FeedbackType, string> = {
  correct: 'bg-correct text-white',
  partial: 'bg-partial text-black',
  wrong:   'bg-wrong text-gray-300',
  higher:  'bg-arrow text-white',
  lower:   'bg-arrow text-white',
}

const ARROW: Record<FeedbackType, string> = {
  higher:  ' ↑',
  lower:   ' ↓',
  correct: '',
  partial: '',
  wrong:   '',
}

export function AttributeCell({ label, value, feedback }: AttributeCellProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg p-2 min-w-[72px] text-center transition-colors duration-300 ${BG[feedback]}`}
    >
      <span className="text-xs font-medium opacity-75 mb-0.5 truncate max-w-full">{label}</span>
      <span className="text-sm font-bold truncate max-w-full">
        {value}{ARROW[feedback]}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Create apps/web/components/game/GuessRow.tsx**

```typescript
'use client'

import { AttributeCell } from './AttributeCell'
import type { FeedbackType } from '@guessle/shared'

interface GuessRowProps {
  guess: {
    value:    string
    feedback: Array<{ key: string; label: string; value: string; feedback: FeedbackType }>
  }
}

export function GuessRow({ guess }: GuessRowProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {guess.feedback.map((f) => (
        <AttributeCell
          key={f.key}
          label={f.label}
          value={f.value}
          feedback={f.feedback}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create apps/web/components/game/SearchInput.tsx**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'

interface SearchInputProps {
  themeId:    number
  onSubmit:   (value: string) => void
  disabled?:  boolean
  placeholder?: string
}

export function SearchInput({ themeId, onSubmit, disabled, placeholder }: SearchInputProps) {
  const supabase       = createClient()
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<string[]>([])
  const [open,    setOpen]    = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('characters')
        .select('name')
        .eq('theme_id', themeId)
        .ilike('name', `%${query}%`)
        .limit(8)

      setResults(data?.map((d) => d.name) ?? [])
      setOpen(true)
    }, 200)

    return () => clearTimeout(timer)
  }, [query, themeId, supabase])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (name: string) => {
    setQuery('')
    setOpen(false)
    onSubmit(name)
  }

  return (
    <div ref={ref} className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) select(results[0])
        }}
        disabled={disabled}
        placeholder={placeholder ?? 'Digite o nome...'}
        className="bg-bg-surface border-border text-white"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-surface border border-border rounded-lg overflow-hidden shadow-xl">
          {results.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => select(name)}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create apps/web/components/game/HintReveal.tsx**

```typescript
'use client'

interface HintRevealProps {
  hint:    1 | 2 | null
  extra:   Record<string, any>
}

export function HintReveal({ hint, extra }: HintRevealProps) {
  if (!hint) return null

  return (
    <div className="bg-bg-surface border border-partial/30 rounded-xl p-4 text-sm">
      <p className="text-partial font-semibold mb-1">
        {hint === 1 ? 'Dica 1' : 'Dica 2'}
      </p>
      <p className="text-gray-300">
        {hint === 1
          ? (extra.hint1 ?? 'Dica não disponível')
          : (extra.hint2 ?? 'Dica não disponível')}
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Create apps/web/components/game/ShareButton.tsx**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { generateShareText } from '@/lib/game/share'

interface ShareButtonProps {
  universeName: string
  mode:         string
  attempts:     number
  won:          boolean
  guesses:      Array<{ feedback: Array<{ feedback: string }> }>
}

export function ShareButton(props: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const text = generateShareText(
    props.universeName,
    props.mode,
    props.attempts,
    props.won,
    props.guesses
  )

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ text })
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button onClick={share} variant="outline" className="gap-2">
      {copied ? '✅ Copiado!' : '📤 Compartilhar'}
    </Button>
  )
}
```

- [ ] **Step 8: Create apps/web/components/game/GameClient.tsx**

```typescript
'use client'

import { lazy, Suspense, useEffect } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { useGameSession } from '@/hooks/useGameSession'
import { shouldRevealHint } from '@guessle/shared'
import { getModeLoader, MODE_CONFIGS } from '@/lib/game/registry'
import { GuessRow } from './GuessRow'
import { HintReveal } from './HintReveal'
import { ShareButton } from './ShareButton'
import { Skeleton } from '@/components/ui/skeleton'

interface GameClientProps {
  challengeId:  number
  slug:         string
  mode:         string
  universeName: string
  authenticated: boolean
  challenge:    any
}

export function GameClient({ challengeId, slug, mode, universeName, authenticated, challenge }: GameClientProps) {
  const config      = { slug: mode, ...MODE_CONFIGS[mode] ?? { label: mode, maxAttempts: null } }
  const ModeLoader  = lazy(getModeLoader(mode))

  const store   = useGameStore()
  const session = useGameSession(challengeId, authenticated)
  const { submitGuess, loading, error } = useGuess(challengeId)

  useEffect(() => { store.reset() }, [challengeId])

  const hint = shouldRevealHint(store.attempts)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white">{universeName} — {config.label}</h1>
        {config.maxAttempts && (
          <span className="text-xs text-gray-500 bg-bg-surface border border-border px-2 py-0.5 rounded-full">
            {store.attempts}/{config.maxAttempts} tentativas
          </span>
        )}
      </div>

      {!store.won && !store.lost && (
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <ModeLoader
            challenge={challenge}
            config={config}
          />
        </Suspense>
      )}

      {(store.won || store.lost) && (
        <div className={`rounded-xl p-6 border ${store.won ? 'border-correct/30 bg-correct/10' : 'border-red-500/30 bg-red-500/10'}`}>
          <p className={`text-lg font-bold ${store.won ? 'text-correct' : 'text-red-400'}`}>
            {store.won ? `🎉 Acertou em ${store.attempts} tentativa(s)!` : '💀 Não foi dessa vez.'}
          </p>
          {store.won && store.score != null && (
            <p className="text-sm text-gray-400 mt-1">+{store.score} pontos</p>
          )}
          <div className="mt-4">
            <ShareButton
              universeName={universeName}
              mode={mode}
              attempts={store.attempts}
              won={store.won}
              guesses={store.guesses}
            />
          </div>
        </div>
      )}

      <HintReveal hint={hint} extra={challenge.extra ?? {}} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {store.guesses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            Tentativas
          </h2>
          {store.guesses.map((g, i) => (
            <GuessRow key={i} guess={g as any} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 9: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/lib/game apps/web/components/game && git commit -m "feat: add mode registry, game components, and share utility

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Game Page (RSC Shell)

**Files:**
- Create: `apps/web/app/games/[slug]/[mode]/page.tsx`

- [ ] **Step 1: Create apps/web/app/games/[slug]/[mode]/page.tsx**

```typescript
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUniverse } from '@/lib/constants/universes'
import { GameClient } from '@/components/game/GameClient'

export const revalidate = 86400

interface Props {
  params: { slug: string; mode: string }
}

export async function generateStaticParams() {
  const supabase = createClient()
  const { data } = await supabase
    .from('themes')
    .select('slug, modes')
    .eq('active', true)

  return (data ?? []).flatMap((t) =>
    (t.modes as string[]).map((mode) => ({ slug: t.slug, mode }))
  )
}

export default async function GamePage({ params }: Props) {
  const universe = getUniverse(params.slug)
  if (!universe || !universe.modes.includes(params.mode)) notFound()

  const supabase = createClient()
  const today    = new Date().toISOString().split('T')[0]

  const { data: theme } = await supabase
    .from('themes')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (!theme) notFound()

  const { data: challenge } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('theme_id', theme.id)
    .eq('mode', params.mode)
    .eq('date', today)
    .single()

  const { data: { user } } = await supabase.auth.getUser()

  if (!challenge) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-2xl mb-2">⏳</p>
        <h2 className="text-lg font-semibold text-white mb-2">
          Desafio de hoje ainda não está disponível
        </h2>
        <p className="text-gray-400 text-sm">Volte mais tarde ou tente outro modo.</p>
      </div>
    )
  }

  return (
    <GameClient
      challengeId={challenge.id}
      slug={params.slug}
      mode={params.mode}
      universeName={universe.name}
      authenticated={!!user}
      challenge={challenge}
    />
  )
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add "apps/web/app/games/[slug]/[mode]" && git commit -m "feat: add game page RSC shell with challenge fetch and GameClient

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Classic Mode Component

**Files:**
- Create: `apps/web/components/modes/ClassicMode.tsx`

- [ ] **Step 1: Create apps/web/components/modes/ClassicMode.tsx**

```typescript
'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function ClassicMode({ challenge, config }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Adivinhe o personagem pelos atributos. Ilimitado tentativas.
      </p>

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Digite o nome do personagem..."
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create all remaining mode stubs**

Create these files as minimal stubs. They will render the challenge image or text and share the same SearchInput. The full visual behavior (progressive reveal, etc.) is implemented via the `challenge.extra` and `challenge.attributes` data that the Edge Function populates.

Create `apps/web/components/modes/SilhouetteMode.tsx`:

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function SilhouetteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const brightness = Math.min(10 + guesses.length * 15, 100)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.image_url && (
        <div className="relative w-48 h-48 mx-auto">
          <Image
            src={challenge.image_url}
            alt="Silhueta"
            fill
            className="object-contain rounded-xl transition-all duration-500"
            style={{ filter: won ? 'none' : `brightness(${brightness}%)` }}
          />
        </div>
      )}
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/QuoteMode.tsx`:

```typescript
'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function QuoteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const fullQuote: string  = challenge.extra?.quote ?? ''
  const words              = fullQuote.split(' ')
  const revealed           = Math.min(guesses.length + 1, words.length)
  const alreadyGuessed     = guesses.map((g) => g.value.toLowerCase())

  const display = words.map((w, i) =>
    i < revealed ? w : w.replace(/[a-zA-ZÀ-ú]/g, '_')
  ).join(' ')

  return (
    <div className="space-y-4">
      <p className="text-lg text-gray-200 font-medium italic leading-relaxed bg-bg-surface border border-border rounded-xl p-4">
        "{display}"
      </p>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Quem disse isso?"
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/SplashMode.tsx`:

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function SplashMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const zoom      = Math.max(200 - guesses.length * 20, 100)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.image_url && (
        <div className="w-full h-48 overflow-hidden rounded-xl relative">
          <div
            className="w-full h-full bg-center bg-no-repeat transition-all duration-500"
            style={{
              backgroundImage: `url(${challenge.image_url})`,
              backgroundSize:  `${zoom}%`,
            }}
          />
        </div>
      )}
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/AudioMode.tsx`:

```typescript
'use client'

import { useRef, useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import { Button } from '@/components/ui/button'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function AudioMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  const audioUrl: string = challenge.extra?.audio_url ?? challenge.extra?.cry_url ?? ''
  const maxDuration = Math.min(1 + guesses.length * 1.5, 10)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  const playClip = async () => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    audio.currentTime = 0
    setPlaying(true)
    await audio.play()

    setTimeout(() => {
      audio.pause()
      setPlaying(false)
    }, maxDuration * 1000)
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} preload="auto" />
      <Button
        onClick={playClip}
        disabled={playing || !audioUrl}
        className="gap-2"
      >
        {playing ? '🔊 Reproduzindo...' : `▶ Ouvir (${maxDuration.toFixed(1)}s)`}
      </Button>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/AbilityMode.tsx`:

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function AbilityMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  const abilityUrl: string = challenge.extra?.ability_url ?? challenge.image_url ?? ''

  return (
    <div className="space-y-4">
      {abilityUrl && (
        <div className="relative w-32 h-32 mx-auto">
          <Image src={abilityUrl} alt="Habilidade" fill className="object-contain rounded-xl" />
        </div>
      )}
      {challenge.extra?.ability_description && (
        <p className="text-sm text-gray-300 bg-bg-surface border border-border rounded-xl p-4">
          {challenge.extra.ability_description}
        </p>
      )}
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/BuildMode.tsx`:

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function BuildMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  const items: string[] = challenge.extra?.build_items ?? []

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {items.map((url, i) => (
          <div key={i} className="relative w-12 h-12">
            <Image src={url} alt={`Item ${i + 1}`} fill className="object-contain rounded-lg" />
          </div>
        ))}
      </div>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Qual campeão usa esse build?"
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/SkillOrderMode.tsx`:

```typescript
'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function SkillOrderMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  const order: string[] = challenge.extra?.skill_order ?? []

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        {order.map((skill, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-lg bg-bg-surface border border-border flex items-center justify-center text-lg font-bold text-white"
          >
            {skill}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Ordem de maxar as habilidades</p>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Qual campeão usa essa ordem?"
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/QuadraMode.tsx`:

```typescript
'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function QuadraMode({ challenge, config }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const lives          = (config.lives ?? 4) - guesses.filter((g) => !g.feedback.every((f: any) => f.feedback === 'correct')).length
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {Array.from({ length: config.lives ?? 4 }).map((_, i) => (
          <span key={i} className={`text-2xl ${i < lives ? 'opacity-100' : 'opacity-20'}`}>❤️</span>
        ))}
      </div>
      {!won && !lost && lives > 0 && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/WantedMode.tsx`:

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function WantedMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.extra?.wanted_url && (
        <div className="relative w-48 mx-auto">
          <Image
            src={challenge.extra.wanted_url}
            alt="Wanted Poster"
            width={192}
            height={256}
            className="rounded-xl object-contain"
          />
          {challenge.extra?.bounty && (
            <p className="text-center text-yellow-400 font-bold mt-2">
              Recompensa: {challenge.extra.bounty}
            </p>
          )}
        </div>
      )}
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Quem é o procurado?"
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/KirbyMode.tsx`:

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function KirbyMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.extra?.kirby_url && (
        <div className="relative w-48 h-48 mx-auto">
          <Image src={challenge.extra.kirby_url} alt="Kirby" fill className="object-contain rounded-xl" />
        </div>
      )}
      <p className="text-sm text-gray-400">Kirby copiou a habilidade de qual lutador?</p>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/WeaknessMode.tsx`:

```typescript
'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

const ELEMENTS = ['fogo', 'água', 'gelo', 'trovão', 'dragão']
const COLORS: Record<string, string> = {
  fogo: 'text-red-400', água: 'text-blue-400', gelo: 'text-cyan-300',
  trovão: 'text-yellow-400', dragão: 'text-purple-400',
}

export default function WeaknessMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  const weaknesses: Record<string, number> = challenge.extra?.weaknesses ?? {}

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {ELEMENTS.map((el) => (
          <div key={el} className="text-center">
            <p className={`text-sm font-bold ${COLORS[el]}`}>{el}</p>
            <p className="text-white font-mono text-lg">{weaknesses[el] ?? '?'}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Fraquezas elementais (escala de eficácia)</p>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Qual monstro tem essas fraquezas?"
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/FinalSmashMode.tsx`:

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function FinalSmashMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.extra?.final_smash_url && (
        <div className="relative w-full h-40">
          <Image src={challenge.extra.final_smash_url} alt="Final Smash" fill className="object-contain rounded-xl" />
        </div>
      )}
      {challenge.extra?.final_smash_description && (
        <p className="text-sm text-gray-300 bg-bg-surface border border-border rounded-xl p-4">
          {challenge.extra.final_smash_description}
        </p>
      )}
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Qual lutador tem esse Final Smash?"
        />
      )}
    </div>
  )
}
```

Create `apps/web/components/modes/CodeMode.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function CodeMode({ challenge, config }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const [answer, setAnswer] = useState('')

  const code: string    = challenge.attributes?.code ?? ''
  const mode: string    = challenge.attributes?.mode_variant ?? challenge.mode
  const remaining       = (config.maxAttempts ?? 3) - guesses.length

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return
    submitGuess(answer.trim())
    setAnswer('')
  }

  const label = mode === 'complete'
    ? 'Complete o código (preencha os ___)'
    : mode === 'fix'
    ? 'Corrija o bug no código'
    : 'Qual é a saída desse código?'

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-border rounded-xl p-4 font-mono text-sm text-green-400 whitespace-pre-wrap overflow-x-auto">
        {code}
      </div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-xs text-gray-600">{remaining} tentativa(s) restante(s)</p>

      {!won && !lost && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Sua resposta..."
            className="bg-bg-surface border-border text-white font-mono flex-1"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !answer.trim()}>
            Enviar
          </Button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/components/modes && git commit -m "feat: add all game mode components (classic, visual, audio, special, code)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Ranking Pages

**Files:**
- Create: `apps/web/app/ranking/page.tsx`
- Create: `apps/web/app/ranking/[slug]/page.tsx`

- [ ] **Step 1: Create apps/web/app/ranking/page.tsx**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 300

const TIERS: [number, string, string][] = [
  [50000, 'Diamond', '💎'],
  [30000, 'Platinum', '🥈'],
  [15000, 'Gold', '🥇'],
  [5000,  'Silver', '🪙'],
  [0,     'Bronze', '🥉'],
]

function getTier(score: number) {
  return TIERS.find(([min]) => score >= min) ?? TIERS[TIERS.length - 1]
}

export default async function RankingPage() {
  const service = createServiceClient()

  const { data: rows } = await service
    .from('rankings')
    .select('user_id, score, total_wins, total_games, best_streak')

  if (!rows || rows.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">Nenhum ranking ainda.</p>
      </div>
    )
  }

  const aggregated = Object.values(
    rows.reduce((acc: Record<string, any>, r) => {
      const uid = r.user_id
      if (!acc[uid]) acc[uid] = { user_id: uid, score: 0, total_wins: 0, total_games: 0, best_streak: 0 }
      acc[uid].score       += r.score ?? 0
      acc[uid].total_wins  += r.total_wins ?? 0
      acc[uid].total_games += r.total_games ?? 0
      acc[uid].best_streak  = Math.max(acc[uid].best_streak, r.best_streak ?? 0)
      return acc
    }, {})
  ).sort((a: any, b: any) => b.score - a.score).slice(0, 100)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-2xl font-bold text-white mb-8">Ranking Global</h1>
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-gray-500 text-xs uppercase">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Jogador</th>
              <th className="px-4 py-3 text-right">Tier</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Vitórias</th>
              <th className="px-4 py-3 text-right">Streak</th>
            </tr>
          </thead>
          <tbody>
            {(aggregated as any[]).map((row, i) => {
              const [, tierName, tierIcon] = getTier(row.score)
              const initials = (row.user_id as string).slice(0, 2).toUpperCase()

              return (
                <tr key={row.user_id} className="border-t border-border hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                        {initials}
                      </div>
                      <span className="text-gray-300 font-mono text-xs">{(row.user_id as string).slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs">{tierIcon} {tierName}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{row.score.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.total_wins}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.best_streak}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create apps/web/app/ranking/[slug]/page.tsx**

```typescript
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getUniverse } from '@/lib/constants/universes'
import Link from 'next/link'

export const revalidate = 300

interface Props {
  params: { slug: string }
}

const TIERS: [number, string, string][] = [
  [50000, 'Diamond', '💎'],
  [30000, 'Platinum', '🥈'],
  [15000, 'Gold', '🥇'],
  [5000,  'Silver', '🪙'],
  [0,     'Bronze', '🥉'],
]

function getTier(score: number) {
  return TIERS.find(([min]) => score >= min) ?? TIERS[TIERS.length - 1]
}

export default async function UniverseRankingPage({ params }: Props) {
  const universe = getUniverse(params.slug)
  if (!universe) notFound()

  const service = createServiceClient()

  const { data: theme } = await service
    .from('themes')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (!theme) notFound()

  const { data: rows } = await service
    .from('rankings')
    .select('user_id, score, total_wins, total_games, best_streak, win_rate, avg_attempts')
    .eq('theme_id', theme.id)
    .order('score', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link href="/ranking" className="text-sm text-gray-500 hover:text-gray-300">← Ranking Global</Link>
        <h1 className="text-2xl font-bold text-white mt-2">
          {universe.icon} {universe.name} — Ranking
        </h1>
      </div>

      {(!rows || rows.length === 0) ? (
        <p className="text-gray-500">Nenhum jogador nesse universo ainda.</p>
      ) : (
        <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Jogador</th>
                <th className="px-4 py-3 text-right">Tier</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Win%</th>
                <th className="px-4 py-3 text-right">Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const [, tierName, tierIcon] = getTier(row.score ?? 0)
                const initials = row.user_id.slice(0, 2).toUpperCase()

                return (
                  <tr key={row.user_id} className="border-t border-border hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          {initials}
                        </div>
                        <span className="text-gray-300 font-mono text-xs">{row.user_id.slice(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs">{tierIcon} {tierName}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-semibold">
                      {(row.score ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {row.win_rate != null ? `${Number(row.win_rate).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{row.best_streak ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/app/ranking && git commit -m "feat: add global and per-universe ranking pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Update Header with Auth State

**Files:**
- Modify: `apps/web/components/layout/header.tsx`

- [ ] **Step 1: Update header.tsx to show user state**

```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function Header() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
          {user ? (
            <Link
              href="/profile"
              className="text-sm bg-bg-surface border border-border px-4 py-2 rounded-lg text-gray-200 hover:border-gray-500 transition-colors duration-200"
            >
              Perfil
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm bg-bg-surface border border-border px-4 py-2 rounded-lg text-gray-200 hover:border-gray-500 transition-colors duration-200"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add apps/web/components/layout/header.tsx && git commit -m "feat: update header to show profile link when authenticated

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Final Build Verification

- [ ] **Step 1: Run all shared tests**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm test
```

Expected: 20 tests pass

- [ ] **Step 2: Full TypeScript check**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && pnpm --filter @guessle/web exec tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Git status**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git status && git log --oneline -10
```

Expected: clean working tree

---

## Plan 2 Complete

**Deliverables:**
- Zustand game store + hooks (useDailyChallenge, useGameSession, useGuess)
- TanStack Query provider in root layout
- Supabase auth middleware with protected routes
- Auth pages: /login, /register, /profile
- API routes: /api/session, /api/guess (server-side feedback computation + DB writes)
- Mode Registry mapping all 34+ mode slugs to components
- Game components: AttributeCell, GuessRow, SearchInput, HintReveal, ShareButton, GameClient
- All game mode components (14 distinct implementations)
- /games/[slug]/[mode] RSC shell page
- Ranking pages: global + per-universe
- Header updated with auth state

**Next:** Plan 3 — Data Pipeline (Edge Functions: cron-daily-challenges, refresh-catalog, generate-code-puzzle)
