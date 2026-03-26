import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { computeFeedback, calculateScore } from '@guessle/shared'

export async function POST(req: NextRequest) {
  const { challengeId, value, questIndex, phase } = await req.json()

  if (!challengeId || !value) {
    return NextResponse.json({ error: 'challengeId and value required' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: challenge, error: challengeError } = await service
    .from('daily_challenges')
    .select('*')
    .eq('id', challengeId)
    .single()

  if (challengeError || !challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  }

  const isCodeMode      = ['complete', 'fix', 'output'].includes(challenge.mode)
  const isQuadraMode    = challenge.mode === 'quadra'
  const isSplashMode    = challenge.mode === 'splash'
  const isBuildQuest    = challenge.mode === 'build' && Array.isArray((challenge.extra as Record<string, unknown>)?.quests)
  const isNameGuessMode = !isCodeMode && !isQuadraMode && !isSplashMode && !isBuildQuest && typeof (challenge.attributes as Record<string, unknown>)?.answer === 'string'

  const ATTR_LABELS: Record<string, string> = {
    // LoL
    gender:       'Gender',
    positions:    'Position(s)',
    species:      'Species',
    resource:     'Resource',
    range_type:   'Range type',
    regions:      'Region(s)',
    release_year: 'Release year',
    // Pokemon
    pokedex_number: '#',
    type1:        'Type 1',
    type2:        'Type 2',
    generation:   'Gen',
    height_m:     'Height (m)',
    weight_kg:    'Weight (kg)',
    color:        'Color',
    is_legendary: 'Legendary',
    is_mythical:  'Mythical',
    evolves_from: 'Evolves from',
    // Naruto
    genero:         'Gender',
    afiliacao:      'Affiliations',
    jutsu_types:    'Jutsu Types',
    kekkei_genkai:  'Kekkei Genkai',
    nature_types:   'Nature Types',
    classification: 'Attributes',
    debut_arc:      'Debut Arc',
    cla:            'Clan',
  }

  let feedback: Array<{ key: string; label: string; value: string; feedback: string }> = []
  let won         = false
  let imageUrl: string | null = null
  let fixedScore: number | null = null  // override calculateScore when set

  if (isQuadraMode) {
    // value = comma-separated list of 4 champion names
    const selected = value.split(',').map((s: string) => s.trim()).filter(Boolean)
    type QGroup = { category: string; color: string; champions: string[] }
    const groups: QGroup[] = ((challenge.attributes as Record<string, unknown>)?.groups as QGroup[]) ?? []
    const matchedGroup = groups.find(g =>
      selected.length === 4 && selected.every((s: string) => g.champions.includes(s))
    )
    const isCorrect = !!matchedGroup
    won = false // quadra win is determined by the frontend (4 groups solved)
    feedback = [{ key: 'quadra', label: 'Quadra', value, feedback: isCorrect ? 'correct' : 'wrong' }]

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await service.from('game_sessions').upsert(
        { user_id: user.id, daily_challenge_id: challengeId, completed_at: null },
        { onConflict: 'user_id,daily_challenge_id', ignoreDuplicates: true }
      )
      const { data: session } = await service
        .from('game_sessions')
        .select('id, attempts, won, completed_at')
        .eq('user_id', user.id)
        .eq('daily_challenge_id', challengeId)
        .single()

      if (session && !session.completed_at) {
        const { data: prevGuesses } = await service.from('guesses').select('result').eq('session_id', session.id)
        const prevCorrect = (prevGuesses ?? []).filter((g: { result: Array<{ feedback: string }> }) => g.result?.[0]?.feedback === 'correct').length
        const wrongsSoFar = (prevGuesses ?? []).filter((g: { result: Array<{ feedback: string }> }) => g.result?.[0]?.feedback === 'wrong').length + (isCorrect ? 0 : 1)
        const allGroupsFound = isCorrect && (prevCorrect + 1 === groups.length)
        const isLost = !allGroupsFound && wrongsSoFar >= 4
        const newAttempts = (session.attempts ?? 0) + 1

        if (allGroupsFound || isLost) {
          const score = allGroupsFound ? Math.max(50, 1000 - wrongsSoFar * 150) : 0
          await service.from('game_sessions').update({ attempts: newAttempts, won: allGroupsFound, score, completed_at: new Date().toISOString() }).eq('id', session.id)
        } else {
          await service.from('game_sessions').update({ attempts: newAttempts }).eq('id', session.id)
        }
        await service.from('guesses').insert({ session_id: session.id, attempt_number: newAttempts, value, result: feedback })

        return NextResponse.json({ feedback, won: allGroupsFound, lost: isLost, group: matchedGroup ?? null, image_url: null })
      }
    }

    return NextResponse.json({ feedback, won: false, lost: false, group: matchedGroup ?? null, image_url: null })
  } else if (isBuildQuest) {
    type BuildQuest = { answer: string; build_items: string[]; build_lane: string; build_rune_url: string; build_options: Array<{ name: string; image_url: string }> }
    const quests = (challenge.extra as Record<string, unknown>)?.quests as BuildQuest[]
    const qi = typeof questIndex === 'number' ? Math.max(0, Math.min(questIndex, quests.length - 1)) : 0
    const quest = quests[qi]
    const isCorrect = (quest?.answer ?? '').toLowerCase() === value.toLowerCase()
    const isLastQuest = qi === quests.length - 1
    won = isCorrect && isLastQuest
    feedback = [{ key: 'champion', label: 'Champion', value, feedback: isCorrect ? 'correct' : 'wrong' }]
    imageUrl = quest?.build_options?.find(o => o.name.toLowerCase() === value.toLowerCase())?.image_url ?? null
  } else if (isSplashMode) {
    const champAnswer = (challenge.attributes as Record<string, unknown>)?.answer as string ?? ''
    const skinAnswer  = (challenge.extra as Record<string, unknown>)?.skin_name as string ?? champAnswer

    if (phase === 'skin') {
      // Phase 2: bonus skin guess — game always ends here (won=true either way)
      const skinCorrect = value.trim().toLowerCase() === skinAnswer.toLowerCase()
      won = true

      // Base score from champion phase: count only champion guesses in this session
      const supabase2 = createClient()
      const { data: { user: user2 } } = await supabase2.auth.getUser()
      if (user2) {
        const svc2 = createServiceClient()
        const { data: sess2 } = await svc2.from('game_sessions').select('id, attempts, hints_used').eq('user_id', user2.id).eq('daily_challenge_id', challengeId).single()
        if (sess2) {
          const { data: prevG } = await svc2.from('guesses').select('result').eq('session_id', sess2.id)
          const champAttempts = (prevG ?? []).filter((g: { result: Array<{ key: string }> }) => g.result?.[0]?.key === 'champion').length
          const base = calculateScore(Math.max(champAttempts, 1), sess2.hints_used ?? 0)
          fixedScore = base + (skinCorrect ? 50 : 0)
        }
      }
      feedback = [{ key: 'skin', label: 'Skin', value, feedback: skinCorrect ? 'correct' : 'wrong' }]
      imageUrl = challenge.image_url as string | null
    } else {
      // Phase 1: guess the champion — correct unlocks skin phase
      const champCorrect = value.trim().toLowerCase() === champAnswer.toLowerCase()
      won = false  // skin phase follows even on correct
      feedback = [{ key: 'champion', label: 'Champion', value, feedback: champCorrect ? 'correct' : 'wrong' }]
      const { data: splashCandidate } = await service
        .from('characters')
        .select('image_url')
        .eq('theme_id', challenge.theme_id)
        .ilike('name', `%${value}%`)
        .limit(1)
        .single()
      imageUrl = splashCandidate?.image_url as string | null
    }
  } else if (isCodeMode) {
    const answer = (challenge.attributes as Record<string, unknown>)?.answer as string
    won = value.trim() === answer.trim()
    feedback = [{ key: 'answer', label: 'Resposta', value, feedback: won ? 'correct' : 'wrong' }]
  } else if (isNameGuessMode) {
    const answer = (challenge.attributes as Record<string, unknown>)?.answer as string

    // Ability slot guess: value like "SLOT:Q"
    if (value.startsWith('SLOT:') && challenge.mode === 'ability') {
      const slot = value.split(':')[1] ?? ''
      const abilities = (challenge.extra?.abilities ?? []) as Array<{ slot: string }>
      const idx = challenge.id % Math.max(abilities.length, 1)
      const correctSlot = abilities[idx]?.slot ?? ''
      // Normalize legacy 'P' stored by cron → 'Passive'
      const normalize = (s: string) => s === 'P' ? 'Passive' : s
      const isCorrect = normalize(slot).toLowerCase() === normalize(correctSlot).toLowerCase()
      won = isCorrect
      if (isCorrect) fixedScore = 150
      feedback = [{ key: 'slot', label: 'Slot', value: slot, feedback: isCorrect ? 'correct' : 'wrong' }]
    } else {
      // Normal champion name guess
      const { data: candidate } = await service
        .from('characters')
        .select('name, image_url')
        .eq('theme_id', challenge.theme_id)
        .ilike('name', `%${value}%`)
        .limit(1)
        .single()
      const guessedName = candidate?.name ?? value
      const champCorrect = guessedName.toLowerCase() === answer.toLowerCase()
      imageUrl = candidate?.image_url as string | null
      // For ability mode: champion correct does not immediately win — slot phase follows
      if (challenge.mode === 'ability' && champCorrect) {
        won = false  // slot phase pending
        feedback = [{ key: 'champion', label: 'Champion', value: guessedName, feedback: 'correct' }]
      } else {
        won = champCorrect
        feedback = [{ key: 'champion', label: 'Champion', value: guessedName, feedback: champCorrect ? 'correct' : 'wrong' }]
      }
    }
  } else {
    const { data: candidate } = await service
      .from('characters')
      .select('name, attributes, image_url')
      .eq('theme_id', challenge.theme_id)
      .ilike('name', `%${value}%`)
      .limit(1)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    const targetAttrs    = challenge.attributes as Record<string, unknown>
    const candidateAttrs = (candidate.attributes as Record<string, unknown>) ?? {}
    const attrKeys       = Object.keys(targetAttrs)

    feedback = attrKeys.map((key) => {
      const targetVal    = String(targetAttrs[key] ?? '')
      const candidateVal = String(candidateAttrs[key] ?? '')
      const isNumeric    = targetVal !== '' && candidateVal !== '' && !isNaN(Number(targetVal)) && !isNaN(Number(candidateVal))
      const isArray      = targetVal.includes(',') || candidateVal.includes(',')
      const compareMode  = isNumeric ? 'arrow' : isArray ? 'partial' : 'exact'

      const label = ATTR_LABELS[key]
        ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

      const feedbackResult = compareMode === 'partial'
        ? computeFeedback(
            candidateVal.split(',').map(s => s.trim()).filter(Boolean),
            targetVal.split(',').map(s => s.trim()).filter(Boolean),
            'partial'
          )
        : computeFeedback(candidateVal, targetVal, compareMode)

      return {
        key,
        label,
        value:    candidateVal,
        feedback: feedbackResult,
      }
    })

    won      = feedback.every((f) => f.feedback === 'correct')
    imageUrl = candidate.image_url as string | null
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await service
      .from('game_sessions')
      .upsert(
        { user_id: user.id, daily_challenge_id: challengeId, completed_at: null },
        { onConflict: 'user_id,daily_challenge_id', ignoreDuplicates: true }
      )

    const { data: session } = await service
      .from('game_sessions')
      .select('id, attempts, hints_used, won, completed_at')
      .eq('user_id', user.id)
      .eq('daily_challenge_id', challengeId)
      .single()

    if (session && !session.completed_at) {
      const newAttempts = (session.attempts ?? 0) + 1
      const maxAttempts = isCodeMode ? 3 : null
      const isLost      = maxAttempts !== null && !won && newAttempts >= maxAttempts

      if (won || isLost) {
        const score = won ? (fixedScore ?? calculateScore(newAttempts, session.hints_used ?? 0)) : 0

        await service
          .from('game_sessions')
          .update({
            attempts:     newAttempts,
            won,
            score,
            completed_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        await service.from('guesses').insert({
          session_id:     session.id,
          attempt_number: newAttempts,
          value,
          result:         feedback,
        })

        return NextResponse.json({ feedback, won, lost: isLost, score, image_url: imageUrl })
      }

      await service
        .from('game_sessions')
        .update({ attempts: newAttempts })
        .eq('id', session.id)

      await service.from('guesses').insert({
        session_id:     session.id,
        attempt_number: newAttempts,
        value,
        result:         feedback,
      })
    }
  }

  const maxAttempts = isCodeMode ? 3 : null
  const lost        = maxAttempts !== null && !won

  return NextResponse.json({ feedback, won, lost: !won && lost, image_url: imageUrl })
}
