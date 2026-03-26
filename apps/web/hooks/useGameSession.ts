'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'

interface SessionData {
  sessionId:   number
  attempts:    number
  hintsUsed:   number
  won:         boolean
  completedAt: string | null
}

export function useGameSession(challengeId: number | null, authenticated: boolean) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(authenticated)
  const hydrate = useGameStore((s) => s.hydrate)

  useEffect(() => {
    if (!challengeId || !authenticated) { setLoading(false); return }

    setLoading(true)
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ challengeId }),
    })
      .then((r) => r.json())
      .then(async (data: SessionData) => {
        setSession(data)
        if (data.attempts > 0 || data.completedAt) {
          const guessRes = await fetch(`/api/session/guesses?sessionId=${data.sessionId}`)
          const { guesses: rawGuesses } = await guessRes.json()
          hydrate({
            attempts:  data.attempts,
            hintsUsed: data.hintsUsed,
            won:       data.won,
            lost:      !data.won && !!data.completedAt,
            guesses:   (rawGuesses ?? []).map((g: { value: string; result: unknown[]; image_url?: string | null }) => ({
              value:     g.value,
              feedback:  g.result,
              image_url: g.image_url ?? null,
            })),
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [challengeId, authenticated, hydrate])

  return { session, loading }
}
