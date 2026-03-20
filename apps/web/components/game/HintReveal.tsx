'use client'

interface HintRevealProps {
  hint:  1 | 2 | null
  extra: Record<string, any>
}

export function HintReveal({ hint, extra }: HintRevealProps) {
  if (!hint) return null

  return (
    <div className="bg-bg-surface border border-partial/30 rounded-xl p-4 text-sm">
      <p className="text-partial font-semibold mb-1">
        {hint === 1 ? 'Dica 1' : 'Dica 2'}
      </p>
      <p className="text-gray-300">
        {hint === 1
          ? (extra.hint1 ?? 'Dica não disponível')
          : (extra.hint2 ?? 'Dica não disponível')}
      </p>
    </div>
  )
}
