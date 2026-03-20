'use client'

import { AttributeCell } from './AttributeCell'
import type { FeedbackType } from '@guessle/shared'

interface GuessRowProps {
  guess: {
    value:    string
    feedback: Array<{ key: string; label: string; value: string; feedback: FeedbackType }>
  }
}

export function GuessRow({ guess }: GuessRowProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {guess.feedback.map((f) => (
        <AttributeCell key={f.key} label={f.label} value={f.value} feedback={f.feedback} />
      ))}
    </div>
  )
}
