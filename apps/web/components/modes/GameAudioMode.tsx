'use client'

import { useRef, useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import { Button } from '@/components/ui/button'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function GameAudioMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  const extra       = challenge.extra as Record<string, unknown>
  const audioUrl    = (extra?.audio_url ?? extra?.soundtrack_url ?? '') as string
  const coverUrl    = extra?.cover_url as string | null
  const maxDuration = Math.min(1 + guesses.length * 1.5, 10)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

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

      <div className="flex flex-col items-center gap-3">
        {coverUrl && (won || lost) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={challenge.name}
            className="w-24 rounded-xl object-cover border border-correct/30"
          />
        )}
        <Button onClick={playClip} disabled={playing || !audioUrl} className="gap-2">
          {playing ? '♫ Reproduzindo...' : `▶ Ouvir (${maxDuration.toFixed(1)}s)`}
        </Button>
        {!won && !lost && (
          <p className="text-[10px] font-display tracking-[0.2em] text-slate-600 uppercase">
            De qual jogo é essa trilha sonora?
          </p>
        )}
        {(won || lost) && (
          <p className={`font-display font-bold text-base tracking-wide ${won ? 'text-correct' : 'text-red-400'}`}>
            {challenge.name}
          </p>
        )}
      </div>

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          source="gamedle_pool"
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Digite o nome do jogo..."
          excludeNames={alreadyGuessed}
        />
      )}

      {guesses.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-display tracking-[0.2em] text-slate-700 uppercase">Tentativas</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
            <span className="text-[10px] text-slate-700 font-display tabular-nums">{guesses.length}</span>
          </div>
          <div className="space-y-1.5">
            {[...guesses].reverse().map((g, i) => {
              const correct = g.feedback?.[0]?.feedback === 'correct'
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl p-3 border ${correct ? 'bg-correct/5 border-correct/20' : 'bg-white/[0.03] border-wrong/20'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-surface border border-white/10 flex items-center justify-center text-base shrink-0">
                    🎵
                  </div>
                  <p className={`text-sm font-display flex-1 truncate ${correct ? 'text-correct' : 'text-slate-300'}`}>
                    {g.value}
                  </p>
                  <span className={`text-[11px] font-sans px-2 py-0.5 rounded-full border shrink-0 ${correct ? 'bg-correct/20 text-correct border-correct/30' : 'bg-wrong/20 text-wrong border-wrong/30'}`}>
                    {correct ? '✓ Acertou' : '✗ Errou'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
