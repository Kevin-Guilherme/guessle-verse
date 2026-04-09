/**
 * Patch manual de audio_url para 4 jogos que o Deezer não encontrou.
 *
 * Fontes:
 *   - God of War (2018): Deezer — Bear McCreary, álbum "God of War (PlayStation Soundtrack)"
 *   - Sekiro: Deezer — "Sekiro: Shadows Die Twice" (arr. Payu), título reconhecível
 *   - RE2 (2019): Archive.org — OST oficial, "1-01 Saudade.mp3"
 *   - Path of Exile: KHInsider CDN — "The Fall of Oriath (Main Theme)"
 *
 * Uso:
 *   node scripts/patch-gamedle-audio-manual.mjs [--dry-run]
 */

import { readFileSync } from 'fs'
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Supabase URL ou Service Key não encontrados em apps/web/.env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const DRY_RUN  = process.argv.includes('--dry-run')

// igdb_id → { name, audio_url, source }
const PATCHES = [
  {
    igdb_id: 37663,
    name: 'God of War (2018)',
    audio_url: 'https://cdnt-preview.dzcdn.net/api/1/1/5/1/e/0/51eef7d348e906b0168973331d6f6c1e.mp3',
    source: 'Deezer — Bear McCreary / God of War (PlayStation Soundtrack)',
  },
  {
    igdb_id: 70111,
    name: 'Sekiro: Shadows Die Twice',
    audio_url: 'https://cdnt-preview.dzcdn.net/api/1/1/4/5/a/0/45a973f5113f5d6f054437da78741614.mp3',
    source: 'Deezer — "Sekiro, The One-Armed Wolf" (arr. Payu)',
  },
  {
    igdb_id: 101553,
    name: 'Resident Evil 2 (2019)',
    audio_url: 'https://archive.org/download/19-police-station-basement/1-01%20Saudade.mp3',
    source: 'Archive.org — RE2 OST disc 1, track 01 "Saudade"',
  },
  {
    igdb_id: 15375,
    name: 'Path of Exile',
    audio_url: 'https://jetta.vgmtreasurechest.com/soundtracks/path-of-exile-soundtrack/hzaclzpy/01.%20The%20Fall%20of%20Oriath%20%28Main%20Theme%29.mp3',
    source: 'KHInsider CDN — "The Fall of Oriath (Main Theme)" ⚠️ token pode expirar',
  },
]

async function main() {
  console.log(`\n🎮 Gamedle Audio — Patch Manual ${DRY_RUN ? '[DRY RUN]' : ''}\n`)

  for (const p of PATCHES) {
    console.log(`🔧 ${p.name}`)
    console.log(`   URL:    ${p.audio_url}`)
    console.log(`   Fonte:  ${p.source}`)

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('gamedle_pool')
        .update({ audio_url: p.audio_url })
        .eq('igdb_id', p.igdb_id)

      if (error) {
        console.error(`   ❌ Erro: ${error.message}`)
      } else {
        console.log(`   ✅ Atualizado`)
      }
    } else {
      console.log(`   ⏭  Dry-run — não salvo`)
    }

    console.log()
  }

  if (DRY_RUN) {
    console.log('ℹ️  Modo dry-run: nada foi salvo.\n   Remova --dry-run para aplicar.\n')
  } else {
    console.log('✅ Patch completo.\n')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
