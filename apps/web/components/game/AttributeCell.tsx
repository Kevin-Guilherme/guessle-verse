'use client'

import type { FeedbackType } from '@guessle/shared'

interface AttributeCellProps {
  label:    string
  value:    string
  feedback: FeedbackType
}

const BG: Record<FeedbackType, string> = {
  correct: 'bg-correct text-white',
  partial: 'bg-partial text-black',
  wrong:   'bg-wrong text-gray-300',
  higher:  'bg-arrow text-white',
  lower:   'bg-arrow text-white',
}

const ARROW: Record<FeedbackType, string> = {
  higher:  ' ↑',
  lower:   ' ↓',
  correct: '',
  partial: '',
  wrong:   '',
}

export function AttributeCell({ label, value, feedback }: AttributeCellProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg p-2 min-w-[72px] text-center transition-colors duration-300 ${BG[feedback]}`}>
      <span className="text-xs font-medium opacity-75 mb-0.5 truncate max-w-full">{label}</span>
      <span className="text-sm font-bold truncate max-w-full">
        {value}{ARROW[feedback]}
      </span>
    </div>
  )
}
