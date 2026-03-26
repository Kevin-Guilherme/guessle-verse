import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUniverse } from '@/lib/constants/universes'
import { GameClient } from '@/components/game/GameClient'
import { MODE_CONFIGS } from '@/lib/game/registry'
import { getGameDay } from '@/lib/utils/gameDay'

export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string; mode: string }
}

export async function generateStaticParams() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('themes')
    .select('slug, modes')
    .eq('active', true)

  return (data ?? []).flatMap((t) =>
    (t.modes as string[]).map((mode) => ({ slug: t.slug, mode }))
  )
}

export default async function GamePage({ params }: Props) {
  const universe = getUniverse(params.slug)
  if (!universe || !universe.modes.includes(params.mode)) notFound()

  const supabase = createClient()
  const today    = getGameDay()

  const { data: theme } = await supabase
    .from('themes')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (!theme) notFound()

  const { data: challenge } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('theme_id', theme.id)
    .eq('mode', params.mode)
    .eq('date', today)
    .single()

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch completion status for all modes today (for tab indicators)
  let modesStatus: Record<string, 'won' | 'lost'> = {}
  if (user && universe.modes.length > 1) {
    const { data: allChallenges } = await supabase
      .from('daily_challenges')
      .select('id, mode')
      .eq('theme_id', theme.id)
      .eq('date', today)

    if (allChallenges?.length) {
      const { data: sessions } = await supabase
        .from('game_sessions')
        .select('daily_challenge_id, won')
        .in('daily_challenge_id', allChallenges.map((c: { id: number }) => c.id))
        .not('completed_at', 'is', null)

      for (const s of sessions ?? []) {
        const ch = allChallenges.find((c: { id: number; mode: string }) => c.id === s.daily_challenge_id)
        if (ch) modesStatus[ch.mode] = s.won ? 'won' : 'lost'
      }
    }
  }

  if (!challenge) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <p className="text-[11px] text-slate-600 font-display tracking-[0.2em] uppercase mb-1.5">{universe.name}</p>
          <h1 className="font-display text-2xl sm:text-3xl text-white tracking-wide leading-tight">
            {(MODE_CONFIGS[params.mode]?.label ?? params.mode).toUpperCase()}
          </h1>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-neon-purple/30 to-transparent" />

        {/* Mode navigation */}
        {universe.modes.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {universe.modes.map(m => {
              const cfg      = MODE_CONFIGS[m]
              const isActive = m === params.mode
              const status   = modesStatus[m] ?? null
              return (
                <Link
                  key={m}
                  href={`/games/${params.slug}/${m}`}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-display tracking-widest uppercase transition-all duration-200 flex flex-col items-center gap-0.5 ${
                    isActive
                      ? 'bg-neon-purple text-white'
                      : status === 'won'
                        ? 'bg-correct/10 border border-correct/40 text-slate-300 hover:border-correct/60'
                        : status === 'lost'
                          ? 'bg-red-500/5 border border-red-500/30 text-slate-400 hover:border-red-500/50'
                          : 'bg-surface border border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {cfg?.label ?? m}
                  {!isActive && status && (
                    <span className={`w-1 h-1 rounded-full ${status === 'won' ? 'bg-correct' : 'bg-red-400'}`} />
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-3xl">⏳</span>
          <h2 className="font-display text-base text-white tracking-wide">DESAFIO INDISPONÍVEL</h2>
          <p className="text-slate-500 text-sm text-center">Este modo ainda não tem desafio para hoje.</p>
        </div>
      </div>
    )
  }

  return (
    <GameClient
      challengeId={challenge.id}
      slug={params.slug}
      mode={params.mode}
      universeName={universe.name}
      authenticated={!!user}
      challenge={challenge}
      modesStatus={modesStatus}
    />
  )
}
