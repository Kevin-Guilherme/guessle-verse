'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function SplashMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const zoom           = Math.max(200 - guesses.length * 20, 100)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.image_url && (
        <div className="w-full h-48 overflow-hidden rounded-xl">
          <div
            className="w-full h-full bg-center bg-no-repeat transition-all duration-500"
            style={{ backgroundImage: `url(${challenge.image_url as string})`, backgroundSize: `${zoom}%` }}
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
