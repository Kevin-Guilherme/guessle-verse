'use client'

import { AttributeCell } from './AttributeCell'
import type { FeedbackType } from '@guessle/shared'

interface GuessRowProps {
  guess: {
    value:    string
    feedback: Array<{ key: string; label: string; value: string; feedback: FeedbackType }>
  }
  rowIndex?: number
}

const allCorrect = (feedback: Array<{ feedback: FeedbackType }>) =>
  feedback.every((f) => f.feedback === 'correct')

export function GuessRow({ guess, rowIndex = 0 }: GuessRowProps) {
  const won = allCorrect(guess.feedback)

  return (
    <div className="row-slide-up space-y-1.5" style={{ animationDelay: `${rowIndex * 40}ms` }}>
      {/* Character name pill */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-display tracking-widest uppercase px-2.5 py-0.5 rounded-full border ${
            won
              ? 'text-correct border-correct/40 bg-correct/10'
              : 'text-slate-400 border-white/10 bg-white/[0.03]'
          }`}
        >
          {guess.value}
        </span>
        {won && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-correct" aria-label="Correto">
            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Attribute cells — each gets a staggered flip delay */}
      <div className="flex gap-1.5 flex-wrap">
        {guess.feedback.map((f, i) => (
          <AttributeCell
            key={f.key}
            label={f.label}
            value={f.value}
            feedback={f.feedback}
            index={i}
          />
        ))}
      </div>
    </div>
  )
}
