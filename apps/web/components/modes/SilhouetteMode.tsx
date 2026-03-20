'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function SilhouetteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const brightness     = Math.min(10 + guesses.length * 15, 100)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.image_url && (
        <div className="relative w-48 h-48 mx-auto">
          <Image
            src={challenge.image_url as string}
            alt="Silhueta"
            fill
            className="object-contain rounded-xl transition-all duration-500"
            style={{ filter: won ? 'none' : `brightness(${brightness}%)` }}
          />
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
        />
      )}
    </div>
  )
}
