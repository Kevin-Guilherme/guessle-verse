/**
 * Aplica GIF/video URLs de jutsus nos personagens Naruto ativos.
 * Para cada personagem, percorre extra.jutsus[] em ordem e usa o PRIMEIRO
 * jutsu que tiver mapeamento não-null em naruto-jutsu-gifs.json.
 *
 * Usage:
 *   node apply-jutsu-gifs.mjs --dry-run   (mostra tabela sem alterar banco)
 *   node apply-jutsu-gifs.mjs             (aplica no banco)
 */
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'
import { readFileSync }  from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'

const __dir       = dirname(fileURLToPath(import.meta.url))
const GIFS_PATH   = join(__dir, 'naruto-jutsu-gifs.json')
const DRY_RUN     = process.argv.includes('--dry-run')

const SUPABASE_URL = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'
const sb           = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE UPDATE'}\n`)

  // 1. Load GIF mapping
  let gifMap
  try {
    gifMap = JSON.parse(readFileSync(GIFS_PATH, 'utf8'))
  } catch (e) {
    console.error(`Cannot read ${GIFS_PATH}:`, e.message)
    process.exit(1)
  }

  const mappedCount = Object.values(gifMap).filter(v => v !== null).length
  console.log(`GIF mapping: ${Object.keys(gifMap).length} jutsus, ${mappedCount} with URLs\n`)

  if (mappedCount === 0) {
    console.error('No GIF URLs in mapping — run Fase 2 first to populate naruto-jutsu-gifs.json')
    process.exit(1)
  }

  // 2. Fetch all active Naruto characters with jutsus array
  const { data: chars, error } = await sb
    .from('characters')
    .select('id, name, extra')
    .eq('active', true)
    .eq('theme_id', (await sb.from('themes').select('id').eq('slug', 'naruto').single()).data.id)
    .not('extra->jutsus', 'is', null)
    .order('name')

  if (error) { console.error(error.message); process.exit(1) }
  console.log(`Loaded ${chars.length} characters with jutsus\n`)

  // 3. Match each character to their best available GIF
  const updates = []
  const noMatch = []

  for (const char of chars) {
    const jutsus = char.extra?.jutsus ?? []
    let matched = null

    for (const jutsu of jutsus) {
      const url = gifMap[jutsu]
      if (url) { matched = { jutsu, gifUrl: url }; break }
    }

    if (matched) {
      updates.push({ id: char.id, name: char.name, ...matched })
    } else {
      noMatch.push(char.name)
    }
  }

  // 4. Report
  console.log(`${'='.repeat(70)}`)
  console.log(`WILL UPDATE: ${updates.length}   NO MATCH: ${noMatch.length}`)
  console.log(`${'='.repeat(70)}`)

  // Show first 20 in dry-run table
  const preview = DRY_RUN ? updates : updates.slice(0, 20)
  console.log(`\n${'Personagem'.padEnd(25)} ${'Jutsu'.padEnd(40)} GIF URL`)
  console.log('-'.repeat(100))
  for (const u of preview) {
    console.log(
      `${u.name.slice(0, 24).padEnd(25)} ${u.jutsu.slice(0, 39).padEnd(40)} ${u.gifUrl.slice(0, 50)}`
    )
  }
  if (!DRY_RUN && updates.length > 20)
    console.log(`  ... and ${updates.length - 20} more`)

  if (noMatch.length > 0)
    console.log(`\nNo GIF match: ${noMatch.slice(0, 10).join(', ')}${noMatch.length > 10 ? ` +${noMatch.length - 10} more` : ''}`)

  if (DRY_RUN) {
    console.log('\nDRY RUN — no changes made.')
    return
  }

  // 5. Apply updates
  console.log('\nApplying updates...')
  let ok = 0, fail = 0
  for (const u of updates) {
    const newExtra = { ...(chars.find(c => c.id === u.id)?.extra ?? {}), jutsu_video_url: u.gifUrl, jutsu_name: u.jutsu }
    const { error } = await sb.from('characters').update({ extra: newExtra }).eq('id', u.id)
    if (error) { console.error(`  FAIL ${u.name}: ${error.message}`); fail++ }
    else { process.stdout.write('.'); ok++ }
  }
  console.log(`\nDone: ${ok} updated, ${fail} failed`)
}

main().catch(e => { console.error(e); process.exit(1) })
