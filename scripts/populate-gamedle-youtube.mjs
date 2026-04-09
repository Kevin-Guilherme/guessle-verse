/**
 * Popula gamedle_pool.youtube_id via YouTube Data API v3.
 *
 * Estratégia:
 *   1. Busca "{gameName} original soundtrack" no YouTube (categoria Música)
 *   2. Prioriza canais oficiais (publisher, composer, verificado)
 *   3. Salva o video_id e youtube_start (default: 0)
 *   4. Relatório de cobertura ao final
 *
 * Pré-requisito:
 *   YOUTUBE_API_KEY em apps/web/.env.local
 *   (Google Cloud → YouTube Data API v3 → Credentials → API Key)
 *
 * Uso:
 *   node scripts/populate-gamedle-youtube.mjs [--dry-run] [--missing-only] [--reset]
 *
 *   --dry-run      Mostra resultados sem salvar no DB
 *   --missing-only Só processa games sem youtube_id
 *   --reset        Limpa youtube_id antes de repopular
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
const YT_KEY        = env.YOUTUBE_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Supabase URL ou Service Key não encontrados em apps/web/.env.local')
  process.exit(1)
}
if (!YT_KEY) {
  console.error('❌ YOUTUBE_API_KEY não encontrado em apps/web/.env.local')
  console.error('   Crie em: console.cloud.google.com → YouTube Data API v3 → Credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const DRY_RUN  = process.argv.includes('--dry-run')
const MISSING  = process.argv.includes('--missing-only')
const RESET    = process.argv.includes('--reset')
const DELAY_MS = 250  // ~4 req/s — bem abaixo do quota diário de 10k units

// Canais/termos que indicam conteúdo oficial — boost no ranking
const OFFICIAL_SIGNALS = [
  'official', 'records', 'music', 'soundtrack', 'ost',
  'playstation', 'xbox', 'nintendo', 'sega', 'capcom',
  'bandai', 'namco', 'ubisoft', 'ea ', 'activision',
  'bethesda', 'blizzard', 'riot', 'valve', '2k', 'square',
  'fromsoft', 'cdprojekt', 'cd projekt', 'rockstar',
]

// Termos que descartam o resultado — não é OST do jogo
const DISCARD_SIGNALS = [
  ' rap ', 'rap by', ' rap|', 'with lyrics', 'song parody',
  'musical', ' cover ', 'acoustic cover', 'piano cover',
  'metal cover', 'guitar cover', 'ranked!!', 'ranked!',
  'tier list', 'reaction', 'theory', 'explained',
  'lofi', 'lo-fi', 'lo fi', 'chill mix', 'hip hop',
  'trap remix', 'remix',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function norm(str) {
  return (str ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function mainTitle(name) {
  const i = name.indexOf(':')
  return i !== -1 ? name.slice(i + 1).trim() : name
}

function officialScore(channelTitle) {
  const cn = norm(channelTitle)
  return OFFICIAL_SIGNALS.filter(s => cn.includes(s)).length
}

/**
 * Verifica se um videoId permite embedding.
 * Usa videos.list (custo: 1 unit) em vez de search (100 units).
 * Retorna true se status.embeddable === true.
 */
async function isEmbeddable(videoId) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'status')
  url.searchParams.set('id',   videoId)
  url.searchParams.set('key',  YT_KEY)

  const res = await fetch(url.toString())
  await sleep(DELAY_MS)

  if (!res.ok) return false
  const json = await res.json()
  return json.items?.[0]?.status?.embeddable === true
}

/**
 * Busca no YouTube e retorna o melhor video_id para o jogo.
 * Filtra vídeos com embedding desabilitado (Error 150/153).
 * Retorna { videoId, title, channelTitle } ou null.
 */
async function findYouTubeVideo(gameName) {
  const main     = mainTitle(gameName)
  const normFull = norm(gameName)
  const normMain = norm(main)

  const queries = [
    `"${main}" original soundtrack`,
    `"${gameName}" original soundtrack`,
    `${main} OST official`,
    `${gameName} soundtrack`,
    `${main} game music`,
  ]

  let best = null
  let bestScore = -1

  for (const q of queries) {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part',            'snippet')
    url.searchParams.set('q',               q)
    url.searchParams.set('type',            'video')
    url.searchParams.set('videoCategoryId', '10')       // Música
    url.searchParams.set('maxResults',      '8')
    url.searchParams.set('relevanceLanguage', 'en')
    url.searchParams.set('key',             YT_KEY)

    const res = await fetch(url.toString())
    await sleep(DELAY_MS)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err?.error?.code === 403) {
        console.error('\n❌ YouTube API quota excedido ou chave inválida')
        process.exit(1)
      }
      continue
    }

    const json  = await res.json()
    const items = json.items ?? []

    // Coleta candidatos válidos desta query
    const candidates = []
    for (const item of items) {
      const title   = item.snippet?.title ?? ''
      const channel = item.snippet?.channelTitle ?? ''
      const titleN  = norm(title)
      const chanN   = norm(channel)

      // Descarta RAPs, covers, parodies, remixes, etc.
      const isJunk = DISCARD_SIGNALS.some(s => titleN.includes(s) || chanN.includes(s))
      if (isJunk) continue

      // O título do vídeo PRECISA conter o nome do jogo (main ou full)
      const nameInTitle =
        titleN.includes(normFull) ||
        titleN.includes(normMain) ||
        (normMain.length > 6 && titleN.includes(normMain.slice(0, -2)))

      if (!nameInTitle) continue

      // Exige que o vídeo também mencione "ost", "soundtrack", "music", "theme" ou "score"
      const hasSoundtrackSignal =
        titleN.includes('ost') ||
        titleN.includes('soundtrack') ||
        titleN.includes('original') ||
        titleN.includes('music') ||
        titleN.includes('theme') ||
        titleN.includes('score') ||
        chanN.includes('soundtrack') ||
        chanN.includes('music') ||
        chanN.includes('ost')

      if (!hasSoundtrackSignal) continue

      const score = officialScore(channel) + officialScore(title)
      candidates.push({ videoId: item.id?.videoId, title, channelTitle: channel, score })
    }

    // Ordena por score desc e verifica embedding (custo: 1 unit por check)
    candidates.sort((a, b) => b.score - a.score)
    for (const candidate of candidates) {
      if (candidate.score <= bestScore) continue  // já temos algo melhor
      const embeddable = await isEmbeddable(candidate.videoId)
      if (!embeddable) {
        console.log(`         ⛔ ${candidate.videoId} bloqueado para embed — pulando`)
        continue
      }
      bestScore = candidate.score
      best = candidate
      break
    }

    // Resultado com score razoável — para de buscar mais queries
    if (bestScore >= 2) break
  }

  return best
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎮 Gamedle YouTube Populator ${DRY_RUN ? '[DRY RUN]' : ''} ${MISSING ? '[MISSING ONLY]' : ''} ${RESET ? '[RESET]' : ''}\n`)

  if (RESET && !DRY_RUN) {
    const { error } = await supabase
      .from('gamedle_pool')
      .update({ youtube_id: null, youtube_start: 0 })
      .eq('active', true)
    if (error) { console.error('❌ Reset falhou:', error.message); process.exit(1) }
    console.log('🗑️  youtube_id resetados\n')
  }

  let query = supabase
    .from('gamedle_pool')
    .select('id, name, youtube_id')
    .eq('active', true)
    .order('name')

  if (MISSING || RESET) query = query.is('youtube_id', null)

  const { data: games, error } = await query
  if (error) { console.error('❌ Erro ao buscar gamedle_pool:', error.message); process.exit(1) }

  console.log(`📋 ${games.length} games para processar\n`)

  const results = { found: [], notFound: [], skipped: [] }

  for (let i = 0; i < games.length; i++) {
    const game   = games[i]
    const prefix = `[${String(i + 1).padStart(3, '0')}/${games.length}]`

    if (game.youtube_id && !MISSING && !RESET) {
      results.skipped.push(game.name)
      console.log(`${prefix} ⏭  ${game.name}`)
      continue
    }

    const found = await findYouTubeVideo(game.name)

    if (found?.videoId) {
      results.found.push({ name: game.name, ...found })
      console.log(`${prefix} ✅ ${game.name}`)
      console.log(`         Vídeo:   ${found.title}`)
      console.log(`         Canal:   ${found.channelTitle}`)
      console.log(`         ID:      ${found.videoId}  (score=${found.score})`)

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from('gamedle_pool')
          .update({ youtube_id: found.videoId, youtube_start: 0 })
          .eq('id', game.id)

        if (updateErr) console.warn(`         ⚠️  Update falhou: ${updateErr.message}`)
      }
    } else {
      results.notFound.push(game.name)
      console.log(`${prefix} ❌ ${game.name} — sem resultado no YouTube`)
    }

    // Pausa extra a cada 25 games (evita burst na quota)
    if ((i + 1) % 25 === 0) await sleep(2000)
  }

  // ── Relatório ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log(`\n📊 Resultado:`)
  console.log(`   ✅ Encontrados:    ${results.found.length}`)
  console.log(`   ❌ Não encontrados: ${results.notFound.length}`)
  console.log(`   ⏭  Pulados:        ${results.skipped.length}`)

  const total    = results.found.length + results.notFound.length
  const coverage = total > 0 ? Math.round(results.found.length / total * 100) : 0
  console.log(`   📈 Cobertura:      ${coverage}%\n`)

  // Custo estimado de quota (search = 100 units/req, ~5 queries/game)
  const queriesUsed = results.found.length * 3 + results.notFound.length * 5  // estimativa
  console.log(`   🔢 Quota usada (estimado): ~${queriesUsed * 100} units de 10.000/dia\n`)

  if (results.notFound.length > 0) {
    console.log('⚠️  Games sem YouTube ID — curar manualmente:')
    results.notFound.forEach(n => console.log(`   - ${n}`))
    console.log()
  }

  if (DRY_RUN) console.log('ℹ️  Dry-run: nada foi salvo. Remova --dry-run para aplicar.\n')
}

main().catch(err => { console.error(err); process.exit(1) })
