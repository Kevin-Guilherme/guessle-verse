import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { challengeId } = await req.json()

  if (!challengeId) {
    return NextResponse.json({ error: 'challengeId required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  await service
    .from('game_sessions')
    .upsert(
      { user_id: user.id, daily_challenge_id: challengeId, completed_at: null },
      { onConflict: 'user_id,daily_challenge_id', ignoreDuplicates: true }
    )

  const { data: session, error } = await service
    .from('game_sessions')
    .select('id, attempts, hints_used, won, completed_at, score')
    .eq('user_id', user.id)
    .eq('daily_challenge_id', challengeId)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Session error' }, { status: 500 })
  }

  return NextResponse.json({
    sessionId:   session.id,
    attempts:    session.attempts,
    hintsUsed:   session.hints_used,
    won:         session.won,
    score:       session.score,
    completedAt: session.completed_at,
  })
}
