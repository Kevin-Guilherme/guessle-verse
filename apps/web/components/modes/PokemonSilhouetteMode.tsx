'use client'

import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function PokemonSilhouetteMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const wrongGuesses   = guesses.filter(g => g.feedback?.[0]?.feedback !== 'correct').length
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  const edgeOffset = (challenge.id * 37) % 20 + 1
  const cropX      = (challenge.id % 2 === 0) ? edgeOffset : 100 - edgeOffset
  const cropY      = (challenge.id * 53) % 32 + 23
  const scale      = won ? 1 : Math.max(2.0 - wrongGuesses * 0.1, 1)
  const imageUrl   = challenge.image_url as string | undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {won ? challenge.name : "Who's that Pokémon? The silhouette reveals more with each wrong guess."}
      </p>

      <div className="flex justify-center">
        <div
          className="rounded-xl border border-white/20 overflow-hidden flex items-center justify-center"
          style={{ width: 256, height: 256, backgroundColor: '#ffffff' }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={won ? challenge.name : 'Pokémon silhouette'}
              style={{
                width:           '100%',
                height:          '100%',
                objectFit:       'contain',
                transform:       `scale(${scale})`,
                transformOrigin: `${cropX}% ${cropY}%`,
                transition:      'transform 400ms ease, filter 400ms ease',
                filter:          won ? 'none' : 'brightness(0)',
              }}
              draggable={false}
            />
          )}
        </div>
      </div>

      {won && (
        <p className="text-correct font-display font-bold text-sm tracking-wide text-center">
          {challenge.name}
        </p>
      )}

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => submitGuess(name)}
          disabled={loading}
          placeholder="Enter Pokémon name..."
          excludeNames={alreadyGuessed}
        />
      )}

      {/* All guesses with scroll */}
      {guesses.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-display tracking-[0.2em] text-slate-700 uppercase">Tentativas</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
            <span className="text-[10px] text-slate-700 font-display tabular-nums">{guesses.length}</span>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
            {[...guesses].reverse().map((g) => {
              const correct = g.value.toLowerCase() === challenge.name.toLowerCase()
              return (
                <div key={g.value} className={`flex items-center gap-3 rounded-xl p-3 border ${correct ? 'bg-correct/5 border-correct/20' : 'bg-white/[0.03] border-wrong/20'}`}>
                  {g.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.image_url} alt={g.value} className="w-10 h-10 rounded-lg object-contain border border-white/10 shrink-0 bg-white/5" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface border border-white/10 flex items-center justify-center text-slate-500 text-xs shrink-0">
                      {g.value[0]?.toUpperCase()}
                    </div>
                  )}
                  <p className={`text-sm font-display flex-1 truncate ${correct ? 'text-correct' : 'text-slate-300'}`}>{g.value}</p>
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
