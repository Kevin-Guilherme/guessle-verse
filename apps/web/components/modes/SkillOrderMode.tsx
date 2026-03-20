'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function SkillOrderMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())
  const order: string[] = ((challenge.extra?.skill_order ?? []) as string[])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        {order.map((skill, i) => (
          <div key={i} className="w-10 h-10 rounded-lg bg-bg-surface border border-border flex items-center justify-center text-lg font-bold text-white">
            {skill}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Ordem de maxar as habilidades</p>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Qual campea usa essa ordem?"
        />
      )}
    </div>
  )
}
