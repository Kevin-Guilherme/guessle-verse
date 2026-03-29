# Pokémon Modes — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register 4 new Pokémon mode components, implement each one, and fix the deterministic position bug in LoL's SplashMode.

**Architecture:** Four isolated React components (`PokemonClassicMode`, `PokemonCardMode`, `PokemonDescriptionMode`, `PokemonSilhouetteMode`) registered in the mode registry and the universes constant. Each component consumes `challenge.attributes` or `challenge.extra` as specified in the design spec. The `SplashMode` crop position is made deterministic using `challenge.id`.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, existing hooks `useGameStore`, `useGuess`, `SearchInput`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/lib/game/registry.ts` | Modify | Register 4 new mode slugs |
| `apps/web/lib/constants/universes.ts` | Modify | Update Pokémon modes array |
| `apps/web/components/modes/PokemonClassicMode.tsx` | Create | Search input for classic attribute mode |
| `apps/web/components/modes/PokemonCardMode.tsx` | Create | Blurred TCG card, blur reduces on wrong guesses |
| `apps/web/components/modes/PokemonDescriptionMode.tsx` | Create | AI description with progressive type/habitat hints |
| `apps/web/components/modes/PokemonSilhouetteMode.tsx` | Create | Zoomed silhouette with deterministic crop position |
| `apps/web/components/modes/SplashMode.tsx` | Modify | Replace `Math.random()` crop with deterministic logic |

---

### Task 1: Register new modes in registry and universes

**Files:**
- Modify: `apps/web/lib/game/registry.ts`
- Modify: `apps/web/lib/constants/universes.ts`

- [ ] **Step 1: Add to registry**

In `apps/web/lib/game/registry.ts`, add 4 entries to the `registry` object (after the `cry` entry):

```typescript
  'pokemon-classic':     () => import('@/components/modes/PokemonClassicMode'),
  'pokemon-card':        () => import('@/components/modes/PokemonCardMode'),
  'pokemon-description': () => import('@/components/modes/PokemonDescriptionMode'),
  'pokemon-silhouette':  () => import('@/components/modes/PokemonSilhouetteMode'),
```

Add 4 entries to `MODE_CONFIGS` (after the `cry` entry):

```typescript
  'pokemon-classic':     { label: 'Classic',     maxAttempts: null },
  'pokemon-card':        { label: 'Card',         maxAttempts: null },
  'pokemon-description': { label: 'Description',  maxAttempts: null },
  'pokemon-silhouette':  { label: 'Silhouette',   maxAttempts: null },
```

- [ ] **Step 2: Update universes.ts**

In `apps/web/lib/constants/universes.ts`, find the `pokemon` entry and replace its `modes` array:

```typescript
{ slug: 'pokemon', name: 'Pokédle', icon: '⚡', color: '#FFCC02', type: 'character',
  modes: ['pokemon-classic', 'pokemon-card', 'pokemon-description', 'pokemon-silhouette'] },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/game/registry.ts apps/web/lib/constants/universes.ts
git commit -m "feat(pokemon): register 4 new mode slugs in registry and universes"
```

---

### Task 2: Create PokemonClassicMode

**Files:**
- Create: `apps/web/components/modes/PokemonClassicMode.tsx`

This component renders only the search input. The attribute grid (columns, headers, guess rows) is rendered by `GameClient` and `GuessRow` automatically based on feedback returned by the API. The retro aesthetic comes from the official artwork displayed at small sizes with `image-rendering: pixelated`.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonClassicMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Guess the Pokémon from its attributes. Unlimited attempts.
      </p>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Enter Pokémon name..."
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/modes/PokemonClassicMode.tsx
git commit -m "feat(pokemon): add PokemonClassicMode component"
```

---

### Task 3: Create PokemonCardMode

**Files:**
- Create: `apps/web/components/modes/PokemonCardMode.tsx`

Shows the TCG card from `challenge.extra.card_url` with blur that starts at 50px and reduces by 5px per wrong guess (fully clear after 10 wrong guesses). No hints are shown at any point.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonCardMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const cardUrl      = (challenge.extra as Record<string, unknown>)?.card_url as string | undefined
  const wrongGuesses = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const blurPx       = won ? 0 : Math.max(50 - wrongGuesses * 5, 0)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Guess the Pokémon from its TCG card. The card clears with each wrong guess.
      </p>

      {/* Card */}
      <div className="flex justify-center">
        <div
          className="relative overflow-hidden rounded-xl border border-white/10"
          style={{ width: 240, height: 330 }}
        >
          {cardUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardUrl}
              alt="Pokémon card"
              width={240}
              height={330}
              className="w-full h-full object-cover select-none"
              style={{
                filter:           `blur(${blurPx}px)`,
                transition:       'filter 400ms ease',
                imageRendering:   'auto',
              }}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface text-slate-500 text-sm">
              Card not available
            </div>
          )}

          {/* Wrong guess counter badge */}
          {!won && !lost && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-display px-2 py-1 rounded-full">
              {wrongGuesses}/10
            </div>
          )}
        </div>
      </div>

      {/* Win reveal */}
      {won && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-correct font-display font-bold text-base tracking-wide">
            {challenge.name}
          </p>
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
          placeholder="Enter Pokémon name..."
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/modes/PokemonCardMode.tsx
git commit -m "feat(pokemon): add PokemonCardMode component"
```

---

### Task 4: Create PokemonDescriptionMode

**Files:**
- Create: `apps/web/components/modes/PokemonDescriptionMode.tsx`

Shows an AI-generated Pokédex description. Hints unlock progressively:
- After 5 wrong guesses: type hint
- After 10 wrong guesses: habitat hint (type hint remains visible)

- [ ] **Step 1: Create the component**

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonDescriptionMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const extra        = (challenge.extra  ?? {}) as Record<string, unknown>
  const attrs        = (challenge.attributes ?? {}) as Record<string, unknown>
  const description  = (extra.description ?? '') as string
  const type1        = (attrs.type1 ?? '') as string
  const type2        = (attrs.type2 ?? null) as string | null
  const habitat      = (attrs.habitat ?? '') as string

  const wrongGuesses = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const showTypeHint    = !won && wrongGuesses >= 5
  const showHabitatHint = !won && wrongGuesses >= 10
  const alreadyGuessed  = guesses.map((g) => g.value.toLowerCase())

  const typeLabel = type2 && type2 !== 'None'
    ? `${type1} / ${type2}`
    : type1

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="rounded-xl border border-border bg-bg-surface p-4">
        <p className="text-gray-200 text-base leading-relaxed italic">
          &ldquo;{description || 'Description not available.'}&rdquo;
        </p>
      </div>

      {/* Type hint */}
      {showTypeHint && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <span className="text-amber-400 text-base shrink-0">💡</span>
          <p className="text-amber-300 text-sm font-sans">
            Type: <span className="font-semibold capitalize">{typeLabel}</span>
          </p>
        </div>
      )}

      {/* Habitat hint */}
      {showHabitatHint && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <span className="text-blue-400 text-base shrink-0">🌍</span>
          <p className="text-blue-300 text-sm font-sans">
            Habitat: <span className="font-semibold capitalize">{habitat}</span>
          </p>
        </div>
      )}

      {/* Win reveal */}
      {won && challenge.image_url && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="relative w-20 h-20 overflow-hidden">
            <Image
              src={challenge.image_url as string}
              alt={challenge.name}
              fill
              className="object-contain"
            />
          </div>
          <p className="text-correct font-display font-bold text-sm tracking-wide">
            {challenge.name}
          </p>
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
          placeholder="Enter Pokémon name..."
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/modes/PokemonDescriptionMode.tsx
git commit -m "feat(pokemon): add PokemonDescriptionMode with progressive hints"
```

---

### Task 5: Create PokemonSilhouetteMode

**Files:**
- Create: `apps/web/components/modes/PokemonSilhouetteMode.tsx`

Shows a silhouette (pure black filter) of the official artwork, zoomed into a deterministic position derived from `challenge.id`. Zoom reduces by ~80% per wrong guess from 500% to 100%.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonSilhouetteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const wrongGuesses = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  // Deterministic crop position — same every refresh, derived from challenge.id
  const cropX = (challenge.id * 37) % 60 + 20  // range 20–80
  const cropY = (challenge.id * 53) % 60 + 20  // range 20–80

  const zoom = won ? 100 : Math.max(500 - wrongGuesses * 80, 100)
  const bgPos = won ? 'center' : `${cropX}% ${cropY}%`

  const imageUrl = challenge.image_url as string | undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {won ? challenge.name : "Who's that Pokémon? The silhouette reveals more with each wrong guess."}
      </p>

      {/* Silhouette display */}
      <div className="flex justify-center">
        <div
          className="w-64 h-64 mx-auto rounded-xl border border-white/10 overflow-hidden bg-black"
          style={{
            backgroundImage:    imageUrl ? `url(${imageUrl})` : undefined,
            backgroundSize:     `${zoom}%`,
            backgroundPosition: bgPos,
            backgroundRepeat:   'no-repeat',
            filter:             won ? 'none' : 'brightness(0)',
            transition:         'background-size 400ms ease, filter 400ms ease',
          }}
          aria-label={won ? challenge.name : 'Pokémon silhouette'}
        />
      </div>

      {/* Win image (full reveal below the silhouette box) */}
      {won && imageUrl && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-correct font-display font-bold text-sm tracking-wide">
            {challenge.name}
          </p>
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
          placeholder="Enter Pokémon name..."
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/modes/PokemonSilhouetteMode.tsx
git commit -m "feat(pokemon): add PokemonSilhouetteMode with deterministic crop position"
```

---

### Task 6: Fix LoL SplashMode deterministic crop position

**Files:**
- Modify: `apps/web/components/modes/SplashMode.tsx`

The current implementation uses `Math.random()` for the crop position, which re-rolls on every page refresh and lets players cheat by refreshing until they get an easy crop. Replace with deterministic calculation seeded by `challenge.id`.

- [ ] **Step 1: Find the cropPos useMemo**

In `apps/web/components/modes/SplashMode.tsx`, find this block (around line 64):

```typescript
  const cropPos = useMemo(() => ({
    x: Math.floor(Math.random() * 60) + 20,  // 20%–80%
    y: Math.floor(Math.random() * 60) + 20,
  }), [])
```

- [ ] **Step 2: Replace with deterministic calculation**

Remove the `useMemo` import reference for cropPos and replace the block with:

```typescript
  // Deterministic crop — same position every refresh for the same challenge
  const cropX = (challenge.id * 37) % 60 + 20  // range 20–80
  const cropY = (challenge.id * 53) % 60 + 20  // range 20–80
```

- [ ] **Step 3: Update all references to cropPos**

Find every usage of `cropPos.x` and `cropPos.y` in SplashMode.tsx and replace:
- `cropPos.x` → `cropX`
- `cropPos.y` → `cropY`

- [ ] **Step 4: Remove unused useMemo if no longer needed**

Check if `useMemo` is still used elsewhere in the file. If not, remove it from the import line:

```typescript
import { useState, useRef, useEffect } from 'react'
```

(only remove `useMemo` — keep the others)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/modes/SplashMode.tsx
git commit -m "fix(lol): deterministic splash crop position — no more refresh exploit"
```

---

### Task 7: Push all changes

- [ ] **Step 1: Verify build**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 2: Push**

```bash
git push
```
