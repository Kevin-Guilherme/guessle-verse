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

  const eyeCoords = (challenge.extra as Record<string, unknown> | null)?.eye_coords as { left: { x: number; y: number }; right: { x: number; y: number } } | undefined
  const hasEyeCoords = !!eyeCoords
  const eyeSide   = challenge.id % 2 === 0 ? 'left' : 'right'
  const eye       = eyeCoords?.[eyeSide]

  const zoom   = won ? 100 : (hasEyeCoords ? 600 : Math.max(800 - guesses.length * 100, 100))
  const eyePos = won ? 'center' : (hasEyeCoords && eye ? `${eye.x}% ${eye.y}%` : `${challenge.id % 2 === 0 ? '38%' : '62%'} 45%`)

  // Load full-resolution image (strip Fandom scale restriction)
  const hiResUrl = (url: string) =>
    url.replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest')

  const bgUrl = challenge.image_url ? hiResUrl(challenge.image_url as string) : ''

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-slate-500 font-display tracking-widest uppercase">
        {won ? challenge.name : 'De quem é este olho?'}
      </p>

      {challenge.image_url && (
        <div
          className="w-64 h-40 mx-auto rounded-xl border border-white/10 overflow-hidden"
          style={{
            backgroundImage:    `url(${bgUrl})`,
            backgroundSize:     won ? '100%' : `${zoom}%`,
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
