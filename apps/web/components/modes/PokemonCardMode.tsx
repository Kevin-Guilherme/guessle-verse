'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonCardMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const cardUrl      = (challenge.extra as Record<string, unknown>)?.card_url as string | undefined
  const wrongGuesses = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const blurPx       = won ? 0 : Math.max(12 - wrongGuesses * 1.2, 0)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Guess the Pokémon from its TCG card. The card clears with each wrong guess.
      </p>

      {/* Card */}
      <div className="flex justify-center">
        <div
          className="relative overflow-hidden rounded-xl border border-white/10"
          style={{ width: 240, height: 330 }}
        >
          {cardUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardUrl}
              alt="Pokémon card"
              width={240}
              height={330}
              className="w-full h-full object-cover select-none"
              style={{
                filter:           `blur(${blurPx}px)`,
                transition:       'filter 400ms ease',
                imageRendering:   'auto',
              }}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface text-slate-500 text-sm">
              Card not available
            </div>
          )}

          {/* Wrong guess counter badge */}
          {!won && !lost && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-display px-2 py-1 rounded-full">
              {Math.min(wrongGuesses, 10)}/10
            </div>
          )}
        </div>
      </div>

      {/* Win reveal */}
      {won && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-correct font-display font-bold text-base tracking-wide">
            {challenge.name}
          </p>
        </div>
      )}

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => submitGuess(name)}
          disabled={loading}
          placeholder="Enter Pokémon name..."
          excludeNames={alreadyGuessed}
        />
      )}
    </div>
  )
}
