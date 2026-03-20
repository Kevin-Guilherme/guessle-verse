'use client'

import { lazy, Suspense, useEffect } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { shouldRevealHint } from '@guessle/shared'
import { getModeLoader, MODE_CONFIGS } from '@/lib/game/registry'
import { GuessRow } from './GuessRow'
import { HintReveal } from './HintReveal'
import { ShareButton } from './ShareButton'
import { Skeleton } from '@/components/ui/skeleton'

interface GameClientProps {
  challengeId:   number
  slug:          string
  mode:          string
  universeName:  string
  authenticated: boolean
  challenge:     any
}

export function GameClient({ challengeId, slug, mode, universeName, authenticated, challenge }: GameClientProps) {
  const config     = { slug: mode, ...MODE_CONFIGS[mode] ?? { label: mode, maxAttempts: null } }
  const ModeLoader = lazy(getModeLoader(mode))

  const store = useGameStore()

  useEffect(() => { store.reset() }, [challengeId])

  const hint = shouldRevealHint(store.attempts)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white">{universeName} — {config.label}</h1>
        {config.maxAttempts && (
          <span className="text-xs text-gray-500 bg-bg-surface border border-border px-2 py-0.5 rounded-full">
            {store.attempts}/{config.maxAttempts} tentativas
          </span>
        )}
      </div>

      {!store.won && !store.lost && (
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <ModeLoader challenge={challenge} config={config} />
        </Suspense>
      )}

      {(store.won || store.lost) && (
        <div className={`rounded-xl p-6 border ${store.won ? 'border-correct/30 bg-correct/10' : 'border-red-500/30 bg-red-500/10'}`}>
          <p className={`text-lg font-bold ${store.won ? 'text-correct' : 'text-red-400'}`}>
            {store.won ? `Acertou em ${store.attempts} tentativa(s)!` : 'Nao foi dessa vez.'}
          </p>
          {store.won && store.score != null && (
            <p className="text-sm text-gray-400 mt-1">+{store.score} pontos</p>
          )}
          <div className="mt-4">
            <ShareButton
              universeName={universeName}
              mode={mode}
              attempts={store.attempts}
              won={store.won}
              guesses={store.guesses}
            />
          </div>
        </div>
      )}

      <HintReveal hint={hint} extra={challenge.extra ?? {}} />

      {store.guesses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Tentativas</h2>
          {store.guesses.map((g, i) => (
            <GuessRow key={i} guess={g as any} />
          ))}
        </div>
      )}
    </div>
  )
}
