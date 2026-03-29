/**
 * Atualiza positions de todos os campeões LoL ativos usando OP.GG MCP.
 *
 * Estratégia: usa lol_get_champion_analysis → data.summary.positions[]
 * O OP.GG já retorna as lanes filtradas e ordenadas por role_rate desc,
 * exatamente o que o site exibe na página Champion Builds.
 * Não calculamos threshold manualmente — confiamos na filtragem do OP.GG.
 *
 * Mapeamento de nomes: TOP→Top, JUNGLE→Jungle, MID→Middle, ADC→Bottom, SUPPORT→Support
 *
 * Usage: node update-positions.mjs [--dry-run]
 */
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'

const SUPABASE_URL = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'
const OPGG_MCP     = 'https://mcp-api.op.gg/mcp'
const DRY_RUN      = process.argv.includes('--dry-run')

// OP.GG position names → DB values
const POS_MAP = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Middle', ADC: 'Bottom', SUPPORT: 'Support' }

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── OP.GG MCP call ──────────────────────────────────────────────────────────

async function opggChampionPositions(champName) {
  // Convert DB name to OP.GG key (e.g. "Dr. Mundo" → "DR_MUNDO", "Cho'Gath" → "CHOGATH")
  const opggKey = champName.replace(/'/g, '').replace(/[\s.]+/g, '_').replace(/[^A-Z_0-9]/gi, '').toUpperCase()

  await fetch(OPGG_MCP, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'guessle', version: '1.0.0' } } }) })
  await fetch(OPGG_MCP, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'notifications/initialized' }) })

  const res = await fetch(OPGG_MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
      name: 'lol_get_champion_analysis',
      arguments: {
        champion: opggKey,
        position: 'top', // required to trigger response; summary returns all positions regardless
        game_mode: 'ranked',
        desired_output_fields: [
          'data.summary.positions[].name',
          'data.summary.positions[].stats.{play,role_rate,win_rate}',
        ],
      },
    }}),
  })

  let dsl = ''
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    const text = await res.text()
    const last = text.split('\n').filter(l => l.startsWith('data: ')).at(-1)?.slice(6)
    if (last) { try { dsl = JSON.parse(last).result?.content?.[0]?.text ?? '' } catch { /* ignore */ } }
  } else {
    const j = await res.json()
    dsl = j.result?.content?.[0]?.text ?? ''
  }

  // Parse: LolGetChampionAnalysis(Data(Summary([Position("TOP",Stats(play,role_rate,win_rate)),...],[]))
  // Extract ordered list of position names as returned by OP.GG
  const positions = []
  const regex = /Position\("([A-Z]+)",Stats\([\d.]+,([\d.]+),[\d.]+\)\)/g
  for (const m of dsl.matchAll(regex)) {
    const opggPos  = m[1]            // e.g. "TOP"
    const roleRate = parseFloat(m[2])
    const dbPos    = POS_MAP[opggPos]
    if (dbPos) positions.push({ dbPos, roleRate })
  }

  return positions // ordered by role_rate desc, already filtered by OP.GG
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE UPDATE'}`)
  console.log('Source: lol_get_champion_analysis → data.summary.positions[] (OP.GG pre-filtered)\n')

  // 1. Fetch all active LoL champions from DB
  const { data: champs, error } = await sb
    .from('characters')
    .select('id, name, attributes')
    .eq('theme_id', 1)
    .eq('active', true)
    .order('name')
  if (error) { console.error(error.message); process.exit(1) }
  console.log(`Loaded ${champs.length} champions from DB\n`)

  // 2. Fetch positions from OP.GG per champion
  console.log('Fetching OP.GG positions...')
  const champPositions = new Map() // name → [dbPos, ...]
  let fetched = 0
  for (const champ of champs) {
    process.stdout.write(`  [${String(++fetched).padStart(3)}/${champs.length}] ${champ.name.padEnd(20)}`)
    try {
      const positions = await opggChampionPositions(champ.name)
      if (positions.length > 0) {
        champPositions.set(champ.name, positions.map(p => p.dbPos))
        console.log(`→ ${positions.map(p => `${p.dbPos}(${(p.roleRate*100).toFixed(0)}%)`).join(', ')}`)
      } else {
        champPositions.set(champ.name, null)
        console.log('→ no data')
      }
    } catch (e) {
      champPositions.set(champ.name, null)
      console.log(`→ ERROR: ${e.message}`)
    }
  }

  // 3. Compare with DB and collect updates
  console.log('\nComputing updates...')
  const updates   = []
  const noData    = []
  const unchanged = []

  for (const champ of champs) {
    const current  = String(champ.attributes?.positions ?? '').trim()
    const opggPos  = champPositions.get(champ.name)

    if (!opggPos) {
      noData.push(champ.name)
      continue
    }

    const newVal = opggPos.join(',')

    if (newVal === current) {
      unchanged.push(champ.name)
    } else {
      updates.push({ id: champ.id, name: champ.name, old: current, new: newVal, attrs: champ.attributes })
    }
  }

  // 4. Report
  console.log(`\n${'='.repeat(60)}`)
  console.log(`UNCHANGED:     ${unchanged.length}`)
  console.log(`NO OP.GG DATA: ${noData.length} — ${noData.join(', ')}`)
  console.log(`TO UPDATE:     ${updates.length}`)
  console.log(`${'='.repeat(60)}`)
  for (const u of updates)
    console.log(`  ${u.name.padEnd(25)} "${u.old}" → "${u.new}"`)

  if (DRY_RUN) {
    console.log('\nDRY RUN — nenhuma alteração feita.')
    return
  }

  // 5. Apply updates
  console.log('\nApplying updates...')
  let ok = 0, fail = 0
  for (const u of updates) {
    const newAttrs = { ...u.attrs, positions: u.new }
    const { error } = await sb.from('characters').update({ attributes: newAttrs }).eq('id', u.id)
    if (error) { console.error(`  FAIL ${u.name}: ${error.message}`); fail++ }
    else { process.stdout.write('.'); ok++ }
  }
  console.log(`\nDone: ${ok} updated, ${fail} failed`)
}

main().catch(e => { console.error(e); process.exit(1) })
