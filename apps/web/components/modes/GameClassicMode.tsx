'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function GameClassicMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())
  const coverUrl = (challenge.extra as Record<string, unknown>)?.cover_url as string | null

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Guess the game from its attributes. Unlimited attempts.
      </p>

      {(won || lost) && (
        <div className="flex flex-col items-center gap-2">
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={challenge.name}
              className="w-24 rounded-xl object-cover border-2 border-correct/40"
            />
          )}
          <p className={`font-display font-bold text-base tracking-wide ${won ? 'text-correct' : 'text-red-400'}`}>
            {challenge.name}
          </p>
        </div>
      )}

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          source="gamedle_pool"
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Enter game name..."
          excludeNames={alreadyGuessed}
        />
      )}
    </div>
  )
}
