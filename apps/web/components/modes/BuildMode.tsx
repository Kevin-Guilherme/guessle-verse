'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function BuildMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())
  const items: string[] = ((challenge.extra?.build_items ?? []) as string[])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {items.map((url, i) => (
          <div key={i} className="relative w-12 h-12">
            <Image src={url} alt={`Item ${i + 1}`} fill className="object-contain rounded-lg" />
          </div>
        ))}
      </div>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Qual campea usa esse build?"
        />
      )}
    </div>
  )
}
