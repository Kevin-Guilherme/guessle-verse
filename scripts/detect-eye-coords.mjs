/**
 * Detecta coordenadas de olhos em personagens via Google Gemini Vision (grátis).
 * Processa personagens que têm image_url mas não têm extra.eye_coords.
 *
 * Usage:
 *   GEMINI_API_KEY=AIza... node scripts/detect-eye-coords.mjs
 *   GEMINI_API_KEY=AIza... node scripts/detect-eye-coords.mjs --theme-id=2
 *   GEMINI_API_KEY=AIza... node scripts/detect-eye-coords.mjs --dry-run
 */
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'

const SUPABASE_URL  = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'
const GEMINI_KEY    = process.env.GEMINI_API_KEY
const MODEL         = 'gemini-2.5-flash'
const BATCH_SIZE    = 1
const BATCH_DELAY   = 13000

const DRY_RUN  = process.argv.includes('--dry-run')
const themeArg = process.argv.find(a => a.startsWith('--theme-id='))
const THEME_ID = themeArg ? Number(themeArg.split('=')[1]) : null

if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY env var não definida')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Core detection ───────────────────────────────────────────────────────────

async function detectEyeCoords(imageUrl) {
  // Fetch image e converte para base64
  const imgRes = await fetch(imageUrl, {
    headers: { 'User-Agent': 'GuessleBot/1.0' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!imgRes.ok) throw new Error(`Image fetch failed: HTTP ${imgRes.status}`)

  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  const mimeType    = contentType.split(';')[0].trim()
  const buffer      = await imgRes.arrayBuffer()
  const base64      = Buffer.from(buffer).toString('base64')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: { mime_type: mimeType, data: base64 },
            },
            {
              text: 'This is an anime/manga character portrait. Estimate the percentage coordinates (X%, Y% from top-left, 0-100) of the center of the LEFT eye and RIGHT eye. Respond ONLY with valid JSON: {"left": {"x": number, "y": number}, "right": {"x": number, "y": number}}',
            },
          ],
        }],
        generationConfig: { maxOutputTokens: 512, temperature: 0 },
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini ${res.status}: ${body}`)
  }

  const json = await res.json()
  const raw  = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in response: ${raw.slice(0, 100)}`)

  const coords = JSON.parse(jsonMatch[0])

  if (
    typeof coords.left?.x  !== 'number' || typeof coords.left?.y  !== 'number' ||
    typeof coords.right?.x !== 'number' || typeof coords.right?.y !== 'number'
  ) throw new Error(`Invalid coords: ${JSON.stringify(coords)}`)

  const clamp = (n) => Math.max(0, Math.min(100, n))
  return {
    left:  { x: clamp(coords.left.x),  y: clamp(coords.left.y)  },
    right: { x: clamp(coords.right.x), y: clamp(coords.right.y) },
  }
}

// ─── Supabase update ──────────────────────────────────────────────────────────

async function saveEyeCoords(charId, currentExtra, eyeCoords) {
  const mergedExtra = { ...(currentExtra ?? {}), eye_coords: eyeCoords }
  const { error } = await supabase
    .from('characters')
    .update({ extra: mergedExtra })
    .eq('id', charId)
  if (error) throw new Error(error.message)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('🔍 DRY-RUN — sem salvar no banco\n')

  let query = supabase
    .from('characters')
    .select('id, name, image_url, extra, theme_id')
    .not('image_url', 'is', null)

  if (THEME_ID) query = query.eq('theme_id', THEME_ID)

  const { data: allChars, error } = await query.order('id')
  if (error) { console.error('Supabase error:', error); process.exit(1) }

  const pending = (allChars ?? []).filter(c => !c.extra?.eye_coords)

  console.log(`📋 Personagens sem eye_coords: ${pending.length}${THEME_ID ? ` (theme_id=${THEME_ID})` : ''}`)
  if (pending.length === 0) { console.log('✅ Nada a processar'); return }

  let success = 0, failed = 0

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE)

    await Promise.allSettled(batch.map(async (char) => {
      try {
        const coords = await detectEyeCoords(char.image_url)
        if (!DRY_RUN) await saveEyeCoords(char.id, char.extra, coords)
        console.log(`  ✅ [${char.id}] ${char.name} → L(${coords.left.x.toFixed(1)}%, ${coords.left.y.toFixed(1)}%) R(${coords.right.x.toFixed(1)}%, ${coords.right.y.toFixed(1)}%)`)
        success++
      } catch (err) {
        console.error(`  ❌ [${char.id}] ${char.name}: ${err.message}`)
        failed++
      }
    }))

    process.stdout.write(`\r  Progresso: ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} — ✅${success} ❌${failed}  `)
    if (i + BATCH_SIZE < pending.length) await new Promise(r => setTimeout(r, BATCH_DELAY))
  }

  console.log(`\n\n📊 Concluído: ${success} detectados, ${failed} falhas`)
}

main().catch(e => { console.error(e); process.exit(1) })
