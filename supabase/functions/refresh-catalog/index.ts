import { createClient } from 'npm:@supabase/supabase-js@2'
import { parse } from 'npm:node-html-parser@6'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY       = Deno.env.get('GEMINI_API_KEY') ?? ''
const EYE_DETECT_MODEL = 'gemini-2.5-flash'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getThemeId(slug: string): Promise<number | null> {
  const { data } = await supabase.from('themes').select('id').eq('slug', slug).single()
  return data?.id ?? null
}

// ─── Eye coordinate detection via Claude Vision ───────────────────────────────

type EyeCoords = { left: { x: number; y: number }; right: { x: number; y: number } }

async function detectEyeCoords(imageUrl: string): Promise<EyeCoords | null> {
  if (!GEMINI_KEY) return null
  try {
    const imgRes = await fetch(imageUrl, {
      headers: { 'User-Agent': 'GuessleBot/1.0' },
      signal:  AbortSignal.timeout(10_000),
    })
    if (!imgRes.ok) throw new Error(`Image fetch HTTP ${imgRes.status}`)

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const mimeType    = contentType.split(';')[0].trim()
    const allowed     = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(mimeType)) return null

    const buffer = await imgRes.arrayBuffer()
    const bytes  = new Uint8Array(buffer)
    let binary   = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    const base64 = btoa(binary)

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EYE_DETECT_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  AbortSignal.timeout(20_000),
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: 'This is an anime/manga character portrait. Estimate the percentage coordinates (X%, Y% from top-left, 0-100) of the center of the LEFT eye and RIGHT eye. Respond ONLY with valid JSON: {"left": {"x": number, "y": number}, "right": {"x": number, "y": number}}' },
            ],
          }],
          generationConfig: { maxOutputTokens: 128, temperature: 0 },
        }),
      }
    )
    if (!geminiRes.ok) throw new Error(`Gemini HTTP ${geminiRes.status}`)

    const json      = await geminiRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const raw       = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const coords = JSON.parse(jsonMatch[0]) as EyeCoords
    if (typeof coords.left?.x !== 'number' || typeof coords.right?.x !== 'number') return null

    const clamp = (n: number) => Math.max(0, Math.min(100, n))
    return {
      left:  { x: clamp(coords.left.x),  y: clamp(coords.left.y)  },
      right: { x: clamp(coords.right.x), y: clamp(coords.right.y) },
    }
  } catch (err) {
    console.warn(`Eye detection failed (${imageUrl.slice(0, 60)}...):`, err instanceof Error ? err.message : err)
    return null
  }
}

async function upsertCharacter(
  themeId: number,
  name: string,
  imageUrl: string | null,
  attributes: Record<string, unknown>,
  extra: Record<string, unknown>,
  active = true
): Promise<void> {
  // Preserve existing eye_coords from DB so repeated refreshes don't wipe detections
  let preservedEyeCoords: EyeCoords | undefined
  try {
    const { data: existing } = await supabase
      .from('characters')
      .select('extra')
      .eq('theme_id', themeId)
      .eq('name', name)
      .maybeSingle()
    if (existing?.extra?.eye_coords) preservedEyeCoords = existing.extra.eye_coords as EyeCoords
  } catch { /* non-fatal — proceed without preserved coords */ }

  const mergedExtra = preservedEyeCoords
    ? { ...extra, eye_coords: preservedEyeCoords }
    : extra

  await supabase.from('characters').upsert(
    { theme_id: themeId, name, image_url: imageUrl, attributes, extra: mergedExtra, active },
    { onConflict: 'theme_id,name' }
  )

  // If image available and no eye_coords yet, detect in background (fire-and-forget)
  if (imageUrl && !mergedExtra.eye_coords) {
    detectEyeCoords(imageUrl).then(async (coords) => {
      if (!coords) return
      const { data: char } = await supabase
        .from('characters')
        .select('id, extra')
        .eq('theme_id', themeId)
        .eq('name', name)
        .maybeSingle()
      if (!char) return
      await supabase
        .from('characters')
        .update({ extra: { ...(char.extra ?? {}), eye_coords: coords } })
        .eq('id', char.id)
      console.log(`👁  Eye coords detected for ${name}: L(${coords.left.x.toFixed(1)}%, ${coords.left.y.toFixed(1)}%) R(${coords.right.x.toFixed(1)}%, ${coords.right.y.toFixed(1)}%)`)
    }).catch(e => console.warn(`Eye detection bg error (${name}):`, e instanceof Error ? e.message : e))
  }
}

function extractInfobox(html: string): Record<string, string> {
  const root   = parse(html)
  const result: Record<string, string> = {}

  // Format 1: Fandom portable-infobox — use [data-source] selector directly
  // (avoids fragile aside.portable-infobox class matching)
  const piItems = root.querySelectorAll('[data-source]')
  if (piItems.length > 0) {
    for (const item of piItems) {
      const key     = item.getAttribute('data-source')
      const valueEl = item.querySelector('.pi-data-value')
      if (!key || !valueEl) continue

      // Multi-value: extract individual <li> elements (strip strikethrough = former/past)
      const listItems = valueEl.querySelectorAll('li')
      let val: string
      if (listItems.length > 0) {
        val = listItems
          .filter(li => !li.querySelector('s'))          // skip struck-through (former species etc.)
          .map(li => {
            const a = li.querySelector('a')
            // Prefer link title attr (clean name without image alt text), then link text, then li text
            return (a?.getAttribute('title') ?? a?.text ?? li.text).replace(/\[.*?\]/g, '').trim()
          })
          .filter(Boolean)
          .join(', ')
      } else {
        // Single value — strip footnotes like [1], normalize whitespace
        val = valueEl.text.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim()
      }

      if (key && val) result[key] = val
    }
    if (Object.keys(result).length > 0) return result
  }

  // Format 2: Old MediaWiki table.infobox (Naruto wiki style)
  const table = root.querySelector('table.infobox')
  if (table) {
    for (const tr of table.querySelectorAll('tr')) {
      const th = tr.querySelector('th')
      const td = tr.querySelector('td')
      if (!th || !td) continue
      const key = th.text.trim().toLowerCase().replace(/\s+/g, '_')

      // Multi-value cells: extract individual <a> links and join with ', '
      // (avoids "Uzumaki Clan Senju Clan" — merged without separator)
      const anchors = td.querySelectorAll('a')
      let val: string
      if (anchors.length > 0) {
        const parts: string[] = []
        for (const a of anchors) {
          const t = (a.getAttribute('title') ?? a.text).replace(/\[.*?\]/g, '').trim()
          if (t && !parts.includes(t)) parts.push(t)
        }
        val = parts.join(', ')
      } else {
        val = td.text.trim().replace(/\s+/g, ' ')
      }

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

// ─── Meraki helpers ───────────────────────────────────────────────────────────

function toTitleCase(s: string): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

const FACTION_MAP: Record<string, string> = {
  'shadow-isles':       'Shadow Isles',
  'bandle-city':        'Bandle City',
  'mount-targon':       'Mount Targon',
  'the-void':           'Void',
  void:                 'Void',
  demacia:              'Demacia',
  noxus:                'Noxus',
  freljord:             'Freljord',
  piltover:             'Piltover',
  zaun:                 'Zaun',
  bilgewater:           'Bilgewater',
  shurima:              'Shurima',
  ionia:                'Ionia',
  targon:               'Mount Targon',
  ixtal:                'Ixtal',
  'runeterra':          'Runeterra',
}

function normalizeFaction(slug: string): string {
  const lower = slug.toLowerCase()
  return FACTION_MAP[lower] ?? slug.split('-').map(toTitleCase).join(' ')
}

/** Normalize champion name to Meraki JSON key format:
 *  strip spaces, apostrophes, dots; keep CamelCase as-is.
 *  e.g. "Kai'Sa" → "KaiSa", "Miss Fortune" → "MissFortune" */
function toMerakiKey(name: string): string {
  return name.replace(/[' .]/g, '')
}

type MerakiChampion = {
  attackType:  string
  resource:    string
  releaseDate: string
  positions:   string[]
  faction:     string
  regions?:    string[]
}

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

// ─── LoL (Riot Data Dragon + LoL wiki) ───────────────────────────────────────

async function refreshLoL(themeId: number, offset = 0, chunkSize = 5): Promise<{ count: number; nextOffset: number }> {
  const versRes  = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  const versions = await versRes.json() as string[]
  const version  = versions[0]

  const listRes   = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
  const listData  = await listRes.json()
  const allKeys   = Object.keys(listData.data)
  const chunk     = allKeys.slice(offset, offset + chunkSize)
  let count = 0

  // ── Meraki Analytics — fetch once per chunk call, fail gracefully ──────────
  let merakiData: Record<string, MerakiChampion> = {}
  try {
    const merakiRes = await fetch('https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json', {
      headers: { 'User-Agent': 'GuessleBot/1.0 (daily game platform; non-commercial)' },
    })
    if (merakiRes.ok) {
      merakiData = await merakiRes.json() as Record<string, MerakiChampion>
    } else {
      console.warn(`Meraki fetch failed: HTTP ${merakiRes.status} — continuing without Meraki data`)
    }
  } catch (merakiErr) {
    console.warn('Meraki fetch error — continuing without Meraki data:', merakiErr)
  }

  for (const key of chunk) {
    try {
      const champRes  = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${key}.json`)
      const champData = await champRes.json()
      const champ     = champData.data[key]

      const name       = champ.name
      const splashUrl  = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`
      // Data Dragon fallbacks
      const ddResource  = champ.partype as string
      const ddRangeType = Number(champ.stats?.attackrange ?? 0) > 300 ? 'Ranged' : 'Melee'

      // ── Meraki: look up champion by normalized name key ──────────────────
      const merakiKey  = toMerakiKey(name)
      const merakiChamp: MerakiChampion | undefined = merakiData[merakiKey]
        // fallback: try Data Dragon key (e.g. "MonkeyKing" for Wukong)
        ?? merakiData[key]

      // Try LoL wiki for the 7 LoLdle-style attributes
      let gender      = ''
      let positions   = ''
      let species     = ''
      let resource    = ddResource
      let rangeType   = ddRangeType
      let regions     = ''
      let releaseYear = ''

      // Apply Meraki fields as initial values (wiki overrides below if present)
      if (merakiChamp) {
        // resource: "ENERGY" → "Energy", "NONE" → "None"
        if (merakiChamp.resource) {
          resource = toTitleCase(merakiChamp.resource)
        }

        // range_type: "MELEE" → "Melee", "RANGED" → "Ranged"
        if (merakiChamp.attackType) {
          rangeType = toTitleCase(merakiChamp.attackType)
        }

        // positions: ["TOP","JUNGLE"] → "Top, Jungle"; "BOTTOM" → "Bot"
        if (merakiChamp.positions?.length) {
          positions = merakiChamp.positions
            .map((p: string) => {
              const norm = p.toUpperCase()
              if (norm === 'BOTTOM') return 'Bot'
              return toTitleCase(p)
            })
            .join(', ')
        }

        // release_year: "2011-12-14" → "2011"
        if (merakiChamp.releaseDate) {
          releaseYear = merakiChamp.releaseDate.slice(0, 4)
        }

        // regions: normalize slug from faction field or regions array
        const factionSlug = merakiChamp.faction ?? (merakiChamp.regions?.[0] ?? '')
        if (factionSlug) {
          regions = normalizeFaction(factionSlug)
        }
      }

      try {
        // Fetch lore page and game page in parallel
        const [loreHtml, gameHtml] = await Promise.all([
          getWikiPageHtml('leagueoflegends.fandom.com', name),
          getWikiPageHtml('leagueoflegends.fandom.com', `${name}/LoL`),
        ])
        const lore = extractInfobox(loreHtml)
        const game = extractInfobox(gameHtml)

        // Gender: derive from pronoun field on lore page
        const pronoun = (lore['pronoun'] ?? '').toLowerCase()
        if      (pronoun.includes('she'))  gender = 'Female'
        else if (pronoun.includes('he'))   gender = 'Male'
        else if (pronoun.includes('they')) gender = 'Other'
        else if (pronoun.includes('it'))   gender = 'Other'

        // Species: already comma-separated by extractInfobox, just normalize spacing
        species = (lore['species'] ?? lore['race'] ?? '')
          .split(',').map((s: string) => s.trim()).filter(Boolean).join(', ')

        // Regions: wiki overrides Meraki if present
        const wikiRegions = (lore['region'] ?? lore['regions'] ?? lore['faction'] ?? '')
          .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
          .replace(/\s*\n\s*/g, ', ')
          .trim()
        if (wikiRegions) regions = wikiRegions

        // Positions: wiki overrides Meraki if present (space-separated words "Top Middle Bottom")
        const rawPos = game['position'] ?? game['positions'] ?? ''
        if (rawPos.trim()) positions = rawPos.trim().replace(/\s+/g, ', ')

        // Resource + Range type: wiki overrides Meraki, which already overrides DD
        if (game['resource'])  resource  = game['resource']
        if (game['rangetype']) rangeType = game['rangetype']

        // Release year: wiki overrides Meraki if present
        const rel = game['release'] ?? game['date'] ?? ''
        const wikiYear = rel.match(/\d{4}/)?.[0] ?? ''
        if (wikiYear) releaseYear = wikiYear
      } catch (wikiErr) { console.error(`LoL wiki error (${name}):`, wikiErr) }

      // Attributes stored in display order (matches LoLdle column order)
      const attributes: Record<string, unknown> = {
        gender,
        positions,
        species,
        resource,
        range_type:   rangeType,
        regions,
        release_year: releaseYear,
      }

      const skins = ((champ.skins ?? []) as Array<{ num: number; name: string }>)
        .map(s => ({ num: s.num, name: s.num === 0 ? `${name} Default` : s.name }))
        .filter(s => !s.name.includes('('))  // exclude chromas — no splash art in ddragon

      // Fetch in-game quotes from the LoL wiki Audio page ({Name}/LoL/Audio)
      let quotes: string[] = []
      try {
        const quotesHtml = await getWikiPageHtml('leagueoflegends.fandom.com', `${name}/LoL/Audio`)
        const qRoot      = parse(quotesHtml)
        const nameLower  = name.toLowerCase()

        for (const li of qRoot.querySelectorAll('li')) {
          // Each li text looks like: 'Link▶️\u00a0\u00a0 "Quote text here."'
          // Extract only the text inside straight double-quotes
          const raw = li.text.replace(/\u00a0/g, ' ')
          const match = raw.match(/"([^"]{10,200})"/)
          if (!match) continue
          const text = match[1].replace(/\s+/g, ' ').trim()

          if (
            !text.toLowerCase().includes(nameLower) &&
            !text.startsWith('(')
          ) {
            quotes.push(text)
          }
        }

        // Deduplicate
        quotes = [...new Set(quotes)].slice(0, 40)
      } catch { /* non-fatal — champion will just have no quotes pool */ }

      await upsertCharacter(themeId, name, splashUrl, attributes, { splash_url: splashUrl, key, quotes, skins })
      count++
      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      console.error(`LoL error (${key}):`, err)
    }
  }

  return { count, nextOffset: offset + chunkSize }
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
      sex:            'genero',
      gender:         'genero',
      affiliation:    'afiliacao',
      kekkei_genkai:  'kekkei_genkai',
      nature_type:    'nature_types',
      classification: '_class_raw',   // split below into jutsu_types + classification
      clan:           'cla',
      debut_arc:      'debut_arc',
      appears_in:     '_appears_in',  // used for manga/anime filter only, not stored as attr
    },
  },
  onepiece: {
    host:     'onepiece.fandom.com',
    category: 'Male Characters',  // Female Characters handled in separate pass
    attributeMap: {
      affiliation: 'afiliacao', devil_fruit: 'fruta_do_diabo',
      bounty: 'recompensa', haki: 'haki',
      species: 'raca', origin: 'ilha_natal', gender: 'genero',
      occupation: 'ocupacao', status: 'status',
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
    category: 'Playable Characters',
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
    category: 'Large Monsters',
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

// ─── Naruto: Dattebayo API + arc lookup ──────────────────────────────────────

async function fetchDattebayo(name: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `https://dattebayo-api.onrender.com/characters?name=${encodeURIComponent(name)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GuessleBot/1.0' },
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data  = await res.json() as { characters?: Array<Record<string, unknown>> }
    const chars = data.characters ?? []
    if (!chars.length) return null
    return chars.find(c => String(c.name ?? '').toLowerCase() === name.toLowerCase()) ?? null
  } catch { return null }
}

type ArcRange = [number, number, string]  // [from, to, name]

const NARUTO_CH_ARCS: ArcRange[] = [
  [4,   33,  'Land of Waves'],
  [34,  115, 'Chunin Exams'],
  [116, 138, 'Konoha Crush'],
  [139, 171, 'Search for Tsunade'],
  [172, 238, 'Sasuke Recovery'],
]
const SHIPPUDEN_CH_ARCS: ArcRange[] = [
  [1,   32,  'Kazekage Rescue'],
  [33,  53,  'Tenchi Bridge'],
  [72,  88,  'Akatsuki Suppression'],
  [113, 151, 'Itachi Pursuit'],
  [152, 175, "Pain's Assault"],
  [197, 214, 'Five Kage Summit'],
  [215, 700, 'Fourth Shinobi World War'],
]
const NARUTO_EP_ARCS: ArcRange[] = [
  [6,   19,  'Land of Waves'],
  [20,  67,  'Chunin Exams'],
  [68,  80,  'Konoha Crush'],
  [81,  100, 'Search for Tsunade'],
  [107, 135, 'Sasuke Recovery'],
]
const SHIPPUDEN_EP_ARCS: ArcRange[] = [
  [1,   32,  'Kazekage Rescue'],
  [33,  53,  'Tenchi Bridge'],
  [72,  88,  'Akatsuki Suppression'],
  [113, 151, 'Itachi Pursuit'],
  [152, 175, "Pain's Assault"],
  [197, 214, 'Five Kage Summit'],
  [215, 500, 'Fourth Shinobi World War'],
]

function arcFromDebut(manga: string | null, anime: string | null): string {
  for (const [raw, isChapter] of [[manga, true], [anime, false]] as const) {
    if (!raw) continue
    const isShippuden = /shipp/i.test(raw)
    const m = raw.match(/#(\d+)/)
    if (!m) continue
    const n     = parseInt(m[1], 10)
    const table = isChapter
      ? (isShippuden ? SHIPPUDEN_CH_ARCS : NARUTO_CH_ARCS)
      : (isShippuden ? SHIPPUDEN_EP_ARCS : NARUTO_EP_ARCS)
    for (const [from, to, name] of table) if (n >= from && n <= to) return name
    return isShippuden ? 'Part II' : 'Part I'
  }
  return ''
}

// ─────────────────────────────────────────────────────────────────────────────

async function refreshWikiUniverse(slug: string, themeId: number, cmcontinue = '', chunkSize = 50): Promise<{ count: number; nextOffset: string | null }> {
  const config = WIKI_CONFIGS[slug]
  if (!config) throw new Error(`No wiki config for ${slug}`)

  const { titles, nextOffset } = await getWikiCategoryMembers(config.host, config.category, chunkSize, cmcontinue)
  let count = 0

  async function processTitle(title: string): Promise<void> {
    try {
      // Skip variant/alternate-form pages — "(Part II)", "(Boruto)", "(Game)", etc.
      if (slug === 'naruto' && title.includes(' (')) {
        await supabase.from('characters').upsert(
          { theme_id: themeId, name: title, active: false },
          { onConflict: 'theme_id,name' }
        )
        return
      }

      // Fetch wiki + Dattebayo in parallel for Naruto
      const [html, dattebayo] = await Promise.all([
        getWikiPageHtml(config.host, title),
        slug === 'naruto' ? fetchDattebayo(title) : Promise.resolve(null),
      ])

      const infobox = extractInfobox(html)

      if (!Object.keys(infobox).length) return

      const attributes: Record<string, unknown> = {}
      for (const [infoboxKey, attrKey] of Object.entries(config.attributeMap)) {
        const val = infobox[infoboxKey]
        if (val) attributes[attrKey] = val
      }

      const pageRoot = parse(html)
      // Skip SVG placeholders — find first real raster image inside infobox
      const allImgs  = pageRoot.querySelectorAll('.infobox img, .pi-image-thumbnail, .pi-image img, figure img')
      let imageUrl: string | null = null
      for (const el of allImgs) {
        const src = el.getAttribute('src') ?? ''
        if (/\.(png|jpg|jpeg|webp)/i.test(src)) { imageUrl = src; break }
      }

      const extra: Record<string, unknown> = {}

      // ── Naruto-specific post-processing ──────────────────────────────────
      let active = true
      if (slug === 'naruto') {
        // ── Dattebayo merge (fills/overrides wiki values) ─────────────────
        let debutManga: string | null = null
        let debutAnime: string | null = null
        if (dattebayo) {
          const p = (dattebayo.personal ?? {}) as Record<string, unknown>

          if (p.sex)
            attributes['genero'] = p.sex

          const aff = Array.isArray(p.affiliation)
            ? (p.affiliation as unknown[]).flat()[0]
            : p.affiliation
          if (aff) attributes['afiliacao'] = String(aff)

          const clan = Array.isArray(p.clan) ? (p.clan as string[])[0] : p.clan
          if (clan) attributes['cla'] = String(clan)

          const kkg = p.kekkeiGenkai
          if (kkg) attributes['kekkei_genkai'] = Array.isArray(kkg)
            ? (kkg as string[]).join(', ')
            : String(kkg)

          const cl = p.classification
          if (cl) {
            const items = (Array.isArray(cl) ? cl as string[] : [String(cl)])
              .map(s => s.replace(/\s*\(.*?\)/g, '').trim())
              .filter(Boolean)
            if (items.length) attributes['_class_raw'] = items.join(', ')
          }

          const nt = dattebayo.natureType as string[] | undefined
          if (nt?.length) {
            const natures = nt
              .map(t => t.replace(/\s*\(.*?\)/g, '').trim())
              .filter(Boolean)
            if (natures.length) attributes['nature_types'] = natures.join(', ')
          }

          const debut = (dattebayo.debut ?? {}) as Record<string, string>
          debutManga = debut.manga ?? null
          debutAnime = debut.anime ?? null
        }

        // debut_arc: wiki infobox wins; Dattebayo-derived fallback
        if (!attributes['debut_arc']) {
          const arc = arcFromDebut(debutManga, debutAnime)
          if (arc) attributes['debut_arc'] = arc
        }

        // Filter: only keep characters that appear in Manga or Anime
        const appearsIn = String(attributes['_appears_in'] ?? '').toLowerCase()
        if (appearsIn && !appearsIn.includes('manga') && !appearsIn.includes('anime')) {
          active = false
        }
        delete attributes['_appears_in']

        // Affiliations: keep only the first village/org (split by comma or space+capital)
        if (attributes['afiliacao']) {
          const raw     = String(attributes['afiliacao'])
          const byComma = raw.split(/,\s*/).filter(Boolean)
          if (byComma.length > 1) {
            attributes['afiliacao'] = byComma[0].trim()
          } else {
            attributes['afiliacao'] = raw.split(/\s+(?=[A-Z])/)[0].trim()
          }
        }

        // Split _class_raw: items containing 'jutsu' → jutsu_types; rest → classification
        const rawClass = (attributes['_class_raw'] as string) ?? ''
        if (rawClass) {
          const items    = rawClass.split(',').map((s: string) => s.trim()).filter(Boolean)
          const jutsuT   = items.filter((s: string) => s.toLowerCase().includes('jutsu'))
          const charAttr = items.filter((s: string) => !s.toLowerCase().includes('jutsu'))
          if (jutsuT.length)   attributes['jutsu_types']    = jutsuT.join(', ')
          if (charAttr.length) attributes['classification'] = charAttr.join(', ')
          delete attributes['_class_raw']
        }

        // Extract Nature Types and Jutsu from collapsible cellbox sections
        const cellboxes = pageRoot.querySelectorAll('table.cellbox')
        let natureCb: typeof cellboxes[0] | null = null
        let jutsuCb:  typeof cellboxes[0] | null = null
        for (const tb of cellboxes) {
          const label = tb.querySelector('th')?.text.trim()
          if (label === 'Nature Type') natureCb = tb
          if (label === 'Jutsu')       jutsuCb  = tb
        }

        if (natureCb && !attributes['nature_types']) {
          const natures: string[] = []
          for (const a of natureCb.querySelectorAll('a')) {
            const t = a.getAttribute('title') ?? ''
            if (t && !natures.includes(t)) natures.push(t)
          }
          if (natures.length) attributes['nature_types'] = natures.join(', ')
        }

        // Collect ALL jutsus; keep first for backwards-compat jutsu_name
        const allJutsus: string[] = []
        if (jutsuCb) {
          for (const a of jutsuCb.querySelectorAll('a')) {
            const t = a.getAttribute('title') ?? ''
            if (t && t.length > 3 && !allJutsus.includes(t)) allJutsus.push(t)
          }
        }
        const firstJutsu = allJutsus[0] ?? null
        if (allJutsus.length) extra['jutsus'] = allJutsus

        if (firstJutsu) {
          try {
            const jHtml = await getWikiPageHtml(config.host, firstJutsu)
            const jRoot = parse(jHtml)
            let jGifUrl: string | null = null
            let jImgUrl: string | null = null
            // Prioritize GIF (animated jutsu) over static image
            for (const el of jRoot.querySelectorAll('.infobox img, .pi-image-thumbnail, .pi-image img, figure img, img')) {
              const src = (el.getAttribute('src') ?? el.getAttribute('data-src') ?? '')
              if (/\.gif/i.test(src) && !jGifUrl) { jGifUrl = src }
              else if (/\.(png|jpg|jpeg|webp)/i.test(src) && !jImgUrl) { jImgUrl = src }
              if (jGifUrl && jImgUrl) break
            }
            // Also check <a href> links to File:.gif (wiki file links)
            if (!jGifUrl) {
              for (const el of jRoot.querySelectorAll('a[href*=".gif"], a[href*="File:"]')) {
                const href = el.getAttribute('href') ?? ''
                if (/\.gif/i.test(href)) { jGifUrl = href; break }
              }
            }
            if (jGifUrl)  extra['jutsu_video_url'] = jGifUrl  // store GIF as video_url for JutsuMode
            if (jImgUrl)  extra['jutsu_image_url'] = jImgUrl
            extra['jutsu_name'] = firstJutsu
          } catch { /* non-fatal */ }
        }

        // Fetch quotes — try /Quotes page first, then blockquotes on main page
        let quotes: string[] = []
        const quoteRegex = /[\u201c"\u00ab]([^\u201d"\u00bb]{15,250})[\u201d"\u00bb]/
        const extractQuotes = (root: ReturnType<typeof parse>) => {
          for (const el of root.querySelectorAll('blockquote, .quote-content, .cited-quote, p, li')) {
            const text  = el.text.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim()
            const match = text.match(quoteRegex)
            if (match) quotes.push(match[1].trim())
          }
        }
        try {
          const qHtml = await getWikiPageHtml(config.host, `${title}/Quotes`)
          extractQuotes(parse(qHtml))
        } catch { /* /Quotes page may not exist — fall through */ }
        if (quotes.length === 0) {
          try { extractQuotes(pageRoot) } catch { /* non-fatal */ }
        }
        quotes = [...new Set(quotes)].slice(0, 20)
        extra['quotes'] = quotes
      }

      await upsertCharacter(themeId, title, imageUrl, attributes, extra, active)
      count++
    } catch (err) {
      console.error(`Wiki error (${slug}/${title}):`, err)
    }
  }

  // Process 5 characters in parallel; 200ms pause between batches
  const BATCH = 5
  for (let i = 0; i < titles.length; i += BATCH) {
    await Promise.allSettled(titles.slice(i, i + BATCH).map(processTitle))
    if (i + BATCH < titles.length) await new Promise(r => setTimeout(r, 200))
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
    const { count, nextOffset } = await refreshLoL(themeId, body.offset ?? 0, body.chunkSize ?? 5)
    return { result: `ok: ${count} upserted`, nextOffset }
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
