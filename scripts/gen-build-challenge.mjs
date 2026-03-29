/**
 * Manual generator for LoL build challenge on a specific date.
 * Usage: node gen-build-challenge.mjs [date]   (date defaults to 2026-03-25)
 */

import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'

const SUPABASE_URL = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'
const RIOT_VERSION_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'
const OPGG_MCP = 'https://mcp-api.op.gg/mcp'
const TARGET_DATE = process.argv[2] ?? '2026-03-25'
const LOL_THEME_ID = 1

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── DSL parser (mirrors cron function) ─────────────────────────────────────

function splitTopLevel(s) {
  const parts = []
  let depth = 0, inStr = false, cur = ''
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

function parseOpggItem(s) {
  s = s.trim()
  // API uses either StarterItems(...) or Boots(...)
  const prefix = s.startsWith('StarterItems(') ? 'StarterItems(' : s.startsWith('Boots(') ? 'Boots(' : null
  if (!prefix) return null
  const inner = s.slice(prefix.length, s.lastIndexOf(')'))
  const args = splitTopLevel(inner)
  if (args.length < 2) return null
  try { return { ids: JSON.parse(args[0]), names: JSON.parse(args[1]) } }
  catch { return null }
}

async function fetchOpggBuild(champName, lane, version, ddRunes) {
  const empty = { items: [], runeUrl: null, skillOrder: [] }
  const opggChamp = champName.replace(/'/g, '').replace(/[\s.]+/g, '_').replace(/[^A-Z_0-9]/gi, '').toUpperCase()
  const laneNorm  = (lane || '').toLowerCase()
  const LANE_MAP  = { bottom: 'adc', middle: 'mid', top: 'top', jungle: 'jungle', support: 'support' }
  const opggPos   = LANE_MAP[laneNorm] ?? (laneNorm || 'mid')

  try {
    await fetch(OPGG_MCP, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'guessle', version: '1.0.0' } } }),
    })
    await fetch(OPGG_MCP, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'notifications/initialized' }),
    })

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
    if (!toolRes.ok) { console.log(`  OP.GG HTTP ${toolRes.status} for ${champName}`); return empty }

    let dsl = ''
    const ct = toolRes.headers.get('content-type') ?? ''
    if (ct.includes('text/event-stream')) {
      const text = await toolRes.text()
      const last = text.split('\n').filter(l => l.startsWith('data: ')).at(-1)?.slice(6)
      if (last) { const j = JSON.parse(last); dsl = j.result?.content?.[0]?.text ?? '' }
    } else {
      const j = await toolRes.json()
      dsl = j.result?.content?.[0]?.text ?? ''
    }
    if (!dsl) return empty

    const prefix = 'LolGetChampionAnalysis(Data('
    const dataIdx = dsl.indexOf(prefix)
    if (dataIdx === -1) return empty
    let parenDepth = 1, innerEnd = dataIdx + prefix.length
    for (let i = innerEnd; i < dsl.length; i++) {
      if (dsl[i] === '(') parenDepth++
      else if (dsl[i] === ')') { parenDepth--; if (parenDepth === 0) { innerEnd = i; break } }
    }
    const parts = splitTopLevel(dsl.slice(dataIdx + prefix.length, innerEnd).trim())

    // New DSL structure (6 parts): boots, core, fourth[], last[], Runes(...), Skills(...)
    // Old DSL structure (9 parts): starter, boots, core, fourth[], fifth[], sixth[], last[], Runes, Skills
    // Detect by whether parts[2] starts with '[' (new) or is a StarterItems/Boots item (old)
    const parseArr = (s) => {
      s = (s ?? '').trim()
      if (!s.startsWith('[')) return []
      return splitTopLevel(s.slice(1, s.lastIndexOf(']')).trim())
        .map(parseOpggItem).filter(x => x !== null)
    }

    let boots, core, fourth, last, runesPartIdx, skillsPartIdx
    if (parts.length <= 7) {
      // New compact format: [boots, core, fourth[], last[], Runes, Skills]
      boots         = parts.length > 0 ? parseOpggItem(parts[0]) : null
      core          = parts.length > 1 ? parseOpggItem(parts[1]) : null
      fourth        = parts.length > 2 ? (parseArr(parts[2])[0] ?? null) : null
      last          = parts.length > 3 ? (parseArr(parts[3])[0] ?? null) : null
      runesPartIdx  = 4
      skillsPartIdx = 5
    } else {
      // Old verbose format: [starter, boots, core, fourth[], fifth[], sixth[], last[], Runes, Skills]
      boots         = parts.length > 1 ? parseOpggItem(parts[1]) : null
      core          = parts.length > 2 ? parseOpggItem(parts[2]) : null
      fourth        = parts.length > 3 ? (parseArr(parts[3])[0] ?? null) : null
      last          = parts.length > 6 ? (parseArr(parts[6])[0] ?? null) : null
      runesPartIdx  = 7
      skillsPartIdx = 8
    }

    const ids = []
    if (boots)              ids.push(boots.ids[0])
    if (core)               ids.push(...core.ids)
    if (fourth && ids.length < 5) ids.push(fourth.ids[0])
    if (last   && ids.length < 6) ids.push(last.ids[0])
    const items = ids.slice(0, 6).map(id => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`)

    let runeUrl = null
    const runesPart = parts[runesPartIdx] ?? ''
    if (runesPart.startsWith('Runes(')) {
      const runesInner = runesPart.slice('Runes('.length, runesPart.lastIndexOf(')')).trim()
      const runesArgs  = splitTopLevel(runesInner)
      if (runesArgs.length > 0) {
        try {
          const primaryRunes = JSON.parse(runesArgs[0])
          const keystone = primaryRunes[0]
          if (keystone) {
            outer: for (const tree of ddRunes) {
              for (const slot of tree.slots) {
                for (const rune of slot.runes) {
                  if (rune.name?.toLowerCase() === keystone.toLowerCase()) {
                    runeUrl = `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`
                    break outer
                  }
                }
              }
            }
          }
        } catch { /* ignore */ }
      }
    }

    let skillOrder = []
    const skillsPart = parts[skillsPartIdx] ?? ''
    if (skillsPart.startsWith('Skills(')) {
      const skillsInner = skillsPart.slice('Skills('.length, skillsPart.lastIndexOf(')')).trim()
      const skillsArgs  = splitTopLevel(skillsInner)
      if (skillsArgs.length > 0) {
        try { skillOrder = JSON.parse(skillsArgs[0]) } catch { /* ignore */ }
      }
    }

    return { items, runeUrl, skillOrder }
  } catch (e) { console.error(`  fetchOpggBuild error for ${champName}:`, e.message); return empty }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Generating LoL build challenge for ${TARGET_DATE}`)

  // 1. Check if already exists
  const { data: existing } = await supabase
    .from('daily_challenges')
    .select('id, name')
    .eq('theme_id', LOL_THEME_ID)
    .eq('mode', 'build')
    .eq('date', TARGET_DATE)
    .maybeSingle()

  if (existing) {
    console.log(`Already exists: id=${existing.id} name=${existing.name}`)
    process.exit(0)
  }

  // 2. Get recent names (last 60 days)
  const since = new Date(TARGET_DATE)
  since.setDate(since.getDate() - 60)
  const { data: recentRows } = await supabase
    .from('daily_challenges')
    .select('name')
    .eq('theme_id', LOL_THEME_ID)
    .eq('mode', 'build')
    .gte('date', since.toISOString().split('T')[0])
  const recent = new Set((recentRows ?? []).map(r => r.name))
  console.log(`Recent (60d): ${recent.size} names used`)

  // 3. Load all active LoL characters
  const { data: candidates } = await supabase
    .from('characters')
    .select('id, name, attributes, extra, image_url')
    .eq('theme_id', LOL_THEME_ID)
    .eq('active', true)

  const pool = (candidates ?? []).filter(c => !recent.has(c.name))
  console.log(`Pool: ${pool.length} eligible champions`)
  if (pool.length < 4) { console.error('Not enough candidates'); process.exit(1) }

  // 4. Pick 4 random champions
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const questPicks = shuffled.slice(0, 4)
  console.log(`Picked: ${questPicks.map(c => c.name).join(', ')}`)

  // 5. Fetch DDragon version + runes
  const versRes = await fetch(RIOT_VERSION_URL)
  const versions = await versRes.json()
  const version = versions[0]
  console.log(`DDragon version: ${version}`)

  const runesRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`)
  const ddRunes = runesRes.ok ? await runesRes.json() : []

  const tileUrl = (name, extra) => {
    const k = (extra?.key) ?? name.replace(/[^a-zA-Z]/g, '')
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${k}_0.jpg`
  }

  const makeBuildOptions = (p, pLane) => {
    const pKey  = (p.extra?.key) ?? p.name.replace(/[^a-zA-Z]/g, '')
    const pTile = `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${pKey}_0.jpg`
    const lane  = (pLane || '').toLowerCase()
    const sameLane = (candidates ?? []).filter(c =>
      c.name !== p.name && String(c.attributes?.positions ?? '').toLowerCase().includes(lane)
    )
    const fillPool = (candidates ?? []).filter(c =>
      c.name !== p.name && !sameLane.includes(c)
    )
    const wrongPool = sameLane.length >= 7 ? sameLane : [...sameLane, ...fillPool]
    const wrongs = wrongPool
      .sort(() => Math.random() - 0.5)
      .slice(0, 7)
      .map(c => ({ name: c.name, image_url: tileUrl(c.name, c.extra) }))
    return [{ name: p.name, image_url: pTile }, ...wrongs].sort(() => Math.random() - 0.5)
  }

  // 6. Fetch build data for all 4 picks
  const buildQuests = []
  for (let qi = 0; qi < 4; qi++) {
    const qp    = questPicks[qi]
    const qLane = String(qp.attributes?.positions ?? '').split(',')[0].trim()
    console.log(`  Fetching OP.GG for ${qp.name} (${qLane || 'no lane'})...`)
    const qData = await fetchOpggBuild(qp.name, qLane, version, ddRunes)
    console.log(`    items: ${qData.items.length}, skillOrder: ${qData.skillOrder.join('')}`)
    buildQuests.push({
      answer:            qp.name,
      build_items:       qData.items,
      build_lane:        qLane,
      build_rune_url:    qData.runeUrl,
      build_skill_order: qData.skillOrder,
      build_options:     makeBuildOptions(qp, qLane),
    })
  }

  const pick = questPicks[0]
  const pickKey = (pick.extra?.key) ?? pick.name.replace(/[^a-zA-Z]/g, '')
  const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${pickKey}_0.jpg`

  const row = {
    theme_id:     LOL_THEME_ID,
    mode:         'build',
    date:         TARGET_DATE,
    character_id: pick.id,
    name:         pick.name,
    image_url:    splashUrl,
    attributes:   {},   // build mode uses quests, not attribute table
    extra: {
      ...pick.extra,
      splash_url: splashUrl,
      quests:     buildQuests,
    },
  }

  const { data: inserted, error } = await supabase
    .from('daily_challenges')
    .insert(row)
    .select('id, name, date')
    .single()

  if (error) { console.error('Insert failed:', error.message); process.exit(1) }

  console.log(`\nInserted: id=${inserted.id} date=${inserted.date}`)
  console.log(`Champion (quest 1): ${buildQuests[0].answer} | lane: ${buildQuests[0].build_lane} | items: ${buildQuests[0].build_items.length}`)
  console.log(`Champion (quest 2): ${buildQuests[1].answer} | lane: ${buildQuests[1].build_lane} | items: ${buildQuests[1].build_items.length}`)
  console.log(`Champion (quest 3): ${buildQuests[2].answer} | lane: ${buildQuests[2].build_lane} | items: ${buildQuests[2].build_items.length}`)
  console.log(`Champion (quest 4): ${buildQuests[3].answer} | lane: ${buildQuests[3].build_lane} | items: ${buildQuests[3].build_items.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
