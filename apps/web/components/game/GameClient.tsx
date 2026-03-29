'use client'

import { lazy, Suspense, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useGameStore } from '@/lib/store/game-store'
import { shouldRevealHint } from '@guessle/shared'
import { getModeLoader, MODE_CONFIGS } from '@/lib/game/registry'
import { getUniverse } from '@/lib/constants/universes'
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
  modesStatus?:  Record<string, 'won' | 'lost'>
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

export function GameClient({ challengeId, slug, mode, universeName, authenticated, challenge, modesStatus = {} }: GameClientProps) {
  const config     = { slug: mode, ...MODE_CONFIGS[mode] ?? { label: mode, maxAttempts: null } }
  const ModeLoader = useMemo(() => lazy(getModeLoader(mode)), [mode])
  const universe   = getUniverse(slug)

  const store = useGameStore()
  const reset = useGameStore((s) => s.reset)

  // Build quest mode manages its own completion UI (ScoreSummary per quest).
  // Keep ModeLoader mounted after win so ScoreSummary is shown; suppress the generic banner.
  const isBuildQuestMode = mode === 'build' && Array.isArray((challenge.extra as Record<string, unknown>)?.quests)

  const { loading: sessionLoading } = useGameSession(challengeId, authenticated)
  const { submitGuess, loading, error } = useGuess(challengeId)

  useEffect(() => { reset() }, [challengeId, reset])

  const hint = shouldRevealHint(store.attempts)

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-neon-purple animate-spin" />
          <p className="text-[10px] font-display tracking-[0.2em] text-slate-600 uppercase">Carregando...</p>
        </div>
      </div>
    )
  }

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

      {/* Mode navigation */}
      {universe && universe.modes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {universe.modes.map(m => {
            const cfg      = MODE_CONFIGS[m]
            const isActive = m === mode
            const status   = m === mode
              ? (store.won ? 'won' : store.lost ? 'lost' : null)
              : (modesStatus[m] ?? null)
            return (
              <Link
                key={m}
                href={`/games/${slug}/${m}`}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-display tracking-widest uppercase transition-all duration-200 flex flex-col items-center gap-0.5 ${
                  isActive
                    ? 'bg-neon-purple text-white'
                    : status === 'won'
                      ? 'bg-correct/10 border border-correct/40 text-slate-300 hover:border-correct/60'
                      : status === 'lost'
                        ? 'bg-red-500/5 border border-red-500/30 text-slate-400 hover:border-red-500/50'
                        : 'bg-surface border border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                }`}
              >
                {cfg?.label ?? m}
                {!isActive && status && (
                  <span className={`w-1 h-1 rounded-full ${status === 'won' ? 'bg-correct' : 'bg-red-400'}`} />
                )}
              </Link>
            )
          })}
        </div>
      )}

      {/* Guess submit loading bar */}
      {loading && (
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-2/5 bg-neon-purple animate-loading-bar" />
        </div>
      )}

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

      {/* Mode component — build quest stays mounted after win to show ScoreSummary */}
      {(!store.won && !store.lost || isBuildQuestMode) && (
        <Suspense fallback={
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-xl bg-surface" />
            <Skeleton className="h-14 w-full rounded-xl bg-surface" />
          </div>
        }>
          <ModeLoader challenge={challenge} config={config} submitGuess={submitGuess} loading={loading} />
        </Suspense>
      )}

      {/* Win/Loss banner — suppressed for build quest (BuildMode shows ScoreSummary instead) */}
      {(store.won || store.lost) && !isBuildQuestMode && (
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

      {/* Quadra Kill — reveal all groups on loss */}
      {store.lost && mode === 'quadra' && (() => {
        type QGroup = { category: string; color: string; champions: string[] }
        const groups = ((challenge.attributes as Record<string, unknown>)?.groups ?? []) as QGroup[]
        const colorMap: Record<string, string> = {
          green:  'bg-green-600/80 border-green-400/50',
          yellow: 'bg-yellow-600/80 border-yellow-400/50',
          orange: 'bg-orange-600/80 border-orange-400/50',
          purple: 'bg-purple-600/80 border-purple-400/50',
        }
        return (
          <div className="space-y-2">
            <p className="text-[10px] font-display tracking-widest text-slate-600 uppercase text-center">Respostas</p>
            {groups.map(g => (
              <div key={g.category} className={`rounded-xl border px-4 py-3 ${colorMap[g.color] ?? 'bg-surface border-white/10'}`}>
                <p className="text-xs font-display font-bold uppercase tracking-widest mb-1 text-white/90">{g.category}</p>
                <p className="text-[11px] text-white/70">{g.champions.join(' · ')}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Hint */}
      <HintReveal hint={hint} extra={challenge.extra ?? {}} />

      {/* Guess history */}
      {store.guesses.length > 0 && (() => {
        const firstGuess = store.guesses[0]
        const forceSimple = mode.startsWith('pokemon-') && mode !== 'pokemon-classic'
        const isSimple   = forceSimple || (firstGuess.feedback.length === 1 && firstGuess.feedback[0].key === 'champion')
        const cols       = firstGuess.feedback.length
        return (
          <div className="space-y-2">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-display tracking-[0.2em] text-slate-700 uppercase">Histórico</span>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-[10px] text-slate-700 font-display tabular-nums">
                {store.guesses.length} {store.guesses.length === 1 ? 'tentativa' : 'tentativas'}
              </span>
            </div>

            {/* Column headers — only for full attribute modes */}
            {!isSimple && (
              <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${cols}, 1fr)`, gap: '6px' }}>
                <div className="flex items-center justify-center pb-1">
                  <span className="text-[10px] font-display tracking-wider text-slate-400 uppercase text-center">Champion</span>
                </div>
                {firstGuess.feedback.map((f) => (
                  <div key={f.key} className="flex items-center justify-center pb-1 px-1">
                    <span className="text-[10px] font-display tracking-wider text-slate-400 uppercase text-center leading-tight">
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {[...store.guesses].reverse().map((g, i) => (
                <GuessRow key={i} guess={g as any} rowIndex={i} />
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
