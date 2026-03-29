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

const NATURE_ICONS: Record<string, { emoji: string; color: string }> = {
  'Fire':      { emoji: '🔥', color: '#E74C3C' },
  'Water':     { emoji: '💧', color: '#3498DB' },
  'Wind':      { emoji: '🌀', color: '#1ABC9C' },
  'Lightning': { emoji: '⚡', color: '#F1C40F' },
  'Earth':     { emoji: '🪨', color: '#8B4513' },
  'Yin':       { emoji: '☯️', color: '#9B59B6' },
  'Yang':      { emoji: '☀️', color: '#F39C12' },
  'Yin–Yang':  { emoji: '☯️', color: '#7D3C98' },
  'Wood':      { emoji: '🌿', color: '#27AE60' },
  'Lava':      { emoji: '🌋', color: '#E67E22' },
  'Ice':       { emoji: '🧊', color: '#AED6F1' },
  'Storm':     { emoji: '⛈️', color: '#5D6D7E' },
  'Boil':      { emoji: '♨️', color: '#FF6B35' },
  'Magnet':    { emoji: '🧲', color: '#95A5A6' },
  'Scorch':    { emoji: '☀️', color: '#E74C3C' },
}

export function AttributeCell({ label, value, feedback, index = 0 }: AttributeCellProps) {
  const s     = STYLES[feedback]
  const delay = `${index * 90}ms`

  const isNatureTypes = label === 'Nature Types' && value && value !== 'None' && value !== '—'
  const natures = isNatureTypes ? value.split(',').map(n => n.trim()).filter(Boolean) : []

  return (
    <div
      className={`cell-flip ${s.extra} flex flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center min-h-[72px] ${s.bg} ${s.border}`}
      style={{ '--cell-delay': delay } as React.CSSProperties}
    >
      {isNatureTypes ? (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {natures.map((n) => {
            const icon = NATURE_ICONS[n]
            return icon ? (
              <span key={n} title={n} className="text-lg leading-none">{icon.emoji}</span>
            ) : (
              <span key={n} className={`text-xs font-display font-bold ${s.text}`}>{n}</span>
            )
          })}
        </div>
      ) : (
        <span className={`text-sm font-display font-bold leading-tight flex flex-col items-center gap-1 ${s.text}`}>
          {value || '—'}
          {feedback === 'higher' && <ArrowUp />}
          {feedback === 'lower'  && <ArrowDown />}
        </span>
      )}
    </div>
  )
}
