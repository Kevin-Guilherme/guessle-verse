import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // Verify the session belongs to this user and get theme_id via challenge
  const { data: session } = await service
    .from('game_sessions')
    .select('id, daily_challenge_id, daily_challenges(theme_id)')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { data: guesses } = await service
    .from('guesses')
    .select('value, result, attempt_number')
    .eq('session_id', sessionId)
    .order('attempt_number', { ascending: true })

  // Look up champion images in bulk so the client can display them on hydration
  const themeId = (session.daily_challenges as unknown as { theme_id: number } | null)?.theme_id ?? null
  let imageMap: Record<string, string | null> = {}
  if (themeId && (guesses ?? []).length > 0) {
    const names = [...new Set((guesses ?? []).map((g: { value: string }) => g.value))]
    const { data: chars } = await service
      .from('characters')
      .select('name, image_url')
      .eq('theme_id', themeId)
      .in('name', names)
    imageMap = Object.fromEntries((chars ?? []).map((c: { name: string; image_url: string | null }) => [c.name.toLowerCase(), c.image_url]))
  }

  const enriched = (guesses ?? []).map((g: { value: string; result: unknown; attempt_number: number }) => ({
    ...g,
    image_url: imageMap[g.value.toLowerCase()] ?? null,
  }))

  return NextResponse.json({ guesses: enriched })
}
