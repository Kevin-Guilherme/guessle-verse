'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function FinalSmashMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.extra?.final_smash_url && (
        <div className="relative w-full h-40">
          <Image src={challenge.extra.final_smash_url as string} alt="Final Smash" fill className="object-contain rounded-xl" />
        </div>
      )}
      {challenge.extra?.final_smash_description && (
        <p className="text-sm text-gray-300 bg-bg-surface border border-border rounded-xl p-4">
          {challenge.extra.final_smash_description as string}
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
          placeholder="Qual lutador tem esse Final Smash?"
        />
      )}
    </div>
  )
}
