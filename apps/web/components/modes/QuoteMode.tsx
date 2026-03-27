'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function QuoteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const fullQuote: string      = (challenge.extra?.quote ?? '') as string
  const quoteSaidTo: string | undefined = (challenge.extra as Record<string, unknown> | null)?.quote_said_to_name as string | undefined
  const alreadyGuessed         = guesses.map((g) => g.value.toLowerCase())
  const showHint               = !won && guesses.length >= 5 && !!quoteSaidTo

  return (
    <div className="space-y-4">
      <p className="text-lg text-gray-200 font-medium italic leading-relaxed bg-bg-surface border border-border rounded-xl p-4">
        &ldquo;{fullQuote}&rdquo;
      </p>

      {won && challenge.image_url && (
        <div className="flex flex-col items-center gap-2 mt-2">
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

      {showHint && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <span className="text-amber-400 text-base shrink-0">💡</span>
          <p className="text-amber-300 text-sm font-sans">
            Esta frase foi dita para <span className="font-semibold">{quoteSaidTo}</span>
          </p>
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
          placeholder="Quem disse isso?"
        />
      )}
    </div>
  )
}
