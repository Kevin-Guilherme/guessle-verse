'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function EyeMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  // Zoom starts at 500%, -60% per guess, minimum 100%
  const zoom    = won ? 100 : Math.max(500 - guesses.length * 60, 100)
  // Eye area: ~50% horizontal, ~35% vertical (upper face of portrait images)
  const eyePos  = '50% 35%'

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-slate-500 font-display tracking-widest uppercase">
        {won ? challenge.name : 'De quem é este olho?'}
      </p>

      {challenge.image_url && (
        <div
          className="w-64 h-40 mx-auto rounded-xl border border-white/10 overflow-hidden"
          style={{
            backgroundImage:    `url(${challenge.image_url})`,
            backgroundSize:     won ? 'contain' : `${zoom}%`,
            backgroundPosition: won ? 'center' : eyePos,
            backgroundRepeat:   'no-repeat',
            backgroundColor:    '#0f0f1a',
            transition:         'background-size 0.7s ease, background-position 0.7s ease',
          }}
        />
      )}

      {won && challenge.image_url && (
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-correct/40">
            <Image
              src={challenge.image_url as string}
              alt={challenge.name}
              fill
              className="object-cover"
            />
          </div>
          <p className="text-correct font-display text-sm tracking-wide">{challenge.name}</p>
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
          placeholder="Nome do personagem..."
        />
      )}
    </div>
  )
}
