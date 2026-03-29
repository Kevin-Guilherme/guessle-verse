# Pokémon Modes — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the Pokémon character catalog with `habitat`, `evolution_stage`, `card_url` fields and update the cron to generate daily challenges for the 4 new Pokémon modes.

**Architecture:** Two Supabase Edge Functions are updated — `refresh-catalog` fetches new fields from PokéAPI and pokemontcg.io and persists them in `characters`; `cron-daily-challenges` builds per-mode challenge snapshots including Gemini-generated descriptions. The DB `themes` record for Pokémon is migrated to the new mode slugs.

**Tech Stack:** Deno (Supabase Edge Functions), PokéAPI, pokemontcg.io, Gemini 2.5 Flash, Supabase PostgreSQL

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/functions/refresh-catalog/index.ts` | Modify | Add habitat, evolution_stage, card_url to `refreshPokemon()` |
| `supabase/functions/cron-daily-challenges/index.ts` | Modify | Update `fetchPokemon()` for 4 new mode slugs + Gemini description |
| `apps/web/app/api/guess/route.ts` | Modify | Add `habitat`, `evolution_stage` to `ATTR_LABELS` |

---

### Task 1: Add `habitat` and `evolution_stage` to ATTR_LABELS

**Files:**
- Modify: `apps/web/app/api/guess/route.ts:30-58`

The API uses `ATTR_LABELS` to set human-readable labels on feedback. These two new keys must be registered or they will appear as `undefined` in the frontend.

- [ ] **Step 1: Add labels**

Open `apps/web/app/api/guess/route.ts`. Find the `ATTR_LABELS` block (around line 30). Add two entries after the existing Pokemon block:

```typescript
    // Pokemon (existing)
    pokedex_number: '#',
    type1:        'Type 1',
    type2:        'Type 2',
    generation:   'Gen',
    height_m:     'Height',
    weight_kg:    'Weight',
    color:        'Color',
    is_legendary: 'Legendary',
    is_mythical:  'Mythical',
    evolves_from: 'Evolves from',
    // Pokemon — new fields
    habitat:          'Habitat',
    evolution_stage:  'Stage',
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/guess/route.ts
git commit -m "feat(pokemon): add habitat and evolution_stage to ATTR_LABELS"
```

---

### Task 2: Enrich `refreshPokemon()` with habitat, evolution_stage, card_url

**Files:**
- Modify: `supabase/functions/refresh-catalog/index.ts:254-299`

The current `refreshPokemon()` fetches basic Pokémon data. We add three new fields:
- `habitat` — from PokéAPI species endpoint (already fetched)
- `evolution_stage` — computed by traversing the evolution chain
- `card_url` — from pokemontcg.io Base Set 1, filtered by National Pokédex number

- [ ] **Step 1: Add evolution stage helper function**

Add the following helper function right before the `refreshPokemon` function declaration (around line 254):

```typescript
// ─── Evolution stage helper ────────────────────────────────────────────────────

interface EvoChainLink {
  species:     { name: string }
  evolves_to:  EvoChainLink[]
}

function findEvolutionStage(link: EvoChainLink, targetName: string, depth = 1): number {
  if (link.species.name.toLowerCase() === targetName.toLowerCase()) return depth
  for (const next of link.evolves_to) {
    const found = findEvolutionStage(next, targetName, depth + 1)
    if (found > 0) return found
  }
  return 0
}
```

- [ ] **Step 2: Add card URL helper function**

Add right after the evolution stage helper:

```typescript
// ─── Pokémon TCG card URL helper ───────────────────────────────────────────────

async function fetchPokemonCardUrl(pokedexNumber: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=set.id:base1%20nationalPokedexNumbers:${pokedexNumber}`,
      { headers: { 'User-Agent': 'GuessleBot/1.0' }, signal: AbortSignal.timeout(8_000) }
    )
    if (!res.ok) return null
    const json = await res.json() as { data?: Array<{ images?: { large?: string } }> }
    return json.data?.[0]?.images?.large ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Update `refreshPokemon()` body**

Replace the existing `refreshPokemon` function body. Find the loop that starts with `for (const entry of entries)` and update it to include the three new fields:

```typescript
async function refreshPokemon(themeId: number, offset = 0, chunkSize = 100): Promise<number> {
  let count = 0
  const res  = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${chunkSize}&offset=${offset}`)
  const data = await res.json()
  const entries = data.results as Array<{ name: string; url: string }>

  for (const entry of entries) {
    try {
      const pokeRes  = await fetch(entry.url)
      const pokemon  = await pokeRes.json()

      const specRes  = await fetch(pokemon.species.url)
      const species  = await specRes.json()

      const name         = species.names.find((n: { language: { name: string }; name: string }) => n.language.name === 'en')?.name ?? entry.name
      const generation   = Number(species.generation.url.match(/\/(\d+)\//)?.[1] ?? 1)
      const color        = species.color?.name ?? ''
      const habitat      = species.habitat?.name ?? 'unknown'
      const type1        = pokemon.types[0]?.type.name ?? ''
      const type2        = pokemon.types[1]?.type.name ?? null
      const heightM      = (pokemon.height  / 10).toFixed(1)
      const weightKg     = (pokemon.weight  / 10).toFixed(1)
      const isLegendary  = species.is_legendary ? 'Sim' : 'Nao'
      const isMythical   = species.is_mythical  ? 'Sim' : 'Nao'
      const evolvedFrom  = species.evolves_from_species?.name ?? null
      const spriteUrl    = pokemon.sprites.other?.['official-artwork']?.front_default
        ?? pokemon.sprites.front_default

      // Evolution stage — traverse evolution chain
      let evolutionStage = 1
      try {
        const evoRes   = await fetch(species.evolution_chain.url)
        const evoData  = await evoRes.json() as { chain: EvoChainLink }
        const stage    = findEvolutionStage(evoData.chain, entry.name)
        if (stage > 0) evolutionStage = stage
      } catch { /* default to 1 */ }

      // Card URL from pokemontcg.io Base Set 1
      const cardUrl = await fetchPokemonCardUrl(pokemon.id)

      await upsertCharacter(themeId, name, spriteUrl, {
        pokedex_number:  pokemon.id,
        type1, type2, generation,
        height_m:        heightM,
        weight_kg:       weightKg,
        color,
        habitat,
        evolution_stage: evolutionStage,
        is_legendary:    isLegendary,
        is_mythical:     isMythical,
        evolves_from:    evolvedFrom,
      }, {
        sprite_url: spriteUrl,
        card_url:   cardUrl,
      })

      count++
      await new Promise(r => setTimeout(r, 500)) // polite delay (3 API calls per pokemon)
    } catch (err) {
      console.error(`Pokemon error (${entry.name}):`, err)
    }
  }

  return count
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/refresh-catalog/index.ts
git commit -m "feat(pokemon): add habitat, evolution_stage, card_url to refresh-catalog"
```

---

### Task 3: Update `fetchPokemon()` in cron for 4 new mode slugs

**Files:**
- Modify: `supabase/functions/cron-daily-challenges/index.ts:1-10` (env vars) and `:63-104` (fetchPokemon)

The cron currently has one handler for all Pokemon modes. The new modes have different slugs and different data requirements. We replace the body of `fetchPokemon()` with a switch per mode.

- [ ] **Step 1: Add GEMINI_KEY env var at the top of the file**

Find the env var block at the top of `cron-daily-challenges/index.ts` (around line 3–6) and add:

```typescript
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IGDB_CLIENT_ID     = Deno.env.get('IGDB_CLIENT_ID') ?? ''
const IGDB_CLIENT_SECRET = Deno.env.get('IGDB_CLIENT_SECRET') ?? ''
const GEMINI_KEY         = Deno.env.get('GEMINI_API_KEY') ?? ''
```

- [ ] **Step 2: Add Gemini description helper**

Add this helper function near the top of the file, after the supabase client initialization:

```typescript
// ─── Gemini — rewrite Pokémon description ────────────────────────────────────

async function generatePokemonDescription(name: string, flavorText: string): Promise<string> {
  if (!GEMINI_KEY || !flavorText) return flavorText
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
              text: `Rewrite this Pokémon Pokédex description without mentioning the Pokémon's name "${name}" or any direct reference to it by name. Replace name occurrences with "this Pokémon". Keep it factual and 2–3 sentences. Return ONLY the rewritten description, nothing else.\n\nOriginal: ${flavorText}`,
            }],
          }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
        }),
      }
    )
    if (!res.ok) return flavorText
    const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return text || flavorText
  } catch {
    return flavorText
  }
}
```

- [ ] **Step 3: Replace `fetchPokemon()` body**

Replace the entire existing `fetchPokemon` function (lines 63–104) with the following:

```typescript
async function fetchPokemon(themeId: number, mode: string, today: string): Promise<string> {
  const recent = await getRecentNames(themeId, mode)

  const { data: allCandidates } = await supabase
    .from('characters')
    .select('id, name, attributes, extra, image_url')
    .eq('theme_id', themeId)
    .eq('active', true)

  const candidates = allCandidates ?? []

  // Mode-specific pool filter
  let pool = candidates.filter((c: { name: string }) => !recent.has(c.name)) as Array<{
    id: number; name: string
    attributes: Record<string, unknown>
    extra:      Record<string, unknown>
    image_url:  string | null
  }>

  if (mode === 'pokemon-card') {
    pool = pool.filter(c => !!c.extra.card_url)
  }

  if (!pool.length) return 'skipped: no candidates'

  const pick = pool[Math.floor(Math.random() * pool.length)]

  // Build mode-specific attributes snapshot and extra
  let attrs: Record<string, unknown>
  let extra: Record<string, unknown>

  if (mode === 'pokemon-classic') {
    // Only the 7 visible columns for the classic grid, in display order
    attrs = {
      type1:           pick.attributes.type1 ?? null,
      type2:           pick.attributes.type2 ?? 'None',
      habitat:         pick.attributes.habitat ?? 'unknown',
      color:           pick.attributes.color ?? '',
      evolution_stage: pick.attributes.evolution_stage ?? 1,
      height_m:        pick.attributes.height_m ?? '0',
      weight_kg:       pick.attributes.weight_kg ?? '0',
    }
    extra = {}

  } else if (mode === 'pokemon-card') {
    attrs = pick.attributes
    extra = { card_url: pick.extra.card_url }

  } else if (mode === 'pokemon-description') {
    // Fetch English flavor text from PokéAPI
    let flavorText = ''
    try {
      const dexNum  = pick.attributes.pokedex_number as number
      const specRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${dexNum}`)
      if (specRes.ok) {
        const specData = await specRes.json() as {
          flavor_text_entries: Array<{ flavor_text: string; language: { name: string } }>
        }
        const entry = specData.flavor_text_entries.find(e => e.language.name === 'en')
        // Clean control characters (newlines, form feeds) from flavor text
        flavorText = (entry?.flavor_text ?? '').replace(/[\f\n\r]/g, ' ').trim()
      }
    } catch { /* non-fatal */ }

    const description = await generatePokemonDescription(pick.name, flavorText)
    attrs = pick.attributes
    extra = { description }

  } else {
    // pokemon-silhouette — no extra needed
    attrs = pick.attributes
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

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/cron-daily-challenges/index.ts
git commit -m "feat(pokemon): update fetchPokemon for 4 new mode slugs + Gemini description"
```

---

### Task 4: DB migration — update Pokémon theme modes

**Files:**
- Modify: Supabase DB directly (via SQL or migration file)

- [ ] **Step 1: Run the migration SQL**

Execute in the Supabase SQL editor (or via `supabase db push`):

```sql
UPDATE themes
SET modes = array['pokemon-classic', 'pokemon-card', 'pokemon-description', 'pokemon-silhouette']
WHERE slug = 'pokemon';
```

Verify with:
```sql
SELECT slug, modes FROM themes WHERE slug = 'pokemon';
```

Expected output:
```
 slug    | modes
---------+----------------------------------------------------------
 pokemon | {pokemon-classic,pokemon-card,pokemon-description,pokemon-silhouette}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(pokemon): migrate theme modes to new pokemon-* slugs"
```

---

### Task 5: Deploy edge functions

- [ ] **Step 1: Deploy refresh-catalog**

```bash
supabase functions deploy refresh-catalog --project-ref yabxlaicllxqwaaqfnax
```

Expected: `Deployed Function refresh-catalog`

- [ ] **Step 2: Deploy cron-daily-challenges**

```bash
supabase functions deploy cron-daily-challenges --project-ref yabxlaicllxqwaaqfnax
```

Expected: `Deployed Function cron-daily-challenges`

- [ ] **Step 3: Trigger refresh-catalog for Pokémon**

```bash
curl -X POST https://yabxlaicllxqwaaqfnax.supabase.co/functions/v1/refresh-catalog \
  -H "Authorization: Bearer $(cat apps/web/.env.local | grep SERVICE_ROLE | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"universe":"pokemon","offset":0,"chunkSize":151}'
```

This populates `habitat`, `evolution_stage`, `card_url` for all 151 Gen 1 Pokémon. Takes ~3–5 minutes due to polite delay (500ms × 151 = ~75s minimum, plus API latency).

- [ ] **Step 4: Trigger cron manually to generate today's challenges**

```bash
curl -X POST https://yabxlaicllxqwaaqfnax.supabase.co/functions/v1/cron-daily-challenges \
  -H "Authorization: Bearer $(cat apps/web/.env.local | grep SERVICE_ROLE | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

- [ ] **Step 5: Verify in DB**

```sql
SELECT mode, name, attributes, extra
FROM daily_challenges
WHERE theme_id = (SELECT id FROM themes WHERE slug = 'pokemon')
  AND date = CURRENT_DATE
ORDER BY mode;
```

Expected: 4 rows — one per mode — each with the correct `extra` structure.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore(pokemon): deploy backend and seed daily challenges"
```
