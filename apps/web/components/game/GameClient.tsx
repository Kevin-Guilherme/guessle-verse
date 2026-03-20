'use client'

import { lazy, Suspense, useEffect, useMemo } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { shouldRevealHint } from '@guessle/shared'
import { getModeLoader, MODE_CONFIGS } from '@/lib/game/registry'
import { useGameSession } from '@/hooks/useGameSession'
import { useGuess } from '@/hooks/useGuess'
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
  const ModeLoader = useMemo(() => lazy(getModeLoader(mode)), [mode])

  const store = useGameStore()
  const reset = useGameStore((s) => s.reset)

  useGameSession(challengeId, authenticated)
  const { submitGuess, loading, error } = useGuess(challengeId)

  useEffect(() => { reset() }, [challengeId, reset])

  const hint = shouldRevealHint(store.attempts)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-display tracking-widest uppercase mb-1">{universeName}</p>
          <h1 className="font-display text-2xl text-white tracking-wide">{config.label.toUpperCase()}</h1>
        </div>
        {config.maxAttempts && (
          <div className="text-right">
            <span className="font-display text-2xl font-bold text-neon-purple-light">
              {store.attempts}
            </span>
            <span className="text-slate-600 font-display">/{config.maxAttempts}</span>
            <p className="text-xs text-slate-600 uppercase tracking-wider">tentativas</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Mode component */}
      {!store.won && !store.lost && (
        <Suspense fallback={
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-xl bg-surface" />
            <Skeleton className="h-12 w-full rounded-xl bg-surface" />
          </div>
        }>
          <ModeLoader challenge={challenge} config={config} submitGuess={submitGuess} loading={loading} />
        </Suspense>
      )}

      {/* Win/Loss banner */}
      {(store.won || store.lost) && (
        <div
          className={`relative rounded-xl p-6 border overflow-hidden ${
            store.won
              ? 'border-correct/30 bg-correct/5'
              : 'border-red-500/30 bg-red-500/5'
          }`}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: store.won
                ? 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.15) 0%, transparent 60%)'
                : 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.15) 0%, transparent 60%)',
            }}
          />
          <div className="relative">
            <p className={`font-display text-xl tracking-wide mb-1 ${store.won ? 'text-correct' : 'text-red-400'}`}>
              {store.won ? `ACERTOU — ${store.attempts} TENTATIVA${store.attempts !== 1 ? 'S' : ''}` : 'NAO FOI DESSA VEZ'}
            </p>
            {store.won && store.score != null && (
              <p className="text-sm text-slate-400 mb-4">
                <span className="text-neon-purple-light font-bold font-display">+{store.score}</span> pontos
              </p>
            )}
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

      {/* Hint */}
      <HintReveal hint={hint} extra={challenge.extra ?? {}} />

      {/* Guesses */}
      {store.guesses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-display tracking-widest text-slate-600 uppercase">Tentativas</span>
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-slate-700 font-display">{store.guesses.length}</span>
          </div>
          {store.guesses.map((g, i) => (
            <GuessRow key={i} guess={g as any} />
          ))}
        </div>
      )}
    </div>
  )
}
