/**
 * Naruto Canonical Character Match Report
 * Compara lista canônica (scripts/naruto-canonical-characters.json) com
 * personagens no banco (theme_id=2) e gera relatório em scripts/naruto-match-report.json
 *
 * Usage: node scripts/naruto-match-report.mjs
 */
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Normalize helpers ────────────────────────────────────────────────────────

/** Lowercase + trim */
function norm(s) { return s.toLowerCase().trim() }

/**
 * Strip macron diacritics common in romanized Japanese:
 * ū→u, ō→o, ā→a, ī→i, ē→e (upper + lower)
 * Uses NFD decomposition + strip combining chars (U+0300–U+036F)
 */
function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Remove parenthetical suffixes: "A (Fourth Raikage)" → "A" */
function stripParens(s) { return s.replace(/\s*\([^)]*\)/g, '').trim() }

/** Remove hyphens/dashes used in some canonical names but absent in DB */
function stripHyphens(s) { return s.replace(/[-–]/g, '').replace(/\s+/g, ' ').trim() }

/**
 * Explicit alias map: canonical (lower) → possible DB names (lower, after diacritics)
 * Used for cases where name differs beyond diacritics.
 */
const ALIASES = {
  'killer bee':       ['killer b'],
  'eida':             ['ada'],                     // Boruto: Eida/Ada are the same character
  'iwabe yuino':      ['iwabee yuino'],             // spelling variant
  'amado':            ['amado sanzu'],              // canonical has just first name
  'sakon':            ['sakon and ukon'],           // canonical has one name, DB has both
  'roshi':            ['roshi'],                    // Rōshi after stripping → roshi
  'son goku':         ['son goku'],                 // Son Gokū → Son Goku via diacritics
  // "ou/oh" romanization → macron ō (diacritic strip gives 'o', canonical gives 'ou/oh')
  'gatoh':            ['gato'],                     // Gatō
  'gouzu':            ['gozu'],                     // Gōzu
  'tentou madoka':    ['tento madoka'],             // Tentō Madoka
}

/**
 * Generate all candidate lookup keys for a canonical name.
 * Returns array of normalized strings to try (deduped).
 */
function candidateKeys(name) {
  const variants = new Set()
  const add = (s) => {
    const k = norm(stripDiacritics(s))
    variants.add(k)
    // Also try without hyphens
    variants.add(norm(stripDiacritics(stripHyphens(s))))
    // Also try without parentheticals
    const noP = stripParens(s)
    variants.add(norm(stripDiacritics(noP)))
    variants.add(norm(stripDiacritics(stripHyphens(noP))))
  }
  add(name)

  // Explicit aliases
  const key = norm(stripDiacritics(name))
  if (ALIASES[key]) ALIASES[key].forEach(a => variants.add(a))
  // Also try canonical without diacritics in alias lookup
  const keyNorm = norm(name).toLowerCase()
  if (ALIASES[keyNorm]) ALIASES[keyNorm].forEach(a => variants.add(a))

  return [...variants]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📦 Lendo lista canônica...')
  const canonical = JSON.parse(readFileSync(join(__dir, 'naruto-canonical-characters.json'), 'utf8'))
  console.log(`   ${canonical.length} personagens canônicos`)

  console.log('\n🗄  Buscando personagens Naruto no banco (theme_id=2)...')

  // Fetch all characters with pagination
  let allChars = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('characters')
      .select('id, name, image_url, extra, attributes')
      .eq('theme_id', 2)
      .range(from, from + PAGE - 1)
    if (error) { console.error('Supabase error:', error); process.exit(1) }
    if (!data || data.length === 0) break
    allChars = allChars.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`   ${allChars.length} personagens no banco`)

  // Build lookup maps: normalized → char
  const exactMap     = new Map()  // exact lower
  const diacriticsMap = new Map() // diacritics-stripped lower
  const noHyphenMap  = new Map()  // diacritics-stripped + hyphens removed

  for (const char of allChars) {
    const e = norm(char.name)
    const d = norm(stripDiacritics(char.name))
    const h = norm(stripDiacritics(stripHyphens(char.name)))
    if (!exactMap.has(e))      exactMap.set(e, char)
    if (!diacriticsMap.has(d)) diacriticsMap.set(d, char)
    if (!noHyphenMap.has(h))   noHyphenMap.set(h, char)
  }

  // ─── Matching ───────────────────────────────────────────────────────────────
  const matched             = []
  const no_match_canonical  = []
  const matchedDbIds        = new Set()

  for (const canon of canonical) {
    const keys = candidateKeys(canon.name)
    let found = null

    for (const key of keys) {
      found = exactMap.get(key) ?? diacriticsMap.get(key) ?? noHyphenMap.get(key) ?? null
      if (found) break
    }

    if (found) {
      matchedDbIds.add(found.id)
      matched.push({
        canonical_name: canon.name,
        db_id:          found.id,
        db_name:        found.name,
        has_image:      !!found.image_url,
        has_jutsu_gif:  !!(found.extra?.jutsu_video_url),
        has_quotes:     !!(found.extra?.quotes && found.extra.quotes.length > 0),
      })
    } else {
      no_match_canonical.push(canon.name)
    }
  }

  // ─── to_delete: in DB but not in canonical ──────────────────────────────────
  const to_delete = allChars
    .filter(c => !matchedDbIds.has(c.id))
    .map(c => ({ db_id: c.id, db_name: c.name }))
    .sort((a, b) => a.db_name.localeCompare(b.db_name))

  // ─── daily_challenges_at_risk ────────────────────────────────────────────────
  const toDeleteIds = to_delete.map(c => c.db_id)
  let daily_challenges_at_risk = []

  if (toDeleteIds.length > 0) {
    const today    = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

    const { data: atRisk, error: riskErr } = await supabase
      .from('daily_challenges')
      .select('id, mode, date, character_id')
      .in('character_id', toDeleteIds)
      .in('date', [today, tomorrow])

    if (riskErr) { console.error('Risk query error:', riskErr) }
    else if (atRisk) {
      daily_challenges_at_risk = atRisk.map(ch => {
        const char = to_delete.find(c => c.db_id === ch.character_id)
        return {
          challenge_id:   ch.id,
          mode:           ch.mode,
          date:           ch.date,
          character_id:   ch.character_id,
          character_name: char?.db_name ?? '?',
        }
      })
    }
  }

  // ─── Output ─────────────────────────────────────────────────────────────────
  const report = { matched, no_match_canonical, to_delete, daily_challenges_at_risk }
  const outPath = join(__dir, 'naruto-match-report.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

  console.log('\n📊 RESUMO')
  console.log('─────────────────────────────────────────')
  console.log(`  ✅ matched:                  ${matched.length}`)
  console.log(`  ❓ no_match_canonical:       ${no_match_canonical.length}  ← precisa criar no DB`)
  console.log(`  🗑  to_delete:               ${to_delete.length}  ← não-canônicos no DB`)
  console.log(`  ⚠️  daily_challenges_at_risk: ${daily_challenges_at_risk.length}`)
  console.log('─────────────────────────────────────────')

  if (no_match_canonical.length > 0) {
    console.log('\n❓ Não encontrados no DB (precisam ser criados):')
    for (const n of no_match_canonical) console.log(`   - ${n}`)
  }

  if (daily_challenges_at_risk.length > 0) {
    console.log('\n⚠️  Challenges em risco (hoje/amanhã apontando para to_delete):')
    for (const c of daily_challenges_at_risk)
      console.log(`   - [${c.date}] ${c.mode} → ${c.character_name} (id ${c.character_id})`)
  }

  console.log(`\n💾 Relatório salvo em: ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
