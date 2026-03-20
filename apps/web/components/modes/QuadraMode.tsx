'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function QuadraMode({ challenge, config }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const totalLives     = config.lives ?? 4
  const wrongGuesses   = guesses.filter((g) => !g.feedback.every((f: any) => f.feedback === 'correct')).length
  const livesLeft      = totalLives - wrongGuesses
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {Array.from({ length: totalLives }).map((_, i) => (
          <span key={i} className={`text-2xl ${i < livesLeft ? 'opacity-100' : 'opacity-20'}`}>&#x2764;&#xFE0F;</span>
        ))}
      </div>
      {!won && !lost && livesLeft > 0 && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}
    </div>
  )
}
