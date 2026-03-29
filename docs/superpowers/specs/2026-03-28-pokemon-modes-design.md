# Pokémon Modes — Design Spec
**Date:** 2026-03-28
**Status:** Approved

---

## Overview

Replace the existing Pokémon universe modes (`classic`, `silhouette`, `ability`, `cry`) with 4 new dedicated modes. Each mode gets its own React component and slug to avoid conflicts with generic modes used by other universes.

**New mode slugs:** `pokemon-classic`, `pokemon-card`, `pokemon-description`, `pokemon-silhouette`

**Scope exclusion:** Gen 1 only (151 Pokémon). No Legendary/Mythical exclusions specified — all 151 are eligible.

---

## Data Layer

### `characters.attributes` — new fields

| Field | Source | Type | Notes |
|---|---|---|---|
| `habitat` | PokéAPI `/pokemon-species/{id}` → `habitat.name` | string | e.g. `"forest"`, `"grassland"` |
| `evolution_stage` | PokéAPI evolution chain depth | number | base=1, second=2, third=3 |

Existing fields kept: `pokedex_number`, `type1`, `type2`, `generation`, `height_m`, `weight_kg`, `color`.

### `characters.extra` — new field

| Field | Source | Notes |
|---|---|---|
| `card_url` | pokemontcg.io — Base Set 1 filtered by `nationalPokedexNumbers` | First matching card; 600x825px PNG |

### `daily_challenges.extra` per mode

| Mode | Extra fields |
|---|---|
| `pokemon-classic` | none — uses `attributes` snapshot |
| `pokemon-card` | `card_url` (copied from `characters.extra`) |
| `pokemon-description` | `description` (AI-generated at cron time) |
| `pokemon-silhouette` | none — position derived from `challenge.id` in frontend |

---

## Frontend

### Mode Registry
Add to `apps/web/lib/game/registry.ts`:
```typescript
'pokemon-classic':     () => import('@/components/modes/PokemonClassicMode'),
'pokemon-card':        () => import('@/components/modes/PokemonCardMode'),
'pokemon-description': () => import('@/components/modes/PokemonDescriptionMode'),
'pokemon-silhouette':  () => import('@/components/modes/PokemonSilhouetteMode'),
```

Add to `MODE_CONFIGS`:
```typescript
'pokemon-classic':     { label: 'Classic',     maxAttempts: null },
'pokemon-card':        { label: 'Card',         maxAttempts: null },
'pokemon-description': { label: 'Description',  maxAttempts: null },
'pokemon-silhouette':  { label: 'Silhouette',   maxAttempts: null },
```

Update `apps/web/lib/constants/universes.ts`:
```typescript
{ slug: 'pokemon', modes: ['pokemon-classic', 'pokemon-card', 'pokemon-description', 'pokemon-silhouette'] }
```

---

### `PokemonClassicMode`

**File:** `apps/web/components/modes/PokemonClassicMode.tsx`

- Image: official artwork from `challenge.image_url` with CSS retro filter:
  `image-rendering: pixelated`, adjusted contrast/saturation to evoke Game Boy aesthetic
- Guess input: Pokémon name (same autocomplete pattern as existing classic)
- Attribute columns (in order):

| Column | Key | Compare mode | Notes |
|---|---|---|---|
| Pokémon | image | — | Revealed on win |
| Type 1 | `type1` | exact | |
| Type 2 | `type2` | exact | Shows "None" if empty |
| Habitat | `habitat` | exact | |
| Color | `color` | exact | |
| Evolution Stage | `evolution_stage` | arrow (higher/lower) | 1/2/3 |
| Height | `height_m` | arrow | Displayed as `{n}m` |
| Weight | `weight_kg` | arrow | Displayed as `{n}kg` |

- `AttributeCell` reused for all columns
- Nature Types emoji logic does not apply here (Naruto-specific)

---

### `PokemonCardMode`

**File:** `apps/web/components/modes/PokemonCardMode.tsx`

- Shows card image from `challenge.extra.card_url`
- Initial blur: `50px`
- Each wrong guess reduces blur by `5px` → fully revealed at 10 wrong guesses
- No hints at any point
- Aspect ratio: `600x825` (preserve with `aspect-[600/825]` container)
- On win: remove blur entirely, show Pokémon name below card
- Guess input: Pokémon name

---

### `PokemonDescriptionMode`

**File:** `apps/web/components/modes/PokemonDescriptionMode.tsx`

- Shows `challenge.extra.description` — AI-rewritten flavor text, no name mentions
- Progressive hints:
  - After 5 wrong guesses: *"Hint: This Pokémon is [type1] type"*
  - After 10 wrong guesses: *"Hint: It lives in [habitat]"*
- Hints are additive (both shown after 10 errors)
- Guess input: Pokémon name

---

### `PokemonSilhouetteMode`

**File:** `apps/web/components/modes/PokemonSilhouetteMode.tsx`

- Image: official artwork with `brightness(0) contrast(1)` CSS filter (pure black silhouette)
- On win: remove filter, reveal full-color image

**Zoom/crop logic (deterministic, no refresh bug):**
```typescript
const x = (challenge.id * 37) % 60 + 20  // range 20–80
const y = (challenge.id * 53) % 60 + 20  // range 20–80
const zoom = Math.max(500 - guesses.length * 80, 100)  // 500% → 100%
```

- `backgroundPosition: ${x}% ${y}%` — fixed per challenge, never changes on refresh
- `backgroundSize: ${zoom}%`
- Container: fixed size (e.g., `w-64 h-64`), `overflow-hidden`

**LoL bug fix (same session):**
Apply the same deterministic position logic to `SplashMode` — replace any `Math.random()` position with `(challenge.id * seed) % range + offset`.

---

## Backend

### `refresh-catalog` additions (Pokémon handler)

1. **Habitat:** `GET /pokemon-species/{pokedex_number}` → `data.habitat?.name ?? 'unknown'`
2. **Evolution stage:**
   - Fetch `evolution_chain` URL from species data
   - Walk chain: find where current Pokémon appears, count depth (root=1)
3. **Card URL:**
   - `GET https://api.pokemontcg.io/v2/cards?q=set.id:base1 nationalPokedexNumbers:{pokedex_number}`
   - Take `data[0].images.large` (600x825 hires PNG)
   - Store in `characters.extra.card_url`
   - If no Base Set 1 card found: store `null` (Pokémon excluded from `pokemon-card` pool at cron)

### `cron-daily-challenges` — `fetchPokemon()` updates

**`pokemon-card`:**
- Filter pool: only characters where `extra->card_url IS NOT NULL`
- Copy `pick.extra.card_url` into `daily_challenges.extra`

**`pokemon-description`:**
- Fetch PokéAPI flavor text: `GET /pokemon-species/{pokedex_number}` → find an English `flavor_text_entries` entry
- Call Gemini API with prompt:
  > *"Rewrite this Pokémon description without mentioning the Pokémon's name '[name]'. Keep it factual, 2-3 sentences. Return only the rewritten description."*
- Store result in `daily_challenges.extra.description`
- Fallback: if Gemini fails, use original flavor text with name replaced by `"this Pokémon"`

**`pokemon-classic` / `pokemon-silhouette`:**
- No extra fields needed — use existing `fetchPokemon()` flow unchanged

### DB migration
```sql
UPDATE themes
SET modes = array['pokemon-classic','pokemon-card','pokemon-description','pokemon-silhouette']
WHERE slug = 'pokemon';
```

---

## Bug Fix: LoL Splash Refresh Position

**File:** `apps/web/components/modes/SplashMode.tsx`

Replace any `Math.random()` used for background position with deterministic calculation seeded by `challenge.id`. Exact implementation mirrors `PokemonSilhouetteMode` pattern.

---

## Out of Scope

- Pokémon cry mode (removed, not replaced)
- Pokémon ability mode (removed, not replaced)
- Generation 2+ Pokémon
- Mobile-specific layout (follows existing responsive patterns)
- Pokémon card from sets other than Base Set 1
