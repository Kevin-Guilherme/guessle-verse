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

  const zoom = won ? 100 : Math.max(400 - wrongGuesses * 30, 100)

  const imageUrl = challenge.image_url as string | undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {won ? challenge.name : "Who's that Pokémon? The silhouette reveals more with each wrong guess."}
      </p>

      {/* Silhouette display
          Technique: black overlay masked by pokemon PNG alpha channel.
          mask-image uses the image alpha as a stencil — white bg shows
          through transparent PNG areas, black overlay shows through opaque areas. */}
      <div className="flex justify-center">
        <div
          className="w-64 h-64 mx-auto rounded-xl border border-white/20 overflow-hidden relative"
          style={{ backgroundColor: 'white' }}
          aria-label={won ? challenge.name : 'Pokémon silhouette'}
        >
          {imageUrl && !won && (
            /* Black overlay stenciled by pokemon alpha channel */
            <div
              style={{
                position:              'absolute',
                inset:                 0,
                backgroundColor:       'black',
                maskImage:             `url(${imageUrl})`,
                WebkitMaskImage:       `url(${imageUrl})`,
                maskSize:              `${zoom}%`,
                WebkitMaskSize:        `${zoom}%`,
                maskPosition:          `${cropX}% ${cropY}%`,
                WebkitMaskPosition:    `${cropX}% ${cropY}%`,
                maskRepeat:            'no-repeat',
                WebkitMaskRepeat:      'no-repeat',
                transition:            'mask-size 400ms ease, mask-position 400ms ease',
              }}
            />
          )}

          {won && imageUrl && (
            /* Revealed full pokemon */
            <div
              style={{
                position:           'absolute',
                inset:              0,
                backgroundImage:    `url(${imageUrl})`,
                backgroundSize:     '85%',
                backgroundPosition: 'center',
                backgroundRepeat:   'no-repeat',
              }}
            />
          )}
        </div>
      </div>

      {won && (
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
