'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function MonsterHunterSilhouetteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const wrongGuesses    = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const blurPx          = Math.max(20 - wrongGuesses * 2, 0)
  const alreadyGuessed  = guesses.map((g) => g.value.toLowerCase())
  const imageUrl        = challenge.image_url as string | undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {won ? challenge.name : 'Which monster is this? The silhouette sharpens with each wrong guess.'}
      </p>

      <div className="flex justify-center">
        <div
          className="rounded-xl border border-white/20 overflow-hidden flex items-center justify-center"
          style={{ width: 320, height: 240, backgroundColor: '#d4c5a9' }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={won ? challenge.name : 'Monster silhouette'}
              style={{
                width:      '100%',
                height:     '100%',
                objectFit:  'contain',
                transition: 'filter 400ms ease',
                filter:     won
                  ? 'none'
                  : `brightness(0) blur(${blurPx}px)`,
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
          placeholder="Enter monster name..."
          excludeNames={alreadyGuessed}
        />
      )}
    </div>
  )
}
