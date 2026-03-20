import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: sessions } = await supabase
    .from('game_sessions')
    .select('*, daily_challenges(mode, themes(name, icon))')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20)

  const wins   = sessions?.filter((s: any) => s.won).length ?? 0
  const total  = sessions?.length ?? 0
  const topScore = sessions?.reduce((m: number, s: any) => Math.max(m, s.score ?? 0), 0) ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Profile header */}
      <div className="relative rounded-2xl border border-white/5 bg-surface overflow-hidden p-8 mb-8">
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 0% 50%, rgba(124,58,237,0.3) 0%, transparent 60%)' }} />
        <div className="relative flex items-center gap-5">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center text-xl font-bold text-white shadow-neon-purple">
            {(user.email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-2xl text-white tracking-wide">PERFIL</h1>
            <p className="text-slate-500 text-sm mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5">
          {[
            { label: 'PARTIDAS', value: total, color: 'text-neon-cyan' },
            { label: 'VITORIAS', value: wins, color: 'text-correct' },
            { label: 'TOP SCORE', value: topScore.toLocaleString(), color: 'text-neon-purple-light' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-600 font-display tracking-widest mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-display text-neon-purple tracking-widest uppercase">Historico Recente</span>
          <div className="flex-1 h-px bg-gradient-to-r from-neon-purple/30 to-transparent" />
        </div>

        {(!sessions || sessions.length === 0) ? (
          <div className="text-center py-16">
            <p className="font-display text-slate-600 tracking-widest">NENHUMA PARTIDA AINDA</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => (
              <div
                key={s.id}
                className="bg-surface border border-white/5 rounded-xl px-5 py-4 flex items-center justify-between hover:border-white/10 transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${s.won ? 'bg-correct' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-white text-sm font-medium">
                      {s.daily_challenges?.themes?.icon}{' '}
                      {s.daily_challenges?.themes?.name} &mdash;{' '}
                      <span className="font-display text-xs tracking-wide text-slate-400">
                        {(s.daily_challenges?.mode ?? '').toUpperCase()}
                      </span>
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {new Date(s.started_at).toLocaleDateString('pt-BR')} &middot; {s.attempts} tentativas
                    </p>
                  </div>
                </div>
                <span className={`font-display text-sm font-bold ${s.won ? 'text-correct' : 'text-red-500'}`}>
                  {s.won ? `+${s.score}` : '---'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
