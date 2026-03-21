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

const MAX_VISIBLE_DOTS = 12

function AttemptDots({ count, max }: { count: number; max: number | null }) {
  if (!max) {
    // Unlimited mode — show attempt counter
    return (
      <div className="flex flex-col items-end">
        <span className="font-display text-3xl font-bold text-neon-purple-light leading-none">{count}</span>
        <span className="text-[10px] text-slate-600 uppercase tracking-widest mt-0.5">tentativas</span>
      </div>
    )
  }

  const dots = Math.min(max, MAX_VISIBLE_DOTS)
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-1 flex-wrap justify-end max-w-[120px]">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              i < count ? 'bg-neon-purple' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] text-slate-600 uppercase tracking-widest">
        {count}/{max}
      </span>
    </div>
  )
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] text-slate-600 font-display tracking-[0.2em] uppercase mb-1.5">
            {universeName}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl text-white tracking-wide leading-tight">
            {config.label.toUpperCase()}
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-sans">
            Adivinhe o personagem pelos atributos
          </p>
        </div>
        <AttemptDots count={store.attempts} max={config.maxAttempts ?? null} />
      </div>

      {/* Neon divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-neon-purple/30 to-transparent" />

      {/* Error */}
      {error && (
        <div className="border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3 text-sm text-red-400 font-sans flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      {/* Mode component */}
      {!store.won && !store.lost && (
        <Suspense fallback={
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-xl bg-surface" />
            <Skeleton className="h-14 w-full rounded-xl bg-surface" />
          </div>
        }>
          <ModeLoader challenge={challenge} config={config} submitGuess={submitGuess} loading={loading} />
        </Suspense>
      )}

      {/* Win/Loss banner */}
      {(store.won || store.lost) && (
        <div
          className={`banner-reveal relative rounded-xl border overflow-hidden ${
            store.won
              ? 'border-correct/40 bg-correct/5'
              : 'border-red-500/30 bg-red-500/5'
          }`}
        >
          {/* Ambient glow top */}
          <div
            className="absolute inset-x-0 top-0 h-24 pointer-events-none"
            style={{
              background: store.won
                ? 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.20) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.15) 0%, transparent 70%)',
            }}
          />

          <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <p className={`font-display text-xl sm:text-2xl tracking-wide leading-tight ${store.won ? 'text-correct' : 'text-red-400'}`}>
                {store.won
                  ? `ACERTOU em ${store.attempts} tentativa${store.attempts !== 1 ? 's' : ''}`
                  : 'NAO FOI DESSA VEZ'}
              </p>
              {store.won && store.score != null && (
                <p className="text-sm text-slate-500 mt-1 font-sans">
                  <span className="text-neon-purple-light font-bold font-display text-base">+{store.score}</span>
                  {' '}pontos ganhos
                </p>
              )}
            </div>
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

      {/* Guess history */}
      {store.guesses.length > 0 && (
        <div className="space-y-4">
          {/* Section header */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-display tracking-[0.2em] text-slate-700 uppercase">Histórico</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
            <span className="text-[10px] text-slate-700 font-display tabular-nums">
              {store.guesses.length} {store.guesses.length === 1 ? 'tentativa' : 'tentativas'}
            </span>
          </div>

          <div className="space-y-4">
            {store.guesses.map((g, i) => (
              <GuessRow key={i} guess={g as any} rowIndex={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
