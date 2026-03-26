'use client'

import { useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'

interface GuessResponse {
  feedback:  Array<{ key: string; label: string; value: string; feedback: string }>
  won:       boolean
  lost:      boolean
  score?:    number
  image_url?: string | null
  group?:    { category: string; color: string; champions: string[] } | null
}

export function useGuess(challengeId: number | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const { addGuess, setWon, setLost } = useGameStore()

  const submitGuess = async (value: string, questIndex?: number, phase?: string) => {
    if (!challengeId || loading) return
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, unknown> = { challengeId, value }
      if (questIndex !== undefined) body.questIndex = questIndex
      if (phase !== undefined) body.phase = phase
      const res  = await fetch('/api/guess', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data: GuessResponse = await res.json()

      addGuess({ value, feedback: data.feedback as any, image_url: data.image_url })

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
