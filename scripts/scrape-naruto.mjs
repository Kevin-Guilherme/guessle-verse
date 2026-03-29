/**
 * scrape-naruto.mjs
 * Full re-scrape of Naruto characters from naruto.fandom.com
 * Populates characters table with 7 classic cols + extra (quotes, jutsu)
 * Filters: active=true only if appears_in contains Manga or Anime
 *          active=false for names with " (" (Part II, Boruto variants)
 *          active=false if debut_arc contains Boruto-era arc names
 */

import { parse } from './node_modules/node-html-parser/dist/index.js'
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL    = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'
const WIKI_HOST       = 'naruto.fandom.com'
const CATEGORY        = 'Characters'
const THEME_SLUG      = 'naruto'
const CHUNK_SIZE      = 50
const DELAY_MS        = 300   // polite delay between page fetches

// Boruto-era debut arcs — chars debuting here are Boruto-only
const BORUTO_ARC_MARKERS = [
  'boruto', 'kawaki', 'code', 'eida', 'ada', 'daemon',
  'kara', 'ōtsutsuki god', 'omnipotence',
]

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchMediaWikiApi(params, retries = 4) {
  const qs  = new URLSearchParams({ ...params, format: 'json' })
  const url = `https://${WIKI_HOST}/api.php?${qs}`
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GuessleBot/2.0 (daily game platform; non-commercial)' },
    })
    if (res.ok) return res.json()
    if ((res.status === 503 || res.status === 429) && attempt <= retries) {
      await sleep(5000 * attempt)
      continue
    }
    throw new Error(`MediaWiki ${res.status} ${url}`)
  }
}

async function getCategoryPage(cmcontinue) {
  const params = {
    action: 'query', list: 'categorymembers',
    cmtitle: `Category:${CATEGORY}`, cmtype: 'page',
    cmlimit: String(CHUNK_SIZE), cmnamespace: '0',
  }
  if (cmcontinue) params.cmcontinue = cmcontinue

  const data      = await fetchMediaWikiApi(params)
  const members   = data?.query?.categorymembers ?? []
  const titles    = members.map(m => m.title)
  const nextToken = data?.['query-continue']?.categorymembers?.cmcontinue
                 ?? data?.continue?.cmcontinue
                 ?? null
  return { titles, nextToken }
}

async function getPageHtml(title) {
  const data = await fetchMediaWikiApi({ action: 'parse', page: title, prop: 'text' })
  return data?.parse?.text?.['*'] ?? ''
}

// ─── Infobox extractor ───────────────────────────────────────────────────────

function extractInfobox(html) {
  const root    = parse(html)
  const result  = {}
  const debuted = {}   // { Manga: "Naruto Chapter #1", Anime: "Naruto Episode #1", ... }

  // Naruto wiki uses old MediaWiki table.infobox — portable-infobox not used
  const table = root.querySelector('table.infobox')
  if (table) {
    for (const tr of table.querySelectorAll('tr')) {
      const th = tr.querySelector('th')
      const td = tr.querySelector('td')
      if (!th || !td) continue

      const thText = th.text.trim()

      // Capture debut rows (Manga, Anime, etc.) by their exact TH label
      if (DEBUT_ROW_KEYS.includes(thText)) {
        debuted[thText] = td.text.replace(/\s+/g, ' ').trim()
        continue
      }

      const key     = thText.toLowerCase().replace(/\s+/g, '_')
      const anchors = td.querySelectorAll('a')
      let val
      if (anchors.length > 0) {
        const parts = []
        for (const a of anchors) {
          const t = (a.getAttribute('title') ?? a.text).replace(/\[.*?\]/g, '').trim()
          if (t && !parts.includes(t)) parts.push(t)
        }
        val = parts.join(', ')
      } else {
        val = td.text.trim().replace(/\s+/g, ' ')
      }
      if (key && val) result[key] = val
    }
  }

  return { infobox: result, debuted, root }
}

// ─── Attribute map ────────────────────────────────────────────────────────────

const ATTR_MAP = {
  sex:            'genero',
  gender:         'genero',
  affiliation:    'afiliacao',
  kekkei_genkai:  'kekkei_genkai',
  nature_type:    'nature_types',
  classification: '_class_raw',
  clan:           'cla',
  debut_arc:      'debut_arc',
  appears_in:     '_appears_in',
}

// These infobox row TH labels hold the debut chapter/episode values
// e.g. "Manga" → "Naruto Chapter #1" (original) or "Boruto Chapter #56" (Boruto-only)
const DEBUT_ROW_KEYS = ['Manga', 'Anime', 'Novel', 'Movie', 'Game', 'OVA']

// ─── Per-character scraper ───────────────────────────────────────────────────

async function scrapeCharacter(title) {
  const html                          = await getPageHtml(title)
  if (!html) return null
  const { infobox, debuted, root }    = extractInfobox(html)
  if (!Object.keys(infobox).length && !Object.keys(debuted).length) return null

  // Map infobox keys → our attribute keys
  // Old-format wiki uses lowercase_underscored keys
  const raw = {}
  for (const [infoboxKey, attrKey] of Object.entries(ATTR_MAP)) {
    // Try original key first, then lowercase_underscored variant
    const val = infobox[infoboxKey]
             ?? infobox[infoboxKey.toLowerCase()]
             ?? infobox[infoboxKey.toLowerCase().replace(/\s+/g, '_')]
    if (val) raw[attrKey] = val
  }

  // ── Boruto detection via debut rows ───────────────────────────────────
  // "Manga" row = "Boruto Chapter #X" → Boruto-only character
  // "Manga" row = "Naruto Chapter #X" → original Naruto character
  const mangaDebut = String(debuted['Manga'] ?? debuted['Anime'] ?? '').toLowerCase()
  const isBorutoOnly = mangaDebut.startsWith('boruto') ||
                       (mangaDebut !== '' && !mangaDebut.startsWith('naruto') &&
                        BORUTO_ARC_MARKERS.some(m => mangaDebut.includes(m)))

  // ── appears_in filter (secondary check) ───────────────────────────────
  const appearsIn = String(raw['_appears_in'] ?? '').toLowerCase()
  const hasNoMediaEntry = appearsIn !== '' && !appearsIn.includes('manga') && !appearsIn.includes('anime')
  delete raw['_appears_in']

  // active=true only if: has manga/anime entry AND not a Boruto-only debut
  const active = !isBorutoOnly && !hasNoMediaEntry

  // ── afiliacao: first org only ──────────────────────────────────────────
  if (raw['afiliacao']) {
    const byComma = raw['afiliacao'].split(/,\s*/).filter(Boolean)
    raw['afiliacao'] = byComma.length > 1
      ? byComma[0].trim()
      : raw['afiliacao'].split(/\s+(?=[A-Z])/)[0].trim()
  }

  // ── _class_raw: split into jutsu_types + classification ───────────────
  const rawClass = raw['_class_raw'] ?? ''
  if (rawClass) {
    const items    = rawClass.split(',').map(s => s.trim()).filter(Boolean)
    const jutsuT   = items.filter(s => s.toLowerCase().includes('jutsu'))
    const charAttr = items.filter(s => !s.toLowerCase().includes('jutsu'))
    if (jutsuT.length)   raw['jutsu_types']    = jutsuT.join(', ')
    if (charAttr.length) raw['classification'] = charAttr.join(', ')
    delete raw['_class_raw']
  }

  // ── Nature types from cellbox (more reliable than infobox) ────────────
  const cellboxes = root.querySelectorAll('table.cellbox')
  let natureCb = null
  let jutsuCb  = null
  for (const tb of cellboxes) {
    const label = tb.querySelector('th')?.text.trim()
    if (label === 'Nature Type') natureCb = tb
    if (label === 'Jutsu')       jutsuCb  = tb
  }

  if (natureCb) {
    const natures = []
    for (const a of natureCb.querySelectorAll('a')) {
      const t = a.getAttribute('title') ?? ''
      if (t && !natures.includes(t)) natures.push(t)
    }
    if (natures.length) raw['nature_types'] = natures.join(', ')
  }

  // ── Build final attributes (7 classic cols, fallback 'None') ──────────
  const CLASSIC_COLS = ['genero', 'afiliacao', 'jutsu_types', 'kekkei_genkai', 'nature_types', 'classification', 'debut_arc']
  const attributes = {}
  for (const col of CLASSIC_COLS) {
    attributes[col] = raw[col] ?? 'None'
  }
  // Clan goes to extra (not in classic grid but useful)
  const clan = raw['cla'] ?? null

  // ── Image URL ─────────────────────────────────────────────────────────
  const allImgs = root.querySelectorAll('.infobox img, .pi-image-thumbnail, .pi-image img, figure img')
  let imageUrl = null
  for (const el of allImgs) {
    const src = el.getAttribute('src') ?? ''
    if (/\.(png|jpg|jpeg|webp)/i.test(src)) { imageUrl = src; break }
  }

  // ── Jutsu (first from cellbox) ─────────────────────────────────────────
  let jutsuName     = null
  let jutsuImageUrl = null
  let jutsuVideoUrl = null

  if (jutsuCb) {
    for (const a of jutsuCb.querySelectorAll('a')) {
      jutsuName = a.getAttribute('title') ?? null
      if (jutsuName) break
    }
  }

  if (jutsuName) {
    try {
      const jHtml  = await getPageHtml(jutsuName)
      const jRoot  = parse(jHtml)
      const vidSrc = jRoot.querySelector('video source, source[type*="video"]')?.getAttribute('src') ?? null
      let jImgUrl  = null
      for (const el of jRoot.querySelectorAll('.infobox img, .pi-image-thumbnail, .pi-image img, figure img')) {
        const src = el.getAttribute('src') ?? ''
        if (/\.(png|jpg|jpeg|webp)/i.test(src)) { jImgUrl = src; break }
      }
      if (vidSrc)  jutsuVideoUrl = vidSrc
      if (jImgUrl) jutsuImageUrl = jImgUrl
      await sleep(200)
    } catch { /* non-fatal */ }
  }

  // ── Quotes ────────────────────────────────────────────────────────────
  let quotes = []
  const quoteRegex = /[\u201c"\u00ab]([^\u201d"\u00bb]{15,250})[\u201d"\u00bb]/

  const extractQuotes = (r) => {
    for (const el of r.querySelectorAll('blockquote, .quote-content, .cited-quote, p, li')) {
      const text  = el.text.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim()
      const match = text.match(quoteRegex)
      if (match) quotes.push(match[1].trim())
    }
  }

  try {
    const qHtml = await getPageHtml(`${title}/Quotes`)
    extractQuotes(parse(qHtml))
    await sleep(200)
  } catch { /* /Quotes page may not exist */ }

  if (quotes.length === 0) extractQuotes(root)

  // Deduplicate + filter out name references
  const nameLower = title.toLowerCase()
  quotes = [...new Set(quotes)]
    .filter(q => !q.toLowerCase().includes(nameLower))
    .slice(0, 20)

  return {
    name:      title,
    image_url: imageUrl,
    active,
    attributes,
    extra: {
      clan:           clan,
      quotes,
      jutsu_name:     jutsuName,
      jutsu_image_url: jutsuImageUrl,
      jutsu_video_url: jutsuVideoUrl,
    },
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Get naruto theme_id
  const { data: themeRows } = await supabase.from('themes').select('id').eq('slug', THEME_SLUG).single()
  const themeId = themeRows?.id
  if (!themeId) { console.error('Theme not found'); process.exit(1) }
  console.log(`theme_id=${themeId}`)

  let cmcontinue   = ''
  let pageNum      = 0
  let totalUpserted = 0
  let totalSkipped  = 0
  let totalInactive = 0

  while (true) {
    pageNum++
    console.log(`\n─── Chunk ${pageNum} (cmcontinue="${cmcontinue || 'START'}") ───`)

    let titles, nextToken
    let catRetries = 0
    while (true) {
      try {
        ({ titles, nextToken } = await getCategoryPage(cmcontinue))
        break
      } catch (err) {
        catRetries++
        if (catRetries >= 5) { console.error('Category fetch error (gave up):', err.message); break }
        console.warn(`  Category fetch error (retry ${catRetries}/5): ${err.message}`)
        await sleep(5000 * catRetries)
      }
    }
    if (!titles) break

    console.log(`  Got ${titles.length} titles`)

    for (const title of titles) {
      // Skip variant/alternate-form pages
      if (title.includes(' (')) {
        await supabase.from('characters').upsert(
          { theme_id: themeId, name: title, active: false, attributes: {}, extra: { quotes: [] } },
          { onConflict: 'theme_id,name' }
        )
        totalInactive++
        process.stdout.write(`  [SKIP variant] ${title}\n`)
        continue
      }

      try {
        const char = await scrapeCharacter(title)

        if (!char || !Object.keys(char.attributes).length) {
          totalSkipped++
          process.stdout.write(`  [SKIP no data] ${title}\n`)
          await sleep(DELAY_MS)
          continue
        }

        const { error } = await supabase.from('characters').upsert(
          {
            theme_id:  themeId,
            name:      char.name,
            image_url: char.image_url,
            active:    char.active,
            attributes: char.attributes,
            extra:      char.extra,
          },
          { onConflict: 'theme_id,name' }
        )

        if (error) {
          console.error(`  [ERROR] ${title}: ${error.message}`)
        } else {
          totalUpserted++
          const flags = [
            char.active                                   ? 'active'  : 'inactive',
            char.extra.jutsu_image_url || char.extra.jutsu_video_url ? 'jutsu'  : '',
            char.extra.quotes.length > 0                  ? `quotes(${char.extra.quotes.length})` : '',
          ].filter(Boolean).join(' ')
          process.stdout.write(`  [OK] ${title.padEnd(35)} ${flags}\n`)
        }

        await sleep(DELAY_MS)
      } catch (err) {
        console.error(`  [ERROR] ${title}:`, err.message)
        await sleep(DELAY_MS)
      }
    }

    console.log(`\n  Chunk ${pageNum} done. Total upserted=${totalUpserted} inactive=${totalInactive} skipped=${totalSkipped}`)

    if (!nextToken) {
      console.log('\n✅ All pages exhausted — scrape complete')
      break
    }
    cmcontinue = nextToken
    await sleep(500)
  }

  // ─── Final validation ────────────────────────────────────────────────
  console.log('\n═══ VALIDATION ═══')
  const { count: total }    = await supabase.from('characters').select('*', { count: 'exact', head: true }).eq('theme_id', themeId)
  const { count: active }   = await supabase.from('characters').select('*', { count: 'exact', head: true }).eq('theme_id', themeId).eq('active', true)
  const { count: withImg }  = await supabase.from('characters').select('*', { count: 'exact', head: true }).eq('theme_id', themeId).not('image_url', 'is', null)

  // Chars with jutsu data
  const { data: jutsuRows } = await supabase
    .from('characters')
    .select('extra')
    .eq('theme_id', themeId)
    .eq('active', true)
  const withJutsu  = (jutsuRows ?? []).filter(r => r.extra?.jutsu_image_url || r.extra?.jutsu_video_url).length
  const withQuotes = (jutsuRows ?? []).filter(r => (r.extra?.quotes ?? []).length > 0).length

  console.log(`Total characters  : ${total}`)
  console.log(`Active=true       : ${active}`)
  console.log(`With image_url    : ${withImg}`)
  console.log(`With jutsu media  : ${withJutsu}  (JutsuMode pool)`)
  console.log(`With quotes       : ${withQuotes}  (QuoteMode pool)`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
