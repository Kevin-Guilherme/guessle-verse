'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import { Button } from '@/components/ui/button'
import type { ModeComponentProps } from '@/lib/game/registry'

// Duração revelada por número de tentativas (Heardle-style)
const REVEAL_STEPS = [1, 2, 4, 7, 11, 16]

// ─── YouTube iFrame API singleton ────────────────────────────────────────────

declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YTPlayer {
  seekTo(sec: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  destroy(): void
  getPlayerState(): number
}

interface YTPlayerOptions {
  videoId: string
  playerVars?: Record<string, unknown>
  events?: {
    onReady?: () => void
    onError?: (e: { data: number }) => void
  }
}

let ytApiState: 'idle' | 'loading' | 'ready' = 'idle'
const ytCallbacks: Array<() => void> = []

function loadYouTubeApi(onReady: () => void) {
  if (ytApiState === 'ready') { onReady(); return }
  ytCallbacks.push(onReady)
  if (ytApiState === 'loading') return

  ytApiState = 'loading'
  window.onYouTubeIframeAPIReady = () => {
    ytApiState = 'ready'
    ytCallbacks.splice(0).forEach(cb => cb())
  }
  const s = document.createElement('script')
  s.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(s)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GameAudioMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const extra        = challenge.extra as Record<string, unknown>
  const youtubeId    = (extra?.youtube_id  ?? null) as string | null
  const youtubeStart = (extra?.youtube_start ?? 0)  as number
  const audioUrl     = (extra?.audio_url ?? extra?.soundtrack_url ?? '') as string
  const coverUrl     = (extra?.cover_url ?? null) as string | null

  const step        = Math.min(guesses.length, REVEAL_STEPS.length - 1)
  const maxDuration = REVEAL_STEPS[step]
  const alreadyGuessed = guesses.map(g => g.value.toLowerCase())

  // ── YouTube player ──────────────────────────────────────────────────────────
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const playerRef          = useRef<YTPlayer | null>(null)
  const [apiReady, setApiReady]       = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [playing, setPlaying]         = useState(false)
  const playTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!youtubeId) return
    loadYouTubeApi(() => setApiReady(true))
  }, [youtubeId])

  useEffect(() => {
    if (!apiReady || !playerContainerRef.current || !youtubeId) return

    setPlayerReady(false)
    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      videoId: youtubeId,
      playerVars: {
        autoplay:       0,
        controls:       0,
        disablekb:      1,
        fs:             0,
        iv_load_policy: 3,
        modestbranding: 1,
        rel:            0,
        start:          youtubeStart,
        enablejsapi:    1,
        origin:         window.location.origin,
      },
      events: {
        onReady: () => setPlayerReady(true),
      },
    })

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current)
      try { playerRef.current?.destroy() } catch {}
      playerRef.current = null
      setPlayerReady(false)
    }
  }, [apiReady, youtubeId, youtubeStart])

  const playYoutube = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    if (playTimerRef.current) clearTimeout(playTimerRef.current)

    p.seekTo(youtubeStart, true)
    p.playVideo()
    setPlaying(true)

    playTimerRef.current = setTimeout(() => {
      p.pauseVideo()
      setPlaying(false)
    }, maxDuration * 1000)
  }, [youtubeStart, maxDuration])

  // ── Fallback: <audio> para games com audio_url manual ──────────────────────
  const audioRef = useRef<HTMLAudioElement>(null)
  const playAudio = useCallback(async () => {
    const a = audioRef.current
    if (!a || !audioUrl) return
    if (playTimerRef.current) clearTimeout(playTimerRef.current)

    a.currentTime = 0
    setPlaying(true)
    try {
      await a.play()
    } catch {
      setPlaying(false)
      return
    }

    playTimerRef.current = setTimeout(() => {
      a.pause()
      setPlaying(false)
    }, maxDuration * 1000)
  }, [audioUrl, maxDuration])

  const handlePlay = youtubeId ? playYoutube : playAudio
  const canPlay    = youtubeId ? playerReady : !!audioUrl

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Player YouTube — invisível, apenas áudio */}
      {youtubeId && (
        <div
          aria-hidden
          style={{
            position:      'fixed',
            left:          '-9999px',
            bottom:        0,
            width:         '200px',
            height:        '200px',
            opacity:       0.001,
            pointerEvents: 'none',
          }}
        >
          <div ref={playerContainerRef} style={{ width: '200px', height: '200px' }} />
        </div>
      )}

      {/* Fallback audio element */}
      {!youtubeId && audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="none" />
      )}

      {/* Controles */}
      <div className="flex flex-col items-center gap-3">

        {/* Reveal na vitória/derrota */}
        {coverUrl && (won || lost) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={challenge.name}
            className="w-24 rounded-xl object-cover border border-correct/30"
          />
        )}

        {/* Barra de progresso das tentativas (steps) */}
        {!won && !lost && (
          <div className="flex items-end gap-1.5" title={`${maxDuration}s revelados`}>
            {REVEAL_STEPS.map((s, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i < step
                    ? 'bg-wrong/50 w-5 h-1'
                    : i === step
                    ? 'bg-white/50 w-7 h-1.5'
                    : 'bg-white/10 w-4 h-1'
                }`}
              />
            ))}
            <span className="text-[10px] text-slate-600 ml-1 font-mono tabular-nums">{maxDuration}s</span>
          </div>
        )}

        <Button
          onClick={handlePlay}
          disabled={playing || !canPlay}
          className="gap-2 min-w-[140px]"
        >
          {playing
            ? '♫ Reproduzindo...'
            : canPlay
            ? `▶ Ouvir (${maxDuration}s)`
            : '⏳ Carregando...'}
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

      {/* Input de palpite */}
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

      {/* Histórico de tentativas */}
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
                  className={`flex items-center gap-3 rounded-xl p-3 border ${
                    correct
                      ? 'bg-correct/5 border-correct/20'
                      : 'bg-white/[0.03] border-wrong/20'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-surface border border-white/10 flex items-center justify-center text-base shrink-0">
                    🎵
                  </div>
                  <p className={`text-sm font-display flex-1 truncate ${correct ? 'text-correct' : 'text-slate-300'}`}>
                    {g.value}
                  </p>
                  <span className={`text-[11px] font-sans px-2 py-0.5 rounded-full border shrink-0 ${
                    correct
                      ? 'bg-correct/20 text-correct border-correct/30'
                      : 'bg-wrong/20 text-wrong border-wrong/30'
                  }`}>
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
