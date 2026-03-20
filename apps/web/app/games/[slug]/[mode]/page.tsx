import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUniverse } from '@/lib/constants/universes'
import { GameClient } from '@/components/game/GameClient'

export const revalidate = 86400

interface Props {
  params: { slug: string; mode: string }
}

export async function generateStaticParams() {
  const supabase = createClient()
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
  const today    = new Date().toISOString().split('T')[0]

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

  if (!challenge) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-2xl mb-2">&#x23F3;</p>
        <h2 className="text-lg font-semibold text-white mb-2">
          Desafio de hoje ainda nao esta disponivel
        </h2>
        <p className="text-gray-400 text-sm">Volte mais tarde ou tente outro modo.</p>
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
    />
  )
}
