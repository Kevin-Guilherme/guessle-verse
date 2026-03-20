'use client'

import { useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function CodeMode({ challenge, config }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const [answer, setAnswer] = useState('')
  const code: string        = ((challenge.attributes?.code ?? '') as string)
  const modeVariant: string = ((challenge.attributes?.mode_variant ?? challenge.mode) as string)
  const remaining           = (config.maxAttempts ?? 3) - guesses.length

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return
    submitGuess(answer.trim())
    setAnswer('')
  }

  const label = modeVariant === 'complete'
    ? 'Complete o codigo (preencha os ___)'
    : modeVariant === 'fix'
    ? 'Corrija o bug no codigo'
    : 'Qual e a saida desse codigo?'

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-border rounded-xl p-4 font-mono text-sm text-green-400 whitespace-pre-wrap overflow-x-auto">
        {code}
      </div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-xs text-gray-600">{remaining} tentativa(s) restante(s)</p>
      {!won && !lost && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Sua resposta..."
            className="bg-bg-surface border-border text-white font-mono flex-1"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !answer.trim()}>Enviar</Button>
        </form>
      )}
    </div>
  )
}
