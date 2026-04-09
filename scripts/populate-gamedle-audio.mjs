/**
 * Popula gamedle_pool.audio_url via Spotify API (preview clips de 30s, URLs estáveis).
 *
 * Estratégia:
 *   1. Autentica via Client Credentials (sem browser, sem redirect)
 *   2. Busca no Spotify por "{gameName} original soundtrack" e variações
 *   3. Valida se album/track contém o nome do jogo
 *   4. Salva preview_url (p.scdn.co/mp3-preview/... — sem expiração)
 *   5. Logs de cobertura ao final
 *
 * Uso:
 *   node scripts/populate-gamedle-audio.mjs [--dry-run] [--missing-only] [--reset]
 *
 *   --dry-run      Mostra resultados sem salvar no DB
 *   --missing-only Só processa games que ainda não têm audio_url
 *   --reset        Limpa todas as audio_url antes de repopular (substitui Deezer expirados)
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
const SPOTIFY_ID    = env.SPOTIFY_CLIENT_ID     ?? 'e4c0c9a65c9b48d9aee67cef8651e5ee'
const SPOTIFY_SEC   = env.SPOTIFY_CLIENT_SECRET ?? '4ea99f84135b40e8b73013d7e77f9ba5'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Supabase URL ou Service Key não encontrados em apps/web/.env.local')
  process.exit(1)
}

const supabase  = createClient(SUPABASE_URL, SERVICE_KEY)
const DRY_RUN   = process.argv.includes('--dry-run')
const MISSING   = process.argv.includes('--missing-only')
const RESET     = process.argv.includes('--reset')
const DELAY_MS  = 200  // ~5 req/s — seguro para Spotify (rate limit: ~180 req/min)

// Games cuja audio_url foi fixada manualmente — não sobrescrever
const MANUAL_OVERRIDES = new Set([
  'God of War (2018)',
  'Sekiro: Shadows Die Twice',
  'Resident Evil 2 (2019)',
  'Path of Exile',
])

// ─── Spotify Auth ─────────────────────────────────────────────────────────────

let spotifyToken = null
let tokenExpiry  = 0

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken

  const creds = Buffer.from(`${SPOTIFY_ID}:${SPOTIFY_SEC}`).toString('base64')
  const res   = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    'grant_type=client_credentials',
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Spotify auth falhou: ${res.status} ${txt}`)
  }

  const json   = await res.json()
  spotifyToken = json.access_token
  tokenExpiry  = Date.now() + (json.expires_in - 60) * 1000  // renova 60s antes
  return spotifyToken
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function norm(str) {
  return (str ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function mainTitle(name) {
  const colonIdx = name.indexOf(':')
  return colonIdx !== -1 ? name.slice(colonIdx + 1).trim() : name
}

async function spotifySearch(query) {
  const token = await getSpotifyToken()
  const url   = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&market=US`
  const res   = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
  if (!res.ok) return []
  const json  = await res.json()
  return json.tracks?.items ?? []
}

async function findAudio(gameName) {
  const main     = mainTitle(gameName)
  const normFull = norm(gameName)
  const normMain = norm(main)

  const queries = [
    `${main} original soundtrack`,
    `${gameName} original soundtrack`,
    `${main} OST`,
    `${gameName} OST`,
    `${main} soundtrack`,
    `${gameName} game music`,
  ]

  for (const q of queries) {
    const tracks = await spotifySearch(q)
    await sleep(DELAY_MS)

    for (const t of tracks) {
      if (!t.preview_url) continue  // sem preview → pula

      const albumNorm  = norm(t.album?.name ?? '')
      const titleNorm  = norm(t.name ?? '')
      const artistNorm = norm(t.artists?.map(a => a.name).join(' ') ?? '')

      const match =
        albumNorm.includes(normMain) ||
        albumNorm.includes(normFull) ||
        titleNorm.includes(normMain) ||
        (normMain.length > 5 && albumNorm.startsWith(normMain.slice(0, normMain.length - 2))) ||
        // fallback: artista contém o nome do jogo (ex: "Red Dead Redemption 2 Soundtrack")
        (artistNorm.includes(normMain) && (albumNorm.includes('soundtrack') || albumNorm.includes('ost')))

      if (match) {
        return {
          url:    t.preview_url,
          track:  t.name,
          album:  t.album?.name,
          artist: t.artists?.map(a => a.name).join(', '),
        }
      }
    }
  }

  return null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎮 Gamedle Audio Populator [Spotify] ${DRY_RUN ? '[DRY RUN]' : ''} ${MISSING ? '[MISSING ONLY]' : ''} ${RESET ? '[RESET]' : ''}\n`)

  // Autentica antes de começar
  await getSpotifyToken()
  console.log('✅ Spotify autenticado\n')

  // Limpa audio_url se --reset (exceto overrides manuais)
  if (RESET && !DRY_RUN) {
    const { error } = await supabase
      .from('gamedle_pool')
      .update({ audio_url: null })
      .eq('active', true)
      .not('name', 'in', `(${[...MANUAL_OVERRIDES].map(n => `"${n}"`).join(',')})`)

    if (error) { console.error('❌ Reset falhou:', error.message); process.exit(1) }
    console.log('🗑️  audio_url resetadas (exceto overrides manuais)\n')
  }

  // Busca games
  let query = supabase
    .from('gamedle_pool')
    .select('id, name, audio_url')
    .eq('active', true)
    .order('name')

  if (MISSING || RESET) {
    query = query.is('audio_url', null)
  }

  const { data: games, error } = await query
  if (error) { console.error('❌ Erro ao buscar gamedle_pool:', error.message); process.exit(1) }

  console.log(`📋 ${games.length} games para processar\n`)

  const results = { found: [], notFound: [], skipped: [] }

  for (let i = 0; i < games.length; i++) {
    const game   = games[i]
    const prefix = `[${String(i + 1).padStart(3, '0')}/${games.length}]`

    if (game.audio_url && !MISSING && !RESET) {
      results.skipped.push(game.name)
      console.log(`${prefix} ⏭  ${game.name} (já tem URL)`)
      continue
    }

    if (MANUAL_OVERRIDES.has(game.name)) {
      results.skipped.push(game.name)
      console.log(`${prefix} 🔒 ${game.name} (override manual — preservado)`)
      continue
    }

    const found = await findAudio(game.name)

    if (found) {
      results.found.push({ name: game.name, ...found })
      console.log(`${prefix} ✅ ${game.name}`)
      console.log(`         Album:  ${found.album}`)
      console.log(`         Track:  ${found.track}`)
      console.log(`         Artist: ${found.artist}`)
      console.log(`         URL:    ${found.url}`)

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from('gamedle_pool')
          .update({ audio_url: found.url })
          .eq('id', game.id)

        if (updateErr) console.warn(`         ⚠️  Update falhou: ${updateErr.message}`)
      }
    } else {
      results.notFound.push(game.name)
      console.log(`${prefix} ❌ ${game.name} — sem preview no Spotify`)
    }

    if ((i + 1) % 30 === 0) await sleep(1000)
  }

  // ── Relatório ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log(`\n📊 Resultado:`)
  console.log(`   ✅ Encontrados:   ${results.found.length}`)
  console.log(`   ❌ Não encontrados: ${results.notFound.length}`)
  console.log(`   ⏭  Pulados:       ${results.skipped.length}`)

  const total    = results.found.length + results.notFound.length
  const coverage = total > 0 ? Math.round(results.found.length / total * 100) : 0
  console.log(`   📈 Cobertura:     ${coverage}%\n`)

  if (results.notFound.length > 0) {
    console.log('⚠️  Games sem áudio (revisar via KHInsider/R2):')
    results.notFound.forEach(n => console.log(`   - ${n}`))
    console.log()
  }

  if (DRY_RUN) {
    console.log('ℹ️  Dry-run: nada foi salvo. Remova --dry-run para aplicar.\n')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
