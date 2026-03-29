/**
 * Naruto Canonical Character Migration — 3 etapas
 *
 * ETAPA 1 — Cria/confirma Ashura Otsutsuki
 * ETAPA 2 — Atualiza attributes dos 201 personagens matched (batches de 20)
 * ETAPA 3 — Substitui 3 daily_challenges at-risk → deleta 1.257 não-canônicos
 *
 * Usage:
 *   node scripts/naruto-canonical-migration.mjs --dry-run   (sem alterar banco)
 *   node scripts/naruto-canonical-migration.mjs             (aplica tudo)
 */
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir   = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = 'https://yabxlaicllxqwaaqfnax.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYnhsYWljbGx4cXdhYXFmbmF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxNTE4OSwiZXhwIjoyMDg5NTkxMTg5fQ.QnNxmwGApNNujp2y8nEEZSxGfe9r9JVnrJG1LMTMQqs'
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const THEME_ID = 2
const TODAY    = new Date().toISOString().split('T')[0]

// IDs dos challenges at-risk de hoje
const AT_RISK_CHALLENGE_IDS = {
  classic: 447,   // Shigure (char 11081)
  eye:     450,   // Gekkō   (char 9166)
  quote:   449,   // Menō    (char 10645)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg)  { console.log(msg) }
function ok(msg)   { console.log('  ✅', msg) }
function warn(msg) { console.log('  ⚠️ ', msg) }
function err(msg)  { console.log('  ❌', msg) }
function info(msg) { console.log('  ℹ️ ', msg) }

/** Map canonical gender M/F to existing DB format */
function mapGender(g) { return g === 'M' ? 'Male' : g === 'F' ? 'Female' : g }

/** Build DB attributes object from canonical entry */
function canonToAttrs(canon) {
  return {
    genero:         mapGender(canon.gender),
    afiliacao:      canon.affiliations ?? 'None',
    debut_arc:      canon.debut_arc    ?? 'None',
    jutsu_types:    canon.jutsu_types  ?? 'None',
    kekkei_genkai:  canon.kekkei_genkai ?? 'None',
    nature_types:   canon.nature_types ?? 'None',
    classification: canon.classification ?? 'None',
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── ETAPA 1 ──────────────────────────────────────────────────────────────────

async function step1_ashuraOtsutsuki(canonical) {
  log('\n━━━ ETAPA 1 — Ashura Otsutsuki ━━━')

  const ashuraCanon = canonical.find(c => c.name === 'Ashura Otsutsuki')
  if (!ashuraCanon) { err('Ashura Otsutsuki não encontrado na lista canônica'); return null }

  // Search DB for Ashura Ōtsutsuki specifically (NOT "Asura Path" which is a Pain body)
  const variants = ['Ashura Otsutsuki', 'Ashurā Ōtsutsuki', 'Ashurā Otsutsuki', 'Ashura Ōtsutsuki']
  let existing = null
  for (const v of variants) {
    const { data } = await supabase
      .from('characters')
      .select('id, name, attributes, extra, image_url')
      .eq('theme_id', THEME_ID)
      .ilike('name', v)
      .limit(1)
    if (data?.length) {
      existing = data[0]
      info(`Encontrado no DB como: "${existing.name}" [id=${existing.id}]`)
      break
    }
  }
  // Extra safety: never match "Path" variants (Asura Path = Pain's body, different char)
  if (existing && existing.name.toLowerCase().includes('path')) {
    warn(`Ignorando "${existing.name}" — é um corpo de Pain, não Ashura Ōtsutsuki`)
    existing = null
  }

  const newAttrs = canonToAttrs(ashuraCanon)

  if (existing) {
    log(`  Atualizando "${existing.name}" → "Ashura Otsutsuki"`)
    if (!DRY_RUN) {
      const { error } = await supabase
        .from('characters')
        .update({ name: 'Ashura Otsutsuki', attributes: newAttrs })
        .eq('id', existing.id)
      if (error) { err('Update falhou: ' + error.message); return null }
    }
    ok(`"${existing.name}" renomeado para "Ashura Otsutsuki" + attributes atualizados`)
    return { ...existing, name: 'Ashura Otsutsuki', db_id: existing.id }
  } else {
    log('  Não encontrado no DB — criando novo personagem...')
    if (!DRY_RUN) {
      const { data, error } = await supabase
        .from('characters')
        .insert({
          theme_id:   THEME_ID,
          name:       'Ashura Otsutsuki',
          attributes: newAttrs,
          active:     true,
        })
        .select('id, name')
        .single()
      if (error) { err('Insert falhou: ' + error.message); return null }
      ok(`Criado com id=${data.id}`)
      return { ...data, db_id: data.id }
    } else {
      ok('[DRY-RUN] Criaria "Ashura Otsutsuki" com attributes: ' + JSON.stringify(newAttrs))
      return { db_id: -1, name: 'Ashura Otsutsuki' }
    }
  }
}

// ─── ETAPA 2 ──────────────────────────────────────────────────────────────────

async function step2_updateAttributes(matched, canonical) {
  log('\n━━━ ETAPA 2 — Atualizar attributes dos 201 matched ━━━')

  // Build canonical lookup by canonical_name
  const canonMap = new Map(canonical.map(c => [c.name, c]))

  let updated = 0, failed = 0
  const BATCH = 20

  for (let i = 0; i < matched.length; i += BATCH) {
    const batch = matched.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(async (m) => {
      const canon = canonMap.get(m.canonical_name)
      if (!canon) { warn(`Sem dados canônicos para ${m.canonical_name}`); return false }
      const newAttrs = canonToAttrs(canon)
      if (DRY_RUN) return true
      const { error } = await supabase
        .from('characters')
        .update({ attributes: newAttrs })
        .eq('id', m.db_id)
      if (error) {
        err(`Falhou [${m.db_id}] ${m.db_name}: ${error.message}`)
        return false
      }
      return true
    }))

    const batchOk  = results.filter(Boolean).length
    const batchErr = results.filter(r => r === false).length
    updated += batchOk
    failed  += batchErr

    const pct = Math.round(((i + batch.length) / matched.length) * 100)
    process.stdout.write(`\r  Progresso: ${i + batch.length}/${matched.length} (${pct}%) — ✅${updated} ❌${failed}`)

    if (i + BATCH < matched.length) await sleep(120) // rate-limit gentil
  }
  console.log() // newline after progress
  ok(`${updated} personagens atualizados, ${failed} falhas`)
  return { updated, failed }
}

// ─── ETAPA 3 ──────────────────────────────────────────────────────────────────

async function step3_deleteNonCanonical(matched, toDelete, ashuraEntry) {
  log('\n━━━ ETAPA 3 — Substituir challenges at-risk → Deletar não-canônicos ━━━')

  // Build full matched set including Ashura if created/found
  const allMatchedIds = new Set(matched.map(m => m.db_id))
  if (ashuraEntry?.db_id > 0) allMatchedIds.add(ashuraEntry.db_id)

  // ── 3a: Busca dados dos chars matched para substituição ──────────────────
  log('\n  3a. Buscando dados dos personagens canônicos para substituição...')
  const { data: canonChars } = await supabase
    .from('characters')
    .select('id, name, image_url, extra')
    .in('id', [...allMatchedIds])
    .eq('theme_id', THEME_ID)

  const charById = new Map((canonChars ?? []).map(c => [c.id, c]))

  // Check today's other challenges to avoid reusing already-used chars
  const { data: todayChallenges } = await supabase
    .from('daily_challenges')
    .select('mode, character_id')
    .eq('theme_id', THEME_ID)
    .eq('date', TODAY)

  const usedToday = new Set((todayChallenges ?? []).map(c => c.character_id))
  // Remove the at-risk ones from "used" so they can be replaced freely
  for (const id of [11081, 9166, 10645]) usedToday.delete(id)

  // ── Find replacement for each mode ──────────────────────────────────────
  function pickReplacement(predicate, exclude = new Set()) {
    for (const m of matched) {
      if (exclude.has(m.db_id)) continue
      const char = charById.get(m.db_id)
      if (!char) continue
      if (predicate(m, char)) return { matched: m, char }
    }
    return null
  }

  const usedAsReplacement = new Set()

  // classic: needs image (for search dropdown); attributes will be updated by step2
  const replClassic = pickReplacement(
    (m, c) => !usedToday.has(m.db_id) && !!c.image_url && !usedAsReplacement.has(m.db_id)
  )
  if (replClassic) usedAsReplacement.add(replClassic.matched.db_id)

  // eye: needs image_url (cropped eye shown)
  const replEye = pickReplacement(
    (m, c) => !usedToday.has(m.db_id) && !!c.image_url && !usedAsReplacement.has(m.db_id)
  )
  if (replEye) usedAsReplacement.add(replEye.matched.db_id)

  // quote: needs quotes array with at least 1 entry
  const replQuote = pickReplacement(
    (m, c) => !usedToday.has(m.db_id) && !!(c.extra?.quotes?.length) && !usedAsReplacement.has(m.db_id)
  )
  if (replQuote) usedAsReplacement.add(replQuote.matched.db_id)

  if (!replClassic) { err('Nenhum replacement encontrado para classic mode'); }
  else info(`classic → ${replClassic.char.name} [id=${replClassic.matched.db_id}]`)

  if (!replEye) { err('Nenhum replacement encontrado para eye mode'); }
  else info(`eye    → ${replEye.char.name} [id=${replEye.matched.db_id}]`)

  if (!replQuote) { err('Nenhum replacement encontrado para quote mode'); }
  else info(`quote  → ${replQuote.char.name} [id=${replQuote.matched.db_id}]`)

  // ── 3b: Aplica substituições ─────────────────────────────────────────────
  log('\n  3b. Substituindo daily_challenges at-risk...')

  const replacements = [
    { challengeId: AT_RISK_CHALLENGE_IDS.classic, mode: 'classic', repl: replClassic },
    { challengeId: AT_RISK_CHALLENGE_IDS.eye,     mode: 'eye',     repl: replEye     },
    { challengeId: AT_RISK_CHALLENGE_IDS.quote,   mode: 'quote',   repl: replQuote   },
  ]

  for (const { challengeId, mode, repl } of replacements) {
    if (!repl) { warn(`Pulando ${mode} (sem replacement)`); continue }

    const { matched: m, char } = repl
    const canon = matched.find(x => x.db_id === m.db_id)

    // Build update payload per mode
    let payload = {
      character_id: m.db_id,
      name:         char.name,
      image_url:    char.image_url ?? null,
    }

    if (mode === 'classic') {
      // attributes from characters table (already updated in step 2)
      const { data: liveChar } = await supabase
        .from('characters')
        .select('attributes')
        .eq('id', m.db_id)
        .single()
      payload.attributes = liveChar?.attributes ?? {}
      payload.extra      = char.extra ?? {}
    } else if (mode === 'eye') {
      payload.attributes = { answer: char.name }
      payload.extra      = char.extra ?? {}
    } else if (mode === 'quote') {
      const quotes = char.extra?.quotes ?? []
      const quote  = quotes[0] ?? ''
      payload.attributes = { answer: char.name }
      payload.extra      = { ...(char.extra ?? {}), quote, quotes }
    }

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('daily_challenges')
        .update(payload)
        .eq('id', challengeId)
      if (error) { err(`Falhou challenge ${challengeId}: ${error.message}`); continue }
    }
    ok(`Challenge ${challengeId} (${mode}) → "${char.name}"${DRY_RUN ? ' [DRY-RUN]' : ''}`)
  }

  // ── 3c: Deleta não-canônicos em batches ──────────────────────────────────
  log('\n  3c. Deletando personagens não-canônicos...')
  log(`  Total: ${toDelete.length} personagens`)

  if (DRY_RUN) {
    ok(`[DRY-RUN] Deletaria ${toDelete.length} personagens`)
    return
  }

  const deleteIds = toDelete.map(c => c.db_id)
  const BATCH = 100
  let deleted = 0, deleteFailed = 0

  for (let i = 0; i < deleteIds.length; i += BATCH) {
    const batch = deleteIds.slice(i, i + BATCH)

    // First: delete game_sessions and guesses that reference these characters via daily_challenges
    // (FK: guesses → game_sessions → daily_challenges → characters)
    // Find challenge IDs for this batch
    const { data: batchChallenges } = await supabase
      .from('daily_challenges')
      .select('id')
      .in('character_id', batch)

    if (batchChallenges?.length) {
      const challengeIds = batchChallenges.map(c => c.id)

      // Delete guesses first (FK dep on game_sessions)
      const { data: sessions } = await supabase
        .from('game_sessions')
        .select('id')
        .in('daily_challenge_id', challengeIds)
      if (sessions?.length) {
        const sessionIds = sessions.map(s => s.id)
        await supabase.from('guesses').delete().in('session_id', sessionIds)
        await supabase.from('game_sessions').delete().in('id', sessionIds)
      }
      // Delete daily_challenges
      await supabase.from('daily_challenges').delete().in('id', challengeIds)
    }

    // Now delete the characters
    const { error } = await supabase
      .from('characters')
      .delete()
      .in('id', batch)

    if (error) {
      err(`Batch ${i}-${i+BATCH} falhou: ${error.message}`)
      deleteFailed += batch.length
    } else {
      deleted += batch.length
    }

    const pct = Math.round(((i + batch.length) / deleteIds.length) * 100)
    process.stdout.write(`\r  Deletados: ${deleted}/${deleteIds.length} (${pct}%) ❌${deleteFailed}`)
    await sleep(150)
  }
  console.log()
  ok(`${deleted} personagens deletados, ${deleteFailed} falhas`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) log('🔍 MODO DRY-RUN — nenhuma alteração será feita\n')
  else         log('🚀 MODO LIVE — alterações serão aplicadas no banco\n')

  // Load data
  const canonical = JSON.parse(readFileSync(join(__dir, 'naruto-canonical-characters.json'), 'utf8'))
  const report    = JSON.parse(readFileSync(join(__dir, 'naruto-match-report.json'), 'utf8'))

  log(`📦 Lista canônica: ${canonical.length} personagens`)
  log(`📊 Relatório: ${report.matched.length} matched, ${report.no_match_canonical.length} no_match, ${report.to_delete.length} to_delete`)

  // Step 1
  const ashuraEntry = await step1_ashuraOtsutsuki(canonical)
  const allMatched  = ashuraEntry
    ? [...report.matched, { canonical_name: 'Ashura Otsutsuki', db_id: ashuraEntry.db_id, db_name: ashuraEntry.name }]
    : [...report.matched]

  // Step 2
  await step2_updateAttributes(allMatched, canonical)

  // Step 3
  await step3_deleteNonCanonical(allMatched, report.to_delete, ashuraEntry)

  log('\n✅ Migração concluída!')
}

main().catch(e => { console.error(e); process.exit(1) })
