'use client'

import { useRef, useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import { Button } from '@/components/ui/button'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function AudioMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const audioUrl: string   = ((challenge.extra?.audio_url ?? challenge.extra?.cry_url ?? '') as string)
  const maxDuration        = Math.min(1 + guesses.length * 1.5, 10)
  const alreadyGuessed     = guesses.map((g) => g.value.toLowerCase())

  const playClip = async () => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    audio.currentTime = 0
    setPlaying(true)
    await audio.play()
    setTimeout(() => { audio.pause(); setPlaying(false) }, maxDuration * 1000)
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} preload="auto" />
      <Button onClick={playClip} disabled={playing || !audioUrl} className="gap-2">
        {playing ? 'Reproduzindo...' : `Ouvir (${maxDuration.toFixed(1)}s)`}
      </Button>
      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}
    </div>
  )
}
