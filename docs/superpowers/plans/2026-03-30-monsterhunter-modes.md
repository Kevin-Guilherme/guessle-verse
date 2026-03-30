# Monster Hunter Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 universe-specific MH modes (`monsterhunter-classic`, `monsterhunter-description`, `monsterhunter-silhouette`) replacing the old generic slugs, backed by CrimsonNynja + mh-api.com data.

**Architecture:** Backend refresh-catalog gets a new `refreshMonsterHunter` handler that fetches from CrimsonNynja (attributes) and mh-api.com (images + generation), then upserts into `characters`. The cron function gets a `fetchMonsterHunter` handler that snapshots the right attributes per mode (classic: 9-column grid; description: Gemini-sanitized Hunter's Notes; silhouette: standard image pick). Three new React mode components follow the existing Pokemon mode patterns.

**Tech Stack:** Deno (Edge Functions), TypeScript/React (Next.js 14), Supabase PostgreSQL, Gemini 2.5 Flash (description sanitization)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/006_monsterhunter_modes.sql` | Create | Update `themes.modes` for monsterhunter |
| `supabase/functions/refresh-catalog/index.ts` | Modify | Add `refreshMonsterHunter` + wire in `refreshOne` |
| `supabase/functions/cron-daily-challenges/index.ts` | Modify | Add `fetchMonsterHunter` + wire in main handler |
| `apps/web/app/api/guess/route.ts` | Modify | Add MH ATTR_LABELS |
| `apps/web/lib/constants/universes.ts` | Modify | Update monsterhunter modes array |
| `apps/web/lib/game/registry.ts` | Modify | Add 3 mode loaders + MODE_CONFIGS |
| `apps/web/components/modes/MonsterHunterClassicMode.tsx` | Create | Name-guess + attribute grid |
| `apps/web/components/modes/MonsterHunterDescriptionMode.tsx` | Create | Hunter's Notes description mode |
| `apps/web/components/modes/MonsterHunterSilhouetteMode.tsx` | Create | Blurred silhouette mode |

---

## Task 1: DB Migration — update monsterhunter themes.modes

**Files:**
- Create: `supabase/migrations/006_monsterhunter_modes.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migrate Monster Hunter theme to universe-specific mode slugs
UPDATE themes
SET modes = array['monsterhunter-classic', 'monsterhunter-description', 'monsterhunter-silhouette']
WHERE slug = 'monsterhunter';
```

- [ ] **Step 2: Apply migration in Supabase SQL editor**

Open the Supabase dashboard → SQL editor, paste and run the SQL above.

Verify:
```sql
SELECT slug, modes FROM themes WHERE slug = 'monsterhunter';
-- Expected: modes = {monsterhunter-classic,monsterhunter-description,monsterhunter-silhouette}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_monsterhunter_modes.sql
git commit -m "feat: migrate monsterhunter theme to universe-specific mode slugs"
```

---

## Task 2: Backend — refresh-catalog: refreshMonsterHunter

This replaces the existing wiki-based MH catalog with richer data from CrimsonNynja + mh-api.com.

**Files:**
- Modify: `supabase/functions/refresh-catalog/index.ts`

### Background: what's changing

Currently, `monsterhunter` is in `WIKI_SLUGS` and uses `refreshWikiUniverse` → Fandom wiki scraper → produces characters with empty `attributes: {}` (the wiki scraper doesn't extract the right fields).

We'll remove `monsterhunter` from `WIKI_SLUGS` and add a dedicated branch in `refreshOne` that calls `refreshMonsterHunter`.

### Data Sources

**CrimsonNynja JSON** (`https://raw.githubusercontent.com/CrimsonNynja/monster-hunter-DB/master/monsters.json`):
```typescript
// Sample structure — verify before coding
type CrimsonMonster = {
  name:        string
  isLarge:     boolean
  type:        string                      // class: "Flying Wyvern", "Elder Dragon", etc.
  elements:    string[]                    // element[0] = primary
  ailments:    string[]                    // ailment[0] = primary
  weakness:    string[]                    // weakness[0] = primary
  description: string                      // Hunter's Notes raw text
  games:       Array<{ name: string; danger: number }>  // threat level source
}
```

**mh-api.com** (`https://api.mh-api.com/v1/monsters`):
```typescript
// Sample structure — verify response before coding
type MhApiMonster = {
  name:      string
  image?:    string           // image URL field (may be "image" or "img_url" — check actual response)
  title:     string[]         // game abbreviations in appearance order: ["MH", "MH2", ...]
}
```

**⚠️ Important:** Before implementing, fetch the API and verify the actual field names:
```bash
curl https://api.mh-api.com/v1/monsters | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d[0].keys()))"
curl https://raw.githubusercontent.com/CrimsonNynja/monster-hunter-DB/master/monsters.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d[0].keys())); print(d[0])" | head -50
```

- [ ] **Step 1: Add constants and helpers after the existing `WIKI_CONFIGS` block (around line 615)**

Find the line:
```typescript
async function fetchMediaWikiApi(host: string, params: Record<string, string>): Promise<unknown> {
```

Insert before that function:

```typescript
// ─── Monster Hunter catalog ───────────────────────────────────────────────────

const TITLE_TO_GENERATION: Record<string, number> = {
  MH: 1, MHG: 1, MHP: 1, MHF: 1,
  MH2: 2, MHF2: 2, MHF2G: 2,
  MH3: 3, MH3G: 3, MHP3: 3,
  MH4: 4, MH4G: 4,
  MHX: 5, MHXX: 5, MHGen: 5, MHW: 5, MHWI: 5,
}

const TITLE_TO_FULL_NAME: Record<string, string> = {
  MH:    'Monster Hunter (PS2)',
  MHG:   'Monster Hunter (PS2)',
  MHP:   'Monster Hunter Freedom',
  MHF:   'Monster Hunter Freedom',
  MH2:   'Monster Hunter 2',
  MHF2:  'Monster Hunter Freedom 2',
  MHF2G: 'Monster Hunter Freedom Unite',
  MH3:   'Monster Hunter Tri',
  MH3G:  'Monster Hunter 3 Ultimate',
  MHP3:  'Monster Hunter Portable 3rd',
  MH4:   'Monster Hunter 4',
  MH4G:  'Monster Hunter 4 Ultimate',
  MHX:   'Monster Hunter Generations',
  MHXX:  'Monster Hunter Generations Ultimate',
  MHGen: 'Monster Hunter Generations',
  MHW:   'Monster Hunter World',
  MHWI:  'Monster Hunter World: Iceborne',
}

// Size tiers: S/M/L/XL per monster body dimensions
// XL = Elder Dragons and apex monsters; default for unlisted = L
const SIZE_TIERS: Record<string, { size_min: string; size_max: string }> = {
  // XL: Elder Dragons and massive apex monsters
  'Fatalis':              { size_min: 'XL', size_max: 'XL' },
  'Crimson Fatalis':      { size_min: 'XL', size_max: 'XL' },
  'White Fatalis':        { size_min: 'XL', size_max: 'XL' },
  'Alatreon':             { size_min: 'XL', size_max: 'XL' },
  'Amatsu':               { size_min: 'XL', size_max: 'XL' },
  'Teostra':              { size_min: 'L',  size_max: 'XL' },
  'Lunastra':             { size_min: 'L',  size_max: 'XL' },
  'Kushala Daora':        { size_min: 'L',  size_max: 'XL' },
  'Chameleos':            { size_min: 'L',  size_max: 'XL' },
  'Vaal Hazak':           { size_min: 'L',  size_max: 'XL' },
  'Nergigante':           { size_min: 'L',  size_max: 'XL' },
  'Xeno\'jiiva':          { size_min: 'L',  size_max: 'XL' },
  'Namielle':             { size_min: 'L',  size_max: 'XL' },
  'Velkhana':             { size_min: 'L',  size_max: 'XL' },
  'Rajang':               { size_min: 'L',  size_max: 'XL' },
  'Furious Rajang':       { size_min: 'L',  size_max: 'XL' },
  'Deviljho':             { size_min: 'L',  size_max: 'XL' },
  'Savage Deviljho':      { size_min: 'L',  size_max: 'XL' },
  'Lao-Shan Lung':        { size_min: 'XL', size_max: 'XL' },
  'Shen Gaoren':          { size_min: 'XL', size_max: 'XL' },
  'Jhen Mohran':          { size_min: 'XL', size_max: 'XL' },
  'Dalamadur':            { size_min: 'XL', size_max: 'XL' },
  'Gogmazios':            { size_min: 'XL', size_max: 'XL' },
  'Dire Miralis':         { size_min: 'XL', size_max: 'XL' },
  'Nakarkos':             { size_min: 'XL', size_max: 'XL' },
  'Zorah Magdaros':       { size_min: 'XL', size_max: 'XL' },
  // L: Standard large monsters
  'Rathalos':             { size_min: 'L',  size_max: 'XL' },
  'Azure Rathalos':       { size_min: 'L',  size_max: 'XL' },
  'Silver Rathalos':      { size_min: 'L',  size_max: 'XL' },
  'Rathian':              { size_min: 'L',  size_max: 'XL' },
  'Pink Rathian':         { size_min: 'L',  size_max: 'XL' },
  'Gold Rathian':         { size_min: 'L',  size_max: 'XL' },
  'Diablos':              { size_min: 'L',  size_max: 'XL' },
  'Black Diablos':        { size_min: 'L',  size_max: 'XL' },
  'Tigrex':               { size_min: 'L',  size_max: 'XL' },
  'Brute Tigrex':         { size_min: 'L',  size_max: 'XL' },
  'Brachydios':           { size_min: 'L',  size_max: 'XL' },
  'Raging Brachydios':    { size_min: 'L',  size_max: 'XL' },
  'Zinogre':              { size_min: 'L',  size_max: 'XL' },
  'Stygian Zinogre':      { size_min: 'L',  size_max: 'XL' },
  'Nargacuga':            { size_min: 'L',  size_max: 'XL' },
  'Barioth':              { size_min: 'L',  size_max: 'XL' },
  'Sand Barioth':         { size_min: 'L',  size_max: 'XL' },
  'Lagiacrus':            { size_min: 'L',  size_max: 'XL' },
  'Ivory Lagiacrus':      { size_min: 'L',  size_max: 'XL' },
  'Agnaktor':             { size_min: 'L',  size_max: 'XL' },
  'Glacial Agnaktor':     { size_min: 'L',  size_max: 'XL' },
  'Duramboros':           { size_min: 'L',  size_max: 'XL' },
  'Rust Duramboros':      { size_min: 'L',  size_max: 'XL' },
  'Uragaan':              { size_min: 'L',  size_max: 'XL' },
  'Steel Uragaan':        { size_min: 'L',  size_max: 'XL' },
  'Royal Ludroth':        { size_min: 'L',  size_max: 'XL' },
  'Purple Ludroth':       { size_min: 'L',  size_max: 'XL' },
  'Plesioth':             { size_min: 'L',  size_max: 'XL' },
  'Green Plesioth':       { size_min: 'L',  size_max: 'XL' },
  'Gravios':              { size_min: 'L',  size_max: 'XL' },
  'Black Gravios':        { size_min: 'L',  size_max: 'XL' },
  'Glavenus':             { size_min: 'L',  size_max: 'XL' },
  'Acidic Glavenus':      { size_min: 'L',  size_max: 'XL' },
  'Fiery Brachy':         { size_min: 'L',  size_max: 'XL' },
  'Mizutsune':            { size_min: 'M',  size_max: 'L'  },
  'Soulseer Mizutsune':   { size_min: 'M',  size_max: 'L'  },
  // M: Medium large monsters
  'Lagombi':              { size_min: 'M',  size_max: 'L'  },
  'Kecha Wacha':          { size_min: 'M',  size_max: 'L'  },
  'Paolumu':              { size_min: 'M',  size_max: 'L'  },
  'Night Shade Paolumu':  { size_min: 'M',  size_max: 'L'  },
  'Tzitzi-Ya-Ku':         { size_min: 'M',  size_max: 'L'  },
  'Pukei-Pukei':          { size_min: 'M',  size_max: 'L'  },
  'Coral Pukei-Pukei':    { size_min: 'M',  size_max: 'L'  },
  'Jyuratodus':           { size_min: 'M',  size_max: 'L'  },
  'Tobi-Kadachi':         { size_min: 'M',  size_max: 'L'  },
  'Radobaan':             { size_min: 'M',  size_max: 'L'  },
  'Odogaron':             { size_min: 'M',  size_max: 'L'  },
  'Gigginox':             { size_min: 'M',  size_max: 'L'  },
  'Baleful Gigginox':     { size_min: 'M',  size_max: 'L'  },
  'Nibelsnarf':           { size_min: 'M',  size_max: 'L'  },
  // S: Smaller large monsters
  'Velocidrome':          { size_min: 'S',  size_max: 'M'  },
  'Giadrome':             { size_min: 'S',  size_max: 'M'  },
  'Bulldrome':            { size_min: 'S',  size_max: 'M'  },
  'Baggi':                { size_min: 'S',  size_max: 'M'  },
  'Great Jaggi':          { size_min: 'S',  size_max: 'M'  },
  'Great Baggi':          { size_min: 'S',  size_max: 'M'  },
  'Great Wroggi':         { size_min: 'S',  size_max: 'M'  },
}

function getMhSizeTier(name: string): { size_min: string; size_max: string } {
  return SIZE_TIERS[name] ?? { size_min: 'L', size_max: 'XL' }
}

// Gen 5 cutoff — reject Gen 6+ (Rise/Sunbreak/Wilds)
const GEN6_TITLES = new Set(['MHRise', 'MHRS', 'MHWilds', 'MHRS2'])

function isGen1to5(titles: string[]): boolean {
  if (!titles.length) return false
  const first = titles[0]
  // Reject if first title is Gen 6
  if (GEN6_TITLES.has(first)) return false
  // Accept if first title is a known Gen 1-5 abbreviation
  return first in TITLE_TO_GENERATION
}

async function refreshMonsterHunter(themeId: number): Promise<number> {
  // 1. Fetch both sources in parallel
  const [crimsonRes, mhApiRes] = await Promise.all([
    fetch('https://raw.githubusercontent.com/CrimsonNynja/monster-hunter-DB/master/monsters.json', {
      headers: { 'User-Agent': 'GuessleBot/1.0' },
      signal:  AbortSignal.timeout(30_000),
    }),
    fetch('https://api.mh-api.com/v1/monsters', {
      headers: { 'User-Agent': 'GuessleBot/1.0' },
      signal:  AbortSignal.timeout(30_000),
    }),
  ])

  if (!crimsonRes.ok) throw new Error(`CrimsonNynja HTTP ${crimsonRes.status}`)
  if (!mhApiRes.ok)   throw new Error(`mh-api.com HTTP ${mhApiRes.status}`)

  type CrimsonMonster = {
    name: string; isLarge: boolean; type: string
    elements: string[]; ailments: string[]; weakness: string[]
    description: string
    games: Array<{ name: string; danger: number }>
  }
  type MhApiMonster = {
    name: string
    // NOTE: verify actual field name from API — may be "image", "img_url", or nested
    image?: string; img_url?: string; imageUrl?: string
    title: string[]
  }

  const crimsonAll  = await crimsonRes.json()  as CrimsonMonster[]
  const mhApiAll    = await mhApiRes.json()    as MhApiMonster[]

  // 2. Build lookup map from mh-api by normalized name
  const mhApiMap = new Map<string, MhApiMonster>()
  for (const m of mhApiAll) {
    mhApiMap.set(m.name.toLowerCase().trim(), m)
  }

  // 3. Filter: isLarge AND first appearance in Gen 1-5
  const largeGen1to5 = crimsonAll.filter(m => {
    if (!m.isLarge) return false
    const mhApi = mhApiMap.get(m.name.toLowerCase().trim())
    if (!mhApi) return false  // no image data
    return isGen1to5(mhApi.title ?? [])
  })

  let count = 0

  for (const m of largeGen1to5) {
    const mhApi   = mhApiMap.get(m.name.toLowerCase().trim())!
    const titles  = mhApi.title ?? []
    const firstTitle = titles[0] ?? ''

    const imageUrl = mhApi.image ?? mhApi.img_url ?? mhApi.imageUrl ?? null

    const element   = m.elements?.[0] || 'None'
    const ailment   = m.ailments?.[0] || 'None'
    const weakness  = m.weakness?.[0]  || 'None'
    const mhClass   = m.type           || 'Unknown'
    const threatLevel = m.games?.length
      ? Math.max(...m.games.map(g => g.danger ?? 0))
      : 0

    const { size_min, size_max } = getMhSizeTier(m.name)
    const generation    = TITLE_TO_GENERATION[firstTitle] ?? 5
    const firstAppearance = TITLE_TO_FULL_NAME[firstTitle] ?? firstTitle

    const attributes: Record<string, unknown> = {
      element, ailment, weakness,
      class:            mhClass,
      size_max, size_min,
      threat_level:     threatLevel,
      first_appearance: firstAppearance,
      generation,
    }

    const extra: Record<string, unknown> = {
      description: m.description ?? '',
    }

    await upsertCharacter(themeId, m.name, imageUrl, attributes, extra)
    count++
  }

  return count
}
```

- [ ] **Step 2: Remove monsterhunter from WIKI_SLUGS**

Find (around line 940):
```typescript
const WIKI_SLUGS = ['naruto', 'onepiece', 'jujutsu', 'smash', 'zelda', 'mario', 'gow', 'monsterhunter']
```

Change to:
```typescript
const WIKI_SLUGS = ['naruto', 'onepiece', 'jujutsu', 'smash', 'zelda', 'mario', 'gow']
```

- [ ] **Step 3: Wire refreshMonsterHunter into refreshOne**

Find the `refreshOne` function (around line 949). The function has:
```typescript
  if (WIKI_SLUGS.includes(slug)) {
    const { count, nextOffset } = await refreshWikiUniverse(slug, themeId, body.cmcontinue ?? '', body.chunkSize ?? 50)
    return { result: `ok: ${count} upserted`, nextOffset }
  }
  return { result: 'error: unknown universe' }
```

Change to:
```typescript
  if (slug === 'monsterhunter') {
    const count = await refreshMonsterHunter(themeId)
    return { result: `ok: ${count} upserted`, nextOffset: null }
  }
  if (WIKI_SLUGS.includes(slug)) {
    const { count, nextOffset } = await refreshWikiUniverse(slug, themeId, body.cmcontinue ?? '', body.chunkSize ?? 50)
    return { result: `ok: ${count} upserted`, nextOffset }
  }
  return { result: 'error: unknown universe' }
```

Also add `monsterhunter` to the full refresh loop. Find:
```typescript
  for (const slug of ['lol', 'pokemon', ...WIKI_SLUGS]) {
```
Change to:
```typescript
  for (const slug of ['lol', 'pokemon', 'monsterhunter', ...WIKI_SLUGS]) {
```

- [ ] **Step 4: Deploy refresh-catalog**

```bash
supabase functions deploy refresh-catalog --project-ref yabxlaicllxqwaaqfnax
```

- [ ] **Step 5: Test — trigger monsterhunter refresh**

```bash
SERVICE_ROLE=$(grep "SERVICE_ROLE_KEY\|SERVICE_ROLE" apps/web/.env.local | grep -v "ANON\|anon" | head -1 | cut -d= -f2- | tr -d '"' | tr -d ' ')

curl -s -X POST https://yabxlaicllxqwaaqfnax.supabase.co/functions/v1/refresh-catalog \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"universe":"monsterhunter"}'
```

Expected output:
```json
{"log":[{"universe":"monsterhunter","result":"ok: 120 upserted","nextOffset":null}]}
```
(count may vary — should be ~100-150)

Spot-check attributes in DB:
```bash
curl -s "https://yabxlaicllxqwaaqfnax.supabase.co/rest/v1/characters?theme_id=eq.$(curl -s 'https://yabxlaicllxqwaaqfnax.supabase.co/rest/v1/themes?slug=eq.monsterhunter&select=id' -H "Authorization: Bearer $SERVICE_ROLE" -H "apikey: $SERVICE_ROLE" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')&limit=3&select=name,attributes" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "apikey: $SERVICE_ROLE"
```

Expected: each character has `element`, `ailment`, `weakness`, `class`, `size_max`, `size_min`, `threat_level`, `first_appearance`, `generation` in attributes (not empty `{}`).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/refresh-catalog/index.ts
git commit -m "feat: replace wiki-based MH catalog with CrimsonNynja + mh-api.com"
```

---

## Task 3: Backend — cron-daily-challenges: fetchMonsterHunter

**Files:**
- Modify: `supabase/functions/cron-daily-challenges/index.ts`

### Background

Currently, `monsterhunter` falls to the `fetchCharacter` generic handler, which stores full attributes. We need:
- `monsterhunter-classic`: snapshot of 9 specific columns in display order
- `monsterhunter-description`: Gemini-sanitized Hunter's Notes description in `extra.description`, `attributes = { answer: name }`
- `monsterhunter-silhouette`: `attributes = { answer: name }`, `extra = {}`

- [ ] **Step 1: Add Gemini description helper — insert after the existing `generatePokemonDescription` function (around line 46)**

```typescript
// ─── Gemini — rewrite Monster Hunter description ─────────────────────────────

function sanitizeMhFallback(name: string, text: string): string {
  return text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'this monster')
}

async function generateMhDescription(name: string, rawDescription: string): Promise<string> {
  if (!rawDescription) return rawDescription
  if (!GEMINI_KEY) return sanitizeMhFallback(name, rawDescription)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  AbortSignal.timeout(15_000),
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Rewrite this Monster Hunter Hunter's Notes description without mentioning the monster's name "${name}". Replace name occurrences with "this monster". Keep it factual, 2-3 sentences. Return ONLY the rewritten description, nothing else.\n\nOriginal: ${rawDescription}`,
            }],
          }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
        }),
      }
    )
    if (!res.ok) return sanitizeMhFallback(name, rawDescription)
    const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return text || sanitizeMhFallback(name, rawDescription)
  } catch {
    return sanitizeMhFallback(name, rawDescription)
  }
}
```

- [ ] **Step 2: Add fetchMonsterHunter function — insert after `fetchNaruto` function (around line 795)**

```typescript
// ─── Monster Hunter fetcher ──────────────────────────────────────────────────

async function fetchMonsterHunter(themeId: number, mode: string, today: string): Promise<string> {
  const recent = await getRecentNames(themeId, mode)

  const { data: allCandidates } = await supabase
    .from('characters')
    .select('id, name, attributes, extra, image_url')
    .eq('theme_id', themeId)
    .eq('active', true)

  const pool = (allCandidates ?? []).filter((c: { name: string }) => !recent.has(c.name)) as Array<{
    id: number; name: string
    attributes: Record<string, unknown>
    extra:      Record<string, unknown>
    image_url:  string | null
  }>

  if (!pool.length) return 'skipped: no candidates'

  const pick = pool[Math.floor(Math.random() * pool.length)]

  let attrs: Record<string, unknown>
  let extra: Record<string, unknown>

  if (mode === 'monsterhunter-classic') {
    // Snapshot exactly the 9 columns in display order (key order determines column order)
    attrs = {
      element:          pick.attributes.element          ?? 'None',
      ailment:          pick.attributes.ailment          ?? 'None',
      weakness:         pick.attributes.weakness         ?? 'None',
      class:            pick.attributes.class            ?? 'Unknown',
      size_max:         pick.attributes.size_max         ?? 'L',
      size_min:         pick.attributes.size_min         ?? 'L',
      threat_level:     pick.attributes.threat_level     ?? 0,
      first_appearance: pick.attributes.first_appearance ?? 'Monster Hunter (PS2)',
      generation:       pick.attributes.generation       ?? 1,
    }
    extra = {}

  } else if (mode === 'monsterhunter-description') {
    // Sanitize Hunter's Notes description via Gemini
    const rawDescription = (pick.extra?.description ?? '') as string
    const description    = await generateMhDescription(pick.name, rawDescription)
    attrs = { answer: pick.name }
    extra = { description }

  } else {
    // monsterhunter-silhouette — standard image pick
    attrs = { answer: pick.name }
    extra = {}
  }

  await supabase.from('daily_challenges').insert({
    theme_id:     themeId,
    mode,
    date:         today,
    character_id: pick.id,
    name:         pick.name,
    image_url:    pick.image_url,
    attributes:   attrs,
    extra,
  })

  return `ok: ${pick.name}`
}
```

- [ ] **Step 3: Wire fetchMonsterHunter into the main handler**

In the main `Deno.serve` handler, find (around line 1244):
```typescript
        } else if (theme.slug === 'naruto') {
          result = await fetchNaruto(theme.id, mode, today)
        } else {
          // All other character universes: use characters table
          result = await fetchCharacter(theme.id, mode, today)
        }
```

Change to:
```typescript
        } else if (theme.slug === 'naruto') {
          result = await fetchNaruto(theme.id, mode, today)
        } else if (theme.slug === 'monsterhunter') {
          result = await fetchMonsterHunter(theme.id, mode, today)
        } else {
          // All other character universes: use characters table
          result = await fetchCharacter(theme.id, mode, today)
        }
```

- [ ] **Step 4: Deploy cron-daily-challenges**

```bash
supabase functions deploy cron-daily-challenges --project-ref yabxlaicllxqwaaqfnax
```

- [ ] **Step 5: Test — generate tomorrow's MH challenges**

First, delete today's MH challenges to allow re-generation (only in dev/staging — use a test date instead):

```bash
SERVICE_ROLE=$(grep "SERVICE_ROLE_KEY\|SERVICE_ROLE" apps/web/.env.local | grep -v "ANON\|anon" | head -1 | cut -d= -f2- | tr -d '"' | tr -d ' ')

# Trigger cron (today's challenges will be skipped; this test is best done with a future date)
curl -s --max-time 120 -X POST https://yabxlaicllxqwaaqfnax.supabase.co/functions/v1/cron-daily-challenges \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Look for monsterhunter in the log output:
```json
{"theme":"monsterhunter","mode":"monsterhunter-classic","result":"ok: Rathalos"}
{"theme":"monsterhunter","mode":"monsterhunter-description","result":"ok: Diablos"}
{"theme":"monsterhunter","mode":"monsterhunter-silhouette","result":"ok: Zinogre"}
```

If today's already exist, delete them in Supabase SQL editor and re-run:
```sql
DELETE FROM daily_challenges
WHERE theme_id = (SELECT id FROM themes WHERE slug = 'monsterhunter')
  AND date = CURRENT_DATE;
```

Verify description mode saved Gemini-sanitized description:
```bash
curl -s "https://yabxlaicllxqwaaqfnax.supabase.co/rest/v1/daily_challenges?mode=eq.monsterhunter-description&order=date.desc&limit=1&select=name,extra" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "apikey: $SERVICE_ROLE"
```

Expected: `extra.description` is a non-empty string without the monster's name.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/cron-daily-challenges/index.ts
git commit -m "feat: add fetchMonsterHunter cron handler for 3 new MH modes"
```

---

## Task 4: Frontend — ATTR_LABELS in route.ts

**Files:**
- Modify: `apps/web/app/api/guess/route.ts`

- [ ] **Step 1: Add MH labels to ATTR_LABELS**

Find the Naruto section in ATTR_LABELS (around line 54):
```typescript
    // Naruto
    genero:         'Gender',
    ...
    cla:            'Clan',
  }
```

Add after the Naruto section:
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

Also update the existing Pokemon `generation` label from `'Gen'` to `'Generation'` to be consistent:
```typescript
    // Find this line:
    generation:   'Gen',
    // Change to:
    generation:   'Generation',
```

- [ ] **Step 2: Verify locally**

Run dev server and guess a MH classic challenge. Check that the column headers show correctly: Element, Ailment, Weakness, Class, Max Size, Min Size, Threat Level, First Appearance, Generation.

Or confirm with a direct API call (requires valid challengeId):
```bash
curl -s -X POST http://localhost:3000/api/guess \
  -H "Content-Type: application/json" \
  -d '{"challengeId": <MH_CLASSIC_CHALLENGE_ID>, "value": "Rathalos"}'
```
Expected: `feedback` array has 9 items with the correct labels.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/guess/route.ts
git commit -m "feat: add Monster Hunter ATTR_LABELS to guess API"
```

---

## Task 5: Frontend — registry.ts + universes.ts

**Files:**
- Modify: `apps/web/lib/game/registry.ts`
- Modify: `apps/web/lib/constants/universes.ts`

- [ ] **Step 1: Add MH mode loaders to registry**

In `registry.ts`, find the last pokemon entry:
```typescript
  'pokemon-silhouette':  () => import('@/components/modes/PokemonSilhouetteMode'),
```

Add after it:
```typescript
  'monsterhunter-classic':     () => import('@/components/modes/MonsterHunterClassicMode'),
  'monsterhunter-description': () => import('@/components/modes/MonsterHunterDescriptionMode'),
  'monsterhunter-silhouette':  () => import('@/components/modes/MonsterHunterSilhouetteMode'),
```

- [ ] **Step 2: Add MH MODE_CONFIGS**

In `registry.ts`, find:
```typescript
  'pokemon-silhouette':  { label: 'Silhouette',   maxAttempts: null },
```

Add after it:
```typescript
  'monsterhunter-classic':     { label: 'Classic',     maxAttempts: null },
  'monsterhunter-description': { label: 'Description',  maxAttempts: null },
  'monsterhunter-silhouette':  { label: 'Silhouette',   maxAttempts: null },
```

- [ ] **Step 3: Update universes.ts**

Find:
```typescript
  { slug: 'monsterhunter', name: 'MHdle', icon: '🐉', color: '#F97316', type: 'character', modes: ['classic','silhouette','roar','weakness'] },
```

Change to:
```typescript
  { slug: 'monsterhunter', name: 'MHdle', icon: '🐉', color: '#F97316', type: 'character', modes: ['monsterhunter-classic', 'monsterhunter-description', 'monsterhunter-silhouette'] },
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/game/registry.ts apps/web/lib/constants/universes.ts
git commit -m "feat: register monsterhunter-classic/description/silhouette modes"
```

---

## Task 6: Frontend — MonsterHunterClassicMode

**Files:**
- Create: `apps/web/components/modes/MonsterHunterClassicMode.tsx`

This is a name-guess mode (no image shown — it would reveal the answer). The attribute grid is rendered automatically by `GameClient` from the API feedback.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function MonsterHunterClassicMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Guess the monster from its attributes. Unlimited attempts.
      </p>

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => submitGuess(name)}
          disabled={loading}
          placeholder="Enter monster name..."
          excludeNames={alreadyGuessed}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify locally**

Navigate to `/games/monsterhunter/monsterhunter-classic`. Confirm:
- Page loads without errors
- Search input shows with placeholder "Enter monster name..."
- Mode nav tabs show Classic / Description / Silhouette
- After guessing, attribute grid appears in history with 9 columns

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/modes/MonsterHunterClassicMode.tsx
git commit -m "feat: add MonsterHunterClassicMode component"
```

---

## Task 7: Frontend — MonsterHunterDescriptionMode

**Files:**
- Create: `apps/web/components/modes/MonsterHunterDescriptionMode.tsx`

Shows Gemini-sanitized Hunter's Notes. No progressive hints (harder than Pokémon description). On win: show monster image + name.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function MonsterHunterDescriptionMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const extra       = (challenge.extra  ?? {}) as Record<string, unknown>
  const description = (extra.description ?? '') as string
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {/* Hunter's Notes */}
      <div className="rounded-xl border border-border bg-bg-surface p-4">
        <p className="text-gray-200 text-base leading-relaxed italic">
          &ldquo;{description || "Hunter's Notes not available."}&rdquo;
        </p>
      </div>

      {/* Win reveal */}
      {won && challenge.image_url && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="relative w-32 h-32 overflow-hidden">
            <Image
              src={challenge.image_url as string}
              alt={challenge.name}
              fill
              className="object-contain"
              unoptimized
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
          onSubmit={(name) => submitGuess(name)}
          disabled={loading}
          placeholder="Enter monster name..."
          excludeNames={alreadyGuessed}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify locally**

Navigate to `/games/monsterhunter/monsterhunter-description`. Confirm:
- Hunter's Notes description is displayed in italics
- No hint boxes shown at any wrong guess count
- After winning: monster image + name revealed
- After losing: `!won && !lost` is false, so search input hides (GameClient shows loss banner)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/modes/MonsterHunterDescriptionMode.tsx
git commit -m "feat: add MonsterHunterDescriptionMode component"
```

---

## Task 8: Frontend — MonsterHunterSilhouetteMode

**Files:**
- Create: `apps/web/components/modes/MonsterHunterSilhouetteMode.tsx`

Beige/parchment background (`#d4c5a9`), blurred black silhouette starting at 20px, reducing 2px per wrong guess. No zoom/crop — full silhouette visible, blur is the obfuscation. On win: remove `brightness(0)` to reveal full color.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function MonsterHunterSilhouetteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const wrongGuesses    = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const blurPx          = Math.max(20 - wrongGuesses * 2, 0)
  const alreadyGuessed  = guesses.map((g) => g.value.toLowerCase())
  const imageUrl        = challenge.image_url as string | undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {won ? challenge.name : 'Which monster is this? The silhouette sharpens with each wrong guess.'}
      </p>

      <div className="flex justify-center">
        <div
          className="rounded-xl border border-white/20 overflow-hidden flex items-center justify-center"
          style={{ width: 320, height: 240, backgroundColor: '#d4c5a9' }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={won ? challenge.name : 'Monster silhouette'}
              style={{
                width:      '100%',
                height:     '100%',
                objectFit:  'contain',
                transition: 'filter 400ms ease',
                filter:     won
                  ? 'none'
                  : `brightness(0) blur(${blurPx}px)`,
              }}
              draggable={false}
            />
          )}
        </div>
      </div>

      {won && (
        <p className="text-correct font-display font-bold text-sm tracking-wide text-center">
          {challenge.name}
        </p>
      )}

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => submitGuess(name)}
          disabled={loading}
          placeholder="Enter monster name..."
          excludeNames={alreadyGuessed}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify locally**

Navigate to `/games/monsterhunter/monsterhunter-silhouette`. Confirm:
- Beige background (`#d4c5a9`) is visible around the silhouette
- Monster appears as blurred black silhouette (20px initial blur)
- Each wrong guess reduces the blur by 2px (type a wrong name, check blur decreases)
- At 10 wrong guesses: `blur(0px)` → crisp black silhouette
- On win: `filter: none` → full color image revealed
- Background container is wider than Pokemon (320×240 to fit landscape monsters)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/modes/MonsterHunterSilhouetteMode.tsx
git commit -m "feat: add MonsterHunterSilhouetteMode with beige parchment aesthetic"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|---|---|
| 3 new mode slugs: monsterhunter-classic, -description, -silhouette | Tasks 1, 5 |
| Remove roar + weakness modes | Task 1 (DB migration), Task 5 (universes.ts) |
| Large Monsters Gen 1-5 scope | Task 2 (isGen1to5 filter) |
| element, ailment, weakness, class, size_min/max, threat_level, first_appearance, generation attrs | Task 2 (refreshMonsterHunter) |
| CrimsonNynja + mh-api.com sources | Task 2 |
| Size tier S/M/L/XL lookup | Task 2 (SIZE_TIERS) |
| Generation mapping from mh-api title abbreviations | Task 2 (TITLE_TO_GENERATION) |
| cron: classic snapshot with 9 cols in order | Task 3 |
| cron: description with Gemini sanitization | Task 3 |
| cron: silhouette standard pick | Task 3 |
| Gemini prompt template (Hunter's Notes, replace with "this monster") | Task 3 |
| ATTR_LABELS for all 9 MH fields | Task 4 |
| Registry + MODE_CONFIGS entries | Task 5 |
| universes.ts update | Task 5 |
| MonsterHunterClassicMode: search input only, no image | Task 6 |
| MonsterHunterDescriptionMode: description block, no hints, win reveal | Task 7 |
| MonsterHunterSilhouetteMode: beige bg, blur 20px→0px over 10 guesses | Task 8 |
| `extra.description` from characters stored at cron time | Task 3 (monsterhunter-description path reads pick.extra.description) |

**No placeholders found.**

**Type consistency:** `SIZE_TIERS`, `TITLE_TO_GENERATION`, `TITLE_TO_FULL_NAME` are defined in Task 2 and used only in Task 2. `sanitizeMhFallback` and `generateMhDescription` defined in Task 3 Step 1 and used in Task 3 Step 2. No cross-task type inconsistencies.

**One known trade-off:** `generation: 'Generation'` in ATTR_LABELS (Task 4) changes the Pokemon `generation` label from `'Gen'` to `'Generation'`. This affects the Pokemon Card mode column header only (Classic mode doesn't include generation in its snapshot). This is a minor cosmetic improvement.
