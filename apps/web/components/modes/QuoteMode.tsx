'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function QuoteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const fullQuote: string  = (challenge.extra?.quote ?? '') as string
  const words              = fullQuote.split(' ')
  const revealed           = Math.min(guesses.length + 1, words.length)
  const alreadyGuessed     = guesses.map((g) => g.value.toLowerCase())
  const display            = words.map((w: string, i: number) =>
    i < revealed ? w : w.replace(/[a-zA-Z\u00C0-\u00FF]/g, '_')
  ).join(' ')

  return (
    <div className="space-y-4">
      <p className="text-lg text-gray-200 font-medium italic leading-relaxed bg-bg-surface border border-border rounded-xl p-4">
        &ldquo;{display}&rdquo;
      </p>
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
