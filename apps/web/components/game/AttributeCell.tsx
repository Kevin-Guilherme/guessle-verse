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
    bg:     'bg-correct/20',
    text:   'text-correct',
    border: 'border-correct/60',
    extra:  'neon-flash-correct',
  },
  partial: {
    bg:     'bg-partial/20',
    text:   'text-partial',
    border: 'border-partial/60',
    extra:  '',
  },
  wrong: {
    bg:     'bg-white/[0.03]',
    text:   'text-slate-400',
    border: 'border-white/10',
    extra:  '',
  },
  higher: {
    bg:     'bg-arrow/20',
    text:   'text-arrow',
    border: 'border-arrow/50',
    extra:  '',
  },
  lower: {
    bg:     'bg-arrow/20',
    text:   'text-arrow',
    border: 'border-arrow/50',
    extra:  '',
  },
}

function ArrowUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M5 1L9 8H1L5 1Z" fill="currentColor"/>
    </svg>
  )
}

function ArrowDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M5 9L1 2H9L5 9Z" fill="currentColor"/>
    </svg>
  )
}

export function AttributeCell({ label, value, feedback, index = 0 }: AttributeCellProps) {
  const s = STYLES[feedback]
  const delay = `${index * 90}ms`

  return (
    <div
      className={`cell-flip ${s.extra} flex flex-col items-center justify-center rounded-lg border px-2 py-2.5 min-w-[76px] max-w-[120px] text-center ${s.bg} ${s.border}`}
      style={{ '--cell-delay': delay } as React.CSSProperties}
    >
      <span className="text-[10px] font-sans font-medium text-slate-500 mb-1 truncate max-w-full uppercase tracking-wider leading-none">
        {label}
      </span>
      <span className={`text-sm font-display font-bold truncate max-w-full flex items-center gap-1 ${s.text}`}>
        {value}
        {feedback === 'higher' && <ArrowUp />}
        {feedback === 'lower'  && <ArrowDown />}
      </span>
    </div>
  )
}
