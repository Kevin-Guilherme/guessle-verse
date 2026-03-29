'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonDescriptionMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const extra        = (challenge.extra  ?? {}) as Record<string, unknown>
  const attrs        = (challenge.attributes ?? {}) as Record<string, unknown>
  const description  = (extra.description ?? '') as string
  const type1        = (attrs.type1 ?? '') as string
  const type2        = (attrs.type2 ?? null) as string | null
  const habitat      = (attrs.habitat ?? '') as string

  const wrongGuesses = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const showTypeHint    = !won && wrongGuesses >= 5
  const showHabitatHint = !won && wrongGuesses >= 10
  const alreadyGuessed  = guesses.map((g) => g.value.toLowerCase())

  const typeLabel = type2 && type2 !== 'None'
    ? `${type1} / ${type2}`
    : type1

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="rounded-xl border border-border bg-bg-surface p-4">
        <p className="text-gray-200 text-base leading-relaxed italic">
          &ldquo;{description || 'Description not available.'}&rdquo;
        </p>
      </div>

      {/* Type hint */}
      {showTypeHint && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <span className="text-amber-400 text-base shrink-0">💡</span>
          <p className="text-amber-300 text-sm font-sans">
            Type: <span className="font-semibold capitalize">{typeLabel}</span>
          </p>
        </div>
      )}

      {/* Habitat hint */}
      {showHabitatHint && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <span className="text-blue-400 text-base shrink-0">🌍</span>
          <p className="text-blue-300 text-sm font-sans">
            Habitat: <span className="font-semibold capitalize">{habitat}</span>
          </p>
        </div>
      )}

      {/* Win reveal */}
      {won && challenge.image_url && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="relative w-20 h-20 overflow-hidden">
            <Image
              src={challenge.image_url as string}
              alt={challenge.name}
              fill
              className="object-contain"
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
          placeholder="Enter Pokémon name..."
          excludeNames={alreadyGuessed}
        />
      )}
    </div>
  )
}
