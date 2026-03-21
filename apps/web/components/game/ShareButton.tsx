'use client'

import { useState } from 'react'
import { generateShareText } from '@/lib/game/share'

interface ShareButtonProps {
  universeName: string
  mode:         string
  attempts:     number
  won:          boolean
  guesses:      Array<{ feedback: Array<{ feedback: string }> }>
}

export function ShareButton(props: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const text = generateShareText(
    props.universeName, props.mode, props.attempts, props.won, props.guesses
  )

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* user cancelled share */ }
  }

  return (
    <button
      onClick={share}
      type="button"
      className={`
        inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display tracking-wide
        border transition-all duration-200 cursor-pointer shrink-0
        ${copied
          ? 'border-correct/50 bg-correct/10 text-correct'
          : 'border-neon-purple/40 bg-neon-purple/10 text-neon-purple-light hover:bg-neon-purple/20 hover:border-neon-purple/60 hover:shadow-neon-sm'
        }
      `}
    >
      {copied ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copiado!
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6L12 2L8 6M12 2v13"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Compartilhar
        </>
      )}
    </button>
  )
}
