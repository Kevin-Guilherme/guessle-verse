'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

const ELEMENTS = ['fogo', 'agua', 'gelo', 'trovao', 'dragao']
const COLORS: Record<string, string> = {
  fogo:   'text-red-400',
  agua:   'text-blue-400',
  gelo:   'text-cyan-300',
  trovao: 'text-yellow-400',
  dragao: 'text-purple-400',
}

export default function WeaknessMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())
  const weaknesses = (challenge.extra?.weaknesses ?? {}) as Record<string, number>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {ELEMENTS.map((el) => (
          <div key={el} className="text-center">
            <p className={`text-sm font-bold ${COLORS[el]}`}>{el}</p>
            <p className="text-white font-mono text-lg">{weaknesses[el] ?? '?'}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Fraquezas elementais (escala de eficacia)</p>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Qual monstro tem essas fraquezas?"
        />
      )}
    </div>
  )
}
