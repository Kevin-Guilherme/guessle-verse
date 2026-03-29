'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonClassicMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Guess the Pokémon from its attributes. Unlimited attempts.
      </p>

      {/* Retro artwork — hidden after win (image appears in GuessRow grid) */}
      {!won && !lost && challenge.image_url && (
        <div className="flex justify-center">
          <div className="relative w-24 h-24">
            <Image
              src={challenge.image_url as string}
              alt="Pokémon"
              fill
              className="object-contain"
              style={{
                imageRendering: 'pixelated',
                filter: 'saturate(0.7) contrast(1.2) brightness(1.1)',
              }}
            />
          </div>
        </div>
      )}

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Enter Pokémon name..."
        />
      )}
    </div>
  )
}
