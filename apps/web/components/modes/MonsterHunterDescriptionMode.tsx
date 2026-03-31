'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function MonsterHunterDescriptionMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const extra       = (challenge.extra  ?? {}) as Record<string, unknown>
  const description = (extra.description ?? '') as string
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {/* Hunter's Notes */}
      <div className="rounded-xl border border-border bg-bg-surface p-4">
        <p className="text-gray-200 text-base leading-relaxed italic">
          &ldquo;{description || "Hunter's Notes not available."}&rdquo;
        </p>
      </div>

      {/* Win reveal */}
      {won && challenge.image_url && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="relative w-32 h-32 overflow-hidden">
            <Image
              src={challenge.image_url as string}
              alt={challenge.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
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
          placeholder="Enter monster name..."
          excludeNames={alreadyGuessed}
        />
      )}
    </div>
  )
}
