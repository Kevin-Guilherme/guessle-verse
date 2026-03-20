import { createClient } from '@/lib/supabase/server'
import { UniverseCard } from '@/components/layout/universe-card'
import { UNIVERSES } from '@/lib/constants/universes'
import type { Universe } from '@guessle/shared'

export const revalidate = 3600

export default async function HomePage() {
  const supabase = createClient()
  const { data: themes } = await supabase
    .from('themes')
    .select('slug, active')
    .eq('active', true)

  const activeSlugs = new Set(themes?.map(t => t.slug) ?? [])
  const universes: Universe[] = UNIVERSES.filter(u => activeSlugs.has(u.slug))

  const character = universes.filter(u => u.type === 'character')
  const game      = universes.filter(u => u.type === 'game')
  const code      = universes.filter(u => u.type === 'code')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-3">
          Escolha seu universo
        </h1>
        <p className="text-gray-400 text-lg">
          Um novo desafio todo dia em cada modo
        </p>
      </div>

      {character.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Personagens
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {character.map(u => <UniverseCard key={u.slug} universe={u} />)}
          </div>
        </section>
      )}

      {game.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Jogos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {game.map(u => <UniverseCard key={u.slug} universe={u} />)}
          </div>
        </section>
      )}

      {code.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Codigo
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {code.map(u => <UniverseCard key={u.slug} universe={u} />)}
          </div>
        </section>
      )}
    </div>
  )
}
