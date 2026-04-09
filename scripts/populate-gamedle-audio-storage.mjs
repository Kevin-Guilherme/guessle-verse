/**
 * Popula gamedle_pool.audio_url com clipes hospedados no Supabase Storage.
 *
 * Fluxo por jogo:
 *   1. Busca track no Deezer API público (sem auth)
 *   2. Baixa o preview MP3 de 30s
 *   3. Faz upload para bucket `soundtrack-previews` no Supabase Storage
 *   4. Salva URL pública permanente no DB
 *
 * Uso:
 *   node scripts/populate-gamedle-audio-storage.mjs [--dry-run] [--missing-only] [--game "Nome do Jogo"]
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const envPath    = resolve(__dirname, '../apps/web/.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env        = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET       = 'soundtrack-previews'
const DELAY_MS     = 300
const DRY_RUN      = process.argv.includes('--dry-run')
const MISSING_ONLY = process.argv.includes('--missing-only')
const GAME_FILTER  = (() => {
  const i = process.argv.indexOf('--game')
  return i !== -1 ? process.argv[i + 1] : null
})()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Supabase URL ou Service Key não encontrados')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Deezer search ────────────────────────────────────────────────────────────

const DISCARD = ['cover', 'remix', 'lofi', 'lo-fi', 'piano', 'acoustic', 'tribute', 'karaoke']

async function searchDeezer(gameName) {
  const queries = [
    `${gameName} original soundtrack`,
    `${gameName} OST`,
    `${gameName} theme`,
    `${gameName} game music`,
  ]

  for (const q of queries) {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`
    let res
    try { res = await fetch(url) } catch { continue }
    await sleep(DELAY_MS)
    if (!res.ok) continue

    const json = await res.json()
    const tracks = json.data ?? []

    for (const t of tracks) {
      if (!t.preview) continue
      const titleLow = (t.title + ' ' + t.artist.name + ' ' + (t.album?.title ?? '')).toLowerCase()
      const isJunk   = DISCARD.some(d => titleLow.includes(d))
      if (isJunk) continue
      // Precisa mencionar o jogo no título do álbum ou do track
      const gameWords = gameName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(' ').filter(w => w.length > 3)
      const relevant  = gameWords.some(w => titleLow.includes(w))
      if (!relevant) continue
      return { preview: t.preview, title: t.title, artist: t.artist.name, album: t.album?.title }
    }
  }
  return null
}

// ─── Download MP3 bytes ───────────────────────────────────────────────────────

async function downloadMp3(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  return Buffer.from(buf)
}

// ─── Supabase Storage upload ──────────────────────────────────────────────────

async function ensureBucket() {
  const { data: buckets } = await sb.storage.listBuckets()
  const exists = buckets?.some(b => b.name === BUCKET)
  if (exists) return
  const { error } = await sb.storage.createBucket(BUCKET, { public: true })
  if (error) throw new Error(`Criar bucket: ${error.message}`)
  console.log(`✅ Bucket "${BUCKET}" criado`)
}

async function uploadMp3(slug, buffer) {
  const path = `${slug}.mp3`
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true })
  if (error) throw new Error(`Upload: ${error.message}`)
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎵 Gamedle Audio Storage Populator ${DRY_RUN ? '[DRY RUN]' : ''} ${MISSING_ONLY ? '[MISSING ONLY]' : ''}\n`)

  if (!DRY_RUN) await ensureBucket()

  let query = sb.from('gamedle_pool').select('id, name, audio_url').eq('active', true).order('name')
  if (MISSING_ONLY) query = query.is('audio_url', null)
  if (GAME_FILTER)  query = query.ilike('name', `%${GAME_FILTER}%`)

  const { data: games, error } = await query
  if (error) { console.error('❌', error.message); process.exit(1) }

  console.log(`📋 ${games.length} games para processar\n`)

  const results = { ok: [], notFound: [], failed: [] }

  for (let i = 0; i < games.length; i++) {
    const game   = games[i]
    const prefix = `[${String(i + 1).padStart(3, '0')}/${games.length}]`
    const slug   = slugify(game.name)

    // Pula se já tem áudio hospedado no Storage (não é URL do Deezer expirada)
    if (!MISSING_ONLY && game.audio_url?.includes(SUPABASE_URL)) {
      console.log(`${prefix} ⏭  ${game.name} (já no Storage)`)
      results.ok.push(game.name)
      continue
    }

    process.stdout.write(`${prefix} 🔍 ${game.name} ... `)

    const track = await searchDeezer(game.name)
    if (!track) {
      console.log('❌ sem resultado no Deezer')
      results.notFound.push(game.name)
      continue
    }

    console.log(`\n         Track: ${track.title} — ${track.artist}`)
    console.log(`         Album: ${track.album}`)

    if (DRY_RUN) {
      console.log(`         Preview: ${track.preview}`)
      results.ok.push(game.name)
      continue
    }

    try {
      const buffer    = await downloadMp3(track.preview)
      const publicUrl = await uploadMp3(slug, buffer)
      console.log(`         ✅ ${publicUrl}`)

      const { error: upErr } = await sb
        .from('gamedle_pool')
        .update({ audio_url: publicUrl })
        .eq('id', game.id)

      if (upErr) throw new Error(upErr.message)
      results.ok.push(game.name)
    } catch (err) {
      console.log(`         ❌ Erro: ${err.message}`)
      results.failed.push({ name: game.name, error: err.message })
    }

    await sleep(200)
  }

  // ── Relatório ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log(`\n📊 Resultado:`)
  console.log(`   ✅ OK:           ${results.ok.length}`)
  console.log(`   ❌ Não encontrado: ${results.notFound.length}`)
  console.log(`   💥 Erro upload:   ${results.failed.length}\n`)

  if (results.notFound.length) {
    console.log('⚠️  Sem resultado no Deezer — curar manualmente:')
    results.notFound.forEach(n => console.log(`   - ${n}`))
  }

  if (results.failed.length) {
    console.log('\n💥 Falhas:')
    results.failed.forEach(({ name, error }) => console.log(`   - ${name}: ${error}`))
  }

  if (DRY_RUN) console.log('\nℹ️  Dry-run — nada foi salvo. Remova --dry-run para aplicar.\n')
}

main().catch(err => { console.error(err); process.exit(1) })
