# Monster Hunter Modes — Design Spec
**Date:** 2026-03-30
**Status:** Approved

---

## Overview

Add 3 new dedicated modes to the Monster Hunter universe, replacing the existing generic mode slugs (`classic`, `silhouette`, `roar`, `weakness`) with universe-specific slugs. The `roar` mode is deferred (no public audio API available). `weakness` is removed.

**New mode slugs:** `monsterhunter-classic`, `monsterhunter-description`, `monsterhunter-silhouette`

**Scope:** Large Monsters, Generations 1–5 (MH1 through MHWorld/Iceborne), ~150 monsters.

---

## Data Layer

### Sources

| Source | URL | Purpose |
|---|---|---|
| CrimsonNynja/monster-hunter-DB | `https://raw.githubusercontent.com/CrimsonNynja/monster-hunter-DB/master/monsters.json` | elements, ailments, weakness, class, threat level, description, games array |
| mh-api.com | `https://api.mh-api.com/v1/monsters` | image URLs, game title list (first appearance + generation) |

### `characters.attributes` — new fields

| Field | Source | Type | Example |
|---|---|---|---|
| `element` | CrimsonNynja `elements[0]` | string | `"Fire"` / `"None"` |
| `ailment` | CrimsonNynja `ailments[0]` | string | `"Poison"` / `"None"` |
| `weakness` | CrimsonNynja `weakness[0]` | string | `"Dragon"` |
| `class` | CrimsonNynja `type` | string | `"Flying Wyvern"` |
| `size_min` | Curated tier | string | `"S"` / `"M"` / `"L"` / `"XL"` |
| `size_max` | Curated tier | string | `"S"` / `"M"` / `"L"` / `"XL"` |
| `threat_level` | CrimsonNynja `games[].danger` (highest) | number | `7` |
| `first_appearance` | mh-api.com `title[0]` mapped to full name | string | `"Monster Hunter (PS2)"` |
| `generation` | Derived from first appearance title | number | `1` |

**Size tier curation:** Large monsters are classified into 4 tiers (S/M/L/XL) based on body dimensions from the Monster Hunter wiki. Stored as two separate values (size_min, size_max) to represent the variance range within each monster's possible size spectrum. Elder Dragons and apex monsters tend toward XL; smaller large monsters (e.g., Kecha Wacha, Lagombi) map to S/M.

**Generation mapping from mh-api.com title abbreviations:**

| Abbreviation | Game | Generation |
|---|---|---|
| `MH` / `MHG` / `MHP` / `MHF` | Monster Hunter (PS2) / Freedom | 1 |
| `MH2` / `MHF2` / `MHF2G` | MH2 / Freedom 2 / Freedom Unite | 2 |
| `MH3` / `MH3G` / `MHP3` | Tri / 3 Ultimate / Portable 3rd | 3 |
| `MH4` / `MH4G` | MH4 / 4 Ultimate | 4 |
| `MHX` / `MHXX` / `MHGen` / `MHW` / `MHWI` | Generations / World / Iceborne | 5 |

### `daily_challenges.extra` per mode

| Mode | Extra |
|---|---|
| `monsterhunter-classic` | `{}` |
| `monsterhunter-description` | `{ description: string }` — Gemini-sanitized Hunter's Notes at cron time |
| `monsterhunter-silhouette` | `{}` |

---

## Frontend

### Mode Registry

Add to `apps/web/lib/game/registry.ts`:
```typescript
'monsterhunter-classic':     () => import('@/components/modes/MonsterHunterClassicMode'),
'monsterhunter-description': () => import('@/components/modes/MonsterHunterDescriptionMode'),
'monsterhunter-silhouette':  () => import('@/components/modes/MonsterHunterSilhouetteMode'),
```

Add to `MODE_CONFIGS`:
```typescript
'monsterhunter-classic':     { label: 'Classic',     maxAttempts: null },
'monsterhunter-description': { label: 'Description',  maxAttempts: null },
'monsterhunter-silhouette':  { label: 'Silhouette',   maxAttempts: null },
```

Update `apps/web/lib/constants/universes.ts`:
```typescript
{ slug: 'monsterhunter', modes: ['monsterhunter-classic', 'monsterhunter-description', 'monsterhunter-silhouette'] }
```

---

### `MonsterHunterClassicMode`

**File:** `apps/web/components/modes/MonsterHunterClassicMode.tsx`

- No monster image shown at top (would reveal the answer)
- Guess input: monster name autocomplete
- Attribute grid rendered by GameClient from API feedback (same pattern as PokemonClassicMode)
- Guessed monsters removed from autocomplete suggestions (`excludeNames` prop)

**Attribute columns (in order):**

| Column | Key | Compare | Notes |
|---|---|---|---|
| Monster | image | — | Revealed on win |
| Element | `element` | exact | "None" if no element |
| Ailment | `ailment` | exact | "None" if no ailment |
| Weakness | `weakness` | exact | Primary weakness only |
| Class | `class` | exact | e.g. "Flying Wyvern" |
| Max Size | `size_max` | exact | S / M / L / XL |
| Min Size | `size_min` | exact | S / M / L / XL |
| Threat Level | `threat_level` | arrow | 1–10 |
| First Appearance | `first_appearance` | exact | Full game title |
| Generation | `generation` | arrow | 1–5 |

---

### `MonsterHunterDescriptionMode`

**File:** `apps/web/components/modes/MonsterHunterDescriptionMode.tsx`

- Shows `challenge.extra.description` — Hunter's Notes text rewritten by Gemini with monster name removed (replaced with "this monster")
- No progressive hints (harder than Pokemon description mode)
- On win: show monster image + name
- Guess input: monster name autocomplete with already-guessed excluded

---

### `MonsterHunterSilhouetteMode`

**File:** `apps/web/components/modes/MonsterHunterSilhouetteMode.tsx`

- Background: beige/sepia (`#d4c5a9`) to evoke Monster Hunter parchment aesthetic
- Filter: `brightness(0) blur(${blurPx}px)` — blurred black silhouette
- Initial blur: `20px`; reduces `2px` per wrong guess → `0px` at 10 wrong guesses
- At 0px blur: shape is fully revealed as crisp black silhouette (player still needs to guess)
- On win: remove `brightness(0)` filter, reveal full-color image
- No crop/zoom (show full monster silhouette from the start — blur is the obfuscation mechanism)
- Guess input: monster name autocomplete with already-guessed excluded

---

## Backend

### `refresh-catalog` — Monster Hunter handler

**File:** `supabase/functions/refresh-catalog/index.ts`

1. Fetch CrimsonNynja JSON (single HTTP GET, ~500KB)
2. Fetch mh-api.com monsters list
3. Filter: `isLarge === true` AND first appearance in Gen 1–5
4. For each monster: match by name between the two sources
5. Map size tier (S/M/L/XL) from a hardcoded lookup table in the function
6. Upsert to `characters` with all new attribute fields

**Size tier lookup table** (curated, ~20 representative entries to establish pattern, rest inferred):
- XL: Elder Dragons (Nergigante, Teostra, Kushala Daora, Chameleos, Rajang, Deviljho, Fatalis...)
- L: Rathalos, Rathian, Diablos, Tigrex, Brachydios, Zinogre, Barioth...
- M: Lagombi, Kecha Wacha, Mizutsune, Paolumu, Tzitzi-Ya-Ku...
- S: Velocidrome, Giadrome (only large monsters that are in the smaller range)

### `cron-daily-challenges` — `fetchMonsterHunter()`

**File:** `supabase/functions/cron-daily-challenges/index.ts`

New function `fetchMonsterHunter(themeId, mode, today)`:

- **`monsterhunter-classic`**: standard snapshot, `extra = {}`
- **`monsterhunter-silhouette`**: standard snapshot, `extra = {}`
- **`monsterhunter-description`**: fetch monster description from characters, call Gemini with prompt to rewrite without mentioning the monster's name, store in `extra.description`. Fallback: replace name occurrences with "this monster"

**Gemini prompt:**
> "Rewrite this Monster Hunter Hunter's Notes description without mentioning the monster's name '[name]'. Replace name occurrences with 'this monster'. Keep it factual, 2-3 sentences. Return only the rewritten description."

### DB Migration

```sql
UPDATE themes
SET modes = array['monsterhunter-classic', 'monsterhunter-description', 'monsterhunter-silhouette']
WHERE slug = 'monsterhunter';
```

### `ATTR_LABELS` additions (`apps/web/app/api/guess/route.ts`)

```typescript
// Monster Hunter
element:          'Element',
ailment:          'Ailment',
weakness:         'Weakness',
class:            'Class',
size_max:         'Max Size',
size_min:         'Min Size',
threat_level:     'Threat Level',
first_appearance: 'First Appearance',
generation:       'Generation',
```

---

## Out of Scope

- Roar mode (no public audio API — deferred)
- Weakness mode (removed)
- Small monsters (Jaggi, Aptonoth, etc.)
- Gen 6+ monsters (Rise/Sunbreak, Wilds)
- Multiple elements/ailments/weaknesses per column (only primary shown)
