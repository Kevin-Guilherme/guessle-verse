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
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neon-purple/30 bg-neon-purple/10 text-neon-purple-light text-xs font-display tracking-widest uppercase mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
          Novo desafio todo dia
        </div>

        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white mb-4 leading-tight tracking-wide">
          ESCOLHA SEU{' '}
          <span
            className="text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
            }}
          >
            UNIVERSO
          </span>
        </h1>

        <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto font-medium">
          {universes.length} universos &middot; {universes.reduce((s, u) => s + u.modes.length, 0)} modos &middot; desafio diario unico
        </p>
      </div>

      {/* Universe sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        {character.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-display font-bold text-neon-purple tracking-widest uppercase">Personagens</span>
              <div className="flex-1 h-px bg-gradient-to-r from-neon-purple/30 to-transparent" />
              <span className="text-xs text-slate-600">{character.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {character.map(u => <UniverseCard key={u.slug} universe={u} />)}
            </div>
          </section>
        )}

        {game.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-display font-bold text-neon-cyan tracking-widest uppercase">Jogos</span>
              <div className="flex-1 h-px bg-gradient-to-r from-neon-cyan/30 to-transparent" />
              <span className="text-xs text-slate-600">{game.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {game.map(u => <UniverseCard key={u.slug} universe={u} />)}
            </div>
          </section>
        )}

        {code.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-display font-bold text-neon-pink tracking-widest uppercase">Codigo</span>
              <div className="flex-1 h-px bg-gradient-to-r from-neon-pink/30 to-transparent" />
              <span className="text-xs text-slate-600">{code.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {code.map(u => <UniverseCard key={u.slug} universe={u} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
