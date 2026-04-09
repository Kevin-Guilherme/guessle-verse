'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function GameImageMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const zoom   = Math.max(500 - guesses.length * 80, 100)
  const cropX  = (challenge.id * 37) % 60 + 20
  const cropY  = (challenge.id * 53) % 60 + 20
  const isScreenshot = challenge.mode === 'screenshot'

  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {challenge.image_url && (
        <div className="flex justify-center">
          {won || lost ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={challenge.image_url as string}
              alt={challenge.name}
              className="w-full max-w-sm rounded-xl border border-correct/30 object-cover transition-all duration-700"
            />
          ) : (
            <div className={`overflow-hidden rounded-xl ${isScreenshot ? 'w-[300px] h-[170px]' : 'w-[180px] h-[240px]'}`}>
              <div
                className="w-full h-full bg-no-repeat transition-all duration-500"
                style={{
                  backgroundImage:    `url(${challenge.image_url as string})`,
                  backgroundSize:     `${zoom}%`,
                  backgroundPosition: `${cropX}% ${cropY}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {!won && !lost && (
        <>
          <p className="text-center text-[10px] font-display tracking-[0.2em] text-slate-600 uppercase">
            {isScreenshot ? 'De qual jogo é esse screenshot?' : 'Qual é esse jogo pela capa?'}
          </p>
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
        </>
      )}

      {(won || lost) && (
        <p className={`text-center font-display font-bold text-base tracking-wide ${won ? 'text-correct' : 'text-red-400'}`}>
          {challenge.name}
        </p>
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
                    🕹️
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
