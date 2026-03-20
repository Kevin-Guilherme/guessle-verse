'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function AbilityMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())
  const abilityUrl: string = ((challenge.extra?.ability_url ?? challenge.image_url ?? '') as string)

  return (
    <div className="space-y-4">
      {abilityUrl && (
        <div className="relative w-32 h-32 mx-auto">
          <Image src={abilityUrl} alt="Habilidade" fill className="object-contain rounded-xl" />
        </div>
      )}
      {challenge.extra?.ability_description && (
        <p className="text-sm text-gray-300 bg-bg-surface border border-border rounded-xl p-4">
          {challenge.extra.ability_description as string}
        </p>
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
