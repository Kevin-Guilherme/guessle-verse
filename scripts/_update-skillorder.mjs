/**
 * Atualiza build_items de um challenge skill-order in-place com fill-to-6 dedup fix.
 * Usage: node _update-skillorder.mjs <challenge_id>
 */
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'

const SUPABASE_URL = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'
const OPGG_MCP = 'https://mcp-api.op.gg/mcp'
const RIOT_VERSION_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'
const CHALLENGE_ID = Number(process.argv[2])
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

function splitTopLevel(s) {
  const parts = []; let depth = 0, inStr = false, cur = ''
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

function parseItem(s) {
  s = s.trim()
  const prefix = s.startsWith('StarterItems(') ? 'StarterItems('
    : s.startsWith('Boots(') ? 'Boots(' : null
  if (!prefix) return null
  const inner = s.slice(prefix.length, s.lastIndexOf(')'))
  const args = splitTopLevel(inner)
  if (args.length < 2) return null
  try { return { ids: JSON.parse(args[0]), names: JSON.parse(args[1]) } } catch (_e) { return null }
}

function parseArr(s) {
  s = (s ?? '').trim()
  if (!s.startsWith('[')) return []
  return splitTopLevel(s.slice(1, s.lastIndexOf(']')).trim())
    .map(parseItem).filter(x => x !== null)
}

async function fetchBuild(champName, lane, version, ddRunes) {
  const empty = { items: [], runeUrl: null, skillOrder: [] }
  const LANE_MAP = { bottom: 'adc', middle: 'mid', top: 'top', jungle: 'jungle', support: 'support' }
  const opggChamp = champName.replace(/'/g, '').replace(/[\s.]+/g, '_').replace(/[^A-Z_0-9]/gi, '').toUpperCase()
  const opggPos = LANE_MAP[(lane || '').toLowerCase()] ?? ((lane || '').toLowerCase() || 'mid')

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

    const desiredFields = [
      'data.boots.{ids[],ids_names[],pick_rate,play,win}',
      'data.core_items.{ids[],ids_names[],pick_rate,play,win}',
      'data.fourth_items[].{ids[],ids_names[],pick_rate,play,win}',
      'data.last_items[].{ids[],ids_names[],pick_rate,play,win}',
      'data.runes.{primary_rune_names[],pick_rate,play,win}',
      'data.skills.{order[],pick_rate,play,win}',
    ]

    const toolRes = await fetch(OPGG_MCP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: { name: 'lol_get_champion_analysis',
          arguments: { game_mode: 'ranked', champion: opggChamp, position: opggPos,
            desired_output_fields: desiredFields } },
      }),
    })
    if (!toolRes.ok) return empty
    const j = await toolRes.json()
    const dsl = j.result?.content?.[0]?.text ?? ''

    const pfx = 'LolGetChampionAnalysis(Data('
    const dIdx = dsl.indexOf(pfx)
    if (dIdx === -1) return empty
    let pd = 1, ie = dIdx + pfx.length
    for (let i = ie; i < dsl.length; i++) {
      if (dsl[i] === '(') pd++
      else if (dsl[i] === ')') { pd--; if (pd === 0) { ie = i; break } }
    }
    const parts = splitTopLevel(dsl.slice(dIdx + pfx.length, ie).trim())

    let boots, core, extraSlots, rIdx, sIdx
    if (parts.length <= 7) {
      boots      = parseItem(parts[0]); core = parseItem(parts[1])
      extraSlots = [parseArr(parts[2] ?? ''), parseArr(parts[3] ?? '')]
      rIdx = 4; sIdx = 5
    } else {
      boots      = parseItem(parts[1]); core = parseItem(parts[2])
      extraSlots = [parseArr(parts[3] ?? ''), parseArr(parts[4] ?? ''), parseArr(parts[5] ?? ''), parseArr(parts[6] ?? '')]
      rIdx = 7; sIdx = 8
    }

    const seen = new Set()
    const ids = []
    const addId = id => { if (id && !seen.has(id)) { seen.add(id); ids.push(id) } }
    if (boots) addId(boots.ids[0])
    if (core)  core.ids.forEach(addId)
    const maxOpts = Math.max(...extraSlots.map(s => s.length), 0)
    for (let oi = 0; oi < maxOpts && ids.length < 6; oi++) {
      for (const slot of extraSlots) {
        if (ids.length >= 6) break
        const opt = slot[oi]
        if (opt) addId(opt.ids[0])
      }
    }
    const items = ids.slice(0, 6).map(id =>
      `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`)

    // Rune
    let runeUrl = null
    const rp = parts[rIdx] ?? ''
    if (rp.startsWith('Runes(')) {
      const ri = rp.slice('Runes('.length, rp.lastIndexOf(')')).trim()
      const ra = splitTopLevel(ri)
      for (const ai of [0, 1]) {
        if ((ra[ai] ?? '').startsWith('[')) {
          try {
            const pr = JSON.parse(ra[ai])
            const ks = pr[0]
            if (ks) {
              outer: for (const tree of ddRunes)
                for (const sl of tree.slots)
                  for (const rune of sl.runes)
                    if (rune.name?.toLowerCase() === ks.toLowerCase()) {
                      runeUrl = `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`
                      break outer
                    }
            }
          } catch (_e) { /* ignore */ }
          break
        }
      }
    }

    // Skill order
    let skillOrder = []
    const sp = parts[sIdx] ?? ''
    if (sp.startsWith('Skills(')) {
      const si = sp.slice('Skills('.length, sp.lastIndexOf(')')).trim()
      const sa = splitTopLevel(si)
      if (sa.length > 0) try { skillOrder = JSON.parse(sa[0]) } catch (_e) { /* ignore */ }
    }

    return { items, runeUrl, skillOrder }
  } catch (e) { console.error('OP.GG error:', e.message); return empty }
}

async function main() {
  if (!CHALLENGE_ID) { console.error('Usage: node _update-skillorder.mjs <id>'); process.exit(1) }

  const { data: ch } = await sb.from('daily_challenges')
    .select('id, name, date, extra').eq('id', CHALLENGE_ID).single()
  if (!ch) { console.error('Challenge not found'); process.exit(1) }

  const lane = ch.extra?.build_lane ?? ''
  const oldIds = (ch.extra?.build_items ?? []).map(u => u.match(/\/(\d+)\.png$/)?.[1])
  console.log(`id=${ch.id}  name=${ch.name}  date=${ch.date}  lane=${lane}`)
  console.log(`  current items (${oldIds.length}): ${oldIds.join(', ')}`)

  const versRes = await fetch(RIOT_VERSION_URL)
  const version = (await versRes.json())[0]
  const runesRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`)
  const ddRunes = runesRes.ok ? await runesRes.json() : []

  console.log(`  Fetching OP.GG for ${ch.name} (${lane || 'no lane'})...`)
  const data = await fetchBuild(ch.name, lane, version, ddRunes)
  const newIds = data.items.map(u => u.match(/\/(\d+)\.png$/)?.[1])
  const hasDup = newIds.length !== new Set(newIds).size
  console.log(`  new items (${data.items.length}): ${newIds.join(', ')}  dup=${hasDup}`)

  const { error } = await sb.from('daily_challenges').update({
    extra: {
      ...ch.extra,
      build_items:       data.items,
      build_rune_url:    data.runeUrl,
      build_skill_order: data.skillOrder,
    },
  }).eq('id', CHALLENGE_ID)

  console.log(error ? `UPDATE error: ${error.message}` : `Updated id=${CHALLENGE_ID} — ${data.items.length} items, dup=${hasDup}`)
}

main().catch(e => { console.error(e); process.exit(1) })
