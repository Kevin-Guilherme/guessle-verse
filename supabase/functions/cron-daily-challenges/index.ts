import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IGDB_CLIENT_ID    = Deno.env.get('IGDB_CLIENT_ID') ?? ''
const IGDB_CLIENT_SECRET = Deno.env.get('IGDB_CLIENT_SECRET') ?? ''
const RIOT_VERSION_URL  = 'https://ddragon.leagueoflegends.com/api/versions.json'
const LOOKBACK_DAYS     = 60

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const UGG_GQL = 'https://u.gg/api'
const UGG_HDR = { 'Content-Type': 'application/json', 'Origin': 'https://u.gg', 'User-Agent': 'Mozilla/5.0' }

// ─── helpers ───────────────────────────────────────────────────────────────

/** Derive the 18-level skill sequence from a max-priority list like ["E","Q","W"] */
function generateSkillSequence(priority: string[]): string[] {
  const skills = priority.filter(s => ['Q', 'W', 'E'].includes(s))
  if (skills.length < 2) return []
  const [s1, s2, s3 = skills[2] ?? 'W'] = skills
  const counts: Record<string, number> = { Q: 0, W: 0, E: 0, R: 0 }
  const rLevels = new Set([6, 11, 16])
  const seq: string[] = []
  for (let lvl = 1; lvl <= 18; lvl++) {
    if (rLevels.has(lvl)) {
      seq.push('R'); counts.R++
    } else if (lvl <= 3) {
      const sk = skills[lvl - 1] ?? s1; seq.push(sk); counts[sk]++
    } else {
      const sk = counts[s1] < 5 ? s1 : counts[s2] < 5 ? s2 : s3
      seq.push(sk); counts[sk]++
    }
  }
  return seq
}

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

// ─── OP.GG MCP build fetcher ─────────────────────────────────────────────────

/** Split a string by commas at depth 0 (respecting parens, brackets, and double-quoted strings) */
function _splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0; let inStr = false; let cur = ''
  for (const ch of s) {
    if (inStr) { cur += ch; if (ch === '"') inStr = false }
    else if (ch === '"') { inStr = true; cur += ch }
    else if (ch === '(' || ch === '[') { depth++; cur += ch }
    else if (ch === ')' || ch === ']') { depth--; cur += ch }
    else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = '' }
    else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

/** Parse a StarterItems(ids, names, ...) or Boots(ids, names, ...) token from the OP.GG DSL */
function _parseOpggItem(s: string): { ids: number[]; names: string[] } | null {
  s = s.trim()
  const prefix = s.startsWith('StarterItems(') ? 'StarterItems(' : s.startsWith('Boots(') ? 'Boots(' : null
  if (!prefix) return null
  const inner = s.slice(prefix.length, s.lastIndexOf(')'))
  const args = _splitTopLevel(inner)
  if (args.length < 2) return null
  try {
    return { ids: JSON.parse(args[0]) as number[], names: JSON.parse(args[1]) as string[] }
  } catch { return null }
}

/**
 * Fetch ranked build data from the OP.GG MCP.
 * Returns canonical build: boots(1) + core(2-3) + fourth(1) + last(1) = max 6 items.
 * Fixes two bugs from the old U.GG approach:
 *   - Duplicate boots: boots field is separate, never merged with core items
 *   - Random items:    data comes from ranked meta, not pro play
 */
async function fetchOpggBuild(
  champName: string,
  lane: string,
  version: string,
  ddRunes: Array<{ slots: Array<{ runes: Array<{ id: number; name: string; icon: string }> }> }>,
): Promise<{ items: string[]; runeUrl: string | null; skillOrder: string[] }> {
  const empty = { items: [] as string[], runeUrl: null, skillOrder: [] as string[] }
  const opggChamp = champName.replace(/'/g, '').replace(/[\s.]+/g, '_').replace(/[^A-Z_0-9]/gi, '').toUpperCase()
  const _laneNorm = lane.toLowerCase()
  const _LANE_MAP: Record<string, string> = { bottom: 'adc', middle: 'mid', top: 'top', jungle: 'jungle', support: 'support' }
  const opggPos   = _LANE_MAP[_laneNorm] ?? (_laneNorm || 'mid')
  const OPGG_MCP  = 'https://mcp-api.op.gg/mcp'

  try {
    // Initialize MCP session (stateless per-request protocol)
    await fetch(OPGG_MCP, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'guessle', version: '1.0.0' } } }),
    })
    await fetch(OPGG_MCP, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'notifications/initialized' }),
    })

    // Call lol_get_champion_analysis
    const toolRes = await fetch(OPGG_MCP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: {
          name: 'lol_get_champion_analysis',
          arguments: {
            game_mode: 'ranked', champion: opggChamp, position: opggPos,
            desired_output_fields: [
              'data.boots.{ids[],ids_names[],pick_rate,play,win}',
              'data.core_items.{ids[],ids_names[],pick_rate,play,win}',
              'data.fourth_items[].{ids[],ids_names[],pick_rate,play,win}',
              'data.last_items[].{ids[],ids_names[],pick_rate,play,win}',
              'data.runes.{primary_rune_names[],pick_rate,play,win}',
              'data.skills.{order[],pick_rate,play,win}',
            ],
          },
        },
      }),
    })
    if (!toolRes.ok) return empty

    // Parse response — can be JSON or SSE
    let dsl = ''
    const ct = toolRes.headers.get('content-type') ?? ''
    if (ct.includes('text/event-stream')) {
      const text = await toolRes.text()
      const last = text.split('\n').filter(l => l.startsWith('data: ')).at(-1)?.slice(6)
      if (last) {
        const j = JSON.parse(last) as { result?: { content?: Array<{ text?: string }> } }
        dsl = j.result?.content?.[0]?.text ?? ''
      }
    } else {
      const j = await toolRes.json() as { result?: { content?: Array<{ text?: string }> } }
      dsl = j.result?.content?.[0]?.text ?? ''
    }
    if (!dsl) return empty

    // Extract inner content of LolGetChampionAnalysis(Data(...))
    const prefix = 'LolGetChampionAnalysis(Data('
    const dataIdx = dsl.indexOf(prefix)
    if (dataIdx === -1) return empty
    let parenDepth = 1; let innerEnd = dataIdx + prefix.length
    for (let i = innerEnd; i < dsl.length; i++) {
      if (dsl[i] === '(') parenDepth++
      else if (dsl[i] === ')') { parenDepth--; if (parenDepth === 0) { innerEnd = i; break } }
    }
    // OP.GG DSL has two possible formats:
    //   New compact (6 parts): [boots, core, fourth[], last[], Runes(...), Skills(...)]
    //   Old verbose (9 parts): [starter, boots, core, fourth[], fifth[], sixth[], last[], Runes(...), Skills(...)]
    // Detect by checking whether parts[0] is an item token (new) or parts[1] is (old).
    const parts = _splitTopLevel(dsl.slice(dataIdx + prefix.length, innerEnd).trim())

    const parseArr = (s: string) => {
      s = s.trim()
      if (!s.startsWith('[')) return [] as Array<{ ids: number[]; names: string[] }>
      return _splitTopLevel(s.slice(1, s.lastIndexOf(']')).trim())
        .map(_parseOpggItem).filter((x): x is { ids: number[]; names: string[] } => x !== null)
    }

    let boots: { ids: number[]; names: string[] } | null
    let core:  { ids: number[]; names: string[] } | null
    let extraSlots: Array<{ ids: number[]; names: string[] }>[]
    let runesPartIdx: number
    let skillsPartIdx: number

    if (parts.length <= 7) {
      // New compact format: boots, core, fourth[], last[], Runes, Skills
      boots      = parts.length > 0 ? _parseOpggItem(parts[0]) : null
      core       = parts.length > 1 ? _parseOpggItem(parts[1]) : null
      extraSlots = [parseArr(parts[2] ?? ''), parseArr(parts[3] ?? '')]
      runesPartIdx  = 4
      skillsPartIdx = 5
    } else {
      // Old verbose format: starter, boots, core, fourth[], fifth[], sixth[], last[], Runes, Skills
      boots      = parts.length > 1 ? _parseOpggItem(parts[1]) : null
      core       = parts.length > 2 ? _parseOpggItem(parts[2]) : null
      extraSlots = [parseArr(parts[3] ?? ''), parseArr(parts[4] ?? ''), parseArr(parts[5] ?? ''), parseArr(parts[6] ?? '')]
      runesPartIdx  = 7
      skillsPartIdx = 8
    }

    // Build canonical 6-item list: boots → core → extra slots (with fallbacks).
    // Dedup across all slots; if a slot's top pick is already present, try the next option.
    const seen = new Set<number>()
    const ids: number[] = []
    const addId = (id: number) => { if (id && !seen.has(id)) { seen.add(id); ids.push(id) } }

    if (boots) addId(boots.ids[0])
    if (core)  core.ids.forEach(addId)

    // Iterate all options across extra slots in round-robin until we have 6
    const maxOpts = Math.max(...extraSlots.map(s => s.length), 0)
    for (let optIdx = 0; optIdx < maxOpts && ids.length < 6; optIdx++) {
      for (const slot of extraSlots) {
        if (ids.length >= 6) break
        const opt = slot[optIdx]
        if (opt) addId(opt.ids[0])
      }
    }

    const items = ids.slice(0, 6).map(id => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`)

    // Keystone rune — look up icon by name in DDragon runesReforged.json
    // New format: Runes(["Keystone",...], ...) — keystone is runesArgs[0][0]
    // Old format: Runes("PrimaryPage", ["Keystone",...], ...) — keystone is runesArgs[1][0]
    let runeUrl: string | null = null
    const runesPart = parts[runesPartIdx] ?? ''
    if (runesPart.startsWith('Runes(')) {
      const runesInner = runesPart.slice('Runes('.length, runesPart.lastIndexOf(')')).trim()
      const runesArgs  = _splitTopLevel(runesInner)
      // Try first array arg, fall back to second (old format)
      for (const argIdx of [0, 1]) {
        if ((runesArgs[argIdx] ?? '').startsWith('[')) {
          try {
            const primaryRunes = JSON.parse(runesArgs[argIdx]) as string[]
            const keystone = primaryRunes[0]
            if (keystone) {
              runeFind: for (const tree of ddRunes) {
                for (const slot of tree.slots) {
                  for (const rune of slot.runes) {
                    if (rune.name?.toLowerCase() === keystone.toLowerCase()) {
                      runeUrl = `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`
                      break runeFind
                    }
                  }
                }
              }
            }
          } catch { /* ignore */ }
          break
        }
      }
    }

    // Skill order from Skills(["Q","W","E",...], ...)
    let skillOrder: string[] = []
    const skillsPart = parts[skillsPartIdx] ?? ''
    if (skillsPart.startsWith('Skills(')) {
      const skillsInner = skillsPart.slice('Skills('.length, skillsPart.lastIndexOf(')')).trim()
      const skillsArgs  = _splitTopLevel(skillsInner)
      if (skillsArgs.length > 0) {
        try { skillOrder = JSON.parse(skillsArgs[0]) as string[] } catch { /* ignore */ }
      }
    }

    return { items, runeUrl, skillOrder }
  } catch { return empty }
}

// ─── LoL fetcher ────────────────────────────────────────────────────────────

async function fetchLoL(themeId: number, mode: string, today: string): Promise<string> {
  const recent = await getRecentNames(themeId, mode)

  const { data: candidates } = await supabase
    .from('characters')
    .select('id, name, attributes, extra, image_url')
    .eq('theme_id', themeId)
    .eq('active', true)

  const pool = (candidates ?? []).filter((c: { name: string }) => !recent.has(c.name))
  if (!pool.length) return 'skipped: no candidates'

  type ChampRow = { id: number; name: string; attributes: Record<string, unknown>; extra: Record<string, unknown>; image_url: string | null }

  // For build mode: pick 4 distinct champions for the quest campaign
  const shuffledPool = [...pool].sort(() => Math.random() - 0.5) as ChampRow[]
  const questPicks: ChampRow[] = mode === 'build' ? shuffledPool.slice(0, 4) : []

  const pick = (mode === 'build' ? questPicks[0] : shuffledPool[0]) as ChampRow

  // Fetch Data Dragon data
  let splashUrl:      string | null = null
  let splashSkinName: string | null = null
  let abilities:  Array<{ slot: string; name: string; icon_url: string }> = []
  let buildItems:      string[] = []
  let buildSkillOrder: string[] = []
  let buildRuneUrl:    string | null = null
  let buildLane        = ''
  let selectedQuote: string | undefined
  try {
    const versRes = await fetch(RIOT_VERSION_URL)
    const versions: string[] = await versRes.json()
    const version = versions[0]
    const key = (pick.extra.key as string) ?? (pick.attributes.key as string) ?? pick.name.replace(/[^a-zA-Z]/g, '')
    splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`

    if (['ability', 'build', 'splash', 'skill-order', 'quote'].includes(mode)) {
      const champRes  = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${key}.json`)
      const champData = await champRes.json() as {
        data: Record<string, {
          passive:     { name: string; image: { full: string } }
          spells:      Array<{ name: string; image: { full: string } }>
          skins:       Array<{ num: number; name: string }>
          tags:        string[]
          recommended: Array<{ map: string; blocks: Array<{ type: string; items: Array<{ id: string; count: number }> }> }>
        }>
      }
      const champ = champData.data[key]
      if (champ) {
        if (mode === 'splash') {
          const allSkins = ((champ.skins ?? []) as Array<{ num: number; name: string }>)
          const nonDefaultSkins = allSkins.filter(s => s.num > 0).sort(() => Math.random() - 0.5)
          let pickedNum  = 0
          let pickedName = `${pick.name} Default`
          for (const skin of nonDefaultSkins) {
            const testUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_${skin.num}.jpg`
            try {
              const testRes = await fetch(testUrl, { method: 'HEAD' })
              if (testRes.ok) { pickedNum = skin.num; pickedName = skin.name; break }
            } catch { /* skip */ }
          }
          splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_${pickedNum}.jpg`
          splashSkinName = pickedName
        }

        if (mode === 'ability') {
          abilities = [
            { slot: 'Passive', name: champ.passive.name, icon_url: `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${champ.passive.image.full}` },
            ...champ.spells.map((s, i) => ({
              slot: ['Q', 'W', 'E', 'R'][i],
              name: s.name,
              icon_url: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${s.image.full}`,
            })),
          ]
        }

        if (mode === 'quote') {
          // Fetch real champion quotes from LoL wiki (/LoL/Audio, fallback /Quotes)
          try {
            const champKey = (pick.extra?.key as string) ?? pick.name
            for (const wikiPage of [`${champKey}/LoL/Audio`, `${champKey}/Quotes`]) {
              const wikiRes = await fetch(
                `https://leagueoflegends.fandom.com/api.php?action=parse&page=${encodeURIComponent(wikiPage)}&prop=wikitext&format=json`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
              )
              const wikiData = await wikiRes.json() as { parse?: { wikitext?: { '*': string } } }
              const wikitext: string = wikiData?.parse?.wikitext?.['*'] ?? ''
              if (!wikitext) continue
              const allQuotes = [...wikitext.matchAll(/''\"(.+?)\"''/g)].map((m: RegExpMatchArray) => m[1])
              const filtered = allQuotes.filter((q: string) => !q.toLowerCase().includes(pick.name.toLowerCase()))
              if (filtered.length > 0) {
                selectedQuote = filtered[Math.floor(Math.random() * filtered.length)]
                break
              }
            }
          } catch (_) { /* fallback to pick.extra?.quotes below */ }
        }

        if (mode === 'build' || mode === 'skill-order') {
          // ── OP.GG MCP build data (ranked meta, boots/core separated) ──────
          // Fixes: (1) duplicate boots — boots field is separate from core items
          //        (2) random items — data is from ranked games, not pro play
          const runesJsonRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`)
          const ddRunes = runesJsonRes.ok
            ? await runesJsonRes.json() as Array<{ slots: Array<{ runes: Array<{ id: number; name: string; icon: string }> }> }>
            : []
          const pLane = String((pick.attributes as Record<string, unknown>).positions ?? '').split(',')[0].trim()
          const firstData = await fetchOpggBuild(pick.name, pLane, version, ddRunes)
          buildItems = firstData.items; buildRuneUrl = firstData.runeUrl
          buildSkillOrder = firstData.skillOrder; buildLane = pLane
        }
      }
    }
  } catch { /* non-fatal */ }

  // For skill-order mode: require build data — skip champion if U.GG returned nothing
  if (mode === 'skill-order' && buildItems.length === 0) {
    return 'skipped: no build data for champion (try again)'
  }

  // Champion tile helpers (shared by build and skill-order)
  const tileUrl = (name: string, extraData: Record<string, unknown>) => {
    const k = (extraData?.key as string) ?? name.replace(/[^a-zA-Z]/g, '')
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${k}_0.jpg`
  }

  // Helper: generate same-lane options for a given pick
  const makeBuildOptions = (p: ChampRow, pLane: string): Array<{ name: string; image_url: string }> => {
    const pKey   = (p.extra.key as string) ?? p.name.replace(/[^a-zA-Z]/g, '')
    const pTile  = `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${pKey}_0.jpg`
    const lane   = pLane.toLowerCase()
    const sameLane = (candidates ?? []).filter((c: { name: string; attributes: Record<string, unknown> }) =>
      c.name !== p.name && String(c.attributes?.positions ?? '').toLowerCase().includes(lane)
    )
    const fillPool = (candidates ?? []).filter((c: { name: string }) =>
      c.name !== p.name && !sameLane.includes(c as never)
    )
    const wrongPool = sameLane.length >= 7 ? sameLane : [...sameLane, ...fillPool]
    const wrongs = wrongPool
      .sort(() => Math.random() - 0.5)
      .slice(0, 7)
      .map((c: { name: string; extra: Record<string, unknown> }) => ({ name: c.name, image_url: tileUrl(c.name, c.extra) }))
    return [{ name: p.name, image_url: pTile }, ...wrongs].sort(() => Math.random() - 0.5)
  }

  // Build mode: either 4-quest campaign or legacy single build
  type QuestData = { answer: string; build_items: string[]; build_lane: string; build_rune_url: string | null; build_skill_order: string[]; build_options: Array<{ name: string; image_url: string }> }
  let buildOptions: Array<{ name: string; image_url: string }> = []
  let buildQuests: QuestData[] = []

  if (mode === 'build' && questPicks.length >= 4) {
    // 4-quest campaign: fetch build data for picks 1-3 too
    // pick[0] data already in buildItems/buildRuneUrl/etc from above
    const quest1: QuestData = {
      answer: pick.name, build_items: buildItems, build_lane: buildLane,
      build_rune_url: buildRuneUrl, build_skill_order: buildSkillOrder,
      build_options: makeBuildOptions(pick, buildLane),
    }
    buildQuests = [quest1]

    // Fetch build data for quest picks 1-3 via OP.GG MCP
    try {
      const versRes2 = await fetch(RIOT_VERSION_URL)
      const version2 = ((await versRes2.json()) as string[])[0]
      const runesJsonRes2 = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version2}/data/en_US/runesReforged.json`)
      const ddRunes2 = runesJsonRes2.ok
        ? await runesJsonRes2.json() as Array<{ slots: Array<{ runes: Array<{ id: number; name: string; icon: string }> }> }>
        : []

      for (let qi = 1; qi < 4; qi++) {
        const qp    = questPicks[qi]
        const qLane = String((qp.attributes as Record<string, unknown>).positions ?? '').split(',')[0].trim()
        const qData = await fetchOpggBuild(qp.name, qLane, version2, ddRunes2)
        buildQuests.push({
          answer: qp.name, build_items: qData.items, build_lane: qLane,
          build_rune_url: qData.runeUrl, build_skill_order: qData.skillOrder,
          build_options: makeBuildOptions(qp, qLane),
        })
      }
    } catch { /* non-fatal — use partial quests */ }
  } else if (mode === 'build') {
    // Legacy single build (< 4 candidates)
    buildOptions = makeBuildOptions(pick, buildLane)
  }

  // Detective (skill-order) mode: pre-compute champion affinity by lane
  let championAffinity: Record<string, 'high' | 'low'> = {}
  if (mode === 'skill-order' && buildLane) {
    const targetLane = buildLane.toLowerCase()
    for (const c of (candidates ?? []) as Array<{ name: string; attributes: Record<string, unknown> }>) {
      const cLane = String(c.attributes?.positions ?? '').toLowerCase()
      championAffinity[c.name] = cLane.includes(targetLane) ? 'high' : 'low'
    }
  }

  // Fallback for quote mode if DDragon allytips weren't loaded (e.g. DDragon fetch failed)
  if (mode === 'quote' && !selectedQuote) {
    const pool = ((pick.extra?.quotes ?? []) as string[])
      .filter(q => !q.toLowerCase().includes(pick.name.toLowerCase()))
    if (pool.length > 0) selectedQuote = pool[Math.floor(Math.random() * pool.length)]
  }

  const extra = {
    ...pick.extra,
    quote: undefined,     // clear any stale singular quote from old scraper
    splash_url: splashUrl,
    ...(selectedQuote !== undefined ? { quote: selectedQuote } : {}),
    ...(splashSkinName ? { skin_name: splashSkinName } : {}),
    ...(abilities.length  ? { abilities } : {}),
    ...(buildItems.length ? {
      build_items:       buildItems,
      build_skill_order: buildSkillOrder,
      build_rune_url:    buildRuneUrl,
      build_lane:        buildLane,
    } : {}),
    ...(buildOptions.length ? { build_options: buildOptions } : {}),
    ...(buildQuests.length ? { quests: buildQuests } : {}),
    ...(Object.keys(championAffinity).length ? { build_champion_affinity: championAffinity } : {}),
  }

  // Name-guess modes: store { answer: name } instead of attribute table
  // Splash mode uses skin name as the answer
  const NAME_GUESS_MODES = ['ability', 'build', 'quote', 'skill-order']
  const attributes = (mode === 'build' && buildQuests.length > 0)
    ? {}
    : NAME_GUESS_MODES.includes(mode)
    ? { answer: pick.name }
    : mode === 'splash'
    ? { answer: pick.name }  // phase 1: guess champion; skin_name in extra is phase 2
    : pick.attributes

  await supabase.from('daily_challenges').insert({
    theme_id:     themeId,
    mode,
    date:         today,
    character_id: pick.id,
    name:         pick.name,
    image_url:    splashUrl,
    attributes,
    extra,
  })

  return `ok: ${pick.name}`
}

// ─── Naruto fetcher ─────────────────────────────────────────────────────────

async function fetchNaruto(themeId: number, mode: string, today: string): Promise<string> {
  const recent = await getRecentNames(themeId, mode)

  const { data: candidates } = await supabase
    .from('characters')
    .select('id, name, attributes, extra, image_url')
    .eq('theme_id', themeId)
    .eq('active', true)

  let pool = (candidates ?? []).filter((c: { name: string }) => !recent.has(c.name))

  // Mode-specific pool filters to avoid empty/broken challenges
  type CandRow = { name: string; image_url: string | null; extra: Record<string, unknown> }
  if (mode === 'eye') {
    pool = pool.filter((c: CandRow) => c.image_url && !/\.svg/i.test(c.image_url))
  } else if (mode === 'jutsu') {
    pool = pool.filter((c: CandRow) => !!c.extra?.jutsu_video_url)
  } else if (mode === 'quote') {
    // Prefer characters with pre-scraped quotes but don't hard-exclude others
    // (cron will try wiki fetch at runtime for those without quotes)
    const withQuotes = pool.filter((c: CandRow) => {
      const quotes = (c.extra?.quotes ?? []) as string[]
      return quotes.some((q: string) => !q.toLowerCase().includes(c.name.toLowerCase()))
    })
    if (withQuotes.length > 0) pool = withQuotes
  }

  if (!pool.length) return 'skipped: no candidates'

  const pick = pool[Math.floor(Math.random() * pool.length)] as {
    id: number; name: string; attributes: Record<string, unknown>
    extra: Record<string, unknown>; image_url: string | null
  }

  // classic → standardized 7-column grid; jutsu/quote/eye → name-guess mode
  const NAME_GUESS = ['jutsu', 'quote', 'eye']
  const NARUTO_CLASSIC_COLS = ['genero', 'afiliacao', 'jutsu_types', 'kekkei_genkai', 'nature_types', 'classification', 'debut_arc'] as const
  const attributes = NAME_GUESS.includes(mode)
    ? { answer: pick.name }
    : Object.fromEntries(
        NARUTO_CLASSIC_COLS.map(k => [k, (pick.attributes as Record<string, unknown>)[k] ?? 'None'])
      )

  let extra = { ...pick.extra }

  // quote: try fetching from Naruto wiki first, fall back to extra.quotes pool
  if (mode === 'quote') {
    type QuoteEntry = { text: string; saidToRaw: string | null }
    let selectedEntry: QuoteEntry | null = null

    try {
      const wikiName = pick.name.replace(/ /g, '_')
      for (const wikiPage of [`${wikiName}/Quotes`, wikiName]) {
        const wikiRes = await fetch(
          `https://naruto.fandom.com/api.php?action=parse&page=${encodeURIComponent(wikiPage)}&prop=wikitext&format=json`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
        )
        const wikiData = await wikiRes.json() as { parse?: { wikitext?: { '*': string } } }
        const wikitext = wikiData?.parse?.wikitext?.['*'] ?? ''
        if (!wikitext) continue

        const firstName = pick.name.split(' ')[0].toLowerCase()

        // Pass 1 — quotes that include "to [[CharName]]" context (same line or next line)
        // Handles: "text" — Attrib, to [[Name]] and "text"\n**— Attrib, to [[Name]]
        const withTo: QuoteEntry[] = []
        const toRegex = /[""]([^""]{20,300})[""][^\n]*(?:\n[^\n]*)?to \[\[([^\]|#\n]+)/g
        for (const m of wikitext.matchAll(toRegex)) {
          const text      = m[1].trim()
          const saidToRaw = m[2].trim()
          if (text.toLowerCase().includes(firstName)) continue
          if (text.length < 20 || text.length > 300)  continue
          withTo.push({ text, saidToRaw })
        }

        // Pass 2 — all quoted strings (no said_to context required)
        const plain: QuoteEntry[] = [
          ...[...wikitext.matchAll(/[""]([^""]{20,300})[""]|"([^"]{20,300})"/g)]
            .map(m => ({ text: (m[1] ?? m[2]).trim(), saidToRaw: null })),
          ...[...wikitext.matchAll(/\|\s*([^|=\n]{30,300}?)\s*(?:\||})/g)]
            .map(m => ({ text: m[1].trim(), saidToRaw: null }))
            .filter(e => /[.!?]$/.test(e.text)),
        ].filter(e =>
          !e.text.toLowerCase().includes(firstName) &&
          e.text.length >= 20 && e.text.length <= 300
        )

        // Prefer quotes with said_to context; fall back to plain
        const pool = withTo.length > 0 ? withTo : plain
        const unique = [...new Map(pool.map(e => [e.text, e])).values()]
        if (unique.length > 0) {
          selectedEntry = unique[Math.floor(Math.random() * unique.length)]
          break
        }
      }
    } catch { /* fall through to extra.quotes */ }

    // Fallback to stored quotes pool (no said_to available)
    if (!selectedEntry) {
      const pool = ((pick.extra?.quotes ?? []) as string[])
        .filter((q: string) => !q.toLowerCase().includes(pick.name.toLowerCase()))
      if (pool.length) {
        selectedEntry = { text: pool[Math.floor(Math.random() * pool.length)], saidToRaw: null }
      }
    }

    // Resolve said_to character name against DB
    let saidToName: string | null = null
    if (selectedEntry?.saidToRaw) {
      const rawName = selectedEntry.saidToRaw.trim()
      // Wiki links can be "First Last" or "First_Last" — normalise underscores
      const normName = rawName.replace(/_/g, ' ')
      const { data: saidToChar } = await supabase
        .from('characters')
        .select('name')
        .eq('theme_id', themeId)
        .ilike('name', `%${normName.split(' ')[0]}%`)
        .limit(5)
      // Pick the closest match (shortest name that starts with the first word)
      const match = (saidToChar ?? []).find(
        c => c.name.toLowerCase().startsWith(normName.split(' ')[0].toLowerCase())
      ) ?? saidToChar?.[0] ?? null
      if (match) saidToName = match.name
    }

    extra = {
      ...extra,
      quote: selectedEntry?.text ?? '',
      ...(saidToName ? { quote_said_to_name: saidToName } : {}),
    }
  }

  await supabase.from('daily_challenges').insert({
    theme_id:     themeId,
    mode,
    date:         today,
    character_id: pick.id,
    name:         pick.name,
    image_url:    pick.image_url,
    attributes,
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
  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)
  const { data: recentHashes } = await supabase
    .from('daily_challenges')
    .select('content_hash')
    .eq('theme_id', themeId)
    .eq('mode', mode)
    .not('content_hash', 'is', null)
    .gte('date', since.toISOString().split('T')[0])

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

// ─── Quadra Kill (NYT Connections style) ─────────────────────────────────────

const CURATED_GROUPS: Array<{
  type: 'lore' | 'type' | 'mechanic' | 'trick'
  category: string
  color: string
  champions: string[]
}> = [
  // LORE
  { type: 'lore', category: 'Campeões de Demacia',    color: 'green',  champions: ['Garen','Lux','Jarvan IV','Fiora','Poppy','Xin Zhao','Galio','Quinn','Sylas','Sona'] },
  { type: 'lore', category: 'Campeões de Noxus',      color: 'green',  champions: ['Darius','Draven','Katarina','Swain','Talon','Vladimir','Kled','Sion','Annie','Samira','Rell','Mordekaiser'] },
  { type: 'lore', category: 'Campeões de Freljord',   color: 'green',  champions: ['Ashe','Tryndamere','Anivia','Sejuani','Braum','Lissandra','Volibear','Udyr','Trundle'] },
  { type: 'lore', category: 'Campeões de Ionia',      color: 'green',  champions: ['Yasuo','Yone','Irelia','Karma','Kennen','Lee Sin','Master Yi','Shen','Wukong','Zed','Akali','Ahri','Jhin','Kayn'] },
  { type: 'lore', category: 'Campeões de Zaun',       color: 'green',  champions: ['Jinx','Vi','Ekko','Blitzcrank','Zeri','Singed','Twitch','Warwick','Janna','Urgot'] },
  { type: 'lore', category: 'Campeões de Piltover',   color: 'green',  champions: ['Caitlyn','Jayce','Viktor','Heimerdinger','Camille','Ezreal','Orianna'] },
  { type: 'lore', category: 'Ilhas das Sombras',      color: 'green',  champions: ['Thresh','Hecarim','Karthus','Kalista','Viego','Gwen','Senna','Maokai','Yorick'] },
  { type: 'lore', category: 'Campeões de Shurima',    color: 'green',  champions: ['Azir','Nasus','Renekton','Sivir','Taliyah','Amumu','Rammus','Xerath','Zilean','Akshan'] },
  { type: 'lore', category: 'Campeões de Bilgewater', color: 'green',  champions: ['Gangplank','Miss Fortune','Twisted Fate','Graves','Nautilus','Fizz','Illaoi','Pyke','Tahm Kench'] },
  { type: 'lore', category: 'Campeões do Void',       color: 'green',  champions: ["Cho'Gath","Kog'Maw","Vel'Koz","Kha'Zix","Rek'Sai","Bel'Veth",'Malzahar','Kassadin',"Kai'Sa"] },
  { type: 'lore', category: 'Campeões de Targon',     color: 'green',  champions: ['Pantheon','Diana','Leona','Taric','Soraka','Zoe','Aphelios','Aurelion Sol'] },
  // TYPE
  { type: 'type', category: 'Yordles',                color: 'yellow', champions: ['Teemo','Lulu','Tristana','Kennen','Corki','Rumble','Ziggs','Heimerdinger','Veigar','Kled','Poppy','Gnar','Yuumi'] },
  { type: 'type', category: 'Invocam Pets',           color: 'yellow', champions: ['Annie','Yorick','Malzahar','Zyra','Heimerdinger','Shaco','Elise','Azir'] },
  { type: 'type', category: 'Se Transformam',         color: 'yellow', champions: ['Nidalee','Jayce','Elise','Gnar','Kayn','Shyvana'] },
  // MECHANIC
  { type: 'mechanic', category: 'Podem Reviver',      color: 'blue',   champions: ['Anivia','Sion','Zac','Zilean'] },
  { type: 'mechanic', category: 'Reset de Abate',     color: 'blue',   champions: ['Katarina','Akali','Master Yi','Pyke','Viego','Aurora',"Bel'Veth"] },
  { type: 'mechanic', category: 'Ultimate Global',    color: 'blue',   champions: ['Shen','Soraka','Gangplank','Karthus','Senna','Ashe','Jinx','Ezreal','Draven'] },
  { type: 'mechanic', category: 'Têm Stealth',        color: 'blue',   champions: ['Twitch','Evelynn','Shaco','Akali','Rengar',"Kha'Zix",'Talon','Wukong','Teemo','Neeko'] },
  { type: 'mechanic', category: 'Não Usam Mana',      color: 'blue',   champions: ['Garen','Katarina','Riven','Zed','Aatrox','Tryndamere','Renekton','Shyvana','Gwen','Samira'] },
  { type: 'mechanic', category: 'Usam Energia',       color: 'blue',   champions: ['Zed','Shen','Akali','Kennen','Lee Sin'] },
  // TRICK
  { type: 'trick', category: 'Golens',                color: 'purple', champions: ['Malphite','Blitzcrank','Orianna','Galio','Nautilus','Maokai','Zac'] },
  { type: 'trick', category: 'Têm Gancho (Hook)',     color: 'purple', champions: ['Blitzcrank','Thresh','Nautilus','Pyke'] },
  { type: 'trick', category: 'Spell Shield',          color: 'purple', champions: ['Sivir','Morgana','Nocturne','Malzahar'] },
  { type: 'trick', category: 'Stacks Permanentes',    color: 'purple', champions: ["Cho'Gath",'Nasus','Senna','Thresh','Veigar'] },
]

async function fetchQuadraKill(themeId: number, today: string): Promise<string> {
  const { data: allChamps } = await supabase
    .from('characters')
    .select('id, name, attributes, extra, image_url')
    .eq('theme_id', themeId)
    .eq('active', true)

  const champs = (allChamps ?? []) as Array<{
    id: number; name: string
    attributes: Record<string, unknown>
    extra: Record<string, unknown>
    image_url: string | null
  }>
  if (champs.length < 16) return 'skipped: not enough champions'

  const champNames = new Set(champs.map(c => c.name))
  type GroupDef = { category: string; color: string; champions: string[] }

  // ── Step 0: Load categories used in the last 7 days (anti-repetition) ──
  const since7 = new Date()
  since7.setDate(since7.getDate() - 7)
  const { data: recentQuadras } = await supabase
    .from('daily_challenges')
    .select('attributes')
    .eq('theme_id', themeId)
    .eq('mode', 'quadra')
    .gte('date', since7.toISOString().split('T')[0])

  const recentCategories = new Set<string>()
  for (const row of (recentQuadras ?? []) as Array<{ attributes: { groups?: Array<{ category: string }> } }>) {
    for (const g of (row.attributes?.groups ?? [])) recentCategories.add(g.category)
  }

  // ── Step 1: Build curated groups (filtered to champions in DB) ──
  const curatedByType: Record<string, Array<{ category: string; color: string; champions: string[] }>> = {
    lore: [], type: [], mechanic: [], trick: [],
  }
  for (const g of CURATED_GROUPS) {
    const valid = g.champions.filter(n => champNames.has(n))
    if (valid.length >= 4) curatedByType[g.type].push({ category: g.category, color: g.color, champions: valid })
  }

  // ── Step 2: Pick 1 from each type bucket ensuring no champion overlap ──
  // When a group is chosen, ALL its original members are blacklisted (not just the 4 picked).
  // This prevents any champion from appearing in two different categories in the same puzzle.
  const usedNames = new Set<string>()
  const groups: GroupDef[] = []
  const typeOrder: Array<'lore' | 'type' | 'mechanic' | 'trick'> = ['lore', 'type', 'mechanic', 'trick']

  const tryPickFromPool = (
    pool: Array<{ category: string; color: string; champions: string[] }>,
    excludeRecent: boolean,
  ): GroupDef | null => {
    const candidates = (excludeRecent
      ? pool.filter(c => !recentCategories.has(c.category))
      : pool
    ).sort(() => Math.random() - 0.5)
    for (const candidate of candidates) {
      const available = candidate.champions.filter(n => !usedNames.has(n))
      if (available.length >= 4) {
        const chosen = available.sort(() => Math.random() - 0.5).slice(0, 4)
        // Block ALL members of this group (chosen + unchosen) from other categories.
        // If Yordles is chosen with 4 tiles, the remaining Yordles cannot appear
        // elsewhere in the puzzle — a player seeing 5 Yordles can't know which 4 are correct.
        candidate.champions.forEach(n => { if (champNames.has(n)) usedNames.add(n) })
        return { category: candidate.category, color: candidate.color, champions: chosen }
      }
    }
    return null
  }

  for (const t of typeOrder) {
    // Prefer categories not used in last 7 days; fall back to any if needed
    const group = tryPickFromPool(curatedByType[t], true) ?? tryPickFromPool(curatedByType[t], false)
    if (group) groups.push(group)
  }

  // ── Step 3: Fallback to attribute DIMS if curated < 4 ──
  if (groups.length < 4) {
    const DIMS = [
      { key: 'regions',    color: 'green',  label: (v: string) => `Campeões de ${v}`,  extract: (a: Record<string, unknown>) => String(a.regions    ?? '').split(',')[0].trim() },
      { key: 'species',    color: 'yellow', label: (v: string) => `${v}s`,             extract: (a: Record<string, unknown>) => String(a.species    ?? '').split(',')[0].trim() },
      { key: 'resource',   color: 'orange', label: (v: string) => `Usam ${v}`,         extract: (a: Record<string, unknown>) => String(a.resource   ?? '').trim() },
      { key: 'range_type', color: 'purple', label: (v: string) => `Tipo: ${v}`,        extract: (a: Record<string, unknown>) => String(a.range_type ?? '').trim() },
    ]
    for (const dim of DIMS) {
      if (groups.length >= 4) break
      const buckets = new Map<string, string[]>()
      for (const c of champs) {
        if (usedNames.has(c.name)) continue
        const val = dim.extract(c.attributes)
        if (!val) continue
        if (!buckets.has(val)) buckets.set(val, [])
        buckets.get(val)!.push(c.name)
      }
      const valid = [...buckets.entries()].filter(([, names]) => names.length >= 4).sort(() => Math.random() - 0.5)
      if (!valid.length) continue
      const [val, pool] = valid[0]
      const chosen = pool.sort(() => Math.random() - 0.5).slice(0, 4)
      chosen.forEach(n => usedNames.add(n))
      groups.push({ category: dim.label(val), color: dim.color, champions: chosen })
    }
  }

  if (groups.length < 4) return 'skipped: could not build 4 groups'

  // ── Step 4.5: Post-generation cross-validation ──
  // After all 4 groups are finalized, scan each tile for ambiguity:
  // if a chosen tile champion also appears in another chosen group's CURATED member list,
  // replace it with a non-conflicting member of the same group.
  {
    const chosenCategories = new Set(groups.map(g => g.category))
    // Build a lookup: category → full valid member set (curated groups only)
    const categoryMembers = new Map<string, Set<string>>()
    for (const g of CURATED_GROUPS) {
      if (chosenCategories.has(g.category)) {
        categoryMembers.set(g.category, new Set(g.champions.filter(n => champNames.has(n))))
      }
    }

    for (const group of groups) {
      const groupMembers = categoryMembers.get(group.category)
      if (!groupMembers) continue // DIMS fallback group — skip

      for (let i = 0; i < group.champions.length; i++) {
        const champion = group.champions[i]

        // Check if this tile also belongs to any other chosen group's member list
        const conflictCategory = [...chosenCategories].find(cat =>
          cat !== group.category && categoryMembers.get(cat)?.has(champion)
        )
        if (!conflictCategory) continue

        // Find a replacement from this group's members that is:
        // 1. Not already a tile in any group
        // 2. Not in any other chosen group's member list
        const allTiles = new Set(groups.flatMap(g => g.champions))
        const replacement = [...groupMembers].find(n =>
          !allTiles.has(n) &&
          ![...chosenCategories]
            .filter(cat => cat !== group.category)
            .some(cat => categoryMembers.get(cat)?.has(n))
        )

        if (replacement) {
          group.champions[i] = replacement
        }
        // If no clean replacement exists, keep the champion — conflict is logged below
      }
    }
  }

  // ── Step 4: Build tiles ──
  const allChosen = groups.flatMap(g => g.champions)
  const tiles = allChosen
    .map(name => {
      const c = champs.find(ch => ch.name === name)!
      const k = (c.extra?.key as string) ?? name.replace(/[^a-zA-Z]/g, '')
      return { name, image_url: `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${k}_0.jpg` }
    })
    .sort(() => Math.random() - 0.5)

  await supabase.from('daily_challenges').insert({
    theme_id:   themeId,
    mode:       'quadra',
    date:       today,
    name:       `Quadra ${today}`,
    image_url:  null,
    attributes: { groups },
    extra:      { tiles },
  })

  return `ok: ${groups.map(g => g.category).join(' | ')}`
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
        } else if (theme.slug === 'lol' && mode === 'quadra') {
          result = await fetchQuadraKill(theme.id, today)
        } else if (theme.slug === 'lol') {
          result = await fetchLoL(theme.id, mode, today)
        } else if (theme.slug === 'naruto') {
          result = await fetchNaruto(theme.id, mode, today)
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
