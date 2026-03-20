'use client'

import { useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { shouldRevealHint } from '@guessle/shared'

interface GuessResponse {
  feedback: Array<{ key: string; label: string; value: string; feedback: string }>
  won:      boolean
  lost:     boolean
  score?:   number
}

export function useGuess(challengeId: number | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const { addGuess, setWon, setLost, attempts, hintsUsed } = useGameStore()

  const submitGuess = async (value: string) => {
    if (!challengeId || loading) return
    setLoading(true)
    setError(null)

    try {
      const res  = await fetch('/api/guess', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ challengeId, value }),
      })
      const data: GuessResponse = await res.json()

      addGuess({ value, feedback: data.feedback as any })

      const newAttempts = attempts + 1
      const _newHints   = shouldRevealHint(newAttempts) ?? hintsUsed

      if (data.won) {
        setWon(data.score ?? 50)
      } else if (data.lost) {
        setLost()
      }

      return data
    } catch {
      setError('Erro ao enviar palpite. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return { submitGuess, loading, error }
}
