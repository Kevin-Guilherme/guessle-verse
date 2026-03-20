'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function WantedMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.extra?.wanted_url && (
        <div className="relative w-48 mx-auto">
          <Image src={challenge.extra.wanted_url as string} alt="Wanted Poster" width={192} height={256} className="rounded-xl object-contain" />
          {challenge.extra?.bounty && (
            <p className="text-center text-yellow-400 font-bold mt-2">Recompensa: {challenge.extra.bounty as string}</p>
          )}
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
          placeholder="Quem e o procurado?"
        />
      )}
    </div>
  )
}
