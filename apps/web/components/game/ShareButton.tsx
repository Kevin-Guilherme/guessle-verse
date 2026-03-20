'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
    if (navigator.share) {
      await navigator.share({ text })
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button onClick={share} variant="outline" className="gap-2">
      {copied ? '✅ Copiado!' : '📤 Compartilhar'}
    </Button>
  )
}
