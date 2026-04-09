'use client'

import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function JutsuMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  const videoUrl  = challenge.extra?.jutsu_video_url as string | null
  const imageUrl  = (challenge.extra?.jutsu_image_url ?? challenge.image_url) as string | null
  const jutsuName = (challenge.extra?.jutsu_name ?? '') as string

  const blur      = won ? 0 : Math.max(20 - guesses.length * 7, 0)
  const grayscale = won ? 0 : Math.max(100 - guesses.length * 34, 0)
  const filterStyle: React.CSSProperties = {
    filter: won ? undefined : `blur(${blur}px) grayscale(${grayscale}%)`,
    transition: 'filter 0.8s ease',
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-slate-500 font-display tracking-widest uppercase">
        {won ? jutsuName : 'Qual personagem usa este jutsu?'}
      </p>

      <div className="w-full max-w-sm mx-auto aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
        {videoUrl ? (
          /\.(gif|png|jpe?g|webp)/i.test(videoUrl) ? (
            // Static/animated image (GIF, PNG, JPG, WEBP)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={videoUrl} alt="Jutsu" className="w-full h-full object-cover" style={filterStyle} />
          ) : (
            <video src={videoUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" style={filterStyle} />
          )
        ) : imageUrl ? (
          <div className="relative w-full h-full" style={filterStyle}>
            <Image src={imageUrl} alt="Jutsu" fill className="object-cover" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-700 text-sm">
            Sem mídia disponível
          </div>
        )}
      </div>

      {won && (
        <div className="flex flex-col items-center gap-3 mt-2">
          {challenge.image_url && (
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-correct/40">
              <Image
                src={challenge.image_url as string}
                alt={challenge.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <p className="text-correct font-display text-sm tracking-wide">{challenge.name}</p>
          {videoUrl && (
            <div className="w-full max-w-sm mx-auto aspect-video overflow-hidden rounded-xl border border-correct/20 bg-black">
              {/\.(gif|png|jpe?g|webp)/i.test(videoUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={videoUrl} alt={jutsuName} className="w-full h-full object-cover" />
              ) : (
                <video src={videoUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              )}
            </div>
          )}
        </div>
      )}

      {!won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
          placeholder="Nome do personagem..."
        />
      )}
    </div>
  )
}
