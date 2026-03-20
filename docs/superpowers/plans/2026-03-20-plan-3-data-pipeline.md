# Guessle — Plan 3: Data Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three Supabase Edge Functions that populate `daily_challenges` every day, refresh the character catalog weekly, and generate code puzzles via Groq.

**Architecture:** Three Deno-based Edge Functions in `supabase/functions/`. `cron-daily-challenges` runs at 10:00 UTC daily via pg_cron; it orchestrates all 14 universes and calls `generate-code-puzzle` for code universes. `refresh-catalog` runs at 03:00 UTC on Sundays to scrape fandom wikis for 8 universes. All functions use the Supabase service role for DB writes.

**Tech Stack:** Deno (Supabase Edge Runtime), Supabase JS v2, Groq REST API, PokeAPI, Riot Data Dragon, IGDB API, npm:node-html-parser

---

## File Structure

```
supabase/
├── functions/
│   ├── generate-code-puzzle/
│   │   └── index.ts          # POST: generates one code puzzle via Groq
│   ├── cron-daily-challenges/
│   │   └── index.ts          # POST: creates daily_challenges for all 14 universes
│   └── refresh-catalog/
│       └── index.ts          # POST: scrapes wikis, upserts characters table
└── migrations/
    └── 002_cron_jobs.sql     # pg_cron extension + cron job registrations
```

---

## Task 1: generate-code-puzzle Edge Function

**Files:**
- Create: `supabase/functions/generate-code-puzzle/index.ts`

This function accepts a POST request with `{ language: 'js'|'ts'|'python', modeVariant: 'complete'|'fix'|'output' }` and returns a generated code puzzle via Groq.

- [ ] **Step 1: Create `supabase/functions/generate-code-puzzle/index.ts`**

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const PROMPTS: Record<string, Record<string, string>> = {
  complete: {
    js:     'Generate a short JavaScript code snippet (4-8 lines) where exactly one expression or value is replaced with `___`. The blank must be a single token or short phrase (e.g., a number, string, operator, method name). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" }. The code must be syntactically valid when ___ is replaced with answer. Do not use comments. Keep it beginner-friendly.',
    ts:     'Generate a short TypeScript code snippet (4-8 lines) where exactly one expression or type annotation is replaced with `___`. Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" }. Valid when ___ is replaced with answer.',
    python: 'Generate a short Python code snippet (4-8 lines) where exactly one expression or value is replaced with `___`. Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" }. Valid when ___ is replaced with answer.',
  },
  fix: {
    js:     'Generate a short JavaScript code snippet (4-8 lines) that contains exactly one intentional bug (wrong operator, wrong method, off-by-one, etc.). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the corrected fragment that replaces the bug (single token or short phrase). The code must have an obvious purpose.',
    ts:     'Generate a short TypeScript code snippet (4-8 lines) with exactly one intentional bug. Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the corrected fragment.',
    python: 'Generate a short Python code snippet (4-8 lines) with exactly one intentional bug. Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the corrected fragment.',
  },
  output: {
    js:     'Generate a short JavaScript code snippet (4-8 lines) that prints exactly one line to stdout via console.log(). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the exact printed output (string, no newline). No user input. No external APIs.',
    ts:     'Generate a short TypeScript code snippet (4-8 lines) that prints exactly one line via console.log(). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the exact printed output.',
    python: 'Generate a short Python code snippet (4-8 lines) that prints exactly one line via print(). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the exact printed output.',
  },
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verify service role authorization
  const auth = req.headers.get('authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!auth.includes(serviceKey)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { language, modeVariant } = await req.json() as {
    language: 'js' | 'ts' | 'python'
    modeVariant: 'complete' | 'fix' | 'output'
  }

  const prompt = PROMPTS[modeVariant]?.[language]
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Invalid language or modeVariant' }), { status: 400 })
  }

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not set' }), { status: 500 })
  }

  const groqRes = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.7,
      messages: [
        {
          role:    'system',
          content: 'You are a programming puzzle generator. Always respond with valid JSON only. No markdown fences. No explanation outside the JSON object.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!groqRes.ok) {
    const errText = await groqRes.text()
    return new Response(JSON.stringify({ error: 'Groq error', detail: errText }), { status: 502 })
  }

  const groqData = await groqRes.json()
  const content  = groqData.choices?.[0]?.message?.content ?? ''

  let puzzle: { code: string; answer: string; explanation: string; difficulty: string }
  try {
    puzzle = JSON.parse(content)
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse Groq response', raw: content }), { status: 502 })
  }

  if (!puzzle.code || !puzzle.answer) {
    return new Response(JSON.stringify({ error: 'Incomplete puzzle', raw: content }), { status: 502 })
  }

  return new Response(JSON.stringify(puzzle), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add supabase/functions/generate-code-puzzle && git commit -m "feat: add generate-code-puzzle Edge Function (Groq llama-3.3-70b)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: cron-daily-challenges Edge Function

**Files:**
- Create: `supabase/functions/cron-daily-challenges/index.ts`

This is the main orchestrator. It runs daily at 10:00 UTC. For each active theme+mode, it checks if today's challenge already exists, selects a non-repeated candidate, and inserts into `daily_challenges`.

Fetcher strategy:
- **pokemon**: PokeAPI — characters table (populated by refresh-catalog); `extra.cry_url` from PokeAPI at cron time
- **lol**: Riot Data Dragon — characters table; `extra.splash_url` from Data Dragon at cron time
- **gamedle**: `gamedle_pool` table; cover/screenshot from IGDB at cron time
- **js/ts/python**: `generate-code-puzzle` Edge Function via `supabase.functions.invoke()`
- **All others** (naruto, onepiece, jujutsu, smash, zelda, mario, gow, monsterhunter): characters table, no external API needed at cron time

- [ ] **Step 1: Create `supabase/functions/cron-daily-challenges/index.ts`**

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IGDB_CLIENT_ID    = Deno.env.get('IGDB_CLIENT_ID') ?? ''
const IGDB_CLIENT_SECRET = Deno.env.get('IGDB_CLIENT_SECRET') ?? ''
const RIOT_VERSION_URL  = 'https://ddragon.leagueoflegends.com/api/versions.json'
const LOOKBACK_DAYS     = 60

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── helpers ───────────────────────────────────────────────────────────────

async function getRecentNames(themeId: number, mode: string): Promise<Set<string>> {
  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)
  const { data } = await supabase
    .from('daily_challenges')
    .select('name')
    .eq('theme_id', themeId)
    .eq('mode', mode)
    .gte('date', since.toISOString().split('T')[0])
  return new Set((data ?? []).map((r: { name: string }) => r.name))
}

async function challengeExists(themeId: number, mode: string, today: string): Promise<boolean> {
  const { data } = await supabase
    .from('daily_challenges')
    .select('id')
    .eq('theme_id', themeId)
    .eq('mode', mode)
    .eq('date', today)
    .maybeSingle()
  return !!data
}

// ─── Pokemon fetcher ────────────────────────────────────────────────────────

async function fetchPokemon(themeId: number, mode: string, today: string): Promise<string> {
  const recent = await getRecentNames(themeId, mode)

  const { data: candidates } = await supabase
    .from('characters')
    .select('id, name, attributes, extra')
    .eq('theme_id', themeId)
    .eq('active', true)

  const pool = (candidates ?? []).filter((c: { name: string }) => !recent.has(c.name))
  if (!pool.length) return 'skipped: no candidates'

  const pick = pool[Math.floor(Math.random() * pool.length)] as {
    id: number; name: string; attributes: Record<string, unknown>; extra: Record<string, unknown>
  }

  // Fetch cry URL from PokeAPI at cron time
  let cryUrl: string | null = null
  try {
    const dexNum = pick.attributes.pokedex_number as number
    const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexNum}`)
    if (pokeRes.ok) {
      const pokeData = await pokeRes.json()
      cryUrl = pokeData.cries?.latest ?? null
    }
  } catch { /* non-fatal */ }

  const extra = { ...pick.extra, cry_url: cryUrl }

  await supabase.from('daily_challenges').insert({
    theme_id:     themeId,
    mode,
    date:         today,
    character_id: pick.id,
    name:         pick.name,
    image_url:    (pick.extra.sprite_url as string) ?? null,
    attributes:   pick.attributes,
    extra,
  })

  return `ok: ${pick.name}`
}

// ─── LoL fetcher ────────────────────────────────────────────────────────────

async function fetchLoL(themeId: number, mode: string, today: string): Promise<string> {
  const recent = await getRecentNames(themeId, mode)

  const { data: candidates } = await supabase
    .from('characters')
    .select('id, name, attributes, extra')
    .eq('theme_id', themeId)
    .eq('active', true)

  const pool = (candidates ?? []).filter((c: { name: string }) => !recent.has(c.name))
  if (!pool.length) return 'skipped: no candidates'

  const pick = pool[Math.floor(Math.random() * pool.length)] as {
    id: number; name: string; attributes: Record<string, unknown>; extra: Record<string, unknown>
  }

  // Fetch splash URL from Data Dragon
  let splashUrl: string | null = null
  try {
    const versRes = await fetch(RIOT_VERSION_URL)
    const versions: string[] = await versRes.json()
    const version = versions[0]
    const key = (pick.attributes.key as string) ?? pick.name.replace(/[^a-zA-Z]/g, '')
    splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`
  } catch { /* non-fatal */ }

  const extra = { ...pick.extra, splash_url: splashUrl }

  await supabase.from('daily_challenges').insert({
    theme_id:     themeId,
    mode,
    date:         today,
    character_id: pick.id,
    name:         pick.name,
    image_url:    splashUrl,
    attributes:   pick.attributes,
    extra,
  })

  return `ok: ${pick.name}`
}

// ─── Generic character fetcher (wiki-sourced universes) ────────────────────

async function fetchCharacter(themeId: number, mode: string, today: string): Promise<string> {
  const recent = await getRecentNames(themeId, mode)

  const { data: candidates } = await supabase
    .from('characters')
    .select('id, name, attributes, extra, image_url')
    .eq('theme_id', themeId)
    .eq('active', true)

  const pool = (candidates ?? []).filter((c: { name: string }) => !recent.has(c.name))
  if (!pool.length) return 'skipped: no candidates'

  const pick = pool[Math.floor(Math.random() * pool.length)] as {
    id: number; name: string; attributes: Record<string, unknown>
    extra: Record<string, unknown>; image_url: string | null
  }

  await supabase.from('daily_challenges').insert({
    theme_id:     themeId,
    mode,
    date:         today,
    character_id: pick.id,
    name:         pick.name,
    image_url:    pick.image_url,
    attributes:   pick.attributes,
    extra:        pick.extra,
  })

  return `ok: ${pick.name}`
}

// ─── Gamedle fetcher ────────────────────────────────────────────────────────

async function getIgdbToken(): Promise<string | null> {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) return null
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
      { method: 'POST' }
    )
    const data = await res.json()
    return data.access_token ?? null
  } catch {
    return null
  }
}

async function fetchGamedle(themeId: number, mode: string, today: string): Promise<string> {
  const recent = await getRecentNames(themeId, mode)

  const { data: candidates } = await supabase
    .from('gamedle_pool')
    .select('igdb_id, name, genre, platform, developer, franchise, release_year, multiplayer')
    .eq('active', true)

  const pool = (candidates ?? []).filter((c: { name: string }) => !recent.has(c.name))
  if (!pool.length) return 'skipped: no candidates'

  const pick = pool[Math.floor(Math.random() * pool.length)] as {
    igdb_id: number; name: string; genre: string[]; platform: string[]
    developer: string; franchise: string; release_year: number; multiplayer: boolean
  }

  let coverUrl:      string | null = null
  let screenshotUrl: string | null = null
  let soundtrackUrl: string | null = null

  const igdbToken = await getIgdbToken()
  if (igdbToken) {
    try {
      const coverRes = await fetch('https://api.igdb.com/v4/covers', {
        method: 'POST',
        headers: {
          'Client-ID':     IGDB_CLIENT_ID,
          'Authorization': `Bearer ${igdbToken}`,
          'Content-Type':  'text/plain',
        },
        body: `fields url; where game = ${pick.igdb_id}; limit 1;`,
      })
      const covers = await coverRes.json()
      if (covers[0]?.url) {
        coverUrl = covers[0].url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
      }

      const ssRes = await fetch('https://api.igdb.com/v4/screenshots', {
        method: 'POST',
        headers: {
          'Client-ID':     IGDB_CLIENT_ID,
          'Authorization': `Bearer ${igdbToken}`,
          'Content-Type':  'text/plain',
        },
        body: `fields url; where game = ${pick.igdb_id}; limit 1;`,
      })
      const screenshots = await ssRes.json()
      if (screenshots[0]?.url) {
        screenshotUrl = screenshots[0].url.replace('t_thumb', 't_screenshot_big').replace('//', 'https://')
      }
    } catch { /* non-fatal */ }
  }

  const attributes = {
    genre:        pick.genre?.join(', ') ?? '',
    platform:     pick.platform?.join(', ') ?? '',
    developer:    pick.developer ?? '',
    franchise:    pick.franchise ?? '',
    release_year: pick.release_year ?? 0,
    multiplayer:  pick.multiplayer ? 'Sim' : 'Nao',
  }

  const extra = {
    cover_url:      coverUrl,
    screenshot_url: screenshotUrl,
    soundtrack_url: soundtrackUrl,
  }

  await supabase.from('daily_challenges').insert({
    theme_id:   themeId,
    mode,
    date:       today,
    name:       pick.name,
    image_url:  mode === 'cover' ? coverUrl : screenshotUrl,
    attributes,
    extra,
  })

  return `ok: ${pick.name}`
}

// ─── Code puzzle fetcher ────────────────────────────────────────────────────

async function fetchCodePuzzle(
  themeId: number,
  mode: string,
  language: string,
  today: string
): Promise<string> {
  // Check for duplicate content_hash in last 60 days
  const { data: recentHashes } = await supabase
    .from('daily_challenges')
    .select('content_hash')
    .eq('theme_id', themeId)
    .eq('mode', mode)
    .not('content_hash', 'is', null)

  const usedHashes = new Set((recentHashes ?? []).map((r: { content_hash: string }) => r.content_hash))

  // Try up to 3 times to get a non-duplicate puzzle
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-code-puzzle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ language, modeVariant: mode }),
    })

    if (!res.ok) return `error: generate-code-puzzle ${res.status}`

    const puzzle = await res.json() as {
      code: string; answer: string; explanation: string; difficulty: string
    }

    // Compute content_hash
    const encoder    = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(puzzle.code))
    const hashArray  = Array.from(new Uint8Array(hashBuffer))
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    if (usedHashes.has(contentHash)) continue

    const { error } = await supabase.from('daily_challenges').insert({
      theme_id:     themeId,
      mode,
      date:         today,
      name:         `${language.toUpperCase()} ${mode} ${today}`,
      attributes: {
        code:         puzzle.code,
        answer:       puzzle.answer,
        difficulty:   puzzle.difficulty,
        mode_variant: mode,
      },
      extra:        { explanation: puzzle.explanation },
      content_hash: contentHash,
    })

    if (error) return `error: ${error.message}`
    return `ok: ${language} ${mode}`
  }

  return 'skipped: could not generate unique puzzle after 3 attempts'
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: themes } = await supabase
    .from('themes')
    .select('id, slug, type, modes')
    .eq('active', true)

  const log: Array<{ theme: string; mode: string; result: string }> = []

  for (const theme of (themes ?? []) as Array<{ id: number; slug: string; type: string; modes: string[] }>) {
    for (const mode of theme.modes) {
      const key = `${theme.slug}/${mode}`

      if (await challengeExists(theme.id, mode, today)) {
        log.push({ theme: theme.slug, mode, result: 'skipped: already exists' })
        continue
      }

      let result: string
      try {
        if (theme.type === 'code') {
          // js/ts/python → generate-code-puzzle
          const language = theme.slug // 'js' | 'ts' | 'python'
          result = await fetchCodePuzzle(theme.id, mode, language, today)
        } else if (theme.slug === 'gamedle') {
          result = await fetchGamedle(theme.id, mode, today)
        } else if (theme.slug === 'pokemon') {
          result = await fetchPokemon(theme.id, mode, today)
        } else if (theme.slug === 'lol') {
          result = await fetchLoL(theme.id, mode, today)
        } else {
          // All other character universes: use characters table
          result = await fetchCharacter(theme.id, mode, today)
        }
      } catch (err) {
        result = `error: ${err instanceof Error ? err.message : String(err)}`
      }

      log.push({ theme: theme.slug, mode, result })
    }
  }

  return new Response(JSON.stringify({ date: today, log }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add supabase/functions/cron-daily-challenges && git commit -m "feat: add cron-daily-challenges Edge Function

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: refresh-catalog Edge Function

**Files:**
- Create: `supabase/functions/refresh-catalog/index.ts`

This function scrapes 8 fandom wikis and upserts into the `characters` table. It runs weekly (Sundays at 03:00 UTC). It also populates the `characters` table for Pokemon and LoL from their public APIs.

The scraper fetches the wiki's "List of X" or category pages to discover all character names, then fetches each character's infobox data.

- [ ] **Step 1: Create `supabase/functions/refresh-catalog/index.ts`**

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { parse } from 'npm:node-html-parser@6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getThemeId(slug: string): Promise<number | null> {
  const { data } = await supabase.from('themes').select('id').eq('slug', slug).single()
  return data?.id ?? null
}

async function upsertCharacter(
  themeId: number,
  name: string,
  imageUrl: string | null,
  attributes: Record<string, unknown>,
  extra: Record<string, unknown>
): Promise<void> {
  await supabase.from('characters').upsert(
    { theme_id: themeId, name, image_url: imageUrl, attributes, extra, active: true },
    { onConflict: 'theme_id,name' }
  )
}

function extractInfobox(html: string): Record<string, string> {
  const root = parse(html)
  const result: Record<string, string> = {}

  // Standard fandom infobox: <aside class="portable-infobox"> or <table class="infobox">
  const aside = root.querySelector('aside.portable-infobox, table.infobox, .pi-item')
  if (!aside) return result

  const rows = aside.querySelectorAll('.pi-item[data-source], .pi-data')
  for (const row of rows) {
    const key = row.getAttribute('data-source')
      ?? row.querySelector('.pi-data-label')?.text?.trim().toLowerCase().replace(/\s+/g, '_')
    const val = row.querySelector('.pi-data-value')?.text?.trim()
    if (key && val) result[key] = val
  }

  return result
}

async function fetchWikiPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GuessleBot/1.0 (daily game platform; non-commercial)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

// ─── Pokemon (PokeAPI) ────────────────────────────────────────────────────────

async function refreshPokemon(themeId: number): Promise<number> {
  let count = 0
  // Gen 1-9 (up to #1025)
  const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025')
  const data = await res.json()

  for (const entry of (data.results as Array<{ name: string; url: string }>)) {
    try {
      const pokeRes  = await fetch(entry.url)
      const pokemon  = await pokeRes.json()

      const specRes  = await fetch(pokemon.species.url)
      const species  = await specRes.json()

      const name         = species.names.find((n: { language: { name: string }; name: string }) => n.language.name === 'en')?.name ?? entry.name
      const generation   = Number(species.generation.url.match(/\/(\d+)\//)?.[1] ?? 1)
      const color        = species.color?.name ?? ''
      const type1        = pokemon.types[0]?.type.name ?? ''
      const type2        = pokemon.types[1]?.type.name ?? null
      const heightDm     = pokemon.height   // decimetres
      const weightHg     = pokemon.weight   // hectograms
      const heightM      = (heightDm / 10).toFixed(1)
      const weightKg     = (weightHg / 10).toFixed(1)
      const isLegendary  = species.is_legendary ? 'Sim' : 'Nao'
      const isMythical   = species.is_mythical  ? 'Sim' : 'Nao'
      const evolvedFrom  = species.evolves_from_species?.name ?? null
      const spriteUrl    = pokemon.sprites.other?.['official-artwork']?.front_default
        ?? pokemon.sprites.front_default

      const attributes: Record<string, unknown> = {
        pokedex_number: pokemon.id,
        type1,
        type2,
        generation,
        height_m:       heightM,
        weight_kg:      weightKg,
        color,
        is_legendary:   isLegendary,
        is_mythical:    isMythical,
        evolves_from:   evolvedFrom,
      }

      const extra: Record<string, unknown> = {
        sprite_url: spriteUrl,
      }

      await upsertCharacter(themeId, name, spriteUrl, attributes, extra)
      count++

      // Be polite to PokeAPI
      await new Promise(r => setTimeout(r, 50))
    } catch (err) {
      console.error(`Pokemon error (${entry.name}):`, err)
    }
  }

  return count
}

// ─── LoL (Riot Data Dragon) ───────────────────────────────────────────────────

async function refreshLoL(themeId: number): Promise<number> {
  let count = 0

  const versRes  = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  const versions = await versRes.json() as string[]
  const version  = versions[0]

  const listRes  = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
  const listData = await listRes.json()

  for (const key of Object.keys(listData.data)) {
    try {
      const champRes  = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${key}.json`)
      const champData = await champRes.json()
      const champ     = champData.data[key]

      const name       = champ.name
      const tags       = champ.tags as string[]
      const resource   = champ.partype
      const attackRange = Number(champ.stats?.attackrange ?? 0)
      const splashUrl  = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`

      const attributes: Record<string, unknown> = {
        key,
        class:         tags[0]  ?? '',
        secondary_class: tags[1] ?? null,
        resource,
        range_type:    attackRange > 300 ? 'Ranged' : 'Melee',
      }

      const extra: Record<string, unknown> = {
        splash_url: splashUrl,
      }

      await upsertCharacter(themeId, name, splashUrl, attributes, extra)
      count++
    } catch (err) {
      console.error(`LoL error (${key}):`, err)
    }
  }

  return count
}

// ─── Generic wiki scraper ─────────────────────────────────────────────────────

type WikiConfig = {
  listUrl:    string       // URL to the character list page
  nameSelector: string     // CSS selector for character name links
  attributeMap: Record<string, string> // infobox data-source key → our attribute key
  extraKeys:  string[]     // infobox keys to put in extra (e.g., image)
}

const WIKI_CONFIGS: Record<string, WikiConfig> = {
  naruto: {
    listUrl:      'https://naruto.fandom.com/wiki/Special:AllPages?namespace=0',
    nameSelector: '.mw-allpages-chunk li a',
    attributeMap: {
      species:         'especie',
      affiliation:     'afiliacao',
      clan:            'cla',
      kekkei_genkai:   'kekkei_genkai',
      classification:  'rank',
      village:         'vila',
      gender:          'genero',
    },
    extraKeys: [],
  },
  onepiece: {
    listUrl:      'https://onepiece.fandom.com/wiki/Special:AllPages?namespace=0',
    nameSelector: '.mw-allpages-chunk li a',
    attributeMap: {
      affiliation:  'afiliacao',
      devil_fruit:  'fruta_do_diabo',
      bounty:       'recompensa',
      haki:         'haki',
      species:      'raca',
      origin:       'ilha_natal',
      gender:       'genero',
    },
    extraKeys: ['wanted_url'],
  },
  jujutsu: {
    listUrl:      'https://jujutsu-kaisen.fandom.com/wiki/Special:AllPages?namespace=0',
    nameSelector: '.mw-allpages-chunk li a',
    attributeMap: {
      cursed_technique: 'tecnica_maldita',
      grade:            'grau',
      affiliation:      'afiliacao',
      gender:           'genero',
      status:           'status',
    },
    extraKeys: [],
  },
  smash: {
    listUrl:      'https://supersmashbros.fandom.com/wiki/Special:AllPages?namespace=0',
    nameSelector: '.mw-allpages-chunk li a',
    attributeMap: {
      universe:         'universe',
      weight_class:     'weight_class',
      tier:             'tier',
      first_appearance: 'first_appearance',
      fighter_type:     'fighter_type',
    },
    extraKeys: ['kirby_url'],
  },
  zelda: {
    listUrl:      'https://zelda.fandom.com/wiki/Special:AllPages?namespace=0',
    nameSelector: '.mw-allpages-chunk li a',
    attributeMap: {
      race:        'race',
      game:        'games',
      gender:      'gender',
      affiliation: 'affiliation',
    },
    extraKeys: [],
  },
  mario: {
    listUrl:      'https://mario.fandom.com/wiki/Special:AllPages?namespace=0',
    nameSelector: '.mw-allpages-chunk li a',
    attributeMap: {
      species:          'species',
      first_appearance: 'first_appearance',
      affiliation:      'affiliation',
    },
    extraKeys: [],
  },
  gow: {
    listUrl:      'https://godofwar.fandom.com/wiki/Special:AllPages?namespace=0',
    nameSelector: '.mw-allpages-chunk li a',
    attributeMap: {
      realm:       'realm',
      affiliation: 'affiliation',
      weapon:      'weapon',
      gender:      'gender',
    },
    extraKeys: ['voice_url'],
  },
  monsterhunter: {
    listUrl:      'https://monsterhunter.fandom.com/wiki/Special:AllPages?namespace=0',
    nameSelector: '.mw-allpages-chunk li a',
    attributeMap: {
      type:         'type',
      element:      'element',
      weakness:     'weakness',
      size:         'size',
      threat_level: 'threat_level',
    },
    extraKeys: ['roar_url'],
  },
}

async function refreshWikiUniverse(slug: string, themeId: number): Promise<number> {
  const config = WIKI_CONFIGS[slug]
  if (!config) throw new Error(`No wiki config for ${slug}`)

  const listHtml = await fetchWikiPage(config.listUrl)
  const listRoot = parse(listHtml)
  const links    = listRoot.querySelectorAll(config.nameSelector)

  let count = 0

  for (const link of links) {
    const name    = link.text.trim()
    const href    = link.getAttribute('href')
    if (!name || !href || name.includes(':')) continue // skip meta pages

    try {
      const pageUrl  = `https://${new URL(config.listUrl).hostname}${href}`
      const pageHtml = await fetchWikiPage(pageUrl)
      const infobox  = extractInfobox(pageHtml)

      if (!Object.keys(infobox).length) continue // skip pages with no infobox

      const attributes: Record<string, unknown> = {}
      for (const [infoboxKey, attrKey] of Object.entries(config.attributeMap)) {
        const val = infobox[infoboxKey]
        if (val) attributes[attrKey] = val
      }

      const extra: Record<string, unknown> = {}
      for (const key of config.extraKeys) {
        const val = infobox[key]
        if (val) extra[key] = val
      }

      // Try to find the main image
      const pageRoot = parse(pageHtml)
      const img      = pageRoot.querySelector('.pi-image-thumbnail, .infobox img')
      const imageUrl = img?.getAttribute('src') ?? null

      await upsertCharacter(themeId, name, imageUrl, attributes, extra)
      count++

      // Rate limit: 1 request per 300ms
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.error(`Wiki error (${slug}/${name}):`, err)
    }
  }

  return count
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const log: Array<{ universe: string; result: string }> = []

  // Pokemon
  try {
    const themeId = await getThemeId('pokemon')
    if (themeId) {
      const count = await refreshPokemon(themeId)
      log.push({ universe: 'pokemon', result: `ok: ${count} upserted` })
    }
  } catch (err) {
    log.push({ universe: 'pokemon', result: `error: ${err instanceof Error ? err.message : String(err)}` })
  }

  // LoL
  try {
    const themeId = await getThemeId('lol')
    if (themeId) {
      const count = await refreshLoL(themeId)
      log.push({ universe: 'lol', result: `ok: ${count} upserted` })
    }
  } catch (err) {
    log.push({ universe: 'lol', result: `error: ${err instanceof Error ? err.message : String(err)}` })
  }

  // Wiki universes
  for (const slug of ['naruto', 'onepiece', 'jujutsu', 'smash', 'zelda', 'mario', 'gow', 'monsterhunter']) {
    try {
      const themeId = await getThemeId(slug)
      if (themeId) {
        const count = await refreshWikiUniverse(slug, themeId)
        log.push({ universe: slug, result: `ok: ${count} upserted` })
      }
    } catch (err) {
      log.push({ universe: slug, result: `error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return new Response(JSON.stringify({ log }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add supabase/functions/refresh-catalog && git commit -m "feat: add refresh-catalog Edge Function (wiki + PokeAPI + Data Dragon)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Cron Scheduling Migration

**Files:**
- Create: `supabase/migrations/002_cron_jobs.sql`

Adds pg_cron extension and schedules both functions via `net.http_post`.

- [ ] **Step 1: Create `supabase/migrations/002_cron_jobs.sql`**

```sql
-- Enable pg_cron and pg_net extensions (required for HTTP cron jobs)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Daily challenges at 10:00 UTC
select cron.schedule(
  'guessle-daily-challenges',
  '0 10 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/cron-daily-challenges',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Catalog refresh every Sunday at 03:00 UTC
select cron.schedule(
  'guessle-refresh-catalog',
  '0 3 * * 0',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/refresh-catalog',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

> **Note:** `app.supabase_url` and `app.service_role_key` must be set in Supabase Vault or as database-level settings after deployment. In Supabase hosted projects, pg_cron jobs can also be managed via the Supabase Dashboard → Database → Cron Jobs UI, which is simpler and does not require these settings. The migration above is for completeness; use the dashboard UI if preferred.

- [ ] **Step 2: Commit**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add supabase/migrations/002_cron_jobs.sql && git commit -m "feat: add pg_cron scheduling migration for daily challenges and catalog refresh

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Local Verification

**Goal:** Verify all three Edge Functions are syntactically valid Deno TypeScript and the migration is valid SQL.

- [ ] **Step 1: Check Deno syntax on all Edge Functions**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && \
  deno check supabase/functions/generate-code-puzzle/index.ts 2>&1 || \
  echo "deno not installed — manual review required"
```

If Deno is not installed, manually review each function for obvious TypeScript syntax errors.

- [ ] **Step 2: Verify migration SQL syntax**

The migration can only be fully verified against a live Supabase project. For local review, confirm:
- `pg_cron` and `pg_net` extension creation syntax is correct
- `cron.schedule()` calls have correct argument names (`url`, `headers`, `body`)

- [ ] **Step 3: Verify git log**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git log --oneline -5
```

Expected output should show the 3 new commits (generate-code-puzzle, cron-daily-challenges, refresh-catalog) and the migration.

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
cd /Users/kevin.souza/Documents/Github/guessle-verse && git add -A && git commit -m "fix: edge function syntax corrections

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Environment Variables Required

Before deploying Edge Functions, set these in Supabase Dashboard → Settings → Edge Functions → Secrets:

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key for code puzzle generation |
| `IGDB_CLIENT_ID` | Twitch/IGDB client ID for Gamedle cover images |
| `IGDB_CLIENT_SECRET` | Twitch/IGDB client secret |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically injected by the Supabase Edge Runtime — no manual setup needed.
