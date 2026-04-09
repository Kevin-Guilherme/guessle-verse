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
    .select('*, themes!inner(slug)')
    .eq('id', challengeId)
    .single()

  if (challengeError || !challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  }

  const themeSlug = (challenge.themes as unknown as { slug: string })?.slug ?? ''

  const isCodeMode      = ['complete', 'fix', 'output'].includes(challenge.mode)
  const isQuadraMode    = challenge.mode === 'quadra'
  const isSplashMode    = challenge.mode === 'splash'
  const isBuildQuest    = challenge.mode === 'build' && Array.isArray((challenge.extra as Record<string, unknown>)?.quests)
  const isGameClassic      = challenge.mode === 'classic' && themeSlug === 'gamedle'
  const isGamedleSimpleMode = themeSlug === 'gamedle' && !isGameClassic
  const isNameGuessMode    = !isCodeMode && !isQuadraMode && !isSplashMode && !isBuildQuest && !isGameClassic && !isGamedleSimpleMode && typeof (challenge.attributes as Record<string, unknown>)?.answer === 'string'

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
    generation:   'Generation',
    height_m:     'Height (m)',
    weight_kg:    'Weight (kg)',
    color:        'Color',
    is_legendary: 'Legendary',
    is_mythical:  'Mythical',
    evolves_from: 'Evolves from',
    // Pokemon — new fields
    habitat:          'Habitat',
    evolution_stage:  'Stage',
    // Naruto
    genero:         'Gender',
    afiliacao:      'Affiliations',
    jutsu_types:    'Jutsu Types',
    kekkei_genkai:  'Kekkei Genkai',
    nature_types:   'Nature Types',
    classification: 'Attributes',
    debut_arc:      'Debut Arc',
    cla:            'Clan',
    // Gamedle
    genre:       'Genre',
    platform:    'Platform',
    developer:   'Developer',
    franchise:   'Franchise',
    multiplayer: 'Multiplayer',
    // Monster Hunter
    element:          'Element',
    ailment:          'Ailment',
    weakness:         'Weakness',
    class:            'Class',
    size_max:         'Max Size',
    size_min:         'Min Size',
    threat_level:     'Threat Level',
    first_appearance: 'First Appearance',
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
  } else if (isGameClassic) {
    // Gamedle classic: compare game attributes from gamedle_pool
    const { data: candidate } = await service
      .from('gamedle_pool')
      .select('name, genre, platform, developer, franchise, release_year, multiplayer')
      .ilike('name', `%${value}%`)
      .eq('active', true)
      .limit(1)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    type GameCandidate = { name: string; genre: string[] | null; platform: string[] | null; developer: string | null; franchise: string | null; release_year: number | null; multiplayer: boolean | null }
    const game = candidate as unknown as GameCandidate

    const snapshotAttrs = (challenge.attributes as Record<string, unknown>) ?? {}
    const attrKeys      = Object.keys(snapshotAttrs)

    const targetAttrs: Record<string, string> = {
      genre:        String(snapshotAttrs.genre ?? ''),
      platform:     String(snapshotAttrs.platform ?? ''),
      developer:    String(snapshotAttrs.developer ?? ''),
      franchise:    String(snapshotAttrs.franchise ?? ''),
      release_year: String(snapshotAttrs.release_year ?? 0),
      multiplayer:  String(snapshotAttrs.multiplayer ?? ''),
    }
    const candidateAttrs: Record<string, string> = {
      genre:        Array.isArray(game.genre) ? game.genre.join(', ') : String(game.genre ?? ''),
      platform:     Array.isArray(game.platform) ? game.platform.join(', ') : String(game.platform ?? ''),
      developer:    game.developer ?? '',
      franchise:    game.franchise ?? '',
      release_year: String(game.release_year ?? 0),
      multiplayer:  game.multiplayer ? 'Sim' : 'Nao',
    }

    feedback = attrKeys.map((key) => {
      const targetVal    = targetAttrs[key] ?? ''
      const candidateVal = candidateAttrs[key] ?? ''
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

      return { key, label, value: candidateVal, feedback: feedbackResult }
    })

    won      = feedback.every((f) => f.feedback === 'correct')
    imageUrl = null  // no tile image for games
  } else if (isGamedleSimpleMode) {
    // Soundtrack, location, music, game, cover, screenshot, etc.
    // Resposta correta = challenge.name; busca nome canônico no pool
    const { data: candidate } = await service
      .from('gamedle_pool')
      .select('name')
      .ilike('name', value)
      .eq('active', true)
      .limit(1)
      .single()

    const guessedName = candidate?.name ?? value.trim()
    won = guessedName.toLowerCase().trim() === challenge.name.toLowerCase().trim()
    feedback = [{ key: 'game', label: 'Game', value: guessedName, feedback: won ? 'correct' : 'wrong' }]
  } else {
    const [{ data: candidate }, { data: targetCharacter }] = await Promise.all([
      service
        .from('characters')
        .select('name, attributes, image_url')
        .eq('theme_id', challenge.theme_id)
        .ilike('name', `%${value}%`)
        .limit(1)
        .single(),
      service
        .from('characters')
        .select('attributes')
        .eq('id', challenge.character_id)
        .single(),
    ])

    if (!candidate) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    // Column keys come from challenge.attributes snapshot (cron defines the schema per universe)
    // Target values come from live characters.attributes (avoids stale after bulk updates)
    const snapshotAttrs  = (challenge.attributes as Record<string, unknown>) ?? {}
    const liveAttrs      = (targetCharacter?.attributes ?? {}) as Record<string, unknown>
    const targetAttrs    = { ...snapshotAttrs, ...liveAttrs } as Record<string, unknown>
    const candidateAttrs = (candidate.attributes as Record<string, unknown>) ?? {}
    const attrKeys       = Object.keys(snapshotAttrs)

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
