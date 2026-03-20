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
  attributeMap: Record<string, string> // infobox data-source key -> our attribute key
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
