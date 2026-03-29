'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonSilhouetteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const wrongGuesses = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  // Deterministic crop position — same every refresh, derived from challenge.id
  const cropX = (challenge.id * 37) % 60 + 20  // range 20–80
  const cropY = (challenge.id * 53) % 60 + 20  // range 20–80

  const zoom = won ? 100 : Math.max(500 - wrongGuesses * 80, 100)
  const bgPos = won ? 'center' : `${cropX}% ${cropY}%`

  const imageUrl = challenge.image_url as string | undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {won ? challenge.name : "Who's that Pokémon? The silhouette reveals more with each wrong guess."}
      </p>

      {/* Silhouette display */}
      <div className="flex justify-center">
        {/* Outer container is white so the silhouette shows as black on white */}
        <div
          className="w-64 h-64 mx-auto rounded-xl border border-white/20 overflow-hidden bg-white"
          aria-label={won ? challenge.name : 'Pokémon silhouette'}
        >
          <div
            style={{
              width:              '100%',
              height:             '100%',
              backgroundImage:    imageUrl ? `url(${imageUrl})` : undefined,
              backgroundSize:     `${zoom}%`,
              backgroundPosition: bgPos,
              backgroundRepeat:   'no-repeat',
              filter:             won ? 'none' : 'brightness(0)',
              transition:         'background-size 400ms ease, filter 400ms ease',
            }}
          />
        </div>
      </div>

      {/* Win reveal */}
      {won && imageUrl && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-correct font-display font-bold text-sm tracking-wide">
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
