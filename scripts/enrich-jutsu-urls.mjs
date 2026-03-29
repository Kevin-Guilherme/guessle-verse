/**
 * Enriquece jutsu_video_url para personagens Naruto sem mídia de jutsu.
 * Para cada personagem ativo com extra.jutsus[] mas sem extra.jutsu_video_url,
 * tenta buscar um GIF ou imagem da Naruto wiki (Fandom) para o primeiro jutsu disponível.
 *
 * Estratégia por jutsu:
 *   1. Lista todas as imagens da página do jutsu via MediaWiki API
 *   2. Prefere arquivos .gif (animados)
 *   3. Fallback: pageimages (thumbnail do infobox)
 *   4. Obtém a URL direta do arquivo via imageinfo API
 *
 * Usage:
 *   node scripts/enrich-jutsu-urls.mjs
 *   node scripts/enrich-jutsu-urls.mjs --theme-id=2
 *   node scripts/enrich-jutsu-urls.mjs --dry-run
 */
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'

const SUPABASE_URL = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'
const WIKI_API     = 'https://naruto.fandom.com/api.php'
const REQUEST_DELAY = 1500 // ms between wiki requests

const DRY_RUN  = process.argv.includes('--dry-run')
const themeArg = process.argv.find(a => a.startsWith('--theme-id='))
const THEME_ID = themeArg ? Number(themeArg.split('=')[1]) : 2

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Wiki helpers ──────────────────────────────────────────────────────────────

async function wikiGet(params) {
  const url = new URL(WIKI_API)
  url.search = new URLSearchParams({ format: 'json', ...params }).toString()
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'GuessleBot/1.0 (enriching jutsu media)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Wiki API HTTP ${res.status}`)
  return res.json()
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Retorna a URL direta de um arquivo da wiki (ex: "File:Rasengan.gif").
 */
async function getFileUrl(fileTitle) {
  const json = await wikiGet({
    action: 'query',
    titles: fileTitle,
    prop: 'imageinfo',
    iiprop: 'url',
  })
  const pages = Object.values(json.query?.pages ?? {})
  return pages[0]?.imageinfo?.[0]?.url ?? null
}

/**
 * Para um dado nome de jutsu, tenta obter uma URL de GIF ou imagem.
 * Retorna { url, source } ou null.
 */
async function fetchJutsuMedia(jutsuName) {
  await sleep(REQUEST_DELAY)

  // Passo 1: lista imagens da página do jutsu
  let images = []
  try {
    const json = await wikiGet({
      action: 'query',
      titles: jutsuName,
      prop: 'images',
      imlimit: '30',
    })
    const pages = Object.values(json.query?.pages ?? {})
    if (pages[0]?.missing !== undefined) return null // página não existe
    images = (pages[0]?.images ?? []).map(i => i.title)
  } catch {
    return null
  }

  // Passo 2: prefere GIFs
  const gifs = images.filter(t => /\.gif$/i.test(t))
  if (gifs.length > 0) {
    // Descarta ícones/logos pequenos — prefere o que tem o nome do jutsu no arquivo
    const named = gifs.find(t => {
      const lower = t.toLowerCase().replace('file:', '')
      const jutsuLower = jutsuName.toLowerCase().replace(/[^a-z]/g, '')
      const fileLower  = lower.replace(/[^a-z]/g, '')
      return fileLower.includes(jutsuLower.slice(0, 6))
    })
    const target = named ?? gifs[0]
    try {
      await sleep(REQUEST_DELAY)
      const url = await getFileUrl(target)
      if (url) return { url, source: 'gif', file: target }
    } catch { /* fall through */ }
  }

  // Passo 3: fallback para pageimages (thumbnail do infobox)
  try {
    await sleep(REQUEST_DELAY)
    const json = await wikiGet({
      action: 'query',
      titles: jutsuName,
      prop: 'pageimages',
      pithumbsize: '600',
      pilimit: '1',
    })
    const pages = Object.values(json.query?.pages ?? {})
    const thumb = pages[0]?.thumbnail?.source
    if (thumb) return { url: thumb, source: 'thumbnail', file: null }
  } catch { /* ignore */ }

  // Passo 4: fallback — primeira imagem que não seja ícone
  const nonIcon = images.find(t => !/icon|logo|symbol|headband/i.test(t) && /\.(png|jpe?g|webp|gif)$/i.test(t))
  if (nonIcon) {
    try {
      await sleep(REQUEST_DELAY)
      const url = await getFileUrl(nonIcon)
      if (url) return { url, source: 'image', file: nonIcon }
    } catch { /* ignore */ }
  }

  return null
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('🔍 DRY-RUN — sem salvar no banco\n')

  // Busca o theme_id correto
  const { data: theme } = await supabase
    .from('themes')
    .select('id, name')
    .eq('id', THEME_ID)
    .single()

  if (!theme) { console.error(`theme_id=${THEME_ID} não encontrado`); process.exit(1) }
  console.log(`🎯 Tema: ${theme.name} (id=${theme.id})\n`)

  // Carrega personagens ativos com jutsus mas sem jutsu_video_url
  const { data: chars, error } = await supabase
    .from('characters')
    .select('id, name, extra')
    .eq('theme_id', THEME_ID)
    .eq('active', true)
    .not('extra->jutsus', 'is', null)
    .order('name')

  if (error) { console.error(error.message); process.exit(1) }

  const pending = chars.filter(c => !c.extra?.jutsu_video_url)
  console.log(`📋 Personagens com jutsus: ${chars.length} total, ${pending.length} sem jutsu_video_url\n`)
  if (pending.length === 0) { console.log('✅ Nada a processar'); return }

  let success = 0, failed = 0, skipped = 0

  for (const char of pending) {
    const jutsus = char.extra?.jutsus ?? []
    if (jutsus.length === 0) { skipped++; continue }

    let found = null
    let chosenJutsu = null

    for (const jutsu of jutsus) {
      process.stdout.write(`  [${char.name}] → ${jutsu.slice(0, 40)}... `)
      try {
        const result = await fetchJutsuMedia(jutsu)
        if (result) {
          found = result
          chosenJutsu = jutsu
          console.log(`✅ ${result.source} — ${result.url.slice(0, 60)}`)
          break
        } else {
          console.log('⚠️  sem mídia')
        }
      } catch (err) {
        console.log(`❌ erro: ${err.message}`)
      }
    }

    if (!found) {
      console.log(`  ❌ ${char.name}: nenhum jutsu com mídia encontrado`)
      failed++
      continue
    }

    if (!DRY_RUN) {
      const newExtra = {
        ...(char.extra ?? {}),
        jutsu_video_url: found.url,
        jutsu_name: chosenJutsu,
      }
      const { error: updateErr } = await supabase
        .from('characters')
        .update({ extra: newExtra })
        .eq('id', char.id)

      if (updateErr) {
        console.error(`  ❌ DB error para ${char.name}: ${updateErr.message}`)
        failed++
        continue
      }
    }

    success++
  }

  console.log(`\n📊 Concluído: ${success} atualizados, ${failed} falhas, ${skipped} sem jutsus`)
  if (DRY_RUN) console.log('(DRY RUN — nenhuma alteração salva)')
}

main().catch(e => { console.error(e); process.exit(1) })
