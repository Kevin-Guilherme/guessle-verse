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
  const hydrate = useGameStore((s) => s.hydrate)

  useEffect(() => {
    if (!challengeId || !authenticated) return

    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ challengeId }),
    })
      .then((r) => r.json())
      .then((data: SessionData) => {
        setSession(data)
        if (data.completedAt) {
          hydrate({
            attempts:  data.attempts,
            hintsUsed: data.hintsUsed,
            won:       data.won,
            lost:      !data.won,
          })
        }
      })
      .catch(() => {})
  }, [challengeId, authenticated, hydrate])

  return session
}
