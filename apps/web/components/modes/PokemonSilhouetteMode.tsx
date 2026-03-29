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

  const imageUrl = challenge.image_url as string | undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {won ? challenge.name : "Who's that Pokémon? The silhouette reveals more with each wrong guess."}
      </p>

      <div className="flex justify-center">
        <div
          className="rounded-xl border border-white/20 overflow-hidden flex items-center justify-center"
          style={{ width: 256, height: 256, backgroundColor: '#ffffff' }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={won ? challenge.name : 'Pokémon silhouette'}
              style={{
                width:      '85%',
                height:     '85%',
                objectFit:  'contain',
                filter:     won ? 'none' : 'brightness(0)',
              }}
              draggable={false}
            />
          )}
        </div>
      </div>

      {won && (
        <p className="text-correct font-display font-bold text-sm tracking-wide text-center">
          {challenge.name}
        </p>
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
