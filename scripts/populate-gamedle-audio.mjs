/**
 * Popula gamedle_pool.audio_url via Deezer API (preview clips de 30s).
 *
 * Estratégia:
 *   1. Busca no Deezer por "{gameName} original soundtrack" / "OST" / "soundtrack"
 *   2. Valida se o album title contém o nome do jogo
 *   3. Salva o preview_url (MP3 direto, ~30s)
 *   4. Logs de cobertura ao final — games sem match ficam para revisão manual
 *
 * Uso:
 *   node scripts/populate-gamedle-audio.mjs [--dry-run] [--missing-only]
 *
 *   --dry-run      Mostra resultados sem salvar no DB
 *   --missing-only Só processa games que ainda não têm audio_url
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────

const __dirname  = dirname(fileURLToPath(import.meta.url))
const envPath    = resolve(__dirname, '../apps/web/.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env        = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const SUPABASE_URL  = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY   = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Supabase URL ou Service Key não encontrados em apps/web/.env.local')
  process.exit(1)
}

const supabase   = createClient(SUPABASE_URL, SERVICE_KEY)
const DRY_RUN    = process.argv.includes('--dry-run')
const MISSING    = process.argv.includes('--missing-only')
const DELAY_MS   = 120  // ~8 req/s — safe abaixo do limite Deezer

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/** Normaliza string para comparação fuzzy */
function norm(str) {
  return (str ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extrai o "nome principal" de um título com subtítulo.
 * Ex: "The Legend of Zelda: Breath of the Wild" → "Breath of the Wild"
 *     "Dark Souls III" → "Dark Souls III"
 */
function mainTitle(name) {
  const colonIdx = name.indexOf(':')
  return colonIdx !== -1 ? name.slice(colonIdx + 1).trim() : name
}

/** Chama Deezer /search e retorna tracks */
async function deezerSearch(query) {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8`
  const res  = await fetch(url)
  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

/**
 * Tenta encontrar um preview_url para o jogo.
 * Retorna { url, track, album } ou null.
 */
async function findAudio(gameName) {
  const main   = mainTitle(gameName)
  const normFull = norm(gameName)
  const normMain = norm(main)

  const queries = [
    `${main} original soundtrack`,
    `${gameName} original soundtrack`,
    `${main} OST`,
    `${gameName} OST`,
    `${main} soundtrack`,
  ]

  for (const q of queries) {
    const tracks = await deezerSearch(q)
    await sleep(DELAY_MS)

    for (const t of tracks) {
      if (!t.preview) continue

      const albumNorm = norm(t.album?.title ?? '')
      const titleNorm = norm(t.title ?? '')

      // Match: album ou título contém o nome do jogo (full ou main)
      const match =
        albumNorm.includes(normMain) ||
        albumNorm.includes(normFull) ||
        titleNorm.includes(normMain) ||
        (normMain.length > 4 && albumNorm.startsWith(normMain.slice(0, normMain.length - 2)))

      if (match) {
        return { url: t.preview, track: t.title, album: t.album?.title }
      }
    }
  }

  return null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎮 Gamedle Audio Populator ${DRY_RUN ? '[DRY RUN]' : ''} ${MISSING ? '[MISSING ONLY]' : ''}\n`)

  // Busca todos os games do pool
  let query = supabase
    .from('gamedle_pool')
    .select('id, name, audio_url')
    .eq('active', true)
    .order('name')

  if (MISSING) {
    query = query.is('audio_url', null)
  }

  const { data: games, error } = await query
  if (error) { console.error('❌ Erro ao buscar gamedle_pool:', error.message); process.exit(1) }

  console.log(`📋 ${games.length} games para processar\n`)

  const results = { found: [], notFound: [], skipped: [] }

  for (let i = 0; i < games.length; i++) {
    const game = games[i]
    const prefix = `[${String(i + 1).padStart(3, '0')}/${games.length}]`

    // Se já tem URL e não é missing-only run, pula
    if (game.audio_url && !MISSING) {
      results.skipped.push(game.name)
      console.log(`${prefix} ⏭  ${game.name} (já tem URL)`)
      continue
    }

    const found = await findAudio(game.name)

    if (found) {
      results.found.push({ name: game.name, ...found })
      console.log(`${prefix} ✅ ${game.name}`)
      console.log(`         Album: ${found.album}`)
      console.log(`         Track: ${found.track}`)
      console.log(`         URL:   ${found.url}`)

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from('gamedle_pool')
          .update({ audio_url: found.url })
          .eq('id', game.id)

        if (updateErr) console.warn(`         ⚠️  Update falhou: ${updateErr.message}`)
      }
    } else {
      results.notFound.push(game.name)
      console.log(`${prefix} ❌ ${game.name} — sem match no Deezer`)
    }

    // Pequena pausa extra a cada 20 requests pra não estressar a API
    if ((i + 1) % 20 === 0) await sleep(500)
  }

  // ── Relatório final ──────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log(`\n📊 Resultado:`)
  console.log(`   ✅ Encontrados: ${results.found.length}`)
  console.log(`   ❌ Não encontrados: ${results.notFound.length}`)
  console.log(`   ⏭  Pulados (já tinham URL): ${results.skipped.length}`)

  const coverage = Math.round(results.found.length / (results.found.length + results.notFound.length) * 100)
  console.log(`   📈 Cobertura: ${coverage}%\n`)

  if (results.notFound.length > 0) {
    console.log('⚠️  Games sem áudio (revisar manualmente via KHInsider ou R2):')
    results.notFound.forEach(n => console.log(`   - ${n}`))
    console.log()
  }

  if (DRY_RUN) {
    console.log('ℹ️  Modo dry-run: nada foi salvo no banco.')
    console.log('   Remova --dry-run para salvar os resultados.\n')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
