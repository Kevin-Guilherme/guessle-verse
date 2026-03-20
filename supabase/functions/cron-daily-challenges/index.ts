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
      if (await challengeExists(theme.id, mode, today)) {
        log.push({ theme: theme.slug, mode, result: 'skipped: already exists' })
        continue
      }

      let result: string
      try {
        if (theme.type === 'code') {
          // js/ts/python -> generate-code-puzzle
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
