'use client'

import type { FeedbackType } from '@guessle/shared'

interface AttributeCellProps {
  label:    string
  value:    string
  feedback: FeedbackType
  index?:   number
}

const STYLES: Record<FeedbackType, { bg: string; text: string; border: string; extra: string }> = {
  correct: {
    bg:     'bg-correct',
    text:   'text-white',
    border: 'border-correct',
    extra:  'neon-flash-correct',
  },
  partial: {
    bg:     'bg-partial',
    text:   'text-white',
    border: 'border-partial',
    extra:  '',
  },
  wrong: {
    bg:     'bg-red-900',
    text:   'text-white',
    border: 'border-red-800',
    extra:  '',
  },
  higher: {
    bg:     'bg-red-800',
    text:   'text-white',
    border: 'border-red-700',
    extra:  '',
  },
  lower: {
    bg:     'bg-red-800',
    text:   'text-white',
    border: 'border-red-700',
    extra:  '',
  },
}

function ArrowUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M5 1L9 8H1L5 1Z" fill="currentColor"/>
    </svg>
  )
}

function ArrowDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M5 9L1 2H9L5 9Z" fill="currentColor"/>
    </svg>
  )
}

export function AttributeCell({ value, feedback, index = 0 }: AttributeCellProps) {
  const s     = STYLES[feedback]
  const delay = `${index * 90}ms`

  return (
    <div
      className={`cell-flip ${s.extra} flex flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center min-h-[72px] ${s.bg} ${s.border}`}
      style={{ '--cell-delay': delay } as React.CSSProperties}
    >
      <span className={`text-sm font-display font-bold leading-tight flex flex-col items-center gap-1 ${s.text}`}>
        {value || '—'}
        {feedback === 'higher' && <ArrowUp />}
        {feedback === 'lower'  && <ArrowDown />}
      </span>
    </div>
  )
}
