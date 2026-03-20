import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { computeFeedback, calculateScore } from '@guessle/shared'

export async function POST(req: NextRequest) {
  const { challengeId, value } = await req.json()

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

  const isCodeMode = ['complete', 'fix', 'output'].includes(challenge.mode)

  let feedback: Array<{ key: string; label: string; value: string; feedback: string }> = []
  let won = false

  if (isCodeMode) {
    const answer = (challenge.attributes as Record<string, unknown>)?.answer as string
    won = value.trim() === answer.trim()
    feedback = [{ key: 'answer', label: 'Resposta', value, feedback: won ? 'correct' : 'wrong' }]
  } else {
    const { data: candidate } = await service
      .from('characters')
      .select('name, attributes')
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
      const isArray      = targetVal.includes(',')
      const compareMode  = isNumeric ? 'arrow' : isArray ? 'partial' : 'exact'

      return {
        key,
        label:    key,
        value:    candidateVal,
        feedback: computeFeedback(candidateVal, targetVal, compareMode),
      }
    })

    won = feedback.every((f) => f.feedback === 'correct')
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
        const score = won ? calculateScore(newAttempts, session.hints_used ?? 0) : 0

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

        return NextResponse.json({ feedback, won, lost: isLost, score })
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

  return NextResponse.json({ feedback, won, lost: !won && lost })
}
