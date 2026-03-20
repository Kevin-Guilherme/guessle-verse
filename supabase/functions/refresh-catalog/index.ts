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
  const root   = parse(html)
  const result: Record<string, string> = {}

  // Format 1: Fandom portable-infobox (newer wikis)
  const aside = root.querySelector('aside.portable-infobox')
  if (aside) {
    const rows = aside.querySelectorAll('.pi-item[data-source], .pi-data')
    for (const row of rows) {
      const key = row.getAttribute('data-source')
        ?? row.querySelector('.pi-data-label')?.text?.trim().toLowerCase().replace(/\s+/g, '_')
      const val = row.querySelector('.pi-data-value')?.text?.trim()
      if (key && val) result[key] = val
    }
    return result
  }

  // Format 2: Old MediaWiki table.infobox (Naruto wiki style)
  const table = root.querySelector('table.infobox')
  if (table) {
    for (const tr of table.querySelectorAll('tr')) {
      const th = tr.querySelector('th')
      const td = tr.querySelector('td')
      if (!th || !td) continue
      const key = th.text.trim().toLowerCase().replace(/\s+/g, '_')
      const val = td.text.trim().replace(/\s+/g, ' ')
      if (key && val) result[key] = val
    }
    return result
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

// ─── Pokemon (PokeAPI — chunked) ─────────────────────────────────────────────

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
      const type1        = pokemon.types[0]?.type.name ?? ''
      const type2        = pokemon.types[1]?.type.name ?? null
      const heightM      = (pokemon.height  / 10).toFixed(1)
      const weightKg     = (pokemon.weight  / 10).toFixed(1)
      const isLegendary  = species.is_legendary ? 'Sim' : 'Nao'
      const isMythical   = species.is_mythical  ? 'Sim' : 'Nao'
      const evolvedFrom  = species.evolves_from_species?.name ?? null
      const spriteUrl    = pokemon.sprites.other?.['official-artwork']?.front_default
        ?? pokemon.sprites.front_default

      await upsertCharacter(themeId, name, spriteUrl, {
        pokedex_number: pokemon.id,
        type1, type2, generation,
        height_m: heightM, weight_kg: weightKg,
        color, is_legendary: isLegendary, is_mythical: isMythical,
        evolves_from: evolvedFrom,
      }, { sprite_url: spriteUrl })

      count++
      await new Promise(r => setTimeout(r, 300)) // polite, but faster than 700ms
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

// ─── Generic wiki scraper (MediaWiki JSON API) ───────────────────────────────

type WikiConfig = {
  host:         string                   // e.g. "naruto.fandom.com"
  category:     string                   // category for character list
  attributeMap: Record<string, string>   // infobox data-source key -> our attr key
}

const WIKI_CONFIGS: Record<string, WikiConfig> = {
  naruto: {
    host:     'naruto.fandom.com',
    category: 'Characters',
    attributeMap: {
      // table.infobox keys (lowercase underscored)
      sex:          'genero',
      clan:         'cla',
      affiliation:  'afiliacao',
      kekkei_genkai: 'kekkei_genkai',
      classification: 'rank',
      ninja_rank:   'ninja_rank',
      // portable-infobox keys (fallback)
      species:      'especie',
      village:      'vila',
      gender:       'genero',
    },
  },
  onepiece: {
    host:     'onepiece.fandom.com',
    category: 'Characters',
    attributeMap: {
      affiliation: 'afiliacao', devil_fruit: 'fruta_do_diabo',
      bounty: 'recompensa', haki: 'haki',
      species: 'raca', origin: 'ilha_natal', gender: 'genero',
    },
  },
  jujutsu: {
    host:     'jujutsu-kaisen.fandom.com',
    category: 'Characters',
    attributeMap: {
      cursed_technique: 'tecnica_maldita', grade: 'grau',
      affiliation: 'afiliacao', gender: 'genero', status: 'status',
    },
  },
  smash: {
    host:     'supersmashbros.fandom.com',
    category: 'Fighters',
    attributeMap: {
      universe: 'universe', weight_class: 'weight_class',
      tier: 'tier', first_appearance: 'first_appearance',
    },
  },
  zelda: {
    host:     'zelda.fandom.com',
    category: 'Characters',
    attributeMap: {
      race: 'race', game: 'games', gender: 'gender', affiliation: 'affiliation',
    },
  },
  mario: {
    host:     'mario.fandom.com',
    category: 'Characters',
    attributeMap: {
      species: 'species', first_appearance: 'first_appearance', affiliation: 'affiliation',
    },
  },
  gow: {
    host:     'godofwar.fandom.com',
    category: 'Characters',
    attributeMap: {
      realm: 'realm', affiliation: 'affiliation', weapon: 'weapon', gender: 'gender',
    },
  },
  monsterhunter: {
    host:     'monsterhunter.fandom.com',
    category: 'Monsters',
    attributeMap: {
      type: 'type', element: 'element', weakness: 'weakness',
      size: 'size', threat_level: 'threat_level',
    },
  },
}

async function fetchMediaWikiApi(host: string, params: Record<string, string>): Promise<unknown> {
  const qs  = new URLSearchParams({ ...params, format: 'json' })
  const res = await fetch(`https://${host}/api.php?${qs}`, {
    headers: { 'User-Agent': 'GuessleBot/1.0 (daily game platform; non-commercial)' },
  })
  if (!res.ok) throw new Error(`MediaWiki API ${res.status} at ${host}`)
  return res.json()
}

async function getWikiCategoryMembers(host: string, category: string, chunkSize: number, offset: string): Promise<{ titles: string[]; nextOffset: string | null }> {
  const params: Record<string, string> = {
    action: 'query', list: 'categorymembers',
    cmtitle: `Category:${category}`, cmtype: 'page',
    cmlimit: String(chunkSize), cmnamespace: '0',
  }
  if (offset) params.cmcontinue = offset

  const data = await fetchMediaWikiApi(host, params) as Record<string, unknown>
  const members = ((data as Record<string, Record<string, Array<{ title: string }>>>).query?.categorymembers ?? [])
  const titles  = members.map((m: { title: string }) => m.title)
  const nextOffset = (data as Record<string, Record<string, Record<string, string>>>)?.['query-continue']?.categorymembers?.cmcontinue
    ?? (data as Record<string, Record<string, string>>)?.continue?.cmcontinue
    ?? null
  return { titles, nextOffset }
}

async function getWikiPageHtml(host: string, title: string): Promise<string> {
  const data = await fetchMediaWikiApi(host, { action: 'parse', page: title, prop: 'text' }) as Record<string, Record<string, Record<string, string>>>
  return data?.parse?.text?.['*'] ?? ''
}

async function refreshWikiUniverse(slug: string, themeId: number, cmcontinue = '', chunkSize = 50): Promise<{ count: number; nextOffset: string | null }> {
  const config = WIKI_CONFIGS[slug]
  if (!config) throw new Error(`No wiki config for ${slug}`)

  const { titles, nextOffset } = await getWikiCategoryMembers(config.host, config.category, chunkSize, cmcontinue)
  let count = 0

  for (const title of titles) {
    try {
      const html    = await getWikiPageHtml(config.host, title)
      const infobox = extractInfobox(html)

      if (!Object.keys(infobox).length) continue

      const attributes: Record<string, unknown> = {}
      for (const [infoboxKey, attrKey] of Object.entries(config.attributeMap)) {
        const val = infobox[infoboxKey]
        if (val) attributes[attrKey] = val
      }

      const pageRoot = parse(html)
      const img      = pageRoot.querySelector('.pi-image-thumbnail, .infobox img, .pi-image img')
      const imageUrl = img?.getAttribute('src') ?? null

      await upsertCharacter(themeId, title, imageUrl, attributes, {})
      count++

      await new Promise(r => setTimeout(r, 250))
    } catch (err) {
      console.error(`Wiki error (${slug}/${title}):`, err)
    }
  }

  return { count, nextOffset }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

const WIKI_SLUGS = ['naruto', 'onepiece', 'jujutsu', 'smash', 'zelda', 'mario', 'gow', 'monsterhunter']

type RefreshBody = {
  universe?:   string
  offset?:     number   // Pokemon: numeric offset (0-based)
  cmcontinue?: string   // Wiki: MediaWiki category-continue token
  chunkSize?:  number   // items per call (default: 100 pokemon / 50 wiki)
}

async function refreshOne(slug: string, body: RefreshBody): Promise<Record<string, unknown>> {
  const themeId = await getThemeId(slug)
  if (!themeId) return { result: 'error: theme not found' }

  if (slug === 'pokemon') {
    const count = await refreshPokemon(themeId, body.offset ?? 0, body.chunkSize ?? 100)
    return { result: `ok: ${count} upserted`, nextOffset: (body.offset ?? 0) + (body.chunkSize ?? 100) }
  }
  if (slug === 'lol') {
    const count = await refreshLoL(themeId)
    return { result: `ok: ${count} upserted` }
  }
  if (WIKI_SLUGS.includes(slug)) {
    const { count, nextOffset } = await refreshWikiUniverse(slug, themeId, body.cmcontinue ?? '', body.chunkSize ?? 50)
    return { result: `ok: ${count} upserted`, nextOffset }
  }
  return { result: 'error: unknown universe' }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: RefreshBody = {}
  try { body = await req.json() } catch { /* no body = refresh all */ }

  const log: Array<Record<string, unknown>> = []

  // Single universe mode — safe for 60s timeout
  if (body.universe) {
    try {
      const info = await refreshOne(body.universe, body)
      log.push({ universe: body.universe, ...info })
    } catch (err) {
      log.push({ universe: body.universe, result: `error: ${err instanceof Error ? err.message : String(err)}` })
    }
    return new Response(JSON.stringify({ log }), { headers: { 'Content-Type': 'application/json' } })
  }

  // Full refresh (all universes) — use only when not time-constrained
  for (const slug of ['lol', 'pokemon', ...WIKI_SLUGS]) {
    try {
      log.push({ universe: slug, ...(await refreshOne(slug, body)) })
    } catch (err) {
      log.push({ universe: slug, result: `error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return new Response(JSON.stringify({ log }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
