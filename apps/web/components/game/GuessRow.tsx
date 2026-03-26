'use client'

import { AttributeCell } from './AttributeCell'
import type { FeedbackType } from '@guessle/shared'

interface GuessRowProps {
  guess: {
    value:     string
    image_url?: string | null
    feedback:  Array<{ key: string; label: string; value: string; feedback: FeedbackType }>
  }
  rowIndex?: number
}

const allCorrect = (feedback: Array<{ feedback: FeedbackType }>) =>
  feedback.every((f) => f.feedback === 'correct')

function getTileUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  // Convert splash URL to tile (square in-game icon)
  return imageUrl.replace('/splash/', '/tiles/')
}

export function GuessRow({ guess, rowIndex = 0 }: GuessRowProps) {
  const won     = allCorrect(guess.feedback)
  const tileUrl = getTileUrl(guess.image_url)
  const isSimple = guess.feedback.length === 1 && guess.feedback[0].key === 'champion'
  const cols    = guess.feedback.length

  // Simple mode (ability, splash, etc.): just champion icon + name pill
  if (isSimple) {
    const fb = guess.feedback[0]
    return (
      <div
        className="row-slide-up flex items-center gap-3"
        style={{ animationDelay: `${rowIndex * 40}ms` }}
      >
        {/* Champion tile */}
        <div className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border
          ${won ? 'border-correct ring-1 ring-correct/40' : 'border-red-800'}`}
        >
          {tileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tileUrl} alt={guess.value} className="w-full h-full object-cover object-top" loading="eager" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface text-[10px] font-display text-slate-500 uppercase tracking-widest p-1 text-center">
              {guess.value.slice(0, 3)}
            </div>
          )}
        </div>
        {/* Name pill */}
        <div className={`flex-1 flex items-center justify-center rounded-lg min-h-[56px] px-4 border font-display font-bold text-sm text-white
          ${won ? 'bg-correct border-correct neon-flash-correct' : 'bg-red-900 border-red-800'}`}
          style={{ '--cell-delay': '0ms' } as React.CSSProperties}
        >
          {fb.value}
          {won && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="ml-2 text-white" aria-hidden>
              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </div>
    )
  }

  // Full attribute grid (classic mode)
  return (
    <div
      className="row-slide-up"
      style={{
        animationDelay: `${rowIndex * 40}ms`,
        display: 'grid',
        gridTemplateColumns: `56px repeat(${cols}, 1fr)`,
        gap: '6px',
        alignItems: 'stretch',
      }}
    >
      {/* Champion icon */}
      <div
        className={`relative rounded-lg overflow-hidden border shrink-0 self-stretch min-h-[72px]
          ${won ? 'border-correct ring-1 ring-correct/40' : 'border-white/10'}
        `}
      >
        {tileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tileUrl} alt={guess.value} className="w-full h-full object-cover object-top" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface text-[10px] font-display text-slate-500 uppercase tracking-widest p-1 text-center">
            {guess.value.slice(0, 3)}
          </div>
        )}
        {won && (
          <div className="absolute inset-0 bg-correct/10 flex items-end justify-center pb-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-correct" aria-hidden>
              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {/* Attribute cells */}
      {guess.feedback.map((f, i) => (
        <AttributeCell key={f.key} label={f.label} value={f.value} feedback={f.feedback} index={i} />
      ))}
    </div>
  )
}
