'use client'

interface HintRevealProps {
  hint:  1 | 2 | null
  extra: Record<string, unknown>
}

export function HintReveal({ hint, extra }: HintRevealProps) {
  if (!hint) return null

  const text = hint === 1 ? (extra.hint1 ?? 'Dica não disponível') : (extra.hint2 ?? 'Dica não disponível')

  return (
    <div className="hint-slide-down relative rounded-xl border border-partial/30 bg-partial/5 overflow-hidden">
      {/* Amber top ambient */}
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-partial/10 to-transparent pointer-events-none" />

      <div className="relative px-4 py-3.5 flex items-start gap-3">
        {/* Lightbulb icon */}
        <div className="shrink-0 w-7 h-7 rounded-lg bg-partial/15 border border-partial/30 flex items-center justify-center mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-partial" aria-hidden>
            <path d="M9 21h6M12 3a7 7 0 0 1 4 12.9V18a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.1A7 7 0 0 1 12 3z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-display tracking-widest text-partial/70 uppercase mb-0.5">
            Dica {hint}
          </p>
          <p className="text-sm text-slate-300 font-sans leading-relaxed">
            {String(text)}
          </p>
        </div>
      </div>
    </div>
  )
}
